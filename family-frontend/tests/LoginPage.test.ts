import { describe, expect, it, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createRouter, createMemoryHistory } from 'vue-router';

const { loginMock, meMock } = vi.hoisted(() => ({
  loginMock: vi.fn(),
  meMock: vi.fn(),
}));

vi.mock('../src/api', () => ({
  authApi: {
    login: loginMock,
    register: vi.fn(),
    me: meMock,
  },
  spacesApi: {},
  membersApi: {},
  dinnerApi: {},
}));

import LoginPage from '../src/pages/LoginPage.vue';
import { useAuthStore } from '../src/stores/auth';

function makeRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/login', name: 'login', component: LoginPage },
      { path: '/', name: 'spaces', component: { template: '<div />' } },
      { path: '/register', name: 'register', component: { template: '<div />' } },
    ],
  });
}

describe('LoginPage', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    loginMock.mockReset();
    meMock.mockReset();
    localStorage.clear();
  });

  it('logs in and routes to spaces', async () => {
    loginMock.mockResolvedValue({
      token: 'tk',
      user: { id: 'u', email: 'x@x.com', displayName: 'X' },
    });
    meMock.mockResolvedValue({ id: 'u', email: 'x@x.com', displayName: 'X' });

    const router = makeRouter();
    router.push('/login');
    await router.isReady();
    const w = mount(LoginPage, { global: { plugins: [router] } });

    await w.find('[data-test="email"]').setValue('x@x.com');
    await w.find('[data-test="password"]').setValue('secret123');
    await w.find('[data-test="submit"]').trigger('click');
    await flushPromises();

    expect(loginMock).toHaveBeenCalledWith('x@x.com', 'secret123');
    const auth = useAuthStore();
    expect(auth.token).toBe('tk');
    expect(router.currentRoute.value.name).toBe('spaces');
  });

  it('shows error message when login fails', async () => {
    loginMock.mockRejectedValue({ response: { data: { error: 'invalid_credentials' } } });
    const router = makeRouter();
    router.push('/login');
    await router.isReady();
    const w = mount(LoginPage, { global: { plugins: [router] } });

    await w.find('[data-test="email"]').setValue('x@x.com');
    await w.find('[data-test="password"]').setValue('bad');
    await w.find('[data-test="submit"]').trigger('click');
    await flushPromises();

    const err = w.find('[data-test="error"]');
    expect(err.exists()).toBe(true);
    expect(err.text()).toBe('invalid_credentials');
  });
});
