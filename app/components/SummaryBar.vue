<script setup lang="ts">
const { prs, me, forest, matches, toApproveByMe, reviewRequested, blocking, st, setAllFolded } = useStacks()
const { t } = useI18n()
const visible = computed(() => prs.value.filter(matches).length)
const stacks = computed(() => forest.value.bands.filter(b => b.kind === 'stack').length)
const conflicts = computed(() => prs.value.filter(blocking).length)
const draftConflicts = computed(() => prs.value.filter(p => p.draft && p.conflict).length)
const toApprove = computed(() => prs.value.filter(toApproveByMe).length)
const requested = computed(() => prs.value.filter(reviewRequested).length)
const threads = computed(() => prs.value.filter(p => p.author === me.value).reduce((a, p) => a + p.threads.length, 0))
const allFolded = computed(() => forest.value.bands.length > 0 && forest.value.bands.every(b => st.collapsed.has(b.key)))
</script>

<template>
  <div class="summary">
    <h1>{{ t('summary.open', { n: visible }, visible) }}</h1>
    <i18n-t keypath="summary.stacks" tag="span" :plural="stacks" scope="global"><template #n><b>{{ stacks }}</b></template></i18n-t>
    <i18n-t v-if="conflicts" keypath="summary.conflicts" tag="span" class="alarm" scope="global"><template #n><b>{{ conflicts }}</b></template></i18n-t>
    <Tip v-if="draftConflicts" :text="t('summary.draftConflictsTip')">
      <i18n-t keypath="summary.draftConflicts" tag="span" class="soft-alarm" :plural="draftConflicts" scope="global"><template #n><b>{{ draftConflicts }}</b></template></i18n-t>
    </Tip>
    <Tip :text="t('summary.toApproveTip')">
      <i18n-t keypath="summary.toApprove" tag="span" class="attn" scope="global"><template #n><b>{{ toApprove }}</b></template></i18n-t>
    </Tip>
    <i18n-t keypath="summary.requested" tag="span" :plural="requested" scope="global"><template #n><b>{{ requested }}</b></template></i18n-t>
    <i18n-t keypath="summary.threads" tag="span" :plural="threads" scope="global"><template #n><b>{{ threads }}</b></template></i18n-t>
    <Tip v-if="forest.bands.length" :text="t(allFolded ? 'summary.expandAllTip' : 'summary.collapseAllTip')">
      <button class="fold-all" @click="setAllFolded(!allFolded)"><Icon name="chev" />{{ t(allFolded ? 'summary.expandAll' : 'summary.collapseAll') }}</button>
    </Tip>
  </div>
</template>
