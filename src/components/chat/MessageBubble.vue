<script setup>
import { computed, ref } from 'vue'

const props = defineProps({
  msg: { type: Object, required: true },
})

const emit = defineEmits(['imageLoaded'])

const isUser = computed(() => props.msg.role === 'user')
const isAssistant = computed(() => props.msg.role === 'assistant')

const successFlag = computed(() => props.msg?.meta?.successFlag)
const resultUrl = computed(() => props.msg?.meta?.resultImageUrl || '')
const errMsg = computed(() => props.msg?.meta?.errorMessage || '')
const hasGenerationError = computed(() =>
  successFlag.value === 2 || successFlag.value === 3 || !!errMsg.value
)

const modalOpen = ref(false)
const copied = ref(false)

function openModal() {
  modalOpen.value = true
}

function closeModal() {
  modalOpen.value = false
}

function onImageLoad() {
  emit('imageLoaded')
}

async function copyLink() {
  const url = resultUrl.value
  if (!url) return

  try {
    await navigator.clipboard.writeText(url)
  } catch {
    const ta = document.createElement('textarea')
    ta.value = url
    ta.style.position = 'fixed'
    ta.style.left = '-9999px'
    document.body.appendChild(ta)
    ta.select()
    try { document.execCommand('copy') } catch {}
    document.body.removeChild(ta)
  }

  copied.value = true
  setTimeout(() => (copied.value = false), 1500)
}

function extFromContentType(contentType = '') {
  if (contentType.includes('png')) return 'png'
  if (contentType.includes('webp')) return 'webp'
  if (contentType.includes('jpeg') || contentType.includes('jpg')) return 'jpg'
  return ''
}

function buildDownloadName(url, fallback = 'image', contentType = '') {
  try {
    const parsed = new URL(url)
    const last = parsed.pathname.split('/').pop() || ''
    if (last && last.includes('.')) {
      return decodeURIComponent(last.split('?')[0])
    }
  } catch {}

  const ext = extFromContentType(contentType)
  return ext ? `${fallback}.${ext}` : fallback
}

function openUrlInNewTab(url) {
  if (!url) return
  const a = document.createElement('a')
  a.href = url
  a.target = '_blank'
  a.rel = 'noopener,noreferrer'
  document.body.appendChild(a)
  a.click()
  a.remove()
}

async function downloadImage() {
  const url = resultUrl.value
  if (!url) return

  try {
    const resp = await fetch(url, { mode: 'cors' })
    if (!resp.ok) throw new Error('download_failed')

    const blob = await resp.blob()
    const objectUrl = URL.createObjectURL(blob)

    const a = document.createElement('a')
    a.href = objectUrl
    a.download = buildDownloadName(
      url,
      'generated-image',
      resp.headers.get('content-type') || ''
    )
    document.body.appendChild(a)
    a.click()
    a.remove()

    setTimeout(() => URL.revokeObjectURL(objectUrl), 1000)
  } catch {
    openUrlInNewTab(url)
  }
}
</script>

<template>
  <div class="bubble" :class="{ user: isUser, assistant: isAssistant }">
    <div v-if="isUser" class="text">{{ msg.content }}</div>

    <template v-else>
      <div v-if="hasGenerationError" class="err">
        Ошибка при генерации
      </div>

      <template v-else-if="resultUrl">
        <img
          class="img"
          :src="resultUrl"
          alt="result"
          loading="lazy"
          decoding="async"
          @click="openModal"
          @load="onImageLoad"
        />

        <div class="actions">
          <button class="act" type="button" @click.stop="copyLink">↗ Поделиться</button>
          <button class="act" type="button" @click.stop="downloadImage">⬇ Скачать</button>
          <span v-if="copied" class="copied">Ссылка скопирована</span>
        </div>

        <div v-if="modalOpen" class="modal" @click.self="closeModal">
          <div class="modal-inner">
            <button class="close" type="button" @click="closeModal">✕</button>
            <img class="modal-img" :src="resultUrl" alt="original" />

            <div class="modal-actions">
              <button class="act" type="button" @click="copyLink">↗ Поделиться</button>
              <button class="act" type="button" @click="downloadImage">⬇ Скачать</button>
              <span v-if="copied" class="copied">Ссылка скопирована</span>
            </div>
          </div>
        </div>
      </template>

      <div v-else class="muted">…</div>
    </template>
  </div>
</template>

<style scoped>
.bubble {
  display: inline-flex;
  flex-direction: column;
  width: fit-content;
  max-width: min(820px, 100%);
  padding: 10px 12px;
  border-radius: 16px;
  border: 1px solid var(--border);
  background: var(--card);
  color: var(--text);
}

.bubble.user {
  align-self: flex-end;
  border-color: var(--statusPendingBorder);
  background: var(--statusPendingBg);
}

.bubble.assistant {
  align-self: flex-start;
}

.text {
  white-space: pre-wrap;
  font-size: 13px;
  font-weight: 700;
  color: var(--text);
}

.img {
  width: 100%;
  max-width: 560px;
  max-height: 560px;
  object-fit: cover;
  border-radius: 14px;
  border: 1px solid var(--border);
  display: block;
  cursor: zoom-in;
}

.actions {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-top: 10px;
  flex-wrap: wrap;
}

.act {
  border: 1px solid var(--border);
  background: var(--card2);
  color: var(--text);
  border-radius: 999px;
  padding: 8px 10px;
  cursor: pointer;
  font-weight: 900;
  font-size: 12px;
}

.copied {
  font-size: 12px;
  color: var(--muted);
  font-weight: 800;
}

.err {
  font-size: 12px;
  font-weight: 900;
  color: var(--dangerText);
}

.muted {
  font-size: 12px;
  color: var(--muted);
}

.modal {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,.55);
  display: grid;
  place-items: center;
  z-index: 9999;
  padding: 16px;
}

.modal-inner {
  position: relative;
  width: min(1100px, 98vw);
  max-height: 92vh;
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 16px;
  padding: 12px;
  overflow: auto;
}

.close {
  position: sticky;
  top: 0;
  margin-left: auto;
  display: block;
  border: 1px solid var(--border);
  background: var(--card2);
  color: var(--text);
  border-radius: 12px;
  padding: 8px 10px;
  cursor: pointer;
  font-weight: 900;
}

.modal-img {
  width: 100%;
  border-radius: 14px;
  border: 1px solid var(--border);
  display: block;
  margin-top: 10px;
}

.modal-actions {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-top: 10px;
  flex-wrap: wrap;
}
</style>