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
              <a-menu-item key="settings">
                <template #icon><setting-outlined /></template>
                Settings
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
      <!-- Collapses to icons with the trigger at the bottom; starts collapsed on narrow screens. The sider floats over
           the page while its width animates, and the page only gets the new width once (see reservedWidth): resizing
           the page on every frame re-lays it out and redraws every chart, which lags. -->
      <div class="relative shrink-0" :style="{ width: `${reservedWidth}px` }">
        <a-layout-sider
          v-model:collapsed="collapsed"
          class="absolute! inset-y-0 left-0 z-10"
          :width="SIDER_WIDTH"
          :collapsed-width="SIDER_COLLAPSED_WIDTH"
          collapsible
          breakpoint="lg"
        >
          <!-- Routes with child pages (BiS Tracker) become submenus -->
          <a-menu v-model:open-keys="menuOpenKeys" class="h-full" mode="inline" :selected-keys="[String(route.name)]" @click="onMenuClick">
            <template v-for="item in menuItems" :key="String(item.name)">
              <a-sub-menu v-if="item.pages.length" :key="String(item.name)">
                <template v-if="item.meta.menuIcon" #icon><component :is="item.meta.menuIcon" /></template>
                <template #title>
                  {{ item.meta.menuLabel }}
                </template>
                <a-menu-item v-for="page in item.pages" :key="String(page.name)">
                  <template v-if="page.meta?.menuIcon" #icon><component :is="page.meta?.menuIcon" /></template>
                  {{ page.meta?.menuLabel }}
                </a-menu-item>
              </a-sub-menu>
              <a-menu-item v-else :key="String(item.name)">
                <template v-if="item.meta.menuIcon" #icon><component :is="item.meta.menuIcon" /></template>
                {{ item.meta.menuLabel }}
              </a-menu-item>
            </template>
          </a-menu>
        </a-layout-sider>
      </div>

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
import { DownOutlined, IdcardOutlined, LogoutOutlined, SettingOutlined, UserOutlined } from '@ant-design/icons-vue'
import { useAuthStore } from '@/stores/authStore'
import { useProfileStore } from '@/stores/profileStore'
import ProfileModal from './ProfileModal.vue'
import { useHuntTrainsStore } from '@/stores/huntTrainsStore'
import { usePluginStore } from '@/stores/pluginStore'
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

// Whether the side menu is collapsed to icons, remembered across visits
const SIDER_COLLAPSED_KEY = 'sider-collapsed'
function savedCollapsed() {
  try {
    return localStorage.getItem(SIDER_COLLAPSED_KEY) === '1'
  } catch {
    return false
  }
}
const collapsed = ref(savedCollapsed())

// Room the page leaves for the sider. Collapsing gives the page its room back at once (the sider shrinks over it);
// expanding takes it only after the sider's 0.2s animation (the sider grows over it), so there's never a gap.
const SIDER_WIDTH = 200
const SIDER_COLLAPSED_WIDTH = 80
const reservedWidth = ref(collapsed.value ? SIDER_COLLAPSED_WIDTH : SIDER_WIDTH)
let expandTimer: ReturnType<typeof setTimeout> | undefined

watch(collapsed, (value) => {
  clearTimeout(expandTimer)
  if (value) reservedWidth.value = SIDER_COLLAPSED_WIDTH
  else expandTimer = setTimeout(() => (reservedWidth.value = SIDER_WIDTH), 200)
  try {
    localStorage.setItem(SIDER_COLLAPSED_KEY, value ? '1' : '0')
  } catch {
    // Storage unavailable: it just isn't remembered
  }
})

// Collapsed, the menu shows submenus as pop-outs, which it also takes from the open keys. They get their own keys,
// none open to begin with, so the expanded menu's open submenus don't all pop out at once; and they close again
// when the sider collapses or a page is picked.
const popupOpenKeys = ref<string[]>([])
const menuOpenKeys = computed({
  get: () => (collapsed.value ? popupOpenKeys.value : openKeys.value),
  set: (keys: string[]) => {
    if (collapsed.value) popupOpenKeys.value = keys
    else openKeys.value = keys
  },
})
watch(collapsed, () => (popupOpenKeys.value = []))

auth.ensureLoaded()

// Started here, not by the pages that show its data, so whatever the game plugin sent reaches the stock and weekly checklist
usePluginStore()

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
  else if (key === 'settings') router.push({ name: 'settings' })
  else if (key === 'logout') void onLogout()
}

async function onLogout() {
  await auth.logout()
  if (route.meta.requiresAuth) router.push({ name: 'login', query: { redirect: route.fullPath } })
}

function onMenuClick({ key }: { key: string | number }) {
  popupOpenKeys.value = []
  router.push({ name: String(key) })
}
</script>
