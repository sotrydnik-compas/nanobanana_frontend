<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { auth } from '../stores/auth'
import { aiApi } from '../api/ai'
import { safeJsonParse } from '../utils/json'

import ChatList from '../components/chat/ChatList.vue'
import ChatMessages from '../components/chat/ChatMessages.vue'
import Composer from '../components/chat/Composer.vue'
import SettingsPanel from '../components/chat/SettingsPanel.vue'

const router = useRouter()

const isEmbed = new URLSearchParams(window.location.search).get('embed') === '1'

const chats = ref([])
const chatsLoading = ref(false)

const currentChatId = ref(null)
const currentChatStatus = ref('active')
const messages = ref([])
const messagesLoading = ref(false)

const taskInFlight = ref(false)
const currentTaskId = ref('')
const pollTimer = ref(null)

const errorText = ref('')
const infoText = ref('')

const settings = reactive({
  aspectRatio: 'auto',
  resolution: '1K',
  mode: 'standard', // standard | product_card
  productVariant: 'studio', // studio | image | ugc
  title: '',
  advantage: '',
})

const refsState = reactive({
  urls: [],
  files: [], // File[]
})

function stopPolling() {
  if (pollTimer.value) {
    clearInterval(pollTimer.value)
    pollTimer.value = null
  }
}

async function loadChats() {
  chatsLoading.value = true
  try {
    const r = await aiApi.listChats(50, 0)
    chats.value = r?.chats || []
  } catch (e) {
    errorText.value = e?.message || 'Не удалось загрузить чаты'
  } finally {
    chatsLoading.value = false
  }
}

function normalizeMessages(raw) {
  return (raw || []).map(m => {
    const meta = safeJsonParse(m.meta_json, {}) || {}
    return {
      id: m.messageId,
      role: m.role,
      content: m.content || '',
      meta,
      taskId: m.taskId || null,
      created_at: m.created_at,
    }
  })
}

async function loadMessages(chatId) {
  if (!chatId) {
    messages.value = []
    return
  }
  messagesLoading.value = true
  try {
    const r = await aiApi.getMessages(chatId)
    messages.value = normalizeMessages(r?.messages || [])
  } catch (e) {
    errorText.value = e?.message || 'Не удалось загрузить сообщения'
  } finally {
    messagesLoading.value = false
  }
}

function onNewChat() {
  errorText.value = ''
  infoText.value = ''
  currentChatId.value = null
  currentChatStatus.value = 'active'
  messages.value = []
  stopPolling()
}

async function onSelectChat(chatId) {
  errorText.value = ''
  infoText.value = ''
  currentChatId.value = chatId

  const found = (chats.value || []).find(c => c.chatId === chatId)
  currentChatStatus.value = found?.status || 'active'

  stopPolling()
  await loadMessages(chatId)
}

async function onCloseChat(chatId) {
  try {
    await aiApi.closeChat(chatId)
    await loadChats()
    if (currentChatId.value === chatId) {
      currentChatStatus.value = 'closed'
    }
  } catch (e) {
    errorText.value = e?.message || 'Не удалось закрыть чат'
  }
}

async function onDeleteChat(chatId) {
  try {
    await aiApi.deleteChat(chatId)
    await loadChats()
    if (currentChatId.value === chatId) {
      onNewChat()
    }
  } catch (e) {
    errorText.value = e?.message || 'Не удалось удалить чат'
  }
}

const finalPrompt = (userPrompt) => {
  if (settings.mode !== 'product_card') return (userPrompt || '').trim()

  const vLabel =
    settings.productVariant === 'ugc' ? 'ugc пакет' :
    settings.productVariant === 'image' ? 'имиджевые варианты' :
    'студийное фото'

  return `создай мне ${vLabel} для карточки товара для маркетплейса. Заголовок: ${settings.title.trim()}. Преимущество этого товара: ${settings.advantage.trim()}`
}

function validateBeforeSend(userPrompt) {
  errorText.value = ''
  infoText.value = ''

  if (currentChatStatus.value === 'closed') {
    errorText.value = 'Чат закрыт. Создайте новый чат.'
    return false
  }

  if (settings.mode === 'product_card') {
    if (!settings.title.trim()) { errorText.value = 'Введите заголовок.'; return false }
    if (!settings.advantage.trim()) { errorText.value = 'Введите преимущество.'; return false }
  } else {
    if (!String(userPrompt || '').trim()) { errorText.value = 'Введите запрос.'; return false }
  }

  // лимит референсов: до 7 суммарно
  const totalRefs = (refsState.urls?.length || 0) + (refsState.files?.length || 0)
  if (totalRefs > 7) {
    errorText.value = 'Максимум 7 референсов (URL + файлы) на запрос.'
    return false
  }

  return true
}

async function fetchTaskOnce(taskId) {
  return await aiApi.getTask(taskId)
}

async function startPolling(taskId, chatId) {
  stopPolling()

  // первый запрос сразу
  try {
    const r = await fetchTaskOnce(taskId)
    const flag = r?.data?.successFlag ?? 0
    if (flag === 1 || flag === 2 || flag === 3) {
      taskInFlight.value = false
      await loadMessages(chatId)
      await loadChats()
      return
    }
  } catch (e) {
    // игнор — будем пробовать дальше
  }

  pollTimer.value = setInterval(async () => {
    try {
      const r = await fetchTaskOnce(taskId)
      const flag = r?.data?.successFlag ?? 0
      if (flag === 1 || flag === 2 || flag === 3) {
        stopPolling()
        taskInFlight.value = false
        await loadMessages(chatId)
        await loadChats()
      }
    } catch (e) {
      // если токены умерли — apiFetch сам попробует refresh; если не сможет — улетим на логин при следующем действии
      errorText.value = e?.message || 'Ошибка опроса статуса'
      stopPolling()
      taskInFlight.value = false
    }
  }, 5000) // бэк сам ограничивает реальный poll до POLL_INTERVAL_SECONDS=30
}

async function onSend(userPrompt) {
  if (taskInFlight.value) return

  if (!validateBeforeSend(userPrompt)) return

  const promptToSend = finalPrompt(userPrompt)
  taskInFlight.value = true
  currentTaskId.value = ''
  errorText.value = ''
  infoText.value = ''

  try {
    const r = await aiApi.generatePro({
      prompt: promptToSend,
      resolution: settings.resolution,
      aspectRatio: settings.aspectRatio,
      chatId: currentChatId.value || null,
      imageUrls: refsState.urls,
      files: refsState.files,
    })

    currentTaskId.value = r.taskId

    // если чат создавался впервые — подхватываем новый chatId
    if (!currentChatId.value && r.chatId) {
      currentChatId.value = r.chatId
      currentChatStatus.value = 'active'
    }

    // сразу подгрузим сообщения (там будет user-message)
    await loadMessages(currentChatId.value)
    await loadChats()

    await startPolling(r.taskId, currentChatId.value)
  } catch (e) {
    taskInFlight.value = false

    if (e?.status === 402) {
      errorText.value = 'Недостаточно запросов. Требуется пополнение.'
      return
    }

    errorText.value = e?.message || 'Не удалось отправить запрос'
  }
}

onMounted(async () => {
  await loadChats()
})

onBeforeUnmount(() => {
  stopPolling()
})
</script>

<template>
  <div class="shell" :class="{ embed: isEmbed }">

    <div class="layout">
      <aside class="left">
        <ChatList
          :chats="chats"
          :loading="chatsLoading"
          :selectedChatId="currentChatId"
          @newChat="onNewChat"
          @selectChat="onSelectChat"
          @closeChat="onCloseChat"
          @deleteChat="onDeleteChat"
        />
      </aside>

      <main class="center">
        <div class="center-inner">
          <div class="card">
            <ChatMessages
              :messages="messages"
              :loading="messagesLoading"
              :taskInFlight="taskInFlight"
            />
          </div>

          <Composer
            :disabled="taskInFlight || currentChatStatus === 'closed'"
            :hint="currentChatStatus === 'closed' ? 'Чат закрыт — создайте новый' : ''"
            @send="onSend"
          />

          <div v-if="errorText" class="alert error">{{ errorText }}</div>
          <div v-if="infoText" class="alert ok">{{ infoText }}</div>
        </div>
      </main>

      <aside class="right">
        <SettingsPanel
          v-model:settings="settings"
          v-model:urls="refsState.urls"
          v-model:files="refsState.files"
        />
      </aside>
    </div>
  </div>
</template>

<style scoped>
.shell { height: 100%; }

.layout{
  display: flex;
  gap: 12px;
  padding: 12px;
  height: 100%;
  min-height: 0;
}

.left { width: 300px; flex: 0 0 300px; min-height: 0; }
.center { flex: 1; min-width: 0; min-height: 0; display: flex; }
.right { width: 360px; flex: 0 0 360px; min-height: 0; }

.center-inner{
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-height: 0;
}

.card{
  flex: 1;
  min-height: 0;
  border-radius: 16px;
  background: var(--card);
  border: 1px solid var(--border);
  overflow: hidden;
}

.alert { padding: 10px 12px; border-radius: 14px; border: 1px solid; font-size: 13px; }
.alert.error { background: var(--dangerBg); border-color: var(--dangerBorder); color: var(--dangerText); }
.alert.ok { background: var(--successBg); border-color: var(--successBorder); color: var(--successText); }

.embed .layout { height: 100vh; padding: 0; gap: 0; }
.embed .left { border-right: 1px solid var(--border); height: 100vh; }
.embed .center-inner { height: 100vh; }
.embed .right { display: none; }

@media (max-width: 980px) {
  .layout { flex-direction: column; height: auto; }
  .left, .right { width: 100%; flex: 0 0 auto; }
  .center { display: block; }
  .center-inner { height: auto; }
}
</style>
