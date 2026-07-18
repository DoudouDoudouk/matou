# 🐱 Matou

**Apprends l'argent, un geste par jour.**

Matou is a playful, gamified **financial-education web app** built for a France hackathon (July 2026). No jargon, no pressure — an adaptive engine ("le moteur") asks you the right questions, explains only what concerns you, and makes you act on **your** real money: brut→net, budget, impôts, épargne.

100% frontend · pastel premium design · [Clash Display + Satoshi] type.

## ✨ What makes it different

- **Moteur adaptatif** — every section *asks before it explains*. Questions first (your situation, your numbers), tailored lesson second.
- **Static + LLM questions** — a fixed base set per domain, plus a question **generated on the fly** ✨ from your previous answers.
- **Learn → Do** — each step ends in a real tool on your own figures (real French data: Livret A 3%, cotisations ~22%, tranches).
- **Un parcours en montagnes** — 4 summits to climb: Revenus · Budget · Impôts · Investir.

## 🗺️ Screens (prototypes)

| File | Screen |
|------|--------|
| `index.html` | Landing hub |
| `round2-montagnes.html` | **La carte** — Chaîne, 4 mountains |
| `round3.html` | **La leçon** — moteur adaptatif (brut→net) |
| `round4-questions.html` | **Les questions** — profil + 4 domaines (static + ✨ LLM) |
| `round1.html` | Design explorations (5 home looks) |

## 🚀 Run

Pure static HTML — just open `index.html`, or serve the folder:

```bash
npx serve .
```

## 🛠️ Deploy

Zero build. Any static host:

```bash
npx vercel --prod      # or
npx netlify deploy --prod
```

## 🧭 Roadmap

- **Now:** clickable prototypes (design converged).
- **Next:** React app (Vite + React + Zustand + persist) — closed loop, saved progress, LLM connected.

## 📐 Plan & specs
- [`HYBRID.md`](HYBRID.md) — **the reconciled build plan** (Track A's live-LLM feel + borrowed themes/levels/trophies + RGPD posture). Start here.
- [`BACKEND-SPEC.md`](BACKEND-SPEC.md) — the one backend endpoint (live ✨ question generator, Haiku 4.5).
- [`specs/`](specs/) — full production design (Elicit / Matou Finance). North star, **not** the 48h build — see [`specs/README.md`](specs/README.md).

---

Fait avec ❤️ en France 🇫🇷
