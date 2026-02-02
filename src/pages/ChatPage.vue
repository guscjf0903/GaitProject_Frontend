<script setup lang="ts">
import { MessagesService } from '../api/generated'
import { useAuthStore } from '../stores/auth'
import { streamChatSse } from '../api/sseChatStream'
import { computed, nextTick, onMounted, reactive, ref } from 'vue'

const props = defineProps<{ workspaceId: string; branchId: string }>()
const auth = useAuthStore()

// Layout constants (same as design)
const ROW_HEIGHT = 60
const COL_WIDTH = 20
const START_X = 20

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

// State
const input = ref('')
const activeBranch = ref('main')
const currentHead = ref('h6i7j')

// Commits (Oldest -> Newest)
const commits = ref([
  { hash: 'h6i7j', parentId: null as string | null, branch: 'main', msg: 'Initial Commit', time: 'Yesterday', col: 0 },
  { hash: 'e4f5g', parentId: 'h6i7j', branch: 'main', msg: 'Init Project', time: '1h ago', col: 0 },
])

// Messages shown for current HEAD (time-travel will restore snapshots)
type ChatMsg =
  | { type?: undefined; role: 'user' | 'ai'; text: string; model?: string }
  | { type: 'commit'; hash: string; text: string }
const messages = ref<ChatMsg[]>([{ role: 'ai', text: 'Ready to work on [main].', model: 'System' }])

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
const graphNodes = computed(() =>
  commits.value.map((c, idx) => ({
    hash: c.hash,
    x: START_X + c.col * COL_WIDTH,
    y: idx * ROW_HEIGHT + ROW_HEIGHT / 2,
    color: getBranchColor(c.branch),
  })),
)

const containerHeight = computed(() => commits.value.length * ROW_HEIGHT)

const graphPaths = computed(() => {
  const paths: Array<{ d: string; color: string }> = []
  const nodesMap: Record<string, { x: number; y: number; color: string }> = {}
  graphNodes.value.forEach((n) => (nodesMap[n.hash] = n))

  commits.value.forEach((commit) => {
    if (!commit.parentId) return
    const currNode = nodesMap[commit.hash]
    const parentNode = nodesMap[commit.parentId]
    if (!currNode || !parentNode) return

    const startX = parentNode.x
    const startY = parentNode.y
    const endX = currNode.x
    const endY = currNode.y

    const cp1y = startY + ROW_HEIGHT / 2
    const cp2y = endY - ROW_HEIGHT / 2

    let d = `M ${startX} ${startY} `
    if (startX === endX) d += `L ${endX} ${endY}`
    else d += `C ${startX} ${cp1y}, ${endX} ${cp2y}, ${endX} ${endY}`

    paths.push({ d, color: getBranchColor(commit.branch) })
  })

  return paths
})

// Detached HEAD detection (HEAD is not tip of current branch)
const branchTips = computed(() => {
  const tips: Record<string, string> = {}
  commits.value.forEach((c) => (tips[c.branch] = c.hash))
  return tips
})

const isDetached = computed(() => branchTips.value[activeBranch.value] !== currentHead.value)

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

const genHash = () => {
  const arr = crypto.getRandomValues(new Uint32Array(1))
  const n = arr[0] ?? 0
  return n.toString(16).slice(0, 5)
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

// --- Actions ---
const send = async () => {
  if (!input.value.trim()) return
  const content = input.value
  messages.value.push({ role: 'user', text: content })
  input.value = ''
  scrollToBottom('chat-box')

  // Persist user message (best-effort)
  try {
    await MessagesService.send(props.workspaceId, props.branchId, {
      workspaceId: null,
      branchId: null,
      userId: auth.userId ?? null,
      role: 'USER',
      content,
      metadata: null,
    })
  } catch {
    // ignore for MVP
  }

  // Start streaming AI answer (POST + event-stream)
  let aiIndex = messages.value.length
  messages.value.push({ role: 'ai', text: '' })

  const url = `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080'}/api/chat/stream`
  await streamChatSse({
    url,
    token: auth.accessToken,
    body: { workspaceId: props.workspaceId, branchId: props.branchId, content },
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
        scrollToBottom('chat-box')
      },
    },
  })
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
  const msg = (commitModal.message || '').trim()
  if (!msg) {
    toastNow('Commit', '커밋 메시지를 입력해줘')
    return
  }

  const headCommit = commits.value.find((c) => c.hash === currentHead.value)
  if (!headCommit) return

  const newHash = genHash()

  commits.value.push({
    hash: newHash,
    parentId: currentHead.value,
    branch: activeBranch.value,
    msg,
    time: nowLabel(),
    col: headCommit.col,
  })

  messages.value.push({ type: 'commit', hash: newHash, text: msg })
  snapshots[newHash] = deepCopy(messages.value)

  currentHead.value = newHash
  commitModal.open = false

  toastNow('Committed', `[${newHash}] ${msg}`)
  scrollToBottom('chat-box')
  scrollToCommitInSidebar(newHash)
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

  const headCommit = commits.value.find((c) => c.hash === currentHead.value)
  if (!headCommit) return

  const newHash = genHash()
  const maxCol = Math.max(...commits.value.map((c) => c.col))
  const newCol = maxCol + 1

  commits.value.push({
    hash: newHash,
    parentId: currentHead.value,
    branch: name,
    msg: `Start ${name}`,
    time: nowLabel(),
    col: newCol,
  })

  messages.value.push({ type: 'commit', hash: newHash, text: `Created branch ${name}` })
  snapshots[newHash] = deepCopy(messages.value)

  activeBranch.value = name
  currentHead.value = newHash
  branchModal.open = false

  toastNow('Branch created', `${name} at ${newHash}`)
  scrollToBottom('chat-box')
  scrollToCommitInSidebar(newHash)
}

const checkout = (commit: { hash: string; branch: string }) => {
  currentHead.value = commit.hash
  activeBranch.value = commit.branch

  const snap = snapshots[commit.hash]
  if (snap) {
    messages.value = deepCopy(snap)
    toastNow('Checkout', `[${commit.hash}] restored snapshot`)
  } else {
    messages.value.push({ role: 'ai', text: `Checked out to [${commit.hash}] on ${commit.branch}` })
    toastNow('Checkout', `[${commit.hash}] no snapshot yet`)
  }

  scrollToCommitInSidebar(commit.hash)
  scrollToBottom('chat-box')
}

const checkoutByHash = (hash: string) => {
  const c = commits.value.find((x) => x.hash === hash)
  if (c) checkout(c)
}

const seedSnapshots = () => {
  snapshots['h6i7j'] = deepCopy([{ role: 'ai', text: 'Ready to work on [main].', model: 'System' }])
  snapshots['e4f5g'] = deepCopy([
    { role: 'ai', text: 'Ready to work on [main].', model: 'System' },
    { type: 'commit', hash: 'e4f5g', text: 'Init Project' },
  ])
}

onMounted(() => {
  const saved = localStorage.getItem('gitai_theme')
  isDark.value = saved ? saved === 'dark' : true
  applyTheme(isDark.value)

  seedSnapshots()

  scrollToBottom('graph-container')
  scrollToBottom('chat-box')

  // Load timeline (best-effort)
  ;(async () => {
    try {
      const res = await MessagesService.timelineAfter(props.branchId, 0, 50)
      const list = (res.data ?? []) as any[]
      if (list.length > 0) {
        // prepend history (very simple)
        messages.value = [
          ...list.map((m) => ({
            role: m.role === 'USER' ? 'user' : 'ai',
            text: m.content,
          })),
          ...messages.value,
        ] as any
        scrollToBottom('chat-box')
      }
    } catch {
      // ignore for MVP
    }
  })()

  window.addEventListener('keydown', (e) => {
    if (!commitModal.open && !branchModal.open) return
    if (e.key === 'Escape') {
      commitModal.open = false
      branchModal.open = false
    }
  })
})
</script>

<template>
  <div class="flex h-full w-full">
    <!-- [LEFT] SIDEBAR -->
    <aside class="w-[340px] flex flex-col border-r border-[var(--border)] bg-[var(--sidebar)] flex-shrink-0 z-20">
      <!-- 1. Repo Header -->
      <div class="h-14 border-b border-[var(--border)] flex items-center px-4 justify-between flex-shrink-0">
        <div class="flex items-center min-w-0 font-semibold">
          <i class="fa-solid fa-code-branch text-brand-primary mr-2"></i>
          <span class="truncate">gait-project</span>
        </div>
        <div class="text-[10px] bg-brand-primary/15 text-brand-secondary px-2 py-0.5 rounded font-mono">
          {{ commits.length }} Commits
        </div>
      </div>

      <!-- 2. Git Graph -->
      <div class="flex-1 overflow-y-auto overflow-x-hidden relative flex" id="graph-container">
        <!-- SVG Layer (Lines + Nodes) -->
        <div class="w-[80px] flex-shrink-0 relative h-full border-r border-[var(--border)]/40">
          <svg class="absolute top-0 left-0 w-full" :style="{ height: Math.max(containerHeight, 600) + 'px' }">
            <!-- Paths -->
            <path
              v-for="(path, idx) in graphPaths"
              :key="'p' + idx"
              :d="path.d"
              fill="none"
              :stroke="path.color"
              stroke-width="2"
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
              r="4.5"
              class="node-pop cursor-pointer"
              :fill="currentHead === node.hash ? '#FFFFFF' : 'var(--sidebar)'"
              :stroke="node.color"
              stroke-width="2.5"
              @click="checkoutByHash(node.hash)"
            />
          </svg>
        </div>

        <!-- List Layer -->
        <div class="flex-1 pt-4 pb-10">
          <div
            v-for="commit in commits"
            :key="commit.hash"
            :data-hash="commit.hash"
            class="h-[60px] flex flex-col justify-center px-3 cursor-pointer transition-colors group relative border-l-2"
            :class="[currentHead === commit.hash ? 'bg-black/5 dark:bg-white/5 border-brand-primary' : 'border-transparent hover:bg-[var(--itemHover)]']"
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

    <!-- [RIGHT] CHAT AREA -->
    <main class="flex-1 flex flex-col min-w-0 bg-[var(--bg)] relative">
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
          <div v-if="(msg as any).type === 'commit'" class="relative py-4 group fade-in">
            <div class="absolute inset-0 flex items-center">
              <div
                class="w-full border-t border-dashed"
                :style="{ borderColor: isDark ? 'rgba(156,163,175,0.35)' : 'rgba(107,114,128,0.35)' }"
              ></div>
            </div>
            <div class="relative flex justify-center">
              <div
                class="px-4 py-1.5 rounded-full text-[11px] font-mono border bg-[var(--sidebar)] flex items-center shadow-lg"
                :style="{
                  borderColor: 'var(--chipBorder)',
                  color: 'var(--muted)',
                  boxShadow: '0 10px 25px ' + (isDark ? 'rgba(0,0,0,0.25)' : 'rgba(0,0,0,0.08)'),
                }"
              >
                <i class="fa-solid fa-circle-dot mr-2 text-brand-primary"></i>
                <span class="opacity-70 mr-2">[{{ (msg as any).hash }}]</span>
                <span class="font-sans font-medium" :style="{ color: 'var(--text)' }">{{ (msg as any).text }}</span>
              </div>
            </div>
          </div>

          <!-- Normal message -->
          <div v-else class="flex w-full fade-in" :class="(msg as any).role === 'user' ? 'justify-end' : 'justify-start'">
            <div
              v-if="(msg as any).role === 'ai'"
              class="w-8 h-8 rounded-lg bg-brand-primary flex items-center justify-center mr-3 mt-1 shadow-md text-white shrink-0"
            >
              <i class="fa-solid fa-robot text-xs"></i>
            </div>
            <div
              class="max-w-[80%] p-4 rounded-2xl text-sm leading-relaxed shadow-sm relative"
              :class="(msg as any).role === 'user' ? 'bg-brand-primary text-white rounded-tr-none' : 'bg-[var(--sidebar)] border border-[var(--border)] rounded-tl-none'"
              :style="
                (msg as any).role === 'ai'
                  ? { color: 'var(--text)', boxShadow: '0 10px 24px ' + (isDark ? 'rgba(0,0,0,0.30)' : 'rgba(0,0,0,0.08)') }
                  : {}
              "
            >
              <div class="whitespace-pre-wrap">{{ (msg as any).text }}</div>
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
              <button @click="send" class="text-brand-primary hover:opacity-90 text-xs font-bold px-3 py-1 transition-colors">
                SEND <i class="fa-solid fa-paper-plane ml-1"></i>
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
            <button class="px-3 py-2 text-xs rounded-lg bg-brand-primary text-white hover:bg-purple-600" @click="confirmCommit">
              <i class="fa-solid fa-floppy-disk mr-1.5"></i> Commit
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

