// Marks a GitHub notification thread as read: { read: "<thread id>" }, or every notification of some repositories: { repos: ["o/r"] }
export default defineEventHandler(async (event) => {
  const body = await readBody<{ read?: unknown, repos?: unknown } | null>(event).catch(() => null)
  const repos = Array.isArray(body?.repos) ? body.repos.map(String) : null
  const read = String(body?.read ?? '')
  if (repos ? repos.some(r => !/^[\w.-]+\/[\w.-]+$/.test(r)) : !/^\d{1,20}$/.test(read)) throw createError({ statusCode: 400, statusMessage: 'bad thread id' })
  if (process.env.PR_STACKS_DEMO === '1') return { ok: true }
  try {
    if (repos) await Promise.all(repos.map(markRepoRead))
    else await markRead(read)
    return { ok: true }
  }
  catch (e) {
    throw createError({ statusCode: 502, statusMessage: 'gh api notifications failed', data: { error: (e as Error).message } })
  }
})
