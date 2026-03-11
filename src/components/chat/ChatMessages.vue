<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import MessageBubble from './MessageBubble.vue'

const props = defineProps({
  chatId: { type: [String, Number, null], default: null },
  messages: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
  taskInFlight: { type: Boolean, default: false },
})

const wrapRef = ref(null)
let delayedScrollTimer = null

function scrollToBottom() {
  const el = wrapRef.value
  if (!el) return
  el.scrollTop = el.scrollHeight
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

const scrollKey = computed(() => {
  const last = props.messages[props.messages.length - 1]
  return [
    props.chatId ?? 'new',
    props.loading ? 1 : 0,
    props.taskInFlight ? 1 : 0,
    props.messages.length,
    last?.id || '',
    last?.createdAt || '',
  ].join('|')
})

onMounted(() => {
  scheduleScrollToBottom()
})

watch(
  scrollKey,
  () => {
    scheduleScrollToBottom()
  },
  { flush: 'post' }
)

onBeforeUnmount(() => {
  if (delayedScrollTimer) clearTimeout(delayedScrollTimer)
})
</script>

<template>
  <div ref="wrapRef" class="wrap">
    <div v-if="loading" class="muted">Загрузка…</div>

    <div v-else class="msgs">
      <MessageBubble
        v-for="m in messages"
        :key="m.id"
        :msg="m"
        @imageLoaded="scheduleScrollToBottom"
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