import { BASE_SYSTEM, buildDeckPrompt, type GenRequest } from '../src/ai/prompts'

const key = process.env.AI_GATEWAY_API_KEY
if (!key) throw new Error('missing AI_GATEWAY_API_KEY')

const model = process.argv[2] ?? 'anthropic/claude-sonnet-4.5'

const req: GenRequest = {
  topic:
    'An internal strategy review for a 400-person logistics company that is losing margin to route inefficiency. Leadership needs to approve a 90-day restructuring plan.',
  archetype: 'strategy',
  theme: 'meridian',
  count: 10,
  tone: 'direct, confident',
  audience: 'board and exec team',
  language: 'English',
  notes: '',
  mustInclude: 'the decision required, the cost, the 90-day sequence',
}

const started = Date.now()
const res = await fetch('https://ai-gateway.vercel.sh/v1/chat/completions', {
  method: 'POST',
  headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
  body: JSON.stringify({
    model,
    temperature: 0.75,
    max_tokens: 9000,
    messages: [
      { role: 'system', content: BASE_SYSTEM },
      { role: 'user', content: buildDeckPrompt(req) },
    ],
  }),
})

const raw = await res.text()
if (!res.ok) {
  console.error('HTTP', res.status, raw.slice(0, 600))
  process.exit(1)
}
const body = JSON.parse(raw) as {
  choices?: { message?: { content?: string } }[]
  usage?: Record<string, number>
}
const text = body.choices?.[0]?.message?.content ?? ''
const ms = Date.now() - started

let parsed: { title?: string; slides?: { type?: string; title?: string }[] } | null = null
try {
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  parsed = JSON.parse(text.slice(start, end + 1))
} catch {
  /* report raw */
}

console.log(
  JSON.stringify(
    {
      model,
      ms,
      chars: text.length,
      usage: body.usage,
      parsed: !!parsed,
      title: parsed?.title,
      slides: parsed?.slides?.length,
      types: parsed?.slides?.map((s) => s.type),
      titles: parsed?.slides?.map((s) => s.title),
      head: parsed ? undefined : text.slice(0, 300),
    },
    null,
    1
  )
)
