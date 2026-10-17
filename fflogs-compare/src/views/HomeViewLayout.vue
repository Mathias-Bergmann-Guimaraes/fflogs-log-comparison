<template>
  <a-layout class="h-screen">
    <a-layout-header class="flex items-center justify-between">
      <span>FFXIV COMPANION</span>
      <div v-if="auth.user" class="flex items-center gap-3">
        <span class="text-gray-300">{{ auth.user.username }}</span>
        <a-button size="small" @click="onLogout">Log out</a-button>
      </div>
      <a-button v-else-if="route.name !== 'login'" size="small" type="primary" @click="router.push({ name: 'login' })">Log in</a-button>
    </a-layout-header>
    <a-layout>
      <a-layout-sider>
        <a-menu class="h-full" :selected-keys="[String(route.name)]" @click="onMenuClick">
          <a-menu-item v-for="item in menuItems" :key="item.name">{{ item.meta.menuLabel }}</a-menu-item>
        </a-menu>
      </a-layout-sider>

      <a-layout-content class="flex flex-col overflow-auto">
        <router-view />
      </a-layout-content>
    </a-layout>
  </a-layout>
</template>

<script setup lang="ts">
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/authStore'

const router = useRouter()
const route = useRoute()
const auth = useAuthStore()
const menuItems = router.getRoutes().filter((r) => r.meta.menuLabel)

auth.ensureLoaded()

async function onLogout() {
  await auth.logout()
  if (route.meta.requiresAuth) router.push({ name: 'login', query: { redirect: route.fullPath } })
}

function onMenuClick({ key }: { key: string | number }) {
  router.push({ name: String(key) })
}
</script>
