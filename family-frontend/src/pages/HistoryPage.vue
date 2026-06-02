<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { dinnerApi } from '../api';
import type { ChatMessageDTO, DinnerSessionDTO } from '../api/client';
import ChatBubble from '../components/ChatBubble.vue';

const route = useRoute();
const router = useRouter();
const spaceId = route.params.spaceId as string;

const sessions = ref<DinnerSessionDTO[]>([]);
const expanded = ref<string | null>(null);
const messages = ref<ChatMessageDTO[]>([]);

async function load(): Promise<void> {
  sessions.value = await dinnerApi.sessions(spaceId);
}

async function open(s: DinnerSessionDTO): Promise<void> {
  if (expanded.value === s.id) {
    expanded.value = null;
    messages.value = [];
    return;
  }
  expanded.value = s.id;
  const r = await dinnerApi.detail(s.id);
  messages.value = r.messages;
}

function mealLabel(t: string): string {
  return t === 'breakfast' ? '早餐' : t === 'lunch' ? '午餐' : '晚餐';
}

function backToScene(): void {
  router.push({ name: 'space-detail', params: { spaceId } });
}

onMounted(load);
</script>

<template>
  <div class="page" data-test="history-page">
    <h2>历史对话</h2>
    <el-button @click="backToScene">返回</el-button>
    <p v-if="sessions.length === 0" class="empty-tip" data-test="empty">还没有历史饭局。</p>
    <ul class="session-list" data-test="session-list">
      <li v-for="s in sessions" :key="s.id" class="session-item">
        <div class="info" @click="open(s)">
          <strong>{{ mealLabel(s.mealType) }}</strong>
          <span class="muted">{{ new Date(s.startedAt).toLocaleString() }}</span>
        </div>
        <div v-if="expanded === s.id" class="chat-list">
          <ChatBubble v-for="m in messages" :key="m.id" :message="m" />
        </div>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.session-list { list-style: none; padding: 0; margin: 1rem 0 0; }
.session-item {
  background: #fff; border-radius: 12px; padding: 0.8rem 1rem; margin-bottom: 0.6rem;
}
.info { display: flex; gap: 1rem; cursor: pointer; }
.muted { color: #999; }
</style>
