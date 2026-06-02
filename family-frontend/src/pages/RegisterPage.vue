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
  <div class="page" data-test="register-page">
    <h2>注册</h2>
    <el-form @submit.prevent="submit">
      <el-form-item label="邮箱">
        <el-input v-model="form.email" data-test="email" />
      </el-form-item>
      <el-form-item label="密码">
        <el-input v-model="form.password" type="password" data-test="password" />
      </el-form-item>
      <el-form-item label="昵称">
        <el-input v-model="form.displayName" data-test="display-name" />
      </el-form-item>
      <p v-if="error" class="err" data-test="error">{{ error }}</p>
      <el-button type="primary" :loading="loading" data-test="submit" @click="submit">
        注册
      </el-button>
      <router-link :to="{ name: 'login' }" style="margin-left: 1rem;">已有账号？登录</router-link>
    </el-form>
  </div>
</template>

<style scoped>
.err { color: #d9534f; }
</style>
