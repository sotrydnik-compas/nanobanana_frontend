<script setup>
import { ref } from 'vue'

const props = defineProps({
  disabled: { type: Boolean, default: false },
  hint: { type: String, default: '' },
})
const emit = defineEmits(['send', 'openChats', 'openSettings'])

const prompt = ref('')

function onSend() {
  emit('send', prompt.value)
}
</script>

<template>
  <div class="composer">
    <textarea
      class="ta"
      v-model="prompt"
      :disabled="disabled"
      placeholder="Введите запрос…"
      rows="2"
    />

    <div class="row">
      <div class="hint" v-if="hint">{{ hint }}</div>

      <div class="actions">
        <button class="btn primary" :disabled="disabled" @click="onSend">
          Отправить
        </button>

        <button class="btn only-mobile" :disabled="disabled" @click="$emit('openSettings')" aria-label="Настройки">
          ⚙
        </button>

        <button class="btn only-mobile" type="button" @click="$emit('openChats')">
          Чаты
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.composer { border: 1px solid var(--border); background: var(--card); border-radius: 16px; padding: 10px; color: var(--text); }
.ta { width: 100%; border: 1px solid var(--border); background: var(--card2); color: var(--text); border-radius: 12px; padding: 10px; resize: vertical; font-size: 13px; }

.row { display: flex; justify-content: space-between; align-items: center; gap: 10px; margin-top: 8px; }
.hint { font-size: 12px; color: var(--muted); }

.actions { display: flex; gap: 8px; align-items: center; }

.btn { border: 1px solid var(--border); background: var(--card); color: var(--text); border-radius: 12px; padding: 8px 10px; cursor: pointer; font-weight: 900; font-size: 12px; }
.btn.primary { background: var(--primary); border-color: var(--primary); color: var(--primaryText); }
.btn:disabled { opacity: .6; cursor: not-allowed; }

.only-mobile { display: none; }
@media (max-width: 980px) {
  .only-mobile { display: inline-flex; }
}
</style>