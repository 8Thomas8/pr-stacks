<script setup lang="ts">
defineProps<{ open: boolean }>()
const { t } = useI18n()
</script>

<template>
  <Tip :text="t(open ? 'band.collapseTip' : 'band.expandTip')">
    <button class="fold-btn" :aria-expanded="open" :aria-label="t(open ? 'band.collapse' : 'band.expand')"><Icon name="chev" /></button>
  </Tip>
</template>
