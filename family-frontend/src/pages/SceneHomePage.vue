<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { dinnerApi, membersApi } from '../api';
import type { DinnerSessionDTO, MemberDTO } from '../api/client';
import DiningTable from '../components/DiningTable.vue';
import {
  getDefaultTheme,
  getThemes,
  themeFromTriggerInfo,
  type Theme,
} from '../theme/themes';
import { useTheme } from '../theme/useTheme';

const route = useRoute();
const router = useRouter();
const spaceId = route.params.spaceId as string;

const members = ref<MemberDTO[]>([]);
const error = ref('');
const startingMeal = ref<'breakfast' | 'lunch' | 'dinner' | null>(null);
const now = ref(new Date());
let timer: ReturnType<typeof setInterval> | null = null;

const { theme, setFromTriggerInfo } = useTheme();
const detectedTheme = ref<Theme>(getDefaultTheme());
const previewTheme = ref<Theme | null>(null);
const showPicker = ref(false);
const allThemes = getThemes();

const activeTheme = computed<Theme>(() => previewTheme.value ?? detectedTheme.value);

const MEAL_HOURS: Record<'breakfast' | 'lunch' | 'dinner', { h: number; m: number; label: string }> = {
  breakfast: { h: 7, m: 30, label: '早餐' },
  lunch: { h: 12, m: 0, label: '午餐' },
  dinner: { h: 18, m: 30, label: '晚餐' },
};

interface NextMeal {
  type: 'breakfast' | 'lunch' | 'dinner';
  label: string;
  at: Date;
  ms: number;
}

const nextMeal = computed<NextMeal>(() => {
  const t = now.value;
  const candidates: NextMeal[] = [];
  (['breakfast', 'lunch', 'dinner'] as const).forEach((type) => {
    const cfg = MEAL_HOURS[type];
    const today = new Date(t.getFullYear(), t.getMonth(), t.getDate(), cfg.h, cfg.m, 0, 0);
    const tomorrow = new Date(today.getTime() + 24 * 3600 * 1000);
    candidates.push({ type, label: cfg.label, at: today, ms: today.getTime() - t.getTime() });
    candidates.push({ type, label: cfg.label, at: tomorrow, ms: tomorrow.getTime() - t.getTime() });
  });
  const future = candidates.filter((c) => c.ms > 0).sort((a, b) => a.ms - b.ms);
  return future[0];
});

const countdown = computed(() => {
  const ms = Math.max(0, nextMeal.value.ms);
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${pad(h)} : ${pad(m)} : ${pad(s)}`;
});

function detectThemeFromSessions(sessions: DinnerSessionDTO[]): Theme {
  if (!sessions.length) return getDefaultTheme();
  const recentMs = 24 * 3600 * 1000;
  const cutoff = Date.now() - recentMs;
  const recent = sessions.find((s) => new Date(s.startedAt).getTime() >= cutoff);
  if (!recent) return getDefaultTheme();
  return themeFromTriggerInfo((recent as DinnerSessionDTO).triggerInfo ?? null);
}

async function load(): Promise<void> {
  try {
    members.value = await membersApi.list(spaceId);
  } catch {
    error.value = '加载失败';
    return;
  }
  try {
    const sessions = await dinnerApi.sessions(spaceId);
    detectedTheme.value = detectThemeFromSessions(sessions);
  } catch {
    detectedTheme.value = getDefaultTheme();
  }
  syncTheme();
}

function syncTheme(): void {
  theme.value = activeTheme.value;
}

function pickPreview(t: Theme): void {
  previewTheme.value = t.key === detectedTheme.value.key ? null : t;
  syncTheme();
}

function clearPreview(): void {
  previewTheme.value = null;
  syncTheme();
}

async function startMeal(mealType: 'breakfast' | 'lunch' | 'dinner'): Promise<void> {
  startingMeal.value = mealType;
  error.value = '';
  try {
    const r = await dinnerApi.start(spaceId, mealType);
    if (r.trigger || (r.overlays && r.overlays.length > 0)) {
      setFromTriggerInfo(
        JSON.stringify({ primary: r.trigger ?? null, overlays: r.overlays ?? [] }),
      );
    }
    router.push({ name: 'dinner', params: { spaceId, sessionId: r.sessionId } });
  } catch (e: unknown) {
    error.value =
      (e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? '开饭失败';
  } finally {
    startingMeal.value = null;
  }
}

function back(): void {
  router.push({ name: 'space-detail', params: { spaceId } });
}

onMounted(() => {
  load();
  timer = setInterval(() => { now.value = new Date(); }, 1000);
});
onBeforeUnmount(() => { if (timer) clearInterval(timer); });
</script>

<template>
  <div class="page" data-test="scene-home">
    <div class="title-bar">
      <el-button class="btn-pill" @click="back">← 返回</el-button>
      <h2>家庭场景</h2>
      <span v-if="activeTheme.key !== 'default'" class="theme-chip" data-test="theme-chip">
        {{ activeTheme.label }}
      </span>
    </div>

    <p v-if="error" class="err">{{ error }}</p>

    <div v-if="activeTheme.key !== 'default'" class="theme-banner" data-test="theme-banner">
      <span class="theme-icon" aria-hidden="true">🎏</span>
      <span class="theme-caption">{{ activeTheme.caption }}</span>
      <span v-if="previewTheme" class="theme-preview-tag">预览中</span>
    </div>

    <DiningTable :members="members" :theme="activeTheme" />

    <section class="card preview-card">
      <div class="preview-header">
        <div>
          <h4>节日皮肤</h4>
          <p class="muted">
            饭点后端命中节日时会自动切换。点开下方挑一种风格也能预览效果。
          </p>
        </div>
        <el-button
          size="small"
          class="btn-pill"
          data-test="toggle-picker"
          @click="showPicker = !showPicker"
        >
          {{ showPicker ? '收起' : '查看皮肤' }}
        </el-button>
      </div>
      <transition name="fade">
        <div v-if="showPicker" class="theme-picker" data-test="theme-picker">
          <button
            v-for="t in allThemes"
            :key="t.key"
            type="button"
            class="theme-swatch"
            :class="{ active: activeTheme.key === t.key }"
            :data-test="`theme-${t.key}`"
            @click="pickPreview(t)"
          >
            <span
              class="swatch-color"
              :style="{
                background: `linear-gradient(135deg, ${t.tokens.skyTop}, ${t.tokens.skyBottom})`,
              }"
            />
            <span class="swatch-label">{{ t.label }}</span>
          </button>
          <el-button
            v-if="previewTheme"
            size="small"
            class="btn-pill clear-preview"
            data-test="clear-preview"
            @click="clearPreview"
          >还原当前皮肤</el-button>
        </div>
      </transition>
    </section>

    <section class="countdown card warm" data-test="countdown">
      <div class="cd-text">
        <p class="muted">下一顿</p>
        <h3>{{ nextMeal.label }} · {{ nextMeal.at.toLocaleString() }}</h3>
      </div>
      <div class="cd-time" aria-label="距离下一顿的倒计时">{{ countdown }}</div>
    </section>

    <section class="card meal-card">
      <div class="section-title" style="margin:0 0 .8rem">
        <h3>现在开饭</h3>
        <span class="muted">手动召集家人围坐</span>
      </div>
      <div class="meal-buttons">
        <el-button
          type="primary"
          size="large"
          class="btn-pill meal-btn breakfast"
          :loading="startingMeal === 'breakfast'"
          data-test="start-breakfast"
          @click="startMeal('breakfast')"
        >
          <span class="meal-emoji">🥣</span><span>早餐开饭</span>
        </el-button>
        <el-button
          type="primary"
          size="large"
          class="btn-pill meal-btn lunch"
          :loading="startingMeal === 'lunch'"
          data-test="start-lunch"
          @click="startMeal('lunch')"
        >
          <span class="meal-emoji">🍱</span><span>午餐开饭</span>
        </el-button>
        <el-button
          type="primary"
          size="large"
          class="btn-pill meal-btn dinner"
          :loading="startingMeal === 'dinner'"
          data-test="start-dinner"
          @click="startMeal('dinner')"
        >
          <span class="meal-emoji">🍲</span><span>晚餐开饭</span>
        </el-button>
      </div>
      <p v-if="members.length === 0" class="muted hint">
        提示：先去家庭页添加成员，开饭时才能听到 ta 们的声音。
      </p>
    </section>
  </div>
</template>

<style scoped>
.title-bar { display: flex; align-items: center; gap: .8rem; margin-bottom: 1rem; flex-wrap: wrap; }
.title-bar h2 { margin: 0; }
.theme-chip {
  font-size: .8rem; padding: .2rem .7rem;
  border-radius: var(--radius-pill);
  background: color-mix(in srgb, var(--theme-primary, #f08a6a) 18%, white);
  border: 1px solid color-mix(in srgb, var(--theme-primary, #f08a6a) 35%, transparent);
  color: color-mix(in srgb, var(--theme-primary, #f08a6a) 70%, #4a2a18);
}

.theme-banner {
  display: flex; align-items: center; gap: .6rem;
  padding: .6rem .9rem;
  margin-bottom: .8rem;
  background: color-mix(in srgb, var(--theme-primary, #f08a6a) 12%, #fff);
  border: 1px solid color-mix(in srgb, var(--theme-primary, #f08a6a) 30%, transparent);
  border-radius: var(--radius-card);
  box-shadow: var(--shadow-soft);
}
.theme-icon { font-size: 1.2rem; }
.theme-caption { font-size: .92rem; flex: 1; }
.theme-preview-tag {
  font-size: .72rem;
  padding: .15rem .5rem;
  border-radius: var(--radius-pill);
  background: rgba(255,255,255,.6);
  color: var(--muted);
}

.preview-card { margin: 1rem 0; }
.preview-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem; flex-wrap: wrap; }
.preview-header h4 { margin: 0 0 .2rem; }
.preview-header p { margin: 0; font-size: .85rem; }

.theme-picker {
  display: flex; flex-wrap: wrap; gap: .5rem;
  margin-top: .8rem;
}
.theme-swatch {
  display: flex; flex-direction: column; align-items: center; gap: .25rem;
  padding: .35rem .5rem .45rem;
  border-radius: 12px;
  border: 1px solid var(--line);
  background: #fff;
  cursor: pointer;
  transition: transform .15s ease, border-color .15s ease;
  min-width: 64px;
}
.theme-swatch:hover { transform: translateY(-2px); }
.theme-swatch.active {
  border-color: var(--tomato-400, #f08a6a);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--tomato-400, #f08a6a) 35%, transparent);
}
.swatch-color {
  display: block; width: 36px; height: 36px;
  border-radius: 50%;
  box-shadow: inset 0 0 0 1px var(--line);
}
.swatch-label { font-size: .78rem; color: var(--bark-900); }
.clear-preview { align-self: center; }
.fade-enter-active, .fade-leave-active { transition: opacity .25s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }

.countdown {
  margin: 1rem 0;
  display: flex; align-items: center; justify-content: space-between; gap: 1rem;
  padding: 1rem 1.2rem;
  flex-wrap: wrap;
}
.cd-text p { margin: 0; }
.cd-text h3 { margin: .15rem 0 0; }
.cd-time {
  font-family: ui-monospace, "SF Mono", Menlo, monospace;
  font-size: 1.6rem; font-weight: 700;
  color: var(--tomato-500);
  letter-spacing: .04em;
  background: #fff;
  padding: .35rem .9rem;
  border-radius: 12px;
  border: 1px solid var(--line);
  box-shadow: var(--shadow-soft);
}

.meal-card { margin-bottom: 1.2rem; }
.meal-buttons {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: .6rem;
}
.meal-btn { width: 100%; height: 56px; font-size: 1rem; }
.meal-emoji { font-size: 1.3rem; margin-right: .4rem; }
.hint { margin-top: .6rem; }
</style>
