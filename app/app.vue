<script setup lang="ts">
import type { DesktopCommand } from '~/types/desktop'
import { ToastClose, ToastDescription, ToastProvider, ToastRoot, ToastTitle, ToastViewport, TooltipProvider } from 'reka-ui'

const { st, ls, start, refresh, setView, setFocus, dropToast, useTranslate, openPrefs } = useStacks()
const { desktop, startDesktop } = useDesktop()
const { t, locale, locales, setLocale } = useI18n()
useTranslate(t)
const savedLang = ls.get('stacks-lang')
if (savedLang !== locale.value && locales.value.some(l => l.code === savedLang)) setLocale(savedLang as typeof locale.value)
watchEffect(() => {
  document.documentElement.lang = locale.value
  desktop()?.setLang(locale.value)
})
watchEffect(() => {
  if (st.density === 'comfortable') delete document.documentElement.dataset.density
  else document.documentElement.dataset.density = st.density
})
const toolbar = ref<{ focusSearch: () => void }>()

function command(cmd: DesktopCommand) {
  if (cmd === 'refresh') refresh()
  else if (cmd === 'preferences') openPrefs()
  else if (cmd === 'gh') openPrefs('github')
  else if (cmd === 'search') toolbar.value?.focusSearch()
  else if (cmd === 'view:graph') setView('graph')
  else if (cmd === 'view:list') setView('list')
}
// Ctrl on Windows/Linux, Cmd on macOS (the macOS menu only displays these shortcuts).
// Digits by physical key (`code`): on AZERTY the digit row gives & é…; letters follow the layout.
const LETTERS: Record<string, DesktopCommand> = { 'r': 'refresh', 'f': 'search', ',': 'preferences' }
const DIGITS: Record<string, DesktopCommand> = { 1: 'view:graph', 2: 'view:list' }
const digit = (e: KeyboardEvent) => DIGITS[e.code.replace(/^(Digit|Numpad)/, '')]

function onKey(e: KeyboardEvent) {
  if ((desktop()?.platform === 'darwin' ? e.metaKey : e.ctrlKey) && !e.altKey && !e.shiftKey) {
    const cmd = LETTERS[e.key.toLowerCase()] ?? digit(e)
    if (cmd) {
      e.preventDefault()
      command(cmd)
    }
    return
  }
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
  else if (digit(e)) command(digit(e)!)
  else if (e.key === 'Escape' && !e.repeat && st.focus && !document.querySelector('[data-dismissable-layer]')) setFocus(null)
}
onMounted(() => {
  start(t)
  startDesktop(t, command)
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
      <PreferencesDialog />
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
