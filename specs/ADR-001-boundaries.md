# ADR-001 — Frontières et DAG contractuel

**Statut :** accepté · **Date :** 2026-07-18 · **Version :** 2

## Décision

```text
schemas
├── core-runtime
├── storage-runtime
├── content
└── editorial-contracts
      ├── analytics-contracts
      ├── content-review
      └── admin
content + analytics-contracts + editorial-contracts → improvement
adapter-cli assemble tous les runtimes
```

`schemas` n'a aucune dépendance. `core-runtime` dépend seulement de schemas et reste sans horloge/RNG global, réseau, analytics, LLM ou contenu éditorial. `content` dépend seulement de schemas et ne connaît aucun workflow. Les contrats partagés ne contiennent aucune implémentation ni stockage concret.

`improvement` dépend des contrats de données (`content`, `analytics-contracts`, `editorial-contracts`) mais jamais de `analytics-runtime`, `content-review`, `admin`, core ou storage. Review consomme les propositions ; admin publie. Aucun contrat n'importe un runtime. L'adaptateur CLI est le seul assembleur.

Toute violation transitive (cycle, runtime importé par contrat, improvement→review/runtime analytics, core→MVP2) échoue en CI. Toute nouvelle arête exige une nouvelle version de cet ADR.

## Conséquences

Les versions peuvent évoluer indépendamment : `schemas/core/storage/CLI=2`, `content=2`, `analytics=2`, `editorial/review/admin/improvement=2`. Les types publics partagés sont définis une seule fois dans `CONTRACTS-EDITORIAL.md` ou `CONTRACTS-ANALYTICS.md`, jamais copiés dans plusieurs workflows.
