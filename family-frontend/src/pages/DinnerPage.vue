<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { dinnerApi } from '../api';
import type { ChatMessageDTO } from '../api/client';
import ChatBubble from '../components/ChatBubble.vue';

const route = useRoute();
const router = useRouter();
const spaceId = route.params.spaceId as string;
const sessionId = route.params.sessionId as string;

const messages = ref<ChatMessageDTO[]>([]);
const input = ref('');
const sending = ref(false);
const error = ref('');

async function load(): Promise<void> {
  try {
    const r = await dinnerApi.detail(sessionId);
    messages.value = r.messages;
  } catch {
    error.value = '加载失败';
  }
}

async function send(): Promise<void> {
  const content = input.value.trim();
  if (!content) return;
  sending.value = true;
  try {
    const r = await dinnerApi.message(spaceId, sessionId, content);
    // Re-fetch to keep order canonical.
    const detail = await dinnerApi.detail(sessionId);
    messages.value = detail.messages;
    input.value = '';
    void r;
  } catch (e: unknown) {
    error.value =
      (e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? '发送失败';
  } finally {
    sending.value = false;
  }
}

async function endMeal(): Promise<void> {
  try {
    await dinnerApi.end(sessionId);
  } finally {
    router.push({ name: 'space-detail', params: { spaceId } });
  }
}

onMounted(load);
</script>

<template>
  <div class="page" data-test="dinner-page">
    <h2>开饭中…</h2>
    <p v-if="error" class="err">{{ error }}</p>
    <div class="chat-list" data-test="chat-list">
      <ChatBubble v-for="m in messages" :key="m.id" :message="m" />
      <p v-if="messages.length === 0" class="empty-tip">尚未生成对话</p>
    </div>

    <div class="composer">
      <el-input v-model="input" placeholder="加入对话…" data-test="input" />
      <el-button type="primary" :loading="sending" data-test="send" @click="send">发送</el-button>
      <el-button data-test="end" @click="endMeal">结束</el-button>
    </div>
  </div>
</template>

<style scoped>
.composer { display: flex; gap: 0.6rem; margin-top: 1rem; }
.err { color: #d9534f; }
</style>
