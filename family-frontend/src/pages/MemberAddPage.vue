<script setup lang="ts">
import { reactive, ref, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { membersApi } from '../api';

const route = useRoute();
const router = useRouter();
const spaceId = route.params.spaceId as string;

const form = reactive({ name: '', relation: '', description: '' });
const photoFile = ref<File | null>(null);
const photoPreview = ref<string>('');
const dialogues = ref<string[]>(['']);
const dragOver = ref(false);
const loading = ref(false);
const error = ref('');

const fileInputRef = ref<HTMLInputElement | null>(null);

function pickPhoto(): void {
  fileInputRef.value?.click();
}

function setPhoto(file: File | null): void {
  photoFile.value = file;
  if (photoPreview.value) URL.revokeObjectURL(photoPreview.value);
  photoPreview.value = file ? URL.createObjectURL(file) : '';
}

function onPhotoChange(e: Event): void {
  const t = e.target as HTMLInputElement;
  setPhoto(t.files?.[0] ?? null);
}

function onDrop(e: DragEvent): void {
  e.preventDefault();
  dragOver.value = false;
  const f = e.dataTransfer?.files?.[0];
  if (f && f.type.startsWith('image/')) setPhoto(f);
}

function onDragOver(e: DragEvent): void {
  e.preventDefault();
  dragOver.value = true;
}
function onDragLeave(): void {
  dragOver.value = false;
}

function clearPhoto(e: Event): void {
  e.stopPropagation();
  setPhoto(null);
  if (fileInputRef.value) fileInputRef.value.value = '';
}

function addDialogue(): void {
  dialogues.value.push('');
}
function removeDialogue(idx: number): void {
  if (dialogues.value.length === 1) {
    dialogues.value[0] = '';
    return;
  }
  dialogues.value.splice(idx, 1);
}

const dialogueCount = computed(
  () => dialogues.value.filter((d) => d.trim().length > 0).length,
);

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
    for (const d of dialogues.value) {
      const text = d.trim();
      if (!text) continue;
      try { await membersApi.addText(m.id, 'dialogue', text); } catch { /* ignore */ }
    }
    router.push({ name: 'member-detail', params: { spaceId, memberId: m.id } });
  } catch (e: unknown) {
    error.value =
      (e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? '创建失败';
  } finally {
    loading.value = false;
  }
}

function back(): void {
  router.push({ name: 'space-detail', params: { spaceId } });
}
</script>

<template>
  <div class="page" data-test="member-add">
    <div class="title-bar">
      <el-button class="btn-pill" @click="back">← 返回</el-button>
      <h2>添加家庭成员</h2>
    </div>

    <el-form class="form-grid card" @submit.prevent="submit">
      <div class="grid-2">
        <el-form-item label="姓名">
          <el-input v-model="form.name" placeholder="比如：老王" data-test="name" />
        </el-form-item>
        <el-form-item label="关系">
          <el-input v-model="form.relation" placeholder="爸爸 / 妈妈 / 儿子 …" data-test="relation" />
        </el-form-item>
      </div>

      <el-form-item label="描述（性格、爱好、口头禅、家庭角色）">
        <el-input
          v-model="form.description"
          type="textarea"
          :rows="4"
          placeholder="例如：爱讲冷笑话的爸爸，周末必下厨，口头禅是「等会儿吃完饭再说」"
          data-test="description"
        />
      </el-form-item>

      <el-form-item label="照片（可选，AI 抽取人物画像时用作参考）">
        <div
          class="photo-drop"
          :class="{ dragover: dragOver, has: photoPreview }"
          data-test="photo-drop"
          @click="pickPhoto"
          @drop="onDrop"
          @dragover="onDragOver"
          @dragleave="onDragLeave"
        >
          <template v-if="photoPreview">
            <img :src="photoPreview" alt="预览" class="preview" />
            <div class="overlay">
              <span>点击或拖拽替换</span>
              <button type="button" class="link-btn" @click="clearPhoto">移除</button>
            </div>
          </template>
          <template v-else>
            <div class="drop-icon" aria-hidden="true">📸</div>
            <p>点击选择图片，或拖拽到这里</p>
            <p class="muted">支持 jpg / png，单张</p>
          </template>
          <input
            ref="fileInputRef"
            type="file"
            accept="image/*"
            class="hidden"
            data-test="photo"
            @change="onPhotoChange"
          />
        </div>
      </el-form-item>

      <el-form-item>
        <template #label>
          <span>对话样本（可选）</span>
          <span class="muted dialogue-tip">
            ｜已填 {{ dialogueCount }} 段，越多越像
          </span>
        </template>
        <div class="dialogue-list" data-test="dialogue-list">
          <div
            v-for="(d, idx) in dialogues"
            :key="idx"
            class="dialogue-row"
          >
            <span class="dialogue-idx">#{{ idx + 1 }}</span>
            <el-input
              v-model="dialogues[idx]"
              type="textarea"
              :rows="2"
              placeholder="一段日常对话，让 AI 抓住语气，比如：「你今天怎么又这么晚回来？锅里给你留了菜。」"
              :data-test="`dialogue-${idx}`"
            />
            <el-button
              size="small"
              class="btn-pill remove-btn"
              :data-test="`dialogue-remove-${idx}`"
              @click="removeDialogue(idx)"
            >−</el-button>
          </div>
          <el-button
            class="btn-pill add-btn"
            data-test="dialogue-add"
            @click="addDialogue"
          >+ 加一段对话</el-button>
        </div>
      </el-form-item>

      <p v-if="error" class="err" data-test="error">{{ error }}</p>
      <el-button
        type="primary"
        class="btn-pill submit-btn"
        :loading="loading"
        data-test="submit"
        @click="submit"
      >创建并查看</el-button>
    </el-form>
  </div>
</template>

<style scoped>
.title-bar { display: flex; align-items: center; gap: .8rem; margin-bottom: 1rem; }
.title-bar h2 { margin: 0; }
.card { padding: 1.2rem; }
.grid-2 { display: grid; gap: .8rem; grid-template-columns: 1fr; }
@media (min-width: 600px) { .grid-2 { grid-template-columns: 1fr 1fr; } }

.photo-drop {
  position: relative;
  border: 2px dashed var(--wood-300);
  border-radius: var(--radius-card);
  background: var(--cream-100);
  padding: 1.4rem;
  text-align: center;
  cursor: pointer;
  transition: background .15s ease, border-color .15s ease;
  min-height: 140px;
  overflow: hidden;
}
.photo-drop:hover { background: var(--cream-200); }
.photo-drop.dragover { background: var(--cream-200); border-color: var(--tomato-400); }
.photo-drop p { margin: .3rem 0; }
.drop-icon { font-size: 2.4rem; line-height: 1; }
.preview {
  width: 100%; max-width: 220px; height: 220px;
  object-fit: cover; border-radius: 12px;
  box-shadow: var(--shadow-soft);
}
.overlay {
  position: absolute; inset: auto 0 0 0;
  display: flex; justify-content: center; gap: .8rem;
  padding: .35rem .5rem;
  background: rgba(255,255,255,.85);
  font-size: .85rem;
}
.link-btn {
  background: none; border: 0; color: var(--danger); cursor: pointer; padding: 0;
}
.hidden { display: none; }

.dialogue-tip { font-size: .8rem; margin-left: .4rem; }
.dialogue-list { display: flex; flex-direction: column; gap: .55rem; }
.dialogue-row {
  display: grid;
  grid-template-columns: 36px 1fr 36px;
  gap: .5rem;
  align-items: start;
}
.dialogue-idx {
  display: inline-flex; align-items: center; justify-content: center;
  height: 32px;
  font-size: .8rem; color: var(--wood-700);
  background: var(--cream-100);
  border-radius: var(--radius-pill);
}
.remove-btn { width: 36px; height: 32px; padding: 0 !important; }
.add-btn { align-self: flex-start; margin-top: .25rem; }

.submit-btn { min-width: 140px; }
.err { font-size: .9rem; }
</style>
