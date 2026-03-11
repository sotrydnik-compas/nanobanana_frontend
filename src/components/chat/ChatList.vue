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

        <div class="actions">
          <button class="mini" @click.stop="$emit('closeChat', c.chatId)">Закрыть</button>
          <button class="mini danger" @click.stop="$emit('deleteChat', c.chatId)">Удалить</button>
        </div>
      </div>

      <div v-if="!chats.length" class="muted">Пока нет чатов. Нажмите «Новый».</div>
    </div>
  </div>
</template>

<style scoped>
.panel {
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 16px;
  overflow: hidden;
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.head {
  padding: 10px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid var(--border);
}

.h { font-weight: 900; color: var(--text); }

.list {
  overflow: auto;
  min-height: 0;
  padding: 8px;
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 8px;
}

.item {
  border: 1px solid var(--border);
  background: var(--card2);
  border-radius: 14px;
  padding: 10px;
  cursor: pointer;
  color: var(--text);
}

.item:hover { background: var(--card2Hover); }

.item.active {
  border-color: var(--primary);
  box-shadow: 0 0 0 3px rgba(59,130,246,.12);
}

.row {
  display: flex;
  gap: 8px;
  align-items: center;
  justify-content: space-between;
}

.title {
  font-weight: 900;
  font-size: 13px;
  max-width: 180px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--text);
}

.meta {
  font-size: 12px;
  color: var(--muted);
  margin-top: 4px;
}

.badge {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 999px;
  border: 1px solid var(--border);
  color: var(--theadText);
  background: var(--card);
}

.badge.closed {
  background: var(--dangerBg);
  border-color: var(--dangerBorder);
  color: var(--dangerText);
}

.actions { margin-top: 8px; display: flex; gap: 8px; }

.mini {
  font-size: 11px;
  padding: 6px 8px;
  border-radius: 10px;
  border: 1px solid var(--border);
  background: var(--card);
  color: var(--text);
  cursor: pointer;
  font-weight: 800;
}

.mini.danger {
  border-color: var(--dangerBorder);
  background: var(--dangerBg);
  color: var(--dangerText);
}

.btn {
  border: 1px solid var(--border);
  background: var(--card);
  color: var(--text);
  border-radius: 12px;
  padding: 8px 10px;
  cursor: pointer;
  font-weight: 900;
  font-size: 12px;
}

.btn.primary {
  background: var(--primary);
  border-color: var(--primary);
  color: var(--primaryText);
}

.muted { padding: 10px; font-size: 12px; color: var(--muted); }
</style>
