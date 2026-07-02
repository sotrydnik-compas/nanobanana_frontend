import { endpoints } from '../config/api'
import { normalizeClientError } from '../utils/errors'

function formBody(data) {
  const p = new URLSearchParams()
  for (const [k, v] of Object.entries(data || {})) {
    if (v === undefined || v === null) continue
    p.set(k, String(v))
  }
  return p
}

async function postForm(url, data, extraHeaders = {}) {
  let res
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
        ...extraHeaders,
      },
      body: formBody(data),
    })
  } catch (error) {
    throw normalizeClientError(error)
  }

  const txt = await res.text().catch(() => '')
  let json = null
  try { json = txt ? JSON.parse(txt) : null } catch {}

  if (!res.ok) {
    const detail = (json && (json.detail || json.message)) || txt || `HTTP ${res.status}`
    const err = new Error(detail)
    err.status = res.status
    err.payload = json
    throw err
  }

  return json ?? {}
}

async function getJson(url, accessToken) {
  let res
  try {
    res = await fetch(url, {
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
    })
  } catch (error) {
    throw normalizeClientError(error)
  }
  const txt = await res.text().catch(() => '')
  let json = null
  try { json = txt ? JSON.parse(txt) : null } catch {}

  if (!res.ok) {
    const detail = (json && (json.detail || json.message)) || txt || `HTTP ${res.status}`
    const err = new Error(detail)
    err.status = res.status
    err.payload = json
    throw err
  }
  return json ?? {}
}

export const authApi = {
  register: (email, password) =>
    postForm(`${endpoints.auth.base}${endpoints.auth.register}`, { email, password }),

  resendVerify: (email) =>
    postForm(`${endpoints.auth.base}${endpoints.auth.resendVerify}`, { email }),

  verifyEmail: (email, code) =>
    postForm(`${endpoints.auth.base}${endpoints.auth.verifyEmail}`, { email, code }),

  login: (email, password) =>
    postForm(`${endpoints.auth.base}${endpoints.auth.login}`, { email, password }),

  refresh: (refresh_token) =>
    postForm(`${endpoints.auth.base}${endpoints.auth.refresh}`, { refresh_token }),

  logout: (refresh_token, accessToken) =>
    postForm(
      `${endpoints.auth.base}${endpoints.auth.logout}`,
      { refresh_token },
      accessToken ? { Authorization: `Bearer ${accessToken}` } : {}
    ),

  resetRequest: (email) =>
    postForm(`${endpoints.auth.base}${endpoints.auth.resetRequest}`, { email }),

  resetConfirm: (email, code, new_password) =>
    postForm(`${endpoints.auth.base}${endpoints.auth.resetConfirm}`, { email, code, new_password }),

  me: (accessToken) =>
    getJson(`${endpoints.auth.base}${endpoints.auth.me}`, accessToken),
}
