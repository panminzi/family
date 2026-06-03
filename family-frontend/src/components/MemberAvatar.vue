<script setup lang="ts">
import { computed, ref, watch } from 'vue';

const props = withDefaults(
  defineProps<{
    src: string | null | undefined;
    name: string;
    size?: number;
    /** Show emoji "loading shimmer" while img loads. */
    loadingShimmer?: boolean;
    /** Round mask + soft inner border. */
    rounded?: boolean;
    /** Show a small badge in the bottom-right corner. */
    badge?: string | null;
  }>(),
  {
    size: 64,
    loadingShimmer: true,
    rounded: true,
    badge: null,
  },
);

const fallbackInitial = computed(() => props.name.trim().slice(0, 1) || '·');
const status = ref<'idle' | 'loading' | 'loaded' | 'error'>(props.src ? 'loading' : 'idle');

watch(
  () => props.src,
  (newSrc) => {
    status.value = newSrc ? 'loading' : 'idle';
  },
);

function onLoad(): void {
  status.value = 'loaded';
}
function onError(): void {
  status.value = 'error';
}

const showImg = computed(() => Boolean(props.src) && status.value !== 'error');
const showFallback = computed(
  () => !props.src || status.value === 'error' || status.value === 'loading',
);
const showSpinner = computed(() => props.loadingShimmer && status.value === 'loading');
</script>

<template>
  <div
    class="member-avatar"
    :class="{ rounded, 'has-image': showImg && status === 'loaded' }"
    :style="{ width: `${size}px`, height: `${size}px` }"
    data-test="member-avatar"
  >
    <div v-if="showFallback" class="fallback" data-test="member-avatar-fallback">
      <span class="initial">{{ fallbackInitial }}</span>
    </div>
    <img
      v-if="showImg"
      class="image"
      :class="{ ready: status === 'loaded' }"
      :src="src!"
      :alt="name"
      loading="lazy"
      data-test="member-avatar-img"
      @load="onLoad"
      @error="onError"
    />
    <div v-if="showSpinner" class="shimmer" aria-hidden="true" data-test="member-avatar-shimmer">
      <span class="dot d1" />
      <span class="dot d2" />
      <span class="dot d3" />
    </div>
    <div v-if="badge" class="badge" data-test="member-avatar-badge">{{ badge }}</div>
  </div>
</template>

<style scoped>
.member-avatar {
  position: relative;
  background: var(--cream-100);
  overflow: hidden;
  flex-shrink: 0;
  box-shadow: inset 0 0 0 1px var(--line);
}
.member-avatar.rounded { border-radius: 50%; }

.image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  opacity: 0;
  transition: opacity .35s ease;
}
.image.ready { opacity: 1; }

.fallback {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #fff3df, #ffe2b8);
  font-weight: 700;
  color: var(--wood-700);
  font-size: 42%;
}
.initial {
  font-size: clamp(1rem, 38%, 2.2rem);
  line-height: 1;
}

.shimmer {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  gap: 4px;
  padding-bottom: 12%;
  pointer-events: none;
}
.shimmer .dot {
  width: 6px; height: 6px;
  border-radius: 50%;
  background: var(--wood-700);
  opacity: .35;
  animation: bounce 1.1s ease-in-out infinite;
}
.shimmer .dot.d2 { animation-delay: .15s; }
.shimmer .dot.d3 { animation-delay: .3s; }
@keyframes bounce {
  0%, 100% { transform: translateY(0); opacity: .35; }
  50%      { transform: translateY(-4px); opacity: .85; }
}

.badge {
  position: absolute;
  right: -2px; bottom: -2px;
  font-size: .8em;
  background: #fff;
  border: 2px solid var(--cream-50, #fff8ec);
  border-radius: 999px;
  padding: 1px 6px;
  box-shadow: 0 2px 6px rgba(0,0,0,.12);
}
</style>
