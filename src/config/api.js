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

    admin: {
      users: '/api/v1/auth/admin/users',
      user: (id) => `/api/v1/auth/admin/users/${encodeURIComponent(id)}`,
      logoutAll: (id) => `/api/v1/auth/admin/users/${encodeURIComponent(id)}/logout-all`,
    },
  },

  ai: {
    base: AI_BASE,
    generate: '/api/v1/ai/generate-pro',
    task: (id) => `/api/v1/ai/tasks/${encodeURIComponent(id)}`,

    generateBatch: '/api/v1/ai/generate-batch',
    batch: (id) => `/api/v1/ai/batches/${id}`,
    cancelBatch: (id) => `/api/v1/ai/batches/${id}/cancel`,

    samples: '/api/v1/ai/samples',

    chats: '/api/v1/ai/chats',
    chat: (id) => `/api/v1/ai/chats/${encodeURIComponent(id)}`,
    messages: (id) => `/api/v1/ai/chats/${encodeURIComponent(id)}/messages`,
    closeChat: (id) => `/api/v1/ai/chats/${encodeURIComponent(id)}/close`,
    deleteChat: (id) => `/api/v1/ai/chats/${encodeURIComponent(id)}`,

    admin: {
      batches: '/api/v1/ai/admin/batches',
      batch: (id) => `/api/v1/ai/admin/batches/${encodeURIComponent(id)}`,

      samples: '/api/v1/ai/admin/samples',
      sample: (id) => `/api/v1/ai/admin/samples/${encodeURIComponent(id)}`,

      templates: '/api/v1/ai/admin/prompts/templates',
      template: (id) => `/api/v1/ai/admin/prompts/templates/${encodeURIComponent(id)}`,
      templateVariants: (id) => `/api/v1/ai/admin/prompts/templates/${encodeURIComponent(id)}/variants`,
      variant: (id) => `/api/v1/ai/admin/prompts/variants/${encodeURIComponent(id)}`,
    },
  },

  billing: {
    base: BILLING_BASE,
    plans: '/api/v1/billing/plans',

    createPayment: '/api/v1/billing/payments',
    paymentProvider: (paymentId) => `/api/v1/billing/payments/${encodeURIComponent(paymentId)}/provider`,

    myBalance: '/api/v1/billing/me/balance',
    myPayments: '/api/v1/billing/me/payments',

    admin: {
      plans: '/api/v1/billing/admin/plans',
      plan: (id) => `/api/v1/billing/admin/plans/${encodeURIComponent(id)}`,
      activatePlan: (id) => `/api/v1/billing/admin/plans/${encodeURIComponent(id)}/activate`,
      deactivatePlan: (id) => `/api/v1/billing/admin/plans/${encodeURIComponent(id)}/deactivate`,

      payments: '/api/v1/billing/admin/payments',
      payment: (id) => `/api/v1/billing/admin/payments/${encodeURIComponent(id)}`,

      balances: '/api/v1/billing/admin/balances',
      balance: (userId) => `/api/v1/billing/admin/balances/${encodeURIComponent(userId)}`,
      addBalance: '/api/v1/billing/admin/add-balance',
      updBalance: '/api/v1/billing/admin/upd-balance',
    },
  },

}
