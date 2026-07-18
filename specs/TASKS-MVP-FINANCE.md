# TASKS-MVP-FINANCE — Découpage en tâches atomiques (module finance)

Découpage destiné à une implémentation par un LLM peu puissant (Mistral Vibe) : chaque tâche est petite, autonome, testable et n'exige aucune décision. Toute décision se trouve dans les specs référencées ; si une tâche semble en exiger une nouvelle, arrêter et ajouter la question à [OPEN-QUESTIONS-FINANCE.md](OPEN-QUESTIONS-FINANCE.md).

Conventions :
- Langage/stack : celui choisi par l'implémenteur du core Elicit (les contrats sont indépendants du langage ; TypeScript est présumé par les specs core).
- Chaque tâche = une PR ; les tests d'acceptation sont écrits dans la même tâche.
- « Spec » = section normative à relire avant de coder ; « Non-objectifs » = ce que la tâche ne doit surtout pas faire.
- Ordre strict : une tâche ne démarre que si ses dépendances sont mergées.

---

## MVP-F0 — Core assemblé (fondations)

Le core Elicit (SPEC.md, SPEC-SCHEMAS, SPEC-STORAGE, SPEC-CONTENT, SPEC-CLI) est supposé implémenté ou implémenté ici en suivant ses propres vecteurs. Ces tâches assemblent la fondation du module finance.

### F0-1 — Squelette du module finance
- **Objectif** : créer le package `@matou/finance` vide avec dépendances autorisées uniquement (`schemas`, `content` ; jamais core-runtime pour les types de contrat).
- **Fichiers** : `packages/finance/package.json`, `packages/finance/src/index.ts`, config lint/test.
- **Entrée** : DAG d'ADR-001.
- **Sortie** : package qui compile, exporte `financeContractVersion = 1`.
- **Acceptation** : build vert ; test d'import qui vérifie l'absence de dépendance vers core-runtime/analytics-runtime.
- **Tests** : test de lint de dépendances (échec CI si import interdit).
- **Dépendances** : core disponible.
- **Non-objectifs** : aucun type métier, aucune logique.

### F0-2 — Types du manifeste FinancePack
- **Objectif** : déclarer les types fermés `FinancePack`, `Theme`, `Level`, `DiscoveryQuestion`, `AudienceRule`, `ProfileAttributeDef` (SPEC-THEMES-LEVELS §2), sans validation.
- **Fichiers** : `packages/finance/src/pack/types.ts`.
- **Entrée** : SPEC-THEMES-LEVELS §2.
- **Sortie** : types exportés, doc-comments pointant les sections de spec.
- **Acceptation** : compile ; un objet exemple (extrait §7 de la spec) type-check.
- **Tests** : test de compilation avec l'exemple normatif §7.
- **Dépendances** : F0-1.
- **Non-objectifs** : pas de validation, pas de digest.

### F0-3 — Digest du manifeste
- **Objectif** : `computeManifestDigest(pack)` = SHA-256(JCS(manifeste sans `manifestDigest`)), en réutilisant la fonction JCS/digest du core (SPEC-SCHEMAS §4).
- **Fichiers** : `packages/finance/src/pack/digest.ts` + tests.
- **Entrée** : manifeste exemple.
- **Sortie** : hex minuscule 64 caractères, stable.
- **Acceptation** : double exécution identique ; modification d'un champ change le digest ; vecteur figé en fixture.
- **Tests** : 3 vecteurs (nominal, clé absente ≠ null, ordre de clés indifférent).
- **Dépendances** : F0-2.
- **Non-objectifs** : pas de validation.

### F0-4 — validateFinancePack (structure)
- **Objectif** : implémenter les invariants 1, 2, 4, 5, 6, 7, 8, 9 de SPEC-THEMES-LEVELS §3 (tout sauf la borne d'audience 3).
- **Fichiers** : `packages/finance/src/pack/validate.ts` + tests.
- **Entrée** : `FinancePack` + `Domain` core validé.
- **Sortie** : `{valid:true}` ou `{valid:false, errors:string[]}` (codes stables, pas de messages libres).
- **Acceptation** : un fixture valide passe ; un fixture par invariant échoue avec le bon code.
- **Tests** : 8 fixtures d'échec + 1 succès.
- **Dépendances** : F0-3.
- **Non-objectifs** : invariant 3 (bornes d'audience) reporté à F0-5.

### F0-5 — validateFinancePack (bornes 3–10 par audience)
- **Objectif** : invariant 3 : pour chaque thème, vérifier que tout sous-ensemble atteignable par les combinaisons d'`audience` déclarées reste dans [3,10], y compris le profil entièrement `undisclosed`.
- **Fichiers** : `packages/finance/src/pack/validate.ts` (extension) + tests.
- **Entrée** : thème avec règles d'audience.
- **Sortie** : erreur `LevelBoundsError` si violation.
- **Acceptation** : thème avec 2 niveaux `audience:null` rejeté ; 3 acceptés ; 11 possibles rejetés.
- **Tests** : cas bornes exactes 3 et 10, profil vide.
- **Dépendances** : F0-4.
- **Non-objectifs** : pas d'optimisation combinatoire au-delà des attributs référencés par le thème.

### F0-6 — Fixture pack France v1 (squelette)
- **Objectif** : créer le fixture `finance-fr` v1 minimal mais complet : 4 thèmes, 3 niveaux × 5 questions par thème (prompts placeholder), onboarding 5 questions, découvertes, disclaimers, catalogue de profil de SPEC-PROFILE §2, plus le `ContentPackage` core correspondant.
- **Fichiers** : `fixtures/finance-fr/v1/pack.json`, `fixtures/finance-fr/v1/content-package.json`.
- **Entrée** : SPEC-THEMES-LEVELS §5, SPEC-PROFILE §2.
- **Sortie** : fixtures qui passent `validatePackage` + `validateFinancePack`.
- **Acceptation** : validation verte ; prérequis `impots→revenu`, `investissement→budget` ; niveau « 50-30-20 » présent dans `revenu` ; disclaimers `impots`/`investissement` présents.
- **Tests** : test d'intégration de validation des deux fichiers.
- **Dépendances** : F0-5.
- **Non-objectifs** : contenu pédagogique réel définitif (placeholders marqués `TODO-CONTENT` acceptés) ; aucune règle fiscale chiffrée.

---

## MVP-F1 — Onboarding et profil

### F1-1 — Types LearnerProfile
- **Objectif** : types fermés `LearnerProfile`, `ProfileAttribute`, `ProfileConsentState`, `ConsentEntry` (SPEC-PROFILE §2).
- **Fichiers** : `packages/finance/src/profile/types.ts`.
- **Acceptation** : compile ; profil entièrement `undisclosed` représentable.
- **Tests** : compilation + fixture.
- **Dépendances** : F0-2.
- **Non-objectifs** : stockage, API.

### F1-2 — Validation d'attribut contre le catalogue
- **Objectif** : `validateAttributeWrite(catalog, attributeId, value)` : rejet hors catalogue (`UnknownAttributeError`), rejet de valeur hors codes, `undisclosed` toujours accepté.
- **Fichiers** : `packages/finance/src/profile/validate.ts` + tests.
- **Acceptation** : les 3 cas ci-dessus + succès nominal.
- **Dépendances** : F1-1, F0-6 (catalogue fixture).
- **Non-objectifs** : persistance.

### F1-3 — Store profil (port + mémoire)
- **Objectif** : port `ProfileStorePort { load, save, clear }` avec CAS de révision (même style que SPEC-STORAGE §1) et adaptateur mémoire.
- **Fichiers** : `packages/finance/src/profile/store.ts`, `store-memory.ts` + tests.
- **Acceptation** : save/load fidèle ; CAS refuse une révision périmée ; `clear` idempotent (attributs → `undisclosed`, consentements profil → `revoked`).
- **Dépendances** : F1-1.
- **Non-objectifs** : adaptateur SQL/IndexedDB (tâche post-MVP).

### F1-4 — Registre de consentements finance
- **Objectif** : appliquer le registre de consentement (grant/revoke idempotents par commandId+digest, historique, policyVersion) aux 4 scopes finance (`profile-personalization`, `analytics-aggregates` (délégué au registre CONTRACTS-ANALYTICS), `offers-optin`, `offers-profile`).
- **Fichiers** : `packages/finance/src/consents/registry.ts` + tests.
- **Entrée** : CONTRACTS-ANALYTICS « Consentement versionné », SPEC-PROFILE §4.
- **Acceptation** : idempotence ; révocation immédiate ; aucun scope n'en implique un autre ; historique append-only.
- **Dépendances** : F1-3.
- **Non-objectifs** : UI, outbox (déjà spécifiée côté analytics).

### F1-5 — Machine d'onboarding
- **Objectif** : `applyOnboardingAnswer(profile, pack, {questionId, code|null})` pure : écrit l'attribut ciblé (provenance `onboarding`), saut = `undisclosed`, calcule `onboardingCompleted` quand toutes les questions sont répondues/sautées ; idempotent par question.
- **Fichiers** : `packages/finance/src/onboarding/machine.ts` + tests.
- **Entrée** : SPEC-FINANCE-EDUCATION §4.
- **Acceptation** : déterminisme ; re-réponse remplace ; complétion exacte ; aucune notation.
- **Tests** : parcours complet fixture, parcours tout-sauté, double exécution identique.
- **Dépendances** : F1-2, F0-6.
- **Non-objectifs** : HTTP, persistance directe.

### F1-6 — Endpoints onboarding + profil + consentements
- **Objectif** : implémenter `GET/POST /onboarding*`, `GET/PATCH/DELETE /profile`, `GET /consents`, `PUT /consents/{scope}` conformes à `openapi.yml` (erreurs `ApiError`, `Idempotency-Key` obligatoire sur mutations).
- **Fichiers** : `apps/api/src/routes/onboarding.ts`, `profile.ts`, `consents.ts` + tests d'API.
- **Acceptation** : contrat validé contre `openapi.yml` (validation de schéma automatisée) ; 409 sur clé réutilisée avec corps différent ; aucun montant exact accepté.
- **Dépendances** : F1-4, F1-5 ; squelette serveur (F2-0).
- **Non-objectifs** : authentification concrète (contexte apprenant injecté par middleware hôte).

---

## MVP-F2 — Thèmes et niveaux

### F2-0 — Squelette serveur API
- **Objectif** : serveur HTTP minimal : middleware contexte `LearnerId` opaque (header abstrait), enveloppe d'erreur `ApiError`, middleware `Idempotency-Key` (store idempotence mémoire), validation de schéma contre `openapi.yml`.
- **Fichiers** : `apps/api/src/server.ts`, `middleware/*.ts` + tests.
- **Acceptation** : 400 structuré sur corps invalide ; idempotence rejouable ; healthcheck.
- **Dépendances** : F0-1.
- **Non-objectifs** : aucun endpoint métier, aucun fournisseur d'auth.

### F2-1 — selectLevels (personnalisation)
- **Objectif** : `selectLevels(theme, profile, personalizationVersion:'pers-1')` pure : niveaux `audience:null` ou satisfaits ; `undisclosed` ne satisfait que `null` ; ordre du pack conservé ; sortie dans [3,10].
- **Fichiers** : `packages/finance/src/progression/select-levels.ts` + tests.
- **Entrée** : SPEC-THEMES-LEVELS §4.
- **Acceptation** : profil vide/partiel/complet ; déterminisme double exécution.
- **Dépendances** : F1-1, F0-6.
- **Non-objectifs** : épinglage (F2-2).

### F2-2 — Progression et épinglage
- **Objectif** : types + store `LearnerProgression` (SPEC-THEMES-LEVELS §6) : `pinnedLevels` figé à la première entrée dans un thème ; statuts `locked/available/passed` ; prérequis de thème ; `discoveryCompleted` prérequis dur du niveau 1.
- **Fichiers** : `packages/finance/src/progression/state.ts`, `store.ts` + tests.
- **Acceptation** : épinglage stable malgré changement de profil ; niveau N+1 locked tant que N non passed ; `DiscoveryRequiredError` et `PrerequisiteError` levées aux bons endroits.
- **Dépendances** : F2-1.
- **Non-objectifs** : tentatives (F3), trophées.

### F2-3 — Machine de découverte de thème
- **Objectif** : même mécanique que F1-5 pour `discoverySet` d'un thème ; à complétion, marque `discoveries[themeId]` dans le profil et `discoveryCompleted` dans la progression, provenance `theme-discovery:<themeId>`.
- **Fichiers** : `packages/finance/src/discovery/machine.ts` + tests.
- **Acceptation** : jamais re-présentée sur la même version de pack ; sauts = `undisclosed` ; idempotence.
- **Dépendances** : F1-5, F2-2.
- **Non-objectifs** : HTTP.

### F2-4 — Endpoints thèmes/niveaux/découverte
- **Objectif** : `GET /themes`, `GET /themes/{id}`, `GET/POST /themes/{id}/discovery*`, `GET /themes/{id}/levels` conformes à `openapi.yml` ; disclaimers rendus pour `impots`/`investissement`.
- **Fichiers** : `apps/api/src/routes/themes.ts` + tests d'API.
- **Acceptation** : validation contre `openapi.yml` ; statuts corrects pour un apprenant neuf, en cours, complet ; aucun `correctIndex` dans aucune réponse.
- **Dépendances** : F2-0, F2-2, F2-3.
- **Non-objectifs** : sessions.

---

## MVP-F3 — Sessions, progression, trophées

### F3-1 — Démarrage de tentative de niveau
- **Objectif** : `startLevelAttempt(learner, level)` : crée une session core `session.start` dont le plan contient exactement les 5 `itemIds` du niveau, ordre mélangé par le RNG seedé core ; crée `LevelAttempt` `in-progress` lié au `sessionId`.
- **Fichiers** : `packages/finance/src/attempts/start.ts` + tests.
- **Entrée** : SPEC-THEMES-LEVELS §6, SPEC.md §4-5.
- **Acceptation** : une seule session active ; niveau `locked` refusé ; découverte manquante refusée ; déterminisme du plan à seed fixé.
- **Dépendances** : F2-2 ; core runtime.
- **Non-objectifs** : notation (core), révision (F3-4).

### F3-2 — Réponse, saut, abandon, complétion
- **Objectif** : relayer `item.answer`/`item.skip`/`session.abandon` vers le core ; à la complétion, calculer `outcome` : `passed` ⇔ ≥ 4 `correct` ; `skipped` compte non correct ; `abandoned` ne compte pas comme échec ; mettre à jour `levelStatus` (un `passed` ne se dévalide jamais).
- **Fichiers** : `packages/finance/src/attempts/progress.ts` + tests.
- **Acceptation** : tables de vérité 5/5, 4/5, 3/5, 4 correct + 1 skip (passed), 3 correct + 2 skips (failed) ; rejouabilité immédiate après échec ; latence absente de tout calcul ; feedback retourné après notation seulement.
- **Dépendances** : F3-1.
- **Non-objectifs** : trophées (F3-3).

### F3-3 — Attribution des trophées
- **Objectif** : `evaluateTrophies(progression, pack)` pure + persistance idempotente : trophée quand tous les `pinnedLevels(themeId)` sont `passed` ; jamais retiré ; `themeStatus='completed'`.
- **Fichiers** : `packages/finance/src/trophies/award.ts` + tests.
- **Entrée** : SPEC-TROPHIES-OFFERS §1.
- **Acceptation** : idempotence (double évaluation = 1 award) ; datation ; déclenché par la complétion du dernier niveau.
- **Dépendances** : F3-2.
- **Non-objectifs** : offres.

### F3-4 — Sessions de révision
- **Objectif** : `POST /sessions/review` : session core standard (items dus, sélecteur core) marquée `kind='review'`, sans aucun effet sur `levelStatus` ni trophées.
- **Fichiers** : `packages/finance/src/attempts/review.ts` + route + tests.
- **Acceptation** : une révision ne modifie jamais la progression de niveaux ; réutilise F3-2 pour répondre.
- **Dépendances** : F3-2.
- **Non-objectifs** : gamification de la révision.

### F3-5 — Endpoints sessions/progression/trophées
- **Objectif** : `POST /levels/{id}/attempts`, `GET /sessions/{id}`, `POST /sessions/{id}/answers|skip|abandon`, `GET /progression`, `GET /trophies` conformes à `openapi.yml`.
- **Fichiers** : `apps/api/src/routes/sessions.ts`, `progression.ts` + tests d'API.
- **Acceptation** : validation contre `openapi.yml` ; `QuestionView` sans `correct`/`correctIndex` (test automatique de non-régression sur la sérialisation) ; reprise par `GET /sessions/{id}` ; idempotence des mutations.
- **Dépendances** : F2-0, F3-1..F3-4.
- **Non-objectifs** : offres, analytics.

---

## MVP-F4 — Offres et admin

### F4-1 — Types et validation des offres
- **Objectif** : types `PartnerOffer`, `OfferTargeting`, validation création/màj (SPEC-TROPHIES-OFFERS §2, §5) : https, `sponsoredLabel` non vide, trophées existants, attributs dans le catalogue, `usesSensitive` recalculé serveur, fenêtre temporelle.
- **Fichiers** : `packages/finance/src/offers/types.ts`, `validate.ts` + tests.
- **Acceptation** : un fixture d'échec par règle ; `usesSensitive` correct pour ciblage mixte.
- **Dépendances** : F0-6, F3-3 (trophyIds).
- **Non-objectifs** : éligibilité runtime.

### F4-2 — Éligibilité d'une offre
- **Objectif** : `isOfferEligible(offer, learner: {trophies, profile, consents}, now)` pure : active + fenêtre + trophée + `offers-optin` + ciblage (sensible ⇒ `offers-profile`, sinon inéligible) ; motif codé de refus, sans valeurs d'attributs.
- **Fichiers** : `packages/finance/src/offers/eligibility.ts` + tests.
- **Entrée** : SPEC-TROPHIES-OFFERS §3-4.
- **Acceptation** : chaque condition isolément fait échouer ; ciblage sensible sans `offers-profile` = inéligible (jamais de fallback) ; déterminisme.
- **Dépendances** : F4-1, F1-4.
- **Non-objectifs** : tracking.

### F4-3 — Tracking impressions/clics minimisé
- **Objectif** : stores `OfferImpression`/`OfferClick` : plafond 3 impressions/offre/apprenant côté serveur, rétention 13 mois (job de purge), purge à l'effacement apprenant, inclusion dans l'export.
- **Fichiers** : `packages/finance/src/offers/tracking.ts` + tests.
- **Acceptation** : plafond ; purge par date ; purge par effacement ; export exact ; aucune donnée sortante vers partenaire (`targetUrl` retourné sans paramètre ajouté — test).
- **Dépendances** : F4-2.
- **Non-objectifs** : stats admin (F4-5).

### F4-4 — Endpoints offres apprenant
- **Objectif** : `GET /offers`, `POST /offers/{id}/impressions`, `POST /offers/{id}/clicks` conformes à `openapi.yml` ; liste vide sans `offers-optin`.
- **Fichiers** : `apps/api/src/routes/offers.ts` + tests d'API.
- **Acceptation** : validation contre `openapi.yml` ; `sponsoredLabel` toujours présent ; révocation d'`offers-optin` masque immédiatement.
- **Dépendances** : F2-0, F4-3.
- **Non-objectifs** : admin.

### F4-5 — Admin offres (CRUD + stats)
- **Objectif** : `GET/POST /admin/offers`, `PATCH /admin/offers/{id}`, `GET /admin/offers/{id}/stats` : admin humain (capabilities `offers.*`), audit `AuditRecord` par mutation, stats en comptes avec masquage sous `K_MIN=10`.
- **Fichiers** : `apps/api/src/routes/admin-offers.ts` + tests.
- **Acceptation** : outil (actor kind `tool`) refusé ; audit émis ; stats masquées à 9, visibles à 10.
- **Dépendances** : F4-1, F2-0 ; contrats éditoriaux.
- **Non-objectifs** : budget partenaire, conversions.

### F4-6 — Admin packages et propositions
- **Objectif** : `GET /admin/packages`, `POST /admin/packages/{id}/publish`, `POST /admin/packages/{id}/rollback`, `GET /admin/proposals[/{id}]` en façade des ports SPEC-ADMIN/SPEC-REVIEW-PUBLISHING existants (aucune logique nouvelle, publication transactionnelle inchangée).
- **Fichiers** : `apps/api/src/routes/admin-packages.ts` + tests.
- **Acceptation** : validation contre `openapi.yml` ; publish refuse une proposition non `approved` ; rollback crée une proposition, ne publie pas ; pagination.
- **Dépendances** : F2-0 ; modules review/admin.
- **Non-objectifs** : UI d'admin.

### F4-7 — Export et effacement bout en bout
- **Objectif** : `POST /me/export` (agrège `LearnerExport` core + profil + progression + trophées + offerEvents + consentements) et `POST /me/erase` (core erase + profil + tracking + outbox analytics, atomicité par domaine, idempotent).
- **Fichiers** : `apps/api/src/routes/data-rights.ts` + tests.
- **Acceptation** : export conforme `LearnerFullExport` ; après erase, tout endpoint apprenant répond `TombstonedError` sauf retry ; double erase idempotent.
- **Dépendances** : F1-6, F3-5, F4-3.
- **Non-objectifs** : effacement forensique (non promis, cf. SPEC-STORAGE §3).

---

## MVP-F5 — Analytics minimale

### F5-1 — Mappage item → niveau/thème
- **Objectif** : `buildContentIndex(pack)` pure : `itemId → {levelId, themeId, packId, packVersion}` pour l'enrichissement d'agrégats.
- **Fichiers** : `packages/finance/src/analytics/content-index.ts` + tests.
- **Acceptation** : bijection sur le fixture ; item inconnu = erreur.
- **Dépendances** : F0-6.
- **Non-objectifs** : aucune donnée individuelle.

### F5-2 — LevelAggregate / ThemeAggregate
- **Objectif** : calculer les rollups de SPEC-FINANCE-ANALYTICS §3 à partir des `ItemAggregate` admissibles (CONTRACTS-ANALYTICS) + événements de tentative agrégés ; respecter `K_MIN` par cellule, fenêtres complètes, `aggregateRevision`.
- **Fichiers** : `packages/finance/src/analytics/rollups.ts` + tests.
- **Acceptation** : cellule à 9 apprenants supprimée ; `passRate`/`medianAttemptsToPass` corrects sur fixtures ; null si dénominateur nul ; déterminisme.
- **Dépendances** : F5-1 ; analytics-runtime (ingestion/agrégats item déjà spécifiés).
- **Non-objectifs** : nouveaux types d'observation individuelle ; attributs de profil.

### F5-3 — qualityScore par item (réutilisation)
- **Objectif** : brancher les formules de SPEC-IMPROVEMENT §1 (`successRate`, entropie, `qualityScore`, `formulaId`) sur les agrégats finance et exposer `qualityScoreMean` par niveau.
- **Fichiers** : `packages/finance/src/analytics/quality.ts` + tests.
- **Acceptation** : vecteurs de SPEC-IMPROVEMENT (cas nuls, entropie uniforme/dégénérée) rejoués ; moyenne pondérée par attempts.
- **Dépendances** : F5-2 ; module improvement (formules).
- **Non-objectifs** : détecteurs (F5-5).

### F5-4 — Endpoint admin analytics
- **Objectif** : `GET /admin/analytics/levels` conforme `openapi.yml` (fenêtre + packVersion requis, pagination, capability `analytics.query`).
- **Fichiers** : `apps/api/src/routes/admin-analytics.ts` + tests.
- **Acceptation** : validation contre `openapi.yml` ; `learnerCount>=10` sur toute ligne ; test automatique d'absence de champ individuel/financier dans la réponse.
- **Dépendances** : F2-0, F5-3.
- **Non-objectifs** : dashboards, exports CSV.

### F5-5 — Détecteurs finance + propositions
- **Objectif** : implémenter les 6 détecteurs de SPEC-FINANCE-IMPROVEMENT §1 (seuils versionnés dans le contrat de chaque détecteur) et la conversion en `ChangeProposal` `advisory` dédupliquées par `proposalDigest`, statut max `proposed`.
- **Fichiers** : `packages/finance/src/improvement/detectors.ts`, `propose.ts` + tests.
- **Acceptation** : seuils testés aux bornes inclusives ; fenêtre incomplète et cellule < K_MIN ignorées ; double exécution identique ; test d'interdiction : aucune API de publication accessible depuis ce module (lint de dépendances).
- **Dépendances** : F5-3 ; contrats éditoriaux.
- **Non-objectifs** : LLM, `content-change` automatique, publication.

---

## Post-MVP (non découpé, pour mémoire)
Brouillons LLM offline (SPEC-FINANCE-IMPROVEMENT §3), packs fiscaux annuels sourcés, adaptateurs de stockage durables profil/offres, croisements analytics par `learning-goal`, streaks/ligues, nouveaux pays.
