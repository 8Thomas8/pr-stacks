import type { Inbox } from '#shared/types/pr'

export default defineEventHandler(async (event): Promise<Inbox> => {
  setHeader(event, 'cache-control', 'no-store')
  if (process.env.PR_STACKS_DEMO === '1') return { modified: false, lastModified: null, poll: 60, items: [] }
  const since = getQuery(event).since
  try {
    return await getInbox(typeof since === 'string' ? since : undefined)
  }
  catch (e) {
    throw createError({ statusCode: 502, statusMessage: 'gh api notifications failed', data: { error: (e as Error).message } })
  }
})
