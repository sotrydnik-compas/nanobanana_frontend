<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'

const props = defineProps({
  settings: { type: Object, required: true },
  urls: { type: Array, required: true },
  files: { type: Array, required: true }, // File[]
  referenceUrls: { type: Array, required: true },
  referenceFiles: { type: Array, required: true }, // File[]
  productCardVariants: { type: Array, default: () => [] },
})

const emit = defineEmits([
  'update:settings',
  'update:urls',
  'update:files',
  'update:referenceUrls',
  'update:referenceFiles',
])

const DEFAULT_PRODUCT_CARD_VARIANTS = [
  { key: 'Студийное', label: 'студийное фото', sort_order: 0 },
  { key: 'Имиджевое', label: 'имиджевые варианты', sort_order: 1 },
  { key: 'UGC', label: 'ugc пакет', sort_order: 2 },
]

const aspectPrimary = [
  { value: '1:1', label: '1:1', iconClass: 'ratio-1-1' },
  { value: '3:4', label: '3:4', iconClass: 'ratio-3-4' },
  { value: '9:16', label: '9:16', iconClass: 'ratio-9-16' },
  { value: '16:9', label: '16:9', iconClass: 'ratio-16-9' },
  { value: '4:3', label: '4:3', iconClass: 'ratio-4-3' },
]

const aspectExtra = [
  { value: '2:3', label: '2:3', iconClass: 'ratio-2-3' },
  { value: '3:2', label: '3:2', iconClass: 'ratio-3-2' },
  { value: '4:5', label: '4:5', iconClass: 'ratio-4-5' },
  { value: '5:4', label: '5:4', iconClass: 'ratio-5-4' },
  { value: '21:9', label: '21:9', iconClass: 'ratio-21-9' },
  { value: 'auto', label: 'auto', iconClass: 'ratio-auto' },
]

const resolutionOptions = [
  { value: '1K', title: 'Стандартное', sub: '(1K)' },
  { value: '2K', title: 'Высокое', sub: '(2K)' },
  { value: '4K', title: 'Максимальное', sub: '(4K)' },
]

const sortedProductCardVariants = computed(() => {
  const src = props.productCardVariants?.length
    ? props.productCardVariants
    : DEFAULT_PRODUCT_CARD_VARIANTS

  return [...src].sort((a, b) => Number(a?.sort_order ?? 0) - Number(b?.sort_order ?? 0))
})

const showAllAspect = ref(false)

const fileInput = ref(null)
const referenceFileInput = ref(null)

const urlInput = ref('')
const referenceUrlInput = ref('')

const maxSizeMB = 100
const allowed = ['image/jpeg', 'image/png', 'image/webp']

const maxMainTotal = computed(() => (props.settings.mode === 'batch' ? 100 : 7))
const totalMainRefs = computed(() => (props.urls.length || 0) + (props.files.length || 0))
const remainingMain = computed(() => Math.max(0, maxMainTotal.value - totalMainRefs.value))

const maxReferenceTotal = 5
const totalReferenceRefs = computed(
  () => (props.referenceUrls.length || 0) + (props.referenceFiles.length || 0)
)
const remainingReference = computed(
  () => Math.max(0, maxReferenceTotal - totalReferenceRefs.value)
)

const filePreviews = ref([])
const referenceFilePreviews = ref([])

function cleanupPreviews(list) {
  for (const url of list) {
    try {
      URL.revokeObjectURL(url)
    } catch {}
  }
}

function cleanupFilePreviews() {
  cleanupPreviews(filePreviews.value)
  filePreviews.value = []
}

function cleanupReferenceFilePreviews() {
  cleanupPreviews(referenceFilePreviews.value)
  referenceFilePreviews.value = []
}

watch(
  () => props.files,
  (files) => {
    cleanupFilePreviews()
    filePreviews.value = (files || []).map((f) => {
      try {
        return URL.createObjectURL(f)
      } catch {
        return ''
      }
    })
  },
  { immediate: true, deep: true }
)

watch(
  () => props.referenceFiles,
  (files) => {
    cleanupReferenceFilePreviews()
    referenceFilePreviews.value = (files || []).map((f) => {
      try {
        return URL.createObjectURL(f)
      } catch {
        return ''
      }
    })
  },
  { immediate: true, deep: true }
)

onBeforeUnmount(() => {
  cleanupFilePreviews()
  cleanupReferenceFilePreviews()
})

function openPicker() {
  if (remainingMain.value <= 0) return
  fileInput.value?.click()
}

function openReferencePicker() {
  if (remainingReference.value <= 0) return
  referenceFileInput.value?.click()
}

function isValidUrl(u) {
  try {
    new URL(u)
    return true
  } catch {
    return false
  }
}

function buildNextFiles(fileList, currentFiles, limitLeft) {
  const arr = Array.from(fileList || [])
  if (!arr.length || limitLeft <= 0) return [...currentFiles]

  const next = [...currentFiles]
  let left = limitLeft

  for (const f of arr) {
    if (left <= 0) break
    if (!allowed.includes(f.type)) continue
    if (f.size > maxSizeMB * 1024 * 1024) continue
    next.push(f)
    left--
  }

  return next
}

function addUrl() {
  const u = urlInput.value.trim()
  if (!u || remainingMain.value <= 0) return
  if (!isValidUrl(u)) return

  if (!props.urls.includes(u)) {
    emit('update:urls', [...props.urls, u])
  }

  urlInput.value = ''
}

function addReferenceUrl() {
  const u = referenceUrlInput.value.trim()
  if (!u || remainingReference.value <= 0) return
  if (!isValidUrl(u)) return

  if (!props.referenceUrls.includes(u)) {
    emit('update:referenceUrls', [...props.referenceUrls, u])
  }

  referenceUrlInput.value = ''
}

function removeUrl(u) {
  emit('update:urls', props.urls.filter((x) => x !== u))
}

function removeReferenceUrl(u) {
  emit('update:referenceUrls', props.referenceUrls.filter((x) => x !== u))
}

function addFiles(fileList) {
  const next = buildNextFiles(fileList, props.files, remainingMain.value)
  emit('update:files', next)
}

function addReferenceFiles(fileList) {
  const next = buildNextFiles(fileList, props.referenceFiles, remainingReference.value)
  emit('update:referenceFiles', next)
}

function removeFile(idx) {
  const next = [...props.files]
  next.splice(idx, 1)
  emit('update:files', next)
}

function removeReferenceFile(idx) {
  const next = [...props.referenceFiles]
  next.splice(idx, 1)
  emit('update:referenceFiles', next)
}

function onPickFiles(e) {
  addFiles(e.target.files)
  e.target.value = ''
}

function onPickReferenceFiles(e) {
  addReferenceFiles(e.target.files)
  e.target.value = ''
}

function onDrop(e) {
  addFiles(e.dataTransfer?.files)
}

function onReferenceDrop(e) {
  addReferenceFiles(e.dataTransfer?.files)
}

function onThumbError(e) {
  const item = e.target?.closest('.preview-item')
  if (item) item.dataset.broken = '1'
  e.target.style.opacity = '0'
}
</script>

<template>
  <div class="panel">
    <div class="head">
      <div class="h">Параметры</div>
      <div class="small">
        {{ settings.mode === 'batch' ? 'Изображения' : 'Референсы' }}:
        {{ totalMainRefs }}/{{ maxMainTotal }}
      </div>
    </div>

    <div class="section">
      <div class="lbl">Режим</div>
      <div class="seg mode-seg">
        <button class="segbtn" :class="{ active: settings.mode === 'standard' }" @click="settings.mode='standard'">
          Диалоговый
        </button>
        <button class="segbtn" :class="{ active: settings.mode === 'product_card' }" @click="settings.mode='product_card'">
          Карточка товара
        </button>
        <button class="segbtn" :class="{ active: settings.mode === 'batch' }" @click="settings.mode='batch'">
          Пакетная обработка
        </button>
      </div>
    </div>

    <div class="section" v-if="settings.mode === 'product_card'">
      <div class="lbl">Вариант</div>
      <div class="seg variant-seg">
        <button
          v-for="variant in sortedProductCardVariants"
          :key="variant.key"
          class="segbtn"
          :class="{ active: settings.productVariant === variant.key }"
          @click="settings.productVariant = variant.key"
        >
          {{ variant.key }}
        </button>
      </div>

      <div class="lbl field-lbl">Заголовок *</div>
      <input class="inp" v-model="settings.title" placeholder="Пробуждение силы" />

      <div class="lbl field-lbl">Преимущество *</div>
      <textarea class="ta" v-model="settings.advantage" rows="3" placeholder="Кружка из стекла..." />
    </div>

    <div class="section">
      <div class="lbl">Соотношение сторон</div>

      <div class="aspect-grid">
        <button
          v-for="o in aspectPrimary"
          :key="o.value"
          class="segbtn aspectbtn"
          :class="{ active: settings.aspectRatio === o.value }"
          @click="settings.aspectRatio = o.value"
        >
          <span class="aspect-icon-wrap">
            <span class="aspect-icon" :class="o.iconClass"></span>
          </span>
          <span class="aspect-text">{{ o.label }}</span>
        </button>

        <button class="segbtn aspectbtn" @click="showAllAspect = !showAllAspect">
          <span class="aspect-icon-wrap">
            <span class="aspect-icon ratio-more">{{ showAllAspect ? '−' : '+' }}</span>
          </span>
          <span class="aspect-text">Ещё</span>
        </button>
      </div>

      <div v-if="showAllAspect" class="aspect-grid aspect-grid-extra">
        <button
          v-for="o in aspectExtra"
          :key="o.value"
          class="segbtn aspectbtn"
          :class="{ active: settings.aspectRatio === o.value }"
          @click="settings.aspectRatio = o.value"
        >
          <span class="aspect-icon-wrap">
            <span class="aspect-icon" :class="o.iconClass"></span>
          </span>
          <span class="aspect-text">{{ o.label }}</span>
        </button>
      </div>
    </div>

    <div class="section">
      <div class="lbl">Разрешение</div>
      <div class="res-seg">
        <button
          v-for="opt in resolutionOptions"
          :key="opt.value"
          class="segbtn resbtn"
          :class="{ active: settings.resolution === opt.value }"
          @click="settings.resolution = opt.value"
        >
          <span class="res-title">{{ opt.title }}</span>
          <span class="res-sub">{{ opt.sub }}</span>
        </button>
      </div>

      <div class="request-options">
        <div class="request-option">
          <div class="lbl option-lbl">Google поиск</div>
          <div class="seg option-seg">
            <button
              class="segbtn option-btn"
              :class="{ active: settings.googleSearch === true }"
              @click="settings.googleSearch = true"
            >
              Да
            </button>
            <button
              class="segbtn option-btn"
              :class="{ active: settings.googleSearch === false }"
              @click="settings.googleSearch = false"
            >
              Нет
            </button>
          </div>
        </div>

        <div class="request-option">
          <div class="lbl option-lbl">Формат результата</div>
          <div class="seg option-seg">
            <button
              class="segbtn option-btn"
              :class="{ active: settings.outputFormat === 'png' }"
              @click="settings.outputFormat = 'png'"
            >
              PNG
            </button>
            <button
              class="segbtn option-btn"
              :class="{ active: settings.outputFormat === 'jpg' }"
              @click="settings.outputFormat = 'jpg'"
            >
              JPG
            </button>
          </div>
        </div>
      </div>
    </div>

    <div v-if="settings.mode === 'batch'" class="section">
      <div class="lbl">Общие референсы (Опционально)</div>
      <div class="hint">
        Эти изображения будут общими для всего пакета. Максимум 5.
      </div>

<!--
      <div class="subsection">
        <div class="lbl sub-lbl">URL общих референсов (до 5)</div>
        <div class="row">
          <input class="inp" v-model="referenceUrlInput" placeholder="https://example.com/ref.jpg" />
          <button class="btn" @click="addReferenceUrl" :disabled="remainingReference <= 0">+</button>
        </div>

        <div v-if="referenceUrls.length" class="preview-grid">
          <div
            v-for="u in referenceUrls"
            :key="u"
            class="preview-item"
            data-kind="URL"
          >
            <img class="preview-img" :src="u" alt="" loading="lazy" @error="onThumbError" />
            <button class="preview-remove" type="button" @click.stop="removeReferenceUrl(u)">✕</button>
          </div>
        </div>
      </div>
      -->

      <div class="subsection">
        <div class="lbl sub-lbl">Файлы общих референсов (jpg/png/webp, до {{ maxSizeMB }}MB)</div>

        <div
          class="drop"
          :class="{ disabled: remainingReference <= 0 }"
          @click="openReferencePicker"
          @dragover.prevent
          @drop.prevent="onReferenceDrop"
        >
          <div class="drop-title">Нажми или перетащи общие референсы</div>
          <div class="drop-sub">({{ totalReferenceRefs }}/{{ maxReferenceTotal }})</div>
        </div>

        <input
          ref="referenceFileInput"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          @change="onPickReferenceFiles"
          :disabled="remainingReference <= 0"
          style="display:none;"
        />

        <div v-if="referenceFiles.length" class="preview-grid">
          <div
            v-for="(f, idx) in referenceFiles"
            :key="`${f.name}-${idx}`"
            class="preview-item"
            data-kind="FILE"
          >
            <img
              v-if="referenceFilePreviews[idx]"
              class="preview-img"
              :src="referenceFilePreviews[idx]"
              alt=""
              loading="lazy"
              @error="onThumbError"
            />
            <button class="preview-remove" type="button" @click.stop="removeReferenceFile(idx)">✕</button>
          </div>
        </div>
      </div>
    </div>

<!--
    <div class="section">
      <div class="lbl">
        {{ settings.mode === 'batch' ? 'URL изображений для пакетной обработки (до 100)' : 'URL-референсы' }}
      </div>

      <div class="row">
        <input class="inp" v-model="urlInput" placeholder="https://example.com/img.jpg" />
        <button class="btn" @click="addUrl" :disabled="remainingMain <= 0">+</button>
      </div>

      <div v-if="urls.length" class="preview-grid">
        <div
          v-for="u in urls"
          :key="u"
          class="preview-item"
          data-kind="URL"
        >
          <img class="preview-img" :src="u" alt="" loading="lazy" @error="onThumbError" />
          <button class="preview-remove" type="button" @click.stop="removeUrl(u)">✕</button>
        </div>
      </div>
    </div>
    -->

    <div v-if="settings.mode !== 'standard'" class="section">
      <div class="lbl">
        {{ settings.mode === 'batch' ? 'Файлы для пакетной обработки (до 100, jpg/png/webp)' : `Файлы (jpg/png/webp, до ${maxSizeMB}MB)` }}
      </div>

      <div
        class="drop"
        :class="{ disabled: remainingMain <= 0 }"
        @click="openPicker"
        @dragover.prevent
        @drop.prevent="onDrop"
      >
        <div class="drop-title">
          {{ settings.mode === 'batch' ? 'Нажми или перетащи изображения для пакетной обработки' : 'Нажми или перетащи для загрузки изображений' }}
        </div>
        <div class="drop-sub">({{ totalMainRefs }}/{{ maxMainTotal }})</div>
      </div>

      <input
        ref="fileInput"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        @change="onPickFiles"
        :disabled="remainingMain <= 0"
        style="display:none;"
      />

      <div v-if="files.length" class="preview-grid">
        <div
          v-for="(f, idx) in files"
          :key="`${f.name}-${idx}`"
          class="preview-item"
          data-kind="FILE"
        >
          <img
            v-if="filePreviews[idx]"
            class="preview-img"
            :src="filePreviews[idx]"
            alt=""
            loading="lazy"
            @error="onThumbError"
          />
          <button class="preview-remove" type="button" @click.stop="removeFile(idx)">✕</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.panel {
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 16px;
  overflow: auto;
  height: 100%;
  min-height: 0;
  padding: 10px;
  color: var(--text);
}

.head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.h {
  font-weight: 900;
}

.small {
  font-size: 12px;
  color: var(--muted);
}

.section {
  margin-bottom: 14px;
}

.subsection + .subsection {
  margin-top: 12px;
}

.lbl {
  font-size: 12px;
  font-weight: 900;
  color: var(--theadText);
  margin-bottom: 6px;
}

.sub-lbl {
  margin-bottom: 6px;
}

.field-lbl {
  margin-top: 10px;
}

.hint {
  margin-bottom: 8px;
  font-size: 12px;
  color: var(--muted);
  line-height: 1.35;
}

.inp,
.ta {
  width: 100%;
  box-sizing: border-box;
  border: 1px solid var(--border);
  background: var(--card2);
  color: var(--text);
  border-radius: 12px;
  padding: 10px;
  font-size: 13px;
}

.ta {
  resize: vertical;
}

.seg {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.mode-seg .segbtn,
.variant-seg .segbtn {
  flex: 1 1 0;
  min-width: 0;
}

.segbtn {
  border: 1px solid var(--border);
  background: var(--card);
  color: var(--text);
  border-radius: 12px;
  padding: 8px 10px;
  cursor: pointer;
  font-weight: 900;
  font-size: 12px;
}

.segbtn.active {
  border-color: var(--primary);
  box-shadow: var(--primary);
  background: var(--card2);
}

.aspect-grid {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 6px;
}

.aspect-grid-extra {
  margin-top: 6px;
}

.aspectbtn {
  min-width: 0;
  min-height: 64px;
  padding: 6px 4px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
}

.aspect-icon-wrap {
  height: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.aspect-icon {
  display: inline-block;
  border: 2px solid #7a8ba8;
  border-radius: 0;
  background: transparent;
}

.ratio-1-1 { width: 14px; height: 14px; }
.ratio-3-4 { width: 12px; height: 16px; }
.ratio-9-16 { width: 10px; height: 18px; }
.ratio-16-9 { width: 18px; height: 10px; }
.ratio-4-3 { width: 16px; height: 12px; }

.ratio-2-3 { width: 11px; height: 16px; }
.ratio-3-2 { width: 16px; height: 11px; }
.ratio-4-5 { width: 13px; height: 16px; }
.ratio-5-4 { width: 16px; height: 13px; }
.ratio-21-9 { width: 20px; height: 9px; }
.ratio-auto {
  width: 16px;
  height: 16px;
  border-style: dashed;
}

.ratio-more {
  width: 16px;
  height: 16px;
  border: none;
  font-size: 18px;
  line-height: 16px;
  color: #7a8ba8;
  text-align: center;
}

.aspect-text {
  font-size: 11px;
  font-weight: 900;
  line-height: 1;
}

.res-seg {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}

.request-options {
  margin-top: 10px;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  align-items: start;
}

.request-option {
  min-width: 0;
}

.option-lbl {
  margin-bottom: 6px;
  text-align: center;
}

.option-seg {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.option-btn {
  min-width: 0;
}

.resbtn {
  min-width: 0;
  min-height: 58px;
  padding: 6px 8px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 2px;
  text-align: center;
}

.res-title,
.res-sub {
  display: block;
  line-height: 1.05;
}

.row {
  display: flex;
  gap: 8px;
  align-items: center;
}

.btn {
  width: 42px;
  height: 42px;
  border-radius: 12px;
  border: 1px solid var(--border);
  background: var(--card);
  color: var(--text);
  cursor: pointer;
  font-weight: 900;
}

.btn:disabled {
  opacity: .6;
  cursor: not-allowed;
}

.drop {
  border: 2px dashed var(--border);
  background: var(--card2);
  border-radius: 14px;
  padding: 18px 12px;
  text-align: center;
  cursor: pointer;
}

.drop.disabled {
  opacity: .6;
  cursor: not-allowed;
}

.drop-title {
  font-weight: 900;
  color: var(--text);
}

.drop-sub {
  margin-top: 6px;
  font-size: 12px;
  color: var(--muted);
  font-weight: 800;
}

.preview-grid {
  margin-top: 8px;
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
}

.preview-item {
  position: relative;
  aspect-ratio: 1 / 1;
  border: 1px solid var(--border);
  background: var(--card2);
  border-radius: 12px;
  overflow: hidden;
}

.preview-item[data-broken="1"]::after {
  content: attr(data-kind);
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  font-size: 11px;
  font-weight: 900;
  color: var(--muted);
}

.preview-img {
  width: 100%;
  height: 100%;
  display: block;
  object-fit: cover;
}

.preview-remove {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 20px;
  height: 20px;
  border: none;
  border-radius: 999px;
  background: rgba(0, 0, 0, .68);
  color: #fff;
  cursor: pointer;
  font-size: 12px;
  font-weight: 900;
  line-height: 20px;
  padding: 0;
}

@media (max-width: 980px) {
  .aspect-grid {
    gap: 6px;
  }

  .aspectbtn {
    min-height: 60px;
    padding: 6px 3px;
  }

  .aspect-text {
    font-size: 10px;
  }

  .resbtn {
    min-height: 54px;
    padding: 6px 6px;
  }

  .request-options {
    grid-template-columns: 1fr;
  }

  .preview-grid {
    gap: 7px;
  }
}

:global(.widget-compact-980) .aspect-grid {
  gap: 6px;
}

:global(.widget-compact-980) .aspectbtn {
  min-height: 60px;
  padding: 6px 3px;
}

:global(.widget-compact-980) .aspect-text {
  font-size: 10px;
}

:global(.widget-compact-980) .resbtn {
  min-height: 54px;
  padding: 6px 6px;
}

:global(.widget-compact-980) .request-options {
  grid-template-columns: 1fr;
}

:global(.widget-compact-980) .preview-grid {
  gap: 7px;
}
</style>
