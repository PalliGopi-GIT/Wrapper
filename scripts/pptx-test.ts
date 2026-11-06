import { writeFileSync } from 'node:fs'
import { demoDeck } from '../src/model/slides'
import { exportPptx } from '../src/export/pptx'

async function main() {
  const deck = demoDeck('obsidian')
  const blob = await exportPptx(deck)
  const buf = Buffer.from(await blob.arrayBuffer())
  writeFileSync('/tmp/cadence-test.pptx', buf)
  console.log(JSON.stringify({ bytes: buf.length, head: buf.subarray(0, 2).toString() }))
}

main().catch((e) => {
  console.error('FAILED', e)
  process.exit(1)
})
