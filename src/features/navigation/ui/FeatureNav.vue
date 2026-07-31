<template>
  <div class="feature-nav-wrap shadow-sm">
    <div id="feature-nav" class="feature-nav container-xl py-2 d-flex gap-2 align-items-center">
      <div class="brand-sigil" aria-hidden="true">
        <img
          v-if="brandIconVisible"
          class="brand-sigil-image"
          :src="brandIconSrc"
          alt=""
          @error="handleBrandIconError"
        >
        <span v-else class="brand-sigil-fallback">*</span>
      </div>
      <div class="brand-name me-auto">Coder Online Tools Lab</div>
      <button
        id="btn-feature-home"
        class="feature-tab btn btn-sm"
        :class="isHomeRoute ? 'btn-primary active' : 'btn-outline-primary'"
        type="button"
        :aria-pressed="isHomeRoute ? 'true' : 'false'"
        @click="goHome"
      >
        首页
      </button>
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
        id="btn-feature-can-arch"
        class="feature-tab btn btn-sm"
        :class="isCanArchRoute ? 'btn-primary active' : 'btn-outline-primary'"
        type="button"
        :aria-pressed="isCanArchRoute ? 'true' : 'false'"
        @click="goCanArch"
      >
        CAN架构
      </button>
      <button
        id="btn-feature-wenyan"
        class="feature-tab btn btn-sm"
        :class="isWenyanRoute ? 'btn-primary active' : 'btn-outline-primary'"
        type="button"
        :aria-pressed="isWenyanRoute ? 'true' : 'false'"
        @click="goWenyan"
      >
        文言编程
      </button>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';

const route = useRoute();
const router = useRouter();
const brandIconVisible = ref(true);
const basePath = String(import.meta.env.BASE_URL || '/');
const normalizedBasePath = basePath.endsWith('/') ? basePath : `${basePath}/`;
const brandIconCandidates = [
  `${normalizedBasePath}brand-forklift.jpg`,
  `${normalizedBasePath}brand-forklift.jpeg`,
  `${normalizedBasePath}brand-forklift.png`,
  `${normalizedBasePath}brand-forklift.svg`,
];
const brandIconIndex = ref(0);
const brandIconSrc = computed(() => brandIconCandidates[brandIconIndex.value] || '');

const isHomeRoute = computed(() => route.path === '/home' || route.path === '/');
const isWenyanRoute = computed(() => route.path === '/wenyan');
const isChartRoute = computed(() => route.path === '/chart');
const isCanArchRoute = computed(() => route.path === '/can-arch');

function goHome() {
  if (!isHomeRoute.value) {
    router.push('/home');
  }
}

function goChart() {
  if (!isChartRoute.value) {
    router.push('/chart');
  }
}

function goCanArch() {
  if (!isCanArchRoute.value) {
    router.push('/can-arch');
  }
}

function goWenyan() {
  if (!isWenyanRoute.value) {
    router.push('/wenyan');
  }
}

function handleBrandIconError() {
  if (brandIconIndex.value < brandIconCandidates.length - 1) {
    brandIconIndex.value += 1;
    return;
  }
  brandIconVisible.value = false;
}
</script>
