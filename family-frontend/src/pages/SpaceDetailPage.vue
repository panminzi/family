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
    <h2 v-if="space">{{ space.name }}</h2>
    <div class="actions">
      <el-button type="primary" data-test="add-member" @click="addMember">添加成员</el-button>
      <el-button data-test="open-scene" @click="openScene">进入家庭场景</el-button>
      <el-button data-test="open-history" @click="openHistory">历史对话</el-button>
    </div>
    <p v-if="error" class="err">{{ error }}</p>
    <p v-if="loading" class="empty-tip">加载中…</p>
    <p v-else-if="members.length === 0" class="empty-tip" data-test="empty">
      还没有成员，添加一个家人开始吧。
    </p>
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
.actions { display: flex; gap: 0.6rem; margin-bottom: 1rem; flex-wrap: wrap; }
.err { color: #d9534f; }
</style>
