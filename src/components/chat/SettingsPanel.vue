<script setup>
import { computed, ref, watch } from 'vue'

const props = defineProps({
  settings: { type: Object, required: true },
  urls: { type: Array, required: true },
  files: { type: Array, required: true }, // File[]
})
const emit = defineEmits(['update:settings', 'update:urls', 'update:files'])

const aspectPrimary = ['1:1', '3:4', '9:16', '16:9', '4:3']
const showAllAspect = ref(false)

const aspectOptions = [
  '2:3','3:2','4:5','5:4','21:9','auto'
]

const fileInput = ref(null)
function openPicker() {
  if (remaining.value <= 0) return
  fileInput.value?.click()
}

function onDrop(e) {
  addFiles(e.dataTransfer?.files)
}

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

      <div class="aspect-scroll">
        <button
          v-for="o in aspectPrimary"
          :key="o"
          class="segbtn"
          :class="{ active: settings.aspectRatio === o }"
          @click="settings.aspectRatio = o"
        >
          {{ o }}
        </button>

        <button class="segbtn" @click="showAllAspect = !showAllAspect">
          {{ showAllAspect ? 'Свернуть' : 'Ещё' }}
        </button>
      </div>

      <div v-if="showAllAspect" class="aspect-all">
        <button
          v-for="o in aspectOptions"
          :key="o"
          class="miniopt"
          :class="{ active: settings.aspectRatio === o }"
          @click="settings.aspectRatio = o"
        >
          {{ o }}
        </button>
      </div>
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

      <div
        class="drop"
        :class="{ disabled: remaining<=0 }"
        @click="openPicker"
        @dragover.prevent
        @drop.prevent="onDrop"
      >
        <div class="drop-title">Нажми или перетащи для загрузки изображений</div>
        <div class="drop-sub">(0/{{ maxTotal }})</div>
      </div>

      <input
        ref="fileInput"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        @change="onPickFiles"
        :disabled="remaining<=0"
        style="display:none;"
      />

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

.head { display:flex; justify-content:space-between; align-items:center; margin-bottom: 10px; }
.h { font-weight: 900; }
.small { font-size: 12px; color: var(--muted); }

.section { margin-bottom: 14px; }
.lbl { font-size: 12px; font-weight: 900; color: var(--theadText); margin-bottom: 6px; }

.inp, .ta, .sel {
  width: 100%;
  box-sizing: border-box;
  border: 1px solid var(--border);
  background: var(--card2);
  color: var(--text);
  border-radius: 12px;
  padding: 10px;
  font-size: 13px;
}
.ta { resize: vertical; }

.seg { display:flex; gap:8px; }
.segbtn {
  flex: 1;
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
  box-shadow: 0 0 0 3px rgba(59,130,246,.18);
  background: var(--card2);
}

.aspect-scroll{
  display:flex;
  gap:8px;
  overflow:auto;
  padding-bottom: 4px;
}
.aspect-all{
  margin-top: 10px;
  display:flex;
  flex-wrap: wrap;
  gap: 8px;
}
.miniopt{
  border: 1px solid var(--border);
  background: var(--card2);
  color: var(--text);
  border-radius: 999px;
  padding: 8px 10px;
  cursor: pointer;
  font-weight: 900;
  font-size: 12px;
}
.miniopt.active{
  border-color: var(--primary);
}

.row { display:flex; gap:8px; align-items:center; }
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
.btn:disabled { opacity:.6; cursor:not-allowed; }

.chips { margin-top: 8px; display:flex; flex-wrap:wrap; gap:8px; }
.chip { display:flex; gap:8px; align-items:center; border:1px solid var(--border); background: var(--card); border-radius:999px; padding:6px 10px; max-width:100%; }
.ct { font-size: 12px; color: var(--text); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width: 240px; }
.x { border:none; background:transparent; color: var(--text); cursor:pointer; font-weight:900; }

.drop{
  border: 2px dashed var(--border);
  background: var(--card2);
  border-radius: 14px;
  padding: 18px 12px;
  text-align: center;
  cursor: pointer;
}
.drop.disabled{ opacity:.6; cursor:not-allowed; }
.drop-title{ font-weight: 900; color: var(--text); }
.drop-sub{ margin-top: 6px; font-size: 12px; color: var(--muted); font-weight: 800; }

.files { margin-top: 8px; display:flex; flex-direction:column; gap:8px; }
.file { display:flex; justify-content:space-between; gap:10px; border:1px solid var(--border); background: var(--card); border-radius:12px; padding:8px 10px; }
.fn { font-size: 12px; font-weight:800; color: var(--text); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.mini { border:1px solid var(--border); background: var(--card2); color: var(--text); border-radius:10px; padding:6px 8px; cursor:pointer; font-weight:900; font-size:11px; }
</style>
