<script setup lang="ts">
const { st, snap, prs } = useStacks()
const { t } = useI18n()
</script>

<template>
  <div v-if="st.loadError === 'no-repos'" class="empty setup">
    <b>{{ t('state.noRepos') }}</b>
    <span>{{ t('state.noReposHint') }}</span>
    <button class="btn primary" @click="st.settingsOpen = true">{{ t('options.settings') }}</button>
  </div>
  <div v-else-if="st.loadError && !snap" class="err">
    <b>{{ t('state.loadFailed') }}</b>
    <code>{{ st.loadError }}</code>
    <i18n-t keypath="state.loadHint" tag="span" scope="global">
      <template #auth><code>gh auth status</code></template>
    </i18n-t>
  </div>
  <i18n-t v-else-if="!snap" keypath="state.loading" tag="div" class="loading" scope="global">
    <template #cmd><code>gh api graphql</code></template>
  </i18n-t>
  <div v-else-if="!prs.length" class="empty">{{ t('state.noPrs') }}</div>
  <div v-else class="empty">{{ t('state.noMatch') }}</div>
</template>
