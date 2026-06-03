<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { spacesApi, membersApi, dinnerApi } from '../api';
import type { MemberDTO, SpaceDTO, DinnerSessionDTO } from '../api/client';
import { useAuthStore } from '../stores/auth';

interface SpaceData {
  space: SpaceDTO;
  members: MemberDTO[];
  sessions: DinnerSessionDTO[];
}

const router = useRouter();
const auth = useAuthStore();
const loading = ref(false);
const error = ref('');
const data = ref<SpaceData[]>([]);
const removing = ref<string | null>(null);

const stats = computed(() => {
  const spaceCount = data.value.length;
  const memberCount = data.value.reduce((n, s) => n + s.members.length, 0);
  const sessionCount = data.value.reduce((n, s) => n + s.sessions.length, 0);
  return { spaceCount, memberCount, sessionCount };
});

async function load(): Promise<void> {
  loading.value = true;
  error.value = '';
  try {
    const spaces = await spacesApi.list();
    const detailed = await Promise.all(
      spaces.map(async (sp) => {
        const [members, sessions] = await Promise.all([
          membersApi.list(sp.id).catch(() => []),
          dinnerApi.sessions(sp.id).catch(() => []),
        ]);
        return { space: sp, members, sessions };
      }),
    );
    data.value = detailed;
  } catch {
    error.value = '加载失败';
  } finally {
    loading.value = false;
  }
}

function doubleConfirm(messages: string[]): boolean {
  for (const m of messages) {
    if (!confirm(m)) return false;
  }
  return true;
}

async function removeMember(spaceId: string, m: MemberDTO): Promise<void> {
  const ok = doubleConfirm([
    `确认删除成员「${m.name}」？\n\n这会清除照片、文本资料、性格画像、和这位家人参与过的对话。`,
    `再确认一次：删除「${m.name}」无法恢复，是否继续？`,
  ]);
  if (!ok) return;
  removing.value = m.id;
  try {
    await membersApi.remove(m.id);
    const sp = data.value.find((s) => s.space.id === spaceId);
    if (sp) sp.members = sp.members.filter((x) => x.id !== m.id);
  } finally {
    removing.value = null;
  }
}

async function removeSpace(s: SpaceData): Promise<void> {
  const ok = doubleConfirm([
    `确认删除整个家庭「${s.space.name}」？\n\n这会清除该空间下的所有成员（${s.members.length} 位）和全部历史对话（${s.sessions.length} 顿饭）。`,
    `这是不可恢复的操作。再确认一次：要删除「${s.space.name}」吗？`,
  ]);
  if (!ok) return;
  removing.value = s.space.id;
  try {
    await spacesApi.remove(s.space.id);
    data.value = data.value.filter((d) => d.space.id !== s.space.id);
  } finally {
    removing.value = null;
  }
}

function back(): void {
  router.push({ name: 'spaces' });
}

onMounted(load);
</script>

<template>
  <div class="page" data-test="privacy-page">
    <div class="title-bar">
      <el-button class="btn-pill" @click="back">← 返回</el-button>
      <h2>隐私与数据</h2>
    </div>

    <section class="card warm intro">
      <div class="intro-icon" aria-hidden="true">🔐</div>
      <div>
        <h3>你的家庭，你做主</h3>
        <p class="muted">
          这里列出了我们为你保存的所有数据。任何成员或整个家庭，都能一键删除，删除后立即生效，无法恢复。
        </p>
      </div>
    </section>

    <section class="stats">
      <div class="stat card" data-test="stat-spaces">
        <p class="muted">家庭空间</p>
        <strong>{{ stats.spaceCount }}</strong>
      </div>
      <div class="stat card" data-test="stat-members">
        <p class="muted">家庭成员</p>
        <strong>{{ stats.memberCount }}</strong>
      </div>
      <div class="stat card" data-test="stat-sessions">
        <p class="muted">历史饭局</p>
        <strong>{{ stats.sessionCount }}</strong>
      </div>
    </section>

    <p v-if="error" class="err">{{ error }}</p>
    <p v-if="loading" class="empty-tip">加载中…</p>

    <div v-else-if="data.length === 0" class="empty-tip" data-test="empty">
      还没有任何数据。
    </div>

    <div v-else class="space-blocks" data-test="space-blocks">
      <article
        v-for="s in data"
        :key="s.space.id"
        class="space-block card"
      >
        <header class="space-block-head">
          <div>
            <h3>{{ s.space.name }}</h3>
            <p class="muted">
              成员 {{ s.members.length }} 位 · 历史饭局 {{ s.sessions.length }} 顿 · 创建于 {{ new Date(s.space.createdAt).toLocaleDateString() }}
            </p>
          </div>
          <el-button
            class="btn-pill danger-btn"
            :loading="removing === s.space.id"
            :data-test="`delete-space-${s.space.id}`"
            @click="removeSpace(s)"
          >删除整个家庭</el-button>
        </header>

        <ul v-if="s.members.length" class="member-list">
          <li
            v-for="m in s.members"
            :key="m.id"
            class="member-row"
          >
            <div class="member-avatar">
              <img v-if="m.avatarUrl" :src="m.avatarUrl" :alt="m.name" />
              <span v-else>{{ m.name.slice(0, 1) }}</span>
            </div>
            <div class="member-info">
              <strong>{{ m.name }}</strong>
              <span class="tag">{{ m.relation }}</span>
              <span v-if="m.personality" class="muted">已有画像</span>
              <span v-else class="muted">无画像</span>
            </div>
            <el-button
              size="small"
              class="btn-pill"
              :loading="removing === m.id"
              :data-test="`delete-member-${m.id}`"
              @click="removeMember(s.space.id, m)"
            >删除</el-button>
          </li>
        </ul>
        <p v-else class="muted">这个家暂时没有成员。</p>
      </article>
    </div>

    <section class="card disclaimer">
      <h3>账号信息</h3>
      <p class="muted">
        登录账号：{{ auth.user?.email ?? '—' }}
      </p>
      <p class="muted">
        密码以 bcrypt 不可逆 hash 存储；上传的照片仅在你删除资料时一并清除。AI 调用只发送成员姓名、关系、描述、对话样本，不会发送邮箱或登录凭证。
      </p>
    </section>
  </div>
</template>

<style scoped>
.title-bar { display: flex; align-items: center; gap: .8rem; margin-bottom: 1rem; }
.title-bar h2 { margin: 0; }

.intro {
  display: flex; gap: 1rem; padding: 1.2rem;
  margin-bottom: 1rem;
  align-items: center;
}
.intro h3 { margin: 0 0 .25rem; }
.intro p { margin: 0; }
.intro-icon {
  font-size: 1.8rem;
  width: 52px; height: 52px;
  display: flex; align-items: center; justify-content: center;
  background: var(--cream-100);
  border-radius: 14px;
  flex-shrink: 0;
}

.stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: .6rem;
  margin-bottom: 1.2rem;
}
.stat { padding: .9rem 1rem; text-align: center; }
.stat p { margin: 0; }
.stat strong { font-size: 1.6rem; color: var(--wood-700); }

.space-blocks { display: grid; gap: 1rem; }
.space-block { padding: 1rem 1.1rem; }
.space-block-head {
  display: flex; align-items: center; justify-content: space-between; gap: .8rem;
  margin-bottom: .8rem;
  flex-wrap: wrap;
}
.space-block-head h3 { margin: 0; }
.space-block-head p { margin: .15rem 0 0; }
.danger-btn { background: #fff; border-color: var(--danger) !important; color: var(--danger) !important; }
.danger-btn:hover { background: var(--rose-100) !important; }

.member-list { list-style: none; padding: 0; margin: 0; display: grid; gap: .4rem; }
.member-row {
  display: flex; align-items: center; gap: .7rem;
  padding: .55rem .75rem;
  background: var(--cream-50);
  border: 1px solid var(--line);
  border-radius: 12px;
}
.member-avatar {
  width: 36px; height: 36px; border-radius: 50%;
  background: var(--cream-100);
  display: flex; align-items: center; justify-content: center;
  font-weight: 700; color: var(--wood-700);
  overflow: hidden; flex-shrink: 0;
}
.member-avatar img { width: 100%; height: 100%; object-fit: cover; }
.member-info { flex: 1; min-width: 0; display: flex; align-items: center; gap: .4rem; flex-wrap: wrap; }

.disclaimer { margin-top: 1.2rem; padding: 1rem 1.2rem; }
.disclaimer h3 { margin: 0 0 .35rem; }
.disclaimer p { margin: .25rem 0; }
</style>
