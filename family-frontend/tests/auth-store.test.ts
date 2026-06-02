import { beforeEach, describe, expect, it, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';

vi.mock('../src/api', () => ({
  authApi: {
    login: vi.fn(async (email: string) => ({
      token: 'tk',
      user: { id: 'u1', email, displayName: 'X' },
    })),
    register: vi.fn(async (email: string, _pw: string, displayName: string) => ({
      token: 'tk2',
      user: { id: 'u2', email, displayName },
    })),
    me: vi.fn(async () => ({ id: 'u1', email: 'x@x.com', displayName: 'X' })),
  },
  spacesApi: {},
  membersApi: {},
  dinnerApi: {},
}));

import { useAuthStore } from '../src/stores/auth';

describe('auth store', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    localStorage.clear();
  });

  it('login persists token to localStorage', async () => {
    const a = useAuthStore();
    await a.login('x@x.com', 'pw');
    expect(a.token).toBe('tk');
    expect(localStorage.getItem('token')).toBe('tk');
    expect(a.user?.email).toBe('x@x.com');
  });

  it('register also persists token', async () => {
    const a = useAuthStore();
    await a.register('y@x.com', 'pw', 'Y');
    expect(a.token).toBe('tk2');
    expect(a.user?.displayName).toBe('Y');
  });

  it('logout clears state and storage', async () => {
    const a = useAuthStore();
    await a.login('x@x.com', 'pw');
    a.logout();
    expect(a.token).toBeNull();
    expect(a.user).toBeNull();
    expect(localStorage.getItem('token')).toBeNull();
  });

  it('fetchMe is a no-op without token', async () => {
    const a = useAuthStore();
    await a.fetchMe();
    expect(a.user).toBeNull();
  });
});
