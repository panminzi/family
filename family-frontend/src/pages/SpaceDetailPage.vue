<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { membersApi, spacesApi } from '../api';
import type { MemberDTO, SpaceDTO } from '../api/client';
import MemberCard from '../components/MemberCard.vue';

const route = useRoute();
const router = useRouter();
const spaceId = route.params.spaceId as string;

const space = ref<SpaceDTO | null>(null);
const members = ref<MemberDTO[]>([]);
const loading = ref(false);
const error = ref('');

async function load(): Promise<void> {
  loading.value = true;
  try {
    const sp = await spacesApi.get(spaceId);
    space.value = sp;
    members.value = await membersApi.list(spaceId);
  } catch {
    error.value = '加载失败';
  } finally {
    loading.value = false;
  }
}

function addMember(): void {
  router.push({ name: 'member-add', params: { spaceId } });
}

function openMember(m: MemberDTO): void {
  router.push({ name: 'member-detail', params: { spaceId, memberId: m.id } });
}

function openScene(): void {
  router.push({ name: 'scene-home', params: { spaceId } });
}

function openHistory(): void {
  router.push({ name: 'history', params: { spaceId } });
}

onMounted(load);
</script>

<template>
  <div class="page" data-test="space-detail">
    <div v-if="space" class="space-hero card warm">
      <div class="space-hero-icon" aria-hidden="true">🏡</div>
      <div class="space-hero-text">
        <p class="muted">家庭空间</p>
        <h1>{{ space.name }}</h1>
        <p class="muted">
          目前 {{ members.length }} 位家人
          <span v-if="members.filter((m) => m.personality).length"> · {{ members.filter((m) => m.personality).length }} 位已生成画像</span>
        </p>
      </div>
      <div class="space-hero-actions">
        <el-button type="primary" class="btn-pill" data-test="open-scene" @click="openScene">
          进入家庭场景
        </el-button>
        <el-button class="btn-pill" data-test="open-history" @click="openHistory">
          历史对话
        </el-button>
      </div>
    </div>

    <p v-if="error" class="err">{{ error }}</p>

    <div class="section-title">
      <h2>家庭成员</h2>
      <div class="actions">
        <el-button type="primary" class="btn-pill" data-test="add-member" @click="addMember">
          + 添加成员
        </el-button>
      </div>
    </div>

    <p v-if="loading" class="empty-tip">加载中…</p>
    <div
      v-else-if="members.length === 0"
      class="empty-tip"
      data-test="empty"
    >
      <p style="margin: 0 0 .6rem">还没有成员，添加一个家人开始吧。</p>
      <el-button type="primary" class="btn-pill" @click="addMember">添加第一位家人</el-button>
    </div>
    <div v-else class="card-row" data-test="member-list">
      <MemberCard
        v-for="m in members"
        :key="m.id"
        :member="m"
        @click="openMember(m)"
      />
    </div>
  </div>
</template>

<style scoped>
.space-hero {
  display: flex; align-items: center; gap: 1rem;
  padding: 1.2rem;
  margin-bottom: 1.2rem;
  flex-wrap: wrap;
}
.space-hero-icon {
  width: 60px; height: 60px;
  font-size: 2rem;
  display: flex; align-items: center; justify-content: center;
  background: var(--cream-100);
  border-radius: 16px;
  flex-shrink: 0;
}
.space-hero-text { flex: 1; min-width: 200px; }
.space-hero-text p { margin: 0; }
.space-hero-text h1 { margin: .15rem 0; font-size: 1.4rem; }
.space-hero-actions { display: flex; gap: .5rem; flex-wrap: wrap; }
@media (max-width: 480px) {
  .space-hero-actions { width: 100%; }
  .space-hero-actions .el-button { flex: 1; }
}
</style>
