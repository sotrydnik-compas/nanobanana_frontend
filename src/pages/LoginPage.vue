<script setup>
import { ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { auth } from '../stores/auth'

const router = useRouter()
const route = useRoute()

const email = ref('')
const password = ref('')
const err = ref('')
const loading = ref(false)

async function onSubmit() {
  err.value = ''
  loading.value = true
  try {
    await auth.login(email.value.trim(), password.value)
    const next = route.query.next ? String(route.query.next) : '/'
    router.replace(next)
  } catch (e) {
    err.value = e?.message || 'Ошибка входа'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="auth-shell">
    <div class="auth-card">
      <div class="auth-title">Вход</div>

      <label class="lbl">Email</label>
      <input class="inp" v-model="email" placeholder="you@example.com" />

      <label class="lbl">Пароль</label>
      <input class="inp" v-model="password" type="password" placeholder="••••••••" />

      <button class="btn primary" :disabled="loading" @click="onSubmit">
        {{ loading ? 'Входим…' : 'Войти' }}
      </button>

      <div v-if="err" class="alert">{{ err }}</div>

      <div class="auth-links">
        <router-link to="/register">Регистрация</router-link>
        <router-link to="/reset-password">Сброс пароля</router-link>
      </div>
    </div>
  </div>
</template>
