<script setup lang="ts">
import type { Band } from '~/utils/stacks'

const props = defineProps<{ band: Band }>()
const { toApproveByMe, reviewRequested, blocking, repoSlug, matches } = useStacks()
const { t } = useI18n()
const items = computed(() => props.band.items.filter(matches))
const conflicts = computed(() => items.value.filter(blocking))
const draftConflicts = computed(() => items.value.filter(p => p.draft && p.conflict))
const forMe = computed(() => items.value.filter(p => toApproveByMe(p) || reviewRequested(p)).length)
const n = computed(() => props.band.items.length)
const hidden = computed(() => n.value - items.value.length)
</script>

<template>
  <Tip>
    <span class="band-kind">{{ t(`band.${band.kind}${hidden ? 'Part' : ''}`, { n, shown: items.length }, n) }}</span>
    <template #content>{{ t(`band.${band.kind}Tip`) }}<template v-if="hidden"><br />{{ t('band.hiddenTip', { n: hidden }, hidden) }}</template></template>
  </Tip>
  <Tip>
    <span class="band-base"><RepoLink :repo="band.base.repo"><b>{{ band.base.repo }}</b></RepoLink><code>{{ band.base.name }}</code></span>
    <template #content>
      <i18n-t keypath="band.baseTip" scope="global"><template #repo><b>{{ repoSlug(band.base.repo) }}</b></template></i18n-t>
    </template>
  </Tip>
  <slot></slot>
  <Tip v-if="conflicts.length">
    <span class="band-alert"><Icon name="conflict" />{{ t('band.alert', { n: conflicts.length }, conflicts.length) }}</span>
    <template #content>{{ t('band.alertTip', { list: conflicts.map(p => `#${p.num}`).join(', ') }) }}<br />{{ t('band.alertTip2') }}</template>
  </Tip>
  <Tip v-if="draftConflicts.length">
    <span class="band-alert soft"><Icon name="conflict" />{{ t('band.draftAlert', { n: draftConflicts.length }, draftConflicts.length) }}</span>
    <template #content>{{ t('band.alertTip', { list: draftConflicts.map(p => `#${p.num}`).join(', ') }) }}<br />{{ t('band.draftAlertTip') }}</template>
  </Tip>
  <Tip v-if="forMe" :text="t('band.forYouTip')">
    <span class="band-attn"><Icon name="review" />{{ t('band.forYou', { n: forMe }, forMe) }}</span>
  </Tip>
</template>
