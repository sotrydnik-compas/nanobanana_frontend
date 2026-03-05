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
  return amount_minor.toFixed(2) + ' ' + currency
}

async function load() {
  errorText.value = ''
  busy.value = true
  try {
    const p = await billingApi.listPlans()
    plans.value = (p && p.plans) ? p.plans : []

    if (!selectedPlanId.value && plans.value.length) {
      selectedPlanId.value = plans.value[0].id
    }

    try {
      if (aiApi.samples) {
        const s = await aiApi.samples(1, 12)
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
  if (!selectedPlan.value) return

  if (!isAuthed.value) {
    await goLogin()
    return
  }

  const ok = await confirm({
    title: 'Купить тариф?',
    text: `Вы выбрали "${selectedPlan.value.title}".`,
    yesText: 'Купить',
    noText: 'Отмена',
  })
  if (!ok) return

  busy.value = true
  try {
    await billingApi.createPayment(selectedPlan.value.id)
    await router.push({ name: 'payments' })
  } catch (e) {
    errorText.value = e?.message || 'Не удалось создать платеж'
  } finally {
    busy.value = false
  }
}

onMounted(load)
</script>

<template>
  <div class="home-page">
    <!-- ABOUT -->
    <section id="about" class="card">
      <div class="head">
        <div class="head-text">
          <h1 class="h1">Генерация изображений для бизнеса</h1>
          <p class="p">
            NanoBanana помогает быстро создавать визуалы: карточки товаров, рекламные креативы
            и многое другое.
          </p>
        </div>

        <div v-if="busy" class="mini">загрузка…</div>
      </div>

      <div class="gallery">
        <div v-for="(img, idx) in samples" :key="idx" class="img-card">
          <img :src="img.url" alt="sample" loading="lazy" decoding="async" />
        </div>

        <div v-if="!samples.length" class="placeholder">
          Пока нет примеров в галерее.
        </div>
      </div>

      <div v-if="errorText" class="alert error">{{ errorText }}</div>
    </section>

    <!-- PLANS -->
    <section id="plans" class="card">
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

      <div v-if="plans.length" class="actions">
        <button
          class="btn primary"
          type="button"
          :disabled="!selectedPlanId || busy"
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
  max-width: 980px;
  width: 100%;
  margin: 0 auto;
  padding: 18px;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 18px;
}

/* sections */
.card {
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 18px;
  padding: 16px;
}

#about, #plans {
  scroll-margin-top: 14px;
}

.head {
  display: flex;
  justify-content: space-between;
  gap: 14px;
  align-items: flex-start;
}

.h1 { margin: 0; font-size: 34px; line-height: 1.1; font-weight: 950; }
.p { margin: 10px 0 0; color: var(--muted); font-weight: 700; }
.mini { color: var(--muted); font-size: 12px; font-weight: 800; white-space: nowrap; }

/* gallery: вертикальный скролл страницы, без горизонтальной карусели */
.gallery {
  margin-top: 14px;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.img-card {
  border: 1px solid var(--border);
  background: var(--card2);
  border-radius: 14px;
  overflow: hidden;
  aspect-ratio: 1 / 1;
}

.img-card img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.placeholder {
  grid-column: 1 / -1;
  border: 1px dashed var(--border);
  border-radius: 14px;
  padding: 14px;
  color: var(--muted);
  font-weight: 800;
  font-size: 12px;
}

.block-top {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: flex-end;
  margin-bottom: 12px;
}

.title { font-size: 20px; font-weight: 950; }
.sub { margin-top: 4px; color: var(--muted); font-size: 12px; font-weight: 700; }
.muted { color: var(--muted); font-size: 12px; font-weight: 700; }

.plans {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.plan {
  text-align: left;
  border: 1px solid var(--border);
  background: var(--card2);
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
  border-color: var(--primary);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--primary) 18%, transparent);
}

.plan-title { font-weight: 950; font-size: 16px; }
.plan-price { font-weight: 950; font-size: 18px; }
.plan-meta { color: var(--muted); font-weight: 800; font-size: 12px; }

.actions {
  margin-top: 14px;
  display: flex;
  justify-content: center;
}

.btn {
  border: 1px solid var(--border);
  background: var(--card);
  color: var(--text);
  border-radius: 12px;
  padding: 10px 12px;
  cursor: pointer;
  font-weight: 900;
  font-size: 12px;
}
.btn:disabled { opacity: .6; cursor: not-allowed; }
.btn.primary { background: var(--primary); border-color: var(--primary); color: var(--primaryText); }

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

@media (max-width: 640px) {
  .plans { grid-template-columns: 1fr; }
}

@media (max-width: 640px) {
  .gallery { grid-template-columns: 1fr; }
  .plans { grid-template-columns: 1fr; }
  .h1 { font-size: 30px; }
}
</style>