import { defineStore } from 'pinia';
import { authApi } from '../api';
import type { UserDTO } from '../api/client';

interface State {
  token: string | null;
  user: UserDTO | null;
}

export const useAuthStore = defineStore('auth', {
  state: (): State => ({
    token: typeof localStorage !== 'undefined' ? localStorage.getItem('token') : null,
    user: null,
  }),
  actions: {
    async login(email: string, password: string): Promise<void> {
      const resp = await authApi.login(email, password);
      this.token = resp.token;
      this.user = resp.user;
      localStorage.setItem('token', resp.token);
    },
    async register(email: string, password: string, displayName: string): Promise<void> {
      const resp = await authApi.register(email, password, displayName);
      this.token = resp.token;
      this.user = resp.user;
      localStorage.setItem('token', resp.token);
    },
    async fetchMe(): Promise<void> {
      if (!this.token) return;
      try {
        this.user = await authApi.me();
      } catch {
        this.logout();
      }
    },
    logout(): void {
      this.token = null;
      this.user = null;
      if (typeof localStorage !== 'undefined') localStorage.removeItem('token');
    },
  },
});
