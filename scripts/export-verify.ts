import { readFileSync } from 'node:fs'
import JSZip from 'jszip'
import { desc, eq } from 'drizzle-orm'
import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import { deckExports, decks } from '../db/schema'
import { presignGet } from '../api/_lib/r2'

for (const file of ['.env.local', '.env']) {
  try {
    for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
      if (!match) continue
      const [, key, value] = match
      if (process.env[key] === undefined) process.env[key] = value.replace(/^['"]|['"]$/g, '')
    }
  } catch {
    /* file not present */
  }
}

const url = process.env.DATABASE_URL
if (!url) throw new Error('Missing DATABASE_URL')

const db = drizzle(neon(url))
const [row] = await db
  .select({ export: deckExports, deckTitle: decks.title })
  .from(deckExports)
  .innerJoin(decks, eq(decks.id, deckExports.deckId))
  .orderBy(desc(deckExports.createdAt))
  .limit(1)

if (!row) throw new Error('No export row found')

const signed = await presignGet(row.export.objectKey, {
  downloadName: String(row.export.meta.filename || 'cadence-deck.pptx'),
})
const res = await fetch(signed)
const buf = new Uint8Array(await res.arrayBuffer())
const zip = await JSZip.loadAsync(buf)
const files = Object.keys(zip.files)
const notes = files.filter((f) => /^ppt\/notesSlides\/notesSlide\d+\.xml$/.test(f)).length
const slides = files.filter((f) => /^ppt\/slides\/slide\d+\.xml$/.test(f)).length
const charts = files.filter((f) => /^ppt\/charts\/chart\d+\.xml$/.test(f)).length
const tables = files.filter((f) => /^ppt\/tables\/table\d+\.xml$/.test(f)).length

console.log(
  JSON.stringify({
    ok: res.ok,
    status: res.status,
    deck: row.deckTitle,
    exportId: row.export.id,
    objectKey: row.export.objectKey,
    storedBytes: row.export.byteSize,
    downloadedBytes: buf.length,
    zip: buf[0] === 0x50 && buf[1] === 0x4b,
    contentType: res.headers.get('content-type'),
    contentDisposition: res.headers.get('content-disposition'),
    package: { slides, notes, charts, tables },
    meta: row.export.meta,
    signed: signed.includes('X-Amz-Signature'),
  })
)
