<script setup>
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { authApi } from '../api/auth'

const route = useRoute()
const router = useRouter()

const email = ref(String(route.query.email || ''))
const code = ref('')
const err = ref('')
const info = ref('')
const loading = ref(false)

async function onVerify() {
  err.value = ''
  info.value = ''
  loading.value = true
  try {
    await authApi.verifyEmail(email.value.trim(), code.value.trim())
    info.value = 'Email подтвержден. Можно входить.'
    router.replace('/login')
  } catch (e) {
    err.value = e?.message || 'Ошибка подтверждения'
  } finally {
    loading.value = false
  }
}

async function onResend() {
  err.value = ''
  info.value = ''
  try {
    const r = await authApi.resendVerify(email.value.trim())
    info.value = r?.sent === false ? 'Подождите минуту и попробуйте снова.' : 'Код отправлен.'
  } catch (e) {
    err.value = e?.message || 'Ошибка отправки'
  }
}
</script>

<template>
  <div class="auth-shell">
    <div class="auth-card">
      <div class="auth-title">Подтверждение email</div>

      <label class="lbl">Email</label>
      <input class="inp" v-model="email" />

      <label class="lbl">Код (6 цифр)</label>
      <input class="inp" v-model="code" placeholder="123456" />

      <button class="btn primary" :disabled="loading" @click="onVerify">
        {{ loading ? 'Проверяем…' : 'Подтвердить' }}
      </button>

      <button class="btn" type="button" @click="onResend">Отправить код ещё раз</button>

      <div v-if="err" class="alert">{{ err }}</div>
      <div v-if="info" class="alert ok">{{ info }}</div>

      <div class="auth-links">
        <router-link to="/login">Назад ко входу</router-link>
      </div>
    </div>
  </div>
</template>
