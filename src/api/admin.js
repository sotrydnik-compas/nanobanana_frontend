import { endpoints } from '../config/api'
import { apiJson } from './http'

function stripLastSegment(path) {
  // '/api/v1/auth/login' -> '/api/v1/auth'
  return (path || '').replace(/\/[^/]*$/, '')
}

const aiPrefix = stripLastSegment(endpoints.ai.generate)          // '/api/v1/ai'
const authPrefix = stripLastSegment(endpoints.auth.login)        // '/api/v1/auth'
const billingPrefix = stripLastSegment(endpoints.billing.plans)  // '/api/v1/billing'

const aiRoot = `${endpoints.ai.base}${aiPrefix}`
const authRoot = `${endpoints.auth.base}${authPrefix}`
const billingRoot = `${endpoints.billing.base}${billingPrefix}`

function qs(params = {}) {
  const p = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '') continue
    p.set(k, String(v))
  }
  const s = p.toString()
  return s ? `?${s}` : ''
}

function fd(obj = {}) {
  const f = new FormData()
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue
    f.append(k, String(v))
  }
  return f
}

export const adminApi = {
  ai: {
    listBatches: ({ limit = 50, offset = 0, status = '' } = {}) =>
      apiJson(`${aiRoot}/admin/batches${qs({ limit, offset, status })}`),

    getBatch: (batchId, include_items = true) =>
      apiJson(`${aiRoot}/admin/batches/${encodeURIComponent(batchId)}${qs({ include_items })}`),

    getSamples: (page = 1, page_size = 10) =>
        apiJson(`
          ${aiRoot}/admin/samples/?page=${page}&page_size=${page_size}`
        ),

    uploadSamples: (files = []) => {
      const f = new FormData()
      for (const file of (files || [])) f.append('files', file, file.name)
      return apiJson(`${aiRoot}/admin/samples`, { method: 'POST', body: f })
    },

    updateSample: (sampleId, is_active) =>
      apiJson(
        `${aiRoot}/admin/samples/${encodeURIComponent(sampleId)}`,
        { method: 'PATCH', body: fd({ is_active }) }
      ),

    deleteSample: (sampleId) =>
      apiJson(`${aiRoot}/admin/samples/${encodeURIComponent(sampleId)}`, { method: 'DELETE' }),

    listTemplates: ({ limit = 50, offset = 0, is_active = null } = {}) =>
      apiJson(`${aiRoot}/admin/prompts/templates${qs({ limit, offset, is_active })}`),

    createTemplate: ({ name, template_text, is_active = true }) =>
      apiJson(`${aiRoot}/admin/prompts/templates`, {
        method: 'POST',
        body: fd({ name, template_text, is_active }),
      }),

    getTemplate: (templateId) =>
      apiJson(`${aiRoot}/admin/prompts/templates/${encodeURIComponent(templateId)}`),

    updateTemplate: (templateId, payload = {}) =>
      apiJson(`${aiRoot}/admin/prompts/templates/${encodeURIComponent(templateId)}`, {
        method: 'PATCH',
        body: fd(payload),
      }),

    deleteTemplate: (templateId) =>
      apiJson(`${aiRoot}/admin/prompts/templates/${encodeURIComponent(templateId)}`, { method: 'DELETE' }),

    listVariants: (templateId, { is_active = null } = {}) =>
      apiJson(`${aiRoot}/admin/prompts/templates/${encodeURIComponent(templateId)}/variants${qs({ is_active })}`),

    createVariant: (templateId, payload = {}) =>
      apiJson(`${aiRoot}/admin/prompts/templates/${encodeURIComponent(templateId)}/variants`, {
        method: 'POST',
        body: fd(payload),
      }),

    updateVariant: (variantId, payload = {}) =>
      apiJson(`${aiRoot}/admin/prompts/variants/${encodeURIComponent(variantId)}`, {
        method: 'PATCH',
        body: fd(payload),
      }),

    deleteVariant: (variantId) =>
      apiJson(`${aiRoot}/admin/prompts/variants/${encodeURIComponent(variantId)}`, { method: 'DELETE' }),
  },

  auth: {
    listUsers: ({ limit = 50, offset = 0, search = '', role = '', is_active = null, email_verified = null } = {}) =>
      apiJson(`${authRoot}/admin/users${qs({ limit, offset, search, role, is_active, email_verified })}`),

    getUser: (userId) =>
      apiJson(`${authRoot}/admin/users/${encodeURIComponent(userId)}`),

    createUser: (payload = {}) =>
      apiJson(`${authRoot}/admin/users`, { method: 'POST', body: fd(payload) }),

    updateUser: (userId, payload = {}) =>
      apiJson(`${authRoot}/admin/users/${encodeURIComponent(userId)}`, { method: 'PATCH', body: fd(payload) }),

    deleteUser: (userId, { permanent = false } = {}) =>
      apiJson(`${authRoot}/admin/users/${encodeURIComponent(userId)}${qs({ permanent })}`, { method: 'DELETE' }),

    logoutAll: (userId) =>
      apiJson(`${authRoot}/admin/users/${encodeURIComponent(userId)}/logout-all`, { method: 'POST' }),
  },

  billing: {
    listPlans: () =>
      apiJson(`${billingRoot}/admin/plans`),

    createPlan: (payload = {}) =>
      apiJson(`${billingRoot}/admin/plans`, { method: 'POST', body: fd(payload) }),

    updatePlan: (planId, payload = {}) =>
      apiJson(`${billingRoot}/admin/plans/${encodeURIComponent(planId)}`, { method: 'POST', body: fd(payload) }),

    activatePlan: (planId) =>
      apiJson(`${billingRoot}/admin/plans/${encodeURIComponent(planId)}/activate`, { method: 'POST' }),

    deactivatePlan: (planId) =>
      apiJson(`${billingRoot}/admin/plans/${encodeURIComponent(planId)}/deactivate`, { method: 'POST' }),

    listPayments: ({ page = 1, page_size = 10 } = {}) =>
      apiJson(`${billingRoot}/admin/payments${qs({ page, page_size })}`),

    getPayment: (paymentId) =>
      apiJson(`${billingRoot}/admin/payments/${encodeURIComponent(paymentId)}`),

    listBalances: ({ page = 1, page_size = 10 } = {}) =>
      apiJson(`${billingRoot}/admin/balances${qs({ page, page_size })}`),

    getBalance: (userId) =>
      apiJson(`${billingRoot}/admin/balances/${encodeURIComponent(userId)}`),

    addBalance: ({ user_id, requests_amount }) =>
      apiJson(`${billingRoot}/admin/add-balance`, { method: 'POST', body: fd({ user_id, requests_amount }) }),

    updBalance: ({ user_id, requests_amount }) =>
      apiJson(`${billingRoot}/admin/upd-balance`, { method: 'PATCH', body: fd({ user_id, requests_amount }) }),
  },
}