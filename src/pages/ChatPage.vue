<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { auth } from '../stores/auth'
import { aiApi } from '../api/ai'
import { safeJsonParse } from '../utils/json'
import { confirm } from '../utils/confirm'

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
const inFlightKind = ref('')
const currentTaskId = ref('')
const currentBatchId = ref('')
const pollTimer = ref(null)

const errorText = ref('')
const infoText = ref('')

const settings = reactive({
  aspectRatio: 'auto',
  resolution: '1K',
  mode: 'standard', // standard | product_card | batch
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
  currentTaskId.value = ''
  currentBatchId.value = ''
  inFlightKind.value = ''
  taskInFlight.value = false
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
  const ok = await confirm({
    title: 'Закрыть чат?',
    text: 'После закрытия нельзя отправлять новые сообщения.',
    yesText: 'Закрыть',
    noText: 'Отмена',
  })
  if (!ok) return

  try {
    await aiApi.closeChat(chatId)
    await loadChats()
    if (currentChatId.value === chatId) currentChatStatus.value = 'closed'
  } catch (e) {
    errorText.value = e?.message || 'Не удалось закрыть чат'
  }
}

async function onDeleteChat(chatId) {
  const ok = await confirm({
    title: 'Удалить чат?',
    text: 'Действие необратимо. История чата будет удалена.',
    yesText: 'Удалить',
    noText: 'Отмена',
    danger: true,
  })
  if (!ok) return

  try {
    await aiApi.deleteChat(chatId)
    await loadChats()
    if (currentChatId.value === chatId) onNewChat()
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

  return `Создай мне ${vLabel} для карточки товара для маркетплейса. Заголовок: ${settings.title.trim()}. Преимущество этого товара: ${settings.advantage.trim()}`
}

function validateBeforeSend(userPrompt) {
  errorText.value = ''
  infoText.value = ''

  if (currentChatStatus.value === 'closed') {
    errorText.value = 'Чат закрыт. Создайте новый чат.'
    return false
  }

  // промпт обязателен всегда (в batch тоже)
  if (settings.mode === 'product_card') {
    if (!settings.title.trim()) { errorText.value = 'Введите заголовок.'; return false }
    if (!settings.advantage.trim()) { errorText.value = 'Введите преимущество.'; return false }
  } else {
    if (!String(userPrompt || '').trim()) { errorText.value = 'Введите запрос.'; return false }
  }

  const totalRefs = (refsState.urls?.length || 0) + (refsState.files?.length || 0)
  const maxRefs = settings.mode === 'batch' ? 100 : 7

  if (totalRefs > maxRefs) {
    errorText.value = settings.mode === 'batch'
      ? 'Максимум 100 изображений (URL + файлы) на пакет.'
      : 'Максимум 7 референсов (URL + файлы) на запрос.'
    return false
  }

  // batch: хотя бы одно изображение обязательно
  if (settings.mode === 'batch' && totalRefs === 0) {
    errorText.value = 'Добавьте хотя бы одно изображение для пакетной обработки.'
    return false
  }

  return true
}

async function fetchTaskOnce(taskId) {
  return await aiApi.getTask(taskId)
}

async function startTaskPolling(taskId, chatId) {
  stopPolling()

  try {
    const r = await fetchTaskOnce(taskId)
    const flag = r?.data?.successFlag ?? 0
    if (flag === 1 || flag === 2 || flag === 3) {
      taskInFlight.value = false
      inFlightKind.value = ''
      await loadMessages(chatId)
      await loadChats()
      return
    }
  } catch {}

  pollTimer.value = setInterval(async () => {
    try {
      const r = await fetchTaskOnce(taskId)
      const flag = r?.data?.successFlag ?? 0
      if (flag === 1 || flag === 2 || flag === 3) {
        stopPolling()
        taskInFlight.value = false
        inFlightKind.value = ''
        await loadMessages(chatId)
        await loadChats()
      }
    } catch (e) {
      errorText.value = e?.message || 'Ошибка опроса статуса'
      stopPolling()
      taskInFlight.value = false
      inFlightKind.value = ''
    }
  }, 5000)
}

async function startBatchPolling(batchId, chatId) {
  stopPolling()

  let lastProcessed = -1
  let lastIndex = -1

  const tick = async () => {
    try {
      const r = await aiApi.getBatch(batchId)
      const st = r?.status || 'pending'
      const p = r?.progress || {}

      // строка статуса (вынесли сюда, чтобы видно было прогресс)
      infoText.value = `Пакет: ${p.processed ?? 0}/${p.total ?? 0}, ok ${p.success ?? 0}, err ${p.failed ?? 0}, статус: ${st}`

      const processed = Number(p.processed ?? 0)
      const curIdx = Number(p.current_index ?? -1)

      // подтягиваем чат, когда пошёл прогресс (появляются user/assistant сообщения по items)
      if (processed !== lastProcessed || curIdx !== lastIndex) {
        lastProcessed = processed
        lastIndex = curIdx
        await loadMessages(chatId)
        await loadChats()
      }

      const doneStatuses = new Set(['completed', 'partial', 'failed', 'cancelled'])
      if (doneStatuses.has(st)) {
        stopPolling()
        taskInFlight.value = false
        inFlightKind.value = ''
        await loadMessages(chatId)
        await loadChats()
        // финальное сообщение в инфо оставляем как есть
      }
    } catch (e) {
      errorText.value = e?.message || 'Ошибка опроса пакетной задачи'
      stopPolling()
      taskInFlight.value = false
      inFlightKind.value = ''
    }
  }

  await tick()
  pollTimer.value = setInterval(tick, 5000)
}

async function onCancelBatch() {
  if (!currentBatchId.value) return
  try {
    const r = await aiApi.cancelBatch(currentBatchId.value)
    infoText.value = r?.message || 'Запрос на отмену отправлен'
  } catch (e) {
    errorText.value = e?.message || 'Не удалось отменить пакет'
  }
}

async function onSend(userPrompt) {
  if (taskInFlight.value) return
  if (!validateBeforeSend(userPrompt)) return

  const promptToSend = finalPrompt(userPrompt)

  taskInFlight.value = true
  inFlightKind.value = ''
  currentTaskId.value = ''
  currentBatchId.value = ''
  errorText.value = ''
  infoText.value = ''

  try {
    if (settings.mode === 'batch') {
      inFlightKind.value = 'batch'

      const r = await aiApi.generateBatch({
        prompt: promptToSend,
        resolution: settings.resolution,
        aspectRatio: settings.aspectRatio,
        chatId: currentChatId.value || null,
        imageUrls: refsState.urls,
        files: refsState.files,
      })

      currentBatchId.value = r.batch_id

      if (!currentChatId.value && r.chat_id) {
        currentChatId.value = r.chat_id
        currentChatStatus.value = 'active'
      }

      await loadMessages(currentChatId.value)
      await loadChats()

      await startBatchPolling(r.batch_id, currentChatId.value)
      return
    }

    // иначе — обычный generate_pro
    inFlightKind.value = 'task'

    const r = await aiApi.generatePro({
      prompt: promptToSend,
      resolution: settings.resolution,
      aspectRatio: settings.aspectRatio,
      chatId: currentChatId.value || null,
      imageUrls: refsState.urls,
      files: refsState.files,
    })

    currentTaskId.value = r.taskId

    if (!currentChatId.value && r.chatId) {
      currentChatId.value = r.chatId
      currentChatStatus.value = 'active'
    }

    await loadMessages(currentChatId.value)
    await loadChats()

    await startTaskPolling(r.taskId, currentChatId.value)
  } catch (e) {
    taskInFlight.value = false
    inFlightKind.value = ''

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
          <button
            v-if="taskInFlight && inFlightKind==='batch'"
            class="btn danger"
            type="button"
            @click="onCancelBatch"
          >
            Прервать пакетную обработку
          </button>

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
.shell {
  height: 100%;
  min-height: 0;
}

.layout{
  display: flex;
  gap: 12px;
  padding: 12px;
  height: 100%;
  min-height: 0;
  box-sizing: border-box;

  /* чтобы не появлялся “внешний” скролл внутри layout */
  overflow: hidden;
}

.left, .center, .right {
  min-height: 0; /* ключ: разрешаем внутренние скроллы */
}

.left {
  flex: 0 0 280px;
}

.center {
  flex: 1;
  min-width: 0;
}

.right {
  flex: 0 0 280px;
  height: 97%;
}

.center-inner{
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.card{
  flex: 1;
  min-height: 0;
  border-radius: 16px;
  background: var(--card);
  border: 1px solid var(--border);
  overflow: hidden; /* важно: скролл будет в ChatMessages.wrap */
}

.alert { padding: 10px 12px; border-radius: 14px; border: 1px solid; font-size: 13px; }
.alert.error { background: var(--dangerBg); border-color: var(--dangerBorder); color: var(--dangerText); }
.alert.ok { background: var(--successBg); border-color: var(--successBorder); color: var(--successText); }

.embed .layout { height: 100vh; padding: 0; gap: 0; }
.embed .left { border-right: 1px solid var(--border); height: 100vh; }
.embed .center-inner { height: 100vh; }
.embed .right { display: none; }

@media (max-width: 980px) {
  .layout { flex-direction: column; height: 100%; }
  .left, .right { width: 100%; flex: 0 0 auto; }
  .center { min-width: 0; }
}
</style>
