const fullFmts = new Map<string, Intl.DateTimeFormat>()

export function useFmt() {
  const { t, locale } = useI18n()
  const commits = (n: number) => t('n.commits', n)
  function fmtAt(iso?: string) {
    if (!iso) return ''
    const d = new Date(iso)
    if (Date.now() - d.getTime() < 6 * 864e5) {
      return `${d.toLocaleDateString(locale.value, { weekday: 'short' })} ${d.toLocaleTimeString(locale.value, { hour: '2-digit', minute: '2-digit' })}`
    }
    return d.toLocaleDateString(locale.value, { day: 'numeric', month: 'short' })
  }
  function fmtFull(iso: string) {
    let f = fullFmts.get(locale.value)
    if (!f) fullFmts.set(locale.value, f = new Intl.DateTimeFormat(locale.value, { dateStyle: 'full', timeStyle: 'short' }))
    return f.format(new Date(iso))
  }
  function rel(iso: string, now = Date.now()) {
    const s = Math.max(0, (now - Date.parse(iso)) / 1000)
    if (s < 60) return t('time.now')
    if (s < 3600) return t('time.min', { n: Math.floor(s / 60) })
    if (s < 86400) return t('time.h', { n: Math.floor(s / 3600) })
    return t('time.d', { n: Math.floor(s / 86400) })
  }
  const since = (kind: 'opened' | 'updated', iso: string, now = Date.now()) =>
    now - Date.parse(iso) < 60e3 ? t(`dates.${kind}Now`) : t(kind === 'opened' ? 'dates.opened' : 'dates.updatedAgo', { ago: rel(iso, now) })
  return { t, locale, commits, fmtAt, fmtFull, rel, since }
}
