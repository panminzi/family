<script setup lang="ts">
import { computed } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useAuthStore } from './stores/auth';

const authStore = useAuthStore();
const router = useRouter();
const route = useRoute();

const showNav = computed(() => route.name !== 'login' && route.name !== 'register');

function logout(): void {
  authStore.logout();
  router.push({ name: 'login' });
}
</script>

<template>
  <div class="app-shell">
    <header v-if="showNav" class="topbar">
      <div class="brand">🏠 线上卡通家庭</div>
      <nav class="nav-links">
        <router-link :to="{ name: 'spaces' }">家庭空间</router-link>
      </nav>
      <div class="user-actions" v-if="authStore.user">
        <span class="hello">你好，{{ authStore.user.displayName }}</span>
        <el-button size="small" @click="logout">退出</el-button>
      </div>
    </header>
    <main class="main">
      <router-view />
    </main>
  </div>
</template>

<style scoped>
.app-shell { min-height: 100vh; display: flex; flex-direction: column; }
.topbar {
  display: flex; align-items: center; justify-content: space-between;
  padding: 0.6rem 1.2rem; background: #fff7ec; border-bottom: 1px solid #f1d9b3;
}
.brand { font-weight: 600; color: #c47c2c; font-size: 1.1rem; }
.nav-links a { color: #7a4f1d; text-decoration: none; margin-right: 1rem; }
.nav-links a.router-link-active { font-weight: 600; }
.user-actions { display: flex; gap: 0.6rem; align-items: center; }
.hello { color: #7a4f1d; }
.main { flex: 1; padding: 1.2rem; background: #fffbf3; }
</style>
