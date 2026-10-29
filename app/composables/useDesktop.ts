import type { GhStatus, Inbox, InboxItem, PullRequest, Snapshot } from '#shared/types/pr'
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
  inbox: true,
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
  // the kinds turned off are stored, so kinds added later start on
  useStacks().ls.set('stacks-notify-off', JSON.stringify(NOTIFY_KINDS.filter(x => !ds.notifyKinds.has(x))))
}
function setInbox(on: boolean) {
  const { ls, st } = useStacks()
  ds.inbox = on
  ls.set('stacks-inbox', on ? 'on' : 'off')
  clearTimeout(inbox.timer)
  Object.assign(inbox, { gen: inbox.gen + 1, seen: null, since: null, rounds: 0, fails: 0 })
  Object.assign(center, { inbox: [], inboxLoaded: false, inboxError: false })
  if (on) pollInbox()
  else if (st.quick === 'gh') st.quick = 'all'
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

// The notification center: every alert the app raised, kept whatever the kinds turned off for system
// notifications, newest first. The text is kept as a message key, so it follows the language.
export interface Notice {
  id: string
  at: string
  kind: NotifyKind
  ref: string
  title: string
  msg: { key: string, params?: Record<string, string>, who?: string[] }
  url: string
  // the PR in the dashboard, or the GitHub notification thread behind it (and its PR)
  pr?: string
  thread?: string
  slug?: string
  num?: number
  read: boolean
}
const KEEP = 200
const center = reactive({
  notices: [] as Notice[],
  // what is unread at github.com/notifications (PRs only), as of the last poll
  inbox: [] as InboxItem[],
  inboxLoaded: false,
  inboxError: false,
})
const unread = computed(() => center.notices.filter(n => !n.read).length)
// the bell: unread alerts plus the GitHub notifications none of them stands for
const bell = computed(() => unread.value + center.inbox.filter(i => !center.notices.some(n => !n.read && n.thread === i.id)).length)
const saveNotices = () => useStacks().ls.set('stacks-notices', JSON.stringify(center.notices))
const validNotice = (n: Notice) => !!n && typeof n.id === 'string' && NOTIFY_KINDS.includes(n.kind)
  && typeof n.at === 'string' && !Number.isNaN(Date.parse(n.at)) && typeof n.msg?.key === 'string'
function loadNotices() {
  try {
    const list = JSON.parse(useStacks().ls.get('stacks-notices') ?? '[]') as Notice[]
    if (Array.isArray(list)) center.notices = list.filter(validNotice).slice(0, KEEP).map(n => ({ ...n, read: !!n.read }))
  }
  catch { /* start empty */ }
}

let seq = 0
function notice(kind: NotifyKind, ref: string, title: string, msg: Notice['msg'], url: string, link: Pick<Notice, 'pr' | 'thread' | 'slug' | 'num'>): Notice {
  return { id: `${Date.now().toString(36)}-${seq++}`, at: new Date().toISOString(), kind, ref, title, msg, url, ...link, read: false }
}
function prNotice(p: PullRequest, kind: NotifyKind, msg: Notice['msg']) {
  return notice(kind, p.id, p.title, msg, p.url, { pr: p.id })
}
const mineMsg = (a: MineAlert): Notice['msg'] => ({ key: `notify.${a.kind}`, params: { base: a.pr.base, parent: a.parent ?? '' }, who: a.who })
function noticeText(n: Notice) {
  const who = (n.msg.who ?? []).map(l => useStacks().person(l).n).join(', ')
  return t(n.msg.key, { ...n.msg.params, who })
}
const inboxRef = (i: { slug: string, num: number }) => `${i.slug.split('/')[1]}#${i.num}`
const inboxKey = (i: InboxItem) => `notify.gh.${i.reason !== 'state_change' ? i.reason : i.state === 'merged' || i.state === 'closed' ? i.state : 'state_change'}`
const inboxText = (i: InboxItem) => t(inboxKey(i))
const isReview = (n: Notice) => (NOTIFY_GROUPS.review as readonly string[]).includes(n.kind)

// Records the notices, then shows the ones whose kind is on as a system notification
function send(list: Notice[]) {
  if (!list.length) return
  center.notices = [...list, ...center.notices].slice(0, KEEP)
  saveNotices()
  const shown = list.filter(n => ds.notifyKinds.has(n.kind))
  if (!ds.notify || !shown.length || typeof Notification === 'undefined') return
  const one = shown.length === 1 ? shown[0]! : null
  const n = new Notification(one ? `${one.ref} · ${one.title}` : t('notify.many', { n: shown.length }), {
    body: one ? noticeText(one) : shown.slice(0, 4).map(a => `${a.ref} · ${noticeText(a)}`).join('\n'),
    icon: '/icon.png',
  })
  n.onclick = () => {
    if (one) return openNotice(one)
    bridge()?.show()
    if (shown.every(isReview)) useStacks().st.quick = 'new'
  }
}

function markNotices(read: (n: Notice) => boolean) {
  let changed = false
  for (const n of center.notices) {
    if (!n.read && read(n)) changed = n.read = true
  }
  if (changed) saveNotices()
}
const readAllNotices = () => markNotices(() => true)
function clearNotices() {
  center.notices = []
  saveNotices()
}

/* GitHub notifications, polled at the pace GitHub asks for (a 304 costs no rate limit) */
const inbox = {
  seen: null as Map<string, string> | null,
  since: null as string | null,
  // threads marked read from here: kept out of the list until GitHub stops listing them
  reading: new Set<string>(),
  // threads read without a click, once per update: a failure is not retried until the thread moves
  auto: new Set<string>(),
  rounds: 0,
  fails: 0,
  gen: 0,
  timer: undefined as ReturnType<typeof setTimeout> | undefined,
}
// marks a thread read on GitHub: it leaves the inbox, and the notices it raised are read too
function readThread(id: string) {
  if (inbox.reading.has(id)) return
  const item = center.inbox.find(i => i.id === id)
  inbox.reading.add(id)
  center.inbox = center.inbox.filter(i => i.id !== id)
  markNotices(n => n.thread === id)
  $fetch('/api/inbox', { method: 'POST', body: { read: id } }).catch(() => {
    inbox.reading.delete(id)
    if (item && !center.inbox.some(i => i.id === id)) center.inbox = [item, ...center.inbox]
    useStacks().toast(t('center.readFailed'), undefined, 'error')
  }).finally(() => {
    // the next answer is a full one, whatever Last-Modified says
    inbox.since = null
  })
}
const tracked = (slug: string) => !!useStacks().st.settings?.repos.some(r => r.toLowerCase() === slug.toLowerCase())
// every notification of the tracked repositories, read on GitHub at once
function readRepos() {
  const { st, toast } = useStacks()
  const repos = st.settings?.repos ?? []
  const items = center.inbox.filter(i => tracked(i.slug))
  const ids = new Set(items.map(i => i.id))
  for (const id of ids) inbox.reading.add(id)
  center.inbox = center.inbox.filter(i => !ids.has(i.id))
  markNotices(n => !!n.thread && ids.has(n.thread))
  $fetch('/api/inbox', { method: 'POST', body: { repos } }).catch(() => {
    for (const id of ids) inbox.reading.delete(id)
    center.inbox = [...items, ...center.inbox]
    toast(t('center.readFailed'), undefined, 'error')
  }).finally(() => {
    inbox.since = null
  })
}
// shows the PR in the dashboard when it is there, on GitHub otherwise
function openPr(url: string, find: (p: PullRequest) => boolean) {
  const { prs, st } = useStacks()
  const p = prs.value.find(find)
  if (!p) return void window.open(url, '_blank', 'noopener')
  bridge()?.show()
  st.sel = p.id
}
const samePr = (x: { slug?: string, num?: number }) => (p: PullRequest) => p.num === x.num && p.slug.toLowerCase() === x.slug?.toLowerCase()
function openNotice(n: Notice) {
  markNotices(x => x.id === n.id)
  if (n.thread) readThread(n.thread)
  openPr(n.url, n.pr ? p => p.id === n.pr : samePr(n))
}
function openInbox(i: InboxItem) {
  readThread(i.id)
  openPr(i.url, samePr(i))
}
const prInbox = (p: PullRequest) => center.inbox.filter(i => samePr(i)(p))
// a PR opened on GitHub from the dashboard: its notifications are seen there
function readPr(p: PullRequest) {
  const { st } = useStacks()
  if (st.quick === 'gh') st.kept.add(p.id)
  for (const i of prInbox(p)) readThread(i.id)
}
// What the dashboard already told: the PR is no longer open (a mention or a comment stays, the dashboard
// does not show it), or I reviewed it after the thread last moved. Only against a snapshot taken after the
// thread moved, so a PR opened since the last sync is not taken for gone.
function settled(i: InboxItem, s: Snapshot) {
  if (!tracked(i.slug) || Date.parse(i.updatedAt) > Date.parse(s.at)) return false
  const p = s.prs.find(samePr(i))
  if (!p) return !['mention', 'team_mention', 'comment'].includes(i.reason)
  return i.reason === 'review_requested' && p.reviews.some(r => r.by === s.me && r.s !== 'REQUESTED' && !r.rerequested && !!r.at && r.at >= i.updatedAt)
}

function inboxKind(i: InboxItem): NotifyKind | null {
  const { prs, snap } = useStacks()
  switch (i.reason) {
    case 'mention':
    case 'team_mention':
      // a mention on my own tracked PR already shows up as a comment from the sync
      return tracked(i.slug) && prs.value.some(p => samePr(i)(p) && p.author === snap.value?.me) ? null : 'mention'
    case 'state_change': return i.state === 'merged' || i.state === 'closed' ? 'merged' : null
    case 'assign': return 'assign'
    case 'subscribed': return null
    // reviews and comments on tracked repositories already come from the sync
    default: return tracked(i.slug) ? null : 'elsewhere'
  }
}
async function pollInbox() {
  const gen = inbox.gen
  let wait: number
  try {
    // every few rounds, a full answer: reading a thread on github.com does not move Last-Modified
    const since = inbox.rounds++ % 5 && inbox.since
    const res = await $fetch<Inbox>('/api/inbox', { query: since ? { since } : {} })
    if (gen !== inbox.gen) return
    wait = res.poll
    inbox.fails = 0
    center.inboxError = false
    center.inboxLoaded = true
    if (res.modified) {
      const unreadNow = new Set(res.unread)
      for (const id of inbox.reading) {
        if (!unreadNow.has(id)) inbox.reading.delete(id)
      }
      const items = res.items.filter(i => !inbox.reading.has(i.id))
      // the first answer only records what is already unread; a cut list keeps what it may have left out
      const seen = inbox.seen
      inbox.seen = new Map([...(res.complete ? [] : seen ?? []), ...items.map(i => [i.id, i.updatedAt] as const)])
      inbox.since = res.lastModified
      center.inbox = items
      // read on github.com in the meantime
      if (res.complete) markNotices(n => !!n.thread && !unreadNow.has(n.thread))
      if (seen) {
        send(items.filter(i => seen.get(i.id) !== i.updatedAt).flatMap((i) => {
          const k = inboxKind(i)
          return k ? [notice(k, inboxRef(i), i.title, { key: inboxKey(i) }, i.url, { thread: i.id, slug: i.slug, num: i.num })] : []
        }))
      }
    }
  }
  catch {
    if (gen !== inbox.gen) return
    // gh not ready, offline or rate limited: back off, up to 15 min
    wait = Math.min(60 * 2 ** inbox.fails++, 900)
    center.inboxError = true
  }
  inbox.timer = setTimeout(pollInbox, wait * 1000)
}
if (import.meta.hot) import.meta.hot.dispose(() => clearTimeout(inbox.timer))

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
  ds.inbox = ls.get('stacks-inbox') !== 'off'
  ds.badge = ls.get('stacks-badge') !== 'off'
  try {
    let off = JSON.parse(ls.get('stacks-notify-off') ?? 'null') as NotifyKind[] | null
    // before: the kinds turned on, out of the first three
    const on = JSON.parse(ls.get('stacks-notify-kinds') ?? 'null') as string[] | null
    if (!off && Array.isArray(on)) off = (['requested', 'approve', 'changes'] as const).filter(k => !on.includes(k))
    if (Array.isArray(off)) ds.notifyKinds = new Set(NOTIFY_KINDS.filter(k => !off.includes(k)))
    if (on) {
      ls.set('stacks-notify-off', JSON.stringify(off))
      localStorage.removeItem('stacks-notify-kinds')
    }
  }
  catch { /* keep every kind */ }
  loadNotices()
  // another window on the same storage (a browser tab next to the app in dev) keeps the history in step
  window.addEventListener('storage', (e) => {
    if (e.key === 'stacks-notices') loadNotices()
  })
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
  // The first snapshot (and the first after the sync settings change: repos, approvals) only records what
  // already wants attention: notifications are for PRs that start to. A PR is notified once per reason (and
  // per push for a re-approval).
  let notified: Set<string> | null = null
  const reviewKey = (p: PullRequest) => `${p.id}|${forMe(p)}|${forMe(p) === 'approve' ? p.headOid : ''}`
  watch(snap, (s, old) => {
    if (!s) return
    const review = hot.value.filter(p => forMe(p))
    if (notified && old && JSON.stringify(old.settings) === JSON.stringify(s.settings)) {
      send([
        ...review.filter(p => !notified!.has(reviewKey(p))).map(p => prNotice(p, forMe(p)!, { key: `notify.${forMe(p)}` })),
        ...mineAlerts(old, s).map(a => prNotice(a.pr, a.kind, mineMsg(a))),
      ])
    }
    notified = new Set(review.map(reviewKey))
  })
  if (ds.inbox) inbox.timer = setTimeout(pollInbox, 5000)

  // GitHub notifications the dashboard made useless
  watchEffect(() => {
    const s = snap.value
    if (!s) return
    const done = center.inbox.filter(i => !inbox.auto.has(`${i.id}@${i.updatedAt}`) && settled(i, s))
    for (const i of done) {
      inbox.auto.add(`${i.id}@${i.updatedAt}`)
      readThread(i.id)
    }
  })
}

export function useDesktop() {
  return { ds, center, unread, bell, openNotice, openInbox, readThread, prInbox, readPr, readRepos, tracked, readAllNotices, clearNotices, noticeText, inboxRef, inboxText, desktop: bridge, checkGh, setTheme, setNotify, setNotifyKind, setInbox, setBadge, testNotification, setAppPref, startDesktop }
}
