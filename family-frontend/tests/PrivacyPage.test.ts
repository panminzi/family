import { describe, expect, it, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createRouter, createMemoryHistory } from 'vue-router';

const { spacesListMock, spacesRemoveMock, membersListMock, membersRemoveMock, sessionsMock } =
  vi.hoisted(() => ({
    spacesListMock: vi.fn(),
    spacesRemoveMock: vi.fn(async () => ({ ok: true })),
    membersListMock: vi.fn(),
    membersRemoveMock: vi.fn(async () => ({ ok: true })),
    sessionsMock: vi.fn(),
  }));

vi.mock('../src/api', () => ({
  spacesApi: { list: spacesListMock, remove: spacesRemoveMock },
  membersApi: { list: membersListMock, remove: membersRemoveMock },
  dinnerApi: { sessions: sessionsMock },
  authApi: {},
}));

import PrivacyPage from '../src/pages/PrivacyPage.vue';

function makeRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/privacy', name: 'privacy', component: PrivacyPage },
      { path: '/', name: 'spaces', component: { template: '<div />' } },
    ],
  });
}

const sample = {
  spaces: [{ id: 'sp1', name: '王家', ownerId: 'u', createdAt: '2024-01-01T00:00:00Z' }],
  members: [
    {
      id: 'm1', spaceId: 'sp1', name: '老王', relation: '爸爸',
      description: '幽默', personality: null, avatarUrl: null, createdAt: '2024-01-01T00:00:00Z',
    },
  ],
  sessions: [{ id: 's1', spaceId: 'sp1', mealType: 'dinner', startedAt: '2024-01-01T18:30:00Z', endedAt: null }],
};

describe('PrivacyPage', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    spacesListMock.mockReset();
    membersListMock.mockReset();
    sessionsMock.mockReset();
    spacesRemoveMock.mockClear();
    membersRemoveMock.mockClear();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
  });

  it('shows totals from loaded spaces, members, and sessions', async () => {
    spacesListMock.mockResolvedValue(sample.spaces);
    membersListMock.mockResolvedValue(sample.members);
    sessionsMock.mockResolvedValue(sample.sessions);

    const router = makeRouter();
    router.push('/privacy');
    await router.isReady();
    const w = mount(PrivacyPage, { global: { plugins: [router] } });
    await flushPromises();

    expect(w.find('[data-test="stat-spaces"]').text()).toContain('1');
    expect(w.find('[data-test="stat-members"]').text()).toContain('1');
    expect(w.find('[data-test="stat-sessions"]').text()).toContain('1');
    expect(w.find('[data-test="space-blocks"]').text()).toContain('王家');
    expect(w.find('[data-test="space-blocks"]').text()).toContain('老王');
  });

  it('deletes a single member after double confirm', async () => {
    spacesListMock.mockResolvedValue(sample.spaces);
    membersListMock.mockResolvedValue(sample.members);
    sessionsMock.mockResolvedValue([]);

    const router = makeRouter();
    router.push('/privacy');
    await router.isReady();
    const w = mount(PrivacyPage, { global: { plugins: [router] } });
    await flushPromises();

    await w.find('[data-test="delete-member-m1"]').trigger('click');
    await flushPromises();

    expect(window.confirm).toHaveBeenCalledTimes(2);
    expect(membersRemoveMock).toHaveBeenCalledWith('m1');
    expect(w.text()).not.toContain('老王');
  });

  it('deletes an entire space after double confirm', async () => {
    spacesListMock.mockResolvedValue(sample.spaces);
    membersListMock.mockResolvedValue([]);
    sessionsMock.mockResolvedValue([]);

    const router = makeRouter();
    router.push('/privacy');
    await router.isReady();
    const w = mount(PrivacyPage, { global: { plugins: [router] } });
    await flushPromises();

    await w.find('[data-test="delete-space-sp1"]').trigger('click');
    await flushPromises();

    expect(window.confirm).toHaveBeenCalledTimes(2);
    expect(spacesRemoveMock).toHaveBeenCalledWith('sp1');
    expect(w.find('[data-test="empty"]').exists()).toBe(true);
  });

  it('aborts deletion when user cancels confirm', async () => {
    spacesListMock.mockResolvedValue(sample.spaces);
    membersListMock.mockResolvedValue(sample.members);
    sessionsMock.mockResolvedValue([]);
    vi.spyOn(window, 'confirm').mockReturnValueOnce(false);

    const router = makeRouter();
    router.push('/privacy');
    await router.isReady();
    const w = mount(PrivacyPage, { global: { plugins: [router] } });
    await flushPromises();

    await w.find('[data-test="delete-member-m1"]').trigger('click');
    await flushPromises();

    expect(membersRemoveMock).not.toHaveBeenCalled();
    expect(w.text()).toContain('老王');
  });
});
