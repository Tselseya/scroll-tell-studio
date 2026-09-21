import { randomUUID } from 'node:crypto'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { db } from '@scrolltell/db'
import { contentItems, contentVariants, jobs } from '@scrolltell/db/schema'
import { desc, eq } from 'drizzle-orm'

const destinations = ['facebook', 'instagram', 'threads', 'youtube', 'tiktok', 'x'] as const
const contentTypes = ['text', 'image', 'carousel', 'short_video', 'long_video'] as const

const textResult = (value: unknown) => ({ content: [{ type: 'text' as const, text: JSON.stringify(value, null, 2) }] })

export function createMcpServer() {
  const server = new McpServer({ name: 'scrolltell-local-workspace', version: '0.1.0' })

  server.tool(
    'list_content',
    'List recent content items in the local workspace.',
    { limit: z.number().int().min(1).max(50).optional() },
    async ({ limit = 20 }) => textResult(await db.select().from(contentItems).orderBy(desc(contentItems.updatedAt)).limit(limit)),
  )

  server.tool(
    'get_content',
    'Read a content item and all platform variants.',
    { contentId: z.string().min(1) },
    async ({ contentId }) => {
      const [item] = await db.select().from(contentItems).where(eq(contentItems.id, contentId)).limit(1)
      if (!item) return textResult({ error: 'Content item not found', contentId })
      const variants = await db.select().from(contentVariants).where(eq(contentVariants.contentItemId, contentId))
      return textResult({ item, variants })
    },
  )

  server.tool(
    'create_draft',
    'Create a new local draft from an idea or prompt.',
    {
      workspaceId: z.string().default('personal'),
      title: z.string().min(1).max(160),
      description: z.string().optional(),
      contentType: z.enum(contentTypes).default('text'),
      sourcePrompt: z.string().optional(),
    },
    async ({ workspaceId, title, description, contentType, sourcePrompt }) => {
      const id = randomUUID()
      await db.insert(contentItems).values({ id, workspaceId, title, description, contentType, sourcePrompt, status: 'draft' })
      return textResult(await db.select().from(contentItems).where(eq(contentItems.id, id)).limit(1))
    },
  )

  server.tool(
    'update_draft',
    'Update the title, description, status, or source prompt of a draft.',
    {
      contentId: z.string().min(1),
      title: z.string().min(1).max(160).optional(),
      description: z.string().optional(),
      status: z.enum(['idea', 'draft', 'ready', 'scheduled', 'published', 'archived']).optional(),
      sourcePrompt: z.string().optional(),
    },
    async ({ contentId, ...updates }) => {
      await db.update(contentItems).set({ ...updates, updatedAt: new Date().toISOString() }).where(eq(contentItems.id, contentId))
      return textResult(await db.select().from(contentItems).where(eq(contentItems.id, contentId)).limit(1))
    },
  )

  server.tool(
    'preview_variant',
    'Create or update a destination-specific text variant and return its preview.',
    {
      contentId: z.string().min(1),
      destination: z.enum(destinations),
      body: z.string().min(1),
      title: z.string().optional(),
    },
    async ({ contentId, destination, body, title }) => {
      const existing = await db.select().from(contentVariants).where(eq(contentVariants.contentItemId, contentId)).limit(50)
      const match = existing.find((variant) => variant.destination === destination)
      if (match) {
        await db.update(contentVariants).set({ body, title, updatedAt: new Date().toISOString() }).where(eq(contentVariants.id, match.id))
        return textResult({ ...match, body, title, preview: { destination, body, title } })
      }
      const id = randomUUID()
      await db.insert(contentVariants).values({ id, contentItemId: contentId, destination, body, title })
      return textResult({ id, contentItemId: contentId, destination, body, title, preview: { destination, body, title } })
    },
  )

  server.tool(
    'queue_publish',
    'Queue an explicit publishing job for later execution. This does not publish immediately.',
    {
      workspaceId: z.string().default('personal'),
      contentVariantId: z.string().min(1),
      connectedAccountId: z.string().min(1),
      runAt: z.string().datetime().optional(),
    },
    async ({ workspaceId, contentVariantId, connectedAccountId, runAt }) => {
      const id = randomUUID()
      await db.insert(jobs).values({ id, workspaceId, type: 'publish', status: 'queued', runAt, payload: { contentVariantId, connectedAccountId } })
      return textResult({ jobId: id, status: 'queued', note: 'Queued for the publishing worker; no external post was made.' })
    },
  )

  server.tool(
    'list_jobs',
    'List recent local background jobs and their statuses.',
    { limit: z.number().int().min(1).max(50).optional() },
    async ({ limit = 20 }) => textResult(await db.select().from(jobs).orderBy(desc(jobs.createdAt)).limit(limit)),
  )

  return server
}
