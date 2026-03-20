<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { auth } from '../stores/auth'
import { confirm } from '../utils/confirm'
import { adminApi } from '../api/admin'
import { accountApi } from '../api/account'

auth.init()
const router = useRouter()

const busy = ref(false)
const errorText = ref('')
const infoText = ref('')

const isAdmin = computed(() => auth.state.user?.role === 'admin')

const tabs = [
  { k: 'users', label: 'Пользователи' },
  { k: 'plans', label: 'Тарифы' },
  { k: 'balances', label: 'Балансы' },
  { k: 'payments', label: 'Платежи' },
  { k: 'samples', label: 'Сэмплы' },
  { k: 'prompts', label: 'Промпты' },
  { k: 'batches', label: 'Пакеты' },
]
const tab = ref('users')

function yesNo(v) {
  if (v === true || v === 'true') return 'Да'
  if (v === false || v === 'false') return 'Нет'
  return '—'
}
function roleRu(r) {
  if (r === 'admin') return 'Администратор'
  if (r === 'user') return 'Пользователь'
  return r || '—'
}
function pad2(n) {
  return String(n).padStart(2, '0')
}
function formatMsk(dt) {
  if (!dt) return '—'
  const s = String(dt)
  const hasTz = /Z$|[+-]\d\d:\d\d$/.test(s)
  const d = new Date(hasTz ? s : (s + 'Z')) // если TZ нет — считаем UTC
  if (Number.isNaN(d.getTime())) return s

  const msk = new Date(d.getTime() + 3 * 60 * 60 * 1000)

  const DD = pad2(msk.getUTCDate())
  const MM = pad2(msk.getUTCMonth() + 1)
  const YYYY = msk.getUTCFullYear()
  const hh = pad2(msk.getUTCHours())
  const mm = pad2(msk.getUTCMinutes())
  const ss = pad2(msk.getUTCSeconds())

  return `${DD}.${MM}.${YYYY}, ${hh}:${mm}:${ss}`
}

// индекс пользователей для селектов (balances/batches) и отображения email вместо id
const userIndex = ref([])
const usersById = computed(() => {
  const src = (userIndex.value?.length ? userIndex.value : users.items) || []
  const m = {}
  for (const u of src) {
    const key = u?.id ?? u?.user_id ?? u?.uuid
    if (key) m[String(key)] = u.email
  }
  return m
})
const userSelectItems = computed(() => (userIndex.value?.length ? userIndex.value : users.items))
function userLabel(id) {
  const key = id == null ? '' : String(id)
  return usersById.value[key] || id
}
async function ensureUserIndex() {
  if (userIndex.value.length) return
  try {
    const r = await adminApi.auth.listUsers({ limit: 100, offset: 0 })
    userIndex.value = r?.items || []
  } catch {
    // не валим UI
  }
}

async function setTab(k) {
  tab.value = k
  errorText.value = ''
  infoText.value = ''
  if (k === 'balances' || k === 'batches') await ensureUserIndex()
  await loadCurrent()
}

// ---- USERS
const users = reactive({
  items: [],
  total: 0,
  limit: 50,
  offset: 0,
  search: '',
  role: '',
  is_active: '',
  email_verified: '',
})

const userCreate = reactive({ email: '', password: '', role: 'user', is_active: true, email_verified: false })
const userEditId = ref('')
const userEdit = reactive({ email: '', password: '', role: '', is_active: '', email_verified: '' })

async function loadUsers() {
  busy.value = true
  try {
    const r = await adminApi.auth.listUsers({
      limit: users.limit,
      offset: users.offset,
      search: users.search || undefined,
      role: users.role || undefined,
      is_active: users.is_active === '' ? undefined : users.is_active,
      email_verified: users.email_verified === '' ? undefined : users.email_verified,
    })
    users.items = r?.items || []
    users.total = Number(r?.total ?? 0)
  } finally {
    busy.value = false
  }
}

async function createUser() {
  errorText.value = ''
  infoText.value = ''

  const ok = await confirm({
    title: 'Создать пользователя?',
    text: `Email: ${(userCreate.email || '').trim().toLowerCase()}`,
    yesText: 'Создать',
    noText: 'Отмена',
  })
  if (!ok) return

  busy.value = true
  try {
    await adminApi.auth.createUser({
      email: userCreate.email,
      password: userCreate.password,
      role: userCreate.role,
      is_active: userCreate.is_active,
      email_verified: userCreate.email_verified,
    })
    infoText.value = 'Пользователь создан.'
    userCreate.email = ''
    userCreate.password = ''
    userCreate.role = 'user'
    userCreate.is_active = true
    userCreate.email_verified = false
    await loadUsers()
  } catch (e) {
    errorText.value = e?.message || 'Не удалось создать пользователя'
  } finally {
    busy.value = false
  }
}

function startEditUser(u) {
  userEditId.value = u.id
  userEdit.email = u.email
  userEdit.password = ''
  userEdit.role = u.role
  userEdit.is_active = String(u.is_active)
  userEdit.email_verified = String(u.email_verified)
}

function cancelEditUser() {
  userEditId.value = ''
  userEdit.email = ''
  userEdit.password = ''
  userEdit.role = ''
  userEdit.is_active = ''
  userEdit.email_verified = ''
}

async function saveUser() {
  if (!userEditId.value) return

  const ok = await confirm({
    title: 'Сохранить изменения пользователя?',
    text: userEdit.email,
    yesText: 'Сохранить',
    noText: 'Отмена',
  })
  if (!ok) return

  busy.value = true
  try {
    await adminApi.auth.updateUser(userEditId.value, {
      email: userEdit.email || undefined,
      password: userEdit.password || undefined,
      role: userEdit.role || undefined,
      is_active: userEdit.is_active === '' ? undefined : userEdit.is_active,
      email_verified: userEdit.email_verified === '' ? undefined : userEdit.email_verified,
    })
    infoText.value = 'Пользователь обновлён.'
    cancelEditUser()
    await loadUsers()
  } catch (e) {
    errorText.value = e?.message || 'Не удалось обновить пользователя'
  } finally {
    busy.value = false
  }
}

async function logoutAllUser(userId) {
  const ok = await confirm({
    title: 'Завершить все сессии пользователя?',
    text: `user_id: ${userId}`,
    danger: true,
    yesText: 'Завершить',
    noText: 'Отмена',
  })
  if (!ok) return

  busy.value = true
  try {
    await adminApi.auth.logoutAll(userId)
    infoText.value = 'Сессии завершены.'
  } catch (e) {
    errorText.value = e?.message || 'Не удалось завершить сессии'
  } finally {
    busy.value = false
  }
}

async function deactivateUser(userId) {
  const ok = await confirm({
    title: 'Деактивировать пользователя?',
    text: 'Пользователь станет неактивным и все refresh-сессии будут отозваны.',
    danger: true,
    yesText: 'Деактивировать',
    noText: 'Отмена',
  })
  if (!ok) return

  busy.value = true
  try {
    await adminApi.auth.deleteUser(userId, { permanent: false })
    infoText.value = 'Пользователь деактивирован.'
    await loadUsers()
  } catch (e) {
    errorText.value = e?.message || 'Не удалось деактивировать'
  } finally {
    busy.value = false
  }
}

// ---- PLANS
const plans = ref([])
const planCreate = reactive({
  title: '',
  price_minor: 0,
  requests_total: 100,
  currency: 'RUB',
  is_active: true,
  is_system: false,
})
const planEditId = ref('')
const planEdit = reactive({ title: '', price_minor: '', requests_total: '', currency: 'RUB', is_active: '' })

function normalizePlan(plan = {}) {
  return {
    ...plan,
    is_system: !!plan?.is_system,
    is_purchasable: plan?.is_purchasable !== false,
  }
}

async function loadPlans() {
  busy.value = true
  try {
    const r = await adminApi.billing.listPlans()
    plans.value = Array.isArray(r?.plans) ? r.plans.map(normalizePlan) : []
  } finally {
    busy.value = false
  }
}

function startEditPlan(p) {
  planEditId.value = p.id
  planEdit.title = p.title
  planEdit.price_minor = String(p.price_minor)
  planEdit.requests_total = String(p.requests_total)
  planEdit.currency = 'RUB'
  planEdit.is_active = String(p.is_active)
}
function cancelEditPlan() {
  planEditId.value = ''
  planEdit.title = ''
  planEdit.price_minor = ''
  planEdit.requests_total = ''
  planEdit.currency = 'RUB'
  planEdit.is_active = ''
}

async function createPlan() {
  const ok = await confirm({
    title: 'Создать тариф?',
    text: planCreate.title,
    yesText: 'Создать',
    noText: 'Отмена',
  })
  if (!ok) return

  busy.value = true
  try {
    await adminApi.billing.createPlan({
      title: planCreate.title,
      price_minor: planCreate.price_minor,
      requests_total: planCreate.requests_total,
      currency: 'RUB',
      is_active: planCreate.is_active,
      is_system: planCreate.is_system,
    })
    infoText.value = 'Тариф создан.'
    planCreate.title = ''
    planCreate.price_minor = 0
    planCreate.requests_total = 100
    planCreate.currency = 'RUB'
    planCreate.is_active = true
    planCreate.is_system = false
    await loadPlans()
  } catch (e) {
    errorText.value = e?.message || 'Не удалось создать тариф'
  } finally {
    busy.value = false
  }
}

async function savePlan() {
  if (!planEditId.value) return

  const ok = await confirm({
    title: 'Сохранить тариф?',
    text: planEdit.title,
    yesText: 'Сохранить',
    noText: 'Отмена',
  })
  if (!ok) return

  busy.value = true
  try {
    await adminApi.billing.updatePlan(planEditId.value, {
      title: planEdit.title,
      price_minor: planEdit.price_minor === '' ? undefined : planEdit.price_minor,
      requests_total: planEdit.requests_total === '' ? undefined : planEdit.requests_total,
      currency: 'RUB',
      is_active: planEdit.is_active === '' ? undefined : planEdit.is_active,
    })
    infoText.value = 'Тариф обновлён.'
    cancelEditPlan()
    await loadPlans()
  } catch (e) {
    errorText.value = e?.message || 'Не удалось обновить тариф'
  } finally {
    busy.value = false
  }
}

async function togglePlan(p) {
  const ok = await confirm({
    title: p.is_active ? 'Деактивировать тариф?' : 'Активировать тариф?',
    text: p.title,
    danger: p.is_active,
    yesText: p.is_active ? 'Деактивировать' : 'Активировать',
    noText: 'Отмена',
  })
  if (!ok) return

  busy.value = true
  try {
    if (p.is_active) await adminApi.billing.deactivatePlan(p.id)
    else await adminApi.billing.activatePlan(p.id)
    await loadPlans()
  } catch (e) {
    errorText.value = e?.message || 'Не удалось изменить статус тарифа'
  } finally {
    busy.value = false
  }
}

// ---- BALANCES
const balances = reactive({ items: [], page: 1, page_size: 10, total: 0, total_pages: 0 })
const balanceEdit = reactive({ user_id: '', requests_amount: 0 })

async function loadBalances() {
  await ensureUserIndex()
  busy.value = true
  try {
    const r = await adminApi.billing.listBalances({ page: balances.page, page_size: balances.page_size })
    balances.items = r?.items || []
    balances.total = Number(r?.total ?? 0)
    balances.total_pages = Number(r?.total_pages ?? 0)
  } finally {
    busy.value = false
  }
}

async function addBalance() {
  const ok = await confirm({
    title: 'Создать баланс пользователю?',
    text: userLabel(balanceEdit.user_id),
    yesText: 'Создать',
    noText: 'Отмена',
  })
  if (!ok) return

  busy.value = true
  try {
    await adminApi.billing.addBalance({ user_id: balanceEdit.user_id, requests_amount: balanceEdit.requests_amount })
    infoText.value = 'Баланс создан.'
    await loadBalances()
  } catch (e) {
    errorText.value = e?.message || 'Не удалось создать баланс'
  } finally {
    busy.value = false
  }
}

async function updBalance() {
  const ok = await confirm({
    title: 'Обновить баланс пользователю?',
    text: userLabel(balanceEdit.user_id),
    danger: true,
    yesText: 'Обновить',
    noText: 'Отмена',
  })
  if (!ok) return

  busy.value = true
  try {
    await adminApi.billing.updBalance({ user_id: balanceEdit.user_id, requests_amount: balanceEdit.requests_amount })
    infoText.value = 'Баланс обновлён.'
    await loadBalances()
  } catch (e) {
    errorText.value = e?.message || 'Не удалось обновить баланс'
  } finally {
    busy.value = false
  }
}

// ---- PAYMENTS
const pay = reactive({ items: [], page: 1, page_size: 10, total: 0, total_pages: 0 })
const paymentLookupId = ref('')
const paymentDetails = ref(null)

async function loadPayments() {
  busy.value = true
  try {
    const r = await adminApi.billing.listPayments({ page: pay.page, page_size: pay.page_size })
    pay.items = r?.items || []
    pay.total = Number(r?.total ?? 0)
    pay.total_pages = Number(r?.total_pages ?? 0)
  } finally {
    busy.value = false
  }
}
async function getPaymentById() {
  if (!paymentLookupId.value.trim()) return
  busy.value = true
  try {
    paymentDetails.value = await adminApi.billing.getPayment(paymentLookupId.value.trim())
  } catch (e) {
    errorText.value = e?.message || 'Не удалось получить платеж'
  } finally {
    busy.value = false
  }
}

// ---- SAMPLES
const samples = ref([])

async function loadSamples() {
  busy.value = true
  try {
    const r = await adminApi.ai.getSamples(1, 10)
    samples.value = Array.isArray(r?.items) ? r.items : []
  } finally {
    busy.value = false
  }
}

async function uploadSamples(e) {
  const files = Array.from(e?.target?.files || [])
  e.target.value = ''
  if (!files.length) return

  const ok = await confirm({
    title: `Загрузить ${files.length} сэмпл(ов)?`,
    text: 'Файлы будут добавлены как неактивные.',
    yesText: 'Загрузить',
    noText: 'Отмена',
  })
  if (!ok) return

  busy.value = true
  try {
    await adminApi.ai.uploadSamples(files)
    infoText.value = 'Сэмплы загружены.'
    await loadSamples()
  } catch (e2) {
    errorText.value = e2?.message || 'Не удалось загрузить сэмплы'
  } finally {
    busy.value = false
  }
}

async function setSampleActive(s, v) {
  const ok = await confirm({
    title: v ? 'Активировать сэмпл?' : 'Деактивировать сэмпл?',
    text: '',
    danger: !v,
    yesText: v ? 'Активировать' : 'Деактивировать',
    noText: 'Отмена',
  })
  if (!ok) return

  busy.value = true
  try {
    await adminApi.ai.updateSample(s.id, v)
    await loadSamples()
  } catch (e) {
    errorText.value = e?.message || 'Не удалось обновить сэмпл'
  } finally {
    busy.value = false
  }
}

async function deleteSample(s) {
  const ok = await confirm({
    title: 'Удалить сэмпл?',
    text: 'Удалится файл и запись в БД. Действие необратимо.',
    danger: true,
    yesText: 'Удалить',
    noText: 'Отмена',
  })
  if (!ok) return

  busy.value = true
  try {
    await adminApi.ai.deleteSample(s.id)
    await loadSamples()
  } catch (e) {
    errorText.value = e?.message || 'Не удалось удалить сэмпл'
  } finally {
    busy.value = false
  }
}

// ---- PROMPTS
const templates = reactive({ items: [], total: 0, limit: 50, offset: 0, is_active: '' })
const tplCreate = reactive({ name: '', template_text: '', is_active: true })
const selectedTemplateId = ref('')
const selectedTemplate = ref(null)
const variants = ref([])
const variantCreate = reactive({ key: '', label: '', sort_order: 0, is_active: true })

async function loadTemplates() {
  busy.value = true
  try {
    const r = await adminApi.ai.listTemplates({
      limit: templates.limit,
      offset: templates.offset,
      is_active: templates.is_active === '' ? undefined : templates.is_active,
    })
    templates.items = r?.items || []
    templates.total = Number(r?.total ?? 0)
  } finally {
    busy.value = false
  }
}

async function createTemplate() {
  const ok = await confirm({
    title: 'Создать шаблон?',
    text: tplCreate.name,
    yesText: 'Создать',
    noText: 'Отмена',
  })
  if (!ok) return

  busy.value = true
  try {
    await adminApi.ai.createTemplate({
      name: tplCreate.name,
      template_text: tplCreate.template_text,
      is_active: tplCreate.is_active,
    })
    tplCreate.name = ''
    tplCreate.template_text = ''
    tplCreate.is_active = true
    await loadTemplates()
  } catch (e) {
    errorText.value = e?.message || 'Не удалось создать шаблон'
  } finally {
    busy.value = false
  }
}

async function openTemplate(t) {
  selectedTemplateId.value = t.id
  busy.value = true
  try {
    selectedTemplate.value = await adminApi.ai.getTemplate(t.id)
    variants.value = selectedTemplate.value?.variants || []
  } finally {
    busy.value = false
  }
}

async function saveTemplate() {
  if (!selectedTemplateId.value) return

  const ok = await confirm({
    title: 'Сохранить шаблон?',
    text: selectedTemplate.value?.name || '',
    yesText: 'Сохранить',
    noText: 'Отмена',
  })
  if (!ok) return

  busy.value = true
  try {
    await adminApi.ai.updateTemplate(selectedTemplateId.value, {
      name: selectedTemplate.value?.name,
      template_text: selectedTemplate.value?.template_text,
      is_active: selectedTemplate.value?.is_active,
    })
    await loadTemplates()
  } catch (e) {
    errorText.value = e?.message || 'Не удалось обновить шаблон'
  } finally {
    busy.value = false
  }
}

async function deleteTemplate() {
  if (!selectedTemplateId.value) return

  const ok = await confirm({
    title: 'Удалить шаблон?',
    text: 'Удалятся и все варианты (cascade). Действие необратимо.',
    danger: true,
    yesText: 'Удалить',
    noText: 'Отмена',
  })
  if (!ok) return

  busy.value = true
  try {
    await adminApi.ai.deleteTemplate(selectedTemplateId.value)
    selectedTemplateId.value = ''
    selectedTemplate.value = null
    variants.value = []
    await loadTemplates()
  } catch (e) {
    errorText.value = e?.message || 'Не удалось удалить шаблон'
  } finally {
    busy.value = false
  }
}

async function createVariant() {
  if (!selectedTemplateId.value) return

  const ok = await confirm({
    title: 'Создать вариант?',
    text: `${variantCreate.key}`,
    yesText: 'Создать',
    noText: 'Отмена',
  })
  if (!ok) return

  busy.value = true
  try {
    await adminApi.ai.createVariant(selectedTemplateId.value, variantCreate)
    variantCreate.key = ''
    variantCreate.label = ''
    variantCreate.sort_order = 0
    variantCreate.is_active = true
    selectedTemplate.value = await adminApi.ai.getTemplate(selectedTemplateId.value)
    variants.value = selectedTemplate.value?.variants || []
  } catch (e) {
    errorText.value = e?.message || 'Не удалось создать вариант'
  } finally {
    busy.value = false
  }
}

async function toggleVariant(v) {
  const ok = await confirm({
    title: v.is_active ? 'Деактивировать вариант?' : 'Активировать вариант?',
    text: v.key,
    danger: v.is_active,
    yesText: v.is_active ? 'Деактивировать' : 'Активировать',
    noText: 'Отмена',
  })
  if (!ok) return

  busy.value = true
  try {
    await adminApi.ai.updateVariant(v.id, { is_active: !v.is_active })
    selectedTemplate.value = await adminApi.ai.getTemplate(selectedTemplateId.value)
    variants.value = selectedTemplate.value?.variants || []
  } catch (e) {
    errorText.value = e?.message || 'Не удалось обновить вариант'
  } finally {
    busy.value = false
  }
}

async function deleteVariant(v) {
  const ok = await confirm({
    title: 'Удалить вариант?',
    text: v.key,
    danger: true,
    yesText: 'Удалить',
    noText: 'Отмена',
  })
  if (!ok) return

  busy.value = true
  try {
    await adminApi.ai.deleteVariant(v.id)
    selectedTemplate.value = await adminApi.ai.getTemplate(selectedTemplateId.value)
    variants.value = selectedTemplate.value?.variants || []
  } catch (e) {
    errorText.value = e?.message || 'Не удалось удалить вариант'
  } finally {
    busy.value = false
  }
}

// ---- BATCHES
const batches = reactive({ items: [], total: 0, limit: 50, offset: 0, status: '' })
const batchDetails = ref(null)

async function loadBatches() {
  await ensureUserIndex()
  busy.value = true
  try {
    const r = await adminApi.ai.listBatches({
      limit: batches.limit,
      offset: batches.offset,
      status: batches.status || undefined,
    })
    batches.items = r?.items || []
    batches.total = Number(r?.total ?? 0)
  } finally {
    busy.value = false
  }
}

async function openBatch(b) {
  busy.value = true
  try {
    batchDetails.value = await adminApi.ai.getBatch(b.batch_id, true)
  } finally {
    busy.value = false
  }
}

async function loadCurrent() {
  errorText.value = ''
  infoText.value = ''
  try {
    if (tab.value === 'users') return await loadUsers()
    if (tab.value === 'plans') return await loadPlans()
    if (tab.value === 'balances') return await loadBalances()
    if (tab.value === 'payments') return await loadPayments()
    if (tab.value === 'samples') return await loadSamples()
    if (tab.value === 'prompts') return await loadTemplates()
    if (tab.value === 'batches') return await loadBatches()
  } catch (e) {
    errorText.value = e?.message || 'Ошибка загрузки'
  }
}

onMounted(async () => {
  if (!auth.state.accessToken) {
    await router.replace({ name: 'login' })
    return
  }

  if (!auth.state.user) {
    try {
      const me = await accountApi.me()
      if (typeof auth.setUser === 'function') auth.setUser(me)
      else auth.state.user = me
    } catch {}
  }

  if (!isAdmin.value) {
    await router.replace({ name: 'home' })
    return
  }

  await ensureUserIndex()
  await loadCurrent()
})
</script>

<template>
  <div class="page">
    <div class="wrap">
      <aside class="menu">
        <div class="mh-row">
          <div class="mh">Меню</div>
          <button
            class="icon-refresh"
            type="button"
            @click="loadCurrent"
            :disabled="busy"
            title="Обновить"
            aria-label="Обновить"
          >
            ↻
          </button>
        </div>

        <button
          v-for="t in tabs"
          :key="t.k"
          class="mitem"
          :class="{ active: tab === t.k }"
          type="button"
          @click="setTab(t.k)"
        >
          {{ t.label }}
        </button>
      </aside>

      <main class="content">
        <!-- USERS -->
        <div v-if="tab==='users'" class="card">
          <div class="card-title">Пользователи</div>

          <div class="subcard">
            <div class="subttl">Поиск</div>

            <input class="inp" v-model="users.search" placeholder="Поиск email" />

            <div class="filters-row">
              <select class="inp" v-model="users.role">
                <option value="">Роль: все</option>
                <option value="user">Пользователь</option>
                <option value="admin">Администратор</option>
              </select>

              <select class="inp" v-model="users.is_active">
                <option value="">Активен: все</option>
                <option value="true">Да</option>
                <option value="false">Нет</option>
              </select>

              <select class="inp" v-model="users.email_verified">
                <option value="">Email подтверждён: все</option>
                <option value="true">Да</option>
                <option value="false">Нет</option>
              </select>
            </div>

            <div class="row-actions">
              <button class="btn" type="button" @click="loadUsers" :disabled="busy">Применить</button>
            </div>
          </div>

          <div class="subcard">
            <div class="subttl">Создать пользователя</div>
            <div class="grid2">
              <div class="field">
                <div class="flabel">Email</div>
                <input class="inp" v-model="userCreate.email" placeholder="email" />
              </div>

              <div class="field">
                <div class="flabel">Пароль</div>
                <input class="inp" v-model="userCreate.password" placeholder="Пароль" />
              </div>

              <div class="field">
                <div class="flabel">Роль</div>
                <select class="inp" v-model="userCreate.role">
                  <option value="user">Пользователь</option>
                  <option value="admin">Администратор</option>
                </select>
              </div>

              <div class="field">
                <div class="flabel">Активен</div>
                <select class="inp" v-model="userCreate.is_active">
                  <option :value="true">Да</option>
                  <option :value="false">Нет</option>
                </select>
              </div>

              <div class="field">
                <div class="flabel">Email подтверждён</div>
                <select class="inp" v-model="userCreate.email_verified">
                  <option :value="false">Нет</option>
                  <option :value="true">Да</option>
                </select>
              </div>
            </div>
            <button class="btn primary" type="button" @click="createUser" :disabled="busy">Создать</button>
          </div>

          <div class="table t-users">
            <div class="tr head">
              <div>Email</div><div>Роль</div><div>Активен</div><div>Подтв.</div><div>ID</div><div>Действия</div>
            </div>

            <div v-for="u in users.items" :key="u.id" class="tr">
              <div class="clip">{{ u.email }}</div>
              <div class="clip">{{ roleRu(u.role) }}</div>
              <div>{{ yesNo(u.is_active) }}</div>
              <div>{{ yesNo(u.email_verified) }}</div>
              <div class="mono">{{ u.id }}</div>
              <div class="actions">
                <button class="mini" type="button" @click="startEditUser(u)">Редакт.</button>
                <button class="mini" type="button" @click="logoutAllUser(u.id)">Сессии</button>
                <button class="mini danger" type="button" @click="deactivateUser(u.id)">Отключить</button>
              </div>
            </div>
          </div>

          <div v-if="userEditId" class="subcard">
            <div class="subttl">Редактирование пользователя</div>
            <div class="grid2">
              <div class="field">
                <div class="flabel">Email</div>
                <input class="inp" v-model="userEdit.email" placeholder="email" />
              </div>

              <div class="field">
                <div class="flabel">Новый пароль</div>
                <input class="inp" v-model="userEdit.password" placeholder="Новый пароль (необязательно)" />
              </div>

              <div class="field">
                <div class="flabel">Роль</div>
                <select class="inp" v-model="userEdit.role">
                  <option value="user">Пользователь</option>
                  <option value="admin">Администратор</option>
                </select>
              </div>

              <div class="field">
                <div class="flabel">Активен</div>
                <select class="inp" v-model="userEdit.is_active">
                  <option value="true">Да</option>
                  <option value="false">Нет</option>
                </select>
              </div>

              <div class="field">
                <div class="flabel">Email подтверждён</div>
                <select class="inp" v-model="userEdit.email_verified">
                  <option value="true">Да</option>
                  <option value="false">Нет</option>
                </select>
              </div>
            </div>
            <div class="row-actions">
              <button class="btn" type="button" @click="cancelEditUser" :disabled="busy">Отмена</button>
              <button class="btn primary" type="button" @click="saveUser" :disabled="busy">Сохранить</button>
            </div>
          </div>
        </div>

        <!-- PLANS -->
        <div v-else-if="tab==='plans'" class="card">
          <div class="card-title">Тарифы</div>

          <div class="subcard">
            <div class="subttl">Создать тариф</div>
            <div class="grid2">
              <div class="field">
                <div class="flabel">Название</div>
                <input class="inp" v-model="planCreate.title" placeholder="Название тарифа" />
              </div>

              <div class="field">
                <div class="flabel">Запросов (токены)</div>
                <input class="inp" type="number" v-model.number="planCreate.requests_total" placeholder="Напр. 100" />
              </div>

              <div class="field">
                <div class="flabel">Цена (RUB)</div>
                <input class="inp" type="number" v-model.number="planCreate.price_minor" placeholder="Напр. 999" />
              </div>

              <div class="field">
                <div class="flabel">Активен</div>
                <select class="inp" v-model="planCreate.is_active">
                  <option :value="true">Да</option>
                  <option :value="false">Нет</option>
                </select>
              </div>

              <div class="field">
                <div class="flabel">Системный</div>
                <select class="inp" v-model="planCreate.is_system">
                  <option :value="false">Нет</option>
                  <option :value="true">Да</option>
                </select>
              </div>
            </div>
            <button class="btn primary" type="button" @click="createPlan" :disabled="busy">Создать</button>
          </div>

          <div class="table t-plans">
            <div class="tr head">
              <div>Название</div><div>Запр.</div><div>Цена</div><div>Активен</div><div>Системный</div><div>Покупаемый</div><div>ID</div><div>Действия</div>
            </div>
            <div v-for="p in plans" :key="p.id" class="tr">
              <div class="clip">{{ p.title }}</div>
              <div>{{ p.requests_total }}</div>
              <div>{{ p.price_minor }} RUB</div>
              <div>{{ yesNo(p.is_active) }}</div>
              <div>{{ yesNo(p.is_system) }}</div>
              <div>{{ yesNo(p.is_purchasable) }}</div>
              <div class="mono">{{ p.id }}</div>
              <div class="actions">
                <button class="mini" type="button" @click="startEditPlan(p)">Редакт.</button>
                <button class="mini" type="button" @click="togglePlan(p)">{{ p.is_active ? 'Отключить' : 'Включить' }}</button>
              </div>
            </div>
          </div>

          <div v-if="planEditId" class="subcard">
            <div class="subttl">Редактирование тарифа</div>
            <div class="grid2">
              <div class="field">
                <div class="flabel">Название</div>
                <input class="inp" v-model="planEdit.title" placeholder="Название тарифа" />
              </div>

              <div class="field">
                <div class="flabel">Запросов (токены)</div>
                <input class="inp" v-model="planEdit.requests_total" placeholder="Напр. 100" />
              </div>

              <div class="field">
                <div class="flabel">Цена (RUB)</div>
                <input class="inp" v-model="planEdit.price_minor" placeholder="Напр. 999" />
              </div>

              <div class="field">
                <div class="flabel">Активен</div>
                <select class="inp" v-model="planEdit.is_active">
                  <option value="true">Да</option>
                  <option value="false">Нет</option>
                </select>
              </div>
            </div>
            <div class="row-actions">
              <button class="btn" type="button" @click="cancelEditPlan" :disabled="busy">Отмена</button>
              <button class="btn primary" type="button" @click="savePlan" :disabled="busy">Сохранить</button>
            </div>
          </div>
        </div>

        <!-- BALANCES -->
        <div v-else-if="tab==='balances'" class="card">
          <div class="card-title">Балансы</div>

          <div class="subcard">
            <div class="subttl">Создать / обновить баланс</div>
            <div class="grid2">
              <div class="field">
                <div class="flabel">Пользователь (email)</div>
                <select class="inp" v-model="balanceEdit.user_id">
                  <option value="">Выберите пользователя</option>
                  <option v-for="u in userSelectItems" :key="u.id" :value="u.id">{{ u.email }}</option>
                </select>
              </div>

              <div class="field">
                <div class="flabel">Количество запросов</div>
                <input class="inp" type="number" v-model.number="balanceEdit.requests_amount" placeholder="Напр. 100" />
              </div>
            </div>
            <div class="row-actions">
              <button class="btn" type="button" @click="addBalance" :disabled="busy || !balanceEdit.user_id">Создать</button>
              <button class="btn danger" type="button" @click="updBalance" :disabled="busy || !balanceEdit.user_id">Обновить</button>
              <button class="btn" type="button" @click="loadBalances" :disabled="busy">Обновить список</button>
            </div>
          </div>

          <div class="table t-balances">
            <div class="tr head">
              <div>Пользователь</div><div>Запросов</div><div>Обновлён</div>
            </div>
            <div v-for="b in balances.items" :key="b.user_id" class="tr">
              <div class="clip">{{ userLabel(b.user_id) }}</div>
              <div>{{ b.requests_left }}</div>
              <div class="mono">{{ formatMsk(b.updated_at) }}</div>
            </div>
          </div>
        </div>

        <!-- PAYMENTS -->
        <div v-else-if="tab==='payments'" class="card">
          <div class="card-title">Платежи</div>

          <div class="subcard">
            <div class="subttl">Поиск по ID</div>
            <div class="grid2">
              <div class="field">
                <div class="flabel">Payment ID</div>
                <input class="inp" v-model="paymentLookupId" placeholder="payment_id" />
              </div>
              <div class="field">
                <div class="flabel">&nbsp;</div>
                <button class="btn" type="button" @click="getPaymentById" :disabled="busy">Найти</button>
              </div>
            </div>
            <pre v-if="paymentDetails" class="pre">{{ paymentDetails }}</pre>
          </div>

          <div class="row-actions">
            <button class="btn" type="button" @click="loadPayments" :disabled="busy">Обновить список</button>
          </div>

          <div class="table t-payments">
            <div class="tr head">
              <div>ID</div><div>Статус</div><div>Сумма</div><div>Создан</div>
            </div>
            <div v-for="p in pay.items" :key="p.id" class="tr">
              <div class="mono">{{ p.id }}</div>
              <div class="clip">{{ p.status }}</div>
              <div>{{ p.amount_minor }} {{ p.currency }}</div>
              <div class="mono">{{ formatMsk(p.created_at) }}</div>
            </div>
          </div>
        </div>

        <!-- SAMPLES -->
        <div v-else-if="tab==='samples'" class="card">
          <div class="card-title">Сэмплы</div>

          <div class="row-actions">
            <input class="file" type="file" multiple accept="image/jpeg,image/png,image/webp" @change="uploadSamples" />
            <button class="btn" type="button" @click="loadSamples" :disabled="busy">Обновить</button>
          </div>

          <div class="samples">
            <div v-for="s in samples" :key="s.id" class="sample">
              <img :src="s.url" alt="sample" />
              <div class="meta">
                <div class="status">{{ s.is_active ? 'Активен' : 'Неактивен' }}</div>
                <div class="minirow">
                  <button class="mini" :class="{ active: !!s.is_active }" type="button" @click="setSampleActive(s, true)" :disabled="busy">
                    Вкл
                  </button>
                  <button class="mini" :class="{ active: !s.is_active }" type="button" @click="setSampleActive(s, false)" :disabled="busy">
                    Выкл
                  </button>
                  <button class="mini danger" type="button" @click="deleteSample(s)" :disabled="busy">Удалить</button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- PROMPTS -->
        <div v-else-if="tab==='prompts'" class="card">
          <div class="card-title">Промпты</div>

          <div class="subcard">
            <div class="subttl">Создать шаблон</div>
            <div class="grid2">
              <div class="field">
                <div class="flabel">Название (уникальное)</div>
                <input class="inp" v-model="tplCreate.name" placeholder="Название" />
              </div>

              <div class="field">
                <div class="flabel">Активен</div>
                <select class="inp" v-model="tplCreate.is_active">
                  <option :value="true">Да</option>
                  <option :value="false">Нет</option>
                </select>
              </div>
            </div>
            <div class="field" style="margin-top:10px;">
              <div class="flabel">Текст шаблона</div>
              <textarea class="ta" rows="4" v-model="tplCreate.template_text" placeholder="Текст шаблона" />
            </div>
            <button class="btn primary" type="button" @click="createTemplate" :disabled="busy">Создать</button>
          </div>

          <div class="table t-templates">
            <div class="tr head">
              <div>Название</div><div>Активен</div><div>Вариантов</div><div>ID</div><div>Действия</div>
            </div>
            <div v-for="t in templates.items" :key="t.id" class="tr">
              <div class="clip">{{ t.name }}</div>
              <div>{{ yesNo(t.is_active) }}</div>
              <div>{{ t.variants_count }}</div>
              <div class="mono">{{ t.id }}</div>
              <div class="actions">
                <button class="mini" type="button" @click="openTemplate(t)">Открыть</button>
              </div>
            </div>
          </div>

          <div v-if="selectedTemplateId" class="subcard">
            <div class="subttl">Шаблон</div>

            <div class="grid2">
              <div class="field">
                <div class="flabel">Название</div>
                <input class="inp" v-model="selectedTemplate.name" placeholder="Название" />
              </div>
              <div class="field">
                <div class="flabel">Активен</div>
                <select class="inp" v-model="selectedTemplate.is_active">
                  <option :value="true">Да</option>
                  <option :value="false">Нет</option>
                </select>
              </div>
            </div>

            <div class="field" style="margin-top:10px;">
              <div class="flabel">Текст шаблона</div>
              <textarea class="ta" rows="4" v-model="selectedTemplate.template_text" placeholder="Текст шаблона" />
            </div>

            <div class="row-actions">
              <button class="btn primary" type="button" @click="saveTemplate" :disabled="busy">Сохранить</button>
              <button class="btn danger" type="button" @click="deleteTemplate" :disabled="busy">Удалить</button>
            </div>

            <div class="subttl" style="margin-top:12px;">Варианты</div>

            <div class="grid2">
              <div class="field">
                <div class="flabel">Ключ</div>
                <input class="inp" v-model="variantCreate.key" placeholder="Ключ" />
              </div>
              <div class="field">
                <div class="flabel">Название</div>
                <input class="inp" v-model="variantCreate.label" placeholder="Название" />
              </div>
              <div class="field">
                <div class="flabel">Порядок</div>
                <input class="inp" type="number" v-model.number="variantCreate.sort_order" placeholder="Порядок" />
              </div>
              <div class="field">
                <div class="flabel">Активен</div>
                <select class="inp" v-model="variantCreate.is_active">
                  <option :value="true">Да</option>
                  <option :value="false">Нет</option>
                </select>
              </div>
            </div>
            <button class="btn" type="button" @click="createVariant" :disabled="busy">Добавить вариант</button>

            <div class="table t-variants" style="margin-top:10px;">
              <div class="tr head">
                <div>Ключ</div><div>Название</div><div>Порядок</div><div>Активен</div><div>ID</div><div>Действия</div>
              </div>
              <div v-for="v in variants" :key="v.id" class="tr">
                <div class="clip">{{ v.key }}</div>
                <div class="clip">{{ v.label }}</div>
                <div>{{ v.sort_order }}</div>
                <div>{{ yesNo(v.is_active) }}</div>
                <div class="mono">{{ v.id }}</div>
                <div class="actions">
                  <button class="mini" type="button" @click="toggleVariant(v)" :disabled="busy">{{ v.is_active ? 'Отключить' : 'Включить' }}</button>
                  <button class="mini danger" type="button" @click="deleteVariant(v)" :disabled="busy">Удалить</button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- BATCHES -->
        <div v-else-if="tab==='batches'" class="card">
          <div class="card-title">Пакеты</div>

          <div class="grid2">
            <div class="field">
              <div class="flabel">Статус (необязательно)</div>
              <input class="inp" v-model="batches.status" placeholder="Напр. completed" />
            </div>
            <div class="field">
              <div class="flabel">&nbsp;</div>
              <button class="btn" type="button" @click="loadBatches" :disabled="busy">Обновить</button>
            </div>
          </div>

          <div class="table t-batches" style="margin-top:10px;">
            <div class="tr head">
              <div>Статус</div><div>Всего</div><div>Готово</div><div>Пользователь</div><div>Batch</div><div>Действия</div>
            </div>
            <div v-for="b in batches.items" :key="b.batch_id" class="tr">
              <div class="clip">{{ b.status }}</div>
              <div>{{ b.total }}</div>
              <div>{{ b.processed }}</div>
              <div class="clip">{{ userLabel(b.user_id) }}</div>
              <div class="mono">{{ b.batch_id }}</div>
              <div class="actions">
                <button class="mini" type="button" @click="openBatch(b)">Открыть</button>
              </div>
            </div>
          </div>

          <div v-if="batchDetails" class="subcard" style="margin-top:12px;">
            <div class="subttl">Детали</div>
            <pre class="pre">{{ batchDetails }}</pre>
          </div>
        </div>

        <div v-if="errorText" class="alert error">{{ errorText }}</div>
        <div v-else-if="infoText" class="alert ok">{{ infoText }}</div>
      </main>
    </div>
  </div>
</template>

<style scoped>
.page{
  width: 100%;
  display:flex;
  overflow-x: hidden;
}
.wrap{
  width: 100%;
  max-width: 1100px;
  margin: 0 auto;
  padding: 18px;
  box-sizing: border-box;
  display: flex;
  gap: 12px;
  min-width: 0;
}

.menu{
  flex: 0 0 220px;
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 16px;
  padding: 12px;
  height: fit-content;
}
.mh-row{
  display:flex;
  align-items:center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 10px;
}
.mh{ font-weight: 950; }
.icon-refresh{
  border: 1px solid var(--border);
  background: var(--card2);
  color: var(--text);
  border-radius: 12px;
  width: 40px;
  height: 34px;
  display:grid;
  place-items:center;
  cursor:pointer;
  font-weight: 950;
}
.icon-refresh:disabled{ opacity:.6; cursor: not-allowed; }

.mitem{
  width: 100%;
  text-align: left;
  border: 1px solid var(--border);
  background: var(--card2);
  color: var(--text);
  border-radius: 12px;
  padding: 9px 10px;
  cursor: pointer;
  font-weight: 900;
  font-size: 12px;
  margin-bottom: 8px;
}
.mitem.active{
  border-color: var(--primary);
  box-shadow: var(--primary);
}

.content{
  flex: 1;
  min-width: 0;
  display:flex;
  flex-direction: column;
}

.card{
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 16px;
  padding: 14px;
}
.card-title{ font-weight: 950; margin-bottom: 10px; }

.subcard{
  margin-top: 12px;
  border: 1px solid var(--border);
  background: var(--card2);
  border-radius: 14px;
  padding: 12px;
}
.subttl{ font-weight: 950; margin-bottom: 8px; font-size: 12px; color: var(--theadText); }

.grid2{
  display:grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  align-items: end;
}
.filters-row{
  margin-top: 10px;
  display:grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}

.field{
  display:flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}
.flabel{
  font-weight: 900;
  font-size: 12px;
  color: var(--theadText);
  opacity: .95;
}

.row-actions{ margin-top: 10px; display:flex; gap:10px; flex-wrap: wrap; }

.inp, .ta{
  width: 100%;
  box-sizing: border-box;
  border: 1px solid var(--border);
  background: var(--card);
  color: var(--text);
  border-radius: 12px;
  padding: 10px 12px;
  font-size: 13px;
  min-width: 0;
}
.ta{ resize: vertical; }

.btn{
  border: 1px solid var(--border);
  background: var(--card);
  color: var(--text);
  border-radius: 12px;
  padding: 10px 12px;
  cursor: pointer;
  font-weight: 900;
  font-size: 12px;
}
.btn.primary{ background: var(--primary); border-color: var(--primary); color: var(--primaryText); }
.btn.danger{ background: var(--dangerBg); border-color: var(--dangerBorder); color: var(--dangerText); }

/* TABLES */
.table{
  display:grid;
  gap:6px;
  margin-top: 12px;
  min-width: 0;
}
.tr{
  display:grid;
  gap: 10px;
  padding: 10px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--card);
  align-items:center;
  min-width: 0;
}
.tr > div{ min-width: 0; } /* ключевой фикс: иначе grid-item раздувает колонки */
.tr.head{
  background: var(--theadBg);
  font-weight: 950;
  font-size: 12px;
  color: var(--theadText);
}
.tr.head > div{
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* более “жидкие” колонки, чтобы не вылезать за карточку */
.t-users .tr{ grid-template-columns: minmax(0,1.4fr) minmax(0,.8fr) minmax(0,.5fr) minmax(0,.55fr) minmax(0,1.2fr) minmax(0,220px); }
.t-plans .tr{ grid-template-columns: minmax(0,1.35fr) minmax(0,.55fr) minmax(0,.7fr) minmax(0,.58fr) minmax(0,.72fr) minmax(0,.78fr) minmax(0,1.1fr) minmax(0,210px); }
.t-balances .tr{ grid-template-columns: minmax(0,1.6fr) minmax(0,.6fr) minmax(0,240px); }
.t-payments .tr{ grid-template-columns: minmax(0,1.2fr) minmax(0,.7fr) minmax(0,.8fr) minmax(0,240px); }
.t-templates .tr{ grid-template-columns: minmax(0,1.6fr) minmax(0,.7fr) minmax(0,.7fr) minmax(0,1.2fr) minmax(0,170px); }
.t-variants .tr{ grid-template-columns: minmax(0,.9fr) minmax(0,1.4fr) minmax(0,.6fr) minmax(0,.65fr) minmax(0,1.2fr) minmax(0,220px); }
.t-batches .tr{ grid-template-columns: minmax(0,.9fr) minmax(0,.55fr) minmax(0,.55fr) minmax(0,1.3fr) minmax(0,1.2fr) minmax(0,160px); }

.actions{
  display:flex;
  justify-content:flex-end;
  gap:8px;
  flex-wrap: wrap; /* фикс: чтобы кнопки не раздували колонку и не “вылезали” */
}
.mini{
  border: 1px solid var(--border);
  background: var(--card2);
  color: var(--text);
  border-radius: 10px;
  padding: 6px 8px;
  cursor:pointer;
  font-weight: 900;
  font-size: 11px;
  white-space: nowrap;
}
.mini.active{
  border-color: var(--primary);
  box-shadow: var(--primary);
}
.mini.danger{ background: var(--dangerBg); border-color: var(--dangerBorder); color: var(--dangerText); }

.mono{
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 12px;
  overflow-wrap:anywhere; /* фикс: UUID не распирает колонку */
  word-break: break-word;
}

.clip{
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.alert{ margin-top: 10px; padding: 10px 12px; border-radius: 14px; border: 1px solid; font-size: 13px; font-weight: 800; }
.alert.error { background: var(--dangerBg); border-color: var(--dangerBorder); color: var(--dangerText); }
.alert.ok { background: var(--successBg); border-color: var(--successBorder); color: var(--successText); }

/* Samples */
.samples{
  margin-top: 12px;
  display:grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}
.sample{
  border: 1px solid var(--border);
  background: var(--card2);
  border-radius: 14px;
  overflow:hidden;
}
.sample img{
  width:100%;
  height: 180px;
  object-fit: cover;
  display:block;
}
.meta{ padding: 10px; display:flex; flex-direction:column; gap:8px; }
.status{ font-weight: 900; font-size: 12px; color: var(--muted); }
.minirow{ display:flex; gap:8px; flex-wrap: wrap; }

.pre{
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
  font-size: 12px;
  color: var(--text);
}

/* MOBILE: делаем “ключ: значение”, чтобы было понятно что к чему */
@media (max-width: 980px) {
  .wrap{ flex-direction: column; }
  .menu{ flex: 0 0 auto; }
  .grid2{ grid-template-columns: 1fr; }
  .filters-row{ grid-template-columns: 1fr; }
  .samples{ grid-template-columns: 1fr; }

  .tr{ grid-template-columns: 1fr !important; }
  .tr.head{ display:none; }

  .table .tr > div{
    display:flex;
    justify-content: space-between;
    gap: 12px;
    align-items: baseline;
  }
  .table .tr > div::before{
    font-weight: 900;
    font-size: 12px;
    color: var(--theadText);
    opacity: .9;
  }
  .actions{
    justify-content:flex-start;
    align-items:flex-start;
  }

  /* USERS labels */
  .t-users .tr > div:nth-child(1)::before{ content: 'Email'; }
  .t-users .tr > div:nth-child(2)::before{ content: 'Роль'; }
  .t-users .tr > div:nth-child(3)::before{ content: 'Активен'; }
  .t-users .tr > div:nth-child(4)::before{ content: 'Подтв.'; }
  .t-users .tr > div:nth-child(5)::before{ content: 'ID'; }
  .t-users .tr > div:nth-child(6)::before{ content: 'Действия'; }

  /* PLANS labels */
  .t-plans .tr > div:nth-child(1)::before{ content: 'Название'; }
  .t-plans .tr > div:nth-child(2)::before{ content: 'Запросов'; }
  .t-plans .tr > div:nth-child(3)::before{ content: 'Цена'; }
  .t-plans .tr > div:nth-child(4)::before{ content: 'Активен'; }
  .t-plans .tr > div:nth-child(5)::before{ content: 'Системный'; }
  .t-plans .tr > div:nth-child(6)::before{ content: 'Покупаемый'; }
  .t-plans .tr > div:nth-child(7)::before{ content: 'ID'; }
  .t-plans .tr > div:nth-child(8)::before{ content: 'Действия'; }

  /* BALANCES labels */
  .t-balances .tr > div:nth-child(1)::before{ content: 'Пользователь'; }
  .t-balances .tr > div:nth-child(2)::before{ content: 'Запросов'; }
  .t-balances .tr > div:nth-child(3)::before{ content: 'Обновлён'; }

  /* PAYMENTS labels */
  .t-payments .tr > div:nth-child(1)::before{ content: 'ID'; }
  .t-payments .tr > div:nth-child(2)::before{ content: 'Статус'; }
  .t-payments .tr > div:nth-child(3)::before{ content: 'Сумма'; }
  .t-payments .tr > div:nth-child(4)::before{ content: 'Создан'; }

  /* TEMPLATES labels */
  .t-templates .tr > div:nth-child(1)::before{ content: 'Название'; }
  .t-templates .tr > div:nth-child(2)::before{ content: 'Активен'; }
  .t-templates .tr > div:nth-child(3)::before{ content: 'Вариантов'; }
  .t-templates .tr > div:nth-child(4)::before{ content: 'ID'; }
  .t-templates .tr > div:nth-child(5)::before{ content: 'Действия'; }

  /* VARIANTS labels */
  .t-variants .tr > div:nth-child(1)::before{ content: 'Ключ'; }
  .t-variants .tr > div:nth-child(2)::before{ content: 'Название'; }
  .t-variants .tr > div:nth-child(3)::before{ content: 'Порядок'; }
  .t-variants .tr > div:nth-child(4)::before{ content: 'Активен'; }
  .t-variants .tr > div:nth-child(5)::before{ content: 'ID'; }
  .t-variants .tr > div:nth-child(6)::before{ content: 'Действия'; }

  /* BATCHES labels */
  .t-batches .tr > div:nth-child(1)::before{ content: 'Статус'; }
  .t-batches .tr > div:nth-child(2)::before{ content: 'Всего'; }
  .t-batches .tr > div:nth-child(3)::before{ content: 'Готово'; }
  .t-batches .tr > div:nth-child(4)::before{ content: 'Пользователь'; }
  .t-batches .tr > div:nth-child(5)::before{ content: 'Batch'; }
  .t-batches .tr > div:nth-child(6)::before{ content: 'Действия'; }
}
</style>