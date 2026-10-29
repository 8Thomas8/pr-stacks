import { execFile } from 'node:child_process'
import type { Inbox, InboxItem, InboxReason } from '#shared/types/pr'

const REASONS = new Set<InboxReason>(['mention', 'team_mention', 'state_change', 'assign', 'review_requested', 'comment', 'author', 'subscribed'])
// what an If-Modified-Since value may look like: an HTTP date, nothing that could break the header
const HTTP_DATE = /^[\w ,:]{1,40}$/

interface GhThread {
  id: string
  reason: string
  unread: boolean
  updated_at: string
  subject: { title: string, url: string | null, type: string }
}

const run = (args: string[]) => new Promise<{ ok: boolean, out: string, err: string }>((resolve) => {
  execFile('gh', args, { maxBuffer: 16 * 1024 * 1024, timeout: 30_000, windowsHide: true }, (e, stdout, stderr) => {
    resolve({ ok: !e, out: stdout, err: (stderr || e?.message || '').trim() })
  })
})

// `gh api -i` prints the status line and headers, a blank line, then the body
function parse(raw: string) {
  const cut = raw.search(/\r?\n\r?\n/)
  const head = cut < 0 ? raw : raw.slice(0, cut)
  return {
    status: Number(head.match(/^HTTP\/[\d.]+ (\d{3})/)?.[1] ?? 0),
    header: (name: string) => head.match(new RegExp(`^${name}:[ \\t]*(.+?)\\r?$`, 'im'))?.[1] ?? null,
    body: cut < 0 ? '' : raw.slice(cut).trim(),
  }
}

// https://api.github.com/repos/o/r/pulls/12 (or https://ghe.host/api/v3/repos/…) → o/r, 12, its web page
function pullOf(apiUrl: string) {
  const m = apiUrl.match(/^https:\/\/([^/]+)(?:\/api\/v3)?\/repos\/([\w.-]+\/[\w.-]+)\/pulls\/(\d+)$/)
  if (!m) return null
  const host = m[1]!.replace(/^api\./, '')
  return { slug: m[2]!, num: Number(m[3]), url: `https://${host}/${m[2]}/pull/${m[3]}` }
}

// state_change does not say what happened: ask once per thread update (a failure too, retried on the next update)
const states = new Map<string, InboxItem['state']>()
async function stateOf(slug: string, num: number, key: string) {
  if (states.has(key)) return states.get(key)
  const res = await run(['api', `repos/${slug}/pulls/${num}`, '--jq', '[.state, .merged] | @tsv'])
  const [state, merged] = res.out.trim().split('\t')
  const s = !res.ok ? undefined : merged === 'true' ? 'merged' : state === 'closed' ? 'closed' : 'open'
  states.set(key, s)
  return s
}

// a few pages at most: past that, `complete` tells the client the list is cut
const PAGES = 5

export async function getInbox(since?: string): Promise<Inbox> {
  const args = ['api', '-i', 'notifications?per_page=50']
  if (since && HTTP_DATE.test(since)) args.push('-H', `If-Modified-Since: ${since}`)
  let res = await run(args)
  let page = parse(res.out)
  const { status, header } = page
  const poll = Math.max(60, Number(header('x-poll-interval')) || 60)
  if (status === 304) return { modified: false, lastModified: since ?? null, poll, items: [], unread: [], complete: true }
  if (status !== 200) throw new Error(res.err || `GitHub answered ${status || 'nothing'}`)

  const threads = JSON.parse(page.body) as GhThread[]
  let n = 1
  for (; n < PAGES && /rel="next"/.test(page.header('link') ?? ''); n++) {
    res = await run(['api', '-i', `notifications?per_page=50&page=${n + 1}`])
    page = parse(res.out)
    if (page.status !== 200) throw new Error(res.err || `GitHub answered ${page.status || 'nothing'}`)
    threads.push(...JSON.parse(page.body) as GhThread[])
  }
  const complete = !/rel="next"/.test(page.header('link') ?? '')

  const unread = threads.filter(t => t.unread)
  const items: InboxItem[] = []
  for (const t of unread) {
    if (t.subject.type !== 'PullRequest' || !t.subject.url || !REASONS.has(t.reason as InboxReason)) continue
    const pr = pullOf(t.subject.url)
    if (pr) items.push({ id: t.id, reason: t.reason as InboxReason, ...pr, title: t.subject.title, updatedAt: t.updated_at })
  }
  await Promise.all(items.filter(i => i.reason === 'state_change').map(async (i) => {
    i.state = await stateOf(i.slug, i.num, `${i.id}@${i.updatedAt}`)
  }))
  return { modified: true, lastModified: header('last-modified'), poll, items, unread: unread.map(t => t.id), complete }
}

export async function markRead(id: string) {
  if (!/^\d{1,20}$/.test(id)) throw new Error('bad thread id')
  const res = await run(['api', '-X', 'PATCH', `notifications/threads/${id}`, '--silent'])
  if (!res.ok) throw new Error(res.err)
}

export async function markRepoRead(slug: string) {
  if (!/^[\w.-]+\/[\w.-]+$/.test(slug)) throw new Error('bad repository')
  const res = await run(['api', '-X', 'PUT', `repos/${slug}/notifications`, '--silent'])
  if (!res.ok) throw new Error(res.err)
}
