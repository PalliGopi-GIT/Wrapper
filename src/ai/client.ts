import type { AIConfig, AIProvider } from '../model/types.js'

export const PROVIDERS: {
  id: AIProvider['id']
  label: string
  base: string
  model: string
  note: string
  models: string[]
}[] = [
  {
    id: 'vercel',
    label: 'Vercel AI Gateway',
    base: 'https://ai-gateway.vercel.sh/v1',
    model: 'anthropic/claude-sonnet-4.5',
    note: 'One key for 300+ models. Bills against your Vercel team’s Gateway credits.',
    models: [
      'anthropic/claude-sonnet-4.5',
      'anthropic/claude-sonnet-5',
      'anthropic/claude-haiku-4.5',
      'openai/gpt-5',
      'openai/gpt-5-mini',
      'openai/gpt-6-astra',
      'google/gemini-3-flash',
      'google/gemini-2.5-flash',
      'spacexai/grok-4.20-non-reasoning',
    ],
  },
  {
    id: 'openai',
    label: 'OpenAI',
    base: 'https://api.openai.com/v1',
    model: 'gpt-4.1',
    note: 'Keys are stored in this browser only.',
    models: ['gpt-4.1', 'gpt-4o', 'o4-mini'],
  },
  {
    id: 'anthropic',
    label: 'Anthropic',
    base: 'https://api.anthropic.com/v1',
    model: 'claude-sonnet-4-5',
    note: 'Browser access is enabled with the direct-access header.',
    models: ['claude-sonnet-4-5', 'claude-opus-4-1', 'claude-haiku-4-5'],
  },
  {
    id: 'google',
    label: 'Google Gemini',
    base: 'https://generativelanguage.googleapis.com/v1beta',
    model: 'gemini-2.5-flash',
    note: 'Free tier works well for decks.',
    models: ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.0-flash'],
  },
  {
    id: 'openrouter',
    label: 'OpenRouter',
    base: 'https://openrouter.ai/api/v1',
    model: 'anthropic/claude-sonnet-4.5',
    note: 'One key for most frontier models.',
    models: ['anthropic/claude-sonnet-4.5', 'openai/gpt-5', 'google/gemini-2.5-flash'],
  },
  {
    id: 'custom',
    label: 'OpenAI-compatible',
    base: 'http://localhost:11434/v1',
    model: 'llama3.1',
    note: 'Ollama, LM Studio, vLLM, or your own gateway.',
    models: ['llama3.1', 'qwen2.5', 'mistral'],
  },
]

export const DEFAULT_CONFIG: AIConfig = {
  provider: 'vercel',
  model: 'anthropic/claude-sonnet-4.5',
  key: '',
  baseUrl: 'https://ai-gateway.vercel.sh/v1',
}

interface CallOptions {
  system: string
  user: string
  json?: boolean
  temperature?: number
  maxTokens?: number
}

export class AIError extends Error {
  constructor(message: string, readonly detail?: string) {
    super(message)
    this.name = 'AIError'
  }
}

async function post(
  url: string,
  headers: Record<string, string>,
  body: unknown,
  signal: AbortSignal,
  provider: AIProvider['id']
) {
  let res: Response
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: JSON.stringify(body),
      signal,
    })
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw new AIError('The model took too long to respond.')
    throw new AIError('Could not reach the model. Check the base URL and your connection.')
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    let msg = `Request failed (${res.status})`
    try {
      const parsed = JSON.parse(text) as { error?: { message?: string } }
      if (parsed.error?.message) msg = parsed.error.message
    } catch {
      if (text) msg = text.slice(0, 300)
    }
    if (res.status === 401 || res.status === 403) msg = 'That API key was rejected.'
    if (res.status === 402)
      msg =
        provider === 'vercel'
          ? 'AI Gateway budget exhausted. Raise the limit in Vercel → AI Gateway → Budgets & Spend, then try again.'
          : 'This account is out of credit for the selected model.'
    if (res.status === 429) msg = 'Rate limited. Wait a moment and try again.'
    throw new AIError(msg, text.slice(0, 600))
  }
  return res.json() as Promise<unknown>
}

export async function callModel(cfg: AIConfig, opts: CallOptions): Promise<string> {
  if (!cfg.key && cfg.provider !== 'custom') throw new AIError('Add an API key first.')
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 120_000)
  const maxTokens = opts.maxTokens ?? 8192

  try {
    if (cfg.provider === 'anthropic') {
      const data = (await post(
        join(cfg.baseUrl, '/messages'),
        {
          'x-api-key': cfg.key,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        {
          model: cfg.model,
          max_tokens: maxTokens,
          temperature: opts.temperature ?? 0.7,
          system: opts.system,
          messages: [{ role: 'user', content: opts.user }],
        },
        controller.signal,
        cfg.provider
      )) as { content?: { type: string; text?: string }[] }
      return (data.content ?? []).filter((c) => c.type === 'text').map((c) => c.text ?? '').join('')
    }

    if (cfg.provider === 'google') {
      const url = `${cfg.baseUrl.replace(/\/$/, '')}/models/${encodeURIComponent(
        cfg.model
      )}:generateContent?key=${encodeURIComponent(cfg.key)}`
      const data = (await post(
        url,
        {},
        {
          systemInstruction: { parts: [{ text: opts.system }] },
          contents: [{ role: 'user', parts: [{ text: opts.user }] }],
          generationConfig: {
            temperature: opts.temperature ?? 0.7,
            maxOutputTokens: maxTokens,
            ...(opts.json ? { responseMimeType: 'application/json' } : {}),
          },
        },
        controller.signal,
        cfg.provider
      )) as { candidates?: { content?: { parts?: { text?: string }[] } }[] }
      return (data.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? '').join('')
    }

    // OpenAI-compatible (openai / openrouter / custom)
    const headers: Record<string, string> = { authorization: `Bearer ${cfg.key}` }
    if (cfg.provider === 'openrouter') {
      headers['http-referer'] = location.href
      headers['x-title'] = 'Cadence'
    }
    const data = (await post(
      join(cfg.baseUrl, '/chat/completions'),
      headers,
      {
        model: cfg.model,
        temperature: opts.temperature ?? 0.7,
        max_tokens: maxTokens,
        messages: [
          { role: 'system', content: opts.system },
          { role: 'user', content: opts.user },
        ],
        ...(opts.json && cfg.provider === 'openai' ? { response_format: { type: 'json_object' } } : {}),
      },
      controller.signal,
      cfg.provider
    )) as { choices?: { message?: { content?: string } }[] }
    const text = data.choices?.[0]?.message?.content
    if (!text) throw new AIError('The model returned an empty response.')
    return text
  } finally {
    clearTimeout(timer)
  }
}

function join(base: string, path: string): string {
  return `${base.replace(/\/$/, '')}${path}`
}

/** Extract the first JSON object/array from a model response. */
export function extractJSON<T>(raw: string): T {
  let text = raw.trim()
  if (text.startsWith('```')) {
    text = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '')
  }
  const start = text.search(/[{[]/)
  if (start === -1) throw new AIError('The model did not return JSON.', raw.slice(0, 400))
  const open = text[start]
  const close = open === '{' ? '}' : ']'
  let depth = 0
  let inString = false
  let escaped = false
  let end = -1
  for (let i = start; i < text.length; i++) {
    const ch = text[i]
    if (inString) {
      if (escaped) escaped = false
      else if (ch === '\\') escaped = true
      else if (ch === '"') inString = false
      continue
    }
    if (ch === '"') inString = true
    else if (ch === open) depth++
    else if (ch === close) {
      depth--
      if (depth === 0) {
        end = i
        break
      }
    }
  }
  const slice = end === -1 ? text.slice(start) : text.slice(start, end + 1)
  try {
    return JSON.parse(slice) as T
  } catch {
    // common repairs: trailing commas, smart quotes
    const repaired = slice
      .replace(/,\s*([}\]])/g, '$1')
      .replace(/[\u201c\u201d]/g, '"')
      .replace(/[\u2018\u2019]/g, "'")
    try {
      return JSON.parse(repaired) as T
    } catch {
      throw new AIError('The model returned malformed JSON.', slice.slice(0, 400))
    }
  }
}
