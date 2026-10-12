<script setup lang="ts">
import type { PullRequest } from '#shared/types/pr'

defineProps<{ pr: PullRequest }>()
</script>

<template>
  <span class="c-ref"><RepoLink :repo="pr.repo" /><PrLink :pr="pr"><b>#{{ pr.num }}</b></PrLink></span>
</template>
