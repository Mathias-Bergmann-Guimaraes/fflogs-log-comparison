<template>
  <a-config-provider :theme="{ algorithm: darkAlgorithm }">
    <home-view></home-view>
  </a-config-provider>
</template>

<script setup lang="ts">
import HomeView from './views/HomeView.vue';
import { theme } from 'ant-design-vue';
import './assets/main.css'

const { darkAlgorithm } = theme;
</script>

<style scoped></style>
