import { reactive } from 'vue'

const LS_THEME = 'nb_theme' // 'light' | 'dark'

const state = reactive({
  inited: false,
  theme: 'light',
})

function applyTheme(t) {
  state.theme = t
  try {
    document.documentElement.setAttribute('data-theme', t)
  } catch {}
  try {
    localStorage.setItem(LS_THEME, t)
  } catch {}
}

function init() {
  if (state.inited) return
  state.inited = true

  let t = null
  try { t = localStorage.getItem(LS_THEME) } catch {}

  if (t !== 'light' && t !== 'dark') {
    // по умолчанию — системная
    const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)')?.matches
    t = prefersDark ? 'dark' : 'light'
  }

  applyTheme(t)
}

function toggle() {
  init()
  applyTheme(state.theme === 'dark' ? 'light' : 'dark')
}

export const theme = {
  state,
  init,
  toggle,
  applyTheme,
}