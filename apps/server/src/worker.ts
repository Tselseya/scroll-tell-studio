import { createHash, randomUUID } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { and, eq } from 'drizzle-orm'
import { db } from '@mosang/db'
import { contentItems, jobs, mediaAssets } from '@mosang/db/schema'
import { ElevenLabsProvider } from './providers/elevenlabs.js'
import { GoogleImageProvider } from './providers/google-image.js'
import type { GenerationRequest, GeneratedMedia } from './providers/types.js'

const pollMs = Number(process.env.WORKER_POLL_MS ?? 5000)
const maxAttempts = Number(process.env.WORKER_MAX_ATTEMPTS ?? 3)
const mediaRoot = path.resolve(process.env.MEDIA_DIR ?? path.resolve(process.cwd(), '../../data/media'))

function providerFor(kind: string, provider: string) {
  if (kind === 'image_generation' && (provider === 'google-imagen' || provider === 'google-image' || provider === 'google')) return new GoogleImageProvider()
  if (kind === 'voice_generation' && (provider === 'elevenlabs' || provider === 'eleven-labs')) return new ElevenLabsProvider()
  throw new Error(`No configured worker for ${kind}/${provider}`)
}

async function executeGeneration(job: typeof jobs.$inferSelect) {
  const payload = job.payload as GenerationRequest & { kind?: string }
  const kind = payload.kind ?? 'unknown'
  const provider = providerFor(kind, payload.provider)
  const generated: GeneratedMedia = kind === 'voice_generation'
    ? await (provider as ElevenLabsProvider).synthesize(payload)
    : await (provider as GoogleImageProvider).generate(payload)

  await fs.mkdir(mediaRoot, { recursive: true })
  const assetId = randomUUID()
  const safeFilename = generated.filename.replace(/[^a-zA-Z0-9._-]/g, '_')
  const storagePath = path.join(mediaRoot, `${assetId}-${safeFilename}`)
  await fs.writeFile(storagePath, generated.bytes)
  const checksum = createHash('sha256').update(generated.bytes).digest('hex')
  const stat = await fs.stat(storagePath)
  let contentItemId = payload.contentItemId
  if (contentItemId) {
    const [content] = await db.select({ id: contentItems.id }).from(contentItems).where(and(eq(contentItems.id, contentItemId), eq(contentItems.workspaceId, job.workspaceId))).limit(1)
    if (!content) contentItemId = undefined
  }
  await db.insert(mediaAssets).values({ id: assetId, workspaceId: job.workspaceId, contentItemId, filename: generated.filename, storagePath, mimeType: generated.mimeType, sizeBytes: stat.size, checksum })
  return { assetId, filename: generated.filename, mimeType: generated.mimeType, sizeBytes: stat.size, checksum, url: `/api/media/${assetId}`, ...(generated.metadata ?? {}) }
}

async function claimNextJob() {
  const [job] = await db.select().from(jobs).where(and(eq(jobs.status, 'queued'), eq(jobs.type, 'ai_generation'))).orderBy(jobs.createdAt).limit(1)
  if (!job) return null
  await db.update(jobs).set({ status: 'running', attempts: job.attempts + 1, updatedAt: new Date().toISOString() }).where(eq(jobs.id, job.id))
  return { ...job, status: 'running' as const, attempts: job.attempts + 1 }
}

export async function runWorkerOnce() {
  const job = await claimNextJob()
  if (!job) return false
  try {
    const result = job.type === 'ai_generation' ? await executeGeneration(job) : (() => { throw new Error(`Worker does not support job type ${job.type}`) })()
    await db.update(jobs).set({ status: 'succeeded', result, error: null, updatedAt: new Date().toISOString() }).where(eq(jobs.id, job.id))
    console.log(`[mosang-worker] succeeded ${job.id}`)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown worker error'
    const retry = job.attempts < maxAttempts
    await db.update(jobs).set({ status: retry ? 'retrying' : 'failed', error: message, updatedAt: new Date().toISOString() }).where(eq(jobs.id, job.id))
    if (retry) await db.update(jobs).set({ status: 'queued', runAt: new Date(Date.now() + Math.min(60000, pollMs * 4 * job.attempts)).toISOString(), updatedAt: new Date().toISOString() }).where(eq(jobs.id, job.id))
    console.error(`[mosang-worker] ${retry ? 'retrying' : 'failed'} ${job.id}: ${message}`)
  }
  return true
}

export async function startWorker() {
  console.log(`[mosang-worker] started; polling every ${pollMs}ms; max attempts ${maxAttempts}`)
  while (true) {
    try {
      const processed = await runWorkerOnce()
      if (!processed) await new Promise((resolve) => setTimeout(resolve, pollMs))
    } catch (error) {
      console.error('[mosang-worker] loop error', error)
      await new Promise((resolve) => setTimeout(resolve, pollMs))
    }
  }
}

if (process.env.MOSANG_WORKER_MODE === '1') await startWorker()
