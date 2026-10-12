import type { PrStatus } from '#shared/types/pr'

export const STATUS_COLOR: Record<PrStatus, string> = { approved: 'var(--ok)', review: 'var(--accent)', changes: 'var(--warn)', conflict: 'var(--bad)', draft: 'var(--line-strong)' }
export const STATUS_CODE: Partial<Record<PrStatus, string>> = { conflict: 'mergeable = CONFLICTING', changes: 'reviewDecision = CHANGES_REQUESTED', approved: 'reviewDecision = APPROVED' }

export const stripComments = (body: string) => body.replace(/<!--[\s\S]*?-->/g, '').trim()

export interface TextPart { t: string, href?: string }
const LINK = /!?\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)|(https?:\/\/[^\s<>()]*[^\s<>().,;:!?'"])/g
function linkify(text: string): TextPart[] {
  const parts: TextPart[] = []
  let at = 0
  for (const m of text.matchAll(LINK)) {
    if (m.index > at) parts.push({ t: text.slice(at, m.index) })
    parts.push(m[3] ? { t: m[3], href: m[3] } : { t: m[1]!, href: m[2]! })
    at = m.index + m[0].length
  }
  if (at < text.length) parts.push({ t: text.slice(at) })
  return parts
}

export function preview(body: string): TextPart[] {
  const text = stripComments(body || '').replace(/^#+\s*/gm, '').replace(/^\s*[-*]\s+(\[[ x]\]\s*)?/gm, '')
  const parts = linkify(text).map(p => ({ ...p, t: (p.href ? p.t : p.t.replace(/[*`>]/g, '').replace(/(^|\W)_+|_+(?=\W|$)/g, '$1')).replace(/\s+/g, ' ') })).filter(p => p.t)
  if (parts.length) {
    parts[0]!.t = parts[0]!.t.trimStart()
    parts[parts.length - 1]!.t = parts[parts.length - 1]!.t.trimEnd()
  }
  return parts.filter(p => p.t)
}
