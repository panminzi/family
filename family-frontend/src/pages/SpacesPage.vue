<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { spacesApi } from '../api';
import type { SpaceDTO } from '../api/client';
import { useRouter } from 'vue-router';

const spaces = ref<SpaceDTO[]>([]);
const loading = ref(false);
const newName = ref('');
const error = ref('');
const router = useRouter();

async function load(): Promise<void> {
  loading.value = true;
  try {
    spaces.value = await spacesApi.list();
  } catch (e: unknown) {
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

async function remove(sp: SpaceDTO): Promise<void> {
  if (!confirm(`确认删除 "${sp.name}"？所有成员、对话会一起清除。`)) return;
  await spacesApi.remove(sp.id);
  spaces.value = spaces.value.filter((s) => s.id !== sp.id);
}

onMounted(load);
</script>

<template>
  <div class="page" data-test="spaces-page">
    <h2>我的家庭空间</h2>
    <div class="row">
      <el-input
        v-model="newName"
        placeholder="例如：王家"
        data-test="new-name"
        style="max-width: 300px;"
      />
      <el-button type="primary" data-test="create-btn" @click="create">创建空间</el-button>
    </div>
    <p v-if="error" class="err">{{ error }}</p>
    <p v-if="loading" class="empty-tip">加载中…</p>
    <p v-else-if="spaces.length === 0" class="empty-tip" data-test="empty">
      还没有家庭空间，先创建一个吧。
    </p>
    <ul v-else class="space-list" data-test="space-list">
      <li v-for="sp in spaces" :key="sp.id" class="space-item">
        <div class="info" @click="open(sp)">
          <strong>{{ sp.name }}</strong>
          <span class="muted">{{ new Date(sp.createdAt).toLocaleDateString() }}</span>
        </div>
        <el-button size="small" @click="remove(sp)">删除</el-button>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.row { display: flex; gap: 0.6rem; margin-bottom: 1rem; }
.space-list { list-style: none; padding: 0; margin: 0; }
.space-item {
  display: flex; justify-content: space-between; align-items: center;
  padding: 0.8rem 1rem; background: #fff; border-radius: 12px; margin-bottom: 0.6rem;
  cursor: pointer;
}
.muted { color: #999; margin-left: 1rem; }
.err { color: #d9534f; }
</style>
