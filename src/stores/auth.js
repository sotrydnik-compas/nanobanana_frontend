import { reactive } from 'vue'
import { authApi } from '../api/auth'

const LS_ACCESS = 'nb_access_token'
const LS_REFRESH = 'nb_refresh_token'
const LS_USER = 'nb_user'

function readLS(k) {
  try { return localStorage.getItem(k) } catch { return null }
}
function writeLS(k, v) {
  try { localStorage.setItem(k, v) } catch {}
}
function delLS(k) {
  try { localStorage.removeItem(k) } catch {}
}

const state = reactive({
  inited: false,
  accessToken: null,
  refreshToken: null,
  user: null, // {id,email,role}
})

function setTokens(access, refresh) {
  state.accessToken = access || null
  state.refreshToken = refresh || null
  if (access) writeLS(LS_ACCESS, access); else delLS(LS_ACCESS)
  if (refresh) writeLS(LS_REFRESH, refresh); else delLS(LS_REFRESH)
}

function setUser(u) {
  state.user = u || null
  if (u) writeLS(LS_USER, JSON.stringify(u)); else delLS(LS_USER)
}

async function fetchMeSafe() {
  if (!state.accessToken) return
  try {
    const me = await authApi.me(state.accessToken)
    setUser(me)
  } catch {
    // не валим UI; реальная валидность отработает при запросах через http.js
  }
}

async function refreshAccess() {
  if (!state.refreshToken) return false
  try {
    const r = await authApi.refresh(state.refreshToken)
    setTokens(r.access_token, r.refresh_token)
    await fetchMeSafe()
    return true
  } catch {
    clear()
    return false
  }
}

function init() {
  if (state.inited) return
  state.inited = true

  state.accessToken = readLS(LS_ACCESS)
  state.refreshToken = readLS(LS_REFRESH)
  const u = readLS(LS_USER)
  if (u) {
    try { state.user = JSON.parse(u) } catch {}
  }

  // подхватить /me фоном
  fetchMeSafe()
}

async function login(email, password) {
  const r = await authApi.login(email, password)
  setTokens(r.access_token, r.refresh_token)
  await fetchMeSafe()
  return r
}

async function logout() {
  try {
    if (state.refreshToken) {
      await authApi.logout(state.refreshToken, state.accessToken)
    }
  } catch {
    // не критично
  }
  clear()
}

function clear() {
  setTokens(null, null)
  setUser(null)
}

export const auth = {
  state,
  init,
  login,
  logout,
  refreshAccess,
  setTokens,
  setUser,
  clear,
}
