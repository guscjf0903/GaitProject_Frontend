import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { useUiPrefsStore } from '../../../stores/uiPrefs'
import { COMMIT_LIST_MIN_WIDTH, GRAPH_PANE_MAX_WIDTH, GRAPH_PANE_MIN_WIDTH, SIDEBAR_MAX_WIDTH, SIDEBAR_MIN_WIDTH } from '../constants'
import type { BranchModalState, ChatToastState, CommitModalState, MergeModalState } from '../types'

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))

export function applyThemeMode(theme: 'dark' | 'light') {
  const root = document.documentElement
  if (theme === 'dark') root.classList.add('dark')
  else root.classList.remove('dark')
}

export function useChatUiState() {
  const uiPrefs = useUiPrefsStore()

  const toast = reactive<ChatToastState>({
    show: false,
    title: '',
    message: '',
    timeoutId: null,
  })

  const commitModal = reactive<CommitModalState>({ open: false, message: '' })
  const branchModal = reactive<BranchModalState>({ open: false, name: '' })
  const mergeModal = reactive<MergeModalState>({
    open: false,
    fromBranchId: '',
    toBranchId: '',
    mergeType: 'SQUASH',
    notes: '',
  })

  const commitInputRef = ref<HTMLInputElement | null>(null)
  const branchInputRef = ref<HTMLInputElement | null>(null)

  const sidebarResizing = ref(false)
  const graphPaneResizing = ref(false)
  const sidebarWidth = computed({
    get: () => uiPrefs.sidebarWidth,
    set: (value: number) => uiPrefs.setSidebarWidth(value),
  })
  const sidebarCollapsed = computed({
    get: () => uiPrefs.sidebarCollapsed,
    set: (value: boolean) => uiPrefs.setSidebarCollapsed(value),
  })
  const graphPaneWidth = computed({
    get: () => uiPrefs.graphPaneWidth,
    set: (value: number) => uiPrefs.setGraphPaneWidth(value),
  })
  const isDark = computed(() => uiPrefs.isDark)

  let sidebarResizeStartX = 0
  let sidebarResizeStartWidth = uiPrefs.sidebarWidth
  let graphPaneResizeStartX = 0
  let graphPaneResizeStartWidth = uiPrefs.graphPaneWidth

  const isMac = /Mac|iPhone|iPad|iPod/i.test(navigator.platform)
  const shortcutSend = isMac ? 'Cmd+Enter' : 'Ctrl+Enter'
  const shortcutCommit = isMac ? 'Cmd+S' : 'Ctrl+S'
  const shortcutBranch = isMac ? 'Cmd+B' : 'Ctrl+B'
  const shortcutHint = `${shortcutSend} send | ${shortcutCommit} commit | ${shortcutBranch} branch`

  function toastNow(title: string, message: string, timeoutMs = 1600) {
    toast.title = title
    toast.message = message
    toast.show = true
    if (toast.timeoutId) clearTimeout(toast.timeoutId)
    toast.timeoutId = setTimeout(() => {
      toast.show = false
    }, timeoutMs)
  }

  function toggleTheme() {
    uiPrefs.toggleTheme()
    applyThemeMode(uiPrefs.theme)
    toastNow('Theme', uiPrefs.isDark ? 'Dark mode' : 'Light mode')
  }

  function toggleSidebar() {
    sidebarCollapsed.value = !sidebarCollapsed.value
  }

  function stopSidebarResize() {
    if (!sidebarResizing.value) return
    sidebarResizing.value = false
    window.removeEventListener('mousemove', onSidebarResizeMove)
    window.removeEventListener('mouseup', stopSidebarResize)
  }

  function onSidebarResizeMove(event: MouseEvent) {
    if (!sidebarResizing.value) return

    const delta = event.clientX - sidebarResizeStartX
    const nextWidth = clamp(sidebarResizeStartWidth + delta, SIDEBAR_MIN_WIDTH, SIDEBAR_MAX_WIDTH)
    sidebarWidth.value = nextWidth

    const maxGraph = Math.max(GRAPH_PANE_MIN_WIDTH, Math.min(GRAPH_PANE_MAX_WIDTH, nextWidth - COMMIT_LIST_MIN_WIDTH))
    if (graphPaneWidth.value > maxGraph) {
      graphPaneWidth.value = maxGraph
    }
  }

  function startSidebarResize(event: MouseEvent) {
    if (sidebarCollapsed.value) return

    sidebarResizing.value = true
    sidebarResizeStartX = event.clientX
    sidebarResizeStartWidth = sidebarWidth.value
    window.addEventListener('mousemove', onSidebarResizeMove)
    window.addEventListener('mouseup', stopSidebarResize)
  }

  function stopGraphPaneResize() {
    if (!graphPaneResizing.value) return
    graphPaneResizing.value = false
    window.removeEventListener('mousemove', onGraphPaneResizeMove)
    window.removeEventListener('mouseup', stopGraphPaneResize)
  }

  function onGraphPaneResizeMove(event: MouseEvent) {
    if (!graphPaneResizing.value) return

    const delta = event.clientX - graphPaneResizeStartX
    const maxGraph = Math.max(
      GRAPH_PANE_MIN_WIDTH,
      Math.min(GRAPH_PANE_MAX_WIDTH, sidebarWidth.value - COMMIT_LIST_MIN_WIDTH),
    )
    graphPaneWidth.value = clamp(graphPaneResizeStartWidth + delta, GRAPH_PANE_MIN_WIDTH, maxGraph)
  }

  function startGraphPaneResize(event: MouseEvent) {
    if (sidebarCollapsed.value) return

    graphPaneResizing.value = true
    graphPaneResizeStartX = event.clientX
    graphPaneResizeStartWidth = graphPaneWidth.value
    window.addEventListener('mousemove', onGraphPaneResizeMove)
    window.addEventListener('mouseup', stopGraphPaneResize)
  }

  function openCommitModal(activeBranch: string) {
    commitModal.message = `Work on ${activeBranch}`
    commitModal.open = true
    nextTick(() => commitInputRef.value?.focus())
  }

  function closeCommitModal() {
    commitModal.open = false
  }

  function openBranchModal() {
    branchModal.name = `feat-${Math.floor(Math.random() * 100)}`
    branchModal.open = true
    nextTick(() => branchInputRef.value?.focus())
  }

  function closeBranchModal() {
    branchModal.open = false
  }

  function openMergeModal(currentBranchId: string) {
    mergeModal.fromBranchId = currentBranchId
    mergeModal.toBranchId = ''
    mergeModal.mergeType = 'SQUASH'
    mergeModal.notes = ''
    mergeModal.open = true
  }

  function closeMergeModal() {
    mergeModal.open = false
  }

  function closeAllModals() {
    commitModal.open = false
    branchModal.open = false
    mergeModal.open = false
  }

  const onEscape = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      closeAllModals()
    }
  }

  onMounted(() => {
    applyThemeMode(uiPrefs.theme)
    window.addEventListener('keydown', onEscape)
  })

  onBeforeUnmount(() => {
    window.removeEventListener('keydown', onEscape)
    stopSidebarResize()
    stopGraphPaneResize()
    if (toast.timeoutId) clearTimeout(toast.timeoutId)
  })

  return {
    isDark,
    sidebarWidth,
    sidebarCollapsed,
    graphPaneWidth,
    toast,
    commitModal,
    branchModal,
    mergeModal,
    commitInputRef,
    branchInputRef,
    shortcutCommit,
    shortcutBranch,
    shortcutHint,
    toggleTheme,
    toggleSidebar,
    toastNow,
    startSidebarResize,
    startGraphPaneResize,
    openCommitModal,
    closeCommitModal,
    openBranchModal,
    closeBranchModal,
    openMergeModal,
    closeMergeModal,
  }
}
