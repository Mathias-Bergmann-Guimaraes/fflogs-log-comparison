<template>
  <a-layout class="h-screen">
    <a-layout-header class="flex items-center justify-between">
      <span>FFXIV COMPANION</span>
      <div class="flex items-center gap-1">
        <!-- Hunt trains the user asked for, seen from every page -->
        <hunt-alerts-bell v-if="watchingHunts" />
        <!-- The username opens a menu: the profile (a modal) and logging out -->
        <a-dropdown v-if="auth.user" placement="bottomRight" :trigger="['click']">
          <a-button type="text" class="text-gray-300!">
            <template #icon><user-outlined /></template>
            {{ auth.user.username }}
            <down-outlined class="text-xs" />
          </a-button>
          <template #overlay>
            <a-menu @click="onUserMenuClick">
              <a-menu-item key="profile">
                <template #icon><idcard-outlined /></template>
                Profile
              </a-menu-item>
              <a-menu-divider />
              <a-menu-item key="logout">
                <template #icon><logout-outlined /></template>
                Log out
              </a-menu-item>
            </a-menu>
          </template>
        </a-dropdown>
        <a-button v-else-if="route.name !== 'login'" size="small" type="primary" @click="router.push({ name: 'login' })">Log in</a-button>
      </div>
    </a-layout-header>
    <a-layout>
      <a-layout-sider>
        <!-- Routes with child pages (BiS Tracker) become submenus -->
        <a-menu v-model:open-keys="openKeys" class="h-full" mode="inline" :selected-keys="[String(route.name)]" @click="onMenuClick">
          <template v-for="item in menuItems" :key="String(item.name)">
            <a-sub-menu v-if="item.pages.length" :key="String(item.name)">
              <template #title>
                {{ item.meta.menuLabel }}
              </template>
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
    <profile-modal v-if="auth.user" />
  </a-layout>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { DownOutlined, IdcardOutlined, LogoutOutlined, UserOutlined } from '@ant-design/icons-vue'
import { useAuthStore } from '@/stores/authStore'
import { useProfileStore } from '@/stores/profileStore'
import ProfileModal from './ProfileModal.vue'
import { useHuntTrainsStore } from '@/stores/huntTrainsStore'
import HuntAlertsBell from './hunts/HuntAlertsBell.vue'

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

// Hunt trains are polled while someone with the Hunt Tracker is signed in, for the bell in the header
const huntTrains = useHuntTrainsStore()
const watchingHunts = computed(() => !!auth.user && auth.hasFeature('hunts'))
let stopWatchingTrains: (() => void) | null = null
watch(
  watchingHunts,
  (watching) => {
    stopWatchingTrains?.()
    stopWatchingTrains = null
    if (watching) stopWatchingTrains = huntTrains.watch()
    else huntTrains.clear()
  },
  { immediate: true },
)

const profile = useProfileStore()

function onUserMenuClick({ key }: { key: string | number }) {
  if (key === 'profile') profile.modalOpen = true
  else if (key === 'logout') void onLogout()
}

async function onLogout() {
  await auth.logout()
  if (route.meta.requiresAuth) router.push({ name: 'login', query: { redirect: route.fullPath } })
}

function onMenuClick({ key }: { key: string | number }) {
  router.push({ name: String(key) })
}
</script>
