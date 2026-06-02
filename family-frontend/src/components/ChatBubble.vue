<script setup lang="ts">
import type { ChatMessageDTO } from '../api/client';

defineProps<{ message: ChatMessageDTO }>();
</script>

<template>
  <div :class="['chat-bubble', message.role === 'user' ? 'user' : '']" data-test="chat-bubble">
    <div class="speaker-line">
      <span class="speaker">{{ message.speaker }}</span>
      <span class="time">{{ new Date(message.createdAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) }}</span>
    </div>
    <div class="content">{{ message.content }}</div>
  </div>
</template>

<style scoped>
.speaker-line {
  display: flex; align-items: baseline; gap: .5rem;
  margin-bottom: .15rem;
}
.time { font-size: .72rem; color: var(--muted); }
.content { line-height: 1.45; word-break: break-word; }
</style>
