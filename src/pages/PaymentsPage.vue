<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { billingApi } from '../api/billing'
import { auth } from '../stores/auth'
import { confirm } from '../utils/confirm'

auth.init()

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
  return amount_minor.toFixed(2) + ' ' + currency;
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

  const p = (plans.value || []).find(x => x.id === planId) || null
  const ok = await confirm({
    title: 'Купить тариф?',
    text: p ? `${p.title} — ${p.requests_total} запросов за ${money(p.price_minor, p.currency)}.` : 'Подтвердите покупку тарифа.',
    yesText: 'Купить',
    noText: 'Отмена',
  })
  if (!ok) return

  busy.value = true
  try {
    const r = await billingApi.createPayment(planId)
    const url = r?.payment_url
    if (!url) throw new Error('Не получили ссылку оплаты')

    // уводим пользователя на оплату
    const w = window.open(url, '_blank', 'noopener,noreferrer')
    if (!w) {
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

function pad2(n) {
  return String(n).padStart(2, '0')
}

function formatMsk(dt) {
  if (!dt) return '—'
  const s = String(dt)

  // если нет таймзоны — считаем, что это UTC
  const hasTz = /Z$|[+-]\d\d:\d\d$/.test(s)
  const d = new Date(hasTz ? s : (s + 'Z'))
  if (Number.isNaN(d.getTime())) return s

  const msk = new Date(d.getTime() + 3 * 60 * 60 * 1000)

  // форматируем через UTC, чтобы не зависеть от локальной TZ браузера
  const DD = pad2(msk.getUTCDate())
  const MM = pad2(msk.getUTCMonth() + 1)
  const YYYY = msk.getUTCFullYear()
  const hh = pad2(msk.getUTCHours())
  const mm = pad2(msk.getUTCMinutes())
  const ss = pad2(msk.getUTCSeconds())

  return `${DD}.${MM}.${YYYY}, ${hh}:${mm}:${ss}`
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
          <div class="mono">{{ formatMsk(p.created_at) }}</div>
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
  width: 100%;
  margin: 0 auto;
  padding: 18px;
  box-sizing: border-box;
}

.top {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  gap: 12px;
  margin-bottom: 14px;
}
.title { font-size: 22px; font-weight: 900; line-height: 1.2; }
.sub { margin-top: 3px; color: var(--muted); font-size: 12px; font-weight: 700; }
.top-actions { display: flex; gap: 8px; }

.card {
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 16px;
  padding: 14px;
  margin-bottom: 12px;
}
.card-title { font-weight: 900; margin-bottom: 10px; }
.muted { color: var(--muted); font-size: 12px; margin-top: 8px; font-weight: 700; }

.balance { display: flex; align-items: baseline; gap: 10px; }
.balance-num { font-size: 34px; font-weight: 900; }
.balance-label { color: var(--muted); font-size: 12px; font-weight: 800; }

.plans {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}
.plan {
  border: 1px solid var(--border);
  border-radius: 14px;
  padding: 12px;
  background: var(--card2);
}
.plan-title { font-weight: 900; margin-bottom: 8px; }
.plan-meta { display: flex; gap: 8px; margin-bottom: 10px; flex-wrap: wrap; }

.pill {
  border: 1px solid var(--border);
  background: var(--card);
  color: var(--text);
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
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--card);
  align-items: center;
}
.tr.head {
  background: var(--theadBg);
  font-weight: 900;
  font-size: 12px;
  color: var(--theadText);
}
.mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 12px; }

.status {
  display: inline-block;
  padding: 4px 8px;
  border-radius: 999px;
  border: 1px solid var(--border);
  font-size: 12px;
  font-weight: 900;
}
.status.pending { background: var(--statusPendingBg); border-color: var(--statusPendingBorder); color: var(--statusPendingText); }
.status.succeeded { background: var(--statusSucceededBg); border-color: var(--statusSucceededBorder); color: var(--statusSucceededText); }
.status.failed { background: var(--statusFailedBg); border-color: var(--statusFailedBorder); color: var(--statusFailedText); }
.status.canceled { background: var(--statusCanceledBg); border-color: var(--statusCanceledBorder); color: var(--statusCanceledText); }

.mini { font-size: 12px; color: var(--muted); font-weight: 700; }

.btn {
  border: 1px solid var(--border);
  background: var(--card);
  color: var(--text);
  border-radius: 12px;
  padding: 10px 12px;
  cursor: pointer;
  font-weight: 800;
  font-size: 13px;
}
.btn:disabled { opacity: .6; cursor: not-allowed; }
.btn.primary { background: var(--primary); border-color: var(--primary); color: var(--primaryText); }

.alert {
  margin-top: 10px;
  padding: 10px 12px;
  border-radius: 14px;
  border: 1px solid;
  font-size: 13px;
  font-weight: 800;
}
.alert.error { background: var(--dangerBg); border-color: var(--dangerBorder); color: var(--dangerText); }
.alert.ok { background: var(--successBg); border-color: var(--successBorder); color: var(--successText); }

.page { overflow-x: hidden; }

.tr > div { min-width: 0; }

.mono {
  overflow-wrap: anywhere;
  word-break: break-word;
}

@media (max-width: 900px) {
  .plans { grid-template-columns: 1fr; }
  .tr { grid-template-columns: 1fr; }
  .tr.head { display: none; }
}
</style>
