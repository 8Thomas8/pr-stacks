<script setup lang="ts">
const PATHS = {
  thread: '<path d="M2.5 3.5h11v7h-6l-3 2.5v-2.5h-2z"/>',
  commit: '<circle cx="8" cy="8" r="2.6"/><path d="M1.5 8h3.9M10.6 8h3.9"/>',
  conflict: '<path d="M8 2.5l6 10.5H2z"/><path d="M8 6.5v3M8 11.3v.2"/>',
  behind: '<path d="M12.5 5.5A5 5 0 1 0 13 9"/><path d="M13 2.5v3h-3"/>',
  link: '<path d="M6.5 9.5l3-3M7 4.5l1.2-1.2a2.6 2.6 0 0 1 3.7 3.7L10.7 8.2M9 11.5l-1.2 1.2a2.6 2.6 0 0 1-3.7-3.7L5.3 7.8"/>',
  check: '<path d="M3 8.5l3 3 7-7.5"/>',
  review: '<path d="M1.5 8s2.4-4.5 6.5-4.5S14.5 8 14.5 8s-2.4 4.5-6.5 4.5S1.5 8 1.5 8z"/><circle cx="8" cy="8" r="2"/>',
  x: '<path d="M4 4l8 8M12 4l-8 8"/>',
  ext: '<path d="M9 2.5h4.5V7M13.5 2.5L7 9M11.5 9.5v4h-9v-9h4"/>',
  focus: '<circle cx="8" cy="8" r="5.5"/><circle cx="8" cy="8" r="1.8"/>',
  copy: '<rect x="5" y="5" width="8.5" height="8.5" rx="1.5"/><path d="M3 10.5V3.5a1 1 0 0 1 1-1h6.5"/>',
  chev: '<path d="M4 6l4 4 4-4"/>',
  chevL: '<path d="M10 4L6 8l4 4"/>',
  chevR: '<path d="M6 4l4 4-4 4"/>',
  options: '<path d="M2.5 4.5h6M11.5 4.5h2M2.5 11.5h2M7.5 11.5h6"/><circle cx="10" cy="4.5" r="1.5"/><circle cx="6" cy="11.5" r="1.5"/>',
  search: '<circle cx="7" cy="7" r="4.5"/><path d="M10.5 10.5L14 14"/>',
  graph: '<circle cx="3.5" cy="3.5" r="1.8"/><circle cx="3.5" cy="12.5" r="1.8"/><circle cx="12.5" cy="8" r="1.8"/><path d="M3.5 5.3v5.4M5.3 3.5c3 0 3.7 4.5 5.4 4.5"/>',
  list: '<path d="M2.5 4h11M2.5 8h11M2.5 12h11"/>',
  clock: '<circle cx="8" cy="8" r="5.8"/><path d="M8 4.8V8l2.2 1.6"/>',
  refresh: '<path d="M13.5 6A5.8 5.8 0 0 0 3 4.6L2 6M2.5 10A5.8 5.8 0 0 0 13 11.4l1-1.4"/><path d="M2 2.5V6h3.5M14 13.5V10h-3.5"/>',
  system: '<rect x="2" y="3" width="12" height="8" rx="1.5"/><path d="M6 14h4M8 11v3"/>',
  light: '<circle cx="8" cy="8" r="3"/><path d="M8 1.5v1.5M8 13v1.5M1.5 8H3M13 8h1.5M3.4 3.4l1 1M11.6 11.6l1 1M12.6 3.4l-1 1M4.4 11.6l-1 1"/>',
  dark: '<path d="M13.5 9.5A5.5 5.5 0 0 1 6.5 2.5a5.5 5.5 0 1 0 7 7z"/>',
} as const
export type IconName = keyof typeof PATHS
defineProps<{ name: IconName }>()
</script>

<template>
  <!-- eslint-disable-next-line vue/no-v-html -- static paths above -->
  <svg class="i" viewBox="0 0 16 16" aria-hidden="true" v-html="PATHS[name]" />
</template>
