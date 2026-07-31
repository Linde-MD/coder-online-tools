import { createRouter, createWebHashHistory } from 'vue-router';

const ROUTE_STORAGE_KEY = 'coderOnlineTools.activeRoute.v1';

function readPreferredRoute() {
  try {
    const value = localStorage.getItem(ROUTE_STORAGE_KEY);
    if (value === '/home') return '/home';
    if (value === '/can-arch') return '/can-arch';
    if (value === '/wenyan') return '/wenyan';
    return '/home';
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
      path: '/:pathMatch(.*)*',
      redirect: '/chart',
    },
  ],
});

router.afterEach((to) => {
  try {
    const safePath = ['/home', '/chart', '/can-arch', '/wenyan'].includes(to.path) ? to.path : '/home';
    localStorage.setItem(ROUTE_STORAGE_KEY, safePath);
  } catch (_) {
    // Ignore storage errors.
  }
});

export { ROUTE_STORAGE_KEY };
export default router;
