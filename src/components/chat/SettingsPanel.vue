<script setup>
import { computed, ref, watch } from 'vue'

const props = defineProps({
  settings: { type: Object, required: true },
  urls: { type: Array, required: true },
  files: { type: Array, required: true }, // File[]
})
const emit = defineEmits(['update:settings', 'update:urls', 'update:files'])

const aspectOptions = [
  '1:1','2:3','3:2','3:4','4:3','4:5','5:4','9:16','16:9','21:9','auto'
]

const urlInput = ref('')
const maxTotal = 7
const maxSizeMB = 10 // из ai settings MAX_UPLOAD_MB
const allowed = ['image/jpeg','image/png','image/webp']

const totalRefs = computed(() => (props.urls.length || 0) + (props.files.length || 0))
const remaining = computed(() => Math.max(0, maxTotal - totalRefs.value))

function addUrl() {
  const u = urlInput.value.trim()
  if (!u) return
  if (remaining.value <= 0) return

  try { new URL(u) } catch { return }
  if (!props.urls.includes(u)) {
    emit('update:urls', [...props.urls, u])
  }
  urlInput.value = ''
}

function removeUrl(u) {
  emit('update:urls', props.urls.filter(x => x !== u))
}

function addFiles(fileList) {
  const arr = Array.from(fileList || [])
  if (!arr.length) return
  let left = remaining.value
  if (left <= 0) return

  const next = [...props.files]
  for (const f of arr) {
    if (left <= 0) break
    if (!allowed.includes(f.type)) continue
    if (f.size > maxSizeMB * 1024 * 1024) continue
    next.push(f)
    left--
  }
  emit('update:files', next)
}

function removeFile(idx) {
  const next = [...props.files]
  next.splice(idx, 1)
  emit('update:files', next)
}

function onPickFiles(e) {
  addFiles(e.target.files)
  e.target.value = ''
}
</script>

<template>
  <div class="panel">
    <div class="head">
      <div class="h">Параметры</div>
      <div class="small">Референсы: {{ totalRefs }}/{{ maxTotal }}</div>
    </div>

    <div class="section">
      <div class="lbl">Режим</div>
      <div class="seg">
        <button class="segbtn" :class="{ active: settings.mode === 'standard' }" @click="settings.mode='standard'">
          Стандартный
        </button>
        <button class="segbtn" :class="{ active: settings.mode === 'product_card' }" @click="settings.mode='product_card'">
          Карточка товара
        </button>
      </div>
    </div>

    <div class="section" v-if="settings.mode === 'product_card'">
      <div class="lbl">Вариант</div>
      <div class="seg">
        <button class="segbtn" :class="{ active: settings.productVariant==='studio' }" @click="settings.productVariant='studio'">Студийное</button>
        <button class="segbtn" :class="{ active: settings.productVariant==='image' }" @click="settings.productVariant='image'">Имиджевое</button>
        <button class="segbtn" :class="{ active: settings.productVariant==='ugc' }" @click="settings.productVariant='ugc'">UGC</button>
      </div>

      <div class="lbl" style="margin-top:10px;">Заголовок *</div>
      <input class="inp" v-model="settings.title" placeholder="Пробуждение силы" />

      <div class="lbl" style="margin-top:10px;">Преимущество *</div>
      <textarea class="ta" v-model="settings.advantage" rows="3" placeholder="Кружка из стекла..." />
    </div>

    <div class="section">
      <div class="lbl">Соотношение сторон</div>
      <select class="sel" v-model="settings.aspectRatio">
        <option v-for="o in aspectOptions" :key="o" :value="o">{{ o }}</option>
      </select>
    </div>

    <div class="section">
      <div class="lbl">Разрешение</div>
      <div class="seg">
        <button class="segbtn" :class="{ active: settings.resolution==='1K' }" @click="settings.resolution='1K'">1K</button>
        <button class="segbtn" :class="{ active: settings.resolution==='2K' }" @click="settings.resolution='2K'">2K</button>
        <button class="segbtn" :class="{ active: settings.resolution==='4K' }" @click="settings.resolution='4K'">4K</button>
      </div>
    </div>

    <div class="section">
      <div class="lbl">URL-референсы</div>
      <div class="row">
        <input class="inp" v-model="urlInput" placeholder="https://example.com/img.jpg" />
        <button class="btn" @click="addUrl" :disabled="remaining<=0">+</button>
      </div>

      <div v-if="urls.length" class="chips">
        <div class="chip" v-for="u in urls" :key="u">
          <span class="ct">{{ u }}</span>
          <button class="x" @click="removeUrl(u)">✕</button>
        </div>
      </div>
    </div>

    <div class="section">
      <div class="lbl">Файлы (jpg/png/webp, до {{ maxSizeMB }}MB)</div>
      <input type="file" accept="image/jpeg,image/png,image/webp" multiple @change="onPickFiles" :disabled="remaining<=0" />
      <div class="files" v-if="files.length">
        <div class="file" v-for="(f, idx) in files" :key="idx">
          <div class="fn">{{ f.name }}</div>
          <button class="mini" @click="removeFile(idx)">Удалить</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.panel { background:#fff; border:1px solid #e5e7eb; border-radius:16px; overflow:auto; height: calc(100vh - 80px); padding: 10px; }
.head { display:flex; justify-content:space-between; align-items:center; margin-bottom: 10px; }
.h { font-weight: 900; }
.small { font-size: 12px; color:#6b7280; }
.section { margin-bottom: 14px; }
.lbl { font-size: 12px; font-weight: 900; color:#374151; margin-bottom: 6px; }
.inp, .ta, .sel { width:100%; box-sizing:border-box; border:1px solid #e5e7eb; background:#fafafa; border-radius:12px; padding:10px; font-size: 13px; }
.ta { resize: vertical; }
.seg { display:flex; gap:8px; }
.segbtn { flex:1; border:1px solid #e5e7eb; background:#fff; border-radius:12px; padding:8px 10px; cursor:pointer; font-weight:900; font-size:12px; }
.segbtn.active { border-color:#3b82f6; box-shadow:0 0 0 3px rgba(59,130,246,.12); background:#eef2ff; }
.row { display:flex; gap:8px; align-items:center; }
.btn { width:42px; height:42px; border-radius:12px; border:1px solid #e5e7eb; background:#fff; cursor:pointer; font-weight:900; }
.btn:disabled { opacity:.6; cursor:not-allowed; }
.chips { margin-top: 8px; display:flex; flex-wrap:wrap; gap:8px; }
.chip { display:flex; gap:8px; align-items:center; border:1px solid #e5e7eb; background:#fff; border-radius:999px; padding:6px 10px; max-width:100%; }
.ct { font-size: 12px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width: 240px; }
.x { border:none; background:transparent; cursor:pointer; font-weight:900; }
.files { margin-top: 8px; display:flex; flex-direction:column; gap:8px; }
.file { display:flex; justify-content:space-between; gap:10px; border:1px solid #e5e7eb; background:#fff; border-radius:12px; padding:8px 10px; }
.fn { font-size: 12px; font-weight:800; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.mini { border:1px solid #e5e7eb; background:#fff; border-radius:10px; padding:6px 8px; cursor:pointer; font-weight:900; font-size:11px; }
</style>
