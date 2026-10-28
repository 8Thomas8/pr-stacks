<script setup lang="ts">
import type { LinkedPr, PullRequest } from '#shared/types/pr'
import type { Rel } from '~/utils/stacks'

const props = defineProps<{ rels: Rel[], pr: PullRequest, parent?: PullRequest }>()
const { t } = useI18n()
const { showCi } = useStacks()
const links = computed(() => props.rels.flatMap(r => (r.k === 'link' ? [r.l] : [] as LinkedPr[])))
</script>

<template>
  <Tip v-if="links.length > 1">
    <div class="note ext"><Icon name="link" />{{ t('card.mentionsN', { n: links.length }) }}</div>
    <template #content>
      <ul class="mentions">
        <li v-for="l in links" :key="l.url">
          <a :href="l.url" target="_blank" rel="noopener" :class="{ merged: l.state === 'merged' }">
            <i class="sd" :data-s="l.state"></i>
            <b>{{ l.ref }}</b>
            <span v-if="l.state !== 'open'" class="m-state">{{ t(`linkState.${l.state}`) }}</span>
            <span v-if="showCi && l.ci" class="m-ci"><i class="ci" :class="l.ci"></i>{{ t(`ci.label.${l.ci}`) }}</span>
            <span class="m-title">{{ l.title }}</span>
          </a>
        </li>
      </ul>
    </template>
  </Tip>
</template>
