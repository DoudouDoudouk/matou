# SPEC-FINANCE-ANALYTICS — Analytics d'apprentissage finance (module finance)

**Version document :** `1.0.0` · **Statut :** normatif (module finance, MVP-F)

Ce document spécialise l'usage d'analytics pour le produit finance. L'infrastructure normative (consentement, observations, fenêtres 28 jours, `K_MIN=10`, outbox, rétention, erreurs) est **entièrement** celle de [CONTRACTS-ANALYTICS.md](CONTRACTS-ANALYTICS.md), [SPEC-ANALYTICS.md](SPEC-ANALYTICS.md) et [ADR-002](ADR-002-rgpd-analytics.md) ; rien n'y est redéfini ici. Les analytics cross-apprenants sont autorisées, sous consentement `analytics-aggregates`, en agrégats k-anonymes uniquement.

## 1. Ce qui entre — et ce qui n'entre jamais

Entrées : les observations du contrat analytics (outcome, `choiceCounts`, bucket de latence, item/skill/fenêtre), enrichies de dimensions de contenu **non personnelles** dérivées du pack : `themeId`, `levelId`, `packId`, `packVersion` (mappage `itemId → niveau/thème` calculé côté agrégation depuis le pack publié ; aucune nouvelle donnée individuelle n'est collectée).

N'entrent jamais : données financières brutes ou attributs de profil individuels, `learnerId`, réponses brutes, `chosenIndex` individuel, latence individuelle comme critère de quoi que ce soit. La latence n'est **jamais** utilisée pour noter ou faire progresser ; seuls les buckets agrégés (`LatencyBucket`) du contrat sont admissibles, sous consentement.

## 2. Métrique principale : qualité des réponses élicitées

La qualité d'élicitation mesure si une question produit un signal d'apprentissage informatif. Formules : celles de [SPEC-IMPROVEMENT.md](SPEC-IMPROVEMENT.md) §1 (`successRate`, `skipRate`, `slowShare`, entropie des distracteurs, `discrimination`, `qualityScore` avec `formulaId` versionné), appliquées aux agrégats admissibles. Interprétation produit :

- `qualityScore` proche de 1 : question au bon niveau (~80 % de réussite cible), distracteurs plausibles, rythme sain ;
- signaux de faiblesse (consommés par SPEC-FINANCE-IMPROVEMENT) : réussite ≈ 1.0 (trop facile), ≈ hasard (ambiguë/trop dure), distracteur jamais choisi (entropie basse), `skipRate` élevé, `slowShare` élevé.

## 3. Rollups par thème, niveau et version

Agrégats dérivés (mêmes fenêtres, mêmes règles d'admissibilité, `learnerCount>=K_MIN` par cellule) :

```ts
interface LevelAggregate { packId:string; packVersion:string; themeId:string; levelId:string; windowId:string; learnerCount:number; attemptCount:number; passCount:number; passRate:number|null; medianAttemptsToPass:number|null; qualityScoreMean:number|null; aggregateRevision:number; complete:true; }
interface ThemeAggregate { packId:string; packVersion:string; themeId:string; windowId:string; learnerCount:number; discoveryCompletionRate:number|null; trophyCount:number; levelAggregates:string[]; aggregateRevision:number; complete:true; }
```

- `passRate` et `medianAttemptsToPass` sont calculés sur les tentatives de niveau (événements de progression agrégés, sans identifiant).
- La comparaison **entre `packVersion`** est le mécanisme d'évaluation d'une correction de contenu : même métrique, même fenêtre, versions différentes. Jamais de comparaison entre apprenants individuels.
- Croisements de profil : uniquement en cellules agrégées sur attributs figurant sur une liste d'autorisation par version (`analyticsDimensionsAllowed` du pack ; MVP : `learning-goal` uniquement, aucun attribut `sensitive`), sous `K_MIN` et règles anti-différenciation du contrat.

## 4. Métriques produit MVP

| Métrique | Grain | Source |
|---|---|---|
| taux de réussite / skip par item | item × fenêtre | `ItemAggregate` |
| qualité d'élicitation (`qualityScore`) | item × fenêtre | formules SPEC-IMPROVEMENT |
| taux de validation, tentatives médianes | niveau × fenêtre | `LevelAggregate` |
| complétion découverte, trophées décernés | thème × fenêtre | `ThemeAggregate` |
| complétion onboarding | pack × fenêtre | événements produit agrégés |
| impressions/clics d'offres | offre | SPEC-TROPHIES-OFFERS §5 (comptes, K_MIN) |

## 5. Biais et limites (informatif mais obligatoire à documenter avec chaque rapport)

- **Biais de consentement** : les agrégats ne couvrent que les apprenants consentants ; les taux ne sont pas représentatifs de toute la base.
- **Biais de survie** : les apprenants en difficulté abandonnent davantage ; `passRate` des niveaux tardifs est surestimé.
- **Effet de version** : comparer deux `packVersion` sur des fenêtres différentes confond contenu et saisonnalité ; privilégier des fenêtres communes.
- **Petites cellules** : sous `K_MIN`, absence de donnée ≠ absence de problème (cf. `stale-skill`, SPEC-IMPROVEMENT §2).
- Aucune inférence individuelle n'est jamais tirée d'un agrégat ; aucun agrégat ne redescend dans la personnalisation individuelle au runtime.
