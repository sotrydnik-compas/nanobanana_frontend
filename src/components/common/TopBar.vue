<!-- src/components/TopBar.vue -->
<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'

const props = defineProps({
  user: { type: Object, default: null },
})

const emit = defineEmits(['logout'])

const router = useRouter()
const email = computed(() => props.user?.email || 'Аккаунт')

async function goAccount() {
  await router.push({ name: 'account' })
}

function clickLogout() {
  emit('logout')
}
</script>

<template>
  <div class="bar">
    <div class="brand">Nano Banana</div>

    <div class="right">
      <button class="btn" type="button" @click="goAccount">
        {{ email }}
      </button>
      <button class="btn" type="button" @click="clickLogout">
        Выйти
      </button>
    </div>
  </div>
</template>

<style scoped>
.bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 18px;
  border-bottom: 1px solid #e5e7eb;
  background: #fafafa;
  font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
}
.brand { font-weight: 900; color: #111827; }
.right { display: flex; gap: 10px; }

.btn {
  border: 1px solid #e5e7eb;
  background: #fff;
  border-radius: 12px;
  padding: 10px 12px;
  cursor: pointer;
  font-weight: 800;
  font-size: 13px;
  color: #111827;
}
</style>
