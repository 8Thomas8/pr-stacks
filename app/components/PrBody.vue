<script setup lang="ts">
const props = defineProps<{ body: string }>()
const html = computed(() => renderMarkdown(props.body))
</script>

<template>
  <!-- eslint-disable-next-line vue/no-v-html -->
  <div class="body-text md" v-html="html"></div>
</template>
