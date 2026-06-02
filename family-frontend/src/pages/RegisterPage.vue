<script setup lang="ts">
import { reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';

const auth = useAuthStore();
const router = useRouter();
const form = reactive({ email: '', password: '', displayName: '' });
const loading = ref(false);
const error = ref('');

async function submit(): Promise<void> {
  if (!form.email || !form.password || !form.displayName) {
    error.value = '请填写邮箱、密码和昵称';
    return;
  }
  error.value = '';
  loading.value = true;
  try {
    await auth.register(form.email, form.password, form.displayName);
    router.push({ name: 'spaces' });
  } catch (e: unknown) {
    const msg =
      (e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? '注册失败';
    error.value = msg;
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="auth-page" data-test="register-page">
    <div class="auth-card card warm">
      <div class="hero">
        <div class="hero-emoji" aria-hidden="true">🌽</div>
        <h1>注册新家</h1>
        <p class="muted">创建账号，把家人请进卡通家庭。</p>
      </div>
      <el-form class="form-grid" @submit.prevent="submit">
        <el-form-item label="邮箱">
          <el-input v-model="form.email" placeholder="you@example.com" data-test="email" />
        </el-form-item>
        <el-form-item label="密码">
          <el-input v-model="form.password" type="password" placeholder="至少 6 位" data-test="password" />
        </el-form-item>
        <el-form-item label="昵称">
          <el-input v-model="form.displayName" placeholder="家里大家叫你什么" data-test="display-name" />
        </el-form-item>
        <p v-if="error" class="err" data-test="error">{{ error }}</p>
        <el-button
          type="primary"
          class="btn-pill submit-btn"
          :loading="loading"
          data-test="submit"
          @click="submit"
        >创建账号</el-button>
        <p class="hint">
          已经有账号？
          <router-link :to="{ name: 'login' }">去登录</router-link>
        </p>
      </el-form>
    </div>
  </div>
</template>

<style scoped>
.auth-page {
  min-height: 100vh;
  display: flex; align-items: center; justify-content: center;
  padding: 1.2rem;
  background:
    radial-gradient(900px 500px at 80% -10%, #ffe2b8 0%, transparent 60%),
    radial-gradient(700px 400px at -10% 110%, #fde0d6 0%, transparent 55%),
    var(--cream-50);
}
.auth-card { width: 100%; max-width: 420px; padding: 1.6rem 1.4rem; }
.hero { text-align: center; margin-bottom: 1rem; }
.hero-emoji {
  font-size: 2.6rem;
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
