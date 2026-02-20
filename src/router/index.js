import { createRouter, createWebHistory } from 'vue-router'
import { auth } from '../stores/auth'

import ChatPage from '../pages/ChatPage.vue'
import LoginPage from '../pages/LoginPage.vue'
import RegisterPage from '../pages/RegisterPage.vue'
import VerifyEmailPage from '../pages/VerifyEmailPage.vue'
import ResetPasswordPage from '../pages/ResetPasswordPage.vue'

import AccountPage from '../pages/AccountPage.vue'
import PaymentsPage from '../pages/PaymentsPage.vue'
import HomePage from '../pages/HomePage.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL), // base="/widget/"
  routes: [
    // public landing
    { path: '/home', name: 'home', component: HomePage },

    // app (auth required)
    { path: '/', name: 'chat', component: ChatPage, meta: { requiresAuth: true } },
    { path: '/account', name: 'account', component: AccountPage, meta: { requiresAuth: true } },
    { path: '/payments', name: 'payments', component: PaymentsPage, meta: { requiresAuth: true } },

    // auth pages (no TopBar/Footer)
    { path: '/login', name: 'login', component: LoginPage, meta: { hideChrome: true } },
    { path: '/register', name: 'register', component: RegisterPage, meta: { hideChrome: true } },
    { path: '/verify-email', name: 'verify-email', component: VerifyEmailPage, meta: { hideChrome: true } },
    { path: '/reset-password', name: 'reset-password', component: ResetPasswordPage, meta: { hideChrome: true } },
  ],

  scrollBehavior(to) {
    if (to.hash) return { el: to.hash, behavior: 'smooth' }
    return { top: 0 }
  },
})

router.beforeEach(async (to) => {
  auth.init()

  if (!to.meta.requiresAuth) return true
  if (auth.state.accessToken) return true

  // если пользователь просто открыл сайт ("/") — ведём на лендинг
  if (to.name === 'chat') return { name: 'home' }

  // остальные защищённые — на логин с next
  return { name: 'login', query: { next: to.fullPath } }
})

export default router