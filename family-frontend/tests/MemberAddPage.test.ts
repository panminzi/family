import { describe, expect, it, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createRouter, createMemoryHistory } from 'vue-router';

const { createMock, photoMock, textMock } = vi.hoisted(() => ({
  createMock: vi.fn(),
  photoMock: vi.fn(),
  textMock: vi.fn(),
}));

vi.mock('../src/api', () => ({
  membersApi: {
    create: createMock,
    uploadPhoto: photoMock,
    addText: textMock,
  },
  authApi: {},
  spacesApi: {},
  dinnerApi: {},
}));

import MemberAddPage from '../src/pages/MemberAddPage.vue';

function makeRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      {
        path: '/spaces/:spaceId/members/add',
        name: 'member-add',
        component: MemberAddPage,
      },
      {
        path: '/spaces/:spaceId/members/:memberId',
        name: 'member-detail',
        component: { template: '<div />' },
      },
    ],
  });
}

describe('MemberAddPage', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    createMock.mockReset();
    photoMock.mockReset();
    textMock.mockReset();
  });

  it('submits a member then routes to detail', async () => {
    createMock.mockResolvedValue({
      id: 'm1', spaceId: 'sp1', name: '老王', relation: '爸爸',
      description: '幽默', personality: null, avatarUrl: null,
      createdAt: '2024-01-01T00:00:00Z',
    });
    textMock.mockResolvedValue({ id: 'mat1' });

    const router = makeRouter();
    router.push('/spaces/sp1/members/add');
    await router.isReady();
    const w = mount(MemberAddPage, { global: { plugins: [router] } });

    await w.find('[data-test="name"]').setValue('老王');
    await w.find('[data-test="relation"]').setValue('爸爸');
    await w.find('[data-test="description"]').setValue('幽默');
    await w.find('[data-test="dialogue"]').setValue('哈哈，开饭啦');
    await w.find('[data-test="submit"]').trigger('click');
    await flushPromises();

    expect(createMock).toHaveBeenCalledWith({
      spaceId: 'sp1',
      name: '老王',
      relation: '爸爸',
      description: '幽默',
    });
    expect(textMock).toHaveBeenCalledWith('m1', 'dialogue', '哈哈，开饭啦');
    expect(router.currentRoute.value.name).toBe('member-detail');
    expect(router.currentRoute.value.params.memberId).toBe('m1');
  });

  it('shows validation error when fields missing', async () => {
    const router = makeRouter();
    router.push('/spaces/sp1/members/add');
    await router.isReady();
    const w = mount(MemberAddPage, { global: { plugins: [router] } });
    await w.find('[data-test="submit"]').trigger('click');
    await flushPromises();
    const err = w.find('[data-test="error"]');
    expect(err.exists()).toBe(true);
    expect(err.text()).toContain('请填写完整成员信息');
    expect(createMock).not.toHaveBeenCalled();
  });
});
