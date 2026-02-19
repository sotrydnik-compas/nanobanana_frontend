<script setup>
import MessageBubble from './MessageBubble.vue'

defineProps({
  messages: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
  taskInFlight: { type: Boolean, default: false },
})
</script>

<template>
  <div class="wrap">
    <div v-if="loading" class="muted">Загрузка…</div>

    <div v-else class="msgs">
      <MessageBubble v-for="m in messages" :key="m.id" :msg="m" />

      <div v-if="taskInFlight" class="pending">
        <div class="spinner"></div>
        <div class="t">Задача в обработке…</div>
      </div>

      <div v-if="!messages.length && !taskInFlight" class="muted">
        Напишите сообщение и (опционально) добавьте референсы справа.
      </div>
    </div>
  </div>
</template>

<style scoped>
.wrap { height: 100%; overflow: auto; padding: 12px; background: #fafafa; }
.msgs { display: flex; flex-direction: column; gap: 10px; }
.muted { font-size: 12px; color: #6b7280; }
.pending { display: flex; align-items: center; gap: 10px; padding: 10px; border: 1px dashed #d1d5db; border-radius: 14px; background: #fff; }
.spinner { width: 18px; height: 18px; border-radius: 999px; border: 3px solid #e5e7eb; border-top-color: #3b82f6; animation: spin 0.9s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
.t { font-size: 12px; font-weight: 800; color: #374151; }
</style>
