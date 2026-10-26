<script setup lang="ts">
import type { PullRequest } from '#shared/types/pr'

defineProps<{ pr: PullRequest }>()
const { t } = useI18n()
</script>

<template>
  <Tip>
    <slot></slot>
    <template #content>
      <i18n-t keypath="status.tipLine" scope="global">
        <template #label><b>{{ t('status.conflict.l') }}</b></template>
        <template #tip>{{ t('status.conflict.tip') }}</template>
      </i18n-t>
      <br />{{ t('card.base') }} <code>{{ pr.base }}</code>
    </template>
  </Tip>
</template>
