import { createRouter, createWebHashHistory } from 'vue-router';

const ROUTE_STORAGE_KEY = 'coderOnlineTools.activeRoute.v1';

function readPreferredRoute() {
  try {
    const value = localStorage.getItem(ROUTE_STORAGE_KEY);
    return value === '/j1939' ? '/j1939' : '/chart';
  } catch (_) {
    return '/chart';
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
      path: '/chart',
      name: 'chart',
      component: () => import('@/app/pages/ChartPage.vue'),
    },
    {
      path: '/j1939',
      name: 'j1939',
      component: () => import('@/app/pages/J1939Page.vue'),
    },
    {
      path: '/:pathMatch(.*)*',
      redirect: '/chart',
    },
  ],
});

router.afterEach((to) => {
  try {
    localStorage.setItem(ROUTE_STORAGE_KEY, to.path === '/j1939' ? '/j1939' : '/chart');
  } catch (_) {
    // Ignore storage errors.
  }
});

export { ROUTE_STORAGE_KEY };
export default router;
