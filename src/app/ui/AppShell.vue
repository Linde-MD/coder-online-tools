<template>
  <div class="theme-warm-editorial">
    <FeatureNav />
    <RouterView v-slot="{ Component }">
      <KeepAlive>
        <component :is="Component" />
      </KeepAlive>
    </RouterView>
  </div>
</template>

<script setup>
import { KeepAlive } from 'vue';
import { RouterView } from 'vue-router';
import { FeatureNav } from '@/features/navigation';
</script>
