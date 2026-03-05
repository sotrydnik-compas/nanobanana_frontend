<script setup>
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { auth } from './stores/auth'

import TopBar from './components/common/TopBar.vue'
import FooterBar from './components/common/FooterBar.vue'
import ConfirmModal from './components/common/ConfirmModal.vue'

auth.init()

const route = useRoute()
const router = useRouter()

const isEmbed = computed(() => route.query.embed === '1')
const hideChrome = computed(() => !!route.meta.hideChrome || isEmbed.value)
const noOuterScroll = computed(() => route.name === 'chat' || isEmbed.value)

const mainEl = ref(null)

// Скроллим hash внутри app-main (а не window)
async function scrollToHash() {
  if (!mainEl.value) return
  if (!route.hash) return

  await nextTick()
  const el = mainEl.value.querySelector(route.hash) || document.querySelector(route.hash)
  if (el?.scrollIntoView) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

function scrollToTop() {
  if (!mainEl.value) return
  mainEl.value.scrollTo({ top: 0, behavior: 'auto' })
}

watch(
  () => route.fullPath,
  async () => {
    // если есть hash — скролл к секции, иначе наверх
    if (route.hash) await scrollToHash()
    else scrollToTop()
  }
)

onMounted(async () => {
  if (route.hash) await scrollToHash()
})

async function onLogout() {
  await auth.logout()
  router.replace({ name: 'login' })
}
</script>

<template>
  <div class="app">
    <TopBar v-if="!hideChrome" :user="auth.state.user" @logout="onLogout" />

    <div ref="mainEl" class="app-main" :class="{ noscroll: noOuterScroll }">
      <div class="view" :class="{ chat: route.name === 'chat' }">
        <router-view />
      </div>

      <FooterBar v-if="!hideChrome && route.name !== 'chat'" />
    </div>

    <FooterBar v-if="!hideChrome && route.name === 'chat'" />

    <ConfirmModal />
  </div>
</template>

<style scoped>
.app {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.app-main {
  flex: 1;
  min-height: 0;
  overflow: auto;
  display: flex;
  flex-direction: column;
}

.app-main.noscroll {
  overflow: hidden;
}

/* ✅ по умолчанию — обычный поток, чтобы страница росла по высоте */
.view {
  display: block;
}

/* ✅ flex-режим оставляем только для чата */
.view.chat {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.view.chat :deep(> *) {
  flex: 1;
  min-height: 0;
}
</style>