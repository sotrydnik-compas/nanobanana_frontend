<script setup>
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { auth } from '../stores/auth'
import { accountApi } from '../api/account'

auth.init()
const router = useRouter()

const user = computed(() => auth.state.user)

const busy = ref(false)
const info = ref('')
const errorText = ref('')

// refresh me (по кнопке)
async function refreshMe() {
  info.value = ''
  errorText.value = ''
  busy.value = true
  try {
    const me = await accountApi.me()
    auth.setUser(me)
    info.value = 'Профиль обновлён.'
  } catch (e) {
    errorText.value = e?.message || 'Не удалось обновить профиль'
  } finally {
    busy.value = false
  }
}

// ---- change password
const oldPassword = ref('')
const newPassword = ref('')
const newPassword2 = ref('')

async function submitPasswordChange() {
  info.value = ''
  errorText.value = ''

  const op = oldPassword.value.trim()
  const np = newPassword.value.trim()
  const np2 = newPassword2.value.trim()

  if (!op) return (errorText.value = 'Введите текущий пароль.')
  if (!np || np.length < 8) return (errorText.value = 'Новый пароль должен быть минимум 8 символов.')
  if (np !== np2) return (errorText.value = 'Пароли не совпадают.')

  busy.value = true
  try {
    await accountApi.changePassword(op, np)
    info.value = 'Пароль изменён. Нужно войти заново.'
    await auth.logout() // попытка заблэклистить access + зачистить локально
    await router.push({ name: 'login' })
  } catch (e) {
    errorText.value = e?.message || 'Не удалось сменить пароль'
  } finally {
    busy.value = false
  }
}

// ---- change email (2 step)
const newEmail = ref('')
const emailPassword = ref('')
const emailCode = ref('')
const emailStep = ref('form') // 'form' | 'code'

async function submitEmailChange() {
  info.value = ''
  errorText.value = ''

  const em = newEmail.value.trim().toLowerCase()
  const pw = emailPassword.value

  if (!em || !em.includes('@')) return (errorText.value = 'Введите корректный email.')
  if (!pw) return (errorText.value = 'Введите пароль для подтверждения.')

  busy.value = true
  try {
    const r = await accountApi.changeEmail(em, pw)
    if (r?.confirm_required) {
      emailStep.value = 'code'
      info.value = 'Код подтверждения отправлен на новый email. Введите код.'
    } else {
      // на всякий случай
      emailStep.value = 'code'
      info.value = 'Введите код подтверждения.'
    }
  } catch (e) {
    errorText.value = e?.message || 'Не удалось запросить смену email'
  } finally {
    busy.value = false
  }
}

async function submitEmailConfirm() {
  info.value = ''
  errorText.value = ''

  const code = emailCode.value.trim()
  if (!code || code.length !== 6) return (errorText.value = 'Код должен быть из 6 цифр.')

  busy.value = true
  try {
    await accountApi.confirmEmailChange(code)
    info.value = 'Email изменён. Нужно войти заново.'
    await auth.logout()
    await router.push({ name: 'login' })
  } catch (e) {
    errorText.value = e?.message || 'Не удалось подтвердить смену email'
  } finally {
    busy.value = false
  }
}

function resetEmailFlow() {
  emailStep.value = 'form'
  newEmail.value = ''
  emailPassword.value = ''
  emailCode.value = ''
}

// ---- logout all devices
async function logoutAllDevices() {
  info.value = ''
  errorText.value = ''
  busy.value = true
  try {
    await accountApi.logoutAll()
    // дополнительно дернем обычный logout, чтобы заблэклистить текущий access
    await auth.logout()
    await router.push({ name: 'login' })
  } catch (e) {
    // даже если сервер не ответил, локально всё равно лучше зачистить
    auth.clear()
    await router.push({ name: 'login' })
  } finally {
    busy.value = false
  }
}

async function goChat() {
  await router.push({ name: 'chat' })
}
</script>

<template>
  <div class="page">
    <div class="top">
      <div>
        <div class="title">Аккаунт</div>
        <div class="sub">Профиль и безопасность</div>
      </div>

      <div class="top-actions">
        <button class="btn" type="button" @click="goChat">← В чат</button>
        <button class="btn" type="button" @click="refreshMe" :disabled="busy">Обновить</button>
      </div>
    </div>

    <div class="card">
      <div class="card-title">Профиль</div>

      <div v-if="user" class="grid">
        <div class="row"><div class="k">ID</div><div class="v mono">{{ user.id }}</div></div>
        <div class="row"><div class="k">Email</div><div class="v">{{ user.email }}</div></div>
        <div class="row"><div class="k">Роль</div><div class="v">{{ user.role }}</div></div>
      </div>

      <div v-else class="muted">Профиль ещё загружается…</div>
    </div>

    <div class="card">
      <div class="card-title">Смена пароля</div>

      <div class="field">
        <label class="label">Текущий пароль</label>
        <input class="input" type="password" v-model="oldPassword" autocomplete="current-password" />
      </div>

      <div class="field">
        <label class="label">Новый пароль</label>
        <input class="input" type="password" v-model="newPassword" autocomplete="new-password" />
      </div>

      <div class="field">
        <label class="label">Повтор нового пароля</label>
        <input class="input" type="password" v-model="newPassword2" autocomplete="new-password" />
      </div>

      <button class="btn primary" type="button" @click="submitPasswordChange" :disabled="busy">
        Сменить пароль
      </button>
    </div>

    <div class="card">
      <div class="card-title">Смена email</div>

      <template v-if="emailStep === 'form'">
        <div class="field">
          <label class="label">Новый email</label>
          <input class="input" type="email" v-model="newEmail" autocomplete="email" />
        </div>

        <div class="field">
          <label class="label">Пароль</label>
          <input class="input" type="password" v-model="emailPassword" autocomplete="current-password" />
        </div>

        <button class="btn primary" type="button" @click="submitEmailChange" :disabled="busy">
          Запросить код
        </button>
      </template>

      <template v-else>
        <div class="field">
          <label class="label">Код из письма (6 цифр)</label>
          <input class="input" v-model="emailCode" inputmode="numeric" maxlength="6" />
        </div>

        <div class="actions">
          <button class="btn" type="button" @click="resetEmailFlow" :disabled="busy">Назад</button>
          <button class="btn primary" type="button" @click="submitEmailConfirm" :disabled="busy">
            Подтвердить email
          </button>
        </div>
      </template>
    </div>

    <div class="card danger">
      <div class="card-title">Сессии</div>
      <div class="muted">Завершить все refresh-сессии на всех устройствах.</div>

      <button class="btn danger" type="button" @click="logoutAllDevices" :disabled="busy">
        Выйти со всех устройств
      </button>
    </div>

    <div v-if="errorText" class="alert error">{{ errorText }}</div>
    <div v-else-if="info" class="alert ok">{{ info }}</div>
  </div>
</template>

<style scoped>
.page {
  max-width: 860px;
  margin: 0 auto;
  padding: 18px;
  font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
  color: #111827;
}
.top {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  gap: 12px;
  margin-bottom: 14px;
}
.title { font-size: 22px; font-weight: 900; line-height: 1.2; }
.sub { margin-top: 3px; color: #6b7280; font-size: 12px; }
.top-actions { display: flex; gap: 8px; }

.card {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 16px;
  padding: 14px;
  margin-bottom: 12px;
}
.card-title { font-weight: 900; margin-bottom: 10px; }
.grid { display: grid; gap: 8px; }
.row { display: grid; grid-template-columns: 80px 1fr; gap: 10px; align-items: center; }
.k { color: #6b7280; font-size: 12px; font-weight: 700; }
.v { font-size: 13px; }
.mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 12px; }
.muted { color: #6b7280; font-size: 12px; margin-bottom: 10px; }

.field { margin-bottom: 10px; }
.label { display: block; font-size: 12px; font-weight: 800; color: #374151; margin-bottom: 6px; }
.input {
  width: 100%;
  box-sizing: border-box;
  border: 1px solid #e5e7eb;
  background: #f4f4f5;
  border-radius: 12px;
  padding: 10px 12px;
  font-size: 14px;
  outline: none;
}
.input:hover { background: #e4e4e7; }

.btn {
  border: 1px solid #e5e7eb;
  background: #fff;
  border-radius: 12px;
  padding: 10px 12px;
  cursor: pointer;
  font-weight: 800;
  font-size: 13px;
}
.btn:disabled { opacity: .6; cursor: not-allowed; }
.btn.primary { background: #2563eb; border-color: #2563eb; color: #fff; }
.actions { display: flex; gap: 10px; }
.actions .btn { flex: 1; }

.card.danger { border-color: #fecaca; background: #fff; }
.btn.danger { background: #fee2e2; border-color: #fecaca; color: #7f1d1d; }

.alert {
  margin-top: 10px;
  padding: 10px 12px;
  border-radius: 14px;
  border: 1px solid;
  font-size: 13px;
}
.alert.error { background: #fef2f2; border-color: #fecaca; color: #7f1d1d; }
.alert.ok { background: #ecfdf5; border-color: #a7f3d0; color: #065f46; }
</style>
