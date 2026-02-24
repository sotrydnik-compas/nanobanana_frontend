<script setup>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { auth } from './stores/auth'

import TopBar from './components/common/TopBar.vue'
import FooterBar from './components/common/FooterBar.vue'

auth.init()

const route = useRoute()
const router = useRouter()

const isEmbed = computed(() => route.query.embed === '1')
const hideChrome = computed(() => !!route.meta.hideChrome || isEmbed.value)
const noOuterScroll = computed(() => route.name === 'chat' || isEmbed.value)

async function onLogout() {
  await auth.logout()
  router.replace({ name: 'login' })
}
</script>

<template>
  <div class="app">
    <TopBar v-if="!hideChrome" :user="auth.state.user" @logout="onLogout" />
    <div class="app-main" :class="{ noscroll: noOuterScroll }">
      <router-view />
    </div>
    <FooterBar v-if="!hideChrome" />
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

  /* ВАЖНО: делаем контейнером flex, чтобы router-view мог растягиваться */
  display: flex;
  flex-direction: column;
}

/* Для /chat мы прячем внешний скролл именно на app-main */
.app-main.noscroll {
  overflow: hidden;
}

/* ВАЖНО: растягиваем корневой элемент страницы из router-view */
.app-main :deep(> *) {
  flex: 1;
  min-height: 0;
}
</style>