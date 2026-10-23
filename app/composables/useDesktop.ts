import type { GhStatus, Inbox, InboxItem, PullRequest } from '#shared/types/pr'
import type { DesktopCommand } from '~/types/desktop'
import type { MineAlert } from '~/utils/alerts'

type Translate = ReturnType<typeof useI18n>['t']
export const THEMES = ['system', 'light', 'dark'] as const
export type Theme = typeof THEMES[number]
// review: PRs waiting for my review · mine: my own PRs, both seen between two syncs · inbox: GitHub notifications
export const NOTIFY_GROUPS = {
  review: ['requested', 'approve'],
  mine: ['approved', 'changes', 'comments', 'ci', 'conflict', 'parent'],
  inbox: ['mention', 'merged', 'assign', 'elsewhere'],
} as const
export type NotifyGroup = keyof typeof NOTIFY_GROUPS
export type NotifyKind = typeof NOTIFY_GROUPS[NotifyGroup][number]
export const NOTIFY_KINDS: NotifyKind[] = Object.values(NOTIFY_GROUPS).flat()

const bridge = () => (import.meta.client ? window.desktop : undefined)

const ds = reactive({
  theme: 'system' as Theme,
  notify: true,
  notifyKinds: new Set<NotifyKind>(NOTIFY_KINDS),
  // clicking a GitHub notification marks it read on GitHub too
  inboxRead: true,
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
  // the kinds turned off are stored, so kinds added later start on
  useStacks().ls.set('stacks-notify-off', JSON.stringify(NOTIFY_KINDS.filter(x => !ds.notifyKinds.has(x))))
}
function setInboxRead(on: boolean) {
  ds.inboxRead = on
  useStacks().ls.set('stacks-inbox-read', on ? 'on' : 'off')
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

interface Alert {
  ref: string
  title: string
  body: string
  open: () => void
  // also highlighted in the New view
  hot?: boolean
}
function send(list: Alert[]) {
  if (!ds.notify || !list.length || typeof Notification === 'undefined') return
  const one = list.length === 1 ? list[0]! : null
  const n = new Notification(one ? `${one.ref} · ${one.title}` : t('notify.many', { n: list.length }), {
    body: one ? one.body : list.slice(0, 4).map(a => `${a.ref} · ${a.body}`).join('\n'),
    icon: '/icon.png',
  })
  n.onclick = () => {
    if (one) return one.open()
    bridge()?.show()
    if (list.every(a => a.hot)) useStacks().st.quick = 'new'
  }
}
function prAlert(p: PullRequest, body: string, hot = false): Alert {
  return {
    ref: p.id, title: p.title, body, hot,
    open: () => {
      bridge()?.show()
      useStacks().st.sel = p.id
    },
  }
}
function mineText(a: MineAlert) {
  const who = (a.who ?? []).map(l => useStacks().person(l).n).join(', ')
  return t(`notify.${a.kind}`, { who, base: a.pr.base, parent: a.parent ?? '' })
}

/* GitHub notifications, polled at the pace GitHub asks for (a 304 costs no rate limit) */
const inbox = { seen: null as Map<string, string> | null, since: null as string | null }
const inboxOn = () => ds.notify && NOTIFY_GROUPS.inbox.some(k => ds.notifyKinds.has(k))
function inboxKind(i: InboxItem): NotifyKind | null {
  switch (i.reason) {
    case 'mention':
    case 'team_mention': return 'mention'
    case 'state_change': return i.state === 'merged' || i.state === 'closed' ? 'merged' : null
    case 'assign': return 'assign'
    // reviews and comments on tracked repositories already come from the sync
    default: return useStacks().st.settings?.repos.some(r => r.toLowerCase() === i.slug.toLowerCase()) ? null : 'elsewhere'
  }
}
function inboxAlert(i: InboxItem): Alert {
  return {
    ref: `${i.slug.split('/')[1]}#${i.num}`, title: i.title,
    body: t(`notify.gh.${i.reason === 'state_change' ? i.state : i.reason}`),
    open: () => {
      if (ds.inboxRead) $fetch('/api/inbox', { method: 'POST', body: { read: i.id } }).catch(() => {})
      const { prs, st } = useStacks()
      const p = prs.value.find(x => x.num === i.num && x.slug.toLowerCase() === i.slug.toLowerCase())
      if (!p) return void window.open(i.url, '_blank', 'noopener')
      bridge()?.show()
      st.sel = p.id
    },
  }
}
async function pollInbox() {
  let wait = 60
  if (!inboxOn()) {
    // turned back on later: start over from what is unread then
    inbox.seen = null
    inbox.since = null
  }
  else {
    try {
      const res = await $fetch<Inbox>('/api/inbox', { query: inbox.since ? { since: inbox.since } : {} })
      wait = res.poll
      if (res.modified) {
        // the first answer only records what is already unread
        const seen = inbox.seen
        inbox.seen = new Map(res.items.map(i => [i.id, i.updatedAt]))
        inbox.since = res.lastModified
        if (seen) {
          send(res.items.filter((i) => {
            const k = inboxKind(i)
            return k && ds.notifyKinds.has(k) && seen.get(i.id) !== i.updatedAt
          }).map(inboxAlert))
        }
      }
    }
    catch { /* gh not ready or offline: next round */ }
  }
  setTimeout(pollInbox, wait * 1000)
}

let started = false
function startDesktop(translate: Translate, onCommand: (cmd: DesktopCommand) => void) {
  t = translate
  if (started) return
  started = true
  const { ls, snap, prs, pulseClass, forMe, st, refresh } = useStacks()
  const b = bridge()
  const root = document.documentElement
  if (b) root.dataset.platform = b.platform

  const saved = ls.get('stacks-theme') as Theme
  ds.theme = THEMES.includes(saved) ? saved : 'system'
  ds.notify = ls.get('stacks-notify') !== 'off'
  ds.badge = ls.get('stacks-badge') !== 'off'
  ds.inboxRead = ls.get('stacks-inbox-read') !== 'off'
  try {
    let off = JSON.parse(ls.get('stacks-notify-off') ?? 'null') as NotifyKind[] | null
    // before: the kinds turned on, out of the first three
    const on = JSON.parse(ls.get('stacks-notify-kinds') ?? 'null') as string[] | null
    if (!off && Array.isArray(on)) off = (['requested', 'approve', 'changes'] as const).filter(k => !on.includes(k))
    if (Array.isArray(off)) ds.notifyKinds = new Set(NOTIFY_KINDS.filter(k => !off.includes(k)))
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

  // Tray / dock badge with the PRs that want attention. Notifications: PRs that just started to wait for my
  // review, and what changed on my own PRs since the last sync.
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
  watch(snap, (s, old) => {
    if (!s) return
    const ids = new Set(hot.value.map(p => p.id))
    if (notified && old) {
      const review = hot.value.filter(p => !notified!.has(p.id) && forMe(p) && ds.notifyKinds.has(forMe(p)!))
      send([
        ...review.map(p => prAlert(p, t(`notify.${forMe(p)}`), true)),
        ...mineAlerts(old, s).filter(a => ds.notifyKinds.has(a.kind)).map(a => prAlert(a.pr, mineText(a))),
      ])
    }
    notified = ids
  })
  setTimeout(pollInbox, 5000)
}

export function useDesktop() {
  return { ds, desktop: bridge, checkGh, setTheme, setNotify, setNotifyKind, setInboxRead, setBadge, testNotification, setAppPref, startDesktop }
}
