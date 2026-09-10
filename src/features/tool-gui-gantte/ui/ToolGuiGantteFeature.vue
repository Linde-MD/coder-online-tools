<template>
  <main class="tool-gui-gantte-shell" aria-label="PlantUML Gantt Studio">
    <iframe
      class="tool-gui-gantte-frame"
      title="PlantUML Gantt Studio"
      :src="toolUrl"
      loading="eager"
    />
  </main>
</template>

<script setup>
const basePath = String(import.meta.env.BASE_URL || '/');
const normalizedBasePath = basePath.endsWith('/') ? basePath : `${basePath}/`;
const toolUrl = `${normalizedBasePath}tool-gui-gantte/index.html`;
</script>

<style scoped>
.tool-gui-gantte-shell {
  height: calc(100vh - 58px);
  min-height: 640px;
  background: #f4f7fb;
}

.tool-gui-gantte-frame {
  display: block;
  width: 100%;
  height: 100%;
  border: 0;
  background: #ffffff;
}

@media (max-width: 768px) {
  .tool-gui-gantte-shell {
    height: calc(100vh - 112px);
    min-height: 560px;
  }
}
</style>