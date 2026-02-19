<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { billingApi } from '../api/billing'
import { auth } from '../stores/auth'

auth.init()
const router = useRouter()

const busy = ref(false)
const errorText = ref('')
const infoText = ref('')

const balance = ref({ user_id: null, requests_left: 0 })
const plans = ref([])      // [{id,title,price_minor,currency,requests_total}]
const payments = ref([])   // [{id,plan_id,status,...}]

const pollTimer = ref(null)
const pollBusy = ref(false)

const pendingPayments = computed(() => payments.value.filter(p => p.status === 'pending'))

function money(amount_minor, currency) {
  const v = Number(amount_minor || 0) / 100
  return `${v.toFixed(2)} ${currency || 'RUB'}`
}

async function loadAll() {
  errorText.value = ''
  infoText.value = ''
  busy.value = true
  try {
    const [b, pl, pay] = await Promise.all([
      billingApi.myBalance(),
      billingApi.listPlans(),
      billingApi.myPayments(50, 0),
    ])
    balance.value = b || { user_id: null, requests_left: 0 }
    plans.value = (pl && pl.plans) ? pl.plans : []
    payments.value = (pay && pay.payments) ? pay.payments : []
  } catch (e) {
    errorText.value = e?.message || 'Не удалось загрузить billing данные'
  } finally {
    busy.value = false
  }
}

async function buyPlan(planId) {
  errorText.value = ''
  infoText.value = ''
  busy.value = true
  try {
    const r = await billingApi.createPayment(planId)
    const url = r?.payment_url
    if (!url) throw new Error('Не получили ссылку оплаты')

    // уводим пользователя на оплату
    const w = window.open(url, '_blank', 'noopener,noreferrer')
    if (!w) {
      // если попапы запрещены — покажем ссылку
      infoText.value = `Откройте ссылку для оплаты: ${url}`
    } else {
      infoText.value = 'Ссылка оплаты открыта в новой вкладке. После оплаты вернитесь сюда.'
    }

    // сразу обновим список платежей (появится pending)
    await loadAll()
  } catch (e) {
    errorText.value = e?.message || 'Не удалось создать платёж'
  } finally {
    busy.value = false
  }
}

function stopPolling() {
  if (pollTimer.value) {
    clearInterval(pollTimer.value)
    pollTimer.value = null
  }
}

async function pollPendingOnce() {
  if (pollBusy.value) return
  if (!pendingPayments.value.length) return

  pollBusy.value = true
  try {
    // проверяем только pending, по одному
    for (const p of pendingPayments.value) {
      try {
        await billingApi.checkPaymentProvider(p.id)
      } catch {
        // provider может временно падать — не валим всю страницу
      }
    }

    // после проверок — перечитать баланс и платежи
    const [b, pay] = await Promise.all([
      billingApi.myBalance(),
      billingApi.myPayments(50, 0),
    ])
    balance.value = b || balance.value
    payments.value = (pay && pay.payments) ? pay.payments : payments.value
  } finally {
    pollBusy.value = false
  }
}

function startPolling() {
  stopPolling()
  pollTimer.value = setInterval(() => {
    pollPendingOnce()
  }, 30000)
}

async function goAccount() {
  await router.push({ name: 'account' })
}

onMounted(async () => {
  await loadAll()
  startPolling()
  // сразу дернём проверку при заходе (чтобы “после возврата” обновилось быстрее)
  await pollPendingOnce()
})

onBeforeUnmount(() => {
  stopPolling()
})
</script>

<template>
  <div class="page">
    <div class="top">
      <div>
        <div class="title">Платежи</div>
        <div class="sub">Баланс запросов и история оплат</div>
      </div>

      <div class="top-actions">
        <button class="btn" type="button" @click="goAccount">← Аккаунт</button>
        <button class="btn" type="button" @click="loadAll" :disabled="busy">Обновить</button>
      </div>
    </div>

    <div class="card">
      <div class="card-title">Баланс</div>
      <div class="balance">
        <div class="balance-num">{{ balance.requests_left }}</div>
        <div class="balance-label">запросов осталось</div>
      </div>
      <div class="muted" v-if="pendingPayments.length">
        Есть pending-платежи ({{ pendingPayments.length }}). Автопроверка каждые 30 секунд.
      </div>
    </div>

    <div class="card">
      <div class="card-title">Тарифы</div>

      <div v-if="!plans.length" class="muted">Нет активных тарифов.</div>

      <div v-else class="plans">
        <div v-for="p in plans" :key="p.id" class="plan">
          <div class="plan-title">{{ p.title }}</div>
          <div class="plan-meta">
            <div class="pill">{{ p.requests_total }} запросов</div>
            <div class="pill">{{ money(p.price_minor, p.currency) }}</div>
          </div>
          <button class="btn primary" type="button" @click="buyPlan(p.id)" :disabled="busy">
            Купить
          </button>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-title">Мои платежи</div>

      <div v-if="!payments.length" class="muted">Платежей пока нет.</div>

      <div v-else class="table">
        <div class="tr head">
          <div>ID</div>
          <div>Статус</div>
          <div>Сумма</div>
          <div>Создан</div>
        </div>

        <div v-for="p in payments" :key="p.id" class="tr">
          <div class="mono">{{ p.id }}</div>
          <div>
            <span class="status" :class="p.status">{{ p.status }}</span>
            <span v-if="p.status==='pending'" class="mini"> (проверяем)</span>
          </div>
          <div>{{ money(p.amount_minor, p.currency) }}</div>
          <div class="mono">{{ p.created_at }}</div>
        </div>
      </div>
    </div>

    <div v-if="errorText" class="alert error">{{ errorText }}</div>
    <div v-else-if="infoText" class="alert ok">{{ infoText }}</div>
  </div>
</template>

<style scoped>
.page {
  max-width: 980px;
  margin: 0 auto;
  padding: 18px;
  font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
  color: #111827;
}

.top {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  gap: 12px;
  margin-bottom: 14px;
}
.title { font-size: 22px; font-weight: 900; line-height: 1.2; }
.sub { margin-top: 3px; color: #6b7280; font-size: 12px; }
.top-actions { display: flex; gap: 8px; }

.card {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 16px;
  padding: 14px;
  margin-bottom: 12px;
}
.card-title { font-weight: 900; margin-bottom: 10px; }
.muted { color: #6b7280; font-size: 12px; margin-top: 8px; }

.balance { display: flex; align-items: baseline; gap: 10px; }
.balance-num { font-size: 34px; font-weight: 900; }
.balance-label { color: #6b7280; font-size: 12px; font-weight: 800; }

.plans {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}
.plan {
  border: 1px solid #e5e7eb;
  border-radius: 14px;
  padding: 12px;
  background: #fafafa;
}
.plan-title { font-weight: 900; margin-bottom: 8px; }
.plan-meta { display: flex; gap: 8px; margin-bottom: 10px; flex-wrap: wrap; }
.pill {
  border: 1px solid #e5e7eb;
  background: #fff;
  border-radius: 999px;
  padding: 6px 10px;
  font-size: 12px;
  font-weight: 800;
}

.table { display: grid; gap: 6px; }
.tr {
  display: grid;
  grid-template-columns: 2fr 1fr 1fr 1.3fr;
  gap: 10px;
  padding: 10px;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  background: #fff;
  align-items: center;
}
.tr.head {
  background: #f4f4f5;
  font-weight: 900;
  font-size: 12px;
  color: #374151;
}
.mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 12px; }

.status {
  display: inline-block;
  padding: 4px 8px;
  border-radius: 999px;
  border: 1px solid #e5e7eb;
  font-size: 12px;
  font-weight: 900;
}
.status.pending { background: #eff6ff; border-color: #bfdbfe; color: #1e3a8a; }
.status.succeeded { background: #ecfdf5; border-color: #a7f3d0; color: #065f46; }
.status.failed { background: #fef2f2; border-color: #fecaca; color: #7f1d1d; }
.status.canceled { background: #f4f4f5; border-color: #e5e7eb; color: #374151; }
.mini { font-size: 12px; color: #6b7280; font-weight: 700; }

.btn {
  border: 1px solid #e5e7eb;
  background: #fff;
  border-radius: 12px;
  padding: 10px 12px;
  cursor: pointer;
  font-weight: 800;
  font-size: 13px;
}
.btn:disabled { opacity: .6; cursor: not-allowed; }
.btn.primary { background: #2563eb; border-color: #2563eb; color: #fff; }

.alert {
  margin-top: 10px;
  padding: 10px 12px;
  border-radius: 14px;
  border: 1px solid;
  font-size: 13px;
}
.alert.error { background: #fef2f2; border-color: #fecaca; color: #7f1d1d; }
.alert.ok { background: #ecfdf5; border-color: #a7f3d0; color: #065f46; }

@media (max-width: 900px) {
  .plans { grid-template-columns: 1fr; }
  .tr { grid-template-columns: 1fr; }
  .tr.head { display: none; }
}
</style>
