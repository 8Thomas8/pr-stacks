<script setup lang="ts">
const props = defineProps<{ body: string, bare?: boolean }>()
const { t } = useI18n()
const html = computed(() => renderMarkdown(props.body, { suggestion: t('md.suggestion') }))
</script>

<template>
  <!-- eslint-disable-next-line vue/no-v-html -->
  <div class="md" :class="{ 'body-text': !bare }" v-html="html"></div>
</template>
