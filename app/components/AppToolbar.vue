<script setup lang="ts">
const { st, repos, every, refresh, setMode, setView, openPrefs } = useStacks()
const { t } = useI18n()
const search = ref<HTMLInputElement>()
defineExpose({ focusSearch: () => search.value?.focus() })

const view = computed({ get: () => st.view, set: setView })
const mode = computed({ get: () => st.mode, set: m => setMode(m) })
const ago = computed(() => {
  if (!st.lastSync) return t('toolbar.loading')
  const s = Math.max(0, Math.round((st.now - st.lastSync) / 1000))
  return s < 60 ? t('toolbar.agoS', { n: s }) : t('toolbar.agoM', { n: Math.floor(s / 60) })
})
const bar = ref<HTMLElement>()
let ro: ResizeObserver | undefined
onMounted(() => {
  ro = new ResizeObserver(() => document.documentElement.style.setProperty('--bar-h', `${bar.value!.getBoundingClientRect().bottom}px`))
  ro.observe(bar.value!, { box: 'border-box' })
})
onBeforeUnmount(() => ro?.disconnect())
const sub = computed(() => (st.mode === 'auto' ? t('toolbar.next', { n: `${Math.floor(st.countdown / 60)}:${String(st.countdown % 60).padStart(2, '0')}` }) : t('toolbar.sub', { repos: t('n.repos', repos.value.length) })))
</script>

<template>
  <div class="progress" :class="{ on: st.refreshing }"></div>
  <header ref="bar" class="bar">
    <div class="brand">
      <svg class="brand-mark" viewBox="0 0 64 64" aria-hidden="true">
        <rect x="24" y="4" width="34" height="26" rx="7" style="fill:var(--ink)" fill-opacity=".22" />
        <rect x="15" y="17" width="34" height="26" rx="7" style="fill:var(--ink)" fill-opacity=".5" />
        <rect x="6" y="30" width="34" height="26" rx="7" style="fill:var(--accent)" />
        <rect x="12" y="37" width="14" height="4" rx="2" style="fill:var(--on-solid)" />
        <rect x="12" y="45" width="22" height="4" rx="2" style="fill:var(--on-solid)" fill-opacity=".6" />
      </svg>
      <span class="brand-name"><span>PR</span> Stacks</span>
    </div>
    <Tip v-if="st.loadError && st.lastSync" :text="st.loadError">
      <span class="example">{{ t('toolbar.syncError') }}</span>
    </Tip>
    <SegToggle
      v-model="view"
      :label="t('toolbar.views')"
      :options="[
        { value: 'graph', label: t('toolbar.graph'), icon: 'graph', tip: t('toolbar.graphTip') },
        { value: 'list', label: t('toolbar.list'), icon: 'list', tip: t('toolbar.listTip') },
      ]"
    />
    <label class="search">
      <Icon name="search" />
      <input ref="search" v-model.trim="st.q" type="text" :placeholder="t('toolbar.search')" autocomplete="off" />
      <Tip :text="t('toolbar.searchTip')"><kbd>/</kbd></Tip>
    </label>
    <div class="spacer"></div>
    <GhBadge />
    <div class="sync" :class="{ auto: st.mode === 'auto' }">
      <SegToggle
        v-model="mode"
        :label="t('toolbar.syncMode')"
        :options="[
          { value: 'manual', label: t('toolbar.manual'), tip: t('toolbar.manualTip') },
          { value: 'auto', label: t('toolbar.auto', { every: every(st.autoS) }), tip: t('toolbar.autoTip', { every: every(st.autoS) }) },
        ]"
      />
      <Tip :text="t('toolbar.syncTip')">
        <div class="sync-meta"><b><span class="live-dot"></span>{{ ago }}</b><span>{{ sub }}</span></div>
      </Tip>
      <Tip :text="t('toolbar.refreshTip')">
        <button class="refresh" :class="{ spin: st.refreshing }" :aria-label="t('toolbar.refresh')" @click="refresh()">
          <svg class="ring" viewBox="0 0 44 44"><circle cx="22" cy="22" r="20" :style="{ strokeDashoffset: st.mode === 'auto' ? 126 * (st.countdown / st.autoS) : 0 }" /></svg>
          <Icon name="refresh" />
        </button>
      </Tip>
    </div>
    <Tip :text="t('prefs.tip')" side="bottom">
      <button class="theme-btn" :aria-label="t('prefs.title')" @click="openPrefs()"><Icon name="options" /></button>
    </Tip>
  </header>
</template>
