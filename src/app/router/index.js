import { createRouter, createWebHashHistory } from 'vue-router';

const ROUTE_STORAGE_KEY = 'coderOnlineTools.activeRoute.v1';
const PERSISTED_ROUTES = ['/home', '/chart', '/can-arch', '/wenyan', '/learn-git', '/knowledge-chat', '/tool-gui-gantte', '/material-reader'];

function readPreferredRoute() {
  try {
    const value = localStorage.getItem(ROUTE_STORAGE_KEY);
    return PERSISTED_ROUTES.includes(value) ? value : '/home';
  } catch (_) {
    return '/home';
  }
}

const router = createRouter({
  history: createWebHashHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      redirect: () => readPreferredRoute(),
    },
    {
      path: '/home',
      name: 'home',
      component: () => import('@/app/pages/HomePage.vue'),
    },
    {
      path: '/chart',
      name: 'chart',
      component: () => import('@/app/pages/ChartPage.vue'),
    },
    {
      path: '/can-arch',
      name: 'can-arch',
      component: () => import('@/app/pages/CanArchPage.vue'),
    },
    {
      path: '/j1939',
      name: 'j1939',
      redirect: '/can-arch',
    },
    {
      path: '/wenyan',
      name: 'wenyan',
      component: () => import('@/app/pages/WenyanPage.vue'),
    },
    {
      path: '/learn-git',
      name: 'learn-git',
      component: () => import('@/app/pages/LearnGitPage.vue'),
    },
    {
      path: '/knowledge-chat',
      name: 'knowledge-chat',
      component: () => import('@/app/pages/KnowledgeChatPage.vue'),
    },
    {
      path: '/material-reader',
      name: 'material-reader',
      component: () => import('@/app/pages/MaterialReaderPage.vue'),
    },
    {
      path: '/tool-gui-gantte',
      name: 'tool-gui-gantte',
      component: () => import('@/app/pages/ToolGuiGanttePage.vue'),
    },
    {
      path: '/:pathMatch(.*)*',
      redirect: '/chart',
    },
  ],
});

router.afterEach((to) => {
  try {
    const safePath = PERSISTED_ROUTES.includes(to.path)
      ? to.path
      : '/home';
    localStorage.setItem(ROUTE_STORAGE_KEY, safePath);
  } catch (_) {
    // Ignore storage errors.
  }
});

export { ROUTE_STORAGE_KEY };
export default router;
