<script setup>
const props = defineProps({
  msg: { type: Object, required: true },
})

const isUser = props.msg.role === 'user'
const isAssistant = props.msg.role === 'assistant'

const successFlag = props.msg?.meta?.successFlag
const resultUrl = props.msg?.meta?.resultImageUrl
const errMsg = props.msg?.meta?.errorMessage
</script>

<template>
  <div class="bubble" :class="{ user: isUser, assistant: isAssistant }">
    <div v-if="isUser" class="text">{{ msg.content }}</div>

    <template v-else>
      <div v-if="successFlag === 2 || successFlag === 3" class="err">
        Ошибка: {{ errMsg || 'unknown' }}
      </div>

      <template v-else-if="resultUrl">
        <img class="img" :src="resultUrl" alt="result" />
        <a class="link" :href="resultUrl" target="_blank" rel="noreferrer">{{ resultUrl }}</a>
      </template>

      <div v-else class="muted">…</div>
    </template>
  </div>
</template>

<style scoped>
.bubble { max-width: 820px; padding: 10px 12px; border-radius: 16px; border: 1px solid #e5e7eb; background: #fff; }
.bubble.user { align-self: flex-end; border-color: #bfdbfe; background: #eff6ff; }
.bubble.assistant { align-self: flex-start; }
.text { white-space: pre-wrap; font-size: 13px; font-weight: 700; color: #111827; }
.img { width: 100%; max-width: 560px; border-radius: 14px; border: 1px solid #e5e7eb; display: block; }
.link { display: block; margin-top: 8px; font-size: 12px; color: #2563eb; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.err { font-size: 12px; font-weight: 900; color: #7f1d1d; }
.muted { font-size: 12px; color: #6b7280; }
</style>
