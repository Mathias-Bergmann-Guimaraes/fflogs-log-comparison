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
        <!-- Routes with child pages (BiS Tracker) become submenus -->
        <a-menu v-model:open-keys="openKeys" class="h-full" mode="inline" :selected-keys="[String(route.name)]" @click="onMenuClick">
          <template v-for="item in menuItems" :key="String(item.name)">
            <a-sub-menu v-if="item.pages.length" :key="String(item.name)" :title="item.meta.menuLabel">
              <a-menu-item v-for="page in item.pages" :key="String(page.name)">
                <template v-if="page.meta?.menuIcon" #icon><component :is="page.meta?.menuIcon" /></template>
                {{ page.meta?.menuLabel }}
              </a-menu-item>
            </a-sub-menu>
            <a-menu-item v-else :key="String(item.name)">{{ item.meta.menuLabel }}</a-menu-item>
          </template>
        </a-menu>
      </a-layout-sider>

      <a-layout-content class="flex flex-col overflow-auto">
        <router-view />
      </a-layout-content>
    </a-layout>
  </a-layout>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/authStore'

const router = useRouter()
const route = useRoute()
const auth = useAuthStore()
// Top-level menu entries, each with its child pages (if any). Only children of a menu entry are pages of a
// submenu; everything is a child of the layout route ('/'), which has no menu label.
const childNames = new Set(
  router
    .getRoutes()
    .filter((r) => r.meta.menuLabel)
    .flatMap((r) => r.children.map((child) => child.name)),
)
// Entries for features the account doesn't have are left out entirely
const allMenuItems = router
  .getRoutes()
  .filter((r) => r.meta.menuLabel && !childNames.has(r.name))
  .map((r) => ({ ...r, pages: r.children.filter((child) => child.meta?.menuLabel) }))
const menuItems = computed(() => allMenuItems.filter((item) => !item.meta.feature || auth.hasFeature(item.meta.feature)))

// Submenus start open, and the one holding the current page is reopened when navigating into it
const openKeys = ref(allMenuItems.filter((item) => item.pages.length).map((item) => String(item.name)))
watch(
  () => route.matched.map((r) => String(r.name)),
  (names) => {
    const parent = names.find((name) => allMenuItems.some((item) => item.pages.length && String(item.name) === name))
    if (parent && !openKeys.value.includes(parent)) openKeys.value.push(parent)
  },
)

auth.ensureLoaded()

async function onLogout() {
  await auth.logout()
  if (route.meta.requiresAuth) router.push({ name: 'login', query: { redirect: route.fullPath } })
}

function onMenuClick({ key }: { key: string | number }) {
  router.push({ name: String(key) })
}
</script>
