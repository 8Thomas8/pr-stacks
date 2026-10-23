// Marks a GitHub notification thread as read: { read: "<thread id>" }
export default defineEventHandler(async (event) => {
  const { read } = await readBody<{ read?: unknown }>(event)
  if (process.env.PR_STACKS_DEMO === '1') return { ok: true }
  try {
    await markRead(String(read ?? ''))
    return { ok: true }
  }
  catch (e) {
    throw createError({ statusCode: 502, statusMessage: 'gh api notifications failed', data: { error: (e as Error).message } })
  }
})
