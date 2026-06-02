<script setup lang="ts">
import { computed, ref, onMounted } from 'vue';
import { spacesApi } from '../api';
import type { SpaceDTO } from '../api/client';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';

const spaces = ref<SpaceDTO[]>([]);
const loading = ref(false);
const newName = ref('');
const error = ref('');
const router = useRouter();
const auth = useAuthStore();

const greeting = computed(() => {
  const h = new Date().getHours();
  if (h < 6) return '夜深了';
  if (h < 11) return '早安';
  if (h < 14) return '中午好';
  if (h < 18) return '下午好';
  return '晚上好';
});

async function load(): Promise<void> {
  loading.value = true;
  try {
    spaces.value = await spacesApi.list();
  } catch {
    error.value = '加载失败';
  } finally {
    loading.value = false;
  }
}

async function create(): Promise<void> {
  if (!newName.value.trim()) return;
  try {
    const sp = await spacesApi.create(newName.value.trim());
    spaces.value.unshift(sp);
    newName.value = '';
  } catch {
    error.value = '创建失败';
  }
}

function open(sp: SpaceDTO): void {
  router.push({ name: 'space-detail', params: { spaceId: sp.id } });
}

function openScene(sp: SpaceDTO, e: Event): void {
  e.stopPropagation();
  router.push({ name: 'scene-home', params: { spaceId: sp.id } });
}

async function remove(sp: SpaceDTO, e: Event): Promise<void> {
  e.stopPropagation();
  if (!confirm(`确认删除 "${sp.name}"？所有成员、对话会一起清除。`)) return;
  await spacesApi.remove(sp.id);
  spaces.value = spaces.value.filter((s) => s.id !== sp.id);
}

onMounted(load);
</script>

<template>
  <div class="page" data-test="spaces-page">
    <section class="hero">
      <div>
        <p class="hero-eyebrow">{{ greeting }}{{ auth.user ? '，' + auth.user.displayName : '' }}</p>
        <h1>欢迎来到你的卡通家庭</h1>
        <p class="muted">在这里，每个家人都能围坐一桌、开口说话。</p>
      </div>
      <div class="hero-illust" aria-hidden="true">🍜🥢🍚</div>
    </section>

    <section class="card create-card">
      <h3>创建一个新的家庭空间</h3>
      <div class="row">
        <el-input
          v-model="newName"
          placeholder="例如：王家、奶奶家、爷爷的二楼…"
          data-test="new-name"
          class="grow-input"
        />
        <el-button type="primary" class="btn-pill" data-test="create-btn" @click="create">
          创建空间
        </el-button>
      </div>
      <p class="hint muted">每个空间都是一个独立的家，可以分别加成员、各自开饭。</p>
    </section>

    <p v-if="error" class="err">{{ error }}</p>

    <div class="section-title">
      <h2>我的家</h2>
      <span class="muted" v-if="spaces.length">共 {{ spaces.length }} 个</span>
    </div>

    <p v-if="loading" class="empty-tip">加载中…</p>
    <div v-else-if="spaces.length === 0" class="empty-tip" data-test="empty">
      还没有家庭空间，先在上面创建一个吧。
    </div>
    <ul v-else class="space-list" data-test="space-list">
      <li
        v-for="sp in spaces"
        :key="sp.id"
        class="space-item card"
        @click="open(sp)"
      >
        <div class="space-icon" aria-hidden="true">🏡</div>
        <div class="info">
          <strong>{{ sp.name }}</strong>
          <span class="muted">创建于 {{ new Date(sp.createdAt).toLocaleDateString() }}</span>
        </div>
        <div class="space-actions">
          <el-button size="small" class="btn-pill" type="primary" @click="(e) => openScene(sp, e)">
            进入场景
          </el-button>
          <el-button size="small" class="btn-pill" @click="(e) => remove(sp, e)">
            删除
          </el-button>
        </div>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.hero {
  display: flex; align-items: center; justify-content: space-between; gap: 1rem;
  padding: 1.4rem 1.2rem;
  margin-bottom: 1.2rem;
  background: linear-gradient(135deg, #fff3df 0%, #ffe2b8 60%, #fde0d6 100%);
  border-radius: var(--radius-card);
  border: 1px solid var(--line);
  box-shadow: var(--shadow-card);
}
.hero h1 { margin: .25rem 0 .35rem; font-size: 1.4rem; }
.hero-eyebrow { color: var(--wood-700); font-weight: 600; margin: 0; font-size: .9rem; }
.hero-illust { font-size: 2.2rem; letter-spacing: .2em; flex-shrink: 0; }
@media (max-width: 480px) {
  .hero-illust { font-size: 1.6rem; letter-spacing: .15em; }
  .hero h1 { font-size: 1.2rem; }
}

.create-card { margin-bottom: 1.2rem; }
.create-card h3 { margin: 0 0 .6rem; }
.grow-input { flex: 1 1 220px; min-width: 0; }
.hint { font-size: .85rem; margin: .6rem 0 0; }

.space-list { list-style: none; padding: 0; margin: 0; display: grid; gap: .7rem; }
@media (min-width: 720px) {
  .space-list { grid-template-columns: repeat(2, 1fr); }
}
.space-item {
  display: flex; align-items: center; gap: .9rem;
  padding: 1rem;
  cursor: pointer;
  transition: transform .15s ease, box-shadow .15s ease;
}
.space-item:hover { transform: translateY(-2px); box-shadow: 0 12px 30px rgba(196, 124, 44, 0.18); }
.space-icon {
  width: 44px; height: 44px;
  font-size: 1.6rem;
  display: flex; align-items: center; justify-content: center;
  background: var(--cream-100);
  border-radius: 12px;
  flex-shrink: 0;
}
.info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: .15rem; }
.info strong { font-size: 1rem; }
.space-actions { display: flex; gap: .4rem; flex-wrap: wrap; }
@media (max-width: 480px) {
  .space-actions { flex-direction: column; align-items: stretch; }
  .space-actions .el-button { width: 100%; }
}
</style>
