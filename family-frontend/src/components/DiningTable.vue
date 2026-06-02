<script setup lang="ts">
import { computed } from 'vue';
import type { MemberDTO } from '../api/client';

const props = defineProps<{
  members: MemberDTO[];
  speakingMemberId?: string | null;
}>();

const seats = computed(() => {
  const list = props.members.slice(0, 8);
  const n = list.length;
  if (n === 0) return [];
  return list.map((m, i) => {
    const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
    const rx = 42;
    const ry = 26;
    const left = 50 + Math.cos(angle) * rx;
    const top = 50 + Math.sin(angle) * ry;
    return { member: m, leftPct: left, topPct: top };
  });
});
</script>

<template>
  <div class="stage" data-test="dining-stage">
    <div class="bg" aria-hidden="true">
      <div class="window">
        <div class="sun">☀</div>
      </div>
      <div class="floor"></div>
      <div class="table">
        <div class="dish dish-1">🍚</div>
        <div class="dish dish-2">🥘</div>
        <div class="dish dish-3">🥗</div>
        <div class="dish dish-4">🍲</div>
      </div>
    </div>

    <div class="seats">
      <div
        v-for="s in seats"
        :key="s.member.id"
        class="seat"
        :class="{ speaking: speakingMemberId === s.member.id }"
        :style="{ left: s.leftPct + '%', top: s.topPct + '%' }"
        :data-test="`seat-${s.member.id}`"
      >
        <div class="seat-avatar">
          <img v-if="s.member.avatarUrl" :src="s.member.avatarUrl" :alt="s.member.name" />
          <div v-else class="avatar-placeholder">{{ s.member.name.slice(0, 1) }}</div>
        </div>
        <div class="seat-name">{{ s.member.name }}</div>
      </div>
    </div>

    <div v-if="seats.length === 0" class="stage-empty">
      家里还没人围坐到桌边。先添加几位家人吧。
    </div>
  </div>
</template>

<style scoped>
.stage {
  position: relative;
  width: 100%;
  aspect-ratio: 16 / 9;
  min-height: 240px;
  border-radius: var(--radius-card);
  overflow: hidden;
  background: linear-gradient(180deg, #ffe7c2 0%, #ffd49b 70%, #f3b97a 100%);
  box-shadow: var(--shadow-card);
  border: 1px solid var(--line);
}
@media (max-width: 540px) {
  .stage { aspect-ratio: 4 / 5; min-height: 320px; }
}

.bg { position: absolute; inset: 0; }
.window {
  position: absolute; left: 6%; top: 8%;
  width: 26%; height: 30%;
  background: linear-gradient(180deg, #cfeaff, #fff7d8);
  border: 6px solid #fff;
  border-radius: 8px;
  box-shadow: 0 6px 0 #e1b574, inset 0 0 0 1px #fff;
}
.window::before, .window::after {
  content: '';
  position: absolute; background: #fff;
}
.window::before { left: 50%; top: 0; bottom: 0; width: 4px; transform: translateX(-50%); }
.window::after  { top: 50%; left: 0; right: 0; height: 4px; transform: translateY(-50%); }
.sun {
  position: absolute; right: 8%; top: 8%;
  font-size: 1.6rem; color: #f3c969;
  filter: drop-shadow(0 0 8px rgba(243, 201, 105, .8));
}

.floor {
  position: absolute; left: 0; right: 0; bottom: 0; height: 30%;
  background:
    repeating-linear-gradient(90deg, #c79055 0 28px, #b07b41 28px 30px);
  opacity: .85;
}

.table {
  position: absolute;
  left: 50%; bottom: 22%;
  transform: translateX(-50%);
  width: 70%; height: 30%;
  background: radial-gradient(ellipse at center, #b67a3d 0%, #8c5c2c 80%);
  border-radius: 50%;
  box-shadow: 0 18px 0 #6f4720, 0 26px 30px rgba(0,0,0,.18);
  display: flex; align-items: center; justify-content: center;
}
.dish {
  position: absolute;
  font-size: 1.5rem;
  filter: drop-shadow(0 2px 0 rgba(0,0,0,.15));
  animation: steam 2.6s ease-in-out infinite;
}
.dish-1 { left: 22%; top: 28%; }
.dish-2 { right: 22%; top: 28%; animation-delay: .4s; }
.dish-3 { left: 35%; bottom: 22%; animation-delay: .8s; }
.dish-4 { right: 35%; bottom: 22%; animation-delay: 1.2s; }
@keyframes steam {
  0%, 100% { transform: translateY(0); }
  50%      { transform: translateY(-3px); }
}

.seats { position: absolute; inset: 0; }
.seat {
  position: absolute;
  transform: translate(-50%, -50%);
  display: flex; flex-direction: column; align-items: center; gap: .25rem;
  transition: transform .25s ease;
}
.seat.speaking { transform: translate(-50%, -55%) scale(1.06); }
.seat-avatar {
  width: 56px; height: 56px;
  border-radius: 50%;
  overflow: hidden;
  background: #fff;
  border: 3px solid #fff;
  box-shadow: 0 4px 12px rgba(0,0,0,.18);
}
.seat.speaking .seat-avatar {
  border-color: var(--tomato-400);
  box-shadow: 0 0 0 3px rgba(240, 138, 106, .35), 0 6px 14px rgba(0,0,0,.2);
  animation: nod .9s ease-in-out infinite;
}
@keyframes nod {
  0%, 100% { transform: translateY(0); }
  50%      { transform: translateY(-2px); }
}
.seat-avatar img { width: 100%; height: 100%; object-fit: cover; }
.avatar-placeholder {
  width: 100%; height: 100%;
  display: flex; align-items: center; justify-content: center;
  font-weight: 700; color: var(--wood-700); font-size: 1.2rem;
  background: var(--cream-100);
}
.seat-name {
  font-size: .75rem; color: var(--bark-900);
  background: rgba(255,255,255,.85);
  padding: .05rem .45rem;
  border-radius: var(--radius-pill);
  white-space: nowrap;
}
@media (max-width: 540px) {
  .seat-avatar { width: 44px; height: 44px; }
  .seat-name { font-size: .7rem; }
}

.stage-empty {
  position: absolute; inset: 0;
  display: flex; align-items: center; justify-content: center;
  color: var(--bark-900);
  background: rgba(255, 255, 255, .55);
  text-align: center;
  padding: 1rem;
}
</style>
