# Matou — Backend Spec (LLM question generator)

> **Hybrid alignment** (see `HYBRID.md`): `domain` here = a **theme** (`revenu`/`budget`/`impots`/`investissement`). `profile` values must be **bands/categories only** (e.g. income-bracket `b1`–`b5`), never exact amounts — pass the band, not the salary. Everything else below is unchanged; this endpoint is the one live-LLM (✨) part of the hybrid build.

The frontend is 100% static except for **one** thing it needs from the backend: generating a **single personalized question** per domain (theme) from the user's profile + prior answers. Everything else (static questions, tools, map, scoring, XP) lives in the frontend. Build this one endpoint and we're done.

Frontend seam it plugs into: `services/llm.js → generateQuestion(domain, answers, profile)` (see `round4-questions.html`, questions tagged `source:'llm'`). It's called once per domain, after the static questions, while a "Matou réfléchit ✨" screen shows (~1.2s budget).

---

## The endpoint

```
POST /api/generate-question
Content-Type: application/json
```

### Request

```jsonc
{
  "domain": "revenus",          // "revenus" | "budget" | "impots" | "invest"
  "profile": {                  // from the static Profil onboarding (never LLM)
    "situation": "premier",     // "etudiant" | "premier" | "poste" | "freelance" | "entre_deux"
    "age": "25-34",
    "goals": ["mettre_de_cote", "comprendre_paie"],
    "confidence": 3             // 1..5
  },
  "answers": {                  // the user's answers to THIS domain's static questions
    "type": ["salaire"],
    "brutnet": "a_peu_pres",
    "net": 2100,
    "var": "stables"
  },
  "locale": "fr-FR"
}
```

### Response `200`

A single question object. The model produces exactly this shape (enforced by structured output, below):

```jsonc
{
  "type": "single",                         // "single" | "multi" | "scale" | "amount"
  "q": "Sur 2 100 € net, quelle part penses-tu pouvoir mettre de côté ?",
  "sub": "Une estimation, pas un engagement",   // optional subtitle
  "opts": [                                 // for "single" | "multi" only
    { "emoji": "🙂", "label": "~10 %",  "value": "10" },
    { "emoji": "😀", "label": "~20 %",  "value": "20" },
    { "emoji": "🤑", "label": "~30 %",  "value": "30" },
    { "emoji": "🤷", "label": "Aide-moi", "value": "help" }
  ]
  // for "scale":  add  "lo": "Prudent", "hi": "Aventurier"   (scale is fixed 1..5, no opts)
  // for "amount": add  "min": 0, "max": 1000, "step": 10, "def": 100, "unit": "€"  (no opts)
}
```

Frontend adapter (tiny): `opts` objects map to the prototype's `[emoji,label]` pairs; `value` is stored as the answer. Nothing else changes in the app.

### Errors / fallback
- On any failure (timeout, 5xx, refusal, invalid JSON), return `422` with `{ "error": "generation_failed" }`.
- The frontend **must** ship a hardcoded fallback question per domain so the flow never breaks — treat the LLM question as an enhancement, not a dependency. (Keep the current `_llm` placeholder questions from `round4-questions.html` as those fallbacks.)

---

## Claude implementation (Node / TypeScript)

Matches the frontend's JS ecosystem. Uses the official SDK.

```bash
npm i @anthropic-ai/sdk
# env: ANTHROPIC_API_KEY=sk-ant-...
```

```ts
import Anthropic from "@anthropic-ai/sdk";
const client = new Anthropic(); // reads ANTHROPIC_API_KEY

// Structured-output schema — forces valid JSON, no post-parsing guesswork.
const QUESTION_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["type", "q"],
  properties: {
    type: { type: "string", enum: ["single", "multi", "scale", "amount"] },
    q:    { type: "string" },
    sub:  { type: "string" },
    opts: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["emoji", "label", "value"],
        properties: {
          emoji: { type: "string" },
          label: { type: "string" },
          value: { type: "string" },
        },
      },
    },
    lo: { type: "string" }, hi: { type: "string" },      // scale endpoints
    min: { type: "number" }, max: { type: "number" },
    step: { type: "number" }, def: { type: "number" }, unit: { type: "string" }, // amount
  },
} as const;

const SYSTEM = `Tu es le moteur de questions de Matou, une app d'éducation financière française.
À partir du profil et des réponses de l'utilisateur, génère UNE seule question de suivi, sur-mesure.
Règles STRICTES :
- Français, tutoiement, ton chaleureux et simple. Zéro jargon.
- La question doit être répondable en un seul geste (choix / curseur), jamais en texte libre.
- Elle doit s'appuyer sur les réponses fournies (cite un chiffre ou un choix de l'utilisateur).
- Reste dans le domaine demandé (revenus / budget / impots / invest).
- single/multi : 3 à 4 options max, chaque option avec un emoji, un label court, une value courte (slug ou nombre).
- scale : fournis lo et hi (échelle 1..5, pas d'options).
- amount : fournis min, max, step, def, unit (ex: "€").
- Ne demande JAMAIS de données personnelles identifiantes (nom, email, IBAN...).
- Chiffres et dispositifs français réels (Livret A, cotisations ~22%, tranches, PEA).`;

export async function generateQuestion(req: {
  domain: string; profile: unknown; answers: unknown; locale?: string;
}) {
  const msg = await client.messages.create({
    model: "claude-haiku-4-5",          // fast + cheap; see "Model choice" below
    max_tokens: 400,                     // one small question — keep it tight for latency
    system: SYSTEM,
    output_config: { format: { type: "json_schema", schema: QUESTION_SCHEMA } },
    messages: [{
      role: "user",
      content: JSON.stringify({ domain: req.domain, profile: req.profile, answers: req.answers }),
    }],
  });
  const text = msg.content.find((b) => b.type === "text")?.text ?? "";
  return JSON.parse(text); // guaranteed to match QUESTION_SCHEMA
}
```

Express wiring:

```ts
app.post("/api/generate-question", async (req, res) => {
  try {
    res.json(await generateQuestion(req.body));
  } catch (e) {
    res.status(422).json({ error: "generation_failed" });
  }
});
```

### Model choice
- **`claude-haiku-4-5`** — recommended. Fastest + cheapest ($1 / $5 per 1M tokens), ideal for a one-question latency-sensitive endpoint. Structured outputs supported.
- **`claude-sonnet-5`** — swap in if you want richer, more clever questions and can spend ~300–800ms more. Same request shape (just change the `model` string).
- Do **not** add `thinking` — not needed here, and it adds latency. Do not set `temperature` etc.; defaults are fine.

### Key params (why)
| Param | Value | Why |
|---|---|---|
| `model` | `claude-haiku-4-5` | fast/cheap, structured-output capable |
| `max_tokens` | `~400` | one short question; small cap = low latency |
| `output_config.format` | `json_schema` + `QUESTION_SCHEMA` | **forces** valid JSON in the exact shape — no fragile parsing |
| `system` | the French rules above | language, tone, one-tap constraint, no-PII, real FR data |
| `messages[0]` | `JSON.stringify({domain,profile,answers})` | the per-request variable content |

### Cost optimization (optional)
The `system` prompt is identical every call — add prompt caching to cut cost/latency:
```ts
system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
```
Put the volatile `{domain,profile,answers}` in the user turn (already is) so the cached prefix stays stable.

---

## Non-functional

- **CORS**: allow the deployed frontend origin (Vercel/Netlify URL).
- **Latency target**: < ~1.5s p95 (frontend shows a ~1.2s "réfléchit" beat). Haiku easily fits.
- **Auth / key**: `ANTHROPIC_API_KEY` server-side only — never ship it to the frontend. The frontend calls **your** endpoint, not Anthropic directly.
- **Rate limiting**: light per-IP limit is enough for a hackathon (e.g. 30/min).
- **Profil is static-only** — the frontend never calls this endpoint for the Profil set. Only the 4 domains. If `domain` isn't one of the four, return `422`.

---

## Contract summary (for the frontend↔backend handshake)
- Frontend sends `{domain, profile, answers, locale}`.
- Backend returns one question in the response shape above (or `422`).
- Question types and fields exactly match the frontend's `Question` model (`round4-questions.html` → `SETS`), so a generated question renders through the same `QuestionEngine` as the static ones.
