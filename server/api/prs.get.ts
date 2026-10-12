export default defineEventHandler(async (event) => {
  setHeader(event, 'cache-control', 'no-store')
  const q = getQuery(event)
  if (process.env.PR_STACKS_DEMO === '1') {
    return demoSnapshot({ ci: q.ci === '1', approvals: Math.min(10, Math.max(1, Number(q.approvals) || 2)), fresh: q.fresh === '1' })
  }
  const repos = String(q.repos ?? '').split(',').map(s => s.trim()).filter(s => SLUG.test(s)).slice(0, 30)
  const approvals = Math.min(10, Math.max(1, Math.round(Number(q.approvals)) || 1))
  try {
    return await getSnapshot({ ci: q.ci === '1', repos: [...new Set(repos)], approvals, fresh: q.fresh === '1' })
  }
  catch (e) {
    const error = (e as Error).message
    if (error === NO_REPOS) throw createError({ statusCode: 400, statusMessage: 'No repository', data: { error } })
    throw createError({ statusCode: 502, statusMessage: 'gh api graphql failed', data: { error } })
  }
})
