<script setup>
import { onBeforeUnmount, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { authApi } from '../api/auth'

const route = useRoute()
const router = useRouter()

const email = ref(String(route.query.email || ''))
const code = ref('')
const err = ref('')
const info = ref('')
const loading = ref(false)
const redirecting = ref(false)

let redirectTimer = null

function clearRedirectTimer() {
  if (redirectTimer) {
    clearTimeout(redirectTimer)
    redirectTimer = null
  }
}

function scheduleLoginRedirect() {
  clearRedirectTimer()
  redirecting.value = true
  redirectTimer = setTimeout(() => {
    router.replace('/login')
  }, 2500)
}

async function onVerify() {
  if (redirecting.value) return

  err.value = ''
  info.value = ''
  loading.value = true
  try {
    await authApi.verifyEmail(email.value.trim(), code.value.trim())
    info.value = 'Верификация успешна. Перенаправляем на страницу входа.'
    scheduleLoginRedirect()
  } catch (e) {
    err.value = e?.message || 'Ошибка подтверждения'
  } finally {
    loading.value = false
  }
}

async function onResend() {
  if (redirecting.value) return

  err.value = ''
  info.value = ''
  try {
    const r = await authApi.resendVerify(email.value.trim())
    info.value = r?.sent === false ? 'Подождите минуту и попробуйте снова.' : 'Код отправлен.'
  } catch (e) {
    err.value = e?.message || 'Ошибка отправки'
  }
}

onBeforeUnmount(() => {
  clearRedirectTimer()
})
</script>

<template>
  <div class="auth-shell">
    <div class="auth-card">
      <div class="auth-title">Подтверждение email</div>

      <label class="lbl">Email</label>
      <input class="inp" v-model="email" />

      <label class="lbl">Код (6 цифр)</label>
      <input class="inp" v-model="code" placeholder="123456" />

      <button class="btn primary" :disabled="loading || redirecting" @click="onVerify">
        {{ loading ? 'Проверяем…' : redirecting ? 'Переходим ко входу…' : 'Подтвердить' }}
      </button>

      <button class="btn" type="button" :disabled="redirecting" @click="onResend">Отправить код ещё раз</button>

      <div v-if="err" class="alert">{{ err }}</div>
      <div v-if="info" class="alert ok">{{ info }}</div>

      <div class="auth-links">
        <router-link to="/login">Назад ко входу</router-link>
      </div>
    </div>
  </div>
</template>