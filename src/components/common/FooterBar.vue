<script setup>
import { onMounted, ref } from 'vue'

const LS_THEME = 'nb_theme'
const theme = ref('light')

// public/offer.docx
const offerHref = `${import.meta.env.BASE_URL}offer.docx`

function applyTheme(t) {
  theme.value = t
  try { localStorage.setItem(LS_THEME, t) } catch {}
  document.documentElement.setAttribute('data-theme', t)
}

function toggleTheme() {
  applyTheme(theme.value === 'dark' ? 'light' : 'dark')
}

onMounted(() => {
  let t = 'light'
  try { t = localStorage.getItem(LS_THEME) || 'light' } catch {}
  applyTheme(t)
})
</script>

<template>
  <footer class="foot">
    <div class="left">
      <div class="dev">
        Разработчик: 
        <a href="https://compass-pro.ru/" target="_blank" rel="noopener">
          <span class="strong">Компас ПРО</span>
        </a>
      </div>
    </div>

    <div class="center">
      <div class="legal">
        ИП ЛЯДОВ АНТОН АЛЕКСАНДРОВИЧ<br>ОГРНИП 325595800129700<br>ИНН 590704021992
      </div>

      <div class="links">
        <a class="lnk" href="mailto:support@nanobanana.ai">support@nanobanana.ai</a>
        <span class="dot">•</span>
        <a class="lnk" href="#" target="_blank" rel="noopener">Telegram</a>
      </div>
    </div>

    <div class="right">
      <!-- на desktop рядом с темой -->
      <a class="btnlink" :href="offerHref" download>Договор оферты</a>
      <button class="toggle" type="button" @click="toggleTheme">
        {{ theme === 'dark' ? '🌙 Dark' : '☀️ Light' }}
      </button>
    </div>
  </footer>
</template>

<style scoped>
.foot {
  border-top: 1px solid var(--border);
  background: var(--card);
  padding: 12px 16px;
  position: static !important;
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  gap: 12px;
  align-items: center;
  font-size: 12px;
  color: var(--muted);
}

.left { justify-self: start; }
.center { justify-self: center; display: flex; flex-direction: column; gap: 8px; align-items: center; text-align: center; }
.right { justify-self: end; display: flex; gap: 10px; align-items: center; }

.strong { color: var(--text); font-weight: 900; }

.legal {
  color: var(--text);
  font-weight: 800;
  opacity: .85;
  max-width: 720px;
}

.links { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; justify-content: center; }
.lnk { color: var(--muted); text-decoration: none; font-weight: 800; }
.lnk:hover { color: var(--text); }
.dot { opacity: .5; }

.btnlink {
  display: inline-flex;
  align-items: center;
  border: 1px solid var(--border);
  background: var(--card2);
  color: var(--text);
  border-radius: 12px;
  padding: 8px 10px;
  text-decoration: none;
  font-weight: 900;
  white-space: nowrap;
}
.btnlink:hover { background: var(--card2Hover); }

.toggle {
  border: 1px solid var(--border);
  background: var(--card2);
  color: var(--text);
  border-radius: 999px;
  padding: 8px 10px;
  cursor: pointer;
  font-weight: 900;
  font-size: 12px;
  white-space: nowrap;
}

@media (max-width: 640px) {
  .foot { grid-template-columns: 1fr; text-align: center; }
  .left, .right { justify-self: center; }
  .right { flex-direction: column; }
}
</style>