# SPEC-IMPROVEMENT — Détecteurs et propositions MVP2

**Version document :** `2.0.0` · **improvementContractVersion :** `2` · **Statut :** normatif

`improvement` dépend uniquement de `schemas`, `content`, `CONTRACTS-ANALYTICS.md` et `CONTRACTS-EDITORIAL.md`. Il ne dépend ni d'analytics-runtime, ni de review/admin, ni du core/storage. Il lit uniquement des agrégats admissibles et écrit des `ChangeProposal` au statut maximal `proposed`. Aucune publication autonome.

## 1. Métriques calculables

Pour un agrégat complet, `successRate(a)=a.correct/a.attempts` si `a.attempts>0`, sinon `null`; `gte60s = latencyDistribution.gte60s` ; si la distribution de latence est absente, `latencyObserved` et `slowShare` valent `null`. Pour un QCM, les positions de `choiceDistribution` suivent l'ordre des options du `ContentPackage` validé et `correctIndex` vient de cet item.

```text
successRate = successRate(a) = correct/attempts si attempts>0, sinon null
skipRate = skipped/(attempts+skipped) si dénominateur>0, sinon null
latencyObserved = Σ latencyDistribution[bucket] lorsque latencyDistribution est non-null
slowShare = gte60s/latencyObserved si latencyObserved>0, sinon null
discrimination = successRate(item)-successRate(control) si les deux non-null et contrôle même fenêtre/version, sinon null
```

Entropie QCM : retirer l'option correcte, sommer les comptes restants, retourner `null` si total nul ou moins de deux distracteurs ; sinon `H=-Σp ln(p)`, `normalizedEntropy=H/ln(numberOfWrongOptions)`, convention `0 ln 0 = 0`. Toute somme incohérente ou index hors bornes est rejetée.

```text
targetFit = clamp01(1-abs(successRate-.80)/.80)
distractorFit = entropy si non-null, sinon absent
paceFit = 1-slowShare si non-null, sinon absent
qualityScore = clamp01(Σ poids_effectifs*composante / Σ poids_effectifs)
```

Poids `[.45,.20,.25,.10]`, renormalisés ; si aucune composante, `qualityScore=null`. Les métriques nulles ne deviennent jamais zéro implicitement. Toutes les sorties portent `formulaId` et version.

## 2. Détecteurs versionnés

Chaque contrat contient `{detector,detectorVersion,inputSchemaVersion,outputSchemaVersion,formulaId,thresholds}`. Les détecteurs travaillent sur fenêtres complètes et `learnerCount>=K_MIN`, avec seuils inclusifs explicitement testés. `stale-skill` signifie : skill actif du package sans agrégat admissible dans une fenêtre complète ; absence de données n'est pas interprétée comme succès.

Les résultats sont triés `(detector,targetId,windowId)`, sans données personnelles. Un `Finding` contient au plus des digests d'évidence et codes de message ; pas de payload d'observation.

## 3. Impact et proposition

Le module produit `ImpactAssessment` catégoriel (`none`, `presentation-only`, `compatible-additive`, `requires-new-session`, `requires-state-migration`, `withdrawal-safety-critical`, `unknown`). Il ne promet pas de compter les sessions : un port review/admin séparé peut fournir des bornes avec capability dédiée. Une proposition contient la référence exacte du source, diff/digest, versions des détecteurs, digest des évidences, impact, provenance et justification selon [CONTRACTS-EDITORIAL.md](CONTRACTS-EDITORIAL.md).

Les transformations MVP2 sans LLM sont limitées à des changements mécaniques sûrs et avis `advisory`. Toute proposition est dédupliquée par `proposalDigest`; elle ne publie jamais.

## 4. Rollback et LLM

Un rollback est une nouvelle `ChangeProposal kind='rollback'`, revue puis publication admin. Les findings fondés sur des agrégats invalidés deviennent `superseded`. Un adaptateur LLM post-MVP reçoit uniquement packages et findings agrégés, retourne des brouillons non publiables, et chaque sortie passe `validatePackage` puis provenance et digest.

## 5. Tests

Tester cas nuls/dénominateurs, seuils exacts, entropie uniforme/dégénérée, contrôle absent, fenêtre incomplète, stale-skill, déterminisme double exécution, digest de proposition, déduplication, invalidation après effacement et interdiction de publication.
