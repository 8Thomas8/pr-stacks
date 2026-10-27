import type { Person, PullRequest, Snapshot, SyncSettings } from '#shared/types/pr'
import type { Rel } from '~/utils/stacks'

type Translate = ReturnType<typeof useI18n>['t']

export type Density = 'comfortable' | 'compact' | 'ultra'
export type QuickKey = 'all' | 'new' | 'review' | 'mine' | 'rework'
export type ToastKind = 'ok' | 'error' | 'info'
export interface Toast { id: number, msg: string, sub?: string, kind: ToastKind }
export interface Avatar extends Person { i: string, h: number }
export type PrefsTab = 'general' | 'repos' | 'sync' | 'notifications' | 'app' | 'github'

export const AUTO_CHOICES = [30, 60, 120, 300, 600]
const ls = {
  get: (k: string) => {
    try {
      return localStorage.getItem(k)
    }
    catch { return null }
  },
  set: (k: string, v: string) => {
    try {
      localStorage.setItem(k, v)
      return true
    }
    catch { return false }
  },
}

function readSettings(): SyncSettings | null {
  try {
    const s = JSON.parse(ls.get('stacks-settings') ?? 'null') as SyncSettings | null
    return s && Array.isArray(s.repos) ? { repos: s.repos, approvals: Number(s.approvals) || 1, fresh: !!s.fresh } : null
  }
  catch { return null }
}

function readFocus() {
  try {
    const f = JSON.parse(ls.get('stacks-focus') ?? 'null') as { id: string, line: string[] } | null
    return f && typeof f.id === 'string' && Array.isArray(f.line) ? f : null
  }
  catch { return null }
}

let t: Translate = ((key: string) => key) as Translate
const snap = shallowRef<Snapshot | null>(null)
const st = reactive({
  view: (ls.get('stacks-view') === 'list' ? 'list' : 'graph') as 'graph' | 'list',
  mode: (ls.get('stacks-mode') === 'auto' ? 'auto' : 'manual') as 'manual' | 'auto',
  ci: ls.get('stacks-ci') === 'on',
  density: (['compact', 'ultra'].includes(ls.get('stacks-density') ?? '') ? ls.get('stacks-density') : 'comfortable') as Density,
  q: '',
  quick: 'all' as QuickKey,
  repos: new Set<string>(),
  authors: new Set<string>(),
  labels: new Set<string>(),
  hideDrafts: ls.get('stacks-hide-drafts') === 'on',
  sel: null as string | null,
  focus: readFocus(),
  hover: null as string | null,
  collapsed: new Set<string>(JSON.parse(ls.get('stacks-collapsed') || '[]') as string[]),
  folded: new Set<string>(JSON.parse(ls.get('stacks-folded') || '[]') as string[]),
  kept: new Set<string>(),
  seen: new Map<string, string>(Object.entries(JSON.parse(ls.get('stacks-seen') || '{}') as Record<string, string>)),
  changed: new Set<string>(),
  popAv: new Set<string>(),
  lastSync: 0,
  loadError: null as string | null,
  refreshing: false,
  intro: true,
  autoS: AUTO_CHOICES.includes(Number(ls.get('stacks-auto-s'))) ? Number(ls.get('stacks-auto-s')) : 120,
  countdown: 0,
  now: Date.now(),
  toasts: [] as Toast[],
  settings: readSettings(),
  prefsOpen: false,
  prefsTab: 'general' as PrefsTab,
})
st.countdown = st.autoS

const prs = computed(() => snap.value?.prs ?? [])
const lean = computed(() => st.density !== 'comfortable')
const me = computed(() => snap.value?.me ?? '')
const repos = computed(() => snap.value?.repos ?? [])
const byIdMap = computed(() => new Map(prs.value.map(p => [p.id, p])))
const tree = computed(() => buildForest(prs.value, repos.value))
const forest = computed(() => (st.focus ? buildForest(prs.value.filter(p => st.focus!.line.includes(p.id)), repos.value) : tree.value))

const avatars = new Map<string, Avatar>()
function person(login: string): Avatar {
  const p = snap.value?.people[login] ?? { n: login, login, avatar: null, team: false }
  const cached = avatars.get(login)
  if (cached && cached.avatar === p.avatar && cached.n === p.n) return cached
  const words = p.n.replace(/[^\p{L}\p{N}\s-]/gu, ' ').split(/[\s-]+/).filter(Boolean)
  const i = (words.length > 1 ? words[0]![0]! + words[1]![0]! : p.n.slice(0, 2)).toUpperCase()
  let h = 0
  for (const ch of login) h = (h * 31 + ch.charCodeAt(0)) % 360
  const a = { ...p, i, h }
  avatars.set(login, a)
  return a
}

const byId = (id: string) => byIdMap.value.get(id)
const submitted = (p: PullRequest) => p.reviews.filter(r => r.s !== 'REQUESTED')
const sinceLastReview = (p: PullRequest) => {
  const s = submitted(p)
  return s.length ? Math.min(...s.map(r => r.after)) : 0
}
const toApproveByMe = (p: PullRequest) => !p.draft && p.author !== me.value && p.reviews.some(r => r.by === me.value && r.s !== 'REQUESTED' && (r.after > 0 || !!r.rerequested))
const reviewRequested = (p: PullRequest) => !p.draft && p.author !== me.value && p.reviews.some(r => r.by === me.value && r.s === 'REQUESTED')
const blocking = (p: PullRequest) => p.conflict && !p.draft
const blocks = (p: PullRequest) => prs.value.filter(o => o.dependsOn.includes(p.id))
const rels = (p: PullRequest): Rel[] => [
  ...(p.behind ? [{ k: 'behind' as const }] : []),
  ...p.dependsOn.map(byId).filter((o): o is PullRequest => !!o).map(o => ({ k: 'dep' as const, o })),
  ...blocks(p).map(o => ({ k: 'block' as const, o })),
  ...[...p.links].sort((a, b) => Number(a.state === 'merged') - Number(b.state === 'merged')).map(l => ({ k: 'link' as const, l })),
]
const forMe = (p: PullRequest) => (toApproveByMe(p) ? 'approve' : reviewRequested(p) ? 'requested' : null)
function rawPulse(p: PullRequest) {
  if (p.conflict || p.draft) return ''
  if (forMe(p)) return 'pulse-review'
  if (p.status === 'changes') return 'pulse-changes'
  return ''
}
function pulseKey(p: PullRequest, cls: string) {
  if (cls === 'pulse-changes') return JSON.stringify([cls, p.headOid, p.reviews.filter(r => r.s === 'CHANGES_REQUESTED').map(r => r.by)])
  const kind = forMe(p)
  const mine = p.reviews.find(r => r.by === me.value)
  return JSON.stringify([kind, kind === 'approve' && p.headOid, mine?.s, !!mine?.rerequested])
}
function pulseClass(p: PullRequest) {
  const cls = rawPulse(p)
  return cls && st.seen.get(p.id) !== pulseKey(p, cls) ? cls : ''
}
const saveSeen = () => ls.set('stacks-seen', JSON.stringify(Object.fromEntries(st.seen)))
function markSeen(id: string) {
  const p = byId(id)
  if (!p || !pulseClass(p)) return
  if (st.quick === 'new') st.kept.add(id)
  st.seen.set(id, pulseKey(p, rawPulse(p)))
  saveSeen()
}
function hoverSeen(id: string, e: PointerEvent) {
  if (e.movementX || e.movementY) markSeen(id)
}
function pathHas(fromId: string | null, id: string) {
  let c = fromId ? byId(fromId) : undefined
  while (c) {
    if (c.id === id) return true
    c = forest.value.parentOf(c)
  }
  return false
}

const QUICK: { k: QuickKey, f: (p: PullRequest) => boolean, c: string, hot?: boolean }[] = [
  { k: 'all', f: () => true, c: 'var(--line-strong)' },
  { k: 'new', f: p => !!pulseClass(p), c: 'var(--violet)', hot: true },
  { k: 'review', f: p => !!forMe(p), c: 'var(--accent)', hot: true },
  { k: 'mine', f: p => p.author === me.value, c: 'var(--accent-ink)' },
  { k: 'rework', f: p => p.author === me.value && (p.status === 'changes' || p.threads.length > 0 || p.conflict), c: 'var(--warn)', hot: true },
]

function matches(p: PullRequest) {
  if (st.focus && !st.focus.line.includes(p.id)) return false
  if (!QUICK.find(x => x.k === st.quick)!.f(p) && !st.kept.has(p.id)) return false
  if (st.repos.size && !st.repos.has(p.repo)) return false
  if (st.authors.size && !st.authors.has(p.author)) return false
  if (st.labels.size && !p.labels.some(l => st.labels.has(l))) return false
  if (st.hideDrafts && p.draft) return false
  if (st.q) {
    const hay = `${p.id} ${p.title} ${p.head} ${p.body} ${p.labels.join(' ')} ${person(p.author).n} ${p.author}`.toLowerCase()
    if (!st.q.toLowerCase().split(/\s+/).every(w => hay.includes(w))) return false
  }
  return true
}
const visibleBands = computed(() => forest.value.bands.filter(b => b.items.some(matches)))

let toastId = 0
function toast(msg: string, sub?: string, kind: ToastKind = 'info') {
  const last = st.toasts.at(-1)
  if (last && last.msg === msg && last.sub === sub) return
  st.toasts.push({ id: ++toastId, msg, sub, kind })
}
function dropToast(id: number) {
  st.toasts = st.toasts.filter(x => x.id !== id)
}

const saveCollapsed = () => ls.set('stacks-collapsed', JSON.stringify([...st.collapsed]))
function setCollapsed(key: string, closed: boolean) {
  if (closed) st.collapsed.add(key)
  else st.collapsed.delete(key)
  saveCollapsed()
}
function setAllFolded(fold: boolean) {
  forest.value.bands.forEach(b => (fold ? st.collapsed.add(b.key) : st.collapsed.delete(b.key)))
  saveCollapsed()
}
function setFocus(id: string | null) {
  const p = id ? byId(id) : undefined
  const line: string[] = []
  for (let c = p; c && !line.includes(c.id); c = tree.value.parentOf(c)) line.unshift(c.id)
  const walk = (x: string) => tree.value.kids(x).forEach((k) => {
    if (line.includes(k.id)) return
    line.push(k.id)
    walk(k.id)
  })
  if (p) walk(p.id)
  const fresh = p && p.id !== st.focus?.id
  st.focus = p ? { id: p.id, line } : null
  ls.set('stacks-focus', JSON.stringify(st.focus))
  if (fresh) {
    forest.value.bands.forEach(b => st.collapsed.delete(b.key))
    saveCollapsed()
  }
}
function setFolded(key: string, fold: boolean) {
  if (fold) st.folded.add(key)
  else st.folded.delete(key)
  ls.set('stacks-folded', JSON.stringify([...st.folded]))
}

const fingerprint = (p: PullRequest, ci: boolean) => JSON.stringify([p.updatedAt, p.headOid, p.status, ci && p.ci, p.behind, p.threads.length, p.labels, p.reviews.map(r => [r.by, r.s, r.after])])
function describeChanges(prev: PullRequest[], next: PullRequest[], ci: boolean) {
  const before = new Map(prev.map(p => [p.id, p]))
  const now = new Set(next.map(p => p.id))
  const added = next.filter(p => !before.has(p.id))
  const closed = prev.filter(p => !now.has(p.id))
  const changed = next.filter(p => before.has(p.id) && fingerprint(before.get(p.id)!, ci) !== fingerprint(p, ci))
  const pops: string[] = []
  for (const p of changed) {
    const old = before.get(p.id)!
    p.reviews.forEach((r) => {
      const o = old.reviews.find(x => x.by === r.by)
      if (!o || o.s !== r.s) pops.push(p.id + r.by)
    })
  }
  const parts: string[] = []
  if (added.length) parts.push(t('sync.new', { n: added.length }))
  if (changed.length) parts.push(t('sync.changed', { n: changed.length }))
  if (closed.length) parts.push(t('sync.closed', { n: closed.length }))
  const touched = [...added, ...changed]
  return {
    ids: touched.map(p => p.id), pops,
    msg: parts.length ? t('sync.changes', { parts: parts.join(', ') }) : t('sync.nothing'),
    sub: touched.slice(0, 4).map(p => p.id).join(', ') || t('n.repos', repos.value.length),
  }
}

function keepConflicts(prev: PullRequest[], next: PullRequest[]) {
  const before = new Map(prev.map(p => [p.id, p]))
  for (const p of next) {
    const o = before.get(p.id)
    if (p.mergeable !== 'UNKNOWN' || !o?.conflict || o.headOid !== p.headOid || o.base !== p.base) continue
    p.conflict = true
    if (!p.draft) p.status = 'conflict'
  }
}

async function refresh({ silent = false } = {}) {
  if (st.refreshing) return
  st.refreshing = true
  try {
    const s = st.settings
    const query = {
      ...(st.ci ? { ci: '1' } : {}),
      ...(s ? { repos: s.repos.join(','), approvals: String(s.approvals), fresh: s.fresh ? '1' : '0' } : {}),
    }
    const data = await $fetch<Snapshot>('/api/prs', { query }).catch((e) => {
      throw new Error(e?.data?.data?.error || e?.data?.message || e?.message || t('sync.unknown'))
    })
    if (!st.settings) saveSettings(data.settings)
    const prev = snap.value
    if (prev) keepConflicts(prev.prs, data.prs)
    const linkErrors = data.linkErrors.join(', ')
    if (linkErrors && linkErrors !== prev?.linkErrors.join(', ')) toast(t('sync.linksFailed'), linkErrors, 'error')
    snap.value = data
    st.loadError = null
    st.lastSync = Date.now()
    if (prev) {
      const d = describeChanges(prev.prs, data.prs, prev.ci && data.ci)
      st.changed = new Set(d.ids)
      st.popAv = new Set(d.pops)
      if (!(silent && !d.ids.length)) toast(d.msg, d.sub, 'ok')
      setTimeout(() => {
        st.changed = new Set()
        st.popAv = new Set()
      }, 2000)
    }
    else {
      setTimeout(() => {
        st.intro = false
      }, 1600)
    }
    if (st.sel && !byId(st.sel)) st.sel = null
    const f = st.focus
    if (f) {
      const i = f.line.indexOf(f.id)
      const next = [...f.line.slice(i), ...f.line.slice(0, i).reverse()].find(byId)
      setFocus(next ?? null)
      if (next !== f.id) toast(next ? t('focus.moved', { from: f.id, to: next }) : t('focus.ended', { id: f.id }))
    }
    const gone = [...st.seen.keys()].filter(id => !byId(id))
    if (gone.length) {
      gone.forEach(id => st.seen.delete(id))
      saveSeen()
    }
  }
  catch (e) {
    const msg = (e as Error).message
    if (msg === 'no-repos') snap.value = null
    if (snap.value && msg !== st.loadError) toast(t('sync.failed'), msg.slice(0, 120), 'error')
    st.loadError = msg
  }
  finally {
    st.refreshing = false
    st.countdown = st.autoS
  }
  if (snap.value && snap.value.ci !== st.ci && !st.loadError) refresh({ silent: true })
}

function setMode(m: 'manual' | 'auto', quiet = false) {
  st.mode = m
  st.countdown = st.autoS
  ls.set('stacks-mode', m)
  if (!quiet) toast(m === 'auto' ? t('sync.modeAuto', { every: every(st.autoS) }) : t('sync.modeManual'), undefined, 'ok')
}
function saveSettings(s: SyncSettings) {
  st.settings = s
  ls.set('stacks-settings', JSON.stringify(s))
}
function setSettings(s: SyncSettings) {
  saveSettings(s)
  toast(t('settings.saved'), undefined, 'ok')
  refresh({ silent: true })
}
function setAutoS(sec: number) {
  st.autoS = sec
  st.countdown = sec
  ls.set('stacks-auto-s', String(sec))
  toast(t('options.autoSet', { every: every(sec) }), undefined, 'ok')
}
const every = (sec: number) => (sec < 60 ? t('every.s', { n: sec }) : t('every.m', { n: sec / 60 }))
function setCi(on: boolean) {
  st.ci = on
  ls.set('stacks-ci', on ? 'on' : 'off')
  toast(on ? t('options.ciOn') : t('options.ciOff'), undefined, 'ok')
  refresh({ silent: true })
}
function setHideDrafts(on: boolean) {
  st.hideDrafts = on
  ls.set('stacks-hide-drafts', on ? 'on' : 'off')
}
function setDensity(d: Density) {
  st.density = d
  ls.set('stacks-density', d)
  toast(t('options.densitySet', { name: t(`options.density.${d}`) }), undefined, 'ok')
}
function setView(v: 'graph' | 'list') {
  st.view = v
  ls.set('stacks-view', v)
}

function useTranslate(translate: Translate) {
  t = translate
}
let started = false
function start(translate: Translate) {
  t = translate
  if (started) return
  started = true
  watchEffect(() => {
    if (st.sel) markSeen(st.sel)
  })
  watch(() => st.quick, () => st.kept.clear())
  refresh()
  setInterval(() => {
    st.now = Date.now()
    // keeps ticking while the window sits in the tray, so notifications still arrive
    if (st.mode === 'auto' && !st.refreshing) {
      st.countdown--
      if (st.countdown <= 0) refresh({ silent: true })
    }
  }, 1000)
}
function openPrefs(tab: PrefsTab = 'general') {
  st.prefsTab = tab
  st.prefsOpen = true
}

export function useStacks() {
  return {
    st, snap, prs, me, repos, tree, forest, visibleBands, QUICK, every,
    person, byId, submitted, sinceLastReview, toApproveByMe, reviewRequested, forMe, blocking, blocks, rels, pulseClass, hoverSeen, pathHas, matches,
    toast, dropToast, setCollapsed, setAllFolded, setFocus, setFolded, refresh, setMode, setCi, setAutoS, setDensity, setHideDrafts, setView, start, useTranslate, setSettings, openPrefs,
    lean,
    ls,
    showCi: computed(() => !!snap.value?.ci),
    repoSlug: (r: string) => repos.value.find(x => x.key === r)?.slug || r,
    label: (l: string) => snap.value?.labels[l] ?? { c: '#7A8292', d: '' },
  }
}
