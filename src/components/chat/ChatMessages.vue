<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import MessageBubble from './MessageBubble.vue'

const props = defineProps({
  chatId: { type: [String, Number, null], default: null },
  messages: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
  taskInFlight: { type: Boolean, default: false },
  assistantResultUrls: { type: Array, default: () => [] },
})

const wrapRef = ref(null)
const SCROLL_STORAGE_KEY = 'ai_chat_scroll_positions_v1'

let delayedScrollTimer = null
let restoreTimer = null

const shouldStickToBottom = ref(true)
const pendingRestoreChatKey = ref('')
const restoringScroll = ref(false)
const restoreTargetTop = ref(null)

function readScrollPositions() {
  try {
    const raw = sessionStorage.getItem(SCROLL_STORAGE_KEY)
    const parsed = raw ? JSON.parse(raw) : {}
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function writeScrollPositions(data) {
  try {
    sessionStorage.setItem(SCROLL_STORAGE_KEY, JSON.stringify(data || {}))
  } catch {}
}

const scrollPositions = ref(readScrollPositions())

function getChatKey(chatId = props.chatId) {
  return chatId == null ? 'new' : String(chatId)
}

function hasSavedScrollPosition(chatId = props.chatId) {
  return Number.isFinite(scrollPositions.value[getChatKey(chatId)])
}

function isNearBottom(threshold = 96) {
  const el = wrapRef.value
  if (!el) return true
  return el.scrollHeight - el.scrollTop - el.clientHeight <= threshold
}

function saveScrollPosition(chatId = props.chatId) {
  const el = wrapRef.value
  if (!el || chatId == null) return

  scrollPositions.value = {
    ...scrollPositions.value,
    [getChatKey(chatId)]: el.scrollTop,
  }
  writeScrollPositions(scrollPositions.value)
}

function scrollToBottom() {
  const el = wrapRef.value
  if (!el) return
  el.scrollTop = el.scrollHeight
  restoreTargetTop.value = el.scrollTop
  shouldStickToBottom.value = true
}

function cancelRestoreTracking() {
  pendingRestoreChatKey.value = ''
  restoringScroll.value = false
  restoreTargetTop.value = null

  if (restoreTimer) {
    clearTimeout(restoreTimer)
    restoreTimer = null
  }
}

function scheduleScrollToBottom() {
  if (delayedScrollTimer) {
    clearTimeout(delayedScrollTimer)
    delayedScrollTimer = null
  }

  nextTick(() => {
    requestAnimationFrame(() => {
      scrollToBottom()
      delayedScrollTimer = setTimeout(scrollToBottom, 120)
    })
  })
}

function restoreScrollPosition() {
  const el = wrapRef.value
  if (!el) return

  const key = getChatKey()
  const saved = scrollPositions.value[key]

  if (Number.isFinite(saved)) {
    el.scrollTop = saved
    restoreTargetTop.value = el.scrollTop
    shouldStickToBottom.value = isNearBottom()
    return
  }

  scrollToBottom()
}

function scheduleRestoreScrollPosition() {
  if (restoreTimer) {
    clearTimeout(restoreTimer)
    restoreTimer = null
  }

  const restoreKey = getChatKey()
  restoringScroll.value = true
  pendingRestoreChatKey.value = restoreKey

  nextTick(() => {
    requestAnimationFrame(() => {
      restoreScrollPosition()
      restoreTimer = setTimeout(() => {
        restoreScrollPosition()
        if (pendingRestoreChatKey.value === restoreKey) {
          pendingRestoreChatKey.value = ''
        }
        restoringScroll.value = false
      }, 220)
    })
  })
}

function onScroll() {
  const el = wrapRef.value
  if (!el) return

  if (
    restoringScroll.value &&
    restoreTargetTop.value != null &&
    Math.abs(el.scrollTop - Number(restoreTargetTop.value)) > 24
  ) {
    cancelRestoreTracking()
  }

  saveScrollPosition()
  shouldStickToBottom.value = isNearBottom()
}

function onBubbleImageLoaded(payload = {}) {
  if (pendingRestoreChatKey.value === getChatKey() || restoringScroll.value) {
    scheduleRestoreScrollPosition()
    return
  }

  if (payload.kind !== 'assistant-result') return
  if (!payload.isLastMessage) return
  if (!shouldStickToBottom.value) return

  scheduleScrollToBottom()
}

const scrollKey = computed(() => {
  const last = props.messages[props.messages.length - 1]
  return [
    props.chatId ?? 'new',
    props.loading ? 1 : 0,
    props.taskInFlight ? 1 : 0,
    props.messages.length,
    last?.id || '',
    last?.created_at || '',
  ].join('|')
})

onMounted(() => {
  pendingRestoreChatKey.value = getChatKey()
})

watch(
  () => props.chatId,
  (chatId, prevChatId) => {
    saveScrollPosition(prevChatId)
    pendingRestoreChatKey.value = getChatKey(chatId)
    shouldStickToBottom.value = true
  },
  { immediate: true }
)

watch(
  [() => props.chatId, () => props.loading, () => props.messages.length],
  ([chatId, loading]) => {
    if (loading) return
    if (pendingRestoreChatKey.value !== getChatKey(chatId)) return

    if (!hasSavedScrollPosition(chatId)) {
      scrollToBottom()
      cancelRestoreTracking()
      return
    }

    scheduleRestoreScrollPosition()
  },
  { flush: 'post' }
)

watch(
  scrollKey,
  () => {
    if (pendingRestoreChatKey.value) return
    if (restoringScroll.value) return
    if (!shouldStickToBottom.value) return
    scheduleScrollToBottom()
  },
  { flush: 'post' }
)

onBeforeUnmount(() => {
  if (delayedScrollTimer) clearTimeout(delayedScrollTimer)
  if (restoreTimer) clearTimeout(restoreTimer)
  saveScrollPosition()
})
</script>

<template>
  <div ref="wrapRef" class="wrap" @scroll="onScroll">
    <div v-if="loading" class="muted">Загрузка…</div>

    <div v-else class="msgs">
      <MessageBubble
        v-for="(m, idx) in messages"
        :key="m.id"
        :msg="m"
        :assistantResultUrls="assistantResultUrls"
        :isLastMessage="idx === messages.length - 1"
        @imageLoaded="onBubbleImageLoaded"
      />

      <div v-if="taskInFlight" class="pending">
        <div class="spinner"></div>
        <div class="t">Задача в обработке…</div>
      </div>

      <div v-if="!messages.length && !taskInFlight" class="muted">
        Напишите сообщение и опционально добавьте референсы.
      </div>
    </div>
  </div>
</template>

<style scoped>
.msgs {
  display: flex;
  flex-direction: column;
  gap: 10px;
  align-items: flex-start;
}

.wrap {
  height: 100%;
  min-height: 0;
  overflow: auto;
  padding: 12px;
  background: var(--card2);
}

.muted {
  font-size: 12px;
  color: var(--muted);
}

.pending {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px;
  border: 1px dashed var(--border);
  border-radius: 14px;
  background: var(--card);
}

.spinner {
  width: 18px;
  height: 18px;
  border-radius: 999px;
  border: 3px solid var(--border);
  border-top-color: var(--primary);
  animation: spin .9s linear infinite;
}

.t {
  font-size: 12px;
  font-weight: 800;
  color: var(--theadText);
}
</style>
