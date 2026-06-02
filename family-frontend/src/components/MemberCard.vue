<script setup lang="ts">
import { computed } from 'vue';
import type { MemberDTO } from '../api/client';

const props = defineProps<{ member: MemberDTO }>();
const initials = computed(() => props.member.name.slice(0, 1));
</script>

<template>
  <div class="member-card" data-test="member-card">
    <img
      v-if="member.avatarUrl"
      class="avatar"
      :src="member.avatarUrl"
      :alt="member.name"
      data-test="avatar"
    />
    <div v-else class="avatar placeholder" data-test="avatar-placeholder">{{ initials }}</div>
    <div class="meta">
      <strong>{{ member.name }}</strong>
      <span class="role">{{ member.relation }}</span>
    </div>
    <p v-if="member.personality?.traits?.length" class="traits" data-test="traits">
      <span v-for="t in member.personality.traits" :key="t" class="tag">{{ t }}</span>
    </p>
    <p v-else class="muted" data-test="no-personality">尚未生成画像</p>
  </div>
</template>

<style scoped>
.placeholder {
  display: flex; align-items: center; justify-content: center;
  font-size: 32px; font-weight: 600; color: #c47c2c;
}
.meta { margin: 0.6rem 0 0.3rem; text-align: center; }
.role { color: #999; margin-left: 0.4rem; }
.traits { display: flex; flex-wrap: wrap; gap: 0.3rem; justify-content: center; margin: 0.4rem 0 0; }
.tag {
  background: #ffe2b8; color: #c47c2c; padding: 0.1rem 0.6rem;
  border-radius: 999px; font-size: 0.8rem;
}
.muted { color: #999; font-size: 0.85rem; margin: 0.2rem 0 0; }
</style>
