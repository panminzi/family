<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { dinnerApi, membersApi } from '../api';
import type { MemberDTO } from '../api/client';
import MemberCard from '../components/MemberCard.vue';

const route = useRoute();
const router = useRouter();
const spaceId = route.params.spaceId as string;

const members = ref<MemberDTO[]>([]);
const error = ref('');
const startingMeal = ref<'breakfast' | 'lunch' | 'dinner' | null>(null);

async function load(): Promise<void> {
  try {
    members.value = await membersApi.list(spaceId);
  } catch {
    error.value = '加载失败';
  }
}

async function startMeal(mealType: 'breakfast' | 'lunch' | 'dinner'): Promise<void> {
  startingMeal.value = mealType;
  try {
    const r = await dinnerApi.start(spaceId, mealType);
    router.push({ name: 'dinner', params: { spaceId, sessionId: r.sessionId } });
  } catch (e: unknown) {
    error.value =
      (e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? '开饭失败';
  } finally {
    startingMeal.value = null;
  }
}

onMounted(load);
</script>

<template>
  <div class="page" data-test="scene-home">
    <h2>家庭场景</h2>
    <p v-if="error" class="err">{{ error }}</p>
    <div class="scene-stage" data-test="stage">
      <div class="card-row">
        <MemberCard v-for="m in members" :key="m.id" :member="m" />
      </div>
      <p v-if="members.length === 0" class="empty-tip">家里还没人，先去添加成员吧。</p>
    </div>

    <h3>手动开饭</h3>
    <div class="meal-buttons">
      <el-button
        type="primary"
        :loading="startingMeal === 'breakfast'"
        data-test="start-breakfast"
        @click="startMeal('breakfast')"
      >
        早餐
      </el-button>
      <el-button
        type="primary"
        :loading="startingMeal === 'lunch'"
        data-test="start-lunch"
        @click="startMeal('lunch')"
      >
        午餐
      </el-button>
      <el-button
        type="primary"
        :loading="startingMeal === 'dinner'"
        data-test="start-dinner"
        @click="startMeal('dinner')"
      >
        晚餐
      </el-button>
    </div>
  </div>
</template>

<style scoped>
.scene-stage {
  background: linear-gradient(180deg, #fff3df, #ffe2c0);
  border-radius: 18px;
  padding: 1.2rem;
  margin-bottom: 1.2rem;
}
.meal-buttons { display: flex; gap: 0.6rem; flex-wrap: wrap; }
.err { color: #d9534f; }
</style>
