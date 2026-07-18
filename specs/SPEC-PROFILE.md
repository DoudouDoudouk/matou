# SPEC-PROFILE — Profil apprenant finance (module finance)

**Version document :** `1.0.0` · **profileContractVersion :** `1` · **Statut :** normatif (module finance, MVP-F)

Le profil apprenant adapte l'apprentissage (sélection de niveaux, variantes, exemples). Il n'est **jamais** transformé en conseil financier ni utilisé pour cibler des offres sur des attributs sensibles sans consentement explicite ([SPEC-TROPHIES-OFFERS.md](SPEC-TROPHIES-OFFERS.md) §4). Les primitives JSON, la fermeture des schémas et les règles d'erreurs sont celles de [SPEC-SCHEMAS.md](SPEC-SCHEMAS.md).

## 1. Principes

1. **Minimisation** : uniquement des attributs utiles à la personnalisation pédagogique. Tout attribut sans consommateur documenté est refusé.
2. **Tranches, jamais de valeurs exactes** : aucun montant, revenu, patrimoine ou dette en valeur brute. Uniquement des tranches fermées ou des catégories.
3. **Consentement explicite et granulaire** : le profil financier est une donnée sensible au sens produit. Il existe deux consentements distincts : `profile-personalization` (utiliser le profil pour personnaliser) et `analytics-aggregates` (contribuer aux agrégats — géré par CONTRACTS-ANALYTICS). Un troisième, `offers-profile`, est défini dans SPEC-TROPHIES-OFFERS. Aucun consentement n'en implique un autre.
4. **`undisclosed` est une valeur de première classe** : tout attribut peut valoir `undisclosed` (question sautée ou consentement absent) et la personnalisation doit produire un résultat valide avec un profil entièrement `undisclosed`.
5. **Provenance et horodatage** : chaque attribut porte sa provenance et sa date de mise à jour.

## 2. Modèle fermé

```ts
interface LearnerProfile {
  profileContractVersion: 1;
  learnerId: string;                       // opaque, jamais dérivable d'une identité
  packId: string; packVersion: string;     // pack ayant défini les questions
  attributes: Record<string, ProfileAttribute>;
  consents: ProfileConsentState;
  onboardingCompleted: boolean;
  discoveries: Record<string, { completedAt: string; packVersion: string }>; // par themeId
  updatedAt: string;
  schemaVersion: 1;
}
interface ProfileAttribute {
  attributeId: string;                     // déclaré par le pack (catalogue fermé)
  value: string | 'undisclosed';           // code de tranche/catégorie fermé par le pack
  sensitivity: 'standard' | 'sensitive';
  provenance: 'onboarding' | `theme-discovery:${string}` | 'settings';
  answeredAt: string | null;
}
interface ProfileConsentState {
  'profile-personalization': ConsentEntry;
  'analytics-aggregates': ConsentEntry;    // miroir en lecture du registre CONTRACTS-ANALYTICS
  'offers-profile': ConsentEntry;
}
interface ConsentEntry { status:'granted'|'revoked'|'never'; policyVersion:string|null; at:string|null; }
```

Le **catalogue d'attributs** est déclaré par le pack (voir SPEC-THEMES-LEVELS §3, `profileCatalog`) : chaque `attributeId` y définit son libellé localisé, ses valeurs fermées (codes de tranches), sa sensibilité et sa finalité. Un attribut hors catalogue est rejeté (`ValidationError`).

### Attributs MVP (catalogue du pack France v1, indicatif mais borné)

| attributeId | valeurs (codes) | sensibilité |
|---|---|---|
| `household` | `single`,`couple`,`couple-children`,`single-parent`,`other`,`undisclosed` | sensitive |
| `income-bracket` | `b1`..`b5` (tranches définies par le pack),`undisclosed` | sensitive |
| `income-stability` | `stable`,`variable`,`undisclosed` | sensitive |
| `housing` | `tenant`,`owner`,`hosted`,`undisclosed` | standard |
| `risk-tolerance` | `low`,`medium`,`high`,`undisclosed` (déclarative, pédagogique) | sensitive |
| `learning-pace` | `short-daily`,`long-weekly`,`undisclosed` | standard |
| `learning-goal` | `budget`,`save`,`understand-taxes`,`invest-basics`,`undisclosed` | standard |
| `tracks-expenses` | `yes`,`partially`,`no`,`undisclosed` (découverte budget) | standard |

`risk-tolerance` mesure un confort déclaré à des fins pédagogiques (quels concepts approfondir) ; il ne constitue pas un profil investisseur réglementaire et n'est jamais présenté comme tel.

## 3. Règles d'utilisation

Autorisé :
- personnalisation pédagogique (sélection/ordre des niveaux, variantes `audience`) si `profile-personalization=granted` ; sinon parcours par défaut du pack ;
- statistiques agrégées k-anonymes si `analytics-aggregates=granted` (jamais d'attribut individuel exporté vers analytics ; seuls des croisements agrégés définis dans SPEC-FINANCE-ANALYTICS §4) ;
- éligibilité d'offres sur attributs **non sensibles uniquement**, et sur attributs sensibles uniquement si `offers-profile=granted` (SPEC-TROPHIES-OFFERS §4).

Interdit :
- toute inférence de conseil financier ou fiscal individuel ;
- tout attribut en clair dans les logs, erreurs, événements core ou observations analytics ;
- toute revente/transmission d'attribut à un partenaire (les partenaires ne reçoivent jamais d'attribut de profil, seulement des impressions/clics minimisés).

## 4. Consentements

- Chaque consentement est recueilli séparément, avec `policyVersion`, révocable à tout moment, et enregistré de façon idempotente (mêmes garanties de registre que `ConsentRecord` de [CONTRACTS-ANALYTICS.md](CONTRACTS-ANALYTICS.md), réutilisées par extension de scope : `profile-personalization-v1`, `offers-profile-v1`).
- Révocation de `profile-personalization` : la personnalisation cesse immédiatement ; les attributs restent stockés (l'apprenant peut aussi les effacer, §6) ; le parcours redevient le parcours par défaut, sans perte de progression.
- Le refus d'un consentement ne bloque jamais l'accès au contenu pédagogique.

## 5. Rétention et provenance

- Les attributs sont conservés tant que le compte existe ; aucune copie hors du store profil.
- `provenance` est immuable pour une valeur donnée ; une mise à jour via l'écran réglages remplace la valeur avec `provenance='settings'`.
- Le profil est épinglé à `(packId, packVersion)` pour l'interprétation des codes ; un changement de version de pack qui supprime ou renomme des valeurs exige une migration de catalogue explicite et versionnée (jamais silencieuse), analogue à `migratePackage` de [SPEC-CONTENT.md](SPEC-CONTENT.md).

## 6. Export et effacement

- **Export** : l'apprenant peut exporter son profil complet (attributs, consentements, provenances, horodatages) en JSON fermé `LearnerProfileExport { schemaVersion:1; profile:LearnerProfile; exportedAt:string }`, joint à l'export core (`LearnerExport` de SPEC-STORAGE).
- **Effacement** : l'effacement apprenant (`learner.erase` du core) purge aussi le profil atomiquement, dans la même sémantique de tombstone que [SPEC-STORAGE.md](SPEC-STORAGE.md) §3, et déclenche l'outbox analytics (révocation `learner-erased` de CONTRACTS-ANALYTICS). Un effacement partiel (profil seul, progression conservée) est offert : les attributs passent à `undisclosed` et les consentements profil à `revoked` ; opération idempotente.

## 7. Erreurs et tests

Erreurs : celles de SPEC-SCHEMAS §7 plus `ConsentRequiredError` (réutilisée de SPEC-ANALYTICS) et `UnknownAttributeError`. Tests obligatoires : profil entièrement `undisclosed` valide et personnalisable par défaut ; rejet d'attribut hors catalogue ; rejet de valeur hors codes ; idempotence des consentements ; effacement partiel puis total ; export sans donnée brute ; aucune valeur exacte acceptée nulle part.
