import type { Label, LinkedPr, Person, PullRequest, Review, Snapshot, Thread } from '#shared/types/pr'
import type { SyncOptions } from './github'

const H = 3600_000
const ago = (h: number) => new Date(Date.now() - h * H).toISOString()

const PEOPLE: Record<string, Person> = Object.fromEntries([
  ['alice-m', 'Alice Martin'], ['bruno-p', 'Bruno Petit'], ['chloe-d', 'Chloé Durand'],
  ['david-l', 'David Leroy'], ['emma-g', 'Emma Garnier'], ['farid-b', 'Farid Benali'],
].map(([login, n]) => [login, { login: login!, n: n!, avatar: null, team: false }]))

const LABELS: Record<string, Label> = {
  bug: { c: '#D73A4A', d: 'Something is not working' },
  feature: { c: '#2DA8B8', d: 'New user-facing feature' },
  refactor: { c: '#8DA2C9', d: 'No behaviour change' },
  security: { c: '#B60205', d: 'Security sensitive' },
  ui: { c: '#E4B400', d: 'Visual change' },
  dependencies: { c: '#0366D6', d: 'Dependency upgrade' },
  docs: { c: '#0075CA', d: 'Documentation' },
}

interface Seed {
  repo: 'web' | 'api'
  num: number
  author: string
  title: string
  body: string
  head: string
  base: string
  updated: number
  labels?: string[]
  draft?: boolean
  conflict?: boolean
  behind?: boolean
  reviews?: Review[]
  commits: string[]
  threads?: Omit<Thread, 'id'>[]
  comments?: number
  dependsOn?: string[]
  links?: LinkedPr[]
  ci?: PullRequest['ci']
}

const sha = (n: number, i: number) => ((n * 7919 + i * 104729) % 0xFFFFFFF).toString(16).padStart(7, '0')

const SEEDS: Seed[] = [
  {
    repo: 'web', num: 409, author: 'bruno-p', title: 'Checkout: extract price computation', head: 'feat/price-module', base: 'main', updated: 3, labels: ['refactor'],
    body: 'Pulls price, VAT and rounding out of the cart component into a tested module.\n\n## Checks\n- [x] unit tests for rounding\n- [x] same totals on the 40 fixture carts\n- [ ] remove the old helper\n\nDesign notes: [pricing module](https://example.com/docs/pricing).',
    reviews: [{ by: 'alice-m', s: 'APPROVED', after: 2, at: ago(30) }, { by: 'emma-g', s: 'CHANGES_REQUESTED', after: 0, at: ago(4) }],
    commits: ['Move price helpers to pricing/', 'Add rounding tests', 'Handle zero VAT countries', 'Rename computeTotal to priceCart'],
    threads: [{ by: 'emma-g', f: 'src/pricing/vat.ts:42', t: 'Rounding per line or on the total? The invoice service rounds **per line**, see `roundLine()`:\n\n```suggestion\nconst vat = lines.reduce((s, l) => s + roundLine(l.vat), 0)\n```' }, { by: 'emma-g', f: 'src/pricing/index.ts:8', t: 'Can we keep the old export for one release?' }],
    comments: 3, ci: 'success',
  },
  {
    repo: 'web', num: 411, author: 'bruno-p', title: 'Checkout: discount codes', head: 'feat/discount-codes', base: 'feat/price-module', updated: 1, labels: ['feature'],
    body: 'Lets customers apply a discount code at checkout. Uses the new pricing module from #409.\n\nNeeds the API side: acme/api#209. Badge colours come from acme/design-system#88.\n\n| Case | Result |\n| --- | --- |\n| expired code | inline error |\n| code on sale item | ignored |',
    reviews: [{ by: 'alice-m', s: 'REQUESTED', after: 0 }, { by: 'chloe-d', s: 'REQUESTED', after: 0 }],
    commits: ['Discount code field', 'Apply code to cart total', 'Error states'], dependsOn: ['api#209'],
    links: [{ ref: 'design-system#88', url: 'https://github.com/acme/design-system/pull/88', title: 'Tokens: discount badge colours', state: 'merged' }],
    ci: 'running',
  },
  {
    repo: 'web', num: 412, author: 'alice-m', title: 'Auth: session store and token refresh', head: 'auth/session-store', base: 'main', updated: 20, labels: ['feature', 'security'],
    body: 'Moves sessions to a server-side store and refreshes the access token before it expires.\n\n> Tokens now live 15 min, refresh tokens 30 days.',
    reviews: [{ by: 'bruno-p', s: 'APPROVED', after: 0, at: ago(18) }, { by: 'chloe-d', s: 'APPROVED', after: 0, at: ago(16) }],
    commits: ['Session store on Redis', 'Refresh token rotation', 'Logout clears the store'], comments: 2, ci: 'success',
  },
  {
    repo: 'web', num: 415, author: 'alice-m', title: 'Auth: login and logout pages', head: 'auth/login-pages', base: 'auth/session-store', updated: 5, labels: ['feature', 'ui'],
    body: 'New login and logout pages on top of the session store. Errors are shown inline.\n\nMobile counterpart: acme/mobile#52. Uses the helper from acme/auth-sdk#31.',
    reviews: [{ by: 'bruno-p', s: 'APPROVED', after: 2, at: ago(26) }, { by: 'chloe-d', s: 'COMMENTED', after: 0, at: ago(6) }, { by: 'david-l', s: 'REQUESTED', after: 0 }],
    commits: ['Login page', 'Logout page', 'Inline errors', 'Remember the last email'],
    threads: [{ by: 'chloe-d', f: 'src/pages/login.vue:61', t: 'The error should be announced to screen readers.' }], comments: 1,
    links: [
      { ref: 'mobile#52', url: 'https://github.com/acme/mobile/pull/52', title: 'Login screen v2', state: 'open' },
      { ref: 'auth-sdk#31', url: 'https://github.com/acme/auth-sdk/pull/31', title: 'Refresh token helper', state: 'draft' },
    ],
    ci: 'success',
  },
  {
    repo: 'web', num: 418, author: 'alice-m', title: 'Auth: remember me and SSO buttons', head: 'auth/sso-buttons', base: 'auth/login-pages', updated: 2, labels: ['feature'], draft: true,
    body: 'WIP: "remember me" checkbox and Google / GitHub SSO buttons.', commits: ['Remember me checkbox', 'SSO buttons'],
  },
  {
    repo: 'web', num: 420, author: 'farid-b', title: 'Fix: header overlaps the cookie banner on mobile', head: 'fix/header-cookie-banner', base: 'main', updated: 7, labels: ['bug', 'ui'],
    body: 'The sticky header covered the cookie banner below 380 px. Fixes #397.',
    reviews: [{ by: 'alice-m', s: 'APPROVED', after: 0, at: ago(6) }, { by: 'david-l', s: 'APPROVED', after: 0, at: ago(5) }],
    commits: ['Lower the header z-index under the banner'], ci: 'success',
  },
  {
    repo: 'web', num: 423, author: 'david-l', title: 'Upgrade the charts library to v5', head: 'deps/charts-v5', base: 'main', updated: 9, labels: ['dependencies'], conflict: true,
    body: 'v5 drops the canvas renderer. Breaking changes are listed in acme/charts#640.',
    reviews: [{ by: 'chloe-d', s: 'COMMENTED', after: 1, at: ago(30) }],
    commits: ['Bump charts to 5.0', 'Port the sales chart', 'Port the stock chart'],
    links: [{ ref: 'charts#640', url: 'https://github.com/acme/charts/pull/640', title: 'Breaking changes for v5', state: 'closed' }],
    ci: 'failure',
  },
  {
    repo: 'web', num: 425, author: 'chloe-d', title: 'Docs: contributing guide', head: 'docs/contributing', base: 'main', updated: 30, labels: ['docs'], draft: true,
    body: 'First draft of CONTRIBUTING.md: branches, stacks, review rules.', commits: ['Contributing guide draft'],
  },
  {
    repo: 'api', num: 207, author: 'emma-g', title: 'Orders: add a discount field', head: 'orders/discount-field', base: 'main', updated: 4, labels: ['feature'],
    body: 'Adds `discount_cents` to orders, with a migration and a default of 0.',
    reviews: [{ by: 'alice-m', s: 'REQUESTED', after: 0 }, { by: 'farid-b', s: 'APPROVED', after: 0, at: ago(3) }],
    commits: ['Migration: discount_cents', 'Expose the field in the order API'], ci: 'success',
  },
  {
    repo: 'api', num: 209, author: 'emma-g', title: 'Orders: validate discount codes', head: 'orders/discount-codes', base: 'orders/discount-field', updated: 2, labels: ['feature'],
    body: 'Validates codes server side: expiry, usage limit, excluded items. Builds on the money type from #198.',
    reviews: [{ by: 'alice-m', s: 'REQUESTED', after: 0 }],
    commits: ['Code validation service', 'Usage limit', 'Excluded items'],
    links: [{ ref: 'api#198', url: 'https://github.com/acme/api/pull/198', title: 'Orders: money type', state: 'merged' }],
    ci: 'running',
  },
  {
    repo: 'api', num: 211, author: 'farid-b', title: 'Rate limit the public endpoints', head: 'sec/rate-limit', base: 'main', updated: 12, labels: ['security'],
    body: '100 requests per minute per key, 429 with a `Retry-After` header.',
    reviews: [{ by: 'alice-m', s: 'APPROVED', after: 0, at: ago(10) }, { by: 'chloe-d', s: 'APPROVED', after: 0, at: ago(11) }],
    commits: ['Token bucket middleware', 'Retry-After header'], ci: 'success',
  },
  {
    repo: 'api', num: 214, author: 'david-l', title: 'Remove the legacy v1 routes', head: 'chore/drop-v1', base: 'main', updated: 26, behind: true,
    body: 'No traffic on /v1 for 60 days.',
    reviews: [{ by: 'emma-g', s: 'APPROVED', after: 1, at: ago(40) }],
    commits: ['Drop /v1 routes', 'Remove v1 serializers'], ci: 'success',
  },
]

export function demoSnapshot({ ci, approvals, fresh }: Pick<SyncOptions, 'ci' | 'approvals' | 'fresh'>): Snapshot {
  const prs: PullRequest[] = SEEDS.map((s) => {
    const reviews = s.reviews ?? []
    const ok = reviews.filter(r => r.s === 'APPROVED' && (!fresh || r.after === 0)).length
    let status: PullRequest['status']
    if (s.draft) status = 'draft'
    else if (s.conflict) status = 'conflict'
    else if (reviews.some(r => r.s === 'CHANGES_REQUESTED')) status = 'changes'
    else if (ok >= approvals && !s.threads?.length) status = 'approved'
    else status = 'review'
    const n = s.commits.length
    const oldest = Math.max(s.updated + n * 5, ...reviews.filter(r => r.at).map(r => (Date.now() - Date.parse(r.at!)) / H))
    return {
      id: `${s.repo}#${s.num}`, repo: s.repo, slug: `acme/${s.repo}`, num: s.num, url: `https://github.com/acme/${s.repo}/pull/${s.num}`,
      author: s.author, title: s.title, body: s.body, draft: !!s.draft,
      head: s.head, base: s.base, headOid: sha(s.num, n), conflict: !!s.conflict, behind: !!s.behind, mergeable: s.conflict ? 'CONFLICTING' : 'MERGEABLE',
      status, ci: ci ? s.ci ?? 'none' : 'none', createdAt: ago(oldest + 3), updatedAt: ago(s.updated), labels: s.labels ?? [], reviews,
      commits: s.commits.map((m, i) => [sha(s.num, i), m, ago(s.updated + (n - i) * 5)]), commitCount: n,
      threads: (s.threads ?? []).map((t, i) => ({ ...t, id: `${s.repo}#${s.num}/${i}` })), comments: (s.comments ?? 0) + (s.threads?.length ?? 0),
      dependsOn: s.dependsOn ?? [], links: s.links ?? [],
    }
  })
  return {
    me: 'alice-m', ci, prs, people: PEOPLE, labels: LABELS,
    rate: { remaining: 4870, limit: 5000, cost: 2 },
    repos: [{ key: 'web', slug: 'acme/web', defaultBranch: 'main' }, { key: 'api', slug: 'acme/api', defaultBranch: 'main' }],
    cost: 2, at: new Date().toISOString(), linkErrors: [],
    settings: { repos: ['acme/web', 'acme/api'], approvals, fresh },
  }
}
