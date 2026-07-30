<template>
  <section class="settings-panel">
    <div class="settings-panel-head">
      <div class="settings-panel-head-main">
        <h2 class="settings-panel-title">{{ title }}</h2>
        <p v-if="note" class="settings-panel-note">{{ note }}</p>
      </div>
      <slot name="headAction">
        <button
          type="button"
          class="settings-collapse-btn collapse-triangle-btn"
          aria-label="折叠面板"
          aria-expanded="true"
        ></button>
      </slot>
    </div>
    <div class="settings-panel-body">
      <slot />
    </div>
  </section>
</template>

<script setup>
defineProps({
  title: {
    type: String,
    required: true,
  },
  note: {
    type: String,
    default: '',
  },
});
</script>
