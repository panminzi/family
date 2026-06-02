<script setup lang="ts">
import { reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';

const auth = useAuthStore();
const router = useRouter();
const form = reactive({ email: '', password: '' });
const loading = ref(false);
const error = ref('');

async function submit(): Promise<void> {
  if (!form.email || !form.password) {
    error.value = '请输入邮箱和密码';
    return;
  }
  error.value = '';
  loading.value = true;
  try {
    await auth.login(form.email, form.password);
    await auth.fetchMe();
    router.push({ name: 'spaces' });
  } catch (e: unknown) {
    const msg =
      (e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? '登录失败';
    error.value = msg;
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="auth-page" data-test="login-page">
    <div class="auth-card card warm">
      <div class="hero">
        <div class="hero-emoji" aria-hidden="true">🍲</div>
        <h1>欢迎回家</h1>
        <p class="muted">登录后回到你的卡通家庭，准备开饭。</p>
      </div>
      <el-form class="form-grid" @submit.prevent="submit">
        <el-form-item label="邮箱">
          <el-input v-model="form.email" placeholder="you@example.com" data-test="email" />
        </el-form-item>
        <el-form-item label="密码">
          <el-input v-model="form.password" type="password" placeholder="••••••" data-test="password" />
        </el-form-item>
        <p v-if="error" class="err" data-test="error">{{ error }}</p>
        <el-button
          type="primary"
          class="btn-pill submit-btn"
          :loading="loading"
          data-test="submit"
          @click="submit"
        >登录</el-button>
        <p class="hint">
          还没有账号？
          <router-link :to="{ name: 'register' }">去注册</router-link>
        </p>
      </el-form>
    </div>
  </div>
</template>

<style scoped>
.auth-page {
  min-height: calc(100vh - 0px);
  display: flex; align-items: center; justify-content: center;
  padding: 1.2rem;
  background:
    radial-gradient(900px 500px at 20% -10%, #ffe2b8 0%, transparent 60%),
    radial-gradient(700px 400px at 110% 110%, #fde0d6 0%, transparent 55%),
    var(--cream-50);
}
.auth-card { width: 100%; max-width: 420px; padding: 1.6rem 1.4rem; }
.hero { text-align: center; margin-bottom: 1rem; }
.hero-emoji {
  font-size: 2.6rem; line-height: 1;
  display: inline-block;
  background: var(--cream-100);
  border-radius: 999px;
  width: 4rem; height: 4rem;
  display: inline-flex; align-items: center; justify-content: center;
  box-shadow: var(--shadow-soft);
  margin-bottom: .6rem;
}
.hero h1 { margin: 0 0 .2rem; }
.submit-btn { width: 100%; margin-top: .4rem; }
.hint { text-align: center; color: var(--muted); margin: .8rem 0 0; }
</style>
