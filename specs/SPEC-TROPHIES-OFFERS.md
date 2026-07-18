# SPEC-TROPHIES-OFFERS — Trophées et offres partenaires (module finance)

**Version document :** `1.0.0` · **offersContractVersion :** `1` · **Statut :** normatif (module finance, MVP-F)

Les trophées récompensent la complétion d'un thème. Les offres partenaires sponsorisées sont la **seule** forme de recommandation autorisée du produit (SPEC-FINANCE-EDUCATION §2.4) : opt-in, configurées par un administrateur, présentées comme un privilège gagné, avec disclosure sponsorisée et sans incitation trompeuse.

## 1. Trophées

```ts
interface TrophyAward { trophyId:string; learnerId:string; themeId:string; packVersion:string; awardedAt:string; }
```

- Éligibilité : tous les niveaux de `pinnedLevels(themeId)` sont `passed` (SPEC-THEMES-LEVELS §6). Calcul pur et déterministe à partir de la progression.
- Attribution idempotente : au plus un `TrophyAward` par `(learnerId, trophyId)` ; réévaluer ne duplique jamais.
- Un trophée n'est jamais retiré (y compris après changement de version de pack).
- Un trophée ne débloque **aucun contenu pédagogique** : il est purement honorifique et sert de déclencheur d'éligibilité aux offres.

## 2. Offres partenaires — modèle

```ts
interface PartnerOffer {
  offersContractVersion: 1;
  offerId: string; partnerId: string;
  status: 'draft'|'active'|'paused'|'expired'|'withdrawn';
  title: LocalizedText; description: LocalizedText;
  sponsoredLabel: LocalizedText;          // disclosure, affichage obligatoire, non vide
  targetUrl: string;                       // https uniquement
  trophyIds: string[];                     // trophées déclencheurs (non vide)
  targeting: OfferTargeting | null;        // §4
  startsAt: string; expiresAt: string;     // expiresAt > startsAt
  createdBy: string; updatedAt: string;    // actorId admin
}
interface OfferTargeting {
  all: Array<{ attributeId: string; in: string[] }>;
  usesSensitive: boolean;                  // dérivé du profileCatalog, recalculé à la validation
}
interface OfferConsent { learnerId:string; scope:'offers-optin'|'offers-profile'; status:'granted'|'revoked'; policyVersion:string; at:string; }
interface OfferImpression { impressionId:string; offerId:string; learnerId:string; shownAt:string; context:'post-trophy'|'rewards-screen'; }
interface OfferClick { clickId:string; offerId:string; learnerId:string; clickedAt:string; }
```

## 3. Cycle de vie et présentation

- Consentement **`offers-optin`** distinct de tout autre : sans lui, aucune offre n'est jamais montrée, aucune impression enregistrée. Révocable à tout moment ; la révocation masque immédiatement les offres.
- Une offre n'est présentable à un apprenant que si : `status='active'`, `startsAt <= now < expiresAt`, l'apprenant détient un trophée de `trophyIds`, `offers-optin=granted`, et le ciblage (§4) est satisfait.
- Présentation : après l'écran de trophée puis dans un écran « récompenses » dédié. Formulation de **privilège gagné** (« Vous avez débloqué… ») autorisée ; sont interdits : urgence artificielle, dark patterns, opt-out préconfiguré, présentation comme conseil (« nous vous recommandons de souscrire »), et tout blocage de parcours pédagogique lié à une offre.
- `sponsoredLabel` (« Sponsorisé ») est affiché de manière visible sur chaque impression ; une offre sans label valide est rejetée à la configuration.
- Expiration : une offre expirée ou retirée disparaît immédiatement ; les impressions/clics historiques sont conservés (§6).

## 4. Ciblage

- Ciblage par attributs **non sensibles** du profil : autorisé dès `offers-optin`.
- Ciblage utilisant au moins un attribut `sensitive` (`usesSensitive=true`) : exige **en plus** `offers-profile=granted`. Sans ce consentement, l'offre est traitée comme non éligible pour cet apprenant (jamais de fallback ignorant la condition sensible).
- Aucune donnée de profil, de progression ou d'identité n'est transmise au partenaire — ni à l'impression, ni au clic. Le lien sortant ne contient aucun paramètre dérivé du profil ou du `learnerId`.
- Évaluation du ciblage côté opérateur uniquement, déterministe et journalisée sans valeurs d'attributs (seulement `offerId`, décision, motif codé).

## 5. Configuration admin

- CRUD des offres réservé à un **admin humain** (rôles et capabilities de [CONTRACTS-EDITORIAL.md](CONTRACTS-EDITORIAL.md) ; nouvelles actions fermées : `offers.create`, `offers.update`, `offers.pause`, `offers.withdraw`, `offers.stats.read`). Un outil ne peut pas activer une offre.
- Toute création/modification/retrait est auditée (`AuditRecord`), sans donnée apprenant.
- Validation à l'enregistrement : URL https, label sponsorisé non vide, trophées existants, attributs de ciblage dans le `profileCatalog`, `usesSensitive` recalculé serveur, fenêtre temporelle cohérente.
- Statistiques exposées à l'admin : impressions et clics **agrégés par offre** (comptes uniquement, seuil `K_MIN=10` réutilisé de CONTRACTS-ANALYTICS ; sous le seuil, « <10 »). Jamais de liste d'apprenants.

## 6. Tracking minimisé et RGPD

- Données collectées : `OfferImpression` et `OfferClick` uniquement (pas de durée, pas de scroll, pas de conversion partenaire au MVP).
- Finalité : plafonnement d'affichage (au plus 3 impressions d'une même offre par apprenant), statistiques agrégées admin, preuve de disclosure.
- Rétention : 13 mois maximum, puis purge. Effacement apprenant (`learner.erase`) : purge des impressions/clics individuels dans la même sémantique que SPEC-STORAGE §3 ; les compteurs agrégés déjà calculés restent (sans identifiant).
- Export : impressions et clics de l'apprenant inclus dans son export de données.
- Les consentements `offers-*` suivent le registre idempotent et versionné de [CONTRACTS-ANALYTICS.md](CONTRACTS-ANALYTICS.md) (scopes `offers-optin-v1`, `offers-profile-v1`).

## 7. MVP-F vs post-MVP

MVP-F : offres statiques configurées à la main, ciblage simple, stats de comptes. Post-MVP : plafonds de budget partenaire, A/B de présentation (jamais du contenu pédagogique), webhooks de conversion — chacun exigera une nouvelle version de ce contrat.

## 8. Tests

Idempotence du trophée ; éligibilité exacte (chaque condition prise isolément fait échouer) ; offre sensible sans `offers-profile` refusée ; aucune donnée sortante vers partenaire ; plafond d'impressions ; expiration/retrait immédiats ; purge à l'effacement ; stats sous `K_MIN` masquées ; rejet d'offre sans `sponsoredLabel`.
