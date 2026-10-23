import { execFile } from 'node:child_process'
import type { Inbox, InboxItem, InboxReason } from '#shared/types/pr'

const REASONS = new Set<InboxReason>(['mention', 'team_mention', 'state_change', 'assign', 'review_requested', 'comment', 'author'])
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

// state_change does not say what happened: ask once per thread update
const states = new Map<string, InboxItem['state']>()
async function stateOf(slug: string, num: number, key: string) {
  if (states.has(key)) return states.get(key)
  const res = await run(['api', `repos/${slug}/pulls/${num}`, '--jq', '[.state, .merged] | @tsv'])
  if (!res.ok) return undefined
  const [state, merged] = res.out.trim().split('\t')
  const s = merged === 'true' ? 'merged' : state === 'closed' ? 'closed' : 'open'
  states.set(key, s)
  return s
}

export async function getInbox(since?: string): Promise<Inbox> {
  const args = ['api', '-i', 'notifications?per_page=50']
  if (since && HTTP_DATE.test(since)) args.push('-H', `If-Modified-Since: ${since}`)
  const res = await run(args)
  const { status, header, body } = parse(res.out)
  const poll = Math.max(60, Number(header('x-poll-interval')) || 60)
  if (status === 304) return { modified: false, lastModified: since ?? null, poll, items: [] }
  if (status !== 200) throw new Error(res.err || `GitHub answered ${status || 'nothing'}`)

  const threads = JSON.parse(body) as GhThread[]
  const items: InboxItem[] = []
  for (const n of threads) {
    if (!n.unread || n.subject.type !== 'PullRequest' || !n.subject.url || !REASONS.has(n.reason as InboxReason)) continue
    const pr = pullOf(n.subject.url)
    if (!pr) continue
    const item: InboxItem = { id: n.id, reason: n.reason as InboxReason, ...pr, title: n.subject.title, updatedAt: n.updated_at }
    if (item.reason === 'state_change') item.state = await stateOf(pr.slug, pr.num, `${n.id}@${n.updated_at}`)
    items.push(item)
  }
  return { modified: true, lastModified: header('last-modified'), poll, items }
}

export async function markRead(id: string) {
  if (!/^\d{1,20}$/.test(id)) throw new Error('bad thread id')
  const res = await run(['api', '-X', 'PATCH', `notifications/threads/${id}`, '--silent'])
  if (!res.ok) throw new Error(res.err)
}
