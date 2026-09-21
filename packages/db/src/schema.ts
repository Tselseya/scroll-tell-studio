import { relations } from 'drizzle-orm'
import { integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'

const timestamps = {
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: text('updated_at').notNull().$defaultFn(() => new Date().toISOString()),
}

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull(),
  displayName: text('display_name').notNull(),
  status: text('status', { enum: ['active', 'suspended', 'deleted'] }).notNull().default('active'),
  ...timestamps,
}, (table) => ({
  emailIdx: uniqueIndex('users_email_idx').on(table.email),
}))

export const organizations = sqliteTable('organizations', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull(),
  plan: text('plan', { enum: ['free', 'pro', 'enterprise'] }).notNull().default('free'),
  ...timestamps,
}, (table) => ({
  slugIdx: uniqueIndex('organizations_slug_idx').on(table.slug),
}))

export const organizationMembers = sqliteTable('organization_members', {
  id: text('id').primaryKey(),
  organizationId: text('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  role: text('role', { enum: ['owner', 'admin', 'member'] }).notNull().default('member'),
  ...timestamps,
}, (table) => ({
  membershipIdx: uniqueIndex('organization_membership_idx').on(table.organizationId, table.userId),
}))

export const workspaces = sqliteTable('workspaces', {
  id: text('id').primaryKey(),
  organizationId: text('organization_id').notNull().default('default-org').references(() => organizations.id, { onDelete: 'cascade' }),
  ownerUserId: text('owner_user_id').references(() => users.id, { onDelete: 'set null' }),
  name: text('name').notNull(),
  slug: text('slug').notNull(),
  ...timestamps,
}, (table) => ({
  slugIdx: uniqueIndex('workspaces_slug_idx').on(table.slug),
}))

export const contentItems = sqliteTable('content_items', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  description: text('description'),
  status: text('status', { enum: ['idea', 'draft', 'ready', 'scheduled', 'published', 'archived'] }).notNull().default('idea'),
  contentType: text('content_type', { enum: ['text', 'image', 'carousel', 'short_video', 'long_video'] }).notNull().default('text'),
  sourcePrompt: text('source_prompt'),
  ...timestamps,
})

export const contentVariants = sqliteTable('content_variants', {
  id: text('id').primaryKey(),
  contentItemId: text('content_item_id').notNull().references(() => contentItems.id, { onDelete: 'cascade' }),
  destination: text('destination', { enum: ['facebook', 'instagram', 'threads', 'youtube', 'tiktok', 'x'] }).notNull(),
  body: text('body').notNull().default(''),
  title: text('title'),
  metadata: text('metadata', { mode: 'json' }).$type<Record<string, unknown>>(),
  ...timestamps,
})

export const mediaAssets = sqliteTable('media_assets', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  contentItemId: text('content_item_id').references(() => contentItems.id, { onDelete: 'set null' }),
  filename: text('filename').notNull(),
  storagePath: text('storage_path').notNull(),
  mimeType: text('mime_type').notNull(),
  sizeBytes: integer('size_bytes').notNull().default(0),
  width: integer('width'),
  height: integer('height'),
  durationMs: integer('duration_ms'),
  checksum: text('checksum'),
  ...timestamps,
})

export const destinations = sqliteTable('destinations', {
  id: text('id').primaryKey(),
  key: text('key', { enum: ['facebook', 'instagram', 'threads', 'youtube', 'tiktok', 'x'] }).notNull(),
  label: text('label').notNull(),
  enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
  ...timestamps,
}, (table) => ({
  keyIdx: uniqueIndex('destinations_key_idx').on(table.key),
}))

export const connectedAccounts = sqliteTable('connected_accounts', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  destinationId: text('destination_id').notNull().references(() => destinations.id, { onDelete: 'cascade' }),
  displayName: text('display_name').notNull(),
  connectionMethod: text('connection_method', { enum: ['api', 'browser'] }).notNull(),
  secretRef: text('secret_ref'),
  status: text('status', { enum: ['connected', 'needs_attention', 'disconnected'] }).notNull().default('needs_attention'),
  ...timestamps,
})

export const jobs = sqliteTable('jobs', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  type: text('type', { enum: ['ai_generation', 'media_process', 'publish', 'sync'] }).notNull(),
  status: text('status', { enum: ['queued', 'running', 'succeeded', 'failed', 'retrying', 'cancelled'] }).notNull().default('queued'),
  payload: text('payload', { mode: 'json' }).$type<Record<string, unknown>>().notNull(),
  result: text('result', { mode: 'json' }).$type<Record<string, unknown>>(),
  error: text('error'),
  attempts: integer('attempts').notNull().default(0),
  runAt: text('run_at'),
  ...timestamps,
})

export const publishAttempts = sqliteTable('publish_attempts', {
  id: text('id').primaryKey(),
  jobId: text('job_id').references(() => jobs.id, { onDelete: 'set null' }),
  contentVariantId: text('content_variant_id').notNull().references(() => contentVariants.id, { onDelete: 'cascade' }),
  connectedAccountId: text('connected_account_id').notNull().references(() => connectedAccounts.id, { onDelete: 'cascade' }),
  method: text('method', { enum: ['api', 'browser'] }).notNull(),
  status: text('status', { enum: ['queued', 'published', 'failed'] }).notNull().default('queued'),
  externalId: text('external_id'),
  payloadHash: text('payload_hash'),
  error: text('error'),
  publishedAt: text('published_at'),
  ...timestamps,
})

export const auditEvents = sqliteTable('audit_events', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  actor: text('actor').notNull(),
  action: text('action').notNull(),
  entityType: text('entity_type').notNull(),
  entityId: text('entity_id'),
  details: text('details', { mode: 'json' }).$type<Record<string, unknown>>(),
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
})

export const workspaceRelations = relations(workspaces, ({ many }) => ({
  contentItems: many(contentItems),
  mediaAssets: many(mediaAssets),
  connectedAccounts: many(connectedAccounts),
  jobs: many(jobs),
  auditEvents: many(auditEvents),
}))

export const organizationRelations = relations(organizations, ({ many }) => ({
  members: many(organizationMembers),
  workspaces: many(workspaces),
}))

export const userRelations = relations(users, ({ many }) => ({
  memberships: many(organizationMembers),
  ownedWorkspaces: many(workspaces),
}))

export const membershipRelations = relations(organizationMembers, ({ one }) => ({
  organization: one(organizations, { fields: [organizationMembers.organizationId], references: [organizations.id] }),
  user: one(users, { fields: [organizationMembers.userId], references: [users.id] }),
}))

export const contentRelations = relations(contentItems, ({ one, many }) => ({
  workspace: one(workspaces, { fields: [contentItems.workspaceId], references: [workspaces.id] }),
  variants: many(contentVariants),
  mediaAssets: many(mediaAssets),
}))

export const variantRelations = relations(contentVariants, ({ one, many }) => ({
  contentItem: one(contentItems, { fields: [contentVariants.contentItemId], references: [contentItems.id] }),
  publishAttempts: many(publishAttempts),
}))

export const destinationRelations = relations(destinations, ({ many }) => ({
  connectedAccounts: many(connectedAccounts),
}))

export const accountRelations = relations(connectedAccounts, ({ one, many }) => ({
  workspace: one(workspaces, { fields: [connectedAccounts.workspaceId], references: [workspaces.id] }),
  destination: one(destinations, { fields: [connectedAccounts.destinationId], references: [destinations.id] }),
  publishAttempts: many(publishAttempts),
}))

export const jobRelations = relations(jobs, ({ one }) => ({
  workspace: one(workspaces, { fields: [jobs.workspaceId], references: [workspaces.id] }),
}))

export const publishAttemptRelations = relations(publishAttempts, ({ one }) => ({
  job: one(jobs, { fields: [publishAttempts.jobId], references: [jobs.id] }),
  contentVariant: one(contentVariants, { fields: [publishAttempts.contentVariantId], references: [contentVariants.id] }),
  connectedAccount: one(connectedAccounts, { fields: [publishAttempts.connectedAccountId], references: [connectedAccounts.id] }),
}))

export type Workspace = typeof workspaces.$inferSelect
export type ContentItem = typeof contentItems.$inferSelect
export type ContentVariant = typeof contentVariants.$inferSelect
export type Job = typeof jobs.$inferSelect
