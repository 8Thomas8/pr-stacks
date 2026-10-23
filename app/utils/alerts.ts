import type { PullRequest, Snapshot } from '#shared/types/pr'
import { buildForest } from './stacks'

export type MineKind = 'approved' | 'changes' | 'comments' | 'ci' | 'conflict' | 'parent'
export interface MineAlert {
  kind: MineKind
  pr: PullRequest
  // reviewers or commenters behind it, or the parent PR that is gone
  who?: string[]
  parent?: string
}

// What changed on my own PRs between two syncs of the same repositories. A PR that was not open in
// `prev` is skipped: there is nothing to compare it to.
export function mineAlerts(prev: Snapshot, next: Snapshot): MineAlert[] {
  const me = next.me
  const before = new Map(prev.prs.map(p => [p.id, p]))
  const open = new Set(next.prs.map(p => p.id))
  const prevForest = buildForest(prev.prs, prev.repos)
  const alerts: MineAlert[] = []
  for (const p of next.prs) {
    const o = before.get(p.id)
    if (!o || p.author !== me) continue

    if (p.status === 'approved' && o.status !== 'approved') alerts.push({ kind: 'approved', pr: p })

    const asked = (x: PullRequest) => x.reviews.filter(r => r.s === 'CHANGES_REQUESTED').map(r => r.by)
    const wasAsked = new Set(asked(o))
    const nowAsked = asked(p).filter(by => !wasAsked.has(by))
    if (nowAsked.length) alerts.push({ kind: 'changes', pr: p, who: nowAsked })

    const known = new Set(o.threads.map(t => t.id))
    const who = new Set(p.threads.filter(t => !known.has(t.id) && t.by !== me).map(t => t.by))
    if (p.comments > o.comments && p.lastComment && p.lastComment !== me) who.add(p.lastComment)
    if (who.size) alerts.push({ kind: 'comments', pr: p, who: [...who] })

    if (prev.ci && next.ci && p.ci === 'failure' && o.ci !== 'failure') alerts.push({ kind: 'ci', pr: p })

    if (p.conflict && !o.conflict && !p.draft) alerts.push({ kind: 'conflict', pr: p })

    // the PR it was stacked on (by branch or by an explicit "depends on" link) is no longer open
    const parents = new Set([prevForest.parentOf(o)?.id, ...o.dependsOn].filter((id): id is string => !!id))
    const gone = [...parents].find(id => !open.has(id))
    if (gone) alerts.push({ kind: 'parent', pr: p, parent: gone })
  }
  return alerts
}
