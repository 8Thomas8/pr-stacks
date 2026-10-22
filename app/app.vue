<script setup lang="ts">
import { ToastClose, ToastDescription, ToastProvider, ToastRoot, ToastTitle, ToastViewport, TooltipProvider } from 'reka-ui'

const { st, start, refresh, setView, setFocus, dropToast, useTranslate } = useStacks()
const { t, locale } = useI18n()
useTranslate(t)
watchEffect(() => {
  document.documentElement.lang = locale.value
})
watchEffect(() => {
  if (st.density === 'comfortable') delete document.documentElement.dataset.density
  else document.documentElement.dataset.density = st.density
})
const toolbar = ref<{ focusSearch: () => void }>()

function onKey(e: KeyboardEvent) {
  const t = e.target
  if (t instanceof HTMLElement && t.matches('input, textarea')) {
    if (e.key === 'Escape') t.blur()
    return
  }
  if (e.metaKey || e.ctrlKey || e.altKey) return
  if (st.sel) {
    if (e.key === 'f' || e.key === 'F') {
      setFocus(st.sel)
      st.sel = null
    }
    return
  }
  if (e.key === '/') {
    e.preventDefault()
    toolbar.value?.focusSearch()
  }
  else if (e.key === 'r' || e.key === 'R') refresh()
  else if (e.key === '1') setView('graph')
  else if (e.key === '2') setView('list')
  else if (e.key === 'Escape' && !e.repeat && st.focus && !document.querySelector('[data-dismissable-layer]')) setFocus(null)
}
onMounted(() => {
  start(t)
  document.addEventListener('keydown', onKey)
})
onBeforeUnmount(() => document.removeEventListener('keydown', onKey))
</script>

<template>
  <TooltipProvider :delay-duration="220" :skip-delay-duration="300">
    <ToastProvider :duration="3600" swipe-direction="down">
      <AppToolbar ref="toolbar" />
      <div class="shell">
        <FilterRail />
        <main class="main">
          <SummaryBar />
          <FocusBar />
          <div class="view">
            <StackGraph v-if="st.view === 'graph'" />
            <StackList v-else />
          </div>
        </main>
      </div>
      <PrDrawer />
      <SettingsDialog />
      <ToastRoot v-for="item in st.toasts" :key="item.id" class="toast" :data-kind="item.kind" :type="item.kind === 'error' ? 'foreground' : 'background'" :duration="item.kind === 'error' ? 12000 : undefined" @update:open="(o: boolean) => !o && dropToast(item.id)">
        <span v-if="item.kind !== 'info'" class="toast-i"><Icon :name="item.kind === 'ok' ? 'check' : 'conflict'" /></span>
        <ToastTitle as="span">{{ item.msg }}</ToastTitle>
        <ToastDescription v-if="item.sub" as="span" class="mono">{{ item.sub }}</ToastDescription>
        <ToastClose v-if="item.kind === 'error'" class="toast-x" :aria-label="t('toast.close')"><Icon name="x" /></ToastClose>
      </ToastRoot>
      <ToastViewport class="toasts" />
    </ToastProvider>
  </TooltipProvider>
</template>
