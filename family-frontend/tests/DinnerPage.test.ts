import { describe, expect, it, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createRouter, createMemoryHistory } from 'vue-router';

const { detailMock, messageMock, endMock } = vi.hoisted(() => ({
  detailMock: vi.fn(),
  messageMock: vi.fn(),
  endMock: vi.fn(),
}));

vi.mock('../src/api', () => ({
  dinnerApi: {
    detail: detailMock,
    message: messageMock,
    end: endMock,
    sessions: vi.fn(),
    start: vi.fn(),
  },
  authApi: {},
  spacesApi: {},
  membersApi: {},
}));

import DinnerPage from '../src/pages/DinnerPage.vue';

function makeRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      {
        path: '/spaces/:spaceId/dinner/:sessionId',
        name: 'dinner',
        component: DinnerPage,
      },
      {
        path: '/spaces/:spaceId',
        name: 'space-detail',
        component: { template: '<div />' },
      },
    ],
  });
}

const baseMessages = [
  { id: 'c1', sessionId: 's1', memberId: 'm1', speaker: '老王', content: '开饭啦', role: 'member', sequence: 1, createdAt: '2024-01-01T00:00:00Z' },
  { id: 'c2', sessionId: 's1', memberId: 'm2', speaker: '王妈', content: '今天有红烧肉', role: 'member', sequence: 2, createdAt: '2024-01-01T00:00:00Z' },
];

describe('DinnerPage', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    detailMock.mockReset();
    messageMock.mockReset();
    endMock.mockReset();
  });

  it('renders loaded messages', async () => {
    detailMock.mockResolvedValue({ session: { id: 's1' }, messages: baseMessages });
    const router = makeRouter();
    router.push('/spaces/sp1/dinner/s1');
    await router.isReady();
    const w = mount(DinnerPage, { global: { plugins: [router] } });
    await flushPromises();
    const list = w.find('[data-test="chat-list"]');
    expect(list.text()).toContain('老王');
    expect(list.text()).toContain('开饭啦');
    expect(list.text()).toContain('王妈');
  });

  it('sends a user message and refetches detail', async () => {
    detailMock.mockResolvedValueOnce({ session: { id: 's1' }, messages: baseMessages });
    messageMock.mockResolvedValue({
      userTurn: { id: 'u1', sequence: 3 },
      aiTurns: [{ id: 'c3', speaker: '老王', content: '同意' }],
    });
    detailMock.mockResolvedValueOnce({
      session: { id: 's1' },
      messages: [
        ...baseMessages,
        { id: 'u1', sessionId: 's1', memberId: null, speaker: '我', content: '我也想吃', role: 'user', sequence: 3, createdAt: '2024-01-01T00:00:00Z' },
        { id: 'c3', sessionId: 's1', memberId: 'm1', speaker: '老王', content: '同意', role: 'member', sequence: 4, createdAt: '2024-01-01T00:00:00Z' },
      ],
    });

    const router = makeRouter();
    router.push('/spaces/sp1/dinner/s1');
    await router.isReady();
    const w = mount(DinnerPage, { global: { plugins: [router] } });
    await flushPromises();

    await w.find('[data-test="input"]').setValue('我也想吃');
    await w.find('[data-test="send"]').trigger('click');
    await flushPromises();

    expect(messageMock).toHaveBeenCalledWith('sp1', 's1', '我也想吃');
    expect(w.find('[data-test="chat-list"]').text()).toContain('我也想吃');
    expect(w.find('[data-test="chat-list"]').text()).toContain('同意');
  });

  it('end button routes back to space-detail', async () => {
    detailMock.mockResolvedValue({ session: { id: 's1' }, messages: [] });
    endMock.mockResolvedValue({ ok: true });
    const router = makeRouter();
    router.push('/spaces/sp1/dinner/s1');
    await router.isReady();
    const w = mount(DinnerPage, { global: { plugins: [router] } });
    await flushPromises();
    await w.find('[data-test="end"]').trigger('click');
    await flushPromises();
    expect(endMock).toHaveBeenCalledWith('s1');
    expect(router.currentRoute.value.name).toBe('space-detail');
  });
});
