<script setup lang="ts">
import { BranchesService, CommitsService, MessagesService, OpenAPI } from '../api/generated'
import { useAuthStore } from '../stores/auth'
import { streamChatSse } from '../api/sseChatStream'
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

const props = defineProps<{ workspaceId: string; branchId: string }>()
const auth = useAuthStore()
const router = useRouter()

// Layout constants (same as design)
const ROW_HEIGHT = 60
const TRACK_GAP = 22
const START_X = 20
const SIDEBAR_MIN_WIDTH = 280
const SIDEBAR_MAX_WIDTH = 560
const SIDEBAR_DEFAULT_WIDTH = 340
const GRAPH_PANE_MIN_WIDTH = 80
const GRAPH_PANE_MAX_WIDTH = 320
const GRAPH_PANE_DEFAULT_WIDTH = 110
const COMMIT_LIST_MIN_WIDTH = 160
const SIDEBAR_WIDTH_KEY = 'gitai_sidebar_width'
const SIDEBAR_COLLAPSED_KEY = 'gitai_sidebar_collapsed'
const GRAPH_PANE_WIDTH_KEY = 'gitai_graph_pane_width'

// Theme
const isDark = ref(true)
const applyTheme = (dark: boolean) => {
  const root = document.documentElement
  if (dark) root.classList.add('dark')
  else root.classList.remove('dark')
  localStorage.setItem('gitai_theme', dark ? 'dark' : 'light')
}
const toggleTheme = () => {
  isDark.value = !isDark.value
  applyTheme(isDark.value)
  toastNow('Theme', isDark.value ? 'Dark mode' : 'Light mode')
}

const sidebarWidth = ref(SIDEBAR_DEFAULT_WIDTH)
const sidebarCollapsed = ref(false)
const sidebarResizing = ref(false)
let sidebarResizeStartX = 0
let sidebarResizeStartWidth = SIDEBAR_DEFAULT_WIDTH
const graphPaneWidth = ref(GRAPH_PANE_DEFAULT_WIDTH)
const graphPaneResizing = ref(false)
let graphPaneResizeStartX = 0
let graphPaneResizeStartWidth = GRAPH_PANE_DEFAULT_WIDTH

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v))

const persistSidebarState = () => {
  localStorage.setItem(SIDEBAR_WIDTH_KEY, String(sidebarWidth.value))
  localStorage.setItem(SIDEBAR_COLLAPSED_KEY, sidebarCollapsed.value ? '1' : '0')
  localStorage.setItem(GRAPH_PANE_WIDTH_KEY, String(graphPaneWidth.value))
}

const loadSidebarState = () => {
  const savedWidth = Number(localStorage.getItem(SIDEBAR_WIDTH_KEY))
  if (!Number.isNaN(savedWidth) && savedWidth > 0) {
    sidebarWidth.value = clamp(savedWidth, SIDEBAR_MIN_WIDTH, SIDEBAR_MAX_WIDTH)
  }
  const savedGraphPaneWidth = Number(localStorage.getItem(GRAPH_PANE_WIDTH_KEY))
  if (!Number.isNaN(savedGraphPaneWidth) && savedGraphPaneWidth > 0) {
    graphPaneWidth.value = clamp(savedGraphPaneWidth, GRAPH_PANE_MIN_WIDTH, GRAPH_PANE_MAX_WIDTH)
  }
  const maxGraph = Math.max(GRAPH_PANE_MIN_WIDTH, Math.min(GRAPH_PANE_MAX_WIDTH, sidebarWidth.value - COMMIT_LIST_MIN_WIDTH))
  if (graphPaneWidth.value > maxGraph) graphPaneWidth.value = maxGraph
  sidebarCollapsed.value = localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1'
}

const stopSidebarResize = () => {
  if (!sidebarResizing.value) return
  sidebarResizing.value = false
  window.removeEventListener('mousemove', onSidebarResizeMove)
  window.removeEventListener('mouseup', stopSidebarResize)
  persistSidebarState()
}

const onSidebarResizeMove = (e: MouseEvent) => {
  if (!sidebarResizing.value) return
  const delta = e.clientX - sidebarResizeStartX
  sidebarWidth.value = clamp(sidebarResizeStartWidth + delta, SIDEBAR_MIN_WIDTH, SIDEBAR_MAX_WIDTH)
  // 사이드바가 줄어들 때 그래프 패널이 리스트를 밀어내지 않도록 보정
  const maxGraph = Math.max(GRAPH_PANE_MIN_WIDTH, Math.min(GRAPH_PANE_MAX_WIDTH, sidebarWidth.value - COMMIT_LIST_MIN_WIDTH))
  if (graphPaneWidth.value > maxGraph) graphPaneWidth.value = maxGraph
}

const startSidebarResize = (e: MouseEvent) => {
  if (sidebarCollapsed.value) return
  sidebarResizing.value = true
  sidebarResizeStartX = e.clientX
  sidebarResizeStartWidth = sidebarWidth.value
  window.addEventListener('mousemove', onSidebarResizeMove)
  window.addEventListener('mouseup', stopSidebarResize)
}

const stopGraphPaneResize = () => {
  if (!graphPaneResizing.value) return
  graphPaneResizing.value = false
  window.removeEventListener('mousemove', onGraphPaneResizeMove)
  window.removeEventListener('mouseup', stopGraphPaneResize)
  persistSidebarState()
}

const onGraphPaneResizeMove = (e: MouseEvent) => {
  if (!graphPaneResizing.value) return
  const delta = e.clientX - graphPaneResizeStartX
  const maxGraph = Math.max(GRAPH_PANE_MIN_WIDTH, Math.min(GRAPH_PANE_MAX_WIDTH, sidebarWidth.value - COMMIT_LIST_MIN_WIDTH))
  graphPaneWidth.value = clamp(graphPaneResizeStartWidth + delta, GRAPH_PANE_MIN_WIDTH, maxGraph)
}

const startGraphPaneResize = (e: MouseEvent) => {
  if (sidebarCollapsed.value) return
  graphPaneResizing.value = true
  graphPaneResizeStartX = e.clientX
  graphPaneResizeStartWidth = graphPaneWidth.value
  window.addEventListener('mousemove', onGraphPaneResizeMove)
  window.addEventListener('mouseup', stopGraphPaneResize)
}

const toggleSidebar = () => {
  sidebarCollapsed.value = !sidebarCollapsed.value
  persistSidebarState()
}

// State
const input = ref('')
const streaming = ref(false)
let streamAbort: AbortController | null = null
const loadingTimeline = ref(false)
const loadingCommitId = ref<string | null>(null)
const committing = ref(false)
let timelineSeq = 0
const pendingCheckoutCommitId = ref<string | null>(null)
const latestLoadedBranchId = ref<string | null>(null)
const highlightedCommitId = ref<string | null>(null)
const forkMenuCommitId = ref<string | null>(null)
let highlightTimer: ReturnType<typeof setTimeout> | null = null
const activeBranch = ref('main')
const currentHead = ref('')
const serverHeadCommitId = ref<string | null>(null)
const branchList = ref<Array<{ id: string; name: string; baseCommitId?: string | null; headCommitId?: string | null }>>([])

// Commits (Oldest -> Newest)
const commits = ref<
  Array<{ hash: string; parentId: string | null; branch: string; branchId?: string; msg: string; time: string; col: number }>
>([])

const commitByHashMap = computed(() => {
  const map: Record<string, { hash: string; parentId: string | null; branch: string; branchId?: string; msg: string; time: string; col: number }> = {}
  commits.value.forEach((c) => {
    map[c.hash] = c
  })
  return map
})

const selectedLineageSet = computed(() => {
  const set = new Set<string>()
  const seen = new Set<string>()
  let cur = currentHead.value
  while (cur && !seen.has(cur)) {
    set.add(cur)
    seen.add(cur)
    cur = commitByHashMap.value[cur]?.parentId ?? ''
  }
  return set
})

const branchLineageFromHead = computed(() => {
  const head = serverHeadCommitId.value
  if (!head) return [] as string[]
  const rev: string[] = []
  const seen = new Set<string>()
  let cur = head
  while (cur && !seen.has(cur)) {
    rev.push(cur)
    seen.add(cur)
    cur = commitByHashMap.value[cur]?.parentId ?? ''
  }
  return rev.reverse()
})

const branchOrderMap = computed(() => {
  const map: Record<string, number> = {}
  branchLineageFromHead.value.forEach((hash, idx) => {
    map[hash] = idx
  })
  return map
})

const currentBranchHeadLineageSet = computed(() => new Set(branchLineageFromHead.value))

const selectedOrder = computed(() => {
  const head = serverHeadCommitId.value
  if (!head) return -1
  const current = currentHead.value
  const map = branchOrderMap.value
  if (typeof map[current] === 'number') return map[current]
  return typeof map[head] === 'number' ? map[head] : -1
})

const headOrder = computed(() => {
  const head = serverHeadCommitId.value
  if (!head) return -1
  const map = branchOrderMap.value
  return typeof map[head] === 'number' ? map[head] : -1
})

// Messages shown for current HEAD (time-travel will restore snapshots)
type ChatMsg =
  | { type: 'message'; role: 'user' | 'ai'; text: string; model?: string; messageId?: string; commitId?: string | null; sequence?: number }
  | { type: 'commit'; hash: string; text: string; isWorkingTree?: boolean }
const messages = ref<ChatMsg[]>([{ type: 'message', role: 'ai', text: 'Ready to work on [main].', model: 'System' }])

// ✅ Snapshot store (hash -> messages snapshot)
const snapshots = reactive<Record<string, ChatMsg[]>>({})
const deepCopy = <T>(obj: T): T => JSON.parse(JSON.stringify(obj))

// Toast
const toast = reactive<{ show: boolean; title: string; message: string; t: any }>({ show: false, title: '', message: '', t: null })
const toastNow = (title: string, message: string, ms = 1600) => {
  toast.title = title
  toast.message = message
  toast.show = true
  if (toast.t) clearTimeout(toast.t)
  toast.t = setTimeout(() => (toast.show = false), ms)
}

// Modals
const commitModal = reactive({ open: false, message: '' })
const branchModal = reactive({ open: false, name: '' })
const commitInputRef = ref<HTMLInputElement | null>(null)
const branchInputRef = ref<HTMLInputElement | null>(null)

// Platform-aware shortcut labels
const isMac = /Mac|iPhone|iPad|iPod/i.test(navigator.platform)
const shortcutSend = isMac ? '⌘+Enter' : 'Ctrl+Enter'
const shortcutCommit = isMac ? '⌘+S' : 'Ctrl+S'
const shortcutBranch = isMac ? '⌘+B' : 'Ctrl+B'
const shortcutHint = `${shortcutSend} send · ${shortcutCommit} commit · ${shortcutBranch} branch`

// --- Helper: Branch Colors ---
const getBranchColor = (branch: string) => {
  if (branch === 'main') return '#00B894'
  if (branch.startsWith('feat')) return '#0984E3'
  return '#e17055'
}

// --- Computed: Graph nodes/paths ---
const branchTrackMap = computed(() => {
  const byId: Record<string, number> = {}
  let next = 0

  const allBranches = [...branchList.value]
  allBranches.sort((a, b) => {
    if (a.name === 'main') return -1
    if (b.name === 'main') return 1
    return a.name.localeCompare(b.name)
  })

  for (const b of allBranches) {
    if (!b.id) continue
    if (typeof byId[b.id] !== 'undefined') continue
    byId[b.id] = next++
  }

  // API에서 브랜치 목록이 늦게 오거나 누락되더라도, 커밋 데이터 기준으로 트랙을 보강합니다.
  for (const c of commits.value) {
    const id = c.branchId ? String(c.branchId) : `name:${c.branch}`
    if (typeof byId[id] === 'undefined') byId[id] = next++
  }
  return byId
})

const commitTrackMap = computed(() => {
  const map: Record<string, number> = {}
  commits.value.forEach((c) => {
    const id = c.branchId ? String(c.branchId) : `name:${c.branch}`
    map[c.hash] = branchTrackMap.value[id] ?? 0
  })
  return map
})

const graphNodes = computed(() =>
  commits.value.map((c, idx) => {
    const track = commitTrackMap.value[c.hash] ?? 0
    return {
      hash: c.hash,
      x: START_X + track * TRACK_GAP,
      y: idx * ROW_HEIGHT + ROW_HEIGHT / 2,
      color: getBranchColor(c.branch),
      isActive: selectedLineageSet.value.has(c.hash),
      track,
      row: idx,
    }
  }),
)

const containerHeight = computed(() => commits.value.length * ROW_HEIGHT)
const maxTrackInGraph = computed(() => graphNodes.value.reduce((m, n) => Math.max(m, n.track), 0))
const requiredGraphPaneWidth = computed(() => START_X + (maxTrackInGraph.value + 1) * TRACK_GAP + 26)
const graphPaneRenderWidth = computed(() => {
  const maxGraph = Math.max(GRAPH_PANE_MIN_WIDTH, Math.min(GRAPH_PANE_MAX_WIDTH, sidebarWidth.value - COMMIT_LIST_MIN_WIDTH))
  const minGraph = Math.max(GRAPH_PANE_MIN_WIDTH, requiredGraphPaneWidth.value)
  return clamp(graphPaneWidth.value, minGraph, Math.max(minGraph, maxGraph))
})

const graphPaths = computed(() => {
  const paths: Array<{ d: string; color: string; isActive: boolean }> = []
  const nodesMap: Record<string, { x: number; y: number; color: string; track: number; row: number }> = {}
  graphNodes.value.forEach((n) => (nodesMap[n.hash] = n))

  const maxTrack = graphNodes.value.reduce((m, n) => Math.max(m, n.track), 0)
  const rowTrack: number[] = graphNodes.value.map((n) => n.track)

  const pickViaTrack = (fromTrack: number, toTrack: number, fromRow: number, toRow: number) => {
    if (Math.abs(fromTrack - toTrack) <= 1) return toTrack
    const minT = Math.min(fromTrack, toTrack)
    const maxT = Math.max(fromTrack, toTrack)
    const usedMid = new Set<number>()
    for (let r = fromRow + 1; r < toRow; r++) {
      const tr = rowTrack[r]
      if (typeof tr === 'number') usedMid.add(tr)
    }

    // 1) 우선 두 트랙 사이의 빈 트랙을 사용
    for (let t = minT + 1; t < maxT; t++) {
      if (!usedMid.has(t)) return t
    }
    // 2) 없으면 바깥쪽으로 우회
    for (let d = 1; d <= 4; d++) {
      const right = maxT + d
      if (right <= maxTrack + 4 && !usedMid.has(right)) return right
      const left = minT - d
      if (left >= 0 && !usedMid.has(left)) return left
    }
    return toTrack
  }

  commits.value.forEach((commit) => {
    if (!commit.parentId) return
    const currNode = nodesMap[commit.hash]
    const parentNode = nodesMap[commit.parentId]
    if (!currNode || !parentNode) return

    const startX = parentNode.x
    const startY = parentNode.y
    const endX = currNode.x
    const endY = currNode.y

    const viaTrack = pickViaTrack(parentNode.track, currNode.track, parentNode.row, currNode.row)
    const viaX = START_X + viaTrack * TRACK_GAP
    const cp1y = startY + ROW_HEIGHT * 0.55
    const cp2y = endY - ROW_HEIGHT * 0.45

    let d = `M ${startX} ${startY} `
    if (startX === endX) {
      d += `L ${endX} ${endY}`
    } else if (viaTrack === currNode.track) {
      d += `C ${startX} ${cp1y}, ${endX} ${cp2y}, ${endX} ${endY}`
    } else {
      const midY = (cp1y + cp2y) / 2
      d += `C ${startX} ${cp1y}, ${viaX} ${cp1y}, ${viaX} ${midY} `
      d += `L ${viaX} ${cp2y} `
      d += `C ${viaX} ${cp2y}, ${endX} ${cp2y}, ${endX} ${endY}`
    }

    const isActive = !!commit.parentId && selectedLineageSet.value.has(commit.hash) && selectedLineageSet.value.has(commit.parentId)
    paths.push({ d, color: getBranchColor(commit.branch), isActive })
  })

  return paths
})

// Detached HEAD detection (HEAD is not tip of current branch)
// commit 배열 순서에 의존하면 refresh/append 시 꼬일 수 있어, 서버가 주는 headCommitId 기준으로 판단합니다.
const isDetached = computed(() => {
  if (!serverHeadCommitId.value) return false
  return serverHeadCommitId.value !== currentHead.value
})

// --- Utils ---
const scrollToBottom = (id: string) => {
  nextTick(() => {
    const el = document.getElementById(id)
    if (el) el.scrollTop = el.scrollHeight
  })
}

const scrollToCommitInSidebar = (hash: string) => {
  nextTick(() => {
    const container = document.getElementById('graph-container')
    const row = container?.querySelector(`[data-hash="${hash}"]`) as HTMLElement | null
    if (container && row) {
      const top = row.offsetTop - container.clientHeight / 2 + row.clientHeight / 2
      container.scrollTo({ top: Math.max(top, 0), behavior: 'smooth' })
    }
  })
}

const nowLabel = () => {
  const d = new Date()
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${hh}:${mm}`
}

const normalizeBranchName = (name: string) => {
  return (name || '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-zA-Z0-9._\-/]/g, '')
    .replace(/\/+/, '/')
}

const isUuid = (v: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v)

const toUiRole = (role: string) => (role === 'USER' ? 'user' : 'ai')

const shortHash = (hash: string) => String(hash || '').slice(0, 8)

const commitLabel = (commitId: string) => {
  const commit = commits.value.find((c) => c.hash === commitId)
  const title = String(commit?.msg ?? 'COMMIT')
  return `${title} (${shortHash(commitId)})`
}

const getForkBranches = (commitHash: string) => {
  const ownerBranchId = commitByHashMap.value[commitHash]?.branchId
  return branchList.value
    .filter((b) => !!b.baseCommitId && b.baseCommitId === commitHash && b.id !== ownerBranchId)
    .map((b) => ({ id: b.id, name: b.name }))
}

const hasFork = (commitHash: string) => getForkBranches(commitHash).length > 0

const forkLabel = (commitHash: string) => {
  const n = getForkBranches(commitHash).length
  return n > 0 ? `+${n} branches` : ''
}

const forkTooltip = (commitHash: string) => getForkBranches(commitHash).map((b) => b.name).join(', ')

const toggleForkMenu = (commitHash: string) => {
  forkMenuCommitId.value = forkMenuCommitId.value === commitHash ? null : commitHash
}

const checkoutBranchById = async (branchId: string) => {
  forkMenuCommitId.value = null
  await router.push(`/w/${props.workspaceId}/b/${branchId}`)
}

const isFutureMessage = (msg: ChatMsg) => {
  // HEAD를 보고 있으면 미래 메시지는 없음
  if (!serverHeadCommitId.value || selectedOrder.value >= headOrder.value) return false

  if (msg.type === 'commit') {
    if (msg.isWorkingTree) return true
    const idx = branchOrderMap.value[msg.hash]
    return typeof idx === 'number' ? idx > selectedOrder.value : false
  }

  if (msg.commitId) {
    const idx = branchOrderMap.value[msg.commitId]
    return typeof idx === 'number' ? idx > selectedOrder.value : false
  }

  // 미커밋 메시지는 과거 커밋을 보고 있을 때 "미래"로 처리
  return true
}

const focusCommitInChat = (commitHash: string) => {
  nextTick(() => {
    const divider = document.querySelector(`[data-commit-divider="${commitHash}"]`) as HTMLElement | null
    const fallback = document.querySelector(`[data-msg-commit="${commitHash}"]`) as HTMLElement | null
    const target = divider ?? fallback
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'center' })
      highlightedCommitId.value = commitHash
      if (highlightTimer) clearTimeout(highlightTimer)
      highlightTimer = setTimeout(() => {
        highlightedCommitId.value = null
      }, 1400)
    }
  })
}

const buildTimelineRows = (committedRaw: any[], pendingRaw: any[]): ChatMsg[] => {
  const rows: ChatMsg[] = []
  let lastCommitId: string | null = null

  for (const m of committedRaw) {
    const commitId = m?.commitId ? String(m.commitId) : null
    if (commitId && commitId !== lastCommitId) {
      rows.push({
        type: 'commit',
        hash: commitId,
        text: commitLabel(commitId),
      })
      lastCommitId = commitId
    }
    rows.push({
      type: 'message',
      role: toUiRole(String(m?.role ?? 'ASSISTANT')),
      text: String(m?.content ?? ''),
      messageId: m?.id ? String(m.id) : undefined,
      commitId,
      sequence: typeof m?.sequence === 'number' ? m.sequence : undefined,
    })
  }

  const pending = (pendingRaw ?? []).filter((m: any) => !m?.commitId)
  if (pending.length > 0) {
    rows.push({
      type: 'commit',
      hash: 'WORKING_TREE',
      text: 'WORKING TREE (uncommitted)',
      isWorkingTree: true,
    })
    for (const m of pending) {
      rows.push({
        type: 'message',
        role: toUiRole(String(m?.role ?? 'ASSISTANT')),
        text: String(m?.content ?? ''),
        messageId: m?.id ? String(m.id) : undefined,
        commitId: null,
        sequence: typeof m?.sequence === 'number' ? m.sequence : undefined,
      })
    }
  }

  return rows
}

const saveCurrentHeadSnapshot = () => {
  if (!currentHead.value) return
  snapshots[currentHead.value] = deepCopy(messages.value) as ChatMsg[]
}

const appendCommitToGraph = (newHash: string, parentHash: string | null, message: string, branchName: string, branchId?: string) => {
  const headCommit = commits.value.find((c) => c.hash === parentHash) ?? commits.value[commits.value.length - 1]

  commits.value.push({
    hash: newHash,
    parentId: parentHash || null,
    branch: branchName,
    branchId: branchId || props.branchId,
    msg: message,
    time: nowLabel(),
    col: headCommit?.col ?? 0,
  })

  currentHead.value = newHash
}

const createCommitOnServer = async (
  keyPoint: string,
  options: { silent?: boolean; closeModal?: boolean } = {},
): Promise<string> => {
  const res = await CommitsService.create3(
    props.workspaceId,
    props.branchId,
    {
      workspaceId: props.workspaceId,
      branchId: props.branchId,
      keyPoint,
      shortSummary: null,
      longSummary: null,
    },
    auth.userId ?? undefined,
  )

  const created = res.data?.commit
  const newHash = created?.id
  if (!newHash) throw new Error('commit id missing')

  const parentHash = created?.parentId ?? currentHead.value
  const finalMsg = created?.keyPoint || keyPoint
  appendCommitToGraph(newHash, parentHash || null, finalMsg, activeBranch.value, props.branchId)
  // 커밋 직후에는 서버 HEAD도 이 커밋으로 이동한 것이므로 즉시 반영(HEAD 판별 흔들림 방지)
  serverHeadCommitId.value = newHash

  if (options.closeModal) commitModal.open = false
  if (!options.silent) {
    // 커밋 구분선 위치를 항상 서버 기준(해당 커밋의 시작 지점)으로 일치시킵니다.
    await loadMessagesLatest(props.branchId)
    focusCommitInChat(newHash)
    saveCurrentHeadSnapshot()
    toastNow('Committed', `[${newHash.slice(0, 8)}] ${finalMsg}`)
  }
  scrollToBottom('chat-box')
  scrollToCommitInSidebar(newHash)
  return newHash
}

const getPendingMessageCount = async (): Promise<number> => {
  const res = await MessagesService.timelineAfter(props.workspaceId, props.branchId, 0, 200)
  const list = (res.data ?? []) as Array<{ commitId?: string | null }>
  return list.filter((m) => !m.commitId).length
}

const refreshCurrentBranchCommits = async (branchId: string = props.branchId) => {
  try {
    // 현재 브랜치 커밋 목록을 다시 받아서, 새로 생긴 커밋(자동 커밋 포함)을 그래프에 반영
    const branchRes = await BranchesService.listByWorkspace(props.workspaceId)
    const currentBranch = (branchRes.data ?? []).find((b: any) => b.id === branchId)
    if (!currentBranch) return
    if (branchId === props.branchId) {
      serverHeadCommitId.value = (currentBranch.headCommitId as string | undefined) ?? null
    }

    const listRes = await CommitsService.list4(props.workspaceId, branchId, 300)
    const serverCommits = ((listRes?.data ?? []) as Array<any>).slice().reverse()
    if (serverCommits.length === 0) return

    const existing = new Set(commits.value.map((c) => c.hash))
    for (const c of serverCommits) {
      const id = c?.id ? String(c.id) : ''
      if (!id || existing.has(id)) continue
      commits.value.push({
        hash: id,
        parentId: c.parentId ? String(c.parentId) : null,
        branch: String(currentBranch.name ?? activeBranch.value ?? 'main'),
        branchId,
        msg: String(c.keyPoint ?? 'COMMIT'),
        time: c.createdAt ? new Date(c.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '',
        col: 0,
      })
      existing.add(id)
    }
  } catch {
    // ignore (best-effort refresh)
  }
}

// --- Actions ---
const send = async () => {
  if (!input.value.trim()) return

  // props가 라우트 전환 등으로 바뀌어도 "이 send"는 같은 브랜치에 저장되도록 고정
  const workspaceId = props.workspaceId
  const branchId = props.branchId
  const contextCommitId = isDetached.value && isUuid(currentHead.value) ? currentHead.value : null

  const content = input.value
  messages.value.push({ type: 'message', role: 'user', text: content, commitId: null })
  saveCurrentHeadSnapshot()
  input.value = ''
  scrollToBottom('chat-box')

  // Persist user message (best-effort)
  try {
    await MessagesService.send(workspaceId, branchId, {
      // backend DTO validates these as not-null (even though it's also in path)
      workspaceId,
      branchId,
      userId: auth.userId ?? null,
      role: 'USER',
      content,
      metadata: null,
    })
  } catch (e: any) {
    // 서버 저장 실패하면, 나중에 커밋 이동/새로고침 시 사라질 수 있으니 즉시 알려줍니다.
    toastNow('Message', e?.message ?? '메시지 저장 실패(서버). 새로고침/이동 시 사라질 수 있어요.', 2200)
  } finally {
    // auto-commit은 user message 저장 시점에 발생할 수 있으므로, 커밋 목록을 즉시 동기화
    await refreshCurrentBranchCommits(branchId)
  }

  // Start streaming AI answer (POST + event-stream)
  let aiIndex = messages.value.length
  messages.value.push({ type: 'message', role: 'ai', text: '', commitId: null })

  const url = `${OpenAPI.BASE || 'http://localhost:8080'}/api/chat/stream`
  try {
    // abort any previous stream
    streamAbort?.abort()
    streamAbort = new AbortController()
    streaming.value = true

    await streamChatSse({
      url,
      // NOTE: OpenAPI client는 configureApi()에서 localStorage 기반 토큰을 사용하지만,
      // SSE는 별도 fetch이므로 명시적으로 localStorage에서 읽어줍니다.
      token: localStorage.getItem('gait_access_token'),
      signal: streamAbort.signal,
      body: {
        workspaceId,
        branchId,
        contextCommitId,
        content,
      },
      handlers: {
        onChunk: (raw) => {
          // backend: ApiResponse.ok(SseEvent(type, data))
          const chunk = raw?.data?.data?.chunk
          if (typeof chunk === 'string') {
            const msg = messages.value[aiIndex] as any
            if (msg && msg.role === 'ai') msg.text += chunk
            scrollToBottom('chat-box')
          }
        },
        onDone: () => {
          streaming.value = false
          streamAbort = null
          saveCurrentHeadSnapshot()
          scrollToBottom('chat-box')

          // Persist assistant message (best-effort)
          ;(async () => {
            try {
              const msg = messages.value[aiIndex] as any
              const text = msg?.role === 'ai' ? String(msg.text ?? '') : ''
              if (!text) return
              await MessagesService.send(workspaceId, branchId, {
                workspaceId,
                branchId,
                role: 'ASSISTANT',
                content: text,
                metadata: null,
              })
            } catch (e: any) {
              toastNow('Message', e?.message ?? 'AI 메시지 저장 실패(서버). 새로고침/이동 시 사라질 수 있어요.', 2200)
            } finally {
              // assistant 저장 이후에도 auto-commit/commit 반영이 늦게 들어올 수 있어 한번 더 동기화
              await refreshCurrentBranchCommits(branchId)
            }
          })()
        },
      },
    })
  } catch (e: any) {
    streaming.value = false
    streamAbort = null
    const msg = e?.name === 'AbortError' ? '응답 스트리밍을 중단했어요.' : (e?.message ?? 'SSE 스트리밍 실패')
    toastNow('Stream', msg)
  }
}

const onInputKeydown = (e: KeyboardEvent & { isComposing?: boolean }) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    if (e.isComposing) return
    e.preventDefault()
    send()
    return
  }

  const meta = isMac ? (e as any).metaKey : (e as any).ctrlKey
  if (!meta) return

  if (e.key === 'Enter') {
    e.preventDefault()
    send()
  }

  if (e.key.toLowerCase() === 's') {
    e.preventDefault()
    openCommitModal()
  }

  if (e.key.toLowerCase() === 'b') {
    e.preventDefault()
    openBranchModal()
  }
}

const openCommitModal = () => {
  commitModal.message = `Work on ${activeBranch.value}`
  commitModal.open = true
  nextTick(() => commitInputRef.value?.focus())
}
const closeCommitModal = () => (commitModal.open = false)

const openBranchModal = () => {
  branchModal.name = `feat-${Math.floor(Math.random() * 100)}`
  branchModal.open = true
  nextTick(() => branchInputRef.value?.focus())
}
const closeBranchModal = () => (branchModal.open = false)

const confirmCommit = () => {
  if (committing.value) return
  const msg = (commitModal.message || '').trim()
  if (!msg) {
    toastNow('Commit', '커밋 메시지를 입력해줘')
    return
  }

  ;(async () => {
    try {
      committing.value = true
      await createCommitOnServer(msg, { closeModal: true })
    } catch (e: any) {
      toastNow('Commit', e?.message ?? '커밋 생성 실패')
    } finally {
      committing.value = false
    }
  })()
}

const confirmBranch = () => {
  const name = normalizeBranchName(branchModal.name)
  if (!name) {
    toastNow('Branch', '브랜치 이름을 입력해줘')
    return
  }

  const exists = commits.value.some((c) => c.branch === name)
  if (exists) {
    toastNow('Branch', '이미 존재하는 브랜치야')
    return
  }

  ;(async () => {
    try {
      // 사용자가 과거 커밋에서 "브랜치 생성"을 누른 시점의 기준 커밋을 고정합니다.
      // (아래 자동 커밋이 currentHead를 최신으로 바꿔버리면 baseCommitId가 틀어질 수 있음)
      const baseHash = currentHead.value

      if (isDetached.value) {
        const pendingCount = await getPendingMessageCount()
        if (pendingCount > 0) {
          toastNow('Branch', `미커밋 대화 ${pendingCount}건이 있어 자동 커밋 후 브랜치를 생성합니다.`, 2200)
          const autoMessage = `AUTO_SAVE before branching from ${String(baseHash).slice(0, 8)}`
          const baseSnap = snapshots[baseHash]
          await createCommitOnServer(autoMessage, { silent: true })
          // UI는 사용자가 보던 과거 커밋 기준으로 유지
          if (baseSnap) {
            messages.value = deepCopy(baseSnap)
            currentHead.value = baseHash
          }
          toastNow('Branch', '미커밋 대화를 먼저 저장했습니다. 분기 생성을 계속합니다.', 1800)
        }
      }

      const res = await BranchesService.create2(props.workspaceId, {
        workspaceId: props.workspaceId,
        name,
        description: `Created from ${baseHash}`,
        isDefault: false,
        baseCommitId: isUuid(baseHash) ? baseHash : null,
      })

      const created = res.data
      if (!created?.id) throw new Error('branch id missing')

      branchModal.open = false
      toastNow('Branch created', `${created.name} 브랜치로 이동합니다.`)
      await router.push(`/w/${props.workspaceId}/b/${created.id}`)
    } catch (e: any) {
      toastNow('Branch', e?.message ?? '브랜치 생성 실패')
    }
  })()
}

const loadMessagesLatest = async (branchId: string = props.branchId) => {
  const seq = ++timelineSeq
  loadingTimeline.value = true
  loadingCommitId.value = null
  // "브랜치 화면"의 최신 대화는
  // 1) 브랜치 HEAD 커밋까지의 공통 조상(분기 이전) 메시지 + 현재 브랜치의 커밋 메시지
  // 2) 현재 브랜치의 미커밋(pending) 메시지
  // 를 합쳐 보여야 합니다.
  try {
    const branchRes = await BranchesService.listByWorkspace(props.workspaceId)
    if (seq !== timelineSeq) return
    const currentBranch = (branchRes.data ?? []).find((b: any) => b.id === branchId)
    const headCommitId = currentBranch?.headCommitId as string | undefined
    if (branchId === props.branchId) {
      serverHeadCommitId.value = headCommitId ?? null
    }
    const localHeadSnap = headCommitId ? (snapshots[headCommitId] as ChatMsg[] | undefined) : undefined
    // ✅ 커밋+미커밋을 "한 번에" 렌더해서, 첫 클릭에 pending이 안 보였다가
    // 두 번째 클릭에 보이는(혹은 잠깐 commit-only로 보이는) 현상을 없앱니다.
    const [committedRes, pendingRes] = await Promise.all([
      headCommitId ? MessagesService.timelineAtCommit(props.workspaceId, branchId, headCommitId, 1000) : Promise.resolve({ data: [] as any[] } as any),
      MessagesService.timelineAfter(props.workspaceId, branchId, 0, 400),
    ])
    if (seq !== timelineSeq) return

    const committedList = (committedRes?.data ?? []) as any[]
    const pendingList = (pendingRes?.data ?? []) as any[]
    messages.value = buildTimelineRows(committedList, pendingList)
    latestLoadedBranchId.value = branchId

    // 서버에서 가져온 최신 대화가 로컬 스냅샷보다 짧으면(저장 실패/지연 가능),
    // 사용자가 보던 "최근 대화"가 갑자기 사라지지 않도록 로컬 스냅샷을 유지합니다.
    if (headCommitId && localHeadSnap && localHeadSnap.length > messages.value.length) {
      messages.value = deepCopy(localHeadSnap) as ChatMsg[]
      toastNow('Timeline', '서버에 아직 반영되지 않은 최근 대화가 있어 로컬 화면을 유지했어요.', 2200)
    }
    scrollToBottom('chat-box')
  } finally {
    if (seq === timelineSeq) {
      loadingTimeline.value = false
      loadingCommitId.value = null
    }
  }
}

const checkout = async (commit: { hash: string; branch: string; branchId?: string }) => {
  if (streaming.value) return
  forkMenuCommitId.value = null
  // 커밋 이동 전에 현재 화면(미커밋 포함)을 스냅샷으로 보존
  saveCurrentHeadSnapshot()
  const currentBranchName = branchList.value.find((b) => b.id === props.branchId)?.name ?? activeBranch.value

  // 다른 브랜치의 커밋을 눌렀더라도,
  // 현재 브랜치 HEAD의 조상(공통 히스토리)이면 브랜치를 유지하고 포커스만 이동합니다.
  // (예: B 브랜치에서 A2(분기점) 클릭 시 B 유지)
  const isCrossBranchCommit = !!commit.branchId && commit.branchId !== props.branchId
  const isAncestorOfCurrentBranchHead = currentBranchHeadLineageSet.value.has(commit.hash)

  if (isCrossBranchCommit && !isAncestorOfCurrentBranchHead) {
    pendingCheckoutCommitId.value = commit.hash
    await router.push(`/w/${props.workspaceId}/b/${commit.branchId}`)
    return
  }

  currentHead.value = commit.hash
  activeBranch.value = currentBranchName
  // 현재 브랜치에서는 항상 전체 선형 히스토리(HEAD + 미커밋)를 유지하고
  // 선택한 커밋 위치로만 포커스 이동합니다.
  if (latestLoadedBranchId.value !== props.branchId) {
    await loadMessagesLatest(props.branchId)
  }
  focusCommitInChat(commit.hash)
  scrollToCommitInSidebar(commit.hash)
}

const checkoutByHash = (hash: string) => {
  const c = commits.value.find((x) => x.hash === hash)
  if (c) void checkout(c as any)
}

let bootSeq = 0
const bootstrapFromServer = async () => {
  const seq = ++bootSeq
  try {
    const branchRes = await BranchesService.listByWorkspace(props.workspaceId)
    const branches = (branchRes.data ?? []) as Array<any>
    const currentBranch = branches.find((b: any) => b.id === props.branchId)
    if (!currentBranch) return
    if (seq !== bootSeq) return

    branchList.value = branches.map((b: any) => ({
      id: String(b.id ?? ''),
      name: String(b.name ?? ''),
      baseCommitId: b.baseCommitId ? String(b.baseCommitId) : null,
      headCommitId: b.headCommitId ? String(b.headCommitId) : null,
    }))

    activeBranch.value = String(currentBranch.name ?? 'main')
    serverHeadCommitId.value = (currentBranch.headCommitId as string | undefined) ?? null

    const branchNameById: Record<string, string> = {}
    branches.forEach((b: any) => {
      if (b?.id && b?.name) branchNameById[String(b.id)] = String(b.name)
    })

    // 모든 브랜치의 커밋을 합쳐 DAG 그래프를 구성 (분기선 표시 목적)
    const commitMap = new Map<string, any>()
    for (const b of branches) {
      if (!b?.id) continue
      const listRes = await CommitsService.list4(props.workspaceId, String(b.id), 300)
      const list = (listRes?.data ?? []) as Array<any>
      for (const c of list) {
        if (c?.id) commitMap.set(String(c.id), c)
      }
      if (seq !== bootSeq) return
    }

    const all = Array.from(commitMap.values())
      .sort((a, b) => String(a.createdAt ?? '').localeCompare(String(b.createdAt ?? '')))
      .map((c) => {
        const branchName = branchNameById[String(c.branchId)] ?? branchNameById[String(props.branchId)] ?? 'main'
        const branchCol = Math.max(0, branches.findIndex((b: any) => String(b.name) === branchName))
        return {
          hash: String(c.id),
          parentId: c.parentId ? String(c.parentId) : null,
          branch: branchName,
          branchId: String(c.branchId ?? ''),
          msg: String(c.keyPoint ?? 'COMMIT'),
          time: c.createdAt ? new Date(c.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '',
          col: branchCol,
        }
      })

    commits.value = all

    const head = (currentBranch.headCommitId as string | undefined) ?? commits.value[commits.value.length - 1]?.hash
    if (head) currentHead.value = head

    // Load timeline (best-effort)
    if (pendingCheckoutCommitId.value) {
      const target = pendingCheckoutCommitId.value
      pendingCheckoutCommitId.value = null
      currentHead.value = target
      await loadMessagesLatest(props.branchId)
      focusCommitInChat(target)
    } else {
      await loadMessagesLatest(props.branchId)
    }
    saveCurrentHeadSnapshot()

    scrollToBottom('graph-container')
    scrollToBottom('chat-box')
  } catch {
    // ignore for MVP
  }
}

watch(
  () => [props.workspaceId, props.branchId],
  () => {
    void bootstrapFromServer()
  },
  { immediate: true },
)

onMounted(() => {
  const saved = localStorage.getItem('gitai_theme')
  isDark.value = saved ? saved === 'dark' : true
  applyTheme(isDark.value)
  loadSidebarState()

  window.addEventListener('keydown', (e) => {
    if (!commitModal.open && !branchModal.open) return
    if (e.key === 'Escape') {
      commitModal.open = false
      branchModal.open = false
    }
  })
})

onBeforeUnmount(() => {
  streamAbort?.abort()
  streamAbort = null
  stopSidebarResize()
  stopGraphPaneResize()
  if (highlightTimer) {
    clearTimeout(highlightTimer)
    highlightTimer = null
  }
})
</script>

<template>
  <div class="flex h-full w-full">
    <!-- [LEFT] SIDEBAR -->
    <div v-if="!sidebarCollapsed" class="flex h-full flex-shrink-0" :style="{ width: `${sidebarWidth}px` }">
      <aside class="h-full w-full flex flex-col border-r border-[var(--border)] bg-[var(--sidebar)] z-20">
      <!-- 1. Repo Header -->
      <div class="h-14 border-b border-[var(--border)] flex items-center px-4 justify-between flex-shrink-0">
        <div class="flex items-center min-w-0 font-semibold">
          <i class="fa-solid fa-code-branch text-brand-primary mr-2"></i>
          <span class="truncate">gait-project</span>
        </div>
        <div class="flex items-center gap-2">
          <div class="text-[10px] bg-brand-primary/15 text-brand-secondary px-2 py-0.5 rounded font-mono">
            {{ commits.length }} Commits
          </div>
          <button
            class="w-6 h-6 rounded border border-[var(--chipBorder)] text-[11px] hover:bg-[var(--itemHover)]"
            title="사이드바 닫기"
            @click="toggleSidebar"
          >
            <i class="fa-solid fa-angle-left"></i>
          </button>
        </div>
      </div>

      <!-- 2. Git Graph -->
      <div class="flex-1 overflow-y-auto overflow-x-hidden relative flex" id="graph-container">
        <!-- SVG Layer (Lines + Nodes) -->
        <div class="flex-shrink-0 relative h-full border-r border-[var(--border)]/40" :style="{ width: `${graphPaneRenderWidth}px` }">
          <svg class="absolute top-0 left-0 w-full" :style="{ height: Math.max(containerHeight, 600) + 'px' }">
            <!-- Paths -->
            <path
              v-for="(path, idx) in graphPaths"
              :key="'p' + idx"
              :d="path.d"
              fill="none"
              :stroke="path.color"
              :stroke-width="path.isActive ? 3.2 : 1.8"
              :opacity="path.isActive ? 1 : 0.25"
              stroke-linecap="round"
              stroke-linejoin="round"
              class="graph-path"
            />

            <!-- Click halo -->
            <circle
              v-for="node in graphNodes"
              :key="'h' + node.hash"
              :cx="node.x"
              :cy="node.y"
              r="12"
              fill="transparent"
              class="cursor-pointer"
              @click="checkoutByHash(node.hash)"
            />

            <!-- Nodes -->
            <circle
              v-for="node in graphNodes"
              :key="'n' + node.hash"
              :cx="node.x"
              :cy="node.y"
              :r="currentHead === node.hash ? 5.8 : 4.5"
              class="node-pop"
              :fill="currentHead === node.hash ? '#FFFFFF' : 'var(--sidebar)'"
              :stroke="node.color"
              :stroke-width="currentHead === node.hash ? 3.6 : 2.5"
              :opacity="node.isActive || currentHead === node.hash ? 1 : 0.35"
              pointer-events="none"
            />
          </svg>
        </div>
        <div
          class="w-1 h-full flex-shrink-0 cursor-col-resize bg-transparent hover:bg-brand-primary/20 active:bg-brand-primary/30 transition-colors"
          @mousedown.prevent="startGraphPaneResize"
        ></div>

        <!-- List Layer -->
        <div class="flex-1 min-w-[160px] pt-4 pb-10">
          <div
            v-for="commit in commits"
            :key="commit.hash"
            :data-hash="commit.hash"
            class="h-[60px] flex flex-col justify-center px-3 cursor-pointer transition-colors group relative border-l-2"
            :class="[
              currentHead === commit.hash ? 'bg-black/5 dark:bg-white/5 border-brand-primary' : 'border-transparent hover:bg-[var(--itemHover)]',
              selectedLineageSet.has(commit.hash) ? '' : 'opacity-50',
            ]"
            @click="checkout(commit)"
          >
            <div class="flex items-center justify-between mb-0.5">
              <span
                class="font-medium text-xs truncate pr-2"
                :style="{ color: currentHead === commit.hash ? 'var(--text)' : 'var(--muted)' }"
              >
                {{ commit.msg }}
              </span>
            </div>

            <div class="flex items-center text-[10px] font-mono" :style="{ color: 'var(--muted)' }">
              <span class="mr-2 font-semibold" :style="{ color: getBranchColor(commit.branch) }">{{ commit.branch }}</span>
              <span class="mr-2 opacity-70">{{ commit.hash }}</span>
              <span class="ml-auto opacity-70">{{ commit.time }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 3. Sidebar Footer -->
      <div class="p-3 border-t border-[var(--border)] bg-[var(--sidebar)] flex-shrink-0">
        <div class="flex items-center p-2 rounded-lg bg-[var(--chip)] border border-[var(--chipBorder)]">
          <div
            class="w-8 h-8 rounded bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center text-xs font-bold text-white"
          >
            ME
          </div>
          <div class="ml-2.5 flex-1 min-w-0">
            <div class="text-xs font-bold">Standard Plan</div>
            <div class="text-[10px]" :style="{ color: 'var(--muted)' }">1.2M Tokens left</div>
          </div>
          <button
            @click="toggleTheme"
            class="ml-2 px-2.5 py-1.5 rounded-md text-xs border border-[var(--chipBorder)] hover:bg-[var(--itemHover)] transition"
          >
            <i class="fa-solid" :class="isDark ? 'fa-sun' : 'fa-moon'"></i>
          </button>
        </div>
      </div>
      </aside>
      <div
        class="w-1 h-full cursor-col-resize bg-transparent hover:bg-brand-primary/20 active:bg-brand-primary/30 transition-colors"
        @mousedown.prevent="startSidebarResize"
      ></div>
    </div>

    <!-- [RIGHT] CHAT AREA -->
    <main class="flex-1 flex flex-col min-w-0 bg-[var(--bg)] relative">
      <button
        v-if="sidebarCollapsed"
        class="absolute left-2 top-2 z-30 px-2.5 py-1.5 rounded-md text-xs border border-[var(--chipBorder)] bg-[var(--sidebar)] hover:bg-[var(--itemHover)]"
        @click="toggleSidebar"
      >
        <i class="fa-solid fa-code-branch mr-1.5"></i> Graph
      </button>
      <!-- Nav / HUD -->
      <div class="h-14 border-b border-[var(--border)] flex items-center justify-between px-6 flex-shrink-0 bg-[var(--bg)] z-10">
        <div class="flex items-center space-x-3 min-w-0">
          <span class="text-sm" :style="{ color: 'var(--muted)' }">HEAD:</span>
          <div class="flex items-center px-3 py-1 rounded-full text-xs font-mono border font-medium bg-[var(--chip)] border-[var(--chipBorder)]">
            <i class="fa-solid fa-code-commit mr-2 text-brand-primary"></i>
            <span class="truncate max-w-[180px]">{{ currentHead }}</span>
          </div>
          <span class="hidden sm:inline" :style="{ color: 'var(--muted)' }">on</span>
          <span class="text-xs font-bold" :style="{ color: getBranchColor(activeBranch) }">{{ activeBranch }}</span>

          <span
            v-if="isDetached"
            class="ml-2 text-[10px] font-mono px-2 py-0.5 rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-300"
          >
            DETACHED
          </span>

          <span
            v-if="loadingTimeline"
            class="ml-2 text-[10px] font-mono px-2 py-0.5 rounded-full border border-sky-500/30 bg-sky-500/10 text-sky-600 dark:text-sky-300"
          >
            LOADING…
          </span>
        </div>

        <div class="flex space-x-2">
          <button
            @click="openBranchModal"
            class="px-3 py-1.5 rounded text-xs font-medium border border-[var(--chipBorder)] hover:bg-[var(--itemHover)] transition-colors"
          >
            <i class="fa-solid fa-code-branch mr-1.5"></i> New Branch
          </button>
          <button
            @click="openCommitModal"
            class="px-3 py-1.5 rounded text-xs font-medium bg-brand-primary text-white hover:bg-purple-600 transition-colors shadow-lg shadow-purple-500/20"
          >
            <i class="fa-solid fa-floppy-disk mr-1.5"></i> Commit
          </button>
        </div>
      </div>

      <!-- Messages -->
      <div class="flex-1 overflow-y-auto p-6 space-y-6 scroll-smooth" id="chat-box">
        <template v-for="(msg, i) in messages" :key="i">
          <!-- Commit Log in Chat -->
          <div
            v-if="msg.type === 'commit'"
            :data-commit-divider="msg.hash"
            class="relative py-4 group fade-in transition-all duration-300"
            :class="[
              isFutureMessage(msg) ? 'opacity-45' : 'opacity-100',
              highlightedCommitId === msg.hash ? 'ring-2 ring-amber-300/70 rounded-xl' : '',
            ]"
          >
            <div class="absolute inset-0 flex items-center">
              <div
                class="w-full border-t border-dashed"
                :style="{ borderColor: isDark ? 'rgba(156,163,175,0.35)' : 'rgba(107,114,128,0.35)' }"
              ></div>
            </div>
            <div class="relative flex justify-center">
              <div
                class="px-4 py-1.5 rounded-full text-[11px] font-mono border bg-[var(--sidebar)] flex items-center shadow-lg gap-2"
                :style="{
                  borderColor: 'var(--chipBorder)',
                  color: 'var(--muted)',
                  boxShadow: '0 10px 25px ' + (isDark ? 'rgba(0,0,0,0.25)' : 'rgba(0,0,0,0.08)'),
                }"
              >
                <i class="fa-solid fa-circle-dot text-brand-primary"></i>
                <span v-if="!msg.isWorkingTree" class="opacity-70">[{{ shortHash(msg.hash) }}]</span>
                <span class="font-sans font-medium" :style="{ color: 'var(--text)' }">{{ msg.text }}</span>

                <button
                  v-if="!msg.isWorkingTree && hasFork(msg.hash)"
                  class="ml-1 px-2 py-0.5 rounded-full text-[10px] border border-cyan-500/40 bg-cyan-500/10 text-cyan-300 hover:bg-cyan-500/20"
                  :title="forkTooltip(msg.hash)"
                  @click.stop="toggleForkMenu(msg.hash)"
                >
                  🔀 {{ forkLabel(msg.hash) }}
                </button>
              </div>

              <div
                v-if="!msg.isWorkingTree && forkMenuCommitId === msg.hash"
                class="absolute top-8 z-20 min-w-[200px] rounded-lg border bg-[var(--sidebar)] p-2 shadow-xl"
                :style="{ borderColor: 'var(--chipBorder)' }"
              >
                <div class="px-2 pb-1 text-[10px] font-mono opacity-70">Checkout branch</div>
                <button
                  v-for="b in getForkBranches(msg.hash)"
                  :key="b.id"
                  class="w-full text-left px-2 py-1.5 rounded text-xs hover:bg-[var(--itemHover)]"
                  @click.stop="checkoutBranchById(b.id)"
                >
                  <i class="fa-solid fa-code-branch mr-1.5"></i>{{ b.name }}
                </button>
              </div>
            </div>
          </div>

          <!-- Normal message -->
          <div
            v-else
            class="flex w-full fade-in transition-opacity duration-300"
            :data-msg-commit="msg.commitId || undefined"
            :class="[msg.role === 'user' ? 'justify-end' : 'justify-start', isFutureMessage(msg) ? 'opacity-45' : 'opacity-100']"
          >
            <div
              v-if="msg.role === 'ai'"
              class="w-8 h-8 rounded-lg bg-brand-primary flex items-center justify-center mr-3 mt-1 shadow-md text-white shrink-0"
            >
              <i class="fa-solid fa-robot text-xs"></i>
            </div>
            <div
              class="max-w-[80%] p-4 rounded-2xl text-sm leading-relaxed shadow-sm relative"
              :class="[
                msg.role === 'user' ? 'bg-brand-primary text-white rounded-tr-none' : 'bg-[var(--sidebar)] border border-[var(--border)] rounded-tl-none',
                highlightedCommitId && msg.commitId === highlightedCommitId ? 'ring-2 ring-amber-300/70' : '',
              ]"
              :style="
                msg.role === 'ai'
                  ? { color: 'var(--text)', boxShadow: '0 10px 24px ' + (isDark ? 'rgba(0,0,0,0.30)' : 'rgba(0,0,0,0.08)') }
                  : {}
              "
            >
              <div class="whitespace-pre-wrap">{{ msg.text }}</div>
            </div>
          </div>
        </template>
      </div>

      <!-- Input -->
      <div class="p-4 bg-[var(--bg)] border-t border-[var(--border)] flex-shrink-0 z-20">
        <div class="max-w-4xl mx-auto relative">
          <div
            class="rounded-xl shadow-lg border border-[var(--border)] bg-[var(--sidebar)] overflow-hidden focus-within:ring-1 focus-within:ring-brand-primary"
          >
            <textarea
              v-model="input"
              @keydown="onInputKeydown"
              class="w-full bg-transparent text-sm p-4 h-16 resize-none outline-none font-mono placeholder:opacity-60"
              :placeholder="'Message… (Enter: send, Shift+Enter: newline)  |  ' + shortcutHint"
            ></textarea>
            <div class="flex items-center justify-between px-3 py-2 border-t border-[var(--border)] bg-black/5 dark:bg-black/20">
              <div class="flex space-x-3 text-xs" :style="{ color: 'var(--muted)' }">
                <i class="fa-solid fa-paperclip hover:opacity-100 opacity-70 cursor-pointer"></i>
                <span class="hidden sm:inline opacity-70">
                  {{ isDetached ? 'Checkout 상태에서는 커밋이 가능하지만, 별도 브랜치로 저장하는 걸 추천해요.' : 'Ready' }}
                </span>
              </div>
              <button
                @click="send"
                :disabled="streaming"
                class="text-brand-primary hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed text-xs font-bold px-3 py-1 transition-colors"
              >
                {{ streaming ? 'STREAMING…' : 'SEND' }} <i class="fa-solid fa-paper-plane ml-1"></i>
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Toast -->
      <div v-if="toast.show" class="absolute bottom-6 right-6 z-30">
        <div class="px-4 py-2 rounded-xl border bg-[var(--sidebar)] shadow-lg fade-in" :style="{ borderColor: 'var(--chipBorder)', color: 'var(--text)' }">
          <div class="text-xs font-mono" :style="{ color: 'var(--muted)' }">{{ toast.title }}</div>
          <div class="text-sm font-medium">{{ toast.message }}</div>
        </div>
      </div>

      <!-- Commit Modal -->
      <div v-if="commitModal.open" class="absolute inset-0 z-40 flex items-center justify-center">
        <div class="absolute inset-0 bg-black/40" @click="closeCommitModal"></div>
        <div class="relative w-[520px] max-w-[92vw] rounded-2xl border bg-[var(--sidebar)] shadow-2xl p-5" :style="{ borderColor: 'var(--border)' }">
          <div class="flex items-center justify-between mb-4">
            <div class="font-semibold">Commit changes</div>
            <button class="text-sm opacity-70 hover:opacity-100" @click="closeCommitModal"><i class="fa-solid fa-xmark"></i></button>
          </div>

          <label class="text-xs" :style="{ color: 'var(--muted)' }">Commit message</label>
          <input
            ref="commitInputRef"
            v-model="commitModal.message"
            @keydown.enter.prevent="confirmCommit"
            class="mt-2 w-full px-3 py-2 rounded-xl border bg-transparent outline-none focus:ring-1 focus:ring-brand-primary font-sans"
            :style="{ borderColor: 'var(--border)', color: 'var(--text)' }"
            placeholder="e.g. Fix null pointer in SearchDataHandler"
          />

          <div class="mt-4 flex justify-end gap-2">
            <button class="px-3 py-2 text-xs rounded-lg border hover:bg-[var(--itemHover)]" :style="{ borderColor: 'var(--border)' }" @click="closeCommitModal">
              Cancel
            </button>
            <button
              class="px-3 py-2 text-xs rounded-lg bg-brand-primary text-white hover:bg-purple-600 disabled:opacity-60 disabled:cursor-not-allowed"
              :disabled="committing"
              @click="confirmCommit"
            >
              <i class="fa-solid fa-floppy-disk mr-1.5"></i> {{ committing ? 'Committing…' : 'Commit' }}
            </button>
          </div>

          <div class="mt-3 text-[11px] font-mono" :style="{ color: 'var(--muted)' }">Shortcut: {{ shortcutCommit }}</div>
        </div>
      </div>

      <!-- Branch Modal -->
      <div v-if="branchModal.open" class="absolute inset-0 z-40 flex items-center justify-center">
        <div class="absolute inset-0 bg-black/40" @click="closeBranchModal"></div>
        <div class="relative w-[520px] max-w-[92vw] rounded-2xl border bg-[var(--sidebar)] shadow-2xl p-5" :style="{ borderColor: 'var(--border)' }">
          <div class="flex items-center justify-between mb-4">
            <div class="font-semibold">Create new branch</div>
            <button class="text-sm opacity-70 hover:opacity-100" @click="closeBranchModal"><i class="fa-solid fa-xmark"></i></button>
          </div>

          <label class="text-xs" :style="{ color: 'var(--muted)' }">Branch name</label>
          <input
            ref="branchInputRef"
            v-model="branchModal.name"
            @keydown.enter.prevent="confirmBranch"
            class="mt-2 w-full px-3 py-2 rounded-xl border bg-transparent outline-none focus:ring-1 focus:ring-brand-primary font-mono"
            :style="{ borderColor: 'var(--border)', color: 'var(--text)' }"
            placeholder="feat-new-approach"
          />

          <div class="mt-4 flex justify-end gap-2">
            <button class="px-3 py-2 text-xs rounded-lg border hover:bg-[var(--itemHover)]" :style="{ borderColor: 'var(--border)' }" @click="closeBranchModal">
              Cancel
            </button>
            <button class="px-3 py-2 text-xs rounded-lg bg-brand-primary text-white hover:bg-purple-600" @click="confirmBranch">
              <i class="fa-solid fa-code-branch mr-1.5"></i> Create
            </button>
          </div>

          <div class="mt-3 text-[11px] font-mono" :style="{ color: 'var(--muted)' }">Shortcut: {{ shortcutBranch }}</div>
        </div>
      </div>
    </main>
  </div>
</template>

