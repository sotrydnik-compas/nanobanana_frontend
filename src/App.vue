<script setup>
import { computed, onBeforeUnmount, ref } from "vue";

const API_BASE =
  import.meta.env.VITE_API_BASE?.replace(/\/$/, "");

const isEmbed = new URLSearchParams(window.location.search).get("embed") === "1";


const taskType = ref("i2i"); // "t2i" | "i2i | product_card" (пока только UI)

const prompt = ref("");

const imageUrlInput = ref("");
const imageUrls = ref([]);

const localFiles = ref([]); // { file, name, size, previewUrl }
const maxFiles = 3;

const aspectRatio = ref("auto");
const resolution = ref("1K");

const isSubmitting = ref(false);
const taskId = ref("");
const taskRaw = ref(null);
const errorText = ref("");
const pollTimer = ref(null);

const aspectOptions = [
  { value: "1:1", label: "1:1" },
  { value: "2:3", label: "2:3" },
  { value: "3:2", label: "3:2" },
  { value: "3:4", label: "3:4" },
  { value: "4:3", label: "4:3" },
  { value: "4:5", label: "4:5" },
  { value: "5:4", label: "5:4" },
  { value: "9:16", label: "9:16" },
  { value: "16:9", label: "16:9" },
  { value: "21:9", label: "21:9" },
  { value: "auto", label: "auto" },
];

const productVariant = ref("studio"); // "studio" | "image" | "ugc"
const title = ref("");
const advantage = ref("");
const productVariantOptions = [
  { value: "studio", label: "Студийное фото", promptLabel: "студийное фото" },
  { value: "image", label: "Имиджевые варианты", promptLabel: "имиджевые варианты" },
  { value: "ugc", label: "UGC-пакет", promptLabel: "ugc пакет" },
];


const canAddMoreFiles = computed(() => localFiles.value.length < maxFiles);

function addImageUrl() {
  const url = imageUrlInput.value.trim();
  if (!url) return;

  try {
    new URL(url);
  } catch {
    errorText.value = "Некорректный URL изображения.";
    return;
  }

  errorText.value = "";
  if (!imageUrls.value.includes(url)) imageUrls.value.push(url);
  imageUrlInput.value = "";
}

function removeImageUrl(url) {
  imageUrls.value = imageUrls.value.filter((u) => u !== url);
}

function onUrlKeydown(e) {
  if (e.key === "Enter") {
    e.preventDefault();
    addImageUrl();
  }
}

function addLocalFiles(fileList) {
  errorText.value = "";
  const files = Array.from(fileList || []);
  if (!files.length) return;

  const maxSizeMB = 10; // ограничение в МБ
  const available = maxFiles - localFiles.value.length;
  const sliced = files.slice(0, Math.max(0, available));

  for (const f of sliced) {
    if (f.size > maxSizeMB * 1024 * 1024) { // проверка размера
      errorText.value = `Файл "${f.name}" слишком большой. Максимум ${maxSizeMB} МБ.`;
      continue;
    }
    const previewUrl = URL.createObjectURL(f);
    localFiles.value.push({ file: f, name: f.name, size: f.size, previewUrl });
  }
}


function removeLocalFile(idx) {
  const item = localFiles.value[idx];
  if (item?.previewUrl) URL.revokeObjectURL(item.previewUrl);
  localFiles.value.splice(idx, 1);
}

function onDrop(e) {
  e.preventDefault();
  if (!canAddMoreFiles.value) return;
  addLocalFiles(e.dataTransfer?.files);
}

function onPickFiles(e) {
  if (!canAddMoreFiles.value) return;
  addLocalFiles(e.target.files);
  e.target.value = "";
}

const successFlag = computed(() => taskRaw.value?.data?.successFlag ?? null);
const resultImageUrl = computed(
  () => taskRaw.value?.data?.response?.resultImageUrl || ""
);

function stopPolling() {
  if (pollTimer.value) {
    clearInterval(pollTimer.value);
    pollTimer.value = null;
  }
}

const variantPromptLabel = computed(() => {
  const found = productVariantOptions.find(v => v.value === productVariant.value);
  return found?.promptLabel || "студийное фото";
});

const finalPrompt = computed(() => {
  // Для product_card собираем prompt по шаблону пользователя
  if (taskType.value === "product_card") {
    return `создай мне ${variantPromptLabel.value} для карточки товара для маркетплейса. Заголовок: ${title.value.trim()}. Преимущество этого товара: ${advantage.value.trim()}`;
  }
  // Для остальных режимов оставляем как есть
  return prompt.value.trim();
});


async function fetchTaskOnce(id) {
  const res = await fetch(`${API_BASE}/api/v1/tasks/${encodeURIComponent(id)}`);
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(txt || `Ошибка статуса: ${res.status}`);
  }
  return await res.json();
}

async function startPolling(id) {
  stopPolling();
  taskRaw.value = await fetchTaskOnce(id);

  pollTimer.value = setInterval(async () => {
    try {
      taskRaw.value = await fetchTaskOnce(id);
      const flag = taskRaw.value?.data?.successFlag ?? 0;
      if (flag === 1 || flag === 2 || flag === 3) {
        stopPolling();
        isSubmitting.value = false;
      }
    } catch (e) {
      errorText.value = e?.message || "Ошибка при опросе статуса";
      stopPolling();
      isSubmitting.value = false;
    }
  }, 10000);
}

async function onGenerate() {
  errorText.value = "";
  taskId.value = "";
  taskRaw.value = null;

  const p =
    taskType.value === "product_card"
      ? finalPrompt.value.trim()
      : prompt.value.trim();

  if (taskType.value === "product_card") {
    if (!title.value.trim()) {
      errorText.value = "Введите заголовок.";
      return;
    }
    if (!advantage.value.trim()) {
      errorText.value = "Введите преимущество.";
      return;
    }
  } else {
    if (!p) {
      errorText.value = "Введите prompt.";
      return;
    }
  }

  const hasFiles = localFiles.value.length > 0;
  const hasUrls = imageUrls.value.length > 0;

  isSubmitting.value = true;

  try {
    const fd = new FormData();
    fd.append("prompt", p);
    fd.append("resolution", resolution.value);
    fd.append("aspectRatio", aspectRatio.value);

    for (const u of imageUrls.value) fd.append("imageUrls", u);
    for (const item of localFiles.value) fd.append("images", item.file, item.file.name);

    const res = await fetch(`${API_BASE}/api/v1/generate-pro`, {
      method: "POST",
      body: fd,
    });

    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(txt || `Ошибка генерации: ${res.status}`);
    }

    const data = await res.json();
    taskId.value = data.taskId;
    await startPolling(taskId.value);
  } catch (e) {
    isSubmitting.value = false;
    errorText.value = e?.message || "Не удалось отправить запрос.";
  }
}

function onReset() {
  errorText.value = "";
  taskId.value = "";
  taskRaw.value = null;
  prompt.value = "";
  imageUrlInput.value = "";
  imageUrls.value = [];
  for (const f of localFiles.value) if (f.previewUrl) URL.revokeObjectURL(f.previewUrl);
  localFiles.value = [];
  aspectRatio.value = "auto";
  resolution.value = "1K";
  taskType.value = "i2i";
  productVariant.value = "studio";
  title.value = "";
  advantage.value = "";
  stopPolling();
}

onBeforeUnmount(() => {
  stopPolling();
  for (const f of localFiles.value) if (f.previewUrl) URL.revokeObjectURL(f.previewUrl);
});
</script>

<template>
  <div class="shell" :class="{ embed: isEmbed }">
    <header class="top" v-if="!isEmbed">
      <div class="top-title">Nano Banana</div>
      <div class="top-sub">Создавайте и изменяйте изображения</div>
    </header>

    <div class="layout">
      <!-- LEFT: FORM -->
      <aside class="left">
        <div class="left-inner">
          <!-- taskType -->
          <div class="field">
      
            <div class="seg2">
              <button
                class="segbtn"
                :class="{ active: taskType === 't2i' }"
                type="button"
                @click="taskType = 't2i'"
              >
                Текст в Изображение
              </button>
              <button
                class="segbtn"
                :class="{ active: taskType === 'i2i' }"
                type="button"
                @click="taskType = 'i2i'"
              >
                Изображение в Изображение
              </button>
              <button
                class="segbtn"
                :class="{ active: taskType === 'product_card' }"
                type="button"
                @click="taskType = 'product_card'"
              >
                Карточка товара
              </button>
            </div>
            <div class="hint">ТипЗадачи</div>
          </div>


          <div class="field" v-if="taskType === 'product_card'">
            <label class="label">Вариант</label>
            <div class="seg3">
              <button
                class="segbtn"
                :class="{ active: productVariant === 'studio' }"
                type="button"
                @click="productVariant = 'studio'"
              >
                Студийное фото
              </button>

              <button
                class="segbtn"
                :class="{ active: productVariant === 'image' }"
                type="button"
                @click="productVariant = 'image'"
              >
                Имиджевые варианты
              </button>

              <button
                class="segbtn"
                :class="{ active: productVariant === 'ugc' }"
                type="button"
                @click="productVariant = 'ugc'"
              >
                UGC-пакет
              </button>
            </div>
            <div class="hint">Выберите тип набора для карточки товара</div>
          </div>


          <!-- prompt (для t2i/i2i) -->
          <div class="field" v-if="taskType !== 'product_card'">
            <label class="label">Запрос<span class="req">*</span></label>
            <textarea
              class="textarea"
              v-model="prompt"
              placeholder="Опишите, что вы хотите создать..."
              rows="3"
            />
            <div class="hint">Текстовый промпт для генерации изображения</div>
          </div>

          <!-- product_card fields -->
          <div class="field" v-else>
            <label class="label">Заголовок<span class="req">*</span></label>
            <input
              class="input"
              v-model="title"
              placeholder="Пробуждение силы"
            />
            <div class="hint">Заголовок товара для карточки</div>

            <div style="height: 10px;"></div>

            <label class="label">Преимущество<span class="req">*</span></label>
            <textarea
              class="textarea"
              v-model="advantage"
              placeholder="Кружка из стекла с вкраплениями лунной пыли"
              rows="3"
            />
            <div class="hint">Ключевое преимущество/УТП</div>

            <div style="height: 10px;"></div>
          </div>


          <!-- imageUrls -->
          <div class="field" v-if="taskType === 'i2i' || taskType === 'product_card'">
            <label class="label">Референсные изображения</label>

            <div class="row">
              <input
                class="input"
                v-model="imageUrlInput"
                @keydown="onUrlKeydown"
                placeholder="https://example.com/image.jpg"
              />
              <button class="btn" type="button" @click="addImageUrl">Добавить</button>
            </div>

            <div v-if="imageUrls.length" class="chips">
              <div v-for="u in imageUrls" :key="u" class="chip">
                <span class="chip-text">{{ u }}</span>
                <button class="chip-x" type="button" @click="removeImageUrl(u)">✕</button>
              </div>
            </div>

            <div
              class="drop"
              :class="{ disabled: !canAddMoreFiles }"
            >
              <label
                @dragover.prevent
                @drop="onDrop"
              >
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  class="fileinput"
                  :disabled="!canAddMoreFiles"
                  @change="onPickFiles"
                />
                <div class="drop-inner">
                  <div class="drop-ico">⬆</div>
                  <div class="drop-text">
                    Нажмите или перетащите для загрузки изображений
                    ({{ localFiles.length }}/{{ maxFiles }})
                  </div>
                </div>
              </label>
            </div>
            

            <div v-if="localFiles.length" class="previews">
              <div v-for="(f, idx) in localFiles" :key="f.previewUrl" class="preview">
                <img class="preview-img" :src="f.previewUrl" :alt="f.name" />
                <div class="preview-meta">
                  <div class="preview-name">{{ f.name }}</div>
                  <div class="preview-size">{{ Math.round(f.size / 1024) }} KB</div>
                </div>
                <button class="preview-x" type="button" @click="removeLocalFile(idx)">✕</button>
              </div>
            </div>
          </div>

          <!-- aspectRatio -->
          <div class="field">
            <label class="label">Соотношение сторон</label>
            <select class="select" v-model="aspectRatio">
              <option v-for="o in aspectOptions" :key="o.value" :value="o.value">{{ o.label }}</option>
            </select>
            <div class="hint">Соотношение сторон сгенерированного изображения</div>
          </div>

          <!-- resolution -->
          <div class="field">
            <label class="label">Разрешение</label>
            <div class="seg3">
              <button class="segbtn" :class="{ active: resolution === '1K' }" type="button" @click="resolution='1K'">1K</button>
              <button class="segbtn" :class="{ active: resolution === '2K' }" type="button" @click="resolution='2K'">2K</button>
              <button class="segbtn" :class="{ active: resolution === '4K' }" type="button" @click="resolution='4K'">4K</button>
            </div>
            <div class="hint">Качество разрешения изображения</div>
          </div>
        </div>

        <div class="left-actions">
          <div class="hr"></div>
          <div class="actions">
            <button class="btn ghost" type="button" @click="onReset">Сброс</button>
            <button class="btn primary" type="button" @click="onGenerate" :disabled="isSubmitting">
              {{ isSubmitting ? "Генерация..." : "Запустить" }}
            </button>
          </div>

          <div v-if="errorText" class="alert error">{{ errorText }}</div>

          <div v-if="taskId" class="task">
            <div v-if="successFlag === 0" class="pill info">Задача в обработке…</div>
            <div v-else-if="successFlag === 1" class="pill ok">Запрос успешно обработан</div>
            <div v-else-if="successFlag === 2 || successFlag === 3" class="pill bad">
              Ошибка: {{ taskRaw?.data?.errorMessage || taskRaw?.errorMessage || "unknown" }}
            </div>
          </div>
        </div>
      </aside>

      <!-- RIGHT: PREVIEW -->
      <main class="right">
        <div class="right-inner">
          <div class="preview-card">
            <div class="preview-stage" :class="{ filled: !!resultImageUrl }">
              <!-- Лоадер (задача есть и ещё обрабатывается) -->
              <div v-if="successFlag === 0" class="overlay">
                <div class="spinner"></div>
                <div class="overlay-title">Задача в обработке…</div>
                <div class="overlay-sub">Это может занять несколько минут.</div>
              </div>

              <div v-else-if="successFlag === 2 || successFlag === 3" class="overlay error">
                <div class="overlay-title">Ошибка генерации</div>
                <div class="overlay-sub">
                  {{ taskRaw?.data?.errorMessage || taskRaw?.errorMessage || "unknown" }}
                </div>
              </div>
              <img
                v-else-if="resultImageUrl"
                class="bigimg"
                :src="resultImageUrl"
                alt="Generated"
              />
              <!-- <img
                v-else
                class="bigimg"
                :src="resultImageUrl"
                alt="Generated"
              /> -->
              <!-- Пусто (нет задачи) -->
              <div v-else class="empty">
                <div class="empty-title">Результат появится здесь</div>
                <div class="empty-sub">После генерации покажем итоговое изображение.</div>
              </div>
            </div>
          </div>

          <div v-if="resultImageUrl" class="result-meta">
            <div class="meta-row">
              <div class="meta-label">Ссылка на изображение:</div>
              <a class="meta-link" :href="resultImageUrl" target="_blank" rel="noreferrer">
                {{ resultImageUrl }}
              </a>
            </div>
          </div>
        </div>
      </main>
    </div>
  </div>
</template>

<style scoped>
/* общий фон как у “современных” UI */
.shell {
  min-height: 100vh;
  /* background: #20377c; */
  font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
  color: #111827;
}

.top {
  padding: 18px 18px 8px;
  max-width: 1200px;
  margin: 0 auto;
}

.top-title {
  font-size: 28px;
  font-weight: 800;
  line-height: 1.2;
}

.top-sub {
  margin-top: 4px;
  color: #6b7280;
  font-size: 13px;
}

.layout {
  display: flex;          /* <-- важно */
  gap: 14px;
  max-width: 1200px;
  margin: 0 auto;
  padding: 12px 18px 22px;
}


.embed, .embed .layout {
  height: 100%;
}

.embed .layout {
  max-width: none;
  margin: 0;
  padding: 0;
  gap: 0;
}

.embed .left {
  border-radius: 0;
  min-height: 100vh;      /* внутри iframe будет норм */
  width: 380px;
  border-right: 1px solid #e5e7eb;
}

.embed .right {
  border-radius: 0;
  min-height: 100vh;
  flex: 1;
  background: #FAFAFA;
}



.left {
  width: 380px;
  background: #FAFAFA;
  border-radius: 18px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  min-height: 82vh;
}

.left-inner {
  padding: 16px 16px 10px;
  overflow: auto;
}

.left-actions {
  padding: 12px 16px 16px;
  background: #FAFAFA;
}

.right {
  flex: 1;
  min-height: 82vh;
  border-radius: 18px;
  overflow: hidden;
  background: #FAFAFA;
}

.right-inner {
  height: 100%;
  padding: 16px;
  overflow: auto;
}

.field { margin-bottom: 14px; }
.label {
  display: block;
  font-size: 13px;
  font-weight: 700;
  color: #374151;
  margin-bottom: 6px;
}
.req { color: #ef4444; }

.hint {
  margin-top: 6px;
  font-size: 12px;
  color: #6b7280;
}

.input, .textarea, .select {
  box-sizing: border-box;
  width: 100%;
  border: 1px solid white;
  background: #F4F4F5;
  border-radius: 12px;
  padding: 10px 12px;
  font-size: 14px;
  outline: none;
  padding: 13px;
}

.input:hover,
.textarea:hover,
.select:hover {
  background: #E4E4E7;
}

.textarea { resize: vertical; min-height: 70px; }

.row { display: flex; gap: 10px; align-items: center; }

.btn {
  border: 1px solid #e5e7eb;
  background: #fff;
  border-radius: 12px;
  padding: 10px 12px;
  cursor: pointer;
  font-weight: 700;
  font-size: 13px;
}
.btn:disabled { opacity: .6; cursor: not-allowed; }
.btn.primary { background: #2563eb; border-color: #2563eb; color: #fff; }
.btn.ghost { background: transparent; }
.badge {
  margin-left: 10px;
  font-size: 11px;
  opacity: .65;
  padding-left: 10px;
  border-left: 1px solid rgba(255,255,255,.4);
}

.seg2, .seg3 { display: flex; gap: 8px; }
.segbtn {
  flex: 1;
  border: 1px solid #e5e7eb;
  background: #fff;
  border-radius: 12px;
  padding: 10px 10px;
  font-weight: 800;
  font-size: 12px;
  cursor: pointer;
  color: #374151;
}
.segbtn.active {
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59,130,246,.18);
  background: #eef2ff;
}

.chips { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; }
.chip {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  max-width: 100%;
  padding: 6px 10px;
  border-radius: 999px;
  border: 1px solid #e5e7eb;
  background: #fff;
}
.chip-text {
  font-size: 12px;
  color: #111827;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 240px;
}
.chip-x { border: none; background: transparent; cursor: pointer; font-weight: 900; }

.drop {
  margin-top: 10px;
  border: 3px dashed #d1d5db;
  border-radius: 16px;
  background: #fff;
}
.drop label {
  cursor: pointer;
}
.drop:hover {
  border: 3px dashed #A1A1AA;
}
.drop.disabled { opacity: .6; }
.drop-inner {
  padding: 14px 10px;
  text-align: center;
}
.drop-ico { color: #9ca3af; font-size: 20px; margin-bottom: 6px; }
.drop-text { font-size: 12px; color: #4b5563; font-weight: 700; }
.filebtn {
  display: inline-block;
  margin-top: 10px;
  padding: 8px 12px;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  background: #fff;
  cursor: pointer;
  font-weight: 800;
  font-size: 12px;
}
.filebtn.disabled { opacity: .6; cursor: not-allowed; }
.fileinput { display: none; }

.previews {
  margin-top: 10px;
  display: grid;
  grid-template-columns: 1fr;
  gap: 10px;
}
.preview {
  position: relative;
  display: flex;
  gap: 10px;
  padding: 10px;
  border-radius: 14px;
  border: 1px solid #e5e7eb;
  background: #fff;
}
.preview-img {
  width: 54px;
  height: 54px;
  border-radius: 12px;
  object-fit: cover;
  border: 1px solid #eef2f7;
}
.preview-meta { min-width: 0; }
.preview-name {
  font-weight: 800;
  font-size: 12px;
  max-width: 240px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.preview-size { font-size: 12px; color: #6b7280; margin-top: 4px; }
.preview-x {
  position: absolute;
  top: 8px; right: 8px;
  width: 28px; height: 28px;
  border-radius: 10px;
  border: 1px solid #e5e7eb;
  background: #fff;
  cursor: pointer;
  font-weight: 900;
}

.hr {
  height: 1px;
  background: #e5e7eb;
  margin: 8px 0 12px;
}

.actions { display: flex; gap: 10px; }
.actions .btn { flex: 1; }


.alert {
  margin-top: 12px;
  padding: 10px 12px;
  border-radius: 14px;
  border: 1px solid;
  font-size: 13px;
}
.alert.error { background: #fef2f2; border-color: #fecaca; color: #7f1d1d; }

.task { margin-top: 12px; }
.task-row { display: flex; gap: 8px; align-items: center; }
.task-label { font-weight: 800; font-size: 12px; }
.task-code { font-size: 12px; }

.pill {
  margin-top: 10px;
  border-radius: 14px;
  padding: 10px 12px;
  font-size: 13px;
  border: 1px solid;
}
.pill.info { background: #eff6ff; border-color: #bfdbfe; color: #1e3a8a; }
.pill.ok { background: #ecfdf5; border-color: #a7f3d0; color: #065f46; }
.pill.bad { background: #fef2f2; border-color: #fecaca; color: #7f1d1d; }

.preview-card {
  background: #fff;
  border-radius: 18px;
  box-shadow: 0 10px 25px rgba(17, 24, 39, 0.06);
  overflow: hidden;
}

.preview-stage {
  position: relative;
  min-height: 460px;
  background: #fff;
  padding: 16px;
}

.overlay {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  text-align: center;
  padding: 32px;
  background: transparent;
}

.preview-stage.filled {
  background: #F4F4F5;
  padding: 0;
}

.preview-stage.filled .overlay {
  min-height: 0;
}

.spinner {
  width: 38px;
  height: 38px;
  border-radius: 999px;
  border: 4px solid #e5e7eb;
  border-top-color: #3b82f6;
  animation: spin 0.9s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.overlay-title {
  font-weight: 900;
  font-size: 16px;
  color: #111827;
}

.overlay-sub {
  font-size: 12px;
  color: #6b7280;
  max-width: 420px;
}

.overlay.error .overlay-title {
  color: #7f1d1d;
}
.overlay.error .overlay-sub {
  color: #7f1d1d;
}

.bigimg {
  width: 100%;
  height: auto;
  object-fit: contain;
  display: block;
}
.empty { text-align: center; padding: 32px; }
.empty-title { font-size: 16px; font-weight: 900; color: #111827; }
.empty-sub { margin-top: 6px; font-size: 12px; color: #6b7280; }

.result-meta {
  margin-top: 12px;
  padding: 12px;
  border-radius: 16px;
  border: 1px solid #e5e7eb;
  background: #fff;
}
.meta-row { display: flex; gap: 10px; align-items: center; }
.meta-label { font-weight: 800; font-size: 12px; color: #374151; }
.meta-link { font-size: 12px; color: #2563eb; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.raw {
  margin-top: 12px;
  border-radius: 16px;
  border: 1px solid #e5e7eb;
  background: #0b1020;
  color: #e5e7eb;
  overflow: hidden;
}
.raw summary {
  cursor: pointer;
  padding: 10px 12px;
  background: rgba(255,255,255,.06);
}
.raw pre {
  margin: 0;
  padding: 12px;
  overflow: auto;
  font-size: 12px;
}

/* Мобильные устройства до 768px */
@media (max-width: 768px) {
  .layout {
    flex-direction: column;
    gap: 12px;
    padding: 12px 10px;
  }

  .left {
    width: 100%;
    min-height: auto;
    border-radius: 12px;
    border-right: none;
    border-bottom: 1px solid #e5e7eb;
  }

  .right {
    width: 100%;
    min-height: auto;
    border-radius: 12px;
  }

  .previews {
    grid-template-columns: repeat(2, 1fr);
  }

  .seg2, .seg3 {
    flex-wrap: wrap;
  }

  .drop-inner {
    padding: 12px 6px;
  }

  .overlay-sub, .empty-sub {
    max-width: 100%;
  }
}

</style>
