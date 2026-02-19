function trimSlash(s) {
  return (s || '').replace(/\/$/, '')
}

const API_BASE = trimSlash(import.meta.env.VITE_API_BASE)
const AUTH_BASE = trimSlash(import.meta.env.VITE_AUTH_BASE) || API_BASE
const AI_BASE = trimSlash(import.meta.env.VITE_AI_BASE) || API_BASE
const BILLING_BASE = trimSlash(import.meta.env.VITE_BILLING_BASE) || API_BASE

export const endpoints = {
  auth: {
    base: AUTH_BASE,
    register: '/api/v1/auth/register',
    login: '/api/v1/auth/login',
    refresh: '/api/v1/auth/refresh',
    logout: '/api/v1/auth/logout',

    resendVerify: '/api/v1/auth/email/resend',
    verifyEmail: '/api/v1/auth/email/verify',

    resetRequest: '/api/v1/auth/password/reset/request',
    resetConfirm: '/api/v1/auth/password/reset/confirm',

    me: '/api/v1/auth/me',
    changePassword: '/api/v1/auth/password/change',
    changeEmail: '/api/v1/auth/email/change',
    confirmEmailChange: '/api/v1/auth/email/confirm',
    logoutAll: '/api/v1/auth/sessions/logout-all',
  },

  ai: {
    base: AI_BASE,
    generate: '/api/v1/ai/generate-pro',
    task: (id) => `/api/v1/ai/tasks/${encodeURIComponent(id)}`,

    chats: '/api/v1/ai/chats',
    chat: (id) => `/api/v1/ai/chats/${encodeURIComponent(id)}`,
    messages: (id) => `/api/v1/ai/chats/${encodeURIComponent(id)}/messages`,
    closeChat: (id) => `/api/v1/ai/chats/${encodeURIComponent(id)}/close`,
    deleteChat: (id) => `/api/v1/ai/chats/${encodeURIComponent(id)}`,
  },

  billing: {
    base: BILLING_BASE,
    plans: '/api/v1/billing/plans',

    createPayment: '/api/v1/billing/payments',
    paymentProvider: (paymentId) => `/api/v1/billing/payments/${encodeURIComponent(paymentId)}/provider`,

    myBalance: '/api/v1/billing/me/balance',
    myPayments: '/api/v1/billing/me/payments',
  },

}
