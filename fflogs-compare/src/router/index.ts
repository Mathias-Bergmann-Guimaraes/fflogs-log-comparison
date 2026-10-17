import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '@/views/HomeView.vue'
import HomeViewLayout from '@/views/HomeViewLayout.vue'
import { useAuthStore } from '@/stores/authStore'

declare module 'vue-router' {
  interface RouteMeta {
    menuLabel?: string
    requiresAuth?: boolean
  }
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
          path: 'bisTracker',
          name: 'bisTracker',
          component: () => import('@/views/bis-tracker/BisTrackerView.vue'),
          meta: { menuLabel: 'BiS Tracker', requiresAuth: true },
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
