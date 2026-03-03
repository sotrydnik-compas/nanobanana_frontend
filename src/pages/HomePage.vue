<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { auth } from '../stores/auth'
import { billingApi } from '../api/billing'
import { aiApi } from '../api/ai'
import { confirm } from '../utils/confirm'

auth.init()
const router = useRouter()

const busy = ref(false)
const errorText = ref('')
const samples = ref([]) // [{url}]
const plans = ref([])   // [{id,title,price_minor,currency,requests_total}]
const selectedPlanId = ref(null)

const isAuthed = computed(() => !!auth.state.accessToken)
const selectedPlan = computed(() => (plans.value || []).find(p => p.id === selectedPlanId.value) || null)

function money(amount_minor, currency) {
  return amount_minor.toFixed(2) + ' ' + currency;
}

async function load() {
  errorText.value = ''
  busy.value = true
  try {
    // планы — обязательно
    const p = await billingApi.listPlans()
    plans.value = (p && p.plans) ? p.plans : []

    // дефолтно выберем первый тариф
    if (!selectedPlanId.value && plans.value.length) {
      selectedPlanId.value = plans.value[0].id
    }

    // samples — опционально (ошибки не валят страницу)
    try {
      if (aiApi.samples) {
        const s = await aiApi.samples(1, 12) // можно 10, можно 12 под карусель
        const items = Array.isArray(s?.items) ? s.items : []
        samples.value = items
          .map(x => ({ url: x?.url || '' }))
          .filter(x => !!x.url)
      } else {
        samples.value = []
      }
    } catch {
      samples.value = []
    }
  } catch (e) {
    errorText.value = e?.message || 'Не удалось загрузить данные'
  } finally {
    busy.value = false
  }
}

async function goLogin() {
  // чтобы после логина можно было вернуться на тарифы
  await router.push({ name: 'login', query: { next: '/home#plans' } })
}

async function goChat() {
  await router.push({ name: 'chat' })
}

function selectPlan(planId) {
  selectedPlanId.value = planId
}

async function buySelectedPlan() {
  errorText.value = ''

  if (!selectedPlanId.value) {
    errorText.value = 'Выберите тариф.'
    return
  }

  if (!isAuthed.value) {
    await goLogin()
    return
  }

  const p = selectedPlan.value
  const ok = await confirm({
    title: 'Купить выбранный тариф?',
    text: p ? `${p.title} — ${p.requests_total} запросов за ${money(p.price_minor, p.currency)}.` : 'Подтвердите покупку.',
    yesText: 'Купить',
    noText: 'Отмена',
  })
  if (!ok) return

  try {
    const r = await billingApi.createPayment(selectedPlanId.value)
    const url = r?.payment_url
    if (!url) throw new Error('Не получили ссылку оплаты')

    window.open(url, '_blank', 'noopener,noreferrer')

    // после оплаты пользователь вернется по redirect_url; мониторинг pending будет на /payments
    await router.push({ name: 'payments' })
  } catch (e) {
    errorText.value = e?.message || 'Не удалось создать платёж'
  }
}

onMounted(load)
</script>

<template>
  <div class="home-page">
    <!-- HERO / ABOUT (единый блок) -->
    <section id="about" class="hero">
      <div class="hero-head">
        <div>
          <h1 class="h1">Генерация изображений для бизнеса</h1>
          <p class="p">
            NanoBanana помогает быстро создавать визуалы: карточки товаров, рекламные креативы
            и многое другое.
          </p>
        </div>

        <div class="hero-mini" v-if="busy">загрузка…</div>
      </div>

      <div class="carousel">
        <div v-for="(img, idx) in samples" :key="idx" class="slide">
          <img :src="img.url" alt="sample" loading="lazy" decoding="async" />
        </div>

        <div v-if="!samples.length" class="placeholder">
          Пока нет примеров в галерее.
        </div>
      </div>

      <div v-if="errorText" class="alert error">{{ errorText }}</div>
    </section>

    <!-- PLANS -->
    <section id="plans" class="block">
      <div class="block-top">
        <div>
          <div class="title">Тарифы</div>
          <div class="sub">Выберите план и пополните баланс запросов</div>
        </div>
      </div>

      <div v-if="!plans.length" class="muted">Нет активных тарифов.</div>

      <div v-else class="plans">
        <button
          v-for="p in plans"
          :key="p.id"
          type="button"
          class="plan"
          :class="{ selected: p.id === selectedPlanId }"
          @click="selectPlan(p.id)"
        >
          <div class="plan-title">{{ p.title }}</div>
          <div class="plan-price">{{ money(p.price_minor, p.currency) }}</div>
          <div class="plan-meta">{{ p.requests_total }} запросов</div>
        </button>
      </div>

      <div v-if="plans.length" class="plans-footer">
        <button
          class="btn primary"
          type="button"
          :disabled="!selectedPlanId"
          @click="buySelectedPlan"
        >
          {{ isAuthed ? 'Купить выбранный тариф' : 'Войти для покупки' }}
        </button>

      </div>
    </section>
  </div>
</template>

<style scoped>
.home-page {
  max-width: 980px !important; /* на случай глобальных конфликтов */
  width: 100%;
  margin: 0 auto;
  padding: 18px;
  box-sizing: border-box;

  /* ключ: растягиваем страницу по высоте */
  min-height: 100%;
  display: flex;
  flex-direction: column;
  gap: 18px;
}

/* HERO */
.hero {
  background: var(--card, #fff);
  border: 1px solid var(--border, #e5e7eb);
  border-radius: 18px;
  padding: 16px;
  margin-bottom: 18px;
}

.hero-head {
  display: flex;
  justify-content: space-between;
  gap: 14px;
  align-items: flex-start;
}

.h1 { margin: 0; font-size: 34px; line-height: 1.1; font-weight: 950; }
.p { margin: 10px 0 0; color: var(--muted, #6b7280); font-weight: 700; }
.hero-mini { color: var(--muted, #6b7280); font-size: 12px; font-weight: 800; white-space: nowrap; }

/* carousel: 3–4 видно сразу, без кнопок */
.carousel {
  margin-top: 14px;
  display: flex;
  gap: 10px;
  overflow-x: auto;
  padding-bottom: 2px;
  scroll-snap-type: x mandatory;
}

.slide {
  flex: 0 0 260px; /* на широком экране помещается 3–4 */
  border: 1px solid var(--border, #e5e7eb);
  background: var(--card2, #fafafa);
  border-radius: 14px;
  overflow: hidden;
  aspect-ratio: 1 / 1;
  scroll-snap-align: start;
}
.slide img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.placeholder {
  flex: 1;
  min-width: 320px;
  border: 1px dashed var(--border, #e5e7eb);
  border-radius: 14px;
  padding: 14px;
  color: var(--muted, #6b7280);
  font-weight: 800;
  font-size: 12px;
}
.mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }

/* PLANS block */
.block {
  background: var(--card, #fff);
  border: 1px solid var(--border, #e5e7eb);
  border-radius: 18px;
  padding: 16px;

  /* ключ: этот блок заполняет оставшуюся высоту */
  flex: 1;
  display: flex;
  flex-direction: column;
}

.block-top {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: flex-end;
  margin-bottom: 12px;
}

.title { font-size: 20px; font-weight: 950; }
.sub { margin-top: 4px; color: var(--muted, #6b7280); font-size: 12px; font-weight: 700; }
.muted { color: var(--muted, #6b7280); font-size: 12px; font-weight: 700; }

.plans {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
}

.plan {
  text-align: left;
  border: 1px solid var(--border, #e5e7eb);
  background: var(--card2, #fafafa);
  border-radius: 16px;
  padding: 14px;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 10px;
  color: var(--text);
}
.plan:hover { background: var(--card2Hover); }

.plan.selected {
  border-color: var(--primary, #2563eb);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--primary, #2563eb) 18%, transparent);
}

.plan-title { font-weight: 950; font-size: 16px; }
.plan-price { font-weight: 950; font-size: 18px; }
.plan-meta { color: var(--muted, #6b7280); font-weight: 800; font-size: 12px; }

.plans-footer {
  margin-top: auto; /* кнопка уедет вниз блока */
  padding-top: 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-items: center;
}

.btn {
  border: 1px solid var(--border, #e5e7eb);
  background: var(--card, #fff);
  color: var(--text, #111827);
  border-radius: 12px;
  padding: 10px 12px;
  cursor: pointer;
  font-weight: 900;
  font-size: 12px;
}
.btn:disabled { opacity: .6; cursor: not-allowed; }
.btn.primary { background: var(--primary, #2563eb); border-color: var(--primary, #2563eb); color: var(--primaryText, #fff); }

.picked { font-size: 12px; color: var(--muted, #6b7280); font-weight: 800; }
.picked-link { font-size: 12px; color: var(--muted, #6b7280); font-weight: 700; }

.alert.error {
  margin-top: 10px;
  padding: 10px 12px;
  border-radius: 14px;
  border: 1px solid #fecaca;
  background: #fef2f2;
  color: #7f1d1d;
  font-size: 12px;
  font-weight: 800;
}

@media (max-width: 980px) {
  .plans { grid-template-columns: 1fr; }
  .slide { flex-basis: 72vw; }
}
</style>