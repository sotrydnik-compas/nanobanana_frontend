<script setup>
import { computed, ref, watch } from 'vue'

const props = defineProps({
  msg: { type: Object, required: true },
  assistantResultUrls: { type: Array, default: () => [] },
  isLastMessage: { type: Boolean, default: false },
})

const emit = defineEmits(['imageLoaded'])

const isUser = computed(() => props.msg.role === 'user')
const isAssistant = computed(() => props.msg.role === 'assistant')
const isBatchUserMessage = computed(() => isUser.value && props.msg?.meta?.batch === true)

const successFlag = computed(() => props.msg?.meta?.successFlag)
const resultUrl = computed(() => props.msg?.meta?.resultImageUrl || '')
const errMsg = computed(() => String(props.msg?.meta?.errorMessage || '').trim())
const contentErrorText = computed(() => String(props.msg?.content || '').trim())
const rawGenerationError = computed(() => errMsg.value || contentErrorText.value || '')
const hasGenerationError = computed(() =>
  successFlag.value === 2 || (!resultUrl.value && !!rawGenerationError.value)
)

function hasCyrillic(text = '') {
  return /[А-Яа-яЁё]/.test(String(text || ''))
}

const generationErrorText = computed(() => {
  const text = rawGenerationError.value
  if (!text) return 'Ошибка генерации'
  return hasCyrillic(text) ? text : 'Ошибка генерации'
})

function normalizeCompareUrl(url) {
  const raw = String(url || '').trim()
  if (!raw) return ''

  try {
    const base = typeof window !== 'undefined' ? window.location.origin : 'http://localhost'
    const parsed = new URL(raw, base)
    return `${parsed.origin}${parsed.pathname}`
  } catch {
    return raw
  }
}

const userReferenceUrls = computed(() => {
  const meta = props.msg?.meta || {}
  const seen = new Set()
  const urls = []
  const raw = []

  // For batch user-messages, prefer showing the current item image being processed.
  if (isBatchUserMessage.value) {
    if (typeof meta.image_url === 'string') raw.push(meta.image_url)
    if (typeof meta.imageUrl === 'string') raw.push(meta.imageUrl)

    const preferred = raw
      .map((item) => String(item || '').trim())
      .filter(Boolean)

    if (preferred.length) {
      for (const url of preferred) {
        if (seen.has(url)) continue
        seen.add(url)
        urls.push(url)
      }
      return urls
    }
  }

  if (Array.isArray(meta.imageUrls)) raw.push(...meta.imageUrls)
  if (Array.isArray(meta.image_urls)) raw.push(...meta.image_urls)
  if (typeof meta.image_url === 'string') raw.push(meta.image_url)
  if (typeof meta.imageUrl === 'string') raw.push(meta.imageUrl)

  for (const item of raw) {
    const url = String(item || '').trim()
    if (!url || seen.has(url)) continue
    seen.add(url)
    urls.push(url)
  }

  return urls
})

const assistantResultUrlSet = computed(() => {
  const set = new Set()

  for (const item of props.assistantResultUrls || []) {
    const normalized = normalizeCompareUrl(item)
    if (normalized) set.add(normalized)
  }

  return set
})

const visibleUserReferenceUrls = computed(() =>
  userReferenceUrls.value.filter((url) => !assistantResultUrlSet.value.has(normalizeCompareUrl(url)))
)

const userRefsLayout = computed(() => {
  const count = visibleUserReferenceUrls.value.length
  if (!count) return {}

  let columns = 1
  if (count >= 2 && count <= 4) columns = 2
  else if (count >= 5) columns = 3

  let tileSize = 120
  if (count >= 3 && count <= 4) tileSize = 88
  else if (count >= 5 && count <= 6) tileSize = 68
  else if (count >= 7) tileSize = 56

  const gap = count === 1 ? 0 : 8
  const width = columns * tileSize + (columns - 1) * gap

  return {
    width: `${width}px`,
    gap: `${gap}px`,
    gridTemplateColumns: `repeat(${columns}, minmax(0, ${tileSize}px))`,
  }
})

const modalOpen = ref(false)
const modalImageUrl = ref('')
const copied = ref(false)
const assistantImageUnavailable = ref(false)
const brokenUserRefUrls = ref(new Set())

watch(
  resultUrl,
  () => {
    assistantImageUnavailable.value = false
  },
  { immediate: true }
)

watch(
  visibleUserReferenceUrls,
  (urls) => {
    const next = new Set()
    for (const url of urls || []) {
      if (brokenUserRefUrls.value.has(url)) next.add(url)
    }
    brokenUserRefUrls.value = next
  },
  { immediate: true }
)

function openModal(url = resultUrl.value) {
  const target = String(url || '').trim()
  if (!target) return
  modalImageUrl.value = target
  modalOpen.value = true
}

function closeModal() {
  modalOpen.value = false
  modalImageUrl.value = ''
}

function onAssistantImageError() {
  assistantImageUnavailable.value = true
}

function onUserRefError(url) {
  const next = new Set(brokenUserRefUrls.value)
  next.add(String(url || '').trim())
  brokenUserRefUrls.value = next
}

function isBrokenUserRef(url) {
  return brokenUserRefUrls.value.has(String(url || '').trim())
}

function onImageLoad(kind) {
  emit('imageLoaded', {
    kind,
    isLastMessage: props.isLastMessage,
    messageId: props.msg?.id || '',
  })
}

async function copyLink(url = resultUrl.value) {
  const target = String(url || '').trim()
  if (!target) return

  try {
    await navigator.clipboard.writeText(target)
  } catch {
    const ta = document.createElement('textarea')
    ta.value = target
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

async function downloadImage(url = resultUrl.value, fallbackName = 'generated-image') {
  const target = String(url || '').trim()
  if (!target) return

  try {
    const resp = await fetch(target, { mode: 'cors' })
    if (!resp.ok) throw new Error('download_failed')

    const blob = await resp.blob()
    const objectUrl = URL.createObjectURL(blob)

    const a = document.createElement('a')
    a.href = objectUrl
    a.download = buildDownloadName(
      target,
      fallbackName,
      resp.headers.get('content-type') || ''
    )
    document.body.appendChild(a)
    a.click()
    a.remove()

    setTimeout(() => URL.revokeObjectURL(objectUrl), 1000)
  } catch {
    openUrlInNewTab(target)
  }
}
</script>

<template>
  <template v-if="isUser">
    <div v-if="msg.content" class="bubble user">
      <div class="text">{{ msg.content }}</div>
    </div>

    <div v-if="visibleUserReferenceUrls.length" class="bubble user refs-bubble">
      <div
        class="user-refs"
        :class="{ single: visibleUserReferenceUrls.length === 1 }"
        :style="userRefsLayout"
      >
        <template v-for="(url, idx) in visibleUserReferenceUrls" :key="`${url}-${idx}`">
          <img
            v-if="!isBrokenUserRef(url)"
            class="user-ref-img"
            :src="url"
            alt="reference"
            loading="lazy"
            decoding="async"
            @click="openModal(url)"
            @load="onImageLoad('user-ref')"
            @error="onUserRefError(url)"
          />

          <div
            v-else
            class="user-ref-fallback"
          >
            Референс недоступен
          </div>
        </template>
      </div>
    </div>
  </template>

  <div v-else class="bubble assistant">
    <div v-if="hasGenerationError" class="err">
      {{ generationErrorText }}
    </div>

    <template v-else-if="resultUrl && !assistantImageUnavailable">
      <img
        class="img"
        :src="resultUrl"
        alt="result"
        loading="lazy"
        decoding="async"
        @click="openModal(resultUrl)"
        @load="onImageLoad('assistant-result')"
        @error="onAssistantImageError"
      />

      <div class="actions">
        <button class="act" type="button" @click.stop="copyLink(resultUrl)">↗ Поделиться</button>
        <button class="act" type="button" @click.stop="downloadImage(resultUrl)">⬇ Скачать</button>
        <span v-if="copied" class="copied">Ссылка скопирована</span>
      </div>
    </template>

    <div v-else-if="resultUrl" class="info-note">
      Изображение больше недоступно. Срок хранения данных истек.
    </div>

    <div v-else class="muted">…</div>
  </div>

  <div v-if="modalOpen && modalImageUrl" class="modal" @click.self="closeModal">
    <div class="modal-inner">
      <button class="close" type="button" @click="closeModal">✕</button>
      <img class="modal-img" :src="modalImageUrl" alt="original" />

      <div class="modal-actions">
        <button class="act" type="button" @click="copyLink(modalImageUrl)">↗ Поделиться</button>
        <button class="act" type="button" @click="downloadImage(modalImageUrl, 'chat-image')">⬇ Скачать</button>
        <span v-if="copied" class="copied">Ссылка скопирована</span>
      </div>
    </div>
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

.refs-bubble {
  padding: 10px;
  width: fit-content;
}

.text {
  white-space: pre-wrap;
  font-size: 13px;
  font-weight: 700;
  color: var(--text);
}

.user-refs {
  display: inline-grid;
  justify-content: end;
}

.user-refs.single {
  width: auto !important;
}

.user-ref-img {
  width: 100%;
  aspect-ratio: 1 / 1;
  object-fit: cover;
  border-radius: 14px;
  border: 1px solid var(--border);
  display: block;
  background: var(--card);
  cursor: zoom-in;
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

.info-note {
  font-size: 12px;
  font-weight: 800;
  color: var(--muted);
  background: var(--card2);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 10px 12px;
}

.muted {
  font-size: 12px;
  color: var(--muted);
}

.user-ref-fallback {
  width: 100%;
  aspect-ratio: 1 / 1;
  border-radius: 14px;
  border: 1px solid var(--border);
  background: var(--card2);
  color: var(--muted);
  display: grid;
  place-items: center;
  text-align: center;
  padding: 8px;
  font-size: 11px;
  font-weight: 800;
  line-height: 1.2;
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
