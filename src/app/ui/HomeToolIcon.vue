<template>
  <svg
    class="home-tool-icon-art"
    viewBox="0 0 48 48"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <template v-if="name === 'network'">
      <path d="M12 24h24M16 19l7-7m9 7-7-7m-9 17 7 7m9-7-7 7" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" />
      <rect x="17" y="18" width="14" height="12" rx="3" fill="currentColor" opacity=".18" />
      <rect x="18" y="19" width="12" height="10" rx="2.5" stroke="currentColor" stroke-width="2" />
      <circle cx="10" cy="24" r="4" fill="currentColor" />
      <circle cx="38" cy="24" r="4" fill="currentColor" />
      <circle cx="24" cy="9" r="4" fill="currentColor" />
      <circle cx="24" cy="39" r="4" fill="currentColor" />
    </template>
    <template v-else-if="name === 'chart'">
      <path d="M9 9v29h31" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
      <path d="m13 31 8-8 6 4 11-13" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
      <circle cx="21" cy="23" r="2.5" fill="currentColor" />
      <circle cx="27" cy="27" r="2.5" fill="currentColor" />
      <circle cx="38" cy="14" r="2.5" fill="currentColor" />
      <path d="m13 31 8-8 6 4 11-13v16H13v1Z" fill="currentColor" opacity=".14" />
    </template>
    <template v-else-if="name === 'code'">
      <path d="M11 9.5h18a5 5 0 0 1 5 5v24H16a5 5 0 0 1-5-5v-24Z" fill="currentColor" opacity=".14" />
      <path d="M11 9.5h18a5 5 0 0 1 5 5v24H16a5 5 0 0 1-5-5v-24Z" stroke="currentColor" stroke-width="2.3" stroke-linejoin="round" />
      <path d="M16 19h8m-8 6h12m-12 6h7" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" />
      <path d="m29 23 4 4-4 4m8-8-4 4 4 4" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" />
    </template>
    <template v-else-if="name === 'git'">
      <path d="M15 12v23m0-14c0-5 8-5 12-5m-12 10c0-5 8-5 12-5" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" />
      <circle cx="15" cy="10" r="4" fill="currentColor" />
      <circle cx="15" cy="36" r="4" fill="currentColor" />
      <circle cx="31" cy="16" r="4" fill="currentColor" />
      <circle cx="31" cy="26" r="4" fill="currentColor" />
      <path d="M15 10v26m16-20v10" stroke="white" stroke-width="1" opacity=".35" />
    </template>
    <template v-else-if="name === 'search'">
      <circle cx="21" cy="21" r="12" fill="currentColor" opacity=".14" />
      <circle cx="21" cy="21" r="10" stroke="currentColor" stroke-width="2.5" />
      <path d="m28.5 28.5 9 9" stroke="currentColor" stroke-width="4" stroke-linecap="round" />
      <circle cx="17.5" cy="19" r="1.5" fill="currentColor" />
      <circle cx="23" cy="17" r="1.5" fill="currentColor" />
      <circle cx="24" cy="23" r="1.5" fill="currentColor" />
      <path d="m18.7 19 3-1.3m-2.8 2.5 4.1 2" stroke="currentColor" stroke-width="1.4" />
    </template>
    <template v-else-if="name === 'book'">
      <path d="M8 13c6-2 11-1 16 3 5-4 10-5 16-3v23c-6-2-11-1-16 3-5-4-10-5-16-3V13Z" fill="currentColor" opacity=".14" />
      <path d="M8 13c6-2 11-1 16 3 5-4 10-5 16-3v23c-6-2-11-1-16 3-5-4-10-5-16-3V13Z" stroke="currentColor" stroke-width="2.3" stroke-linejoin="round" />
      <path d="M24 16v23M13 20c3-.6 5-.3 7 1m-7 5c3-.6 5-.3 7 1m15-7c-3-.6-5-.3-7 1m7 5c-3-.6-5-.3-7 1" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
    </template>
    <template v-else-if="name === 'timeline'">
      <rect x="8" y="11" width="32" height="28" rx="4" fill="currentColor" opacity=".14" />
      <rect x="8" y="11" width="32" height="28" rx="4" stroke="currentColor" stroke-width="2.3" />
      <path d="M8 19h32M16 8v6m16-6v6" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" />
      <path d="M14 25h8v3h-8zm10 5h10v3H24zm-10 5h14v3H14z" fill="currentColor" />
      <path d="M25 25h8v3h-8z" fill="currentColor" opacity=".45" />
    </template>
  </svg>
</template>

<script setup>
defineProps({
  name: {
    type: String,
    required: true,
  },
});
</script>
