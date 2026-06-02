import { describe, expect, it, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createRouter, createMemoryHistory } from 'vue-router';

const { listMock, createMock } = vi.hoisted(() => ({
  listMock: vi.fn(),
  createMock: vi.fn(),
}));

vi.mock('../src/api', () => ({
  spacesApi: {
    list: listMock,
    create: createMock,
    remove: vi.fn(async () => ({ ok: true })),
  },
  authApi: {},
  membersApi: {},
  dinnerApi: {},
}));

import SpacesPage from '../src/pages/SpacesPage.vue';

function makeRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'spaces', component: SpacesPage },
      { path: '/spaces/:spaceId', name: 'space-detail', component: { template: '<div />' } },
    ],
  });
}

describe('SpacesPage', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    listMock.mockReset();
    createMock.mockReset();
  });

  it('shows empty tip when no spaces', async () => {
    listMock.mockResolvedValue([]);
    const router = makeRouter();
    router.push('/');
    await router.isReady();
    const w = mount(SpacesPage, { global: { plugins: [router] } });
    await flushPromises();
    expect(w.find('[data-test="empty"]').exists()).toBe(true);
  });

  it('lists spaces returned from api', async () => {
    listMock.mockResolvedValue([
      { id: 's1', name: '王家', ownerId: 'u', createdAt: '2024-01-01T00:00:00Z' },
      { id: 's2', name: '李家', ownerId: 'u', createdAt: '2024-01-02T00:00:00Z' },
    ]);
    const router = makeRouter();
    router.push('/');
    await router.isReady();
    const w = mount(SpacesPage, { global: { plugins: [router] } });
    await flushPromises();
    const list = w.find('[data-test="space-list"]');
    expect(list.exists()).toBe(true);
    expect(list.text()).toContain('王家');
    expect(list.text()).toContain('李家');
  });

  it('creates a new space and prepends it', async () => {
    listMock.mockResolvedValue([]);
    createMock.mockResolvedValue({
      id: 'new', name: '陈家', ownerId: 'u', createdAt: '2024-02-01T00:00:00Z',
    });
    const router = makeRouter();
    router.push('/');
    await router.isReady();
    const w = mount(SpacesPage, { global: { plugins: [router] } });
    await flushPromises();
    const input = w.find('[data-test="new-name"]');
    await input.setValue('陈家');
    await w.find('[data-test="create-btn"]').trigger('click');
    await flushPromises();
    expect(createMock).toHaveBeenCalledWith('陈家');
    expect(w.find('[data-test="space-list"]').text()).toContain('陈家');
  });
});
