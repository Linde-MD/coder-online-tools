<template>
  <ChartFeature :active="true" />
</template>

<script setup>
import { ChartFeature } from '@/features/chart';
import { useChartModuleInit } from '@/app/composables/useChartModuleInit.js';

useChartModuleInit();
</script>
