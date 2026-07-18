# OPEN-QUESTIONS-FINANCE — Ambiguïtés bloquant un contrat (module finance)

Seules figurent ici les questions qui bloquent réellement un contrat. Chaque entrée porte une **recommandation par défaut** appliquée provisoirement par les specs (les contrats restent donc implémentables sans attendre) et l'impact d'un choix différent. Aucune décision déjà prise par le produit n'est reformulée en question. Les questions non bloquantes du core restent dans [OPEN-QUESTIONS.md](OPEN-QUESTIONS.md).

## Q-F1 — Frontière exacte entre LearnerId opaque et compte hôte

**Question** : le mandat impose un `LearnerId` opaque sans OAuth/OIDC ; mais l'export/effacement RGPD suppose qu'un humain puisse prouver qu'il est le titulaire d'un `LearnerId`. Qui porte cette preuve ?
**Défaut appliqué** : l'hôte authentifie par le moyen de son choix et résout le `LearnerId` ; les endpoints `/me/*` opèrent sur le contexte courant uniquement. Aucun endpoint « rechercher un apprenant » n'existe.
**Impact si autre choix** : un guichet RGPD opéré par un tiers (support) exigerait des endpoints admin `rights.*` avec capabilities dédiées — ajout MINOR à `openapi.yml`, aucun changement des specs finance.

## Q-F2 — Base légale RGPD des attributs sensibles du profil

**Question** : `income-bracket`, `household`, `risk-tolerance` sont « sensibles » au sens produit ; leur qualification juridique (art. 6 vs art. 9 RGPD, AIPD nécessaire ?) détermine la formulation exacte des écrans de consentement et la `policyVersion` initiale.
**Défaut appliqué** : consentement explicite (art. 6-1-a) pour tous les scopes, tranches uniquement, aucun traitement art. 9 supposé ; une AIPD est recommandée avant lancement mais n'est pas un prérequis des contrats.
**Impact si autre choix** : si un conseil juridique qualifie un attribut en art. 9 ou impose l'AIPD bloquante, seuls les textes de politique (`policyVersion`) et éventuellement le retrait d'un attribut du catalogue changent — le mécanisme (catalogue par pack, consentements par scope) absorbe ce changement sans bump de contrat.

## Q-F3 — Statut réglementaire des offres partenaires (France)

**Question** : selon les partenaires (banques, assurances, courtiers), la présentation d'offres peut relever de l'intermédiation (IOBSP/IAS) ou de la simple publicité. Cela conditionne les mentions obligatoires au-delà de `sponsoredLabel` et potentiellement l'interdiction de certains partenaires.
**Défaut appliqué** : MVP limité à des offres de type publicité simple avec lien sortant sans transmission de données ni pré-remplissage ; toute mention obligatoire supplémentaire est un champ de contenu de l'offre (LocalizedText), extensible sans bump.
**Impact si autre choix** : un statut d'intermédiaire exigerait immatriculation ORIAS et un contrat offres v2 (champs réglementaires, parcours de souscription) — hors périmètre MVP, à trancher avant de signer un partenaire du secteur financier régulé.

## Q-F4 — Portée de l'atomicité effacement multi-stores

**Question** : `POST /me/erase` couvre quatre stores (core, profil, tracking offres, outbox analytics). SPEC-STORAGE garantit l'atomicité du core seul ; l'atomicité **inter-stores** dépend du stockage concret (Q2 du core, non tranchée).
**Défaut appliqué** : chaque store est purgé atomiquement dans son propre domaine, orchestré par une saga idempotente pilotée par la tombstone core ; l'état intermédiaire n'est jamais observable via l'API (tout endpoint apprenant répond `TombstonedError` dès la tombstone core posée).
**Impact si autre choix** : un stockage transactionnel unique (SQLite recommandé, Q2 core) permettrait une transaction unique et simplifierait F4-7 ; le contrat API ne change pas.

## Q-F5 — Événements de tentative pour les rollups de niveau

**Question** : `LevelAggregate.passRate` requiert des données de tentative agrégées cross-apprenants. Le contrat analytics v2 ne définit que des observations au grain item ; le grain « tentative de niveau » n'existe pas dans CONTRACTS-ANALYTICS.
**Défaut appliqué** : les rollups de niveau sont calculés côté opérateur à partir des `LevelAttempt` stockés par le module finance (sous consentement `analytics-aggregates`, mêmes fenêtres, même `K_MIN`, jamais exportés individuellement) — sans étendre le contrat analytics core.
**Impact si autre choix** : introduire une observation `attempt.completed` dans le contrat analytics exigerait un bump `analyticsContractVersion=3` et une révision d'ADR-002 ; à ne faire que si l'on veut mutualiser l'infrastructure d'ingestion/outbox pour ces données.
