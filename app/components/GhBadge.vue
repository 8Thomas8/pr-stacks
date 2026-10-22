<script setup lang="ts">
const { ds } = useDesktop()
const { openPrefs } = useStacks()
const { t } = useI18n()

const state = computed(() => (ds.gh ? ds.gh.state : 'checking'))
const tip = computed(() => {
  const g = ds.gh
  if (!g) return t('gh.checking')
  if (g.state === 'ok') return t('gh.okTip', { login: g.login, host: g.host, version: g.version })
  return `${t(`gh.state.${g.state}`)}. ${t('gh.fixTip')}`
})
const label = computed(() => `GitHub CLI: ${ds.gh ? t(`gh.short.${ds.gh.state}`) : t('gh.checking')}`)
</script>

<template>
  <Tip :text="tip" side="bottom">
    <button class="gh-chip" :data-s="state" :aria-label="label" @click="openPrefs('github')">
      <span class="gh-dot"></span>
      <span class="mono">gh</span>
      <span v-if="ds.gh?.state === 'ok'" class="gh-login">{{ ds.gh.login }}</span>
      <span v-else-if="ds.gh" class="gh-login">{{ t(`gh.short.${ds.gh.state}`) }}</span>
    </button>
  </Tip>
</template>
