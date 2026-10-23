import { execFile } from 'node:child_process'
import type { GhStatus } from '#shared/types/pr'

const run = (args: string[]) => new Promise<{ code: number | string | null, out: string }>((resolve) => {
  execFile('gh', args, { timeout: 15_000, windowsHide: true }, (err, stdout, stderr) => {
    resolve({ code: err ? ((err as NodeJS.ErrnoException).code ?? 1) : 0, out: `${stdout}\n${stderr}`.trim() })
  })
})

export default defineEventHandler(async (event): Promise<GhStatus> => {
  setHeader(event, 'cache-control', 'no-store')
  if (process.env.PR_STACKS_DEMO === '1') return { state: 'ok', version: 'demo', login: 'demo', host: 'github.com' }
  const ver = await run(['--version'])
  if (ver.code === 'ENOENT') return { state: 'missing' }
  const version = ver.out.match(/gh version (\S+)/)?.[1] ?? null
  if (ver.code !== 0) return { state: 'error', version, detail: ver.out.slice(0, 400) }
  const auth = await run(['auth', 'status', '--hostname', 'github.com'])
  // "Logged in to github.com as X" (gh < 2.40) or "Logged in to github.com account X" (newer)
  const m = auth.out.match(/Logged in to (\S+) (?:as|account) ([\w-]+)/)
  if (auth.code === 0 && m) return { state: 'ok', version, host: m[1]!, login: m[2]! }
  return { state: 'unauthenticated', version, detail: auth.out.slice(0, 400) }
})
