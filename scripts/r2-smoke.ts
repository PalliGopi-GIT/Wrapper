import { readFileSync } from 'node:fs'
import { deleteObject, headObject, presignGet, presignPut } from '../api/_lib/r2'

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

const key = `u/smoke/check-${Date.now()}.txt`
const body = 'cadence r2 round-trip check'

const putUrl = new URL(await presignPut(key, 'text/plain', Buffer.byteLength(body)))
const put = await fetch(putUrl, {
  method: 'PUT',
  headers: { 'content-type': 'text/plain' },
  body,
})

const head = await headObject(key)
const getUrl = await presignGet(key)
const get = await fetch(getUrl)
const text = await get.text()

await deleteObject(key)
const after = await fetch(getUrl)

console.log(
  JSON.stringify({
    endpoint: putUrl.origin,
    bucket: putUrl.pathname.split('/').filter(Boolean)[0],
    putStatus: put.status,
    headBytes: head?.size ?? null,
    headType: head?.type ?? null,
    getStatus: get.status,
    bytesMatch: text === body,
    afterDeleteStatus: after.status,
  })
)
