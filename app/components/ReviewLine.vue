<script setup lang="ts">
import type { Review } from '#shared/types/pr'

defineProps<{ review: Review }>()
const { person } = useStacks()
const { t, commits, fmtAt } = useFmt()
</script>

<template>
  <div class="rv">
    <UserAvatar :login="review.by" :review="review" />
    <span class="who">{{ person(review.by).n }}</span>
    <span class="what">{{ t(`verb.${review.s}`) }}</span>
    <span class="when">{{ fmtAt(review.at) }}<em v-if="review.after > 0">{{ t('drawer.since', { commits: commits(review.after) }) }}</em></span>
  </div>
</template>
