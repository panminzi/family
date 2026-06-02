<script setup lang="ts">
import { reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { membersApi } from '../api';

const route = useRoute();
const router = useRouter();
const spaceId = route.params.spaceId as string;

const form = reactive({ name: '', relation: '', description: '' });
const photoFile = ref<File | null>(null);
const dialogueText = ref('');
const loading = ref(false);
const error = ref('');

function onPhotoChange(e: Event): void {
  const t = e.target as HTMLInputElement;
  photoFile.value = t.files?.[0] ?? null;
}

async function submit(): Promise<void> {
  if (!form.name || !form.relation || !form.description) {
    error.value = '请填写完整成员信息';
    return;
  }
  loading.value = true;
  error.value = '';
  try {
    const m = await membersApi.create({
      spaceId,
      name: form.name,
      relation: form.relation,
      description: form.description,
    });
    if (photoFile.value) {
      try { await membersApi.uploadPhoto(m.id, photoFile.value); } catch { /* ignore */ }
    }
    if (dialogueText.value.trim()) {
      try { await membersApi.addText(m.id, 'dialogue', dialogueText.value.trim()); } catch { /* ignore */ }
    }
    router.push({ name: 'member-detail', params: { spaceId, memberId: m.id } });
  } catch (e: unknown) {
    error.value =
      (e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? '创建失败';
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="page" data-test="member-add">
    <h2>添加家庭成员</h2>
    <el-form @submit.prevent="submit">
      <el-form-item label="姓名">
        <el-input v-model="form.name" data-test="name" />
      </el-form-item>
      <el-form-item label="关系">
        <el-input v-model="form.relation" placeholder="爸爸 / 妈妈 / 儿子 …" data-test="relation" />
      </el-form-item>
      <el-form-item label="描述">
        <el-input
          v-model="form.description"
          type="textarea"
          :rows="4"
          placeholder="性格、爱好、口头禅等"
          data-test="description"
        />
      </el-form-item>
      <el-form-item label="照片（可选）">
        <input type="file" accept="image/*" data-test="photo" @change="onPhotoChange" />
      </el-form-item>
      <el-form-item label="对话样本（可选）">
        <el-input
          v-model="dialogueText"
          type="textarea"
          :rows="3"
          placeholder="一段日常对话，帮助 AI 抓住语气"
          data-test="dialogue"
        />
      </el-form-item>
      <p v-if="error" class="err" data-test="error">{{ error }}</p>
      <el-button type="primary" :loading="loading" data-test="submit" @click="submit">
        创建并查看
      </el-button>
    </el-form>
  </div>
</template>

<style scoped>
.err { color: #d9534f; }
</style>
