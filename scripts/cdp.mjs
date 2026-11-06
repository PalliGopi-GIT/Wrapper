/**
 * Tiny Chrome DevTools Protocol harness — no dependencies.
 * Node 24 provides global fetch + WebSocket.
 *
 *   node scripts/cdp.mjs <url> <expressionFile> [screenshotPath]
 */
import { spawn } from 'node:child_process'
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs'

const PORT = 9333
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const url = process.argv[2] ?? 'http://localhost:5199/'
const exprFile = process.argv[3]
const shot = process.argv[4]
const resultFile = process.argv[5]

rmSync('/tmp/cdp-profile', { recursive: true, force: true })
const chrome = spawn(
  CHROME,
  [
    '--headless=new',
    '--disable-gpu',
    '--hide-scrollbars',
    '--no-first-run',
    '--no-default-browser-check',
    `--remote-debugging-port=${PORT}`,
    '--user-data-dir=/tmp/cdp-profile',
    '--window-size=1600,1000',
    'about:blank',
  ],
  { stdio: 'ignore' }
)

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function waitForDevtools() {
  for (let i = 0; i < 100; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json/version`)
      if (res.ok) return res.json()
    } catch {
      /* not up yet */
    }
    await sleep(150)
  }
  throw new Error('devtools did not start')
}

let id = 0
function makeClient(ws) {
  const pending = new Map()
  ws.addEventListener('message', (ev) => {
    const msg = JSON.parse(ev.data)
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id)
      pending.delete(msg.id)
      if (msg.error) reject(new Error(JSON.stringify(msg.error)))
      else resolve(msg.result)
    }
  })
  return (method, params = {}) =>
    new Promise((resolve, reject) => {
      const mid = ++id
      pending.set(mid, { resolve, reject })
      ws.send(JSON.stringify({ id: mid, method, params }))
    })
}

async function main() {
  await waitForDevtools()
  const target = await (
    await fetch(`http://127.0.0.1:${PORT}/json/new?${url}`, { method: 'PUT' })
  ).json()

  const ws = new WebSocket(target.webSocketDebuggerUrl)
  await new Promise((res, rej) => {
    ws.addEventListener('open', res, { once: true })
    ws.addEventListener('error', rej, { once: true })
  })
  const send = makeClient(ws)
  await send('Page.enable')
  await send('Runtime.enable')
  if (process.env.DL_DIR) {
    try {
      await send('Browser.setDownloadBehavior', {
        behavior: 'allow',
        downloadPath: process.env.DL_DIR,
        eventsEnabled: true,
      })
    } catch (e) {
      console.log('download-behavior-failed', e.message)
    }
  }

  // wait for app boot
  for (let i = 0; i < 120; i++) {
    const r = await send('Runtime.evaluate', {
      expression: 'location.search + "|" + !!document.querySelector(".topbar")',
      returnByValue: true,
    })
    if (String(r.result.value).includes('true')) break
    await sleep(150)
  }
  await sleep(1200)

  if (exprFile) {
    const expr = readFileSync(exprFile, 'utf8')
    const res = await send('Runtime.evaluate', {
      expression: expr,
      awaitPromise: true,
      returnByValue: true,
      allowUnsafeEvalBlockedByCSP: true,
    })
    if (res.exceptionDetails) {
      console.log('EXCEPTION', JSON.stringify(res.exceptionDetails).slice(0, 2000))
    } else if (resultFile && typeof res.result.value === 'string') {
      writeFileSync(resultFile, res.result.value)
      console.log('RESULT->', resultFile, res.result.value.length, 'chars')
    } else {
      console.log('RESULT', JSON.stringify(res.result.value))
    }
  }

  if (shot) {
    mkdirSync('/tmp/cadence-shots', { recursive: true })
    const { data } = await send('Page.captureScreenshot', { format: 'png' })
    writeFileSync(shot, Buffer.from(data, 'base64'))
    console.log('SHOT', shot)
  }

  ws.close()
  chrome.kill()
}

main().catch((e) => {
  console.error('HARNESS ERROR', e)
  chrome.kill()
  process.exit(1)
})
