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

const showChatsDrawer = ref(false)
const showSettingsDrawer = ref(false)

const composerRef = ref(null)

const IN_FLIGHT_STORAGE_KEY = 'ai_chat_inflight_v1'
const IN_FLIGHT_TTL_MS = 24 * 60 * 60 * 1000
const inFlightRegistry = reactive({})

function readInFlightStorage() {
  try {
    const raw = localStorage.getItem(IN_FLIGHT_STORAGE_KEY)
    const parsed = raw ? JSON.parse(raw) : {}
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function writeInFlightStorage(data) {
  try {
    localStorage.setItem(IN_FLIGHT_STORAGE_KEY, JSON.stringify(data || {}))
  } catch {}
}

function pruneInFlightStorage(data = readInFlightStorage()) {
  const now = Date.now()
  const next = {}

  for (const [chatId, entry] of Object.entries(data || {})) {
    if (!chatId || !entry || typeof entry !== 'object') continue
    if (!entry.createdAt || now - Number(entry.createdAt) > IN_FLIGHT_TTL_MS) continue
    if (entry.kind !== 'task' && entry.kind !== 'batch') continue
    if (entry.kind === 'task' && !entry.taskId) continue
    if (entry.kind === 'batch' && !entry.batchId) continue
    next[chatId] = entry
  }

  writeInFlightStorage(next)
  return next
}

function syncRegistryFromStorage() {
  const cleaned = pruneInFlightStorage()
  Object.keys(inFlightRegistry).forEach((key) => delete inFlightRegistry[key])
  Object.assign(inFlightRegistry, cleaned)
  return cleaned
}

function setInFlightEntry(chatId, entry) {
  if (!chatId || !entry) return
  const key = String(chatId)
  const nextEntry = {
    ...entry,
    createdAt: entry.createdAt || Date.now(),
  }

  inFlightRegistry[key] = nextEntry
  const data = pruneInFlightStorage()
  data[key] = nextEntry
  writeInFlightStorage(data)
}

function getInFlightEntry(chatId) {
  if (!chatId) return null
  const key = String(chatId)
  const memoryEntry = inFlightRegistry[key]
  if (memoryEntry) return memoryEntry

  const data = syncRegistryFromStorage()
  const entry = data[key] || null
  if (entry) inFlightRegistry[key] = entry
  return entry
}

function clearInFlightEntry(chatId) {
  if (!chatId) return
  const key = String(chatId)
  delete inFlightRegistry[key]

  const data = pruneInFlightStorage()
  if (data[key]) {
    delete data[key]
    writeInFlightStorage(data)
  }
}

function resetCurrentInFlightState() {
  taskInFlight.value = false
  inFlightKind.value = ''
  currentTaskId.value = ''
  currentBatchId.value = ''
}

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

const downloadableImageUrls = computed(() => {
  const seen = new Set()
  const urls = []

  for (const msg of messages.value || []) {
    const url = msg?.meta?.resultImageUrl
    if (!url || seen.has(url)) continue
    seen.add(url)
    urls.push(url)
  }

  return urls
})

function extFromContentType(contentType = '') {
  if (contentType.includes('png')) return 'png'
  if (contentType.includes('webp')) return 'webp'
  if (contentType.includes('jpeg') || contentType.includes('jpg')) return 'jpg'
  return ''
}

function buildDownloadName(url, fallback = 'image', contentType = '') {
  try {
    const parsed = new URL(url)
    const last = parsed.pathname.split('/').pop() || ''
    if (last && last.includes('.')) {
      return decodeURIComponent(last.split('?')[0])
    }
  } catch {}

  const ext = extFromContentType(contentType)
  return ext ? `${fallback}.${ext}` : fallback
}

function openUrlInNewTab(url) {
  if (!url) return
  const a = document.createElement('a')
  a.href = url
  a.target = '_blank'
  a.rel = 'noopener,noreferrer'
  document.body.appendChild(a)
  a.click()
  a.remove()
}

async function downloadUrl(url, fallbackName = 'image') {
  if (!url) return

  try {
    const resp = await fetch(url, { mode: 'cors' })
    if (!resp.ok) throw new Error('download_failed')

    const blob = await resp.blob()
    const objectUrl = URL.createObjectURL(blob)

    const a = document.createElement('a')
    a.href = objectUrl
    a.download = buildDownloadName(
      url,
      fallbackName,
      resp.headers.get('content-type') || ''
    )
    document.body.appendChild(a)
    a.click()
    a.remove()

    setTimeout(() => URL.revokeObjectURL(objectUrl), 1000)
  } catch {
    openUrlInNewTab(url)
  }
}

async function onDownloadAll() {
  const urls = downloadableImageUrls.value
  if (!urls.length) return

  errorText.value = ''
  infoText.value = ''

  for (let i = 0; i < urls.length; i++) {
    const fileName = `chat-${currentChatId.value || 'images'}-${String(i + 1).padStart(2, '0')}`
    await downloadUrl(urls[i], fileName)

    if (i < urls.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 120))
    }
  }

  infoText.value = `Скачивание запущено: ${urls.length}`
}

function closeDrawers() {
  showChatsDrawer.value = false
  showSettingsDrawer.value = false
}

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
  resetCurrentInFlightState()
  stopPolling()
  showChatsDrawer.value = false
}

async function resumeInFlightForChat(chatId) {
  const entry = getInFlightEntry(chatId)
  if (!entry) return

  try {
    if (entry.kind === 'batch' && entry.batchId) {
      const r = await aiApi.getBatch(entry.batchId)
      const st = r?.status || 'pending'
      const doneStatuses = new Set(['completed', 'partial', 'failed', 'cancelled'])

      if (doneStatuses.has(st)) {
        clearInFlightEntry(chatId)
        resetCurrentInFlightState()
        await loadMessages(chatId)
        await loadChats()
        return
      }

      taskInFlight.value = true
      inFlightKind.value = 'batch'
      currentBatchId.value = entry.batchId
      currentTaskId.value = ''
      await startBatchPolling(entry.batchId, chatId)
      return
    }

    if (entry.kind === 'task' && entry.taskId) {
      const r = await fetchTaskOnce(entry.taskId)
      const flag = r?.data?.successFlag ?? 0

      if (flag === 1 || flag === 2 || flag === 3) {
        clearInFlightEntry(chatId)
        resetCurrentInFlightState()
        await loadMessages(chatId)
        await loadChats()
        return
      }

      taskInFlight.value = true
      inFlightKind.value = 'task'
      currentTaskId.value = entry.taskId
      currentBatchId.value = ''
      await startTaskPolling(entry.taskId, chatId)
    }
  } catch {
    // не показываем ошибку при авто-возобновлении — запись останется в localStorage
  }
}

async function onSelectChat(chatId) {
  errorText.value = ''
  infoText.value = ''
  currentChatId.value = chatId

  const found = (chats.value || []).find(c => c.chatId === chatId)
  currentChatStatus.value = found?.status || 'active'

  stopPolling()
  resetCurrentInFlightState()
  await loadMessages(chatId)
  await resumeInFlightForChat(chatId)

  // ✅ на мобилке закрываем drawer со списком чатов после выбора
  showChatsDrawer.value = false
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
    settings.productVariant == 'ugc' ? 'ugc пакет' :
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
      clearInFlightEntry(chatId)
      resetCurrentInFlightState()
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
        clearInFlightEntry(chatId)
        resetCurrentInFlightState()
        await loadMessages(chatId)
        await loadChats()
      }
    } catch (e) {
      errorText.value = e?.message || 'Ошибка опроса статуса'
      stopPolling()
      resetCurrentInFlightState()
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

      infoText.value = `Пакет: ${p.processed ?? 0}/${p.total ?? 0}, ok ${p.success ?? 0}, err ${p.failed ?? 0}, статус: ${st}`

      const processed = Number(p.processed ?? 0)
      const curIdx = Number(p.current_index ?? -1)

      if (processed !== lastProcessed || curIdx !== lastIndex) {
        lastProcessed = processed
        lastIndex = curIdx
        await loadMessages(chatId)
        await loadChats()
      }

      const doneStatuses = new Set(['completed', 'partial', 'failed', 'cancelled'])
      if (doneStatuses.has(st)) {
        stopPolling()
        clearInFlightEntry(chatId)
        resetCurrentInFlightState()
        await loadMessages(chatId)
        await loadChats()
      }
    } catch (e) {
      errorText.value = e?.message || 'Ошибка опроса пакетной задачи'
      stopPolling()
      resetCurrentInFlightState()
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
  composerRef.value?.clearPrompt()

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

      if (currentChatId.value && r.batch_id) {
        setInFlightEntry(currentChatId.value, {
          kind: 'batch',
          batchId: r.batch_id,
        })
      }

      await loadMessages(currentChatId.value)
      await loadChats()

      await startBatchPolling(r.batch_id, currentChatId.value)
      return
    }

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

    if (currentChatId.value && r.taskId) {
      setInFlightEntry(currentChatId.value, {
        kind: 'task',
        taskId: r.taskId,
      })
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
  syncRegistryFromStorage()
  await loadChats()
})

onBeforeUnmount(() => {
  stopPolling()
})
</script>

<template>
  <div class="shell" :class="{ embed: isEmbed }">
    <div class="layout">
      <!-- DESKTOP: список чатов слева -->
      <aside class="left desktop-only">
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

      <!-- CENTER: сообщения + composer -->
      <main class="center">
        <div class="center-inner">
          <div class="card">
            <ChatMessages
              :chatId="currentChatId"
              :messages="messages"
              :loading="messagesLoading"
              :taskInFlight="taskInFlight"
            />
          </div>

          <Composer
            ref="composerRef"
            :disabled="taskInFlight || currentChatStatus === 'closed'"
            :hint="currentChatStatus === 'closed' ? 'Чат закрыт — создайте новый' : ''"
            :showDownloadAll="downloadableImageUrls.length > 0"
            :downloadCount="downloadableImageUrls.length"
            @send="onSend"
            @downloadAll="onDownloadAll"
            @openChats="showChatsDrawer = true"
            @openSettings="showSettingsDrawer = true"
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

      <!-- DESKTOP: параметры справа -->
      <aside class="right desktop-only">
        <SettingsPanel
          v-model:settings="settings"
          v-model:urls="refsState.urls"
          v-model:files="refsState.files"
        />
      </aside>

      <!-- MOBILE: drawer чатов слева -->
      <div v-if="showChatsDrawer" class="overlay" @click.self="showChatsDrawer = false">
        <div class="drawer left-drawer">
          <ChatList
            :chats="chats"
            :loading="chatsLoading"
            :selectedChatId="currentChatId"
            @newChat="onNewChat"
            @selectChat="onSelectChat"
            @closeChat="onCloseChat"
            @deleteChat="onDeleteChat"
          />
        </div>
      </div>

      <!-- MOBILE: drawer настроек справа -->
      <div v-if="showSettingsDrawer" class="overlay" @click.self="showSettingsDrawer = false">
        <div class="drawer right-drawer">
          <SettingsPanel
            v-model:settings="settings"
            v-model:urls="refsState.urls"
            v-model:files="refsState.files"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.shell {
  height: 100%;
  min-height: 0;
}

.layout {
  display: flex;
  gap: 12px;
  padding: 12px;
  height: 100%;
  min-height: 0;
  box-sizing: border-box;
  overflow: hidden; /* внешнего скролла нет */
}

.left, .center, .right {
  min-height: 0;
}

.left {
  flex: 0 0 300px;
}

.center {
  flex: 1;
  min-width: 0;
}

.right {
  /* ✅ фикс: панель доходит до футера и не меняет ширину при "Ещё" */
  flex: 0 0 360px;
  min-width: 360px;
  max-width: 360px;
}

.center-inner {
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.card {
  flex: 1;
  min-height: 0;
  border-radius: 16px;
  background: var(--card);
  border: 1px solid var(--border);
  overflow: hidden; /* скролл внутри ChatMessages */
}

.alert { padding: 10px 12px; border-radius: 14px; border: 1px solid; font-size: 13px; }
.alert.error { background: var(--dangerBg); border-color: var(--dangerBorder); color: var(--dangerText); }
.alert.ok { background: var(--successBg); border-color: var(--successBorder); color: var(--successText); }

.embed .layout { height: 100vh; padding: 0; gap: 0; }
.embed .left { border-right: 1px solid var(--border); height: 100vh; }
.embed .center-inner { height: 100vh; }
.embed .right { display: none; }

/* MOBILE: скрываем боковые панели, включаем drawer */
@media (max-width: 980px) {
  .layout { padding: 10px; }
  .desktop-only { display: none; }
  .left, .right { display: none; }
}

/* drawer */
.overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,.22);
  z-index: 80;
}

.drawer {
  position: fixed;
  top: 0;
  height: 100dvh;
  width: min(340px, 88vw);
  background: var(--card);
  border: 1px solid var(--border);
  overflow: hidden;
}

.left-drawer {
  left: 0;
  border-left: none;
  border-radius: 0 16px 16px 0;
}

.right-drawer {
  right: 0;
  border-right: none;
  border-radius: 16px 0 0 16px;
}

.chat-tools {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

@media (max-width: 980px) {
  .chat-tools {
    justify-content: stretch;
  }

  .chat-tools .btn {
    width: 100%;
  }
}
</style>