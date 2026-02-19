<script setup>
defineProps({
  chats: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
  selectedChatId: { type: [String, null], default: null },
})

defineEmits(['newChat', 'selectChat', 'closeChat', 'deleteChat'])

function fmt(ts) {
  if (!ts) return ''
  try { return new Date(ts).toLocaleString() } catch { return '' }
}
</script>

<template>
  <div class="panel">
    <div class="head">
      <div class="h">Чаты</div>
      <button class="btn primary" @click="$emit('newChat')">Новый</button>
    </div>

    <div v-if="loading" class="muted">Загрузка…</div>

    <div v-else class="list">
      <div
        v-for="c in chats"
        :key="c.chatId"
        class="item"
        :class="{ active: selectedChatId === c.chatId }"
        @click="$emit('selectChat', c.chatId)"
      >
        <div class="row">
          <div class="title">{{ c.title || 'Без названия' }}</div>
          <div class="badge" :class="c.status">{{ c.status }}</div>
        </div>
        <div class="meta">{{ fmt(c.updated_at) }}</div>

        <div class="actions" @click.stop>
          <button class="mini" @click="$emit('closeChat', c.chatId)">Закрыть</button>
          <button class="mini danger" @click="$emit('deleteChat', c.chatId)">Удалить</button>
        </div>
      </div>

      <div v-if="!chats.length" class="muted">Пока нет чатов. Нажмите «Новый».</div>
    </div>
  </div>
</template>

<style scoped>
.panel { background: #fff; border: 1px solid #e5e7eb; border-radius: 16px; overflow: hidden; height: calc(100vh - 80px); display: flex; flex-direction: column; }
.head { padding: 10px; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #e5e7eb; }
.h { font-weight: 900; }
.list { overflow: auto; padding: 8px; display: flex; flex-direction: column; gap: 8px; }
.item { border: 1px solid #e5e7eb; border-radius: 14px; padding: 10px; cursor: pointer; }
.item.active { border-color: #3b82f6; box-shadow: 0 0 0 3px rgba(59,130,246,.12); }
.row { display: flex; gap: 8px; align-items: center; justify-content: space-between; }
.title { font-weight: 900; font-size: 13px; max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.meta { font-size: 12px; color: #6b7280; margin-top: 4px; }
.badge { font-size: 11px; padding: 2px 8px; border-radius: 999px; border: 1px solid #e5e7eb; color: #374151; }
.badge.closed { background: #fef2f2; border-color: #fecaca; color: #7f1d1d; }
.actions { margin-top: 8px; display: flex; gap: 8px; }
.mini { font-size: 11px; padding: 6px 8px; border-radius: 10px; border: 1px solid #e5e7eb; background: #fff; cursor: pointer; font-weight: 800; }
.mini.danger { border-color: #fecaca; color: #7f1d1d; }
.btn { border: 1px solid #e5e7eb; background: #fff; border-radius: 12px; padding: 8px 10px; cursor: pointer; font-weight: 900; font-size: 12px; }
.btn.primary { background: #2563eb; border-color: #2563eb; color: #fff; }
.muted { padding: 10px; font-size: 12px; color: #6b7280; }
</style>
