<template>
  <div class="feature-nav-wrap shadow-sm">
    <div id="feature-nav" class="feature-nav container-xl py-2 d-flex gap-2 align-items-center">
      <div class="brand-sigil" aria-hidden="true">*</div>
      <div class="brand-name me-auto">Coder Online Tools Lab</div>
      <button
        id="btn-feature-chart"
        class="feature-tab btn btn-sm"
        :class="isChartRoute ? 'btn-primary active' : 'btn-outline-primary'"
        type="button"
        :aria-pressed="isChartRoute ? 'true' : 'false'"
        @click="goChart"
      >
        曲线图
      </button>
      <button
        id="btn-feature-j1939"
        class="feature-tab btn btn-sm"
        :class="isJ1939Route ? 'btn-primary active' : 'btn-outline-primary'"
        type="button"
        :aria-pressed="isJ1939Route ? 'true' : 'false'"
        @click="goJ1939"
      >
        J1939 PGN/ID互转
      </button>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';

const route = useRoute();
const router = useRouter();

const isJ1939Route = computed(() => route.path === '/j1939');
const isChartRoute = computed(() => !isJ1939Route.value);

function goChart() {
  if (!isChartRoute.value) {
    router.push('/chart');
  }
}

function goJ1939() {
  if (!isJ1939Route.value) {
    router.push('/j1939');
  }
}
</script>
