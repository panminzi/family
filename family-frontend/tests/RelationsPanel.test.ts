import { afterEach, describe, expect, it, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import RelationsPanel from '../src/components/RelationsPanel.vue';
import * as apiModule from '../src/api';
import type { MemberDTO, RelationDTO } from '../src/api/client';

const baseMembers: MemberDTO[] = [
  {
    id: 'm1',
    spaceId: 'sp1',
    name: '老王',
    relation: '爸爸',
    description: '爱讲冷笑话',
    personality: null,
    avatarUrl: null,
    createdAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'm2',
    spaceId: 'sp1',
    name: '小王',
    relation: '女儿',
    description: '初中生',
    personality: null,
    avatarUrl: null,
    createdAt: '2026-01-02T00:00:00Z',
  },
];

const baseRelation: RelationDTO = {
  id: 'r1',
  spaceId: 'sp1',
  fromMemberId: 'm1',
  toMemberId: 'm2',
  relationType: 'parent_of',
  addressTerm: '宝贝',
  coAddressTerms: ['闺女'],
  intimacy: 0.8,
  status: 'active',
  notes: null,
  createdAt: '2026-01-03T00:00:00Z',
  updatedAt: '2026-01-03T00:00:00Z',
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('RelationsPanel', () => {
  it('shows empty state and lists relations from the api', async () => {
    vi.spyOn(apiModule.relationsApi, 'list').mockResolvedValue([]);
    const wEmpty = mount(RelationsPanel, {
      props: { spaceId: 'sp1', members: baseMembers },
    });
    await flushPromises();
    expect(wEmpty.find('[data-test="relations-empty"]').exists()).toBe(true);

    vi.spyOn(apiModule.relationsApi, 'list').mockResolvedValue([baseRelation]);
    const w = mount(RelationsPanel, {
      props: { spaceId: 'sp1', members: baseMembers },
    });
    await flushPromises();
    const list = w.find('[data-test="relations-list"]');
    expect(list.exists()).toBe(true);
    expect(list.text()).toContain('老王');
    expect(list.text()).toContain('小王');
    expect(list.text()).toContain('宝贝');
  });

  it('warns if fewer than 2 members', async () => {
    vi.spyOn(apiModule.relationsApi, 'list').mockResolvedValue([]);
    const w = mount(RelationsPanel, {
      props: { spaceId: 'sp1', members: [baseMembers[0]] },
    });
    await flushPromises();
    expect(w.find('[data-test="add-relation"]').exists()).toBe(false);
    expect(w.text()).toContain('至少添加 2 位家人');
  });

  it('creates a relation through the api', async () => {
    vi.spyOn(apiModule.relationsApi, 'list').mockResolvedValue([]);
    const create = vi.spyOn(apiModule.relationsApi, 'create').mockResolvedValue({
      ...baseRelation,
      id: 'r2',
      addressTerm: '老王',
      coAddressTerms: [],
    });
    const w = mount(RelationsPanel, {
      props: { spaceId: 'sp1', members: baseMembers },
    });
    await flushPromises();
    await w.find('[data-test="add-relation"]').trigger('click');
    await w.find('[data-test="rel-address"]').setValue('老王');
    await w.find('[data-test="rel-submit"]').trigger('click');
    await flushPromises();
    expect(create).toHaveBeenCalledTimes(1);
    expect(create.mock.calls[0][0].addressTerm).toBe('老王');
  });
});
