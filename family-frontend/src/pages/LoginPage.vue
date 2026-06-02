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
  <div class="page" data-test="login-page">
    <h2>登录</h2>
    <el-form @submit.prevent="submit">
      <el-form-item label="邮箱">
        <el-input v-model="form.email" data-test="email" />
      </el-form-item>
      <el-form-item label="密码">
        <el-input v-model="form.password" type="password" data-test="password" />
      </el-form-item>
      <p v-if="error" class="err" data-test="error">{{ error }}</p>
      <el-button type="primary" :loading="loading" data-test="submit" @click="submit">
        登录
      </el-button>
      <router-link :to="{ name: 'register' }" style="margin-left: 1rem;">注册新账号</router-link>
    </el-form>
  </div>
</template>

<style scoped>
.err { color: #d9534f; }
</style>
