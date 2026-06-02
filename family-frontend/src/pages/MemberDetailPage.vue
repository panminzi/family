<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { membersApi } from '../api';
import type { MemberDTO } from '../api/client';

const route = useRoute();
const router = useRouter();
const spaceId = route.params.spaceId as string;
const memberId = route.params.memberId as string;

const member = ref<MemberDTO | null>(null);
const generating = ref<'personality' | 'avatar' | null>(null);
const error = ref('');

async function load(): Promise<void> {
  try { member.value = await membersApi.get(memberId); } catch { error.value = '加载失败'; }
}

async function genPersonality(): Promise<void> {
  if (!member.value) return;
  generating.value = 'personality';
  try {
    member.value = await membersApi.generatePersonality(member.value.id);
  } catch (e: unknown) {
    error.value =
      (e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? '生成失败';
  } finally {
    generating.value = null;
  }
}

async function genAvatar(): Promise<void> {
  if (!member.value) return;
  generating.value = 'avatar';
  try {
    member.value = await membersApi.generateAvatar(member.value.id);
  } catch (e: unknown) {
    error.value =
      (e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? '生成失败';
  } finally {
    generating.value = null;
  }
}

async function remove(): Promise<void> {
  if (!member.value) return;
  if (!confirm('确认删除此成员？所有相关资料和对话会一并清除。')) return;
  await membersApi.remove(member.value.id);
  router.push({ name: 'space-detail', params: { spaceId } });
}

onMounted(load);
</script>

<template>
  <div class="page" data-test="member-detail">
    <p v-if="error" class="err">{{ error }}</p>
    <div v-if="member">
      <div class="header">
        <img v-if="member.avatarUrl" :src="member.avatarUrl" class="big-avatar" />
        <div v-else class="big-avatar placeholder">{{ member.name.slice(0, 1) }}</div>
        <div class="meta">
          <h2>{{ member.name }}</h2>
          <p class="role">{{ member.relation }}</p>
          <p class="desc">{{ member.description }}</p>
        </div>
      </div>
      <h3>性格画像</h3>
      <div v-if="member.personality" class="profile" data-test="profile">
        <p><strong>性格：</strong>{{ member.personality.traits.join('、') }}</p>
        <p><strong>说话风格：</strong>{{ member.personality.speechStyle }}</p>
        <p><strong>情绪倾向：</strong>{{ member.personality.emotionTendency }}</p>
        <p><strong>口头禅：</strong>{{ member.personality.catchphrase }}</p>
        <p><strong>关系基调：</strong>{{ member.personality.relationshipNotes }}</p>
      </div>
      <p v-else class="muted">尚未生成画像</p>

      <div class="actions">
        <el-button
          type="primary"
          :loading="generating === 'personality'"
          data-test="gen-personality"
          @click="genPersonality"
        >
          {{ member.personality ? '重新生成画像' : '生成画像' }}
        </el-button>
        <el-button
          :disabled="!member.personality"
          :loading="generating === 'avatar'"
          data-test="gen-avatar"
          @click="genAvatar"
        >
          {{ member.avatarUrl ? '重新生成卡通形象' : '生成卡通形象' }}
        </el-button>
        <el-button data-test="delete" @click="remove">删除成员</el-button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.header { display: flex; gap: 1rem; align-items: center; margin-bottom: 1rem; }
.big-avatar {
  width: 128px; height: 128px; border-radius: 50%; object-fit: cover; background: #f5e2c8;
}
.big-avatar.placeholder {
  display: flex; align-items: center; justify-content: center;
  font-size: 48px; font-weight: 600; color: #c47c2c;
}
.role { color: #999; }
.desc { white-space: pre-wrap; }
.profile p { margin: 0.3rem 0; }
.actions { display: flex; gap: 0.6rem; margin-top: 1rem; flex-wrap: wrap; }
.muted { color: #999; }
.err { color: #d9534f; }
</style>
