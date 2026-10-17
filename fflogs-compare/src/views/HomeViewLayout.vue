<template>
  <a-layout class="h-screen">
    <a-layout-header>FFXIV COMPANION</a-layout-header>
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

const router = useRouter()
const route = useRoute()
const menuItems = router.getRoutes().filter((r) => r.meta.menuLabel)

function onMenuClick({ key }: { key: string | number }) {
  router.push({ name: String(key) })
}
</script>
