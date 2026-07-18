# Matou — Hybrid plan (the reconciled decision)

We have two tracks (see `specs/README.md`): **Track A** = the shipped prototypes + live LLM; **Track B** = the full `specs/` production design. We're building **Hybrid**: Track A's UI and live-LLM feel, borrowing Track B's structure and RGPD posture. This file is the single source of truth for how they reconcile.

## What we KEEP from Track A (our build)
- **The Chaîne mountain map** — 4 summits, climb one then the next unlocks.
- **The moteur-first flow** — ask before explaining; personalize on the user's answers.
- **Live LLM ✨** — Haiku 4.5 generates **one** personalized follow-up question per theme at runtime (`BACKEND-SPEC.md`, `/api/generate-question`). This is our differentiator. It stays — clearly labeled ✨, always with a hardcoded fallback so the flow never breaks.
- **Rich question affordances** — `single · multi · scale · amount` + emoji, for onboarding/discovery and the tools (brut→net slider, etc.).
- **Light stateless backend** — one endpoint now; LocalStorage on the frontend for progress.

## What we BORROW from the specs (Track B)
- **Vocabulary = themes / levels / trophies.**
  - 4 **themes** = the 4 mountains: `revenu`, `budget`, `impots`, `investissement` (display: Revenus / Budget / Impôts / Investir).
  - Prerequisites: `impots` needs `revenu`; `investissement` needs `budget` (drives unlock order).
- **Levels as the nodes on a mountain.** A level = a short set of ~5 items; **pass at 4/5 (≥80%)**; a skipped item counts as incorrect. Completing all levels of a theme = summit reached.
- **Trophy per theme** — one honorific trophy per summit (our boss node), awarded when all its levels are passed. Unlocks offer eligibility only, never content.
- **Banded profile, RGPD-clean.** Profile stores **bands/categories only** (e.g. income-bracket b1–b5), never exact amounts. `undisclosed` is a first-class answer. Every profile question is consent-gated and skippable.
  - The **brut→net tool** may still use the exact salary for the live calculation — but that number is **ephemeral (UI-only), never stored** in the profile. If we persist anything, we persist the band.
- **Legal / educational limits (jury-credible).**
  - **No personalized financial, tax, or investment advice** — everything is framed as general education.
  - Mandatory **disclaimers on the `impots` and `investissement` themes.**
  - At MVP, `impots` = general concepts only (no official-rate calculators).
  - No learner data sent to any partner offer.

## What we do NOT take from the specs
- The deterministic BKT + spaced-repetition engine, the human-review content pipeline, the full REST API, the versioned content packages, offline-only LLM. Correct for a real product; out of scope for 48h. (They remain the post-hackathon north star in `specs/`.)

## Mapping table (so the two vocabularies line up)
| Our UI (Track A) | Hybrid term (borrowed) | Notes |
|---|---|---|
| Mountain | **Theme** | 4 of them; ids `revenu/budget/impots/investissement` |
| Node on the path | **Level** | ~5 items, pass 4/5 |
| Boss / summit reward | **Trophy** | one per theme, honorific |
| Onboarding "profil" questions | **Discovery / profile** | banded, consent-gated, `undisclosed` allowed |
| ✨ generated question | live LLM (kept) | the one non-deterministic part; labeled ✨, has fallback |
| brut→net slider value | ephemeral | not stored; only the band is (if anything) |

## Impact on the React build (Phase 2)
- Data model uses **themes → levels (5 items, 4/5 pass) → trophies**, plus a **banded profile** with consents.
- Keep the `services/llm.js` seam + `/api/generate-question` for the ✨ question.
- Add disclaimers on impots/investissement screens.
- Everything else in the approved React plan (`we-will-connect-llm-lovely-sparkle.md`) stands.
