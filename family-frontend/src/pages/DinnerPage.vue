<script setup lang="ts">
import { ref, computed, nextTick, onMounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { dinnerApi, membersApi } from '../api';
import type { ChatMessageDTO, MemberDTO } from '../api/client';
import ChatBubble from '../components/ChatBubble.vue';
import DiningTable from '../components/DiningTable.vue';

const route = useRoute();
const router = useRouter();
const spaceId = route.params.spaceId as string;
const sessionId = route.params.sessionId as string;

const messages = ref<ChatMessageDTO[]>([]);
// Index from which subsequent messages should appear with a streaming stagger.
// Messages before this index are considered already-seen and render immediately.
const streamFromIdx = ref(0);
const input = ref('');
const sending = ref(false);
const ending = ref(false);
const error = ref('');
const loaded = ref(false);
const members = ref<MemberDTO[]>([]);
const chatListRef = ref<HTMLDivElement | null>(null);

const speakingMemberId = computed(() => {
  const last = messages.value[messages.value.length - 1];
  return last?.role === 'member' ? last.memberId : null;
});

function staggerDelay(idx: number): string {
  if (idx < streamFromIdx.value) return '0s';
  const offset = idx - streamFromIdx.value;
  return `${offset * 0.7}s`;
}

async function load(): Promise<void> {
  try {
    try {
      const ms = await membersApi.list(spaceId);
      members.value = ms;
    } catch { /* members optional, table degrades to no-seats */ }
    const r = await dinnerApi.detail(sessionId);
    streamFromIdx.value = 0;
    messages.value = r.messages;
    scrollBottom();
  } catch {
    error.value = '加载失败';
  } finally {
    loaded.value = true;
  }
}

async function send(): Promise<void> {
  const content = input.value.trim();
  if (!content) return;
  sending.value = true;
  error.value = '';
  try {
    await dinnerApi.message(spaceId, sessionId, content);
    const detail = await dinnerApi.detail(sessionId);
    streamFromIdx.value = messages.value.length;
    messages.value = detail.messages;
    scrollBottom();
    input.value = '';
  } catch (e: unknown) {
    error.value =
      (e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? '发送失败';
  } finally {
    sending.value = false;
  }
}

async function endMeal(): Promise<void> {
  ending.value = true;
  try {
    await dinnerApi.end(sessionId);
  } finally {
    ending.value = false;
    router.push({ name: 'space-detail', params: { spaceId } });
  }
}

function scrollBottom(): void {
  void nextTick(() => {
    const el = chatListRef.value;
    if (el) el.scrollTop = el.scrollHeight;
  });
}

watch(messages, scrollBottom);

onMounted(load);
</script>

<template>
  <div class="page dinner" data-test="dinner-page">
    <div class="title-bar">
      <h2>开饭中…</h2>
      <span class="badge tomato">实时对话</span>
    </div>

    <p v-if="error" class="err">{{ error }}</p>

    <DiningTable :members="members" :speaking-member-id="speakingMemberId" />

    <div class="chat-list" ref="chatListRef" data-test="chat-list">
      <ChatBubble
        v-for="(m, idx) in messages"
        :key="m.id"
        :message="m"
        :style="{ animationDelay: staggerDelay(idx) }"
      />
      <p v-if="loaded && messages.length === 0" class="empty-tip" style="padding:1rem">
        AI 正在准备这一顿对话…
      </p>
    </div>

    <div class="composer card">
      <el-input
        v-model="input"
        placeholder="加入对话…比如：今天的菜真香！"
        data-test="input"
        @keyup.enter="send"
      />
      <el-button
        type="primary"
        class="btn-pill"
        :loading="sending"
        data-test="send"
        @click="send"
      >发送</el-button>
      <el-button
        class="btn-pill"
        :loading="ending"
        data-test="end"
        @click="endMeal"
      >结束</el-button>
    </div>
  </div>
</template>

<style scoped>
.title-bar { display: flex; align-items: center; gap: .8rem; margin-bottom: 1rem; }
.title-bar h2 { margin: 0; }
.badge {
  font-size: .75rem; padding: .2rem .6rem; border-radius: var(--radius-pill);
}
.badge.tomato { background: var(--rose-100); color: var(--tomato-500); }

.chat-list {
  margin-top: 1rem;
  padding: 1rem;
  max-height: 50vh;
  min-height: 180px;
  overflow-y: auto;
  background: linear-gradient(180deg, #fff 0%, #fff7ec 100%);
  border-radius: var(--radius-card);
  border: 1px solid var(--line);
  box-shadow: var(--shadow-soft);
}

.composer {
  display: flex; gap: .5rem;
  margin-top: 1rem;
  padding: .8rem;
  align-items: stretch;
}
.composer :deep(.el-input) { flex: 1; }
@media (max-width: 540px) {
  .composer { flex-wrap: wrap; }
  .composer :deep(.el-input) { flex: 1 1 100%; }
}
</style>
