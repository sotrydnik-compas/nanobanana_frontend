<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { billingApi } from '../../api/billing'
import { auth } from '../../stores/auth'
import { confirm } from '../../utils/confirm'

const props = defineProps({
  user: { type: Object, default: null },
})

const emit = defineEmits(['logout'])

auth.init()
const router = useRouter()
const route = useRoute()

const isAuthed = computed(() => !!auth.state.accessToken)
const email = computed(() => props.user?.email || 'Аккаунт')
const isHome = computed(() => route.name === 'home')
const isChat = computed(() => route.name === 'chat')
const isAccount = computed(() => route.name === 'account')
const isPayments = computed(() => route.name === 'payments')
const isAdmin = computed(() => route.name === 'admin')

const burgerMode = computed(() =>
  isHome.value || isChat.value || isAccount.value || isPayments.value || isAdmin.value
)

const requestsLeft = ref(null)
const balanceBusy = ref(false)
let balanceTimer = null
const zeroBalanceOfferSeen = ref(false)
const zeroBalanceOfferVisible = ref(false)

const menuOpen = ref(false)

const showZeroBalanceOffer = computed(() =>
  zeroBalanceOfferVisible.value &&
  isAuthed.value &&
  requestsLeft.value === 0 &&
  !isPayments.value
)

function closeMenu() {
  menuOpen.value = false
}
function toggleMenu() {
  menuOpen.value = !menuOpen.value
}

async function loadBalanceSafe() {
  if (!isAuthed.value) return
  if (balanceBusy.value) return
  balanceBusy.value = true
  try {
    const b = await billingApi.myBalance()
    requestsLeft.value = Number(b?.requests_left ?? 0)
  } catch {
    // не валим UI
  } finally {
    balanceBusy.value = false
  }
}

function startBalancePolling() {
  stopBalancePolling()
  balanceTimer = setInterval(() => loadBalanceSafe(), 30000)
}

function stopBalancePolling() {
  if (balanceTimer) {
    clearInterval(balanceTimer)
    balanceTimer = null
  }
}

async function goHome() {
  closeMenu()
  await router.push({ name: 'home' })
}

async function goChat() {
  closeMenu()
  await router.push({ name: 'chat' })
}

async function goLogin() {
  await router.push({ name: 'login' })
}

async function goRegister() {
  await router.push({ name: 'register' })
}

async function goPayments() {
  closeMenu()
  await router.push({ name: 'payments' })
}

async function goPaymentsFromZeroBalanceOffer() {
  zeroBalanceOfferVisible.value = false
  closeMenu()
  await router.push({ name: 'payments' })
}

async function goAccount() {
  closeMenu()
  await router.push({ name: 'account' })
}

async function goAdmin() {
  closeMenu()
  await router.push({ name: 'admin' })
}

async function goSection(hash) {
  closeMenu()
  await router.push({ name: 'home', hash })
}

async function clickLogout() {
  closeMenu()
  const ok = await confirm({
    title: 'Выйти из аккаунта?',
    text: 'Вы будете перенаправлены на страницу входа.',
    yesText: 'Выйти',
    noText: 'Отмена',
  })
  if (!ok) return
  emit('logout')
}

function onKeyDown(e) {
  if (e.key === 'Escape') closeMenu()
}

onMounted(async () => {
  window.addEventListener('keydown', onKeyDown)

  if (isAuthed.value) {
    await loadBalanceSafe()
    startBalancePolling()
  }
})

watch(isAuthed, async (v) => {
  if (v) {
    await loadBalanceSafe()
    startBalancePolling()
  } else {
    requestsLeft.value = null
    zeroBalanceOfferSeen.value = false
    zeroBalanceOfferVisible.value = false
    stopBalancePolling()
  }
})

watch(
  () => route.fullPath,
  () => closeMenu()
)

watch(
  () => route.name,
  async (name) => {
    if (isAuthed.value && (name === 'payments' || name === 'chat')) {
      await loadBalanceSafe()
    }

    if (name === 'payments') {
      zeroBalanceOfferVisible.value = false
    }
  }
)

watch(
  [isAuthed, requestsLeft, isPayments],
  ([authed, balance, onPayments]) => {
    if (!authed) return
    if (balance == null) return

    if (Number(balance) > 0) {
      zeroBalanceOfferVisible.value = false
      return
    }

    if (Number(balance) === 0 && !onPayments && !zeroBalanceOfferSeen.value) {
      zeroBalanceOfferSeen.value = true
      zeroBalanceOfferVisible.value = true
    }
  },
  { immediate: true }
)

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeyDown)
  stopBalancePolling()
})
</script>

<template>
  <header class="bar">
    <!-- LEFT -->
    <button class="brand" type="button" @click="isAuthed ? goChat() : goHome()">
      Reactor.pw
    </button>

    <!-- CENTER -->
    <div class="center">
      <!-- Home: якоря -->
      <template v-if="isHome">
        <button class="link" type="button" @click="goSection('#about')">Описание</button>
        <button class="link" type="button" @click="goSection('#plans')">Тарифы</button>
      </template>

      <!-- Неавторизован вне Home -->
      <template v-else-if="!isAuthed">
        <button class="link" type="button" @click="goSection('#about')">Описание</button>
        <button class="link" type="button" @click="goSection('#plans')">Тарифы</button>
      </template>

      <!-- Авторизован: баланс всегда в центре -->
      <template v-else>
        <div class="balance-stack">
          <div class="balance">
            <span class="balance-num">{{ requestsLeft ?? '—' }}</span>
            <span class="balance-label">запросов</span>
          </div>

          <button
            v-if="showZeroBalanceOffer"
            class="balance-alert"
            type="button"
            @click="goPaymentsFromZeroBalanceOffer"
          >
            пополнить
          </button>
        </div>

        <button v-if="!isChat && !isAccount && !isPayments && !isAdmin" class="btn" type="button" @click="goPayments">
          Платежи
        </button>
      </template>
    </div>

    <!-- RIGHT -->
    <div class="right">
      <!-- Неавторизован: вход/регистрация без меню -->
      <template v-if="!isAuthed">
        <button class="btn" type="button" @click="goLogin">Вход</button>
        <button class="btn primary" type="button" @click="goRegister">Регистрация</button>
      </template>

      <template v-else>
        <!-- На Home и на Chat: всё справа в бургер -->
        <template v-if="burgerMode">
          <button class="icon-btn" type="button" @click="toggleMenu" aria-label="Меню">
            <span class="icon-lines" />
          </button>

          <div v-if="menuOpen" class="menu-overlay" @click.self="closeMenu">
            <div class="menu-panel">
              <!-- На Home показываем Чат, на Chat можно не показывать -->
              <button v-if="!isChat" class="menu-item" type="button" @click="goChat">Чат</button>

              <button class="menu-item" type="button" @click="goPayments">Платежи</button>
              <button class="menu-item" type="button" @click="goAccount">Аккаунт ({{ email }})</button>

              <button
                v-if="props.user?.role === 'admin'"
                class="menu-item"
                type="button"
                @click="goAdmin"
              >
                Админ-панель
              </button>

              <div class="menu-sep" />

              <button class="menu-item danger" type="button" @click="clickLogout">Выйти</button>
            </div>
          </div>
        </template>

        <!-- Авторизован не на Home/Chat: как было -->
        <template v-else>
          <button
            v-if="props.user?.role === 'admin'"
            class="btn"
            type="button"
            @click="goAdmin"
          >
            Админ-панель
          </button>
          <button class="btn" type="button" @click="goAccount">{{ email }}</button>
          <button class="btn" type="button" @click="clickLogout">Выйти</button>
        </template>
      </template>
    </div>
  </header>
</template>

<style scoped>
.bar {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border);
  background: var(--card);
}

.brand {
  justify-self: start;
  border: 0;
  background: transparent;
  cursor: pointer;
  font-weight: 950;
  color: var(--text);
  font-size: 14px;
}

.center {
  justify-self: center;
  display: flex;
  gap: 10px;
  align-items: center;
  flex-wrap: wrap;
  justify-content: center;
}

.balance-stack {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
}

.right {
  justify-self: end;
  display: flex;
  gap: 10px;
  align-items: center;
}

.link {
  border: 0;
  background: transparent;
  cursor: pointer;
  font-weight: 900;
  color: var(--text);
  opacity: .85;
  padding: 8px 10px;
  border-radius: 10px;
}
.link:hover { background: var(--card2); opacity: 1; }

.balance {
  display: flex;
  align-items: baseline;
  gap: 8px;
  padding: 8px 10px;
  border: 1px solid var(--border);
  background: var(--card2);
  border-radius: 999px;
}
.balance-num { font-weight: 950; }
.balance-label { color: var(--muted); font-size: 12px; font-weight: 800; }

.balance-alert {
  border: 0;
  background: transparent;
  color: var(--successText);
  padding: 0;
  cursor: pointer;
  font-weight: 900;
  font-size: 11px;
  line-height: 1.2;
  text-align: center;
  text-decoration: underline;
  text-underline-offset: 2px;
  white-space: nowrap;
}

.balance-alert:hover {
  opacity: 0.85;
}

.btn {
  border: 1px solid var(--border);
  background: var(--card);
  border-radius: 12px;
  padding: 9px 12px;
  cursor: pointer;
  font-weight: 900;
  font-size: 12px;
  color: var(--text);
}
.btn.primary {
  background: var(--primary);
  border-color: var(--primary);
  color: var(--primaryText);
}

/* burger */
.icon-btn {
  border: 1px solid var(--border);
  background: var(--card);
  border-radius: 12px;
  width: 40px;
  height: 36px;
  display: grid;
  place-items: center;
  cursor: pointer;
}
.icon-lines {
  width: 18px;
  height: 12px;
  display: inline-block;
  position: relative;
}
.icon-lines::before,
.icon-lines::after {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  height: 2px;
  border-radius: 2px;
  background: var(--text);
  opacity: .9;
}
.icon-lines::before { top: 0; box-shadow: 0 5px 0 0 var(--text); }
.icon-lines::after { bottom: 0; }

.menu-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,.20);
  z-index: 60;
}

.menu-panel {
  position: fixed;
  top: 0;
  right: 0;
  width: min(320px, 86vw);
  height: 100dvh;
  background: var(--card);
  border-left: 1px solid var(--border);
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  transform: translateX(0);
}

.menu-item {
  border: 1px solid var(--border);
  background: var(--card2);
  color: var(--text);
  border-radius: 12px;
  padding: 10px 12px;
  text-align: left;
  cursor: pointer;
  font-weight: 900;
  font-size: 13px;
  overflow-wrap: anywhere;
  word-break: break-word;
}
.menu-item:hover { background: var(--card2Hover); }
.menu-item.danger { border-color: var(--dangerBorder); background: var(--dangerBg); color: var(--dangerText); }

.menu-sep {
  height: 1px;
  background: var(--border);
  margin: 6px 0;
}

@media (min-width: 861px) {
  .menu-overlay { background: transparent; }
  .menu-panel {
    top: 56px;
    right: 16px;
    height: auto;
    border: 1px solid var(--border);
    border-radius: 16px;
    width: 280px;
    box-shadow: 0 10px 30px rgba(0,0,0,.25);
  }
}

@media (max-width: 640px) {
  .bar { grid-template-columns: auto 1fr auto; }
  .right { gap: 6px; }
  .btn { padding: 8px 10px; }
}
</style>