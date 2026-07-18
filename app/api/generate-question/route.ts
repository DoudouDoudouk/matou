import { NextRequest, NextResponse } from "next/server";

const SYSTEM = `Tu es le moteur de questions de Matou, une app d'éducation financière française (façon Duolingo).
À partir du profil et des réponses de l'utilisateur, génère UNE seule question de suivi, sur-mesure, pour l'aider à mieux utiliser son argent.
Règles STRICTES :
- Français, tutoiement, ton chaleureux et simple. Zéro jargon.
- Réponds UNIQUEMENT avec un objet JSON valide, rien d'autre.
- La question doit être répondable en un seul geste (choix), jamais en texte libre.
- Elle doit s'appuyer sur le profil fourni (situation, revenus en bande, objectif).
- Reste dans le domaine demandé (revenu / budget / impots / investissement).
- 3 à 4 options max, chaque option avec un emoji, un label court, une value courte (slug).
- Ne demande JAMAIS de données personnelles identifiantes (nom, email, IBAN...).
- Chiffres et dispositifs français réels si besoin (Livret A, cotisations ~22%, tranches).
- Détermine d'abord si la question est OUVERTE (elle sert à connaître la situation/préférence de l'utilisateur, aucune option n'est objectivement meilleure — ex: "quel est ton objectif ?") ou FERMÉE (il existe une réponse nettement plus pertinente d'un point de vue financier — ex: "que faire d'un Livret A plein ?").
- Si la question est OUVERTE : mets "type":"reflect" et ne marque aucune option comme correcte.
- Si la question est FERMÉE : mets "type":"quiz", marque "correct":true sur la (les) meilleure(s) option(s), "correct":false sur les autres, et ajoute un champ "fb" (une phrase courte expliquant pourquoi, affichée après la réponse).
Format de réponse exact :
{"type": "reflect"|"quiz", "q": "...", "opts": [{"emoji":"🙂","label":"...","value":"...","correct":true|false}, ...], "fb": "..."}
(le champ "correct" est optionnel/ignoré si "type" vaut "reflect", "fb" est optionnel pour "reflect")`;

type GeneratedQuestion = {
  type: "reflect" | "quiz";
  q: string;
  opts: { emoji: string; label: string; value: string; correct?: boolean }[];
  fb?: string;
};

function isValid(x: unknown): x is GeneratedQuestion {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  if (typeof o.q !== "string" || !o.q.trim()) return false;
  if (!Array.isArray(o.opts) || o.opts.length < 2 || o.opts.length > 4) return false;
  if (o.type !== "reflect" && o.type !== "quiz") return false;
  if (o.type === "quiz" && !o.opts.some((opt) => (opt as Record<string, unknown>).correct === true)) return false;
  return o.opts.every(
    (opt) =>
      opt &&
      typeof opt === "object" &&
      typeof (opt as Record<string, unknown>).emoji === "string" &&
      typeof (opt as Record<string, unknown>).label === "string"
  );
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.MISTRAL_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "generation_failed" }, { status: 422 });
  }

  let body: { domain?: string; profile?: unknown; answers?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "generation_failed" }, { status: 422 });
  }

  const domain = body.domain;
  if (!domain || !["revenu", "budget", "impots", "investissement"].includes(domain)) {
    return NextResponse.json({ error: "generation_failed" }, { status: 422 });
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);

    const res = await fetch("https://api.mistral.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "mistral-small-latest",
        messages: [
          { role: "system", content: SYSTEM },
          {
            role: "user",
            content: JSON.stringify({ domain, profile: body.profile ?? {}, answers: body.answers ?? {} }),
          },
        ],
        response_format: { type: "json_object" },
        max_tokens: 400,
        temperature: 0.7,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) {
      return NextResponse.json({ error: "generation_failed" }, { status: 422 });
    }

    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content;
    const parsed = typeof text === "string" ? JSON.parse(text) : null;

    if (!isValid(parsed)) {
      return NextResponse.json({ error: "generation_failed" }, { status: 422 });
    }

    return NextResponse.json(parsed);
  } catch {
    return NextResponse.json({ error: "generation_failed" }, { status: 422 });
  }
}
