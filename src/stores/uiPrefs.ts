import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

const THEME_KEY = 'gitai_theme'
const SIDEBAR_WIDTH_KEY = 'gitai_sidebar_width'
const SIDEBAR_COLLAPSED_KEY = 'gitai_sidebar_collapsed'
const GRAPH_PANE_WIDTH_KEY = 'gitai_graph_pane_width'

const parseStoredNumber = (key: string, fallback: number) => {
  const raw = Number(localStorage.getItem(key))
  return Number.isFinite(raw) && raw > 0 ? raw : fallback
}

export const useUiPrefsStore = defineStore('uiPrefs', () => {
  const theme = ref<'dark' | 'light'>(localStorage.getItem(THEME_KEY) === 'light' ? 'light' : 'dark')
  const sidebarWidth = ref(parseStoredNumber(SIDEBAR_WIDTH_KEY, 340))
  const sidebarCollapsed = ref(localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1')
  const graphPaneWidth = ref(parseStoredNumber(GRAPH_PANE_WIDTH_KEY, 110))

  const isDark = computed(() => theme.value === 'dark')

  function setTheme(next: 'dark' | 'light') {
    theme.value = next
    localStorage.setItem(THEME_KEY, next)
  }

  function toggleTheme() {
    setTheme(theme.value === 'dark' ? 'light' : 'dark')
  }

  function setSidebarWidth(next: number) {
    sidebarWidth.value = next
    localStorage.setItem(SIDEBAR_WIDTH_KEY, String(next))
  }

  function setSidebarCollapsed(next: boolean) {
    sidebarCollapsed.value = next
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, next ? '1' : '0')
  }

  function setGraphPaneWidth(next: number) {
    graphPaneWidth.value = next
    localStorage.setItem(GRAPH_PANE_WIDTH_KEY, String(next))
  }

  return {
    theme,
    sidebarWidth,
    sidebarCollapsed,
    graphPaneWidth,
    isDark,
    setTheme,
    toggleTheme,
    setSidebarWidth,
    setSidebarCollapsed,
    setGraphPaneWidth,
  }
})
