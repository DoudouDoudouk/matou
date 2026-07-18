# SPEC-FINANCE-IMPROVEMENT — Self-improvement du contenu finance (module finance)

**Version document :** `1.0.0` · **Statut :** normatif (module finance, MVP-F)

Ce document spécialise [SPEC-IMPROVEMENT.md](SPEC-IMPROVEMENT.md) pour le produit finance. Toutes ses règles s'appliquent inchangées : improvement lit uniquement des agrégats admissibles et des packs publiés, produit des `ChangeProposal` (statut maximal `proposed`, [CONTRACTS-EDITORIAL.md](CONTRACTS-EDITORIAL.md)), **ne publie jamais** ; la publication passe par revue humaine ([SPEC-REVIEW-PUBLISHING.md](SPEC-REVIEW-PUBLISHING.md)) puis un admin humain ([SPEC-ADMIN.md](SPEC-ADMIN.md)) avec rollback possible. Le self-improvement est prioritaire au sens produit : le pipeline doit exister dès le MVP-F, même minimal.

## 1. Détecteurs finance (versionnés, déterministes)

En plus des détecteurs génériques (SPEC-IMPROVEMENT §2), le module déclare des détecteurs au grain niveau/thème, opérant sur `LevelAggregate`/`ThemeAggregate` ([SPEC-FINANCE-ANALYTICS.md](SPEC-FINANCE-ANALYTICS.md) §3), fenêtres complètes, `learnerCount>=K_MIN`, seuils inclusifs versionnés :

| detector | signal | seuil MVP (dans le contrat du détecteur, ajustable par version) |
|---|---|---|
| `level-too-hard` | `passRate` bas ou `medianAttemptsToPass` élevé | passRate ≤ 0.40 ou médiane ≥ 4 |
| `level-too-easy` | `passRate` ≈ 1 et items `successRate` ≥ 0.98 | passRate ≥ 0.98 |
| `weak-question` | `qualityScore` bas, distracteur mort, skipRate haut | qualityScore ≤ 0.40 ou skipRate ≥ 0.30 |
| `ambiguous-question` | QCM avec `successRate` ≈ hasard et entropie haute | successRate ≤ 1/nbOptions + 0.10 |
| `discovery-dropoff` | `discoveryCompletionRate` bas | ≤ 0.60 |
| `stale-level` | niveau actif sans agrégat admissible (hérite de `stale-skill`) | — |

Sorties triées, sans données personnelles, `Finding` avec digests d'évidence uniquement ; double exécution identique.

## 2. Propositions

- Chaque finding pertinent est converti en `ChangeProposal` dédupliquée par `proposalDigest` : `advisory` (diagnostic, non publiable) par défaut ; `content-change` uniquement pour les transformations mécaniques sûres autorisées par SPEC-IMPROVEMENT §3 (ex. correction de métadonnées, reformulation candidate fournie par un humain ou un brouillon LLM offline).
- Une proposition portant sur un niveau/thème référence le pack finance exact (`PackageRef`), le diff, l'impact catégoriel, les findings sources et les fenêtres/versions d'agrégats.
- Personnalisation par apprenant : improvement peut proposer des changements de règles `audience` ou d'ordre de niveaux (contenu du manifeste), jamais une adaptation individuelle runtime — la personnalisation runtime reste la fonction versionnée de SPEC-THEMES-LEVELS §4.

## 3. Rôle des LLM (offline uniquement)

- LLM **externes d'abord, locaux ensuite** : choix d'exploitation, hors contrat (cf. OPEN-QUESTIONS Q5).
- Un adaptateur LLM reçoit uniquement : le pack publié, les findings/agrégats admissibles. Jamais de données apprenant, de profil ou d'observation individuelle.
- Sorties : brouillons de questions/niveaux non publiables, qui passent obligatoirement `validatePackage` + `validateFinancePack`, provenance `GeneratorInfo` renseignée, puis le workflow revue → validation/publication **par administrateur**.
- Rien de non déterministe n'entre dans le runtime : un pack publié est figé, versionné, rollbackable (ADR-003).

## 4. Boucle d'évaluation

Après publication d'une version corrigée, l'effet est mesuré en comparant les mêmes métriques entre `packVersion` sur fenêtres communes (SPEC-FINANCE-ANALYTICS §3). Si une version dégrade la métrique principale (qualité des réponses élicitées), un rollback est proposé via `requestRollback` (SPEC-ADMIN §4) — toujours revue + admin, jamais automatique.

## 5. Tests

Seuils exacts aux bornes ; fenêtre incomplète ignorée ; cellule < K_MIN ignorée ; déduplication ; findings `superseded` après invalidation d'agrégat (effacement) ; aucune publication ni transition au-delà de `proposed` ; brouillon LLM invalide rejeté par validation ; déterminisme double exécution.
