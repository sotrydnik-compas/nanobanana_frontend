import { auth } from '../stores/auth'

async function readError(res) {
  const txt = await res.text().catch(() => '')
  let json = null
  try { json = txt ? JSON.parse(txt) : null } catch {}
  return {
    text: txt,
    json,
    detail: (json && (json.detail || json.message)) || txt || `HTTP ${res.status}`,
  }
}

export async function apiFetch(url, opts = {}, { retry401 = true } = {}) {
  auth.init()

  const headers = new Headers(opts.headers || {})
  if (auth.state.accessToken) headers.set('Authorization', `Bearer ${auth.state.accessToken}`)

  const res = await fetch(url, { ...opts, headers })
  if (res.status !== 401) return res

  if (!retry401) return res

  const ok = await auth.refreshAccess()
  if (!ok) return res

  const headers2 = new Headers(opts.headers || {})
  if (auth.state.accessToken) headers2.set('Authorization', `Bearer ${auth.state.accessToken}`)

  return fetch(url, { ...opts, headers: headers2 })
}

export async function apiJson(url, opts = {}, meta = {}) {
  const res = await apiFetch(url, opts, meta)
  if (!res.ok) {
    const e = await readError(res)
    const err = new Error(e.detail)
    err.status = res.status
    err.payload = e.json
    throw err
  }
  return res.json()
}
