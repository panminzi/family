<script setup lang="ts">
import { computed, reactive, ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { assetsApi, membersApi, memoryApi } from '../api';
import type { GeneratedAssetDTO, MemberDTO, MemoryEventDTO } from '../api/client';
import MemberAvatar from '../components/MemberAvatar.vue';

const route = useRoute();
const router = useRouter();
const spaceId = route.params.spaceId as string;
const memberId = route.params.memberId as string;

const member = ref<MemberDTO | null>(null);
const generating = ref<'personality' | 'avatar' | string | null>(null);
const error = ref('');
const editing = ref(false);
const saving = ref(false);
const editForm = reactive({ name: '', relation: '', description: '' });

const assets = ref<GeneratedAssetDTO[]>([]);
const memories = ref<MemoryEventDTO[]>([]);
const memoryLoading = ref(false);
const showMemories = ref(false);

const ASSET_GALLERY: Array<{ key: string; label: string; size: string }> = [
  { key: 'avatar', label: '头像', size: '512x512' },
  { key: 'sitting', label: '坐姿（围桌）', size: '768x768' },
  { key: 'full_body', label: '全身像', size: '768x1152' },
  { key: 'emoji_happy', label: '表情·开心', size: '256x256' },
  { key: 'emoji_caring', label: '表情·关心', size: '256x256' },
];

const assetByType = computed(() => {
  const m = new Map<string, GeneratedAssetDTO>();
  for (const a of assets.value) m.set(a.assetType, a);
  return m;
});

const memberMemories = computed(() =>
  memories.value
    .filter((e) => e.subjectMemberId === memberId)
    .slice()
    .sort((a, b) => new Date(b.periodEnd).getTime() - new Date(a.periodEnd).getTime()),
);

async function load(): Promise<void> {
  try {
    member.value = await membersApi.get(memberId);
  } catch {
    error.value = '加载失败';
    return;
  }
  try {
    assets.value = await assetsApi.list(memberId);
  } catch {
    /* tolerate; legacy avatar still shows from member.avatarUrl */
  }
}

async function loadMemories(): Promise<void> {
  if (memoryLoading.value || memories.value.length) return;
  memoryLoading.value = true;
  try {
    memories.value = await memoryApi.list(spaceId);
  } catch {
    /* memory list is best-effort; if server hasn't summarized yet, leave empty */
  } finally {
    memoryLoading.value = false;
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

async function regenerateAsset(assetKey: string, size: string): Promise<void> {
  if (!member.value) return;
  generating.value = assetKey;
  error.value = '';
  try {
    const emotion = assetKey.startsWith('emoji_') ? assetKey.slice('emoji_'.length) : undefined;
    const created = await assetsApi.generate(member.value.id, {
      assetType: assetKey,
      emotion,
      size,
    });
    const idx = assets.value.findIndex((a) => a.assetType === assetKey);
    if (idx >= 0) assets.value.splice(idx, 1, created);
    else assets.value.push(created);
    if (assetKey === 'avatar') {
      member.value = await membersApi.get(member.value.id);
    }
  } catch (e: unknown) {
    error.value =
      (e as { response?: { data?: { error?: string } } })?.response?.data?.error ??
      '生成失败，先确保已生成性格画像';
  } finally {
    generating.value = null;
  }
}

async function regenerateAvatarLegacy(): Promise<void> {
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

function toggleMemories(): void {
  showMemories.value = !showMemories.value;
  if (showMemories.value) void loadMemories();
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
        <div class="avatar-frame">
          <MemberAvatar :src="member.avatarUrl" :name="member.name" :size="124" />
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

      <section class="card profile-section" data-test="asset-gallery">
        <div class="section-title" style="margin-top:0">
          <h3>卡通形象图集</h3>
          <el-button
            class="btn-pill"
            :disabled="!member.personality"
            :loading="generating === 'avatar'"
            data-test="regen-legacy-avatar"
            @click="regenerateAvatarLegacy"
          >重新生成头像（V0.1）</el-button>
        </div>
        <p v-if="!member.personality" class="muted">先生成性格画像，AI 才能据此画卡通形象。</p>

        <div v-else class="asset-grid">
          <div
            v-for="slot in ASSET_GALLERY"
            :key="slot.key"
            class="asset-cell"
            :data-test="`asset-${slot.key}`"
          >
            <div class="asset-thumb">
              <MemberAvatar
                :src="assetByType.get(slot.key)?.imageUrl ?? null"
                :name="member.name"
                :size="120"
                :rounded="false"
                :badge="assetByType.get(slot.key)?.isPlaceholder ? '占位' : null"
              />
              <div v-if="generating === slot.key" class="asset-overlay" data-test="asset-progress">
                <div class="spinner"></div>
                <span>生成中…</span>
              </div>
            </div>
            <div class="asset-meta">
              <span class="asset-label">{{ slot.label }}</span>
              <span class="asset-size muted">{{ slot.size }}</span>
            </div>
            <el-button
              size="small"
              class="btn-pill"
              :loading="generating === slot.key"
              :disabled="!!generating && generating !== slot.key"
              :data-test="`regen-${slot.key}`"
              @click="regenerateAsset(slot.key, slot.size)"
            >{{ assetByType.get(slot.key) ? '重新生成' : '生成' }}</el-button>
          </div>
        </div>
      </section>

      <section class="card profile-section" data-test="memory-section">
        <div class="section-title" style="margin-top:0">
          <h3>AI 记得的事</h3>
          <el-button class="btn-pill" data-test="toggle-memory" @click="toggleMemories">
            {{ showMemories ? '收起' : '展开' }}
          </el-button>
        </div>
        <p class="muted">
          系统会按周/月把 ta 在饭桌上提到的事压缩成长期记忆，下一次对话时引用。
          这里只展示，不可直接编辑。
        </p>
        <transition name="fade">
          <div v-if="showMemories" class="memory-list" data-test="memory-list">
            <p v-if="memoryLoading" class="muted">加载中…</p>
            <p v-else-if="!memberMemories.length" class="muted">还没有可见的长期记忆。</p>
            <article
              v-for="ev in memberMemories"
              :key="ev.id"
              class="memory-item"
              :data-test="`memory-${ev.id}`"
            >
              <header>
                <span class="memory-scope tag leaf">{{ ev.scope === 'monthly' ? '月度' : '周度' }}</span>
                <span class="memory-period muted">
                  {{ new Date(ev.periodStart).toLocaleDateString() }}
                  -
                  {{ new Date(ev.periodEnd).toLocaleDateString() }}
                </span>
              </header>
              <p class="memory-summary">{{ ev.summary }}</p>
            </article>
          </div>
        </transition>
      </section>

      <section class="card danger-card">
        <h3>危险操作</h3>
        <p class="muted">
          删除成员会同时清除上传的资料、画像、生成图集、长期记忆和这位家人参与的对话。
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
.avatar-frame {
  padding: 4px;
  border-radius: 50%;
  background: linear-gradient(135deg, #fff3df, #ffe2b8);
  box-shadow: inset 0 0 0 1px var(--line);
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

.asset-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: .8rem;
  margin-top: .6rem;
}
.asset-cell {
  display: flex; flex-direction: column; align-items: center;
  gap: .4rem;
  padding: .8rem;
  background: var(--cream-50, #fff8ec);
  border: 1px solid var(--line);
  border-radius: 12px;
}
.asset-thumb {
  position: relative;
  width: 120px; height: 120px;
  border-radius: 12px;
  overflow: hidden;
}
.asset-overlay {
  position: absolute; inset: 0;
  background: rgba(255,255,255,.85);
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: .35rem;
  font-size: .85rem;
  color: var(--wood-700);
}
.spinner {
  width: 28px; height: 28px;
  border-radius: 50%;
  border: 3px solid var(--cream-200);
  border-top-color: var(--tomato-400, #f08a6a);
  animation: spin .9s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }
.asset-meta { display: flex; flex-direction: column; align-items: center; gap: .1rem; }
.asset-label { font-weight: 600; font-size: .9rem; }
.asset-size { font-size: .72rem; }

.memory-list { display: grid; gap: .6rem; margin-top: .6rem; }
.memory-item {
  background: #fff;
  border: 1px solid var(--line);
  border-radius: 12px;
  padding: .7rem .9rem;
}
.memory-item header { display: flex; align-items: center; gap: .5rem; margin-bottom: .35rem; }
.memory-period { font-size: .8rem; }
.memory-summary { margin: 0; line-height: 1.5; }

.fade-enter-active, .fade-leave-active { transition: opacity .25s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }

.danger-card h3 { margin: 0 0 .35rem; color: var(--danger); }

.edit-form { width: 100%; }
</style>
