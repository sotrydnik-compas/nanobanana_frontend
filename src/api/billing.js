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

export const billingApi = {
  listPlans: () =>
    apiJson(`${endpoints.billing.base}${endpoints.billing.plans}`),

  myBalance: () =>
    apiJson(`${endpoints.billing.base}${endpoints.billing.myBalance}`),

  myPayments: (limit = 50, offset = 0) =>
    apiJson(`${endpoints.billing.base}${endpoints.billing.myPayments}?limit=${limit}&offset=${offset}`),

  createPayment: (plan_id) =>
    apiJson(`${endpoints.billing.base}${endpoints.billing.createPayment}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
      body: formBody({ plan_id }),
    }),

  checkPaymentProvider: (paymentId) =>
    apiJson(`${endpoints.billing.base}${endpoints.billing.paymentProvider(paymentId)}`),
}
