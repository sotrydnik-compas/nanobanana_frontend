<script setup>
import { onBeforeUnmount, watch } from 'vue'
import { confirmState, resolveConfirm } from '../../utils/confirm'

function no() { resolveConfirm(false) }
function yes() { resolveConfirm(true) }

function onKey(e) {
  if (!confirmState.open) return
  if (e.key === 'Escape') no()
}

watch(
  () => confirmState.open,
  (v) => {
    if (v) document.addEventListener('keydown', onKey)
    else document.removeEventListener('keydown', onKey)
  },
  { immediate: true }
)

onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKey)
})
</script>

<template>
  <Teleport to="body">
    <div v-if="confirmState.open" class="overlay" @mousedown.self="no">
      <div class="modal" role="dialog" aria-modal="true">
        <div class="title">{{ confirmState.title }}</div>
        <div v-if="confirmState.text" class="text">{{ confirmState.text }}</div>

        <div class="actions">
          <button class="btn" type="button" @click="no">{{ confirmState.noText }}</button>
          <button
            class="btn primary"
            :class="{ danger: confirmState.danger }"
            type="button"
            @click="yes"
          >
            {{ confirmState.yesText }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.overlay{
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,.46);
  display:flex;
  align-items:center;
  justify-content:center;
  padding: 16px;
  z-index: 9999;
}

.modal{
  width: 100%;
  max-width: 440px;
  border-radius: 16px;
  border: 1px solid var(--border);
  background: var(--card);
  color: var(--text);
  padding: 14px;
  box-shadow: 0 18px 60px rgba(0,0,0,.25);
}

.title{
  font-weight: 950;
  font-size: 15px;
  margin-bottom: 6px;
}

.text{
  color: var(--muted);
  font-weight: 700;
  font-size: 12px;
  line-height: 1.35;
  margin-bottom: 12px;
}

.actions{
  display:flex;
  gap: 10px;
  justify-content:flex-end;
}

.btn{
  border: 1px solid var(--border);
  background: var(--card);
  color: var(--text);
  border-radius: 12px;
  padding: 10px 12px;
  cursor: pointer;
  font-weight: 900;
  font-size: 12px;
}
.btn.primary{
  background: var(--primary);
  border-color: var(--primary);
  color: var(--primaryText);
}
.btn.primary.danger{
  background: var(--dangerBg);
  border-color: var(--dangerBorder);
  color: var(--dangerText);
}
</style>