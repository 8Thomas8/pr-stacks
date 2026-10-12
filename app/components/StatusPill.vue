<script setup lang="ts">
import type { PrStatus } from '#shared/types/pr'

defineProps<{ status: PrStatus }>()
const { t } = useI18n()
</script>

<template>
  <Tip>
    <span class="pill" :class="`st-${status}`"><slot>{{ t(`status.${status}.l`) }}</slot></span>
    <template #content>
      <i18n-t keypath="status.tipLine" scope="global">
        <template #label><b>{{ t(`status.${status}.l`) }}</b></template>
        <template #tip>{{ t(`status.${status}.tip`) }}</template>
      </i18n-t>
      <template v-if="STATUS_CODE[status]"><br /><code>{{ STATUS_CODE[status] }}</code></template>
    </template>
  </Tip>
</template>
