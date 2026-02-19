<script setup>
import { ref } from 'vue'
import { authApi } from '../api/auth'
import { useRouter } from 'vue-router'

const router = useRouter()

const step = ref('request') // request | confirm
const email = ref('')
const code = ref('')
const newPassword = ref('')
const err = ref('')
const info = ref('')
const loading = ref(false)

async function onRequest() {
  err.value = ''
  info.value = ''
  loading.value = true
  try {
    await authApi.resetRequest(email.value.trim())
    info.value = 'Если email существует, код отправлен.'
    step.value = 'confirm'
  } catch (e) {
    err.value = e?.message || 'Ошибка'
  } finally {
    loading.value = false
  }
}

async function onConfirm() {
  err.value = ''
  info.value = ''
  loading.value = true
  try {
    await authApi.resetConfirm(email.value.trim(), code.value.trim(), newPassword.value)
    info.value = 'Пароль обновлён. Можно входить.'
    router.replace('/login')
  } catch (e) {
    err.value = e?.message || 'Ошибка'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="auth-shell">
    <div class="auth-card">
      <div class="auth-title">Сброс пароля</div>

      <label class="lbl">Email</label>
      <input class="inp" v-model="email" placeholder="you@example.com" />

      <template v-if="step === 'request'">
        <button class="btn primary" :disabled="loading" @click="onRequest">
          {{ loading ? 'Отправляем…' : 'Запросить код' }}
        </button>
      </template>

      <template v-else>
        <label class="lbl">Код</label>
        <input class="inp" v-model="code" placeholder="123456" />

        <label class="lbl">Новый пароль</label>
        <input class="inp" v-model="newPassword" type="password" placeholder="••••••••" />

        <button class="btn primary" :disabled="loading" @click="onConfirm">
          {{ loading ? 'Сохраняем…' : 'Сменить пароль' }}
        </button>
      </template>

      <div v-if="err" class="alert">{{ err }}</div>
      <div v-if="info" class="alert ok">{{ info }}</div>

      <div class="auth-links">
        <router-link to="/login">Назад ко входу</router-link>
      </div>
    </div>
  </div>
</template>
