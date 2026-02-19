<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { authApi } from '../api/auth'

const router = useRouter()

const email = ref('')
const password = ref('')
const err = ref('')
const loading = ref(false)

async function onSubmit() {
  err.value = ''
  loading.value = true
  try {
    await authApi.register(email.value.trim(), password.value)
    router.push({ name: 'verify-email', query: { email: email.value.trim() } })
  } catch (e) {
    err.value = e?.message || 'Ошибка регистрации'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="auth-shell">
    <div class="auth-card">
      <div class="auth-title">Регистрация</div>

      <label class="lbl">Email</label>
      <input class="inp" v-model="email" placeholder="you@example.com" />

      <label class="lbl">Пароль (минимум 8 символов)</label>
      <input class="inp" v-model="password" type="password" placeholder="••••••••" />

      <button class="btn primary" :disabled="loading" @click="onSubmit">
        {{ loading ? 'Создаём…' : 'Создать аккаунт' }}
      </button>

      <div v-if="err" class="alert">{{ err }}</div>

      <div class="auth-links">
        <router-link to="/login">Уже есть аккаунт</router-link>
      </div>
    </div>
  </div>
</template>
