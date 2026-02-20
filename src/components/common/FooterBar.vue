<script setup>
import { onMounted, ref } from 'vue'

const LS_THEME = 'nb_theme'
const theme = ref('light')

function applyTheme(t) {
  theme.value = t
  try { localStorage.setItem(LS_THEME, t) } catch {}
  const root = document.documentElement
  root.setAttribute('data-theme', t)
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
      Разработчик: <span class="strong">Компас ПРО</span>
    </div>

    <div class="center">
      <a class="lnk" href="mailto:support@nanobanana.ai">support@nanobanana.ai</a>
      <span class="dot">•</span>
      <a class="lnk" href="#" target="_blank" rel="noopener">Telegram</a>
      <span class="dot">•</span>
      <a class="lnk" href="#" target="_blank" rel="noopener">YouTube</a>
    </div>

    <div class="right">
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
  padding: 10px 16px;
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  gap: 12px;
  align-items: center;
  font-size: 12px;
  color: var(--muted);
}
.left { justify-self: start; }
.center { justify-self: center; display: flex; gap: 10px; align-items: center; }
.right { justify-self: end; }

.strong { color: var(--text); font-weight: 900; }
.lnk { color: var(--muted); text-decoration: none; font-weight: 800; }
.lnk:hover { color: var(--text); }
.dot { opacity: .5; }

.toggle {
  border: 1px solid var(--border);
  background: var(--card2);
  color: var(--text);
  border-radius: 999px;
  padding: 8px 10px;
  cursor: pointer;
  font-weight: 900;
  font-size: 12px;
}
</style>