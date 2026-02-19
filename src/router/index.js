import { createRouter, createWebHistory } from 'vue-router'
import { auth } from '../stores/auth'

import ChatPage from '../pages/ChatPage.vue'
import LoginPage from '../pages/LoginPage.vue'
import RegisterPage from '../pages/RegisterPage.vue'
import VerifyEmailPage from '../pages/VerifyEmailPage.vue'
import ResetPasswordPage from '../pages/ResetPasswordPage.vue'

import AccountPage from '../pages/AccountPage.vue'
import PaymentsPage from '../pages/PaymentsPage.vue'


const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL), // учитывает base="/widget/"
  routes: [
    { path: '/', name: 'chat', component: ChatPage, meta: { requiresAuth: true } },
    { path: '/account', name: 'account', component: AccountPage, meta: { requiresAuth: true } },
    { path: '/payments', name: 'payments', component: PaymentsPage, meta: { requiresAuth: true } },

    { path: '/login', name: 'login', component: LoginPage },
    { path: '/register', name: 'register', component: RegisterPage },
    { path: '/verify-email', name: 'verify-email', component: VerifyEmailPage },
    { path: '/reset-password', name: 'reset-password', component: ResetPasswordPage },
  ],
})

router.beforeEach(async (to) => {
  auth.init() // безопасно, просто загрузка из localStorage 1 раз

  if (!to.meta.requiresAuth) return true
  if (auth.state.accessToken) return true

  return { name: 'login', query: { next: to.fullPath } }
})

export default router
