import { randomUUID } from 'node:crypto'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import cors from '@fastify/cors'
import Fastify from 'fastify'
import { db } from '@scrolltell/db'
import { connectedAccounts, contentItems, contentVariants, destinations, jobs, workspaces } from '@scrolltell/db/schema'
import { and, desc, eq } from 'drizzle-orm'
import { z } from 'zod'
import { createMcpServer } from './mcp.js'

const port = Number(process.env.PORT ?? 8787)
const host = process.env.HOST ?? '127.0.0.1'

const app = Fastify({ logger: true })
await app.register(cors, { origin: true })

async function ensureSeedData() {
  await db.insert(workspaces).values({ id: 'personal', name: 'Personal workspace', slug: 'personal' }).onConflictDoNothing()
  const catalog = [
    ['facebook', 'Facebook'], ['instagram', 'Instagram'], ['threads', 'Threads'],
    ['youtube', 'YouTube'], ['tiktok', 'TikTok'], ['x', 'X / Twitter'],
  ] as const
  for (const [key, label] of catalog) {
    await db.insert(destinations).values({ id: key, key, label }).onConflictDoNothing()
  }
}

await ensureSeedData()

const jsonBody = z.record(z.unknown())
const contentPayload = z.object({
  workspaceId: z.string().min(1).default('personal'),
  title: z.string().min(1).max(160),
  description: z.string().optional(),
  contentType: z.enum(['text', 'image', 'carousel', 'short_video', 'long_video']).default('text'),
  status: z.enum(['idea', 'draft', 'ready', 'scheduled', 'published', 'archived']).default('draft'),
  sourcePrompt: z.string().optional(),
})

app.get('/health', async () => ({ ok: true, service: 'scrolltell-server', timestamp: new Date().toISOString() }))

app.get('/api/bootstrap', async () => {
  const [content, accounts, destinationRows, recentJobs] = await Promise.all([
    db.select().from(contentItems).orderBy(desc(contentItems.updatedAt)).limit(20),
    db.select().from(connectedAccounts).orderBy(desc(connectedAccounts.updatedAt)),
    db.select().from(destinations).orderBy(destinations.label),
    db.select().from(jobs).orderBy(desc(jobs.createdAt)).limit(10),
  ])
  return { content, accounts, destinations: destinationRows, jobs: recentJobs }
})

app.get('/api/content', async (request) => {
  const query = request.query as { status?: string; limit?: string }
  const limit = Math.min(Math.max(Number(query.limit ?? 50), 1), 100)
  const rows = query.status
    ? await db.select().from(contentItems).where(eq(contentItems.status, query.status as typeof contentItems.$inferSelect.status)).orderBy(desc(contentItems.updatedAt)).limit(limit)
    : await db.select().from(contentItems).orderBy(desc(contentItems.updatedAt)).limit(limit)
  return { items: rows }
})

app.get('/api/content/:id', async (request, reply) => {
  const { id } = request.params as { id: string }
  const [item] = await db.select().from(contentItems).where(eq(contentItems.id, id)).limit(1)
  if (!item) return reply.code(404).send({ error: 'Content item not found' })
  const variants = await db.select().from(contentVariants).where(eq(contentVariants.contentItemId, id))
  return { item, variants }
})

app.post('/api/content', async (request, reply) => {
  const parsed = contentPayload.safeParse(request.body)
  if (!parsed.success) return reply.code(400).send({ error: 'Invalid content payload', details: parsed.error.flatten() })
  const id = randomUUID()
  await db.insert(contentItems).values({ id, ...parsed.data })
  const [item] = await db.select().from(contentItems).where(eq(contentItems.id, id)).limit(1)
  return reply.code(201).send({ item })
})

app.patch('/api/content/:id', async (request, reply) => {
  const { id } = request.params as { id: string }
  const patch = z.object({ title: z.string().min(1).max(160).optional(), description: z.string().optional(), status: contentPayload.shape.status.optional(), sourcePrompt: z.string().optional() }).safeParse(request.body)
  if (!patch.success) return reply.code(400).send({ error: 'Invalid content patch', details: patch.error.flatten() })
  await db.update(contentItems).set({ ...patch.data, updatedAt: new Date().toISOString() }).where(eq(contentItems.id, id))
  const [item] = await db.select().from(contentItems).where(eq(contentItems.id, id)).limit(1)
  if (!item) return reply.code(404).send({ error: 'Content item not found' })
  return { item }
})

app.get('/api/content/:id/variants', async (request) => {
  const { id } = request.params as { id: string }
  return { variants: await db.select().from(contentVariants).where(eq(contentVariants.contentItemId, id)) }
})

app.post('/api/content/:id/variants', async (request, reply) => {
  const { id: contentItemId } = request.params as { id: string }
  const parsed = z.object({ destination: z.enum(['facebook', 'instagram', 'threads', 'youtube', 'tiktok', 'x']), body: z.string(), title: z.string().optional(), metadata: jsonBody.optional() }).safeParse(request.body)
  if (!parsed.success) return reply.code(400).send({ error: 'Invalid variant payload', details: parsed.error.flatten() })
  const variantId = randomUUID()
  await db.insert(contentVariants).values({ id: variantId, contentItemId, ...parsed.data })
  const [variant] = await db.select().from(contentVariants).where(eq(contentVariants.id, variantId)).limit(1)
  return reply.code(201).send({ variant })
})

app.get('/api/destinations', async () => ({ destinations: await db.select().from(destinations).orderBy(destinations.label) }))

app.get('/api/accounts', async (request) => {
  const { workspaceId = 'personal' } = request.query as { workspaceId?: string }
  return { accounts: await db.select().from(connectedAccounts).where(eq(connectedAccounts.workspaceId, workspaceId)) }
})

app.get('/api/jobs', async () => ({ jobs: await db.select().from(jobs).orderBy(desc(jobs.createdAt)).limit(50) }))

app.post('/api/jobs/publish', async (request, reply) => {
  const parsed = z.object({ workspaceId: z.string().default('personal'), contentVariantId: z.string().min(1), connectedAccountId: z.string().min(1), runAt: z.string().datetime().optional() }).safeParse(request.body)
  if (!parsed.success) return reply.code(400).send({ error: 'Invalid publish job payload', details: parsed.error.flatten() })
  const id = randomUUID()
  await db.insert(jobs).values({ id, workspaceId: parsed.data.workspaceId, type: 'publish', status: 'queued', runAt: parsed.data.runAt, payload: { contentVariantId: parsed.data.contentVariantId, connectedAccountId: parsed.data.connectedAccountId } })
  const [job] = await db.select().from(jobs).where(eq(jobs.id, id)).limit(1)
  return reply.code(202).send({ job, message: 'Queued locally. The publishing adapter will execute this job later.' })
})

app.post('/mcp', async (request, reply) => {
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined })
  const server = createMcpServer()
  await server.connect(transport)
  await transport.handleRequest(request.raw, reply.raw, request.body)
  reply.hijack()
})

app.get('/mcp', async (_request, reply) => reply.code(405).send({ error: 'Use POST /mcp for stateless MCP requests.' }))
app.delete('/mcp', async (_request, reply) => reply.code(405).send({ error: 'Stateless MCP sessions do not support DELETE.' }))

async function runStdio() {
  const server = createMcpServer()
  await server.connect(new StdioServerTransport())
}

if (process.env.MCP_TRANSPORT === 'stdio') {
  await runStdio()
} else {
  await app.listen({ port, host })
  app.log.info(`ScrollTell server listening on http://${host}:${port}`)
}
