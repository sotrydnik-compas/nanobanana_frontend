<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
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

const isMobileViewport = ref(typeof window !== 'undefined' ? window.innerWidth <= 980 : false)

function syncViewportMode() {
  isMobileViewport.value = window.innerWidth <= 980
}

const chatFooterInFlow = computed(() =>
  route.name === 'chat' &&
  !hideChrome.value &&
  !isEmbed.value &&
  isMobileViewport.value
)

const noOuterScroll = computed(() =>
  isEmbed.value || (route.name === 'chat' && !chatFooterInFlow.value)
)

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
    if (route.hash) await scrollToHash()
    else scrollToTop()
  }
)

onMounted(async () => {
  window.addEventListener('resize', syncViewportMode)
  syncViewportMode()

  if (route.hash) await scrollToHash()
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', syncViewportMode)
})

async function onLogout() {
  await auth.logout()
  router.replace({ name: 'login' })
}
</script>

<template>
  <div class="app">
    <TopBar v-if="!hideChrome" :user="auth.state.user" @logout="onLogout" />

    <div
      ref="mainEl"
      class="app-main"
      :class="{
        noscroll: noOuterScroll,
        'chat-footer-in-flow': chatFooterInFlow,
      }"
    >
      <div
        class="view"
        :class="{
          chat: route.name === 'chat',
          'chat-mobile-scroll-view': chatFooterInFlow,
        }"
      >
        <router-view />
      </div>

      <FooterBar v-if="!hideChrome && (route.name !== 'chat' || chatFooterInFlow)" />
    </div>

    <FooterBar v-if="!hideChrome && route.name === 'chat' && !chatFooterInFlow" />

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

/* мобильный чат: footer идет после chat-view внутри scroll-контейнера */
.app-main.chat-footer-in-flow {
  overflow: auto;
}

.view {
  display: block;
}

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

/* только для mobile-chat */
.view.chat.chat-mobile-scroll-view {
  flex: none;
  height: 100%;
  min-height: 100%;
}

.view.chat.chat-mobile-scroll-view :deep(> *) {
  flex: none;
  height: 100%;
  min-height: 100%;
}
</style>