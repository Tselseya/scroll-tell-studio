import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import path from 'node:path'
import * as schema from './schema.js'

const databaseUrl = process.env.DATABASE_URL ?? path.resolve(process.cwd(), '../../data/scrolltell.db')
const sqlite = new Database(databaseUrl)
sqlite.pragma('journal_mode = WAL')
sqlite.pragma('foreign_keys = ON')

export const db = drizzle(sqlite, { schema })
export type Database = typeof db
