<template>
  <a-config-provider :theme="{ algorithm: darkAlgorithm }">
    <router-view />
  </a-config-provider>
</template>

<script setup lang="ts">
import { theme } from 'ant-design-vue';
import './assets/main.css'

const { darkAlgorithm } = theme;
</script>

<style scoped></style>
