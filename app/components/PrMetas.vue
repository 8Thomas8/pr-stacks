<script setup lang="ts">
import type { PullRequest } from '#shared/types/pr'

const props = defineProps<{ pr: PullRequest }>()
const { sinceLastReview, showCi } = useStacks()
const { t, commits } = useFmt()
const since = computed(() => sinceLastReview(props.pr))
const unresolved = computed(() => props.pr.threads.length)
</script>

<template>
  <div class="metas">
    <Tip v-if="since" :text="t('card.sinceTip', { commits: commits(since) })">
      <span class="warn"><Icon name="commit" />+{{ since }}</span>
    </Tip>
    <Tip :text="t('card.threadsTip', { n: unresolved, total: pr.comments }, unresolved)">
      <span :class="{ bad: unresolved }"><Icon name="thread" />{{ unresolved }}</span>
    </Tip>
    <Tip v-if="showCi" :text="t(`ci.tip.${pr.ci}`)">
      <span><i class="ci" :class="pr.ci"></i></span>
    </Tip>
  </div>
</template>
