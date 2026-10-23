import type { GhStatus, PullRequest } from '#shared/types/pr'
import type { DesktopCommand } from '~/types/desktop'

type Translate = ReturnType<typeof useI18n>['t']
export const THEMES = ['system', 'light', 'dark'] as const
export type Theme = typeof THEMES[number]
export const NOTIFY_KINDS = ['requested', 'approve', 'changes'] as const
export type NotifyKind = typeof NOTIFY_KINDS[number]

const bridge = () => (import.meta.client ? window.desktop : undefined)

const ds = reactive({
  theme: 'system' as Theme,
  notify: true,
  notifyKinds: new Set<NotifyKind>(NOTIFY_KINDS),
  badge: true,
  closeToTray: true,
  openAtLogin: false,
  // false on a Linux desktop without a notification area (stock GNOME)
  trayHost: true,
  version: '',
  gh: null as GhStatus | null,
  ghChecking: false,
})

let t: Translate = ((key: string) => key) as Translate

let ghCheck: Promise<GhStatus> | null = null
function checkGh() {
  ghCheck ??= (async () => {
    ds.ghChecking = true
    try {
      ds.gh = await $fetch<GhStatus>('/api/gh')
    }
    catch (e) {
      ds.gh = { state: 'error', detail: (e as Error).message }
    }
    finally {
      ds.ghChecking = false
      ghCheck = null
    }
    return ds.gh
  })()
  return ghCheck
}

function setTheme(v: Theme) {
  const { ls, toast } = useStacks()
  ds.theme = v
  ls.set('stacks-theme', v)
  toast(t('options.themeSet', { name: t(`options.themes.${v}`) }), undefined, 'ok')
}
function setNotify(on: boolean) {
  ds.notify = on
  useStacks().ls.set('stacks-notify', on ? 'on' : 'off')
}
function setNotifyKind(k: NotifyKind, on: boolean) {
  if (on) ds.notifyKinds.add(k)
  else ds.notifyKinds.delete(k)
  useStacks().ls.set('stacks-notify-kinds', JSON.stringify([...ds.notifyKinds]))
}
function setBadge(on: boolean) {
  ds.badge = on
  useStacks().ls.set('stacks-badge', on ? 'on' : 'off')
}
function testNotification() {
  new Notification('PR Stacks', { body: t('notify.test'), icon: '/icon.png' }).onclick = () => bridge()?.show()
}
async function setAppPref(patch: { closeToTray?: boolean, openAtLogin?: boolean }) {
  const res = await bridge()?.setPrefs(patch)
  if (res) Object.assign(ds, res)
}

const kindOf = (p: PullRequest): NotifyKind => useStacks().forMe(p) ?? 'changes'
function notify(all: PullRequest[]) {
  const list = all.filter(p => ds.notifyKinds.has(kindOf(p)))
  if (!ds.notify || !list.length || typeof Notification === 'undefined') return
  const { st } = useStacks()
  const one = list.length === 1 ? list[0]! : null
  const n = new Notification(one ? `${one.id} · ${one.title}` : t('notify.many', { n: list.length }), {
    body: one ? t(`notify.${kindOf(one)}`) : list.slice(0, 4).map(p => `${p.id} · ${p.title}`).join('\n'),
    icon: '/icon.png',
  })
  n.onclick = () => {
    bridge()?.show()
    if (one) st.sel = one.id
    else st.quick = 'new'
  }
}

let started = false
function startDesktop(translate: Translate, onCommand: (cmd: DesktopCommand) => void) {
  t = translate
  if (started) return
  started = true
  const { ls, snap, prs, pulseClass, st, refresh } = useStacks()
  const b = bridge()
  const root = document.documentElement
  if (b) root.dataset.platform = b.platform

  const saved = ls.get('stacks-theme') as Theme
  ds.theme = THEMES.includes(saved) ? saved : 'system'
  ds.notify = ls.get('stacks-notify') !== 'off'
  ds.badge = ls.get('stacks-badge') !== 'off'
  try {
    const kinds = JSON.parse(ls.get('stacks-notify-kinds') ?? 'null') as NotifyKind[] | null
    if (Array.isArray(kinds)) ds.notifyKinds = new Set(kinds.filter(k => NOTIFY_KINDS.includes(k)))
  }
  catch { /* keep every kind */ }
  watchEffect(() => {
    if (ds.theme === 'system') root.removeAttribute('data-theme')
    else root.setAttribute('data-theme', ds.theme)
    // native bits (window buttons, menus, dialogs) follow the same theme
    b?.setTheme(ds.theme)
  })
  b?.info().then(i => Object.assign(ds, { version: i.version, closeToTray: i.closeToTray, openAtLogin: i.openAtLogin, trayHost: i.trayHost }))
  b?.onCommand(onCommand)

  // gh: checked at launch, after a failed sync, and when coming back to the window while it is not ready
  // (typically after running `gh auth login` in a terminal).
  checkGh()
  watch(() => st.loadError, (err) => {
    if (err && err !== 'no-repos') checkGh()
  })
  // a sync went through while gh was reported broken (e.g. the launch check timed out)
  watch(() => st.lastSync, () => {
    if (ds.gh && ds.gh.state !== 'ok') checkGh()
  })
  window.addEventListener('focus', async () => {
    if (!ds.gh || ds.gh.state === 'ok') return
    if ((await checkGh())?.state === 'ok' && st.loadError) refresh()
  })

  // Tray / dock badge with the PRs that want attention, and a notification for those that just started to.
  const hot = computed(() => prs.value.filter(p => pulseClass(p)))
  watchEffect(() => {
    const n = ds.badge ? hot.value.length : 0
    b?.setAttention(n, n ? t('notify.tray', { n }, n) : '')
  })
  // The first snapshot (and the first after the tracked repos change) only records what already wants
  // attention: notifications are for PRs that start to.
  let notified: Set<string> | null = null
  watch(() => st.settings?.repos.join(), () => {
    notified = null
  })
  watch(snap, (s) => {
    if (!s) return
    const ids = new Set(hot.value.map(p => p.id))
    if (notified) notify(hot.value.filter(p => !notified!.has(p.id)))
    notified = ids
  })
}

export function useDesktop() {
  return { ds, desktop: bridge, checkGh, setTheme, setNotify, setNotifyKind, setBadge, testNotification, setAppPref, startDesktop }
}
