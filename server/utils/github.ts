import { execFile } from 'node:child_process'
import type { Label, LinkedPr, Person, PrStatus, PullRequest, Review, Snapshot } from '#shared/types/pr'

interface RepoRef { owner: string, name: string }
export interface SyncOptions { ci: boolean, repos: string[], approvals: number, fresh: boolean }

export const SLUG = /^[\w.-]{1,100}\/[\w.-]{1,100}$/
export const NO_REPOS = 'no-repos'

const parseJson = (s: string): { data?: unknown } | null => {
  try {
    return JSON.parse(s)
  }
  catch { return null }
}

function gh<T>(args: string[], { partial = false } = {}): Promise<T> {
  return new Promise((resolve, reject) => {
    execFile('gh', args, { maxBuffer: 64 * 1024 * 1024, windowsHide: true }, (err, stdout, stderr) => {
      if (err && partial) {
        const res = parseJson(stdout)
        if (res?.data) return resolve(res as T)
      }
      if (err) return reject(new Error((stderr || err.message).trim()))
      try {
        resolve(JSON.parse(stdout))
      }
      catch (e) { reject(new Error(`Invalid gh response: ${(e as Error).message}`)) }
    })
  })
}

const prFields = (ci: boolean) => `
  number title body url isDraft createdAt updatedAt headRefName headRefOid baseRefName mergeable mergeStateStatus reviewDecision
  author { login avatarUrl ... on User { name } }
  labels(first: 20) { nodes { name color description } }
  comments { totalCount }
  commits(last: 30) { totalCount nodes { commit { oid abbreviatedOid messageHeadline committedDate authoredDate } } }
  ${ci ? 'head: commits(last: 1) { nodes { commit { statusCheckRollup { state } } } }' : ''}
  reviews(last: 40) { nodes { state submittedAt author { login avatarUrl ... on User { name } } commit { oid } } }
  reviewRequests(first: 20) { nodes { requestedReviewer { ... on User { login avatarUrl name } ... on Team { slug } } } }
  reviewThreads(last: 50) { nodes { id isResolved path line originalLine comments(first: 1) { totalCount nodes { body author { login avatarUrl } } } } }
`

const query = (ci: boolean) => `query($owner: String!, $name: String!, $cursor: String) {
  viewer { login }
  rateLimit { remaining limit cost }
  repository(owner: $owner, name: $name) {
    defaultBranchRef { name }
    pullRequests(states: OPEN, first: 20, after: $cursor, orderBy: { field: UPDATED_AT, direction: DESC }) {
      pageInfo { hasNextPage endCursor }
      nodes { ${prFields(ci)} }
    }
  }
}`

interface GhActor { login?: string, slug?: string, name?: string, avatarUrl?: string }
interface GhCommit { oid: string, abbreviatedOid: string, messageHeadline: string, committedDate: string, authoredDate: string }
interface GhPr {
  number: number
  title: string
  body: string
  url: string
  isDraft: boolean
  createdAt: string
  updatedAt: string
  headRefName: string
  headRefOid: string
  baseRefName: string
  mergeable: string
  mergeStateStatus: string
  reviewDecision: string | null
  author: GhActor | null
  labels: { nodes: { name: string, color: string, description: string | null }[] }
  comments: { totalCount: number }
  commits: { totalCount: number, nodes: { commit: GhCommit }[] }
  head?: { nodes: { commit: { statusCheckRollup: { state: string } | null } }[] }
  reviews: { nodes: { state: string, submittedAt: string, author: GhActor | null, commit: { oid: string } | null }[] }
  reviewRequests: { nodes: { requestedReviewer: GhActor | null }[] }
  reviewThreads: { nodes: { id: string, isResolved: boolean, path: string, line: number | null, originalLine: number | null, comments: { totalCount: number, nodes: { body: string, author: GhActor | null }[] } }[] }
}
interface GhResponse {
  errors?: { message: string }[]
  data: {
    viewer: { login: string }
    rateLimit: { remaining: number, limit: number, cost: number }
    repository: { defaultBranchRef: { name: string } | null, pullRequests: { pageInfo: { hasNextPage: boolean, endCursor: string }, nodes: GhPr[] } }
  }
}
interface RepoData extends RepoRef {
  viewer: string
  rate: GhResponse['data']['rateLimit']
  defaultBranch: string | null
  prs: GhPr[]
}

async function fetchRepo({ owner, name }: RepoRef, ci: boolean): Promise<RepoData> {
  const prs: GhPr[] = []
  let cursor: string | null = null
  let res!: GhResponse
  for (let page = 0; page < 15; page++) {
    const args = ['api', 'graphql', '-f', `query=${query(ci)}`, '-F', `owner=${owner}`, '-F', `name=${name}`]
    if (cursor) args.push('-f', `cursor=${cursor}`)
    res = await gh<GhResponse>(args).catch((e: Error) => {
      throw new Error(`${owner}/${name}: ${e.message}`, { cause: e })
    })
    if (res.errors) throw new Error(`${owner}/${name}: ${res.errors.map(e => e.message).join('; ')}`)
    const conn = res.data.repository.pullRequests
    prs.push(...conn.nodes)
    if (!conn.pageInfo.hasNextPage) break
    cursor = conn.pageInfo.endCursor
  }
  return { owner, name, viewer: res.data.viewer.login, rate: res.data.rateLimit, defaultBranch: res.data.repository.defaultBranchRef?.name ?? null, prs }
}

const CI: Record<string, PullRequest['ci']> = { SUCCESS: 'success', FAILURE: 'failure', ERROR: 'failure', PENDING: 'running', EXPECTED: 'running' }
const DECIDING = new Set(['APPROVED', 'CHANGES_REQUESTED'])

function normalize(repos: RepoData[], { approvals, fresh }: Pick<SyncOptions, 'approvals' | 'fresh'>) {
  const people: Record<string, Person> = {}
  const labels: Record<string, Label> = {}
  const person = (a: GhActor | null | undefined) => {
    const login = a?.login || a?.slug || 'ghost'
    people[login] ||= { n: a?.name || login, login, avatar: a?.avatarUrl || null, team: !!a?.slug }
    return login
  }
  const seen = new Set<string>(), dup = new Set<string>()
  repos.forEach(r => (seen.has(r.name) ? dup.add(r.name) : seen.add(r.name)))
  const repoKey = (r: RepoRef) => (dup.has(r.name) ? `${r.owner}/${r.name}` : r.name)

  const prs: PullRequest[] = []
  for (const r of repos) {
    const repo = repoKey(r)
    for (const n of r.prs) {
      const commits = n.commits.nodes.map(c => c.commit)
      const idx = new Map(commits.map((c, i) => [c.oid, i]))
      const commitsAfter = (rv: GhPr['reviews']['nodes'][number]) => {
        if (rv.commit && idx.has(rv.commit.oid)) return commits.length - 1 - idx.get(rv.commit.oid)!
        const t = Date.parse(rv.submittedAt)
        const rewritten = commits.filter(c => Date.parse(c.committedDate) > t).length
        if (rewritten < commits.length) return rewritten
        return commits.filter(c => Date.parse(c.authoredDate) > t).length
      }

      const author = person(n.author)
      const byReviewer = new Map<string, Review>()
      for (const rv of n.reviews.nodes) {
        if (!rv.author || rv.state === 'PENDING') continue
        const login = person(rv.author)
        if (login === author) continue
        const prev = byReviewer.get(login)
        if (rv.state === 'DISMISSED') {
          if (prev && DECIDING.has(prev.s)) byReviewer.delete(login)
          continue
        }
        if (prev && DECIDING.has(prev.s) && !DECIDING.has(rv.state)) continue
        byReviewer.set(login, { by: login, s: rv.state as Review['s'], after: commitsAfter(rv), at: rv.submittedAt })
      }
      for (const rq of n.reviewRequests.nodes) {
        if (!rq.requestedReviewer) continue
        const login = person(rq.requestedReviewer)
        const prev = byReviewer.get(login)
        if (!prev) byReviewer.set(login, { by: login, s: 'REQUESTED', after: 0 })
        else prev.rerequested = true
      }
      const reviews = [...byReviewer.values()]

      n.labels.nodes.forEach((l) => {
        labels[l.name] = { c: /^[0-9a-f]{6}$/i.test(l.color) ? `#${l.color}` : '#7A8292', d: l.description || '' }
      })
      const threads = n.reviewThreads.nodes.filter(t => !t.isResolved).map((t) => {
        const c = t.comments.nodes[0]
        const line = t.line || t.originalLine
        return { id: t.id, by: person(c?.author), f: `${t.path}${line ? `:${line}` : ''}`, t: c?.body || '' }
      })
      const threadComments = n.reviewThreads.nodes.reduce((a, t) => a + t.comments.totalCount, 0)
      const rollup = n.head?.nodes[0]?.commit.statusCheckRollup

      let status: PrStatus
      if (n.isDraft) status = 'draft'
      else if (n.mergeable === 'CONFLICTING') status = 'conflict'
      else if (n.reviewDecision === 'CHANGES_REQUESTED' || (!n.reviewDecision && reviews.some(x => x.s === 'CHANGES_REQUESTED'))) status = 'changes'
      else if (!threads.length && reviews.filter(x => x.s === 'APPROVED' && (!fresh || x.after === 0)).length >= approvals) status = 'approved'
      else status = 'review'

      prs.push({
        id: `${repo}#${n.number}`, repo, slug: `${r.owner}/${r.name}`, num: n.number, url: n.url,
        author, title: n.title, body: n.body || '', draft: n.isDraft,
        head: n.headRefName, base: n.baseRefName, headOid: n.headRefOid,
        conflict: n.mergeable === 'CONFLICTING', behind: n.mergeStateStatus === 'BEHIND', mergeable: n.mergeable,
        status, ci: CI[rollup?.state ?? ''] || 'none',
        createdAt: n.createdAt, updatedAt: n.updatedAt, labels: n.labels.nodes.map(l => l.name), reviews,
        commits: commits.map(c => [c.abbreviatedOid, c.messageHeadline, c.committedDate]), commitCount: n.commits.totalCount,
        threads, comments: n.comments.totalCount + threadComments, dependsOn: [], links: [],
      })
    }
  }

  const open = new Map(prs.map(p => [`${p.slug.toLowerCase()}#${p.num}`, p]))
  const tracked = new Map(repos.map(r => [r.name.toLowerCase(), `${r.owner}/${r.name}`]))
  const elsewhere = new Map<PullRequest, string[]>()
  for (const p of prs) {
    const deps = new Set<string>(), other = new Set<string>()
    for (const key of mentions(p.body, p.slug, tracked)) {
      const target = open.get(key.toLowerCase())
      if (target?.id === p.id) continue
      if (target) deps.add(target.id)
      else other.add(key)
    }
    p.dependsOn = [...deps]
    elsewhere.set(p, [...other])
  }
  return { prs, people, labels, elsewhere }
}

const MAX_BODY = 20_000
const MAX_PER_PR = 30

function mentions(body: string, slug: string, tracked: Map<string, string>) {
  const text = body.slice(0, MAX_BODY).replace(/(```|~~~)[\s\S]*?\1|`[^`\n]*`/g, ' ')
  const keys = new Set<string>()
  const add = (repo: string, n: string) => {
    const num = Number(n)
    if (num > 0 && num < 2 ** 31 && keys.size < MAX_PER_PR) keys.add(`${repo.toLowerCase()}#${num}`)
  }
  const url = /https?:\/\/github\.com\/([\w.-]{1,100}\/[\w.-]{1,100})\/(?:pull|issues)\/(\d{1,10})/gi
  for (const m of text.matchAll(url)) add(m[1]!, m[2]!)
  for (const m of text.replace(url, ' ').matchAll(/(?<![\w.\-/#&:])((?:[\w.-]{1,100}\/)?[\w.-]{1,100})?#(\d{1,10})\b/g)) {
    const ref = m[1] && !/^(pr|pull|issue|gh)$/i.test(m[1]) ? m[1] : undefined
    const repo = !ref ? slug : ref.includes('/') ? ref : tracked.get(ref.toLowerCase())
    if (repo) add(repo, m[2]!)
  }
  return keys
}

const linkCache = new Map<string, LinkedPr | null>()
const repoDown = new Map<string, number>()
const RETRY_MS = 30 * 60_000
const MAX_LOOKUPS = 100
const CONCURRENCY = 4

interface GhLinked extends Pick<GhPr, 'head'> { __typename: string, title: string, url: string, isDraft: boolean, state: 'OPEN' | 'CLOSED' | 'MERGED' }

async function lookupLinks(keys: string[], ci: boolean) {
  const found = new Map<string, LinkedPr | null>()
  const failed = new Set<string>()
  const bySlug = new Map<string, number[]>()
  let budget = MAX_LOOKUPS
  for (const key of keys) {
    if (linkCache.has(key)) {
      found.set(key, linkCache.get(key)!)
      continue
    }
    const [repo, num] = key.split('#') as [string, string]
    if (Date.now() - (repoDown.get(repo) ?? 0) < RETRY_MS) {
      failed.add(repo)
      continue
    }
    const list = bySlug.get(repo) ?? []
    if (budget > 0 && !list.includes(Number(num))) {
      bySlug.set(repo, [...list, Number(num)])
      budget--
    }
  }
  let cost = 0
  const queue = [...bySlug]
  const worker = async () => {
    for (let job = queue.shift(); job; job = queue.shift()) {
      const [repo, nums] = job
      const [owner, name] = repo.split('/') as [string, string]
      const q = `query { rateLimit { cost } repository(owner: ${JSON.stringify(owner)}, name: ${JSON.stringify(name)}) {
        ${nums.map(n => `n${n}: issueOrPullRequest(number: ${n}) { __typename ... on PullRequest { title url isDraft state ${ci ? 'head: commits(last: 1) { nodes { commit { statusCheckRollup { state } } } }' : ''} } }`).join('\n')}
      } }`
      try {
        const res = await gh<{ data: { rateLimit?: { cost: number }, repository: Record<string, GhLinked | null> | null } }>(['api', 'graphql', '-f', `query=${q}`], { partial: true })
        if (!res.data.repository) throw new Error('repository not found')
        cost += res.data.rateLimit?.cost ?? 0
        for (const n of nums) {
          const x = res.data.repository[`n${n}`]
          const link = x?.__typename === 'PullRequest' ? { ref: `${x.url.split('/')[4]}#${n}`, url: x.url, title: x.title, state: x.state === 'OPEN' && x.isDraft ? 'draft' : x.state.toLowerCase() as LinkedPr['state'], ci: ci ? CI[x.head?.nodes[0]?.commit.statusCheckRollup?.state ?? ''] || 'none' : undefined } : null
          found.set(`${repo}#${n}`, link)
          if (!link || link.state === 'merged') linkCache.set(`${repo}#${n}`, link)
        }
      }
      catch {
        repoDown.set(repo, Date.now())
        failed.add(repo)
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker))
  return { found, failed: [...failed], cost }
}

const inflight = new Map<string, Promise<Snapshot>>()

export function getSnapshot(opts: SyncOptions): Promise<Snapshot> {
  const key = JSON.stringify(opts)
  const running = inflight.get(key)
  if (running) return running
  const { ci } = opts
  const next = (async () => {
    if (!opts.repos.length) throw new Error(NO_REPOS)
    const refs = opts.repos.map((r) => {
      const [owner, name] = r.split('/') as [string, string]
      return { owner, name }
    })
    const repos = await Promise.all(refs.map(r => fetchRepo(r, ci)))
    const { prs, people, labels, elsewhere } = normalize(repos, opts)
    const links = await lookupLinks([...elsewhere.values()].flat(), ci)
    for (const [p, keys] of elsewhere) {
      p.links = keys.map(k => links.found.get(k)).filter((l): l is LinkedPr => !!l)
    }
    const rate = repos.reduce((a, r) => (r.rate.remaining < a.remaining ? r.rate : a), repos[0]!.rate)
    return {
      me: repos[0]!.viewer, ci, prs, people, labels, rate,
      repos: repos.map(r => ({ key: dup(repos, r) ? `${r.owner}/${r.name}` : r.name, slug: `${r.owner}/${r.name}`, defaultBranch: r.defaultBranch })),
      cost: repos.reduce((a, r) => a + r.rate.cost, links.cost),
      at: new Date().toISOString(),
      linkErrors: links.failed,
      settings: { repos: opts.repos, approvals: opts.approvals, fresh: opts.fresh },
    }
  })().finally(() => inflight.delete(key))
  inflight.set(key, next)
  return next
}

const dup = (repos: RepoRef[], r: RepoRef) => repos.filter(o => o.name === r.name).length > 1
