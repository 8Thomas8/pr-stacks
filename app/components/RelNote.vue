<script setup lang="ts">
import type { PullRequest } from '#shared/types/pr'
import type { Rel } from '~/utils/stacks'

defineProps<{ rel: Rel, pr: PullRequest, parent?: PullRequest }>()
const { t } = useI18n()
</script>

<template>
  <Tip v-if="rel.k === 'behind'">
    <div class="note behind"><Icon name="behind" />{{ t('card.behind', { target: parent ? `#${parent.num}` : pr.base }) }}</div>
    <template #content>
      <code>mergeStateStatus = BEHIND</code><br />
      <i18n-t keypath="card.behindTip" scope="global"><template #base><code>{{ pr.base }}</code></template></i18n-t>
    </template>
  </Tip>
  <Tip v-else-if="rel.k === 'dep'">
    <div class="note"><i class="sd" :data-s="rel.o.draft ? 'draft' : 'open'" role="img" :aria-label="t(`linkState.${rel.o.draft ? 'draft' : 'open'}`)"></i>{{ t('card.waits') }}&nbsp;<PrLink :pr="rel.o">{{ rel.o.id }}</PrLink>&nbsp;· {{ t(`status.${rel.o.status}.l`) }}</div>
    <template #content>{{ t('card.depTip') }}<br />{{ rel.o.title }}</template>
  </Tip>
  <Tip v-else-if="rel.k === 'block'">
    <div class="note"><i class="sd" :data-s="rel.o.draft ? 'draft' : 'open'" role="img" :aria-label="t(`linkState.${rel.o.draft ? 'draft' : 'open'}`)"></i>{{ t('card.blocks') }}&nbsp;<PrLink :pr="rel.o">{{ rel.o.id }}</PrLink></div>
    <template #content>{{ t('card.blocksTip', { id: rel.o.id }) }}<br />{{ rel.o.title }}</template>
  </Tip>
  <Tip v-else-if="rel.k === 'link'">
    <div class="note ext" :class="{ merged: rel.l.state === 'merged' }" :data-s="rel.l.state"><i class="sd" :data-s="rel.l.state" role="img" :aria-label="t(`linkState.${rel.l.state}`)"></i>{{ t('card.mentions') }}&nbsp;<a class="lnk" :href="rel.l.url" target="_blank" rel="noopener" @click.stop>{{ rel.l.ref }}</a><template v-if="rel.l.state !== 'open'">&nbsp;· {{ t(`linkState.${rel.l.state}`) }}</template></div>
    <template #content>{{ t('card.depTip') }} · <b>{{ t(`linkState.${rel.l.state}`) }}</b><br />{{ rel.l.title }}</template>
  </Tip>
</template>
