import { createRouter, createWebHistory, type RouteLocationNormalized } from 'vue-router';
import { useAuthStore } from './stores/auth';

const LoginPage = () => import('./pages/LoginPage.vue');
const RegisterPage = () => import('./pages/RegisterPage.vue');
const SpacesPage = () => import('./pages/SpacesPage.vue');
const SpaceDetailPage = () => import('./pages/SpaceDetailPage.vue');
const MemberAddPage = () => import('./pages/MemberAddPage.vue');
const MemberDetailPage = () => import('./pages/MemberDetailPage.vue');
const SceneHomePage = () => import('./pages/SceneHomePage.vue');
const DinnerPage = () => import('./pages/DinnerPage.vue');
const HistoryPage = () => import('./pages/HistoryPage.vue');

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/login', name: 'login', component: LoginPage },
    { path: '/register', name: 'register', component: RegisterPage },
    { path: '/', name: 'spaces', component: SpacesPage, meta: { auth: true } },
    {
      path: '/spaces/:spaceId',
      name: 'space-detail',
      component: SpaceDetailPage,
      meta: { auth: true },
    },
    {
      path: '/spaces/:spaceId/scene',
      name: 'scene-home',
      component: SceneHomePage,
      meta: { auth: true },
    },
    {
      path: '/spaces/:spaceId/members/add',
      name: 'member-add',
      component: MemberAddPage,
      meta: { auth: true },
    },
    {
      path: '/spaces/:spaceId/members/:memberId',
      name: 'member-detail',
      component: MemberDetailPage,
      meta: { auth: true },
    },
    {
      path: '/spaces/:spaceId/dinner/:sessionId',
      name: 'dinner',
      component: DinnerPage,
      meta: { auth: true },
    },
    {
      path: '/spaces/:spaceId/history',
      name: 'history',
      component: HistoryPage,
      meta: { auth: true },
    },
  ],
});

router.beforeEach((to: RouteLocationNormalized) => {
  const auth = useAuthStore();
  if (to.meta.auth && !auth.token) {
    return { name: 'login' };
  }
  return true;
});
