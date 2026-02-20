<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { billingApi } from '../../api/billing'
import { auth } from '../../stores/auth'

const props = defineProps({
  user: { type: Object, default: null },
})

const emit = defineEmits(['logout'])

auth.init()
const router = useRouter()
const route = useRoute()

const isAuthed = computed(() => !!auth.state.accessToken)
const email = computed(() => props.user?.email || 'Аккаунт')

const requestsLeft = ref(null)
const balanceBusy = ref(false)
let balanceTimer = null

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
  await router.push({ name: 'home' })
}

async function goChat() {
  await router.push({ name: 'chat' })
}

async function goLogin() {
  await router.push({ name: 'login' })
}

async function goRegister() {
  await router.push({ name: 'register' })
}

async function goPayments() {
  await router.push({ name: 'payments' })
}

async function goAccount() {
  await router.push({ name: 'account' })
}

async function goSection(hash) {
  // всегда ведем на /home + якорь
  await router.push({ name: 'home', hash })
}

function clickLogout() {
  emit('logout')
}

onMounted(async () => {
  // если залогинен — подгрузить баланс
  if (isAuthed.value) {
    await loadBalanceSafe()
    startBalancePolling()
  }
})

// если токены появились/пропали — включаем/выключаем polling
watch(isAuthed, async (v) => {
  if (v) {
    await loadBalanceSafe()
    startBalancePolling()
  } else {
    requestsLeft.value = null
    stopBalancePolling()
  }
})

// после перехода на payments — баланс часто меняется: обновим
watch(
  () => route.name,
  async (name) => {
    if (isAuthed.value && (name === 'payments' || name === 'chat')) {
      await loadBalanceSafe()
    }
  }
)

onBeforeUnmount(() => {
  stopBalancePolling()
})
</script>

<template>
  <header class="bar">
    <!-- LEFT -->
    <button class="brand" type="button" @click="isAuthed ? goChat() : goHome()">
      NanoBanana Pro
    </button>

    <!-- CENTER -->
    <div class="center">
      <template v-if="!isAuthed">
        <button class="link" type="button" @click="goSection('#about')">Описание</button>
        <button class="link" type="button" @click="goSection('#plans')">Тарифы</button>
      </template>

      <template v-else>
        <div class="balance">
          <span class="balance-num">{{ requestsLeft ?? '—' }}</span>
          <span class="balance-label">запросов</span>
        </div>
        <button class="btn" type="button" @click="goPayments">Платежи</button>
      </template>
    </div>

    <!-- RIGHT -->
    <div class="right">
      <template v-if="!isAuthed">
        <button class="btn" type="button" @click="goLogin">Вход</button>
        <button class="btn primary" type="button" @click="goRegister">Регистрация</button>
      </template>

      <template v-else>
        <button class="btn" type="button" @click="goAccount">{{ email }}</button>
        <button class="btn" type="button" @click="clickLogout">Выйти</button>
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

@media (max-width: 860px) {
  .bar { grid-template-columns: auto 1fr auto; }
  .center { gap: 6px; }
}
</style>