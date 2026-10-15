export type ReviewState = 'APPROVED' | 'CHANGES_REQUESTED' | 'COMMENTED' | 'REQUESTED'
export type PrStatus = 'draft' | 'conflict' | 'changes' | 'approved' | 'review'
export type CiState = 'success' | 'failure' | 'running' | 'none'

export interface Review {
  by: string
  s: ReviewState
  after: number
  at?: string
  rerequested?: boolean
}

export interface Thread {
  id: string
  by: string
  f: string
  t: string
}

export interface PullRequest {
  id: string
  repo: string
  slug: string
  num: number
  url: string
  author: string
  title: string
  body: string
  draft: boolean
  head: string
  base: string
  headOid: string
  conflict: boolean
  behind: boolean
  mergeable: string
  status: PrStatus
  ci: CiState
  updatedAt: string
  labels: string[]
  reviews: Review[]
  commits: [string, string, string][]
  commitCount: number
  threads: Thread[]
  comments: number
  dependsOn: string[]
  links: LinkedPr[]
}

export interface LinkedPr {
  ref: string
  url: string
  title: string
  state: 'open' | 'draft' | 'merged' | 'closed'
}

export interface Person {
  n: string
  login: string
  avatar: string | null
  team: boolean
}

export interface Label {
  c: string
  d: string
}

export interface RepoInfo {
  key: string
  slug: string
  defaultBranch: string | null
}

export interface Snapshot {
  me: string
  ci: boolean
  prs: PullRequest[]
  people: Record<string, Person>
  labels: Record<string, Label>
  rate: { remaining: number, limit: number, cost: number }
  repos: RepoInfo[]
  cost: number
  at: string
  linkErrors: string[]
  settings: SyncSettings
}

export interface SyncSettings {
  repos: string[]
  approvals: number
  fresh: boolean
}
