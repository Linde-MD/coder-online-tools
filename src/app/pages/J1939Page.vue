<template>
  <J1939Feature :active="true" />
</template>

<script setup>
import { J1939Feature } from '@/features/j1939';
import { useJ1939ModuleInit } from '@/app/composables/useJ1939ModuleInit.js';

useJ1939ModuleInit();
</script>
