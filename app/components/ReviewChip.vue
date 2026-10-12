<script setup lang="ts">
import type { Review } from '#shared/types/pr'

defineProps<{ review: Review, pop?: boolean }>()
const { person } = useStacks()
const { t, commits } = useFmt()
</script>

<template>
  <span class="rvc">
    <UserAvatar :login="review.by" :review="review" :pop="pop" />
    <Tip v-if="review.after > 0" :text="t('review.staleTip', { name: person(review.by).n, commits: commits(review.after) })">
      <b class="rvn">+{{ review.after }}</b>
    </Tip>
  </span>
</template>
