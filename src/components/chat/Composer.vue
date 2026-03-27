<script setup>
import { ref } from 'vue'

defineProps({
  disabled: { type: Boolean, default: false },
  inputDisabled: { type: Boolean, default: false },
  placeholder: { type: String, default: 'Введите запрос…' },
  hint: { type: String, default: '' },
  showDownloadAll: { type: Boolean, default: false },
  downloadCount: { type: Number, default: 0 },
  standardMode: { type: Boolean, default: false },
  attachedFiles: { type: Array, default: () => [] },
})

const emit = defineEmits([
  'send',
  'downloadAll',
  'openChats',
  'openSettings',
  'addFiles',
  'removeFile',
])

const prompt = ref('')
const fileInput = ref(null)

function onSend() {
  emit('send', prompt.value)
}

function clearPrompt() {
  prompt.value = ''
}

function openFilePicker() {
  fileInput.value?.click()
}

function onPickFiles(e) {
  emit('addFiles', e.target.files)
  e.target.value = ''
}

function formatFileName(name) {
  const clean = String(name || '')
  return clean.length > 6 ? `${clean.slice(0, 6)}...` : clean
}

defineExpose({ clearPrompt })
</script>

<template>
  <div class="composer">
    <input
      v-if="standardMode"
      ref="fileInput"
      type="file"
      accept="image/jpeg,image/png,image/webp"
      multiple
      style="display:none;"
      @change="onPickFiles"
    />

    <div v-if="standardMode && attachedFiles.length" class="attachments">
      <div
        v-for="(file, idx) in attachedFiles"
        :key="`${file.name}-${file.size}-${idx}`"
        class="file-chip"
        :title="file.name"
      >
        <button
          class="file-remove"
          type="button"
          :disabled="disabled"
          @click="$emit('removeFile', idx)"
          aria-label="Убрать файл"
        >
          ✕
        </button>
        <span class="file-name">{{ formatFileName(file.name) }}</span>
      </div>
    </div>

    <div class="ta-wrap" :class="{ 'has-hint': !!hint, 'has-attach': standardMode }">
      <textarea
        class="ta"
        v-model="prompt"
        :disabled="disabled || inputDisabled"
        :placeholder="placeholder"
        rows="2"
      />

      <button
        v-if="standardMode"
        class="attach-floating"
        :disabled="disabled"
        type="button"
        aria-label="Прикрепить файл"
        @click="openFilePicker"
      >
        📎
      </button>

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

.attachments {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  margin-bottom: 8px;
}

.file-chip {
  flex: 0 1 auto;
  min-width: 0;
  max-width: min(140px, 100%);
  display: inline-flex;
  align-items: center;
  gap: 8px;
  border: 1px solid var(--border);
  background: var(--card2);
  color: var(--text);
  border-radius: 999px;
  padding: 6px 10px 6px 6px;
  white-space: nowrap;
}

.file-remove {
  flex: 0 0 auto;
  width: 22px;
  height: 22px;
  border: 1px solid var(--border);
  background: var(--card);
  color: var(--text);
  border-radius: 999px;
  cursor: pointer;
  font-size: 11px;
  font-weight: 900;
  line-height: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
}

.file-name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
  font-weight: 800;
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

.ta-wrap.has-attach .ta {
  padding-right: 52px;
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

.attach-floating {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 34px;
  height: 34px;
  border: 1px solid var(--border);
  background: var(--card);
  color: var(--text);
  border-radius: 10px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 16px;
  line-height: 1;
  padding: 0;
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
  flex-wrap: wrap;
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

.btn:disabled,
.file-remove:disabled,
.attach-floating:disabled {
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
    justify-content: flex-start;
  }

  .send-btn,
  .download-btn {
    margin-left: 0;
    margin-right: 0;
  }

  .file-chip {
    max-width: 100%;
  }
}
</style>
