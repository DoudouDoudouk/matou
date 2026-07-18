# specs/ — Full production design (Elicit / Matou Finance)

> ⚠️ **Read this first.** These specs describe a **different, larger architecture** than the app currently shipped in this repo. They are an aspirational, production/RGPD-grade design — not a spec for the HTML prototypes or for `../BACKEND-SPEC.md`. Pick a track before building the real backend.

## Two tracks in this repo

| | **Track A — Hackathon build** *(shipped)* | **Track B — This specs/ pack** *(aspirational)* |
|---|---|---|
| Where | `../index.html`, `../round*.html`, `../BACKEND-SPEC.md` | `specs/*` |
| Runtime LLM | **Yes** — Haiku 4.5 generates one ✨ question per domain live (`/api/generate-question`) | **No** — runtime is deterministic; LLM is offline-only and produces drafts that must pass `validatePackage` + human review + admin publish |
| Question model | `Question {type: single\|multi\|scale\|amount, opts:[{emoji,label,value}], ...}` | `Item.exercise` = `binary` \| `multiple-choice` only (`prompt`, `options[]`, `correctIndex`) — no scale/amount/emoji |
| Backend | 1 stateless endpoint | Full stateful REST API (onboarding, profile, consents, themes, levels, sessions, progression, trophies, offers, admin, analytics) |
| Content | prototyped / generated | pre-authored, SemVer-versioned, human-reviewed packs |
| Scope | ~48h demo | multi-package MVP1/MVP2/MVP-F, months of work |

**The two are not compatible as written.** Notably, Track B forbids the runtime LLM feature that Track A treats as its differentiator, and its `binary`/`multiple-choice` item model cannot represent Track A's `scale`/`amount`/emoji questions. `../BACKEND-SPEC.md` belongs to Track A and is intentionally **not** part of this normative set.

## Index of this pack

**Core (MVP1) — Elicit deterministic engine**
- `SPEC.md` — runtime core (LearnerState, sessions, BKT, scheduler, content pinning)
- `SPEC-SCHEMAS.md` — shared schemas (Domain/Skill/Item/LearningExercise, events, commands)
- `SPEC-STORAGE.md` — persistence (StoragePort, atomic commit, erase, IndexedDB/memory)
- `SPEC-CONTENT.md` — content packages (SemVer, validate/diff/migrate, rollback)
- `SPEC-CLI.md` — CLI adapter

**Editorial / ops (MVP2)**
- `SPEC-ADMIN.md` · `SPEC-ANALYTICS.md` · `SPEC-IMPROVEMENT.md` · `SPEC-REVIEW-PUBLISHING.md`
- `CONTRACTS-ANALYTICS.md` · `CONTRACTS-EDITORIAL.md`

**Decisions**
- `ADR-001-boundaries.md` (module DAG) · `ADR-002-rgpd-analytics.md` (RGPD) · `ADR-003-content-versioning.md`
- `OPEN-QUESTIONS.md` (5 core, non-blocking)
- `LEGACY-SPEC-0.3.1.md` — archived, **non-normative**

**Matou Finance module (MVP-F)**
- `SPEC-FINANCE-EDUCATION.md` — product vision, legal limits (no personalized advice), MVP-F scope
- `SPEC-THEMES-LEVELS.md` — FinancePack, themes (budget/revenu/impots/investissement), levels (5 items, pass 4/5), France pack v1
- `SPEC-PROFILE.md` — banded profile attributes, consents, `undisclosed`, export/erase
- `SPEC-TROPHIES-OFFERS.md` — trophies (one per theme) + sponsored offers
- `SPEC-FINANCE-ANALYTICS.md` · `SPEC-FINANCE-IMPROVEMENT.md`
- `OPEN-QUESTIONS-FINANCE.md` — 5 contract-blocking questions (with default answers)
- `TASKS-MVP-FINANCE.md` — atomic MVP-F task list (F0-1 … F5-5)

## Where they *do* align
- Same 4 finance domains/themes: Revenus/Budget/Impôts/Investir.
- "Ask before explain": Track A's moteur ≈ Track B's deterministic onboarding + theme-discovery (pack-defined, non-scored).
- "4 summits to climb with levels" maps conceptually onto Track B's themes→levels→trophies (Track B is headless — the Chaîne map/UI is a host-adapter concern, neither specified nor forbidden here).
