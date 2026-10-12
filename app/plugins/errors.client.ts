export default defineNuxtPlugin((nuxtApp) => {
  const { toast } = useStacks()
  const t = nuxtApp.$i18n.t
  const show = (e: unknown) => toast(t('sync.unexpected'), String((e as Error)?.message ?? e).slice(0, 120), 'error')
  nuxtApp.hook('vue:error', show)
  window.addEventListener('unhandledrejection', e => show(e.reason))
})
