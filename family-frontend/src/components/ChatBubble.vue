<script setup lang="ts">
import type { ChatMessageDTO } from '../api/client';

defineProps<{ message: ChatMessageDTO }>();
</script>

<template>
  <div :class="['chat-bubble', message.role === 'user' ? 'user' : '']" data-test="chat-bubble">
    <span class="speaker">{{ message.speaker }}</span>
    <span>{{ message.content }}</span>
  </div>
</template>
