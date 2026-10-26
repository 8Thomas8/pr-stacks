<script setup lang="ts">
import type { PullRequest } from '#shared/types/pr'
import type { Rel } from '~/utils/stacks'

defineProps<{ rels: Rel[], pr: PullRequest, parent?: PullRequest }>()
</script>

<template>
  <Tip>
    <span class="flag" :class="{ behind: rels.length === 1 && pr.behind }"><Icon :name="rels.length === 1 && pr.behind ? 'behind' : 'link'" />{{ rels.length }}</span>
    <template #content>
      <div v-for="r in rels" :key="relKey(r)"><CardRelLine :rel="r" :parent="parent" :pr="pr" /></div>
    </template>
  </Tip>
</template>
