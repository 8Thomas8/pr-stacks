<script setup lang="ts">
import type { Review } from '#shared/types/pr'

const props = defineProps<{ login: string, review?: Review, pop?: boolean }>()
const { person } = useStacks()
const { t, commits, fmtAt } = useFmt()
const p = computed(() => person(props.login))
</script>

<template>
  <Tip>
    <span
      class="av"
      :class="{ img: p.avatar, stale: review && review.after > 0, pop }"
      :style="{ '--h': p.h, 'backgroundImage': p.avatar ? `url('${p.avatar}')` : undefined }"
      :data-s="review?.s ?? ''"
    >{{ p.i }}</span>
    <template #content>
      <b>{{ p.n }}</b>
      <template v-if="!review && p.n !== p.login"> · {{ p.login }}</template>
      <template v-if="review">
        · {{ t(`verb.${review.s}`) }}<template v-if="review.at"> ({{ fmtAt(review.at) }})</template>
        <template v-if="review.after > 0"><br />{{ t('review.redo', { commits: commits(review.after) }) }}</template>
        <template v-else-if="review.s !== 'REQUESTED'"><br />{{ t('review.onLatest') }}</template>
        <template v-if="review.rerequested"><br />{{ t('review.rerequested') }}</template>
      </template>
    </template>
  </Tip>
</template>
