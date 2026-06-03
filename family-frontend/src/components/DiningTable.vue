<script setup lang="ts">
import { computed } from 'vue';
import type { MemberDTO } from '../api/client';
import MemberAvatar from './MemberAvatar.vue';
import { getDefaultTheme, type Theme } from '../theme/themes';

const props = withDefaults(
  defineProps<{
    members: MemberDTO[];
    speakingMemberId?: string | null;
    theme?: Theme;
  }>(),
  {
    speakingMemberId: null,
    theme: () => getDefaultTheme(),
  },
);

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

const dishes = computed<[string, string, string, string]>(
  () => props.theme.dishes ?? ['🍚', '🥘', '🥗', '🍲'],
);

const stageStyle = computed(() => ({
  background: `linear-gradient(180deg, ${props.theme.tokens.skyTop} 0%, ${props.theme.tokens.skyBottom} 100%)`,
  '--stage-floor': props.theme.tokens.floor,
  '--stage-accent': props.theme.tokens.accent,
  '--stage-primary': props.theme.tokens.primary,
}));

interface DecorNode {
  symbol: string;
  zone: 'ceiling' | 'window' | 'sky';
  leftPct: number;
  topPct: number;
  delay: number;
  size: number;
}

const decorations = computed<DecorNode[]>(() => {
  const out: DecorNode[] = [];
  for (const group of props.theme.decor) {
    for (let i = 0; i < group.count; i++) {
      const t = group.count === 1 ? 0.5 : i / (group.count - 1);
      let leftPct = 0;
      let topPct = 0;
      let size = 1.4;
      if (group.zone === 'ceiling') {
        leftPct = 12 + t * 76;
        topPct = 6 + (i % 2) * 4;
        size = 1.6;
      } else if (group.zone === 'window') {
        leftPct = 8 + t * 22;
        topPct = 14 + i * 8;
        size = 1.3;
      } else {
        leftPct = 8 + t * 80;
        topPct = 4 + (i % 3) * 6;
        size = group.symbol === '🌕' ? 2.6 : 1.2;
      }
      out.push({
        symbol: group.symbol,
        zone: group.zone,
        leftPct,
        topPct,
        delay: i * 0.25,
        size,
      });
    }
  }
  return out;
});

function sun(theme: Theme): string {
  if (theme.key === 'midautumn') return '🌙';
  if (theme.key === 'snow' || theme.key === 'rain') return '☁';
  return '☀';
}
</script>

<template>
  <div
    class="stage"
    :style="stageStyle as any"
    data-test="dining-stage"
    :data-theme="theme.key"
  >
    <div class="bg" aria-hidden="true">
      <div class="window">
        <div class="sun">{{ sun(theme) }}</div>
      </div>
      <div class="floor"></div>

      <div
        v-for="(d, idx) in decorations"
        :key="`${theme.key}-${idx}`"
        class="decor"
        :class="`decor-${d.zone}`"
        :style="{
          left: d.leftPct + '%',
          top: d.topPct + '%',
          fontSize: d.size + 'rem',
          animationDelay: d.delay + 's',
        }"
        data-test="decor"
      >
        {{ d.symbol }}
      </div>

      <div class="table">
        <div class="dish dish-1">{{ dishes[0] }}</div>
        <div class="dish dish-2">{{ dishes[1] }}</div>
        <div class="dish dish-3">{{ dishes[2] }}</div>
        <div class="dish dish-4">{{ dishes[3] }}</div>
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
          <MemberAvatar
            :src="s.member.avatarUrl"
            :name="s.member.name"
            :size="56"
            :loading-shimmer="false"
          />
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
  box-shadow: var(--shadow-card);
  border: 1px solid var(--line);
  transition: background .6s ease;
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
  transition: background .6s ease;
}
.stage[data-theme="midautumn"] .window { background: linear-gradient(180deg, #1f2a44, #3b4870); }
.stage[data-theme="snow"]      .window { background: linear-gradient(180deg, #e6eef5, #c2d2e0); }
.stage[data-theme="rain"]      .window { background: linear-gradient(180deg, #aebbcb, #5e6c7e); }

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
    repeating-linear-gradient(90deg, var(--stage-floor) 0 28px, color-mix(in srgb, var(--stage-floor) 70%, black) 28px 30px);
  opacity: .85;
  transition: background .6s ease;
}

.table {
  position: absolute;
  left: 50%; bottom: 22%;
  transform: translateX(-50%);
  width: 70%; height: 30%;
  background: radial-gradient(ellipse at center, color-mix(in srgb, var(--stage-floor) 80%, #d4a25e) 0%, color-mix(in srgb, var(--stage-floor) 50%, #6f4720) 80%);
  border-radius: 50%;
  box-shadow: 0 18px 0 color-mix(in srgb, var(--stage-floor) 40%, #2d1b09), 0 26px 30px rgba(0,0,0,.18);
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

.decor {
  position: absolute;
  transform: translate(-50%, -50%);
  pointer-events: none;
  filter: drop-shadow(0 2px 4px rgba(0,0,0,.18));
}
.decor-ceiling { animation: swing 3.6s ease-in-out infinite; transform-origin: 50% 0%; }
@keyframes swing {
  0%, 100% { transform: translate(-50%, -50%) rotate(-4deg); }
  50%      { transform: translate(-50%, -50%) rotate(4deg); }
}
.decor-window  { animation: float 4s ease-in-out infinite; }
.decor-sky     { animation: drift 8s linear infinite; }
@keyframes float {
  0%, 100% { transform: translate(-50%, -50%); }
  50%      { transform: translate(-50%, -55%); }
}
@keyframes drift {
  0%   { transform: translate(-50%, -50%); opacity: .8; }
  50%  { transform: translate(-40%, -55%); opacity: 1; }
  100% { transform: translate(-50%, -50%); opacity: .8; }
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
  border-color: var(--stage-primary);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--stage-primary) 35%, transparent), 0 6px 14px rgba(0,0,0,.2);
  animation: nod .9s ease-in-out infinite;
}
@keyframes nod {
  0%, 100% { transform: translateY(0); }
  50%      { transform: translateY(-2px); }
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
