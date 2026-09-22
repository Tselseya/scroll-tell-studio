import { randomUUID, createHash } from 'node:crypto'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import cors from '@fastify/cors'
import cookie from '@fastify/cookie'
import Fastify from 'fastify'
import OpenAI from 'openai'
import { db } from '@scrolltell/db'
import { connectedAccounts, consentRecords, contentItems, contentVariants, destinations, jobs, organizationMembers, organizations, workspaces } from '@scrolltell/db/schema'
import { and, desc, eq } from 'drizzle-orm'
import { z } from 'zod'
import { beginOAuth, clearSession, completeOAuth, getAuthContext, getProviderConfig, requireAuth } from './auth.js'
import { createMcpServer } from './mcp.js'

const port = Number(process.env.PORT ?? 8787)
const host = process.env.HOST ?? (process.env.NODE_ENV === 'production' ? '0.0.0.0' : '127.0.0.1')
const app = Fastify({ logger: true })
await app.register(cookie)
await app.register(cors, { origin: process.env.WEB_ORIGIN ?? true, credentials: true })

async function ensureSeedData() {
  await db.insert(organizations).values({ id: 'default-org', name: 'Personal organization', slug: 'personal' }).onConflictDoNothing()
  await db.insert(workspaces).values({ id: 'personal', name: 'Personal workspace', slug: 'personal' }).onConflictDoNothing()
  const catalog = [['facebook', 'Facebook'], ['instagram', 'Instagram'], ['threads', 'Threads'], ['youtube', 'YouTube'], ['tiktok', 'TikTok'], ['x', 'X / Twitter']] as const
  for (const [key, label] of catalog) await db.insert(destinations).values({ id: key, key, label }).onConflictDoNothing()
}
await ensureSeedData()

const jsonBody = z.record(z.unknown())
const aiMessage = z.object({ role: z.enum(['user', 'assistant']), content: z.string().min(1).max(12000) })
const aiPayload = z.object({
  messages: z.array(aiMessage).min(1).max(20),
  draft: z.string().max(30000).optional(),
  action: z.enum(['chat', 'rewrite', 'shorten', 'expand', 'repurpose']).default('chat'),
})
const contentPayload = z.object({
  workspaceId: z.string().min(1).default('personal'), title: z.string().min(1).max(160), description: z.string().optional(),
  contentType: z.enum(['text', 'image', 'carousel', 'short_video', 'long_video']).default('text'),
  status: z.enum(['idea', 'draft', 'ready', 'scheduled', 'published', 'archived']).default('draft'), sourcePrompt: z.string().optional(),
})
const consentPayload = z.object({ purpose: z.enum(['terms_acknowledgement', 'privacy_notice', 'analytics', 'marketing', 'platform_automation', 'publish_confirmation']), choice: z.enum(['granted', 'declined', 'withdrawn']), policyVersion: z.string().min(1).max(80), source: z.string().min(1).max(80), locale: z.string().max(30).optional() })

async function getWorkspace(request: Parameters<typeof getAuthContext>[0], workspaceId: string) {
  const auth = await getAuthContext(request)
  if (!auth) return null
  const [workspace] = workspaceId === 'personal'
    ? await db.select().from(workspaces).where(eq(workspaces.organizationId, auth.organizationId)).limit(1)
    : await db.select().from(workspaces).where(and(eq(workspaces.id, workspaceId), eq(workspaces.organizationId, auth.organizationId))).limit(1)
  return workspace ? { auth, workspace } : null
}

app.get('/health', async () => ({ ok: true, service: 'scrolltell-server', timestamp: new Date().toISOString() }))

app.get('/auth/providers', async () => ({ github: !!getProviderConfig('github'), google: !!getProviderConfig('google') }))
app.get('/auth/:provider', async (request, reply) => {
  const provider = (request.params as { provider: string }).provider
  if (provider !== 'github' && provider !== 'google') return reply.code(404).send({ error: 'Unsupported OAuth provider' })
  if (!beginOAuth(reply, provider)) return reply.code(503).send({ error: `${provider} OAuth is not configured` })
})
app.get('/auth/:provider/callback', async (request, reply) => {
  const provider = (request.params as { provider: string }).provider
  if (provider !== 'github' && provider !== 'google') return reply.code(404).send({ error: 'Unsupported OAuth provider' })
  try {
    await completeOAuth(request, reply, provider)
    return reply.redirect(`${process.env.WEB_APP_URL ?? 'http://127.0.0.1:5173'}/`)
  } catch (error) {
    request.log.error(error)
    return reply.code(400).send({ error: error instanceof Error ? error.message : 'OAuth sign-in failed' })
  }
})
app.get('/api/auth/me', async (request, reply) => {
  const auth = await getAuthContext(request)
  if (!auth) return reply.code(401).send({ error: 'Authentication required' })
  return { user: auth.user, organizationId: auth.organizationId, role: auth.role }
})
app.post('/api/auth/logout', async (request, reply) => {
  clearSession(reply)
  return { ok: true }
})

app.get('/api/bootstrap', async (request, reply) => {
  const auth = await requireAuth(request, reply); if (!auth) return
  const workspace = await getWorkspace(request, 'personal'); if (!workspace) return reply.code(403).send({ error: 'Workspace access denied' })
  const [content, accounts, destinationRows, recentJobs] = await Promise.all([
    db.select().from(contentItems).where(eq(contentItems.workspaceId, workspace.workspace.id)).orderBy(desc(contentItems.updatedAt)).limit(20),
    db.select().from(connectedAccounts).where(eq(connectedAccounts.workspaceId, workspace.workspace.id)).orderBy(desc(connectedAccounts.updatedAt)),
    db.select().from(destinations).orderBy(destinations.label),
    db.select().from(jobs).where(eq(jobs.workspaceId, workspace.workspace.id)).orderBy(desc(jobs.createdAt)).limit(10),
  ])
  return { content, accounts, destinations: destinationRows, jobs: recentJobs, user: auth.user, organizationId: auth.organizationId, role: auth.role }
})

app.get('/api/consents', async (request, reply) => {
  const auth = await requireAuth(request, reply); if (!auth) return
  return { consents: await db.select().from(consentRecords).where(and(eq(consentRecords.userId, auth.user.id), eq(consentRecords.organizationId, auth.organizationId))).orderBy(desc(consentRecords.createdAt)) }
})
app.post('/api/consents', async (request, reply) => {
  const auth = await requireAuth(request, reply); if (!auth) return
  const parsed = consentPayload.safeParse(request.body)
  if (!parsed.success) return reply.code(400).send({ error: 'Invalid consent payload', details: parsed.error.flatten() })
  const [previous] = await db.select().from(consentRecords).where(and(eq(consentRecords.userId, auth.user.id), eq(consentRecords.organizationId, auth.organizationId), eq(consentRecords.purpose, parsed.data.purpose))).orderBy(desc(consentRecords.createdAt)).limit(1)
  const id = randomUUID()
  await db.insert(consentRecords).values({ id, userId: auth.user.id, organizationId: auth.organizationId, ...parsed.data, userAgentHash: request.headers['user-agent'] ? createHash('sha256').update(request.headers['user-agent']).digest('hex') : undefined, supersedesConsentId: previous?.id })
  const [record] = await db.select().from(consentRecords).where(eq(consentRecords.id, id)).limit(1)
  return reply.code(201).send({ consent: record })
})

app.get('/api/content', async (request, reply) => {
  const auth = await requireAuth(request, reply); if (!auth) return
  const query = request.query as { status?: string; limit?: string; workspaceId?: string }
  const scope = await getWorkspace(request, query.workspaceId ?? 'personal'); if (!scope) return reply.code(403).send({ error: 'Workspace access denied' })
  const limit = Math.min(Math.max(Number(query.limit ?? 50), 1), 100)
  const condition = query.status ? and(eq(contentItems.workspaceId, scope.workspace.id), eq(contentItems.status, query.status as typeof contentItems.$inferSelect.status)) : eq(contentItems.workspaceId, scope.workspace.id)
  return { items: await db.select().from(contentItems).where(condition).orderBy(desc(contentItems.updatedAt)).limit(limit) }
})

app.get('/api/content/:id', async (request, reply) => {
  const auth = await requireAuth(request, reply); if (!auth) return
  const { id } = request.params as { id: string }
  const [item] = await db.select({ item: contentItems }).from(contentItems).innerJoin(workspaces, eq(contentItems.workspaceId, workspaces.id)).where(and(eq(contentItems.id, id), eq(workspaces.organizationId, auth.organizationId))).limit(1)
  if (!item) return reply.code(404).send({ error: 'Content item not found' })
  return { item: item.item, variants: await db.select().from(contentVariants).where(eq(contentVariants.contentItemId, id)) }
})

app.post('/api/content', async (request, reply) => {
  const auth = await requireAuth(request, reply); if (!auth) return
  const parsed = contentPayload.safeParse(request.body); if (!parsed.success) return reply.code(400).send({ error: 'Invalid content payload', details: parsed.error.flatten() })
  const scope = await getWorkspace(request, parsed.data.workspaceId); if (!scope) return reply.code(403).send({ error: 'Workspace access denied' })
  const id = randomUUID(); await db.insert(contentItems).values({ id, ...parsed.data })
  const [item] = await db.select().from(contentItems).where(eq(contentItems.id, id)).limit(1)
  return reply.code(201).send({ item })
})

app.patch('/api/content/:id', async (request, reply) => {
  const auth = await requireAuth(request, reply); if (!auth) return
  const { id } = request.params as { id: string }
  const patch = z.object({ title: z.string().min(1).max(160).optional(), description: z.string().optional(), status: contentPayload.shape.status.optional(), sourcePrompt: z.string().optional() }).safeParse(request.body)
  if (!patch.success) return reply.code(400).send({ error: 'Invalid content patch', details: patch.error.flatten() })
  const [owned] = await db.select({ id: contentItems.id }).from(contentItems).innerJoin(workspaces, eq(contentItems.workspaceId, workspaces.id)).where(and(eq(contentItems.id, id), eq(workspaces.organizationId, auth.organizationId))).limit(1)
  if (!owned) return reply.code(404).send({ error: 'Content item not found' })
  await db.update(contentItems).set({ ...patch.data, updatedAt: new Date().toISOString() }).where(eq(contentItems.id, id))
  const [item] = await db.select().from(contentItems).where(eq(contentItems.id, id)).limit(1)
  return { item }
})

app.post('/api/ai/chat', async (request, reply) => {
  const auth = await requireAuth(request, reply); if (!auth) return
  const parsed = aiPayload.safeParse(request.body)
  if (!parsed.success) return reply.code(400).send({ error: 'Invalid AI request', details: parsed.error.flatten() })
  if (!process.env.AI_API_KEY) return reply.code(503).send({ error: 'AI provider is not configured. Set AI_API_KEY on the server.' })

  const client = new OpenAI({ apiKey: process.env.AI_API_KEY, baseURL: process.env.AI_BASE_URL || undefined })
  const actionInstructions = {
    chat: 'Answer the user as an editorial copilot. Be concise and practical.',
    rewrite: 'Rewrite the draft for clarity and stronger flow. Return only the rewritten copy unless the user asks for explanation.',
    shorten: 'Shorten the draft while preserving the main idea, voice, and useful details. Return only the shortened copy.',
    expand: 'Expand the draft with useful detail and a coherent structure. Return only the expanded copy.',
    repurpose: 'Turn the draft into platform-ready copy. Ask which platform only if it is not inferable; otherwise provide a strong concise version.',
  }[parsed.data.action]
  const draftContext = parsed.data.draft ? `\n\nCurrent draft:\n${parsed.data.draft}` : ''
  try {
    const response = await client.chat.completions.create({
      model: process.env.AI_MODEL || 'gpt-5-mini',
      messages: [
        { role: 'system', content: `You are ScrollTell Studio's editorial copilot. ${actionInstructions} Do not claim to have published anything.${draftContext}` },
        ...parsed.data.messages,
      ],
      max_completion_tokens: 1600,
    })
    return { message: response.choices[0]?.message?.content?.trim() || 'The provider returned an empty response.', model: response.model }
  } catch (error) {
    request.log.error(error)
    return reply.code(502).send({ error: 'The configured AI provider could not complete the request.' })
  }
})

app.get('/api/content/:id/variants', async (request, reply) => {
  const auth = await requireAuth(request, reply); if (!auth) return
  const { id } = request.params as { id: string }
  const [owned] = await db.select({ id: contentItems.id }).from(contentItems).innerJoin(workspaces, eq(contentItems.workspaceId, workspaces.id)).where(and(eq(contentItems.id, id), eq(workspaces.organizationId, auth.organizationId))).limit(1)
  if (!owned) return reply.code(404).send({ error: 'Content item not found' })
  return { variants: await db.select().from(contentVariants).where(eq(contentVariants.contentItemId, id)) }
})

app.post('/api/content/:id/variants', async (request, reply) => {
  const auth = await requireAuth(request, reply); if (!auth) return
  const { id: contentItemId } = request.params as { id: string }
  const [owned] = await db.select({ id: contentItems.id }).from(contentItems).innerJoin(workspaces, eq(contentItems.workspaceId, workspaces.id)).where(and(eq(contentItems.id, contentItemId), eq(workspaces.organizationId, auth.organizationId))).limit(1)
  if (!owned) return reply.code(404).send({ error: 'Content item not found' })
  const parsed = z.object({ destination: z.enum(['facebook', 'instagram', 'threads', 'youtube', 'tiktok', 'x']), body: z.string(), title: z.string().optional(), metadata: jsonBody.optional() }).safeParse(request.body)
  if (!parsed.success) return reply.code(400).send({ error: 'Invalid variant payload', details: parsed.error.flatten() })
  const variantId = randomUUID(); await db.insert(contentVariants).values({ id: variantId, contentItemId, ...parsed.data })
  const [variant] = await db.select().from(contentVariants).where(eq(contentVariants.id, variantId)).limit(1)
  return reply.code(201).send({ variant })
})

app.get('/api/destinations', async (request, reply) => { const auth = await requireAuth(request, reply); if (!auth) return { destinations: [] }; return { destinations: await db.select().from(destinations).orderBy(destinations.label) } })
app.get('/api/accounts', async (request, reply) => { const auth = await requireAuth(request, reply); if (!auth) return; const { workspaceId = 'personal' } = request.query as { workspaceId?: string }; const scope = await getWorkspace(request, workspaceId); if (!scope) return reply.code(403).send({ error: 'Workspace access denied' }); return { accounts: await db.select().from(connectedAccounts).where(eq(connectedAccounts.workspaceId, scope.workspace.id)) } })
app.get('/api/jobs', async (request, reply) => { const auth = await requireAuth(request, reply); if (!auth) return; const scope = await getWorkspace(request, 'personal'); if (!scope) return reply.code(403).send({ error: 'Workspace access denied' }); return { jobs: await db.select().from(jobs).where(eq(jobs.workspaceId, scope.workspace.id)).orderBy(desc(jobs.createdAt)).limit(50) } })
app.post('/api/jobs/publish', async (request, reply) => {
  const auth = await requireAuth(request, reply); if (!auth) return
  const parsed = z.object({ workspaceId: z.string().default('personal'), contentVariantId: z.string().min(1), connectedAccountId: z.string().min(1), runAt: z.string().datetime().optional() }).safeParse(request.body)
  if (!parsed.success) return reply.code(400).send({ error: 'Invalid publish job payload', details: parsed.error.flatten() })
  const scope = await getWorkspace(request, parsed.data.workspaceId); if (!scope) return reply.code(403).send({ error: 'Workspace access denied' })
  const [variant] = await db.select({ id: contentVariants.id }).from(contentVariants).innerJoin(contentItems, eq(contentVariants.contentItemId, contentItems.id)).where(and(eq(contentVariants.id, parsed.data.contentVariantId), eq(contentItems.workspaceId, scope.workspace.id))).limit(1)
  const [account] = await db.select({ id: connectedAccounts.id }).from(connectedAccounts).where(and(eq(connectedAccounts.id, parsed.data.connectedAccountId), eq(connectedAccounts.workspaceId, scope.workspace.id))).limit(1)
  if (!variant || !account) return reply.code(403).send({ error: 'Publish resources are outside your organization' })
  const id = randomUUID(); await db.insert(jobs).values({ id, workspaceId: scope.workspace.id, type: 'publish', status: 'queued', runAt: parsed.data.runAt, payload: { contentVariantId: variant.id, connectedAccountId: account.id } })
  const [job] = await db.select().from(jobs).where(eq(jobs.id, id)).limit(1)
  return reply.code(202).send({ job, message: 'Queued locally. The publishing adapter will execute this job later.' })
})

app.post('/mcp', async (request, reply) => {
  const expected = process.env.MCP_AUTH_TOKEN
  if (process.env.NODE_ENV === 'production' && !expected) return reply.code(503).send({ error: 'MCP_AUTH_TOKEN is not configured' })
  if (expected && request.headers.authorization !== `Bearer ${expected}`) return reply.code(401).send({ error: 'MCP authentication required' })
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined }); const server = createMcpServer(); await server.connect(transport); await transport.handleRequest(request.raw, reply.raw, request.body); reply.hijack()
})
app.get('/mcp', async (_request, reply) => reply.code(405).send({ error: 'Use POST /mcp for stateless MCP requests.' }))
app.delete('/mcp', async (_request, reply) => reply.code(405).send({ error: 'Stateless MCP sessions do not support DELETE.' }))

async function runStdio() { const server = createMcpServer(); await server.connect(new StdioServerTransport()) }
if (process.env.MCP_TRANSPORT === 'stdio') await runStdio(); else { await app.listen({ port, host }); app.log.info(`ScrollTell server listening on http://${host}:${port}`) }
