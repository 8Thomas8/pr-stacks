<script setup lang="ts">
import type { Band } from '~/utils/stacks'

const props = defineProps<{ band: Band }>()
const { toApproveByMe, reviewRequested, blocking, repoSlug } = useStacks()
const { t } = useI18n()
const conflicts = computed(() => props.band.items.filter(blocking))
const draftConflicts = computed(() => props.band.items.filter(p => p.draft && p.conflict))
const forMe = computed(() => props.band.items.filter(p => toApproveByMe(p) || reviewRequested(p)).length)
const n = computed(() => props.band.items.length)
</script>

<template>
  <Tip v-if="band.kind === 'stack'" :text="t('band.stackTip')">
    <span class="band-kind">{{ t('band.stack', { n }, n) }}</span>
  </Tip>
  <Tip v-else :text="t('band.soloTip')">
    <span class="band-kind">{{ t('band.solo', { n }, n) }}</span>
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
