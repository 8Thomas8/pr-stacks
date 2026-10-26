import type { LinkedPr, PullRequest, RepoInfo } from '#shared/types/pr'

export type Rel = { k: 'behind' } | { k: 'dep' | 'block', o: PullRequest } | { k: 'link', l: LinkedPr }
export function relKey(r: Rel) {
  if (r.k === 'behind') return r.k
  if (r.k === 'link') return r.l.url
  return r.k + r.o.id
}

export interface BandBase { id: string, repo: string, name: string }
export interface Band {
  key: string
  kind: 'stack' | 'solo'
  base: BandBase
  tops: PullRequest[]
  items: PullRequest[]
  depth: Record<string, number>
}
export interface Forest {
  bands: Band[]
  kids: (id: string) => PullRequest[]
  parentOf: (p: PullRequest) => PullRequest | undefined
}

export const levels = (b: Band) => b.items.reduce<PullRequest[][]>((acc, p) => {
  (acc[b.depth[p.id] ?? 0] ??= []).push(p)
  return acc
}, [])

export const isDefaultBranch = (repos: RepoInfo[], repo: string, name: string) =>
  repos.find(r => r.key === repo)?.defaultBranch === name || name === 'main' || name === 'master'

export function buildForest(prs: PullRequest[], repos: RepoInfo[]): Forest {
  const byHead = new Map(prs.map(p => [`${p.repo}\0${p.head}`, p]))
  const parentOf = (p: PullRequest) => byHead.get(`${p.repo}\0${p.base}`)
  const roots = new Map<string, BandBase>()
  const children = new Map<string, PullRequest[]>()
  for (const p of prs) {
    const parent = parentOf(p)
    const key = parent ? parent.id : `${p.repo}:${p.base}`
    if (!parent && !roots.has(key)) roots.set(key, { id: key, repo: p.repo, name: p.base })
    if (!children.has(key)) children.set(key, [])
    children.get(key)!.push(p)
  }
  children.forEach(list => list.sort((a, b) => a.num - b.num))
  const kids = (id: string) => children.get(id) || []

  const rank = (r: BandBase) => [repos.findIndex(x => x.key === r.repo), isDefaultBranch(repos, r.repo, r.name) ? 0 : 1] as const
  const ordered = [...roots.values()].sort((a, b) => {
    const ra = rank(a), rb = rank(b)
    return ra[0] - rb[0] || ra[1] - rb[1] || a.name.localeCompare(b.name)
  })

  const flatten = (tops: PullRequest[]) => {
    const items: PullRequest[] = [], depth: Record<string, number> = {}
    const walk = (p: PullRequest, d: number) => {
      depth[p.id] = d
      items.push(p)
      kids(p.id).forEach(c => walk(c, d + 1))
    }
    tops.forEach(t => walk(t, 0))
    return { items, depth }
  }
  const stacks: Band[] = [], solos: Band[] = []
  for (const r of ordered) {
    const top = kids(r.id)
    if (!isDefaultBranch(repos, r.repo, r.name)) {
      stacks.push({ key: `stack:${top.map(t => t.id).join(',')}`, kind: 'stack', base: r, tops: top, ...flatten(top) })
      continue
    }
    for (const p of top.filter(p => kids(p.id).length)) stacks.push({ key: `stack:${p.id}`, kind: 'stack', base: r, tops: [p], ...flatten([p]) })
    const solo = top.filter(p => !kids(p.id).length)
    if (solo.length) solos.push({ key: `solo:${r.id}`, kind: 'solo', base: r, tops: solo, items: solo, depth: {} })
  }
  return { bands: [...stacks, ...solos], kids, parentOf }
}
