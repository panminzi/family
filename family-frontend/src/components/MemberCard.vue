<script setup lang="ts">
import { computed } from 'vue';
import type { MemberDTO } from '../api/client';
import MemberAvatar from './MemberAvatar.vue';

const props = defineProps<{ member: MemberDTO; clickable?: boolean }>();
const traitTags = computed(() => (props.member.personality?.traits ?? []).slice(0, 4));
</script>

<template>
  <div
    class="member-card"
    :class="{ clickable: clickable !== false }"
    data-test="member-card"
  >
    <div class="avatar-frame">
      <MemberAvatar
        :src="member.avatarUrl"
        :name="member.name"
        :size="92"
      />
    </div>
    <div class="meta">
      <strong class="name">{{ member.name }}</strong>
      <span class="role tag">{{ member.relation }}</span>
    </div>
    <div v-if="traitTags.length" class="traits" data-test="traits">
      <span v-for="t in traitTags" :key="t" class="tag leaf">{{ t }}</span>
    </div>
    <p v-else class="muted no-personality" data-test="no-personality">尚未生成画像</p>
  </div>
</template>

<style scoped>
.member-card {
  background: #fff;
  border-radius: var(--radius-card);
  padding: 1rem .8rem 1rem;
  box-shadow: var(--shadow-card);
  border: 1px solid var(--line);
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: .35rem;
  transition: transform .15s ease, box-shadow .15s ease;
}
.member-card.clickable { cursor: pointer; }
.member-card.clickable:hover {
  transform: translateY(-3px);
  box-shadow: 0 14px 32px rgba(196, 124, 44, 0.2);
}
.avatar-frame {
  padding: 4px;
  border-radius: 50%;
  background: linear-gradient(135deg, #fff3df, #ffe2b8);
  box-shadow: inset 0 0 0 1px var(--line);
  margin-bottom: .25rem;
}
.meta { display: inline-flex; align-items: center; gap: .5rem; flex-wrap: wrap; justify-content: center; }
.name { font-size: 1rem; }
.role { font-size: .78rem; }
.traits {
  display: flex; flex-wrap: wrap; gap: .25rem;
  justify-content: center;
  margin-top: .35rem;
}
.no-personality { font-size: .8rem; margin: .35rem 0 0; }
</style>
