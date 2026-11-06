import { sql } from 'drizzle-orm'
import {
  bigint,
  boolean,
  customType,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'
import type { DeckSettings, Slide } from '../src/model/types'

const citext = customType<{ data: string }>({
  dataType: () => 'citext',
})

export const userKind = pgEnum('user_kind', ['creator', 'viewer'])
export const shareAccess = pgEnum('share_access', ['signed_in', 'invite_only'])
export const assetStatus = pgEnum('asset_status', ['pending', 'ready', 'deleted'])

export const users = pgTable(
  'users',
  {
    id: text('id').primaryKey(),
    email: citext('email').notNull(),
    name: text('name'),
    imageUrl: text('image_url'),
    kind: userKind('kind').notNull().default('viewer'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [uniqueIndex('users_email_uq').on(t.email).where(sql`deleted_at is null`)]
)

export const decks = pgTable(
  'decks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ownerId: text('owner_id')
      .notNull()
      .references(() => users.id),
    title: text('title').notNull().default('Untitled deck'),
    subtitle: text('subtitle').notNull().default(''),
    theme: text('theme').notNull().default('obsidian'),
    archetype: text('archetype').notNull().default('pitch'),
    settings: jsonb('settings')
      .$type<DeckSettings>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    slides: jsonb('slides')
      .$type<Slide[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    slideCount: integer('slide_count').generatedAlwaysAs(sql`jsonb_array_length(slides)`),
    revision: integer('revision').notNull().default(1),
    thumbnailKey: text('thumbnail_key'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [
    index('decks_owner_idx').on(t.ownerId, t.updatedAt).where(sql`deleted_at is null`),
    index('decks_owner_id_idx').on(t.ownerId),
  ]
)

export const deckVersions = pgTable(
  'deck_versions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    deckId: uuid('deck_id')
      .notNull()
      .references(() => decks.id, { onDelete: 'cascade' }),
    version: integer('version').notNull(),
    label: text('label'),
    snapshot: jsonb('snapshot').notNull(),
    createdBy: text('created_by')
      .notNull()
      .references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('deck_versions_deck_version_uq').on(t.deckId, t.version)]
)

export const assets = pgTable(
  'assets',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ownerId: text('owner_id')
      .notNull()
      .references(() => users.id),
    deckId: uuid('deck_id').references(() => decks.id, { onDelete: 'set null' }),
    objectKey: text('object_key').notNull().unique(),
    contentType: text('content_type').notNull(),
    byteSize: bigint('byte_size', { mode: 'number' }).notNull(),
    width: integer('width'),
    height: integer('height'),
    status: assetStatus('status').notNull().default('pending'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('assets_deck_idx').on(t.deckId),
    index('assets_owner_idx').on(t.ownerId, t.createdAt),
  ]
)

export const shareLinks = pgTable(
  'share_links',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    deckId: uuid('deck_id')
      .notNull()
      .references(() => decks.id, { onDelete: 'cascade' }),
    token: text('token').notNull().unique(),
    createdBy: text('created_by')
      .notNull()
      .references(() => users.id),
    name: text('name'),
    access: shareAccess('access').notNull().default('signed_in'),
    allowedDomains: citext('allowed_domains').array().notNull().default(sql`'{}'::citext[]`),
    versionId: uuid('version_id').references(() => deckVersions.id),
    allowDownload: boolean('allow_download').notNull().default(false),
    showNotes: boolean('show_notes').notNull().default(false),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('share_links_deck_idx').on(t.deckId)]
)

export const shareInvites = pgTable(
  'share_invites',
  {
    shareId: uuid('share_id')
      .notNull()
      .references(() => shareLinks.id, { onDelete: 'cascade' }),
    email: citext('email').notNull(),
    invitedAt: timestamp('invited_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.shareId, t.email] })]
)

export const shareAccessGrants = pgTable(
  'share_access_grants',
  {
    shareId: uuid('share_id')
      .notNull()
      .references(() => shareLinks.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    firstViewedAt: timestamp('first_viewed_at', { withTimezone: true }).notNull().defaultNow(),
    lastViewedAt: timestamp('last_viewed_at', { withTimezone: true }).notNull().defaultNow(),
    viewCount: integer('view_count').notNull().default(1),
  },
  (t) => [
    primaryKey({ columns: [t.shareId, t.userId] }),
    index('share_grants_user_idx').on(t.userId),
  ]
)

export const shareViewSessions = pgTable(
  'share_view_sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    shareId: uuid('share_id')
      .notNull()
      .references(() => shareLinks.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
    lastPingAt: timestamp('last_ping_at', { withTimezone: true }).notNull().defaultNow(),
    slideMs: jsonb('slide_ms')
      .$type<Record<string, number>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    maxSlide: integer('max_slide').notNull().default(0),
    userAgent: text('user_agent'),
    country: text('country'),
  },
  (t) => [index('share_sessions_share_idx').on(t.shareId, t.startedAt)]
)

export const aiUsage = pgTable(
  'ai_usage',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id),
    deckId: uuid('deck_id').references(() => decks.id, { onDelete: 'set null' }),
    operation: text('operation').notNull(),
    model: text('model').notNull(),
    inputTokens: integer('input_tokens'),
    outputTokens: integer('output_tokens'),
    ok: boolean('ok').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('ai_usage_user_idx').on(t.userId, t.createdAt)]
)

export const deckExports = pgTable(
  'deck_exports',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    deckId: uuid('deck_id')
      .notNull()
      .references(() => decks.id, { onDelete: 'cascade' }),
    ownerId: text('owner_id')
      .notNull()
      .references(() => users.id),
    objectKey: text('object_key').notNull().unique(),
    format: text('format').notNull().default('pptx'),
    byteSize: bigint('byte_size', { mode: 'number' }).notNull().default(0),
    meta: jsonb('meta')
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('deck_exports_owner_idx').on(t.ownerId, t.createdAt)]
)

export const webhookEvents = pgTable('webhook_events', {
  id: text('id').primaryKey(),
  type: text('type').notNull(),
  receivedAt: timestamp('received_at', { withTimezone: true }).notNull().defaultNow(),
})

export type UserRow = typeof users.$inferSelect
export type DeckRow = typeof decks.$inferSelect
export type ShareLinkRow = typeof shareLinks.$inferSelect
export type AssetRow = typeof assets.$inferSelect
