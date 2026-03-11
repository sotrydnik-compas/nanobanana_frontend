<script setup>
import { ref } from 'vue'

defineProps({
  disabled: { type: Boolean, default: false },
  inputDisabled: { type: Boolean, default: false },
  placeholder: { type: String, default: 'Введите запрос…' },
  hint: { type: String, default: '' },
  showDownloadAll: { type: Boolean, default: false },
  downloadCount: { type: Number, default: 0 },
})

const emit = defineEmits(['send', 'downloadAll', 'openChats', 'openSettings'])

const prompt = ref('')

function onSend() {
  emit('send', prompt.value)
}

function clearPrompt() {
  prompt.value = ''
}

defineExpose({ clearPrompt })
</script>

<template>
  <div class="composer">
    <div class="ta-wrap" :class="{ 'has-hint': !!hint }">
      <textarea
        class="ta"
        v-model="prompt"
        :disabled="disabled || inputDisabled"
        :placeholder="placeholder"
        rows="2"
      />

      <div v-if="hint" class="ta-hint">
        {{ hint }}
      </div>
    </div>

    <div class="row">

      <div class="actions">
        <button class="btn primary send-btn" :disabled="disabled" @click="onSend">
          Отправить
        </button>

        <button
          class="btn only-mobile settings-btn"
          :disabled="disabled"
          @click="$emit('openSettings')"
          aria-label="Параметры"
          type="button"
        >
          <span>Параметры</span>
          <span aria-hidden="true">⚙</span>
        </button>

        <button class="btn only-mobile" type="button" @click="$emit('openChats')">
          Чаты
        </button>

        <button
          v-if="showDownloadAll"
          class="btn download-btn"
          type="button"
          @click="$emit('downloadAll')"
        >
          Скачать всё
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.composer {
  border: 1px solid var(--border);
  background: var(--card);
  border-radius: 16px;
  padding: 10px;
  color: var(--text);
}

.ta {
  width: 100%;
  border: 1px solid var(--border);
  background: var(--card2);
  color: var(--text);
  border-radius: 12px;
  padding: 10px;
  resize: vertical;
  font-size: 13px;
}

.ta-wrap {
  position: relative;
}

.ta-wrap.has-hint .ta {
  padding-bottom: 34px;
}

.ta-hint {
  position: absolute;
  left: 12px;
  right: 12px;
  bottom: 10px;
  font-size: 12px;
  line-height: 1.2;
  color: var(--muted);
  pointer-events: none;
}

.row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  margin-top: 8px;
}

.actions {
  display: flex;
  gap: 8px;
  align-items: center;
  width: 100%;
  justify-content: space-between;
}

.send-btn {
  margin-right: auto;
}

.download-btn {
  margin-left: auto;
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

.btn:disabled {
  opacity: .6;
  cursor: not-allowed;
}

.only-mobile {
  display: none;
}

.settings-btn {
  align-items: center;
  gap: 6px;
}

@media (max-width: 980px) {
  .only-mobile {
    display: inline-flex;
  }

  .row {
    align-items: flex-start;
  }

  .actions {
    justify-content: space-between;
  }

  .send-btn {
    margin-right: 0;
  }

  .download-btn {
    margin-left: 0;
  }
}
</style>