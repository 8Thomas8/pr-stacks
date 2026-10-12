<script setup lang="ts">
import type { PullRequest } from '#shared/types/pr'
import type { Rel } from '~/utils/stacks'

defineProps<{ rel: Rel, pr: PullRequest, parent?: PullRequest }>()
const { t } = useI18n()
</script>

<template>
  <template v-if="rel.k === 'behind'">{{ t('card.behind', { target: parent ? `#${parent.num}` : pr.base }) }}</template>
  <template v-else-if="rel.k === 'dep'">{{ t('card.waits') }} <b>{{ rel.o.id }}</b> · {{ t(`status.${rel.o.status}.l`) }}</template>
  <template v-else-if="rel.k === 'block'">{{ t('card.blocks') }} <b>{{ rel.o.id }}</b></template>
  <template v-else-if="rel.k === 'link'">{{ t('card.mentions') }} <b>{{ rel.l.ref }}</b> · {{ t(`linkState.${rel.l.state}`) }}</template>
</template>
