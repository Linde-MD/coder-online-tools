<template>
  <p v-if="initializationError" class="container-xl text-red-700" role="alert">{{ initializationError }}</p>
  <ChartFeature :active="true" />
</template>

<script setup>
import { ChartFeature } from '@/features/chart';
import { useChartModuleInit } from '@/app/composables/useChartModuleInit.js';

const { initializationError } = useChartModuleInit();
</script>
