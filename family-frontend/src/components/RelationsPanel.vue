<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { relationsApi } from '../api';
import type {
  MemberDTO,
  RelationDTO,
  RelationStatus,
} from '../api/client';

const props = defineProps<{
  spaceId: string;
  members: MemberDTO[];
}>();

interface RelationOption {
  value: string;
  label: string;
  defaultAddress: string;
}

// Mirrors server/src/services/relations.ts
const RELATION_OPTIONS: RelationOption[] = [
  { value: 'spouse_of', label: '配偶', defaultAddress: '老婆' },
  { value: 'parent_of', label: '父/母 → 子女', defaultAddress: '宝贝' },
  { value: 'child_of', label: '子女 → 父/母', defaultAddress: '妈妈' },
  { value: 'sibling_of', label: '兄弟姐妹', defaultAddress: '哥' },
  { value: 'grandparent_of', label: '祖辈 → 孙辈', defaultAddress: '宝贝孙' },
  { value: 'grandchild_of', label: '孙辈 → 祖辈', defaultAddress: '奶奶' },
  { value: 'extended_family_of', label: '亲戚', defaultAddress: '叔叔' },
];

const STATUS_OPTIONS: Array<{ value: RelationStatus; label: string }> = [
  { value: 'active', label: '日常往来' },
  { value: 'estranged', label: '疏远' },
  { value: 'deceased', label: '已故' },
];

const relations = ref<RelationDTO[]>([]);
const loading = ref(false);
const error = ref('');
const saving = ref(false);

const showForm = ref(false);
const editing = ref<RelationDTO | null>(null);
const form = reactive({
  fromMemberId: '',
  toMemberId: '',
  relationType: RELATION_OPTIONS[0].value,
  addressTerm: RELATION_OPTIONS[0].defaultAddress,
  coAddressTermsRaw: '',
  status: 'active' as RelationStatus,
  notes: '',
});

const memberMap = computed(() => {
  const m = new Map<string, MemberDTO>();
  for (const x of props.members) m.set(x.id, x);
  return m;
});

const canSubmit = computed(
  () =>
    !!form.fromMemberId &&
    !!form.toMemberId &&
    form.fromMemberId !== form.toMemberId &&
    !!form.addressTerm.trim(),
);

watch(
  () => form.relationType,
  (newType) => {
    if (!editing.value) {
      const opt = RELATION_OPTIONS.find((o) => o.value === newType);
      if (opt && !form.addressTerm) form.addressTerm = opt.defaultAddress;
    }
  },
);

async function load(): Promise<void> {
  loading.value = true;
  error.value = '';
  try {
    relations.value = await relationsApi.list(props.spaceId);
  } catch {
    error.value = '关系加载失败';
  } finally {
    loading.value = false;
  }
}

function resetForm(): void {
  editing.value = null;
  form.fromMemberId = props.members[0]?.id ?? '';
  form.toMemberId = props.members[1]?.id ?? '';
  form.relationType = RELATION_OPTIONS[0].value;
  form.addressTerm = RELATION_OPTIONS[0].defaultAddress;
  form.coAddressTermsRaw = '';
  form.status = 'active';
  form.notes = '';
}

function openCreate(): void {
  resetForm();
  showForm.value = true;
}

function openEdit(rel: RelationDTO): void {
  editing.value = rel;
  form.fromMemberId = rel.fromMemberId;
  form.toMemberId = rel.toMemberId;
  form.relationType = rel.relationType;
  form.addressTerm = rel.addressTerm;
  form.coAddressTermsRaw = (rel.coAddressTerms ?? []).join('，');
  form.status = rel.status;
  form.notes = rel.notes ?? '';
  showForm.value = true;
}

function closeForm(): void {
  showForm.value = false;
}

function parseCoAddresses(raw: string): string[] {
  return raw
    .split(/[，,、\n]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .slice(0, 8);
}

async function submit(): Promise<void> {
  if (!canSubmit.value) {
    error.value = '请选择两位不同的家人并填写称谓';
    return;
  }
  saving.value = true;
  error.value = '';
  try {
    const payload = {
      spaceId: props.spaceId,
      fromMemberId: form.fromMemberId,
      toMemberId: form.toMemberId,
      relationType: form.relationType,
      addressTerm: form.addressTerm.trim(),
      coAddressTerms: parseCoAddresses(form.coAddressTermsRaw),
      status: form.status,
      notes: form.notes.trim() || undefined,
    };
    if (editing.value) {
      const updated = await relationsApi.update(editing.value.id, payload);
      const idx = relations.value.findIndex((r) => r.id === updated.id);
      if (idx >= 0) relations.value.splice(idx, 1, updated);
    } else {
      const created = await relationsApi.create(payload);
      relations.value.push(created);
    }
    showForm.value = false;
  } catch (e: unknown) {
    error.value =
      (e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? '保存失败';
  } finally {
    saving.value = false;
  }
}

async function remove(rel: RelationDTO): Promise<void> {
  if (!confirm(`确认删除这条关系？`)) return;
  try {
    await relationsApi.remove(rel.id);
    relations.value = relations.value.filter((r) => r.id !== rel.id);
  } catch {
    error.value = '删除失败';
  }
}

function relationLabel(t: string): string {
  return RELATION_OPTIONS.find((o) => o.value === t)?.label ?? t;
}

function memberName(id: string): string {
  return memberMap.value.get(id)?.name ?? '已删除';
}

onMounted(load);
</script>

<template>
  <section class="card relations-card" data-test="relations-panel">
    <div class="section-title" style="margin: 0 0 .8rem">
      <h3>家庭关系</h3>
      <el-button
        v-if="props.members.length >= 2"
        type="primary"
        class="btn-pill"
        data-test="add-relation"
        @click="openCreate"
      >+ 新增关系</el-button>
    </div>

    <p v-if="props.members.length < 2" class="muted">
      至少添加 2 位家人后，才能为他们标记关系（父女、夫妻、兄弟姐妹等）。
    </p>

    <p v-if="error" class="err" data-test="relations-error">{{ error }}</p>

    <div v-if="!loading && props.members.length >= 2 && relations.length === 0" class="empty-tip" data-test="relations-empty">
      还没有标记任何关系。点击右上角加一条，AI 在饭桌对话里就能用对称呼了。
    </div>

    <ul v-else-if="relations.length" class="relation-list" data-test="relations-list">
      <li
        v-for="rel in relations"
        :key="rel.id"
        class="relation-row"
        :data-test="`relation-${rel.id}`"
      >
        <div class="relation-pair">
          <strong>{{ memberName(rel.fromMemberId) }}</strong>
          <span class="arrow" aria-hidden="true">→</span>
          <strong>{{ memberName(rel.toMemberId) }}</strong>
        </div>
        <div class="relation-meta">
          <span class="tag leaf">{{ relationLabel(rel.relationType) }}</span>
          <span class="muted">称呼：</span>
          <span class="address">「{{ rel.addressTerm }}」</span>
          <template v-if="rel.coAddressTerms.length">
            <span class="muted">备注：</span>
            <span class="address-extra">{{ rel.coAddressTerms.join(' / ') }}</span>
          </template>
        </div>
        <div class="relation-actions">
          <el-button size="small" class="btn-pill" :data-test="`edit-${rel.id}`" @click="openEdit(rel)">编辑</el-button>
          <el-button size="small" class="btn-pill" :data-test="`delete-${rel.id}`" @click="remove(rel)">删除</el-button>
        </div>
      </li>
    </ul>

    <transition name="fade">
      <div v-if="showForm" class="relation-form card" data-test="relation-form">
        <div class="row">
          <el-form-item label="A">
            <el-select v-model="form.fromMemberId" placeholder="选择家人 A" data-test="rel-from">
              <el-option
                v-for="m in props.members"
                :key="m.id"
                :label="`${m.name}（${m.relation}）`"
                :value="m.id"
              />
            </el-select>
          </el-form-item>
          <el-form-item label="B">
            <el-select v-model="form.toMemberId" placeholder="选择家人 B" data-test="rel-to">
              <el-option
                v-for="m in props.members"
                :key="m.id"
                :label="`${m.name}（${m.relation}）`"
                :value="m.id"
                :disabled="m.id === form.fromMemberId"
              />
            </el-select>
          </el-form-item>
        </div>
        <p class="muted hint" v-if="form.fromMemberId && form.toMemberId">
          A → B 表示「{{ memberName(form.fromMemberId) }}」眼里「{{ memberName(form.toMemberId) }}」是怎么样的角色。
        </p>

        <el-form-item label="关系">
          <el-select v-model="form.relationType" data-test="rel-type">
            <el-option
              v-for="o in RELATION_OPTIONS"
              :key="o.value"
              :label="o.label"
              :value="o.value"
            />
          </el-select>
        </el-form-item>

        <el-form-item label="主称呼">
          <el-input
            v-model="form.addressTerm"
            placeholder="A 平时怎么叫 B（例如 妈、老李、宝贝）"
            data-test="rel-address"
          />
        </el-form-item>
        <el-form-item label="备用称呼">
          <el-input
            v-model="form.coAddressTermsRaw"
            placeholder="可填多个，逗号或顿号分隔（最多 8 个）"
            data-test="rel-co-address"
          />
        </el-form-item>

        <el-form-item label="状态">
          <el-select v-model="form.status" data-test="rel-status">
            <el-option
              v-for="o in STATUS_OPTIONS"
              :key="o.value"
              :label="o.label"
              :value="o.value"
            />
          </el-select>
        </el-form-item>

        <el-form-item label="备注">
          <el-input v-model="form.notes" type="textarea" :rows="2" data-test="rel-notes" />
        </el-form-item>

        <div class="row">
          <el-button
            type="primary"
            class="btn-pill"
            :loading="saving"
            :disabled="!canSubmit"
            data-test="rel-submit"
            @click="submit"
          >{{ editing ? '保存修改' : '创建关系' }}</el-button>
          <el-button class="btn-pill" data-test="rel-cancel" @click="closeForm">取消</el-button>
        </div>
      </div>
    </transition>
  </section>
</template>

<style scoped>
.relations-card { padding: 1rem; }

.relation-list { list-style: none; padding: 0; margin: .6rem 0 0; display: grid; gap: .5rem; }
.relation-row {
  display: grid;
  grid-template-columns: minmax(140px, 1fr) 2fr auto;
  gap: .8rem;
  align-items: center;
  padding: .6rem .8rem;
  background: #fff;
  border: 1px solid var(--line);
  border-radius: 12px;
}
@media (max-width: 640px) {
  .relation-row { grid-template-columns: 1fr; gap: .35rem; }
  .relation-actions { justify-self: flex-start; }
}
.relation-pair { display: inline-flex; align-items: center; gap: .4rem; }
.arrow { color: var(--muted); font-size: 1.05rem; }
.relation-meta { display: inline-flex; align-items: center; gap: .35rem; flex-wrap: wrap; }
.address { color: var(--tomato-500); font-style: italic; }
.address-extra { color: var(--bark-900); }
.relation-actions { display: flex; gap: .35rem; }

.relation-form {
  margin-top: .8rem;
  padding: 1rem;
  background: var(--cream-50, #fff8ec);
  border: 1px dashed var(--line);
  border-radius: 12px;
  display: grid;
  gap: .25rem;
}
.relation-form .row { display: flex; gap: .5rem; flex-wrap: wrap; }
.relation-form .hint { margin-top: -.3rem; font-size: .82rem; }
.fade-enter-active, .fade-leave-active { transition: opacity .25s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
