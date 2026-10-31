// Vercel serverless function: the only place API keys live.
//
// Providers (first one with a key wins, or force with AI_PROVIDER=groq|huggingface|anthropic):
//   GROQ_API_KEY        Groq (default model openai/gpt-oss-120b)
//   HF_TOKEN            Hugging Face Inference Providers
//   ANTHROPIC_API_KEY   Claude
//
// GET  /api/assist                     -> { ready, provider, model, transcribe }
// POST /api/assist { mode: 'turn' }       analyze a clinician line: speaker, addressee, jargon, replies, translation
// POST /api/assist { mode: 'simplify' }   rewrite text in plain words (and the patient's language)
// POST /api/assist { mode: 'translate' }  translate the patient's typed words for the clinician
// POST /api/assist { mode: 'strings' }    translate interface strings into the patient's language
// POST /api/assist { mode: 'recap' }      plain-language visit recap
import { z } from 'zod'

const CLAUDE_MODEL = 'claude-opus-5-5'

const OPENAI_COMPATIBLE = {
  groq: {
    url: 'https://api.groq.com/openai/v1/chat/completions',
    key: () => process.env.GROQ_API_KEY || '',
    model: (mode) => process.env[`GROQ_MODEL_${mode.toUpperCase()}`] || process.env.GROQ_MODEL || 'openai/gpt-oss-120b',
  },
  huggingface: {
    url: 'https://router.huggingface.co/v1/chat/completions',
    key: () => process.env.HF_TOKEN || process.env.HUGGINGFACE_API_KEY || '',
    model: (mode) => process.env[`HF_MODEL_${mode.toUpperCase()}`] || process.env.HF_MODEL || 'meta-llama/Llama-3.3-70B-Instruct',
  },
}

export function provider() {
  const has = { groq: OPENAI_COMPATIBLE.groq.key(), huggingface: OPENAI_COMPATIBLE.huggingface.key(), anthropic: process.env.ANTHROPIC_API_KEY }
  const forced = process.env.AI_PROVIDER
  if (forced && has[forced]) return forced
  return ['groq', 'huggingface', 'anthropic'].find((p) => has[p]) ?? null
}
const modelFor = (p, mode) => (p === 'anthropic' ? CLAUDE_MODEL : OPENAI_COMPATIBLE[p].model(mode))

const LANG_NAMES = {
  en: 'English', es: 'Spanish', zh: 'Simplified Chinese', ar: 'Arabic', vi: 'Vietnamese', tl: 'Tagalog', fr: 'French', ko: 'Korean',
  ru: 'Russian', pt: 'Portuguese', ht: 'Haitian Creole', hi: 'Hindi', fa: 'Persian', ja: 'Japanese', de: 'German',
}
const langName = (code) => LANG_NAMES[code] ?? 'English'

// ---------- Output schemas ----------

const Term = z.object({ term: z.string(), plain: z.string() })
const SCHEMAS = {
  turn: z.object({
    speaker: z.enum(['clinician', 'caregiver']),
    addressee: z.enum(['patient', 'caregiver', 'unclear']),
    terms: z.array(Term),
    replies: z.array(z.object({ en: z.string(), local: z.string() })).min(1),
    translation: z.string(),
  }),
  simplify: z.object({ plain: z.string(), plain_en: z.string(), terms: z.array(Term) }),
  translate: z.object({ translation: z.string() }),
  strings: z.object({ items: z.array(z.object({ key: z.string(), text: z.string() })) }),
  recap: z.object({
    summary: z.string(),
    next_steps: z.array(z.string()),
    local: z.object({ summary: z.string(), next_steps: z.array(z.string()) }),
  }),
}

// The JSON shape shown to OpenAI-compatible models.
const SHAPES = {
  turn: '{"speaker":"clinician|caregiver","addressee":"patient|caregiver|unclear","terms":[{"term":"...","plain":"..."}],"replies":[{"en":"...","local":"..."}],"translation":"..."}',
  simplify: '{"plain":"...","plain_en":"...","terms":[{"term":"...","plain":"..."}]}',
  translate: '{"translation":"..."}',
  strings: '{"items":[{"key":"...","text":"..."}]}',
  recap: '{"summary":"...","next_steps":["..."],"local":{"summary":"...","next_steps":["..."]}}',
}

// ---------- Prompts ----------

const SYSTEM = `You support Beside, an app used during medical visits by disabled patients: people who are nonverbal, autistic, deaf or hard of hearing, or who have speech or cognitive disabilities. The patient reads live captions on their phone and answers by tapping suggested replies, which Beside speaks aloud to the clinician.

Write at about a 5th grade reading level: short sentences, everyday words, warm and concrete. Never invent diagnoses, test results, or instructions that were not said. Respect the patient's own "This is me" card.`

const clip = (s, n) => String(s ?? '').slice(0, n)
const cardText = (p) =>
  [
    `Name: ${clip(p?.name, 40)}${p?.pronouns ? ` (${clip(p.pronouns, 20)})` : ''}`,
    ...(Array.isArray(p?.card) ? p.card.slice(0, 6).map((c) => `${clip(c.title, 60)}: ${clip(c.body, 400)}`) : []),
    p?.accommodations?.length ? `Needs: ${p.accommodations.slice(0, 12).map((a) => clip(a, 60)).join('; ')}` : '',
  ]
    .filter(Boolean)
    .join('\n')
const transcript = (lines, max) =>
  (Array.isArray(lines) ? lines : [])
    .slice(-max)
    .map((l) => `${{ clinician: 'Clinician', caregiver: 'Companion', patient: 'Patient (via app)' }[l.who] ?? 'Someone'}: ${clip(l.text, 500)}`)
    .join('\n')

const PROMPTS = {
  turn: ({ utterance, patient, history, lang }) => {
    const L = langName(lang)
    return `Patient card:
${cardText(patient)}

Recent conversation:
${transcript(history, 8) || '(start of visit)'}

New line heard in the room: "${clip(utterance, 1000)}"

Return JSON:
- speaker: "clinician", unless the words are clearly the companion's (for example "You can ask them").
- addressee: is the clinician speaking TO the patient ("patient") or ABOUT the patient to the companion ("caregiver")? Examples: "So Mom, how long has she had this?" -> "caregiver". "Does he take any medicine?" -> "caregiver". "${clip(patient?.name, 40) || 'Sam'}, where does it hurt?" -> "patient". "How are you feeling today?" -> "patient". Any third-person reference to the patient (she, he, they, their name) means "caregiver". Use "unclear" only if truly ambiguous.
- terms: every medical term, abbreviation, or jargon phrase, copied exactly as written, each with a short plain-English replacement that reads naturally in the sentence. [] if none.
- replies: exactly 3 short first-person replies the patient is likely to tap next (under 10 words each), meaningfully different (for example yes / no / a question or need). Use the card. "en" is English (spoken aloud to the clinician). "local" is the same reply in ${L}${lang === 'en' ? ' (use "")' : ''}.
- translation: ${
      lang === 'en'
        ? '""'
        : `the whole line in plain, simple ${L}, with no English words. Wrap each medical term you simplified as [[plain ${L} words|original English term]]: the part before | must be ${L}, only the part after | stays English. Address the patient informally and warmly.`
    }`
  },
  simplify: ({ text, patient, lang }) => {
    const L = langName(lang)
    return `Patient card:
${cardText(patient)}

Rewrite this for the patient in plain words: "${clip(text, 3000)}"

Return JSON:
- plain: the full meaning in short, simple ${L}. Keep every instruction, number, and time. Explain each medical word in everyday terms.
- plain_en: the same plain version in English.
- terms: medical terms from the original, each with a short plain-English meaning. [] if none.`
  },
  translate: ({ text, from, to }) => `Translate what the patient typed from ${langName(from)} into ${langName(to ?? 'en')}. Keep their meaning and voice. First person.

Text: "${clip(text, 1000)}"

Return JSON: {"translation": "..."}`,
  strings: ({ strings, lang }) => {
    const items = Object.entries(strings ?? {})
      .slice(0, 150)
      .map(([key, text]) => ({ key: clip(key, 80), text: clip(text, 600) }))
    return `Translate each item's "text" into ${langName(lang)} for a patient-facing medical communication app used by disabled patients.
Rules: plain, warm, short like app interface text, and grammatically natural for a native speaker. Keep placeholders such as {name} or {doctor} exactly. Keep any [[a|b]] markup: translate "a", leave "b" unchanged. Keep "Beside" as the app name. Return every key, unchanged.

Items:
${JSON.stringify(items)}

Return JSON: {"items":[{"key":"...","text":"..."}]}`
  },
  recap: ({ patient, transcript: lines, accommodations, lang }) => {
    const L = langName(lang)
    return `Patient card:
${cardText(patient)}

Visit transcript:
${transcript(lines, 60) || '(empty)'}

Accommodations: ${(accommodations ?? []).slice(0, 12).map((a) => clip(a, 80)).join('; ') || 'none'}

Write the patient's recap. Speak to the patient as "you". Only use what was said.
- summary: 1 or 2 short sentences about what the visit found or decided.
- next_steps: 2 to 5 short, concrete steps. If a step involves touch, needles, or noise, say so gently.
- local: the same summary and next_steps in ${L}${lang === 'en' ? ' (use "" and [])' : ''}.`
  },
}

// ---------- Providers ----------

function extractJson(text) {
  const s = String(text ?? '').replace(/```(?:json)?/gi, '')
  const start = s.indexOf('{')
  const end = s.lastIndexOf('}')
  if (start < 0 || end <= start) throw new Error('No JSON in model output')
  return JSON.parse(s.slice(start, end + 1))
}

async function callOpenAICompatible(p, mode, prompt) {
  const cfg = OPENAI_COMPATIBLE[p]
  const model = cfg.model(mode)
  const messages = [
    { role: 'system', content: `${SYSTEM}\n\nReply with one JSON object only, no prose, matching: ${SHAPES[mode]}` },
    { role: 'user', content: prompt },
  ]
  const long = mode === 'strings' || mode === 'recap'
  for (let attempt = 0; attempt < 2; attempt++) {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), long ? 45000 : 20000)
    try {
      const body = { model, messages, temperature: 0.2, max_completion_tokens: mode === 'strings' ? 8000 : 2000 }
      if (p === 'groq') {
        body.response_format = { type: 'json_object' }
        // Reasoning models: think briefly, captions need to be fast.
        if (model.startsWith('openai/gpt-oss')) body.reasoning_effort = long ? 'medium' : 'low'
      } else {
        body.max_tokens = body.max_completion_tokens
        delete body.max_completion_tokens
      }
      const res = await fetch(cfg.url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${cfg.key()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: ctrl.signal,
      })
      if (!res.ok) {
        const detail = await res.text().catch(() => '')
        const err = new Error(`${p} ${res.status}: ${detail.slice(0, 200)}`)
        err.status = res.status
        throw err
      }
      const data = await res.json()
      const parsed = SCHEMAS[mode].safeParse(extractJson(data.choices?.[0]?.message?.content))
      if (parsed.success) return parsed.data
      messages.push({ role: 'user', content: `That did not match. Return only JSON matching ${SHAPES[mode]}` })
    } catch (err) {
      if (err.status && err.status < 500 && err.status !== 429 && err.status !== 400) throw err
      if (attempt === 1) throw err
    } finally {
      clearTimeout(timer)
    }
  }
  throw new Error('Model did not return valid JSON')
}

async function callClaude(mode, prompt) {
  const { default: Anthropic } = await import('@anthropic-ai/sdk')
  const { zodOutputFormat } = await import('@anthropic-ai/sdk/helpers/zod')
  const client = new Anthropic()
  const response = await client.messages.parse({
    model: CLAUDE_MODEL,
    max_tokens: mode === 'strings' ? 16000 : 8000,
    system: SYSTEM,
    messages: [{ role: 'user', content: prompt }],
    // Low effort keeps live captions fast; these are short, well-specified tasks.
    output_config: { effort: 'low', format: zodOutputFormat(SCHEMAS[mode]) },
  })
  if (response.stop_reason === 'refusal' || !response.parsed_output) throw new Error('No usable output')
  return response.parsed_output
}

// ---------- Handler ----------

function shape(mode, out) {
  if (mode === 'strings') return { strings: Object.fromEntries(out.items.map((i) => [i.key, i.text])) }
  if (mode === 'turn') return { ...out, replies: out.replies.slice(0, 3) }
  return out
}

export default async function handler(req, res) {
  const p = provider()
  if (req.method === 'GET') {
    return res.status(200).json({ ready: Boolean(p), provider: p, model: p ? modelFor(p, 'turn') : null, transcribe: Boolean(process.env.GROQ_API_KEY) })
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use GET or POST' })
  if (!p) return res.status(503).json({ error: 'No AI key configured. Set GROQ_API_KEY, HF_TOKEN, or ANTHROPIC_API_KEY.' })

  const body = req.body ?? {}
  const mode = body.mode
  if (!PROMPTS[mode]) return res.status(400).json({ error: 'Unknown mode' })
  // Don't spend AI calls on empty input.
  const filled = (v) => typeof v === 'string' && v.trim().length > 0
  const valid = {
    turn: () => filled(body.utterance),
    simplify: () => filled(body.text),
    translate: () => filled(body.text),
    strings: () => body.strings && typeof body.strings === 'object' && Object.keys(body.strings).length > 0,
    recap: () => true,
  }[mode]
  if (!valid()) return res.status(400).json({ error: 'Nothing to process' })
  if (!LANG_NAMES[body.lang ?? 'en']) body.lang = 'en'

  try {
    const prompt = PROMPTS[mode](body)
    const out = p === 'anthropic' ? await callClaude(mode, prompt) : await callOpenAICompatible(p, mode, prompt)
    return res.status(200).json(shape(mode, out))
  } catch (err) {
    console.error(`[assist:${mode}]`, err.message)
    return res.status(err.status === 429 ? 429 : 502).json({ error: 'AI request failed' })
  }
}
