<script setup lang="ts">
const { st, byId, repoSlug, setFocus } = useStacks()
const { t } = useI18n()
const root = computed(() => st.focus && byId(st.focus.line[0]!))
</script>

<template>
  <div v-if="st.focus && root" class="focus-bar">
    <b><Icon name="focus" />{{ t('focus.title', { id: st.focus.id }) }}</b>
    <nav>
      <span>{{ repoSlug(root.repo) }} · {{ root.base }}</span>
      <template v-for="id in st.focus.line" :key="id">
        <i aria-hidden="true">›</i>
        <button :aria-current="id === st.focus.id" @click="st.sel = id">{{ id }}</button>
      </template>
    </nav>
    <span>{{ t('focus.count', { n: st.focus.line.length }, st.focus.line.length) }}</span>
    <button class="btn" @click="setFocus(null)"><Icon name="x" />{{ t('focus.exit') }}<kbd>Esc</kbd></button>
  </div>
</template>
