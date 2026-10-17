import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '@/views/HomeView.vue'
import HomeViewLayout from '@/views/HomeViewLayout.vue'

declare module 'vue-router' {
  interface RouteMeta {
    menuLabel?: string
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
          meta: { menuLabel: 'BiS Tracker' },
        },
      ],
    },
    { path: '/:pathMatch(.*)*', redirect: { name: 'home' } },
  ],
})

export default router
