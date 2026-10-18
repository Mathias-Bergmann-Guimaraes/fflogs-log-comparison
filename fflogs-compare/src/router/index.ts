import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '@/views/HomeView.vue'
import HomeViewLayout from '@/views/HomeViewLayout.vue'
import { markRaw, type Component } from 'vue'
import { AppstoreOutlined, DashboardOutlined } from '@ant-design/icons-vue'
import { useAuthStore } from '@/stores/authStore'

declare module 'vue-router' {
  interface RouteMeta {
    menuLabel?: string
    menuIcon?: Component
    requiresAuth?: boolean
  }
}

// Last BiS Tracker page opened (written by BisTrackerView); /bisTracker goes back to it
export const BIS_PAGE_KEY = 'bis-tracker-page'

function lastBisPage() {
  try {
    if (localStorage.getItem(BIS_PAGE_KEY) === 'bisDashboard') return 'bisDashboard'
  } catch {
    // Storage unavailable: use the default
  }
  return 'bisGear'
}

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      component: HomeViewLayout,
      children: [
        { path: '', name: 'home', component: HomeView, meta: { menuLabel: 'Home' } },
        {
          path: 'compare',
          name: 'compare',
          component: () => import('@/views/fflogsComparison/CompareView.vue'),
          meta: { menuLabel: 'Logs Comparison' },
        },
        {
          // A submenu in the side menu: its children are the pages
          path: 'bisTracker',
          name: 'bisTracker',
          component: () => import('@/views/bis-tracker/BisTrackerView.vue'),
          meta: { menuLabel: 'BiS Tracker', requiresAuth: true },
          redirect: () => ({ name: lastBisPage() }),
          children: [
            {
              path: 'dashboard',
              name: 'bisDashboard',
              component: () => import('@/views/bis-tracker/dashboard/BisDashboard.vue'),
              meta: { menuLabel: 'Dashboard', menuIcon: markRaw(DashboardOutlined), requiresAuth: true },
            },
            {
              path: 'gear',
              name: 'bisGear',
              component: () => import('@/views/bis-tracker/GearSetsView.vue'),
              meta: { menuLabel: 'Gear sets', menuIcon: markRaw(AppstoreOutlined), requiresAuth: true },
            },
          ],
        },
        {
          path: 'login',
          name: 'login',
          component: () => import('@/views/LoginView.vue'),
        },
      ],
    },
    { path: '/:pathMatch(.*)*', redirect: { name: 'home' } },
  ],
})

router.beforeEach(async (to) => {
  if (!to.meta.requiresAuth) return
  const auth = useAuthStore()
  await auth.ensureLoaded()
  if (!auth.user) return { name: 'login', query: { redirect: to.fullPath } }
})

export default router
