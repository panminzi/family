<script setup lang="ts">
import { reactive, ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { membersApi } from '../api';
import type { MemberDTO } from '../api/client';

const route = useRoute();
const router = useRouter();
const spaceId = route.params.spaceId as string;
const memberId = route.params.memberId as string;

const member = ref<MemberDTO | null>(null);
const generating = ref<'personality' | 'avatar' | null>(null);
const error = ref('');
const editing = ref(false);
const saving = ref(false);
const editForm = reactive({ name: '', relation: '', description: '' });

async function load(): Promise<void> {
  try {
    member.value = await membersApi.get(memberId);
  } catch {
    error.value = '加载失败';
  }
}

function startEdit(): void {
  if (!member.value) return;
  editForm.name = member.value.name;
  editForm.relation = member.value.relation;
  editForm.description = member.value.description;
  editing.value = true;
}

function cancelEdit(): void {
  editing.value = false;
}

async function saveEdit(): Promise<void> {
  if (!member.value) return;
  if (!editForm.name || !editForm.relation || !editForm.description) {
    error.value = '请填写完整成员信息';
    return;
  }
  saving.value = true;
  error.value = '';
  try {
    member.value = await membersApi.update(member.value.id, {
      name: editForm.name,
      relation: editForm.relation,
      description: editForm.description,
    });
    editing.value = false;
  } catch (e: unknown) {
    error.value =
      (e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? '保存失败';
  } finally {
    saving.value = false;
  }
}

async function genPersonality(): Promise<void> {
  if (!member.value) return;
  generating.value = 'personality';
  error.value = '';
  try {
    member.value = await membersApi.generatePersonality(member.value.id);
  } catch (e: unknown) {
    error.value =
      (e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? '生成失败';
  } finally {
    generating.value = null;
  }
}

async function genAvatar(): Promise<void> {
  if (!member.value) return;
  generating.value = 'avatar';
  error.value = '';
  try {
    member.value = await membersApi.generateAvatar(member.value.id);
  } catch (e: unknown) {
    error.value =
      (e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? '生成失败';
  } finally {
    generating.value = null;
  }
}

async function remove(): Promise<void> {
  if (!member.value) return;
  if (!confirm('确认删除此成员？所有相关资料和对话会一并清除。')) return;
  await membersApi.remove(member.value.id);
  router.push({ name: 'space-detail', params: { spaceId } });
}

function back(): void {
  router.push({ name: 'space-detail', params: { spaceId } });
}

onMounted(load);
</script>

<template>
  <div class="page" data-test="member-detail">
    <div class="title-bar">
      <el-button class="btn-pill" @click="back">← 返回</el-button>
      <h2>家人资料</h2>
    </div>

    <p v-if="error" class="err">{{ error }}</p>

    <div v-if="member" class="layout">
      <section class="card profile-card warm">
        <div class="avatar-wrap">
          <img v-if="member.avatarUrl" :src="member.avatarUrl" class="big-avatar" :alt="member.name" />
          <div v-else class="big-avatar placeholder">{{ member.name.slice(0, 1) }}</div>
        </div>

        <div v-if="!editing" class="meta">
          <div class="name-line">
            <h2>{{ member.name }}</h2>
            <span class="tag">{{ member.relation }}</span>
          </div>
          <p class="desc">{{ member.description }}</p>
          <el-button class="btn-pill" data-test="edit" @click="startEdit">编辑资料</el-button>
        </div>

        <div v-else class="edit-form form-grid" data-test="edit-form">
          <el-form-item label="姓名">
            <el-input v-model="editForm.name" data-test="edit-name" />
          </el-form-item>
          <el-form-item label="关系">
            <el-input v-model="editForm.relation" data-test="edit-relation" />
          </el-form-item>
          <el-form-item label="描述">
            <el-input
              v-model="editForm.description"
              type="textarea"
              :rows="4"
              data-test="edit-description"
            />
          </el-form-item>
          <div class="row">
            <el-button
              type="primary"
              class="btn-pill"
              :loading="saving"
              data-test="save"
              @click="saveEdit"
            >保存</el-button>
            <el-button class="btn-pill" data-test="cancel" @click="cancelEdit">取消</el-button>
          </div>
        </div>
      </section>

      <section class="card profile-section">
        <div class="section-title" style="margin-top:0">
          <h3>性格画像</h3>
          <el-button
            type="primary"
            class="btn-pill"
            :loading="generating === 'personality'"
            data-test="gen-personality"
            @click="genPersonality"
          >{{ member.personality ? '重新生成' : '生成画像' }}</el-button>
        </div>
        <div v-if="member.personality" class="profile" data-test="profile">
          <div class="trait-row">
            <span v-for="t in member.personality.traits" :key="t" class="tag leaf">{{ t }}</span>
          </div>
          <dl class="kv">
            <div><dt>说话风格</dt><dd>{{ member.personality.speechStyle }}</dd></div>
            <div><dt>情绪倾向</dt><dd>{{ member.personality.emotionTendency }}</dd></div>
            <div><dt>口头禅</dt><dd class="catchphrase">「{{ member.personality.catchphrase }}」</dd></div>
            <div><dt>关系基调</dt><dd>{{ member.personality.relationshipNotes }}</dd></div>
          </dl>
        </div>
        <p v-else class="empty-tip">尚未生成画像。点击右上的按钮，让 AI 根据资料抽取性格。</p>
      </section>

      <section class="card profile-section">
        <div class="section-title" style="margin-top:0">
          <h3>卡通形象</h3>
          <el-button
            class="btn-pill"
            :disabled="!member.personality"
            :loading="generating === 'avatar'"
            data-test="gen-avatar"
            @click="genAvatar"
          >{{ member.avatarUrl ? '重新生成' : '生成卡通形象' }}</el-button>
        </div>
        <p v-if="!member.personality" class="muted">先生成性格画像，AI 才能据此画卡通形象。</p>
        <p v-else-if="!member.avatarUrl" class="muted">尚未生成卡通形象。</p>
        <p v-else class="muted">已生成。在场景页能看到 ta 围坐桌边。</p>
      </section>

      <section class="card danger-card">
        <h3>危险操作</h3>
        <p class="muted">
          删除成员会同时清除上传的资料、画像、和这位家人参与的对话。
        </p>
        <el-button class="btn-pill" data-test="delete" @click="remove">删除此成员</el-button>
      </section>
    </div>
  </div>
</template>

<style scoped>
.title-bar { display: flex; align-items: center; gap: .8rem; margin-bottom: 1rem; }
.title-bar h2 { margin: 0; }
.layout { display: grid; gap: 1rem; }

.profile-card {
  display: grid;
  grid-template-columns: 132px 1fr;
  gap: 1rem;
  align-items: center;
}
@media (max-width: 540px) {
  .profile-card { grid-template-columns: 1fr; justify-items: center; text-align: center; }
}
.avatar-wrap {
  width: 132px; height: 132px;
  border-radius: 50%;
  padding: 4px;
  background: linear-gradient(135deg, #fff3df, #ffe2b8);
  box-shadow: inset 0 0 0 1px var(--line);
}
.big-avatar {
  width: 100%; height: 100%;
  border-radius: 50%; object-fit: cover;
  background: var(--cream-200);
}
.big-avatar.placeholder {
  display: flex; align-items: center; justify-content: center;
  font-size: 48px; font-weight: 700; color: var(--wood-700);
  background: var(--cream-100);
}
.meta { display: flex; flex-direction: column; gap: .4rem; }
.name-line { display: flex; align-items: center; gap: .5rem; flex-wrap: wrap; }
.name-line h2 { margin: 0; }
.desc { white-space: pre-wrap; line-height: 1.5; margin: 0; }

.profile-section h3 { margin: 0; }
.trait-row { display: flex; flex-wrap: wrap; gap: .35rem; margin-bottom: .8rem; }
.kv { margin: 0; display: grid; gap: .5rem; }
.kv > div { display: grid; grid-template-columns: 90px 1fr; gap: .8rem; }
.kv dt { color: var(--muted); font-size: .85rem; }
.kv dd { margin: 0; }
.catchphrase { color: var(--tomato-500); font-style: italic; }

.danger-card h3 { margin: 0 0 .35rem; color: var(--danger); }

.edit-form { width: 100%; }
</style>
