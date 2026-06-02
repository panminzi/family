import { describe, expect, it, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createRouter, createMemoryHistory } from 'vue-router';

const { sessionsMock, detailMock } = vi.hoisted(() => ({
  sessionsMock: vi.fn(),
  detailMock: vi.fn(),
}));

vi.mock('../src/api', () => ({
  dinnerApi: {
    sessions: sessionsMock,
    detail: detailMock,
    end: vi.fn(),
    start: vi.fn(),
    message: vi.fn(),
  },
  spacesApi: {},
  membersApi: {},
  authApi: {},
}));

import HistoryPage from '../src/pages/HistoryPage.vue';

function makeRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/spaces/:spaceId/history', name: 'history', component: HistoryPage },
      { path: '/spaces/:spaceId', name: 'space-detail', component: { template: '<div />' } },
    ],
  });
}

describe('HistoryPage', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    sessionsMock.mockReset();
    detailMock.mockReset();
  });

  it('groups sessions by date and shows meal pills', async () => {
    sessionsMock.mockResolvedValue([
      { id: 's1', spaceId: 'sp1', mealType: 'breakfast', startedAt: '2024-03-01T07:30:00Z', endedAt: null },
      { id: 's2', spaceId: 'sp1', mealType: 'dinner', startedAt: '2024-03-01T18:30:00Z', endedAt: '2024-03-01T19:00:00Z' },
      { id: 's3', spaceId: 'sp1', mealType: 'lunch', startedAt: '2024-02-28T12:00:00Z', endedAt: null },
    ]);

    const router = makeRouter();
    router.push('/spaces/sp1/history');
    await router.isReady();
    const w = mount(HistoryPage, { global: { plugins: [router] } });
    await flushPromises();

    const groups = w.findAll('.group');
    expect(groups.length).toBe(2);
    expect(w.text()).toContain('早餐');
    expect(w.text()).toContain('午餐');
    expect(w.text()).toContain('晚餐');
  });

  it('expands a session and lazy-loads its messages', async () => {
    sessionsMock.mockResolvedValue([
      { id: 's1', spaceId: 'sp1', mealType: 'breakfast', startedAt: '2024-03-01T07:30:00Z', endedAt: null },
    ]);
    detailMock.mockResolvedValue({
      session: { id: 's1' },
      messages: [
        { id: 'c1', sessionId: 's1', memberId: 'm1', speaker: '老王', content: '早呀', role: 'member', sequence: 1, createdAt: '2024-03-01T07:30:00Z' },
      ],
    });

    const router = makeRouter();
    router.push('/spaces/sp1/history');
    await router.isReady();
    const w = mount(HistoryPage, { global: { plugins: [router] } });
    await flushPromises();

    expect(detailMock).not.toHaveBeenCalled();
    await w.find('.info').trigger('click');
    await flushPromises();
    expect(detailMock).toHaveBeenCalledWith('s1');
    expect(w.text()).toContain('早呀');
  });

  it('shows empty tip when no sessions', async () => {
    sessionsMock.mockResolvedValue([]);
    const router = makeRouter();
    router.push('/spaces/sp1/history');
    await router.isReady();
    const w = mount(HistoryPage, { global: { plugins: [router] } });
    await flushPromises();
    expect(w.find('[data-test="empty"]').exists()).toBe(true);
  });
});
