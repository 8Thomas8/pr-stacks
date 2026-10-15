<script setup lang="ts">
import type { PullRequest } from '#shared/types/pr'

const props = defineProps<{ pr: PullRequest }>()
const { forMe } = useStacks()
const { t } = useI18n()
const kind = computed(() => forMe(props.pr))
</script>

<template>
  <Tip v-if="kind" :text="t(`card.forMe.${kind}Tip`)">
    <span class="forme"><Icon name="review" />{{ t(`card.forMe.${kind}`) }}</span>
  </Tip>
</template>
