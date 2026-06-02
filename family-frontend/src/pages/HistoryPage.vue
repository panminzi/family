<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { dinnerApi } from '../api';
import type { ChatMessageDTO, DinnerSessionDTO } from '../api/client';
import ChatBubble from '../components/ChatBubble.vue';

const route = useRoute();
const router = useRouter();
const spaceId = route.params.spaceId as string;

const sessions = ref<DinnerSessionDTO[]>([]);
const expanded = ref<string | null>(null);
const messagesById = ref<Record<string, ChatMessageDTO[]>>({});
const loadingDetail = ref<string | null>(null);
const loading = ref(false);

function mealLabel(t: string): 'breakfast' | 'lunch' | 'dinner' | string {
  return t === 'breakfast' ? '早餐' : t === 'lunch' ? '午餐' : t === 'dinner' ? '晚餐' : t;
}
function mealEmoji(t: string): string {
  return t === 'breakfast' ? '🥣' : t === 'lunch' ? '🍱' : '🍲';
}

function dateKey(s: DinnerSessionDTO): string {
  const d = new Date(s.startedAt);
  return d.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

function dayLabel(key: string, sample: DinnerSessionDTO): string {
  const d = new Date(sample.startedAt);
  const today = new Date();
  const yest = new Date(today.getTime() - 24 * 3600 * 1000);
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  if (sameDay(d, today)) return `今天 · ${key}`;
  if (sameDay(d, yest)) return `昨天 · ${key}`;
  return key;
}

const groupedByDate = computed(() => {
  const groups: { key: string; label: string; sessions: DinnerSessionDTO[] }[] = [];
  const map = new Map<string, DinnerSessionDTO[]>();
  for (const s of sessions.value) {
    const k = dateKey(s);
    if (!map.has(k)) map.set(k, []);
    map.get(k)!.push(s);
  }
  const ordered = [...map.entries()].sort((a, b) => {
    const ta = new Date(a[1][0].startedAt).getTime();
    const tb = new Date(b[1][0].startedAt).getTime();
    return tb - ta;
  });
  for (const [k, list] of ordered) {
    const order = { breakfast: 0, lunch: 1, dinner: 2 } as Record<string, number>;
    list.sort((a, b) => (order[a.mealType] ?? 9) - (order[b.mealType] ?? 9));
    groups.push({ key: k, label: dayLabel(k, list[0]), sessions: list });
  }
  return groups;
});

async function load(): Promise<void> {
  loading.value = true;
  try {
    sessions.value = await dinnerApi.sessions(spaceId);
  } finally {
    loading.value = false;
  }
}

async function toggle(s: DinnerSessionDTO): Promise<void> {
  if (expanded.value === s.id) {
    expanded.value = null;
    return;
  }
  expanded.value = s.id;
  if (!messagesById.value[s.id]) {
    loadingDetail.value = s.id;
    try {
      const r = await dinnerApi.detail(s.id);
      messagesById.value = { ...messagesById.value, [s.id]: r.messages };
    } finally {
      loadingDetail.value = null;
    }
  }
}

function back(): void {
  router.push({ name: 'space-detail', params: { spaceId } });
}

onMounted(load);
</script>

<template>
  <div class="page" data-test="history-page">
    <div class="title-bar">
      <el-button class="btn-pill" @click="back">← 返回</el-button>
      <h2>历史对话</h2>
    </div>

    <p v-if="loading" class="empty-tip">加载中…</p>
    <div
      v-else-if="sessions.length === 0"
      class="empty-tip"
      data-test="empty"
    >还没有历史饭局。去家庭场景手动开饭，留下第一段记忆。</div>

    <div v-else class="groups" data-test="groups">
      <section
        v-for="g in groupedByDate"
        :key="g.key"
        class="group"
      >
        <h3 class="group-title">{{ g.label }}</h3>
        <ul class="session-list" :data-test="`session-list-${g.key}`">
          <li
            v-for="s in g.sessions"
            :key="s.id"
            class="session-item card"
            :class="{ open: expanded === s.id }"
          >
            <div class="info" @click="toggle(s)">
              <div class="meal-pill" :class="s.mealType">
                <span class="meal-emoji">{{ mealEmoji(s.mealType) }}</span>
                <span>{{ mealLabel(s.mealType) }}</span>
              </div>
              <div class="info-text">
                <strong>{{ new Date(s.startedAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) }}</strong>
                <span class="muted">
                  {{ s.endedAt ? '已结束' : '进行中' }}
                </span>
              </div>
              <span class="chevron" :class="{ open: expanded === s.id }">▾</span>
            </div>
            <div v-if="expanded === s.id" class="chat-list expanded">
              <p v-if="loadingDetail === s.id" class="empty-tip" style="padding:.6rem">加载对话…</p>
              <template v-else>
                <ChatBubble
                  v-for="m in messagesById[s.id] ?? []"
                  :key="m.id"
                  :message="m"
                />
                <p v-if="(messagesById[s.id] ?? []).length === 0" class="muted" style="padding:.4rem">这一顿没有留下对话。</p>
              </template>
            </div>
          </li>
        </ul>
      </section>
    </div>
  </div>
</template>

<style scoped>
.title-bar { display: flex; align-items: center; gap: .8rem; margin-bottom: 1rem; }
.title-bar h2 { margin: 0; }

.groups { display: grid; gap: 1.4rem; }
.group-title {
  margin: 0 0 .6rem; font-size: .95rem;
  color: var(--wood-700); text-transform: none;
  display: inline-block;
  background: var(--cream-100);
  padding: .25rem .7rem;
  border-radius: var(--radius-pill);
  border: 1px solid var(--line);
}

.session-list { list-style: none; padding: 0; margin: 0; display: grid; gap: .55rem; }
.session-item {
  padding: 0;
  overflow: hidden;
  transition: box-shadow .15s ease;
}
.session-item.open { box-shadow: 0 14px 32px rgba(196,124,44,0.18); }

.info {
  display: flex; align-items: center; gap: .8rem;
  padding: .85rem 1rem;
  cursor: pointer;
}
.info-text { flex: 1; display: flex; flex-direction: column; gap: .15rem; }
.info-text strong { font-size: .98rem; }
.chevron {
  color: var(--wood-700);
  transition: transform .15s ease;
  font-size: 1rem;
}
.chevron.open { transform: rotate(180deg); }

.meal-pill {
  display: inline-flex; align-items: center; gap: .35rem;
  padding: .25rem .7rem;
  border-radius: var(--radius-pill);
  font-size: .85rem;
  background: var(--cream-200);
  color: var(--wood-700);
  font-weight: 600;
  flex-shrink: 0;
}
.meal-pill.breakfast { background: #fff3df; color: #c47c2c; }
.meal-pill.lunch { background: #d8efe2; color: #2e7d52; }
.meal-pill.dinner { background: var(--rose-100); color: var(--tomato-500); }
.meal-emoji { font-size: 1rem; }

.expanded {
  border-top: 1px dashed var(--line);
  padding: .8rem 1rem 1rem;
  background: linear-gradient(180deg, #fffaf0, #fff);
}
</style>
