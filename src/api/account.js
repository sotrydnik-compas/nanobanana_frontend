import { endpoints } from '../config/api'
import { apiJson } from './http'

function formBody(data) {
  const p = new URLSearchParams()
  for (const [k, v] of Object.entries(data || {})) {
    if (v === undefined || v === null) continue
    p.set(k, String(v))
  }
  return p
}

function postFormAuthed(url, data) {
  return apiJson(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
    },
    body: formBody(data),
  })
}

export const accountApi = {
  me: () => apiJson(`${endpoints.auth.base}${endpoints.auth.me}`),

  changePassword: (old_password, new_password) =>
    postFormAuthed(`${endpoints.auth.base}${endpoints.auth.changePassword}`, { old_password, new_password }),

  changeEmail: (new_email, password) =>
    postFormAuthed(`${endpoints.auth.base}${endpoints.auth.changeEmail}`, { new_email, password }),

  confirmEmailChange: (code) =>
    postFormAuthed(`${endpoints.auth.base}${endpoints.auth.confirmEmailChange}`, { code }),

  logoutAll: () =>
    postFormAuthed(`${endpoints.auth.base}${endpoints.auth.logoutAll}`, {}),
}
