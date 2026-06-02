import { describe, expect, it, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createRouter, createMemoryHistory } from 'vue-router';

const { listMock, startMock } = vi.hoisted(() => ({
  listMock: vi.fn(),
  startMock: vi.fn(),
}));

vi.mock('../src/api', () => ({
  membersApi: { list: listMock },
  dinnerApi: { start: startMock },
  spacesApi: {},
  authApi: {},
}));

import SceneHomePage from '../src/pages/SceneHomePage.vue';

function makeRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/spaces/:spaceId/scene', name: 'scene-home', component: SceneHomePage },
      {
        path: '/spaces/:spaceId/dinner/:sessionId',
        name: 'dinner',
        component: { template: '<div />' },
      },
      { path: '/spaces/:spaceId', name: 'space-detail', component: { template: '<div />' } },
    ],
  });
}

describe('SceneHomePage', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    listMock.mockReset();
    startMock.mockReset();
  });

  it('renders countdown and meal buttons', async () => {
    listMock.mockResolvedValue([]);
    const router = makeRouter();
    router.push('/spaces/sp1/scene');
    await router.isReady();
    const w = mount(SceneHomePage, { global: { plugins: [router] } });
    await flushPromises();
    const cd = w.find('[data-test="countdown"]');
    expect(cd.exists()).toBe(true);
    expect(cd.text()).toMatch(/早餐|午餐|晚餐/);
    expect(w.find('[data-test="start-breakfast"]').exists()).toBe(true);
    expect(w.find('[data-test="start-lunch"]').exists()).toBe(true);
    expect(w.find('[data-test="start-dinner"]').exists()).toBe(true);
  });

  it('starts a meal and navigates to dinner page', async () => {
    listMock.mockResolvedValue([]);
    startMock.mockResolvedValue({ sessionId: 'sess1', turns: [] });
    const router = makeRouter();
    router.push('/spaces/sp1/scene');
    await router.isReady();
    const w = mount(SceneHomePage, { global: { plugins: [router] } });
    await flushPromises();
    await w.find('[data-test="start-dinner"]').trigger('click');
    await flushPromises();
    expect(startMock).toHaveBeenCalledWith('sp1', 'dinner');
    expect(router.currentRoute.value.name).toBe('dinner');
    expect(router.currentRoute.value.params.sessionId).toBe('sess1');
  });
});
