<script setup>
import { ref } from 'vue'

const props = defineProps({
  disabled: { type: Boolean, default: false },
  hint: { type: String, default: '' },
})
const emit = defineEmits(['send'])

const prompt = ref('')

function onSend() {
  emit('send', prompt.value)
  // prompt не чистим здесь — можно чистить по желанию, но сейчас оставим как есть
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
      <button class="btn primary" :disabled="disabled" @click="onSend">
        Отправить
      </button>
    </div>
  </div>
</template>

<style scoped>
.composer { border: 1px solid #e5e7eb; background: #fff; border-radius: 16px; padding: 10px; }
.ta { width: 100%; box-sizing: border-box; border: 1px solid #e5e7eb; background: #fafafa; border-radius: 12px; padding: 10px; resize: vertical; font-size: 13px; }
.row { display: flex; justify-content: space-between; align-items: center; gap: 10px; margin-top: 8px; }
.hint { font-size: 12px; color: #6b7280; }
.btn { border: 1px solid #e5e7eb; background: #fff; border-radius: 12px; padding: 8px 10px; cursor: pointer; font-weight: 900; font-size: 12px; }
.btn.primary { background: #2563eb; border-color: #2563eb; color: #fff; }
.btn:disabled { opacity: .6; cursor: not-allowed; }
</style>
