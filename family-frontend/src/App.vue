<script setup lang="ts">
import { computed } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useAuthStore } from './stores/auth';

const authStore = useAuthStore();
const router = useRouter();
const route = useRoute();

const showNav = computed(() => route.name !== 'login' && route.name !== 'register');
const inSpace = computed(() => Boolean(route.params.spaceId));
const spaceId = computed(() => route.params.spaceId as string | undefined);

function logout(): void {
  authStore.logout();
  router.push({ name: 'login' });
}
</script>

<template>
  <div class="app-shell">
    <header v-if="showNav" class="topbar">
      <router-link :to="{ name: 'spaces' }" class="brand">
        <span class="brand-emoji" aria-hidden="true">🏠</span>
        <span class="brand-text">线上卡通家庭</span>
      </router-link>
      <nav class="nav-links">
        <router-link :to="{ name: 'spaces' }">家</router-link>
        <router-link
          v-if="inSpace && spaceId"
          :to="{ name: 'scene-home', params: { spaceId } }"
        >场景</router-link>
        <router-link
          v-if="inSpace && spaceId"
          :to="{ name: 'history', params: { spaceId } }"
        >历史</router-link>
        <router-link :to="{ name: 'privacy' }">隐私</router-link>
      </nav>
      <div class="user-actions" v-if="authStore.user">
        <span class="hello">嗨，{{ authStore.user.displayName }}</span>
        <el-button size="small" class="btn-pill" @click="logout">退出</el-button>
      </div>
    </header>
    <main class="main">
      <router-view />
    </main>
  </div>
</template>

<style scoped>
.app-shell { min-height: 100vh; display: flex; flex-direction: column; background: var(--cream-50); }
.topbar {
  display: flex; align-items: center; justify-content: space-between;
  gap: .6rem;
  padding: .6rem 1rem;
  background: linear-gradient(180deg, #fff7ec, #ffead0);
  border-bottom: 1px solid var(--line);
  position: sticky; top: 0; z-index: 10;
  flex-wrap: wrap;
}
.brand {
  display: inline-flex; align-items: center; gap: .4rem;
  font-weight: 700; color: var(--wood-700); font-size: 1.05rem;
  text-decoration: none;
}
.brand-emoji { font-size: 1.3rem; }
.nav-links { display: flex; gap: .8rem; flex: 1; justify-content: center; flex-wrap: wrap; }
.nav-links a {
  color: var(--wood-700); text-decoration: none;
  padding: .25rem .7rem;
  border-radius: var(--radius-pill);
  font-size: .92rem;
}
.nav-links a.router-link-active { background: var(--cream-200); font-weight: 600; }
.user-actions { display: flex; gap: .5rem; align-items: center; }
.hello { color: var(--wood-700); font-size: .9rem; }
.main { flex: 1; }

@media (max-width: 540px) {
  .brand-text { display: none; }
  .hello { display: none; }
  .nav-links { order: 3; width: 100%; justify-content: space-around; }
  .topbar { padding: .5rem .8rem; }
}
</style>
