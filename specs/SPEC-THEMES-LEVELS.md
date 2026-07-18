# SPEC-THEMES-LEVELS — Thèmes, niveaux et packs de contenu (module finance)

**Version document :** `1.0.0` · **financePackContractVersion :** `1` · **Statut :** normatif (module finance, MVP-F)

Ce document définit la couche de structuration pédagogique au-dessus du modèle `Domain/Skill/Item` du core. Il ne modifie ni [SPEC-SCHEMAS.md](SPEC-SCHEMAS.md) ni [SPEC-CONTENT.md](SPEC-CONTENT.md) : un pack finance **est** un `ContentPackage` core valide, augmenté d'un manifeste finance. Validation, diff, SemVer, revue et publication restent ceux de SPEC-CONTENT, SPEC-REVIEW-PUBLISHING et SPEC-ADMIN.

## 1. Correspondance avec le core

| Concept finance | Représentation core |
|---|---|
| Theme | `Skill` de tête (prérequis inter-thèmes via `prerequisites`) |
| Level | `Skill` enfant du thème ; validation par tentative (couche produit) |
| QuestionSet d'un niveau | exactement 5 `Item` (binary ou multiple-choice) rattachés au skill du niveau |
| Questions d'onboarding/découverte | items **hors Domain runtime** (non notés), portés par le manifeste |

Le mélange d'ordre de présentation, la reprise de session, la non-répétition et la répétition espacée sont ceux du core. La **validation de niveau** (4/5) est un calcul de la couche produit sur les grades d'une tentative ; elle ne modifie pas BKT ni le scheduler.

## 2. Modèle fermé

```ts
interface FinancePack {
  financePackContractVersion: 1;
  packId: string;                    // ex. 'finance-fr'
  country: string;                   // ISO 3166-1 alpha-2, ex. 'FR'
  locale: string;                    // ex. 'fr-FR'
  version: string;                   // SemVer, = version du ContentPackage porteur
  contentPackageRef: PackageRef;     // le ContentPackage core (SPEC-CONTENT)
  themes: Theme[];
  onboardingSet: DiscoveryQuestion[];      // §3
  profileCatalog: ProfileAttributeDef[];   // catalogue SPEC-PROFILE §2
  disclaimers: Record<string, LocalizedText>; // par themeId, obligatoire pour impots/investissement
  manifestDigest: string;            // SHA-256(JCS(manifeste sans manifestDigest))
}
interface Theme {
  themeId: string;                   // ex. 'budget'|'revenu'|'impots'|'investissement'
  title: LocalizedText; description: LocalizedText;
  skillId: string;                   // skill de tête dans le Domain
  prerequisites: string[];           // themeIds requis (peut être vide)
  discoverySet: DiscoveryQuestion[]; // découverte de thème, non notée
  levels: Level[];                   // 3 à 10 après personnalisation ; le pack peut en offrir jusqu'à 10
  trophy: { trophyId: string; title: LocalizedText; };
}
interface Level {
  levelId: string; themeId: string;
  title: LocalizedText;
  skillId: string;                   // skill core du niveau
  order: number;                     // 1..N, unique par thème
  itemIds: [string,string,string,string,string]; // exactement 5 items du Domain
  audience: AudienceRule | null;     // §4 ; null = tous profils
  passThreshold: { correctMin: 4; outOf: 5 };    // fermé au MVP
}
interface DiscoveryQuestion {
  questionId: string;
  prompt: LocalizedText;
  kind: 'single-choice';
  options: Array<{ code: string; label: LocalizedText }>;
  targetAttributeId: string;         // attribut du profileCatalog
  skippable: true;
}
interface AudienceRule {             // conjonction de conditions sur le profil
  all: Array<{ attributeId: string; in: string[] }>;
}
interface ProfileAttributeDef { attributeId:string; label:LocalizedText; values:Array<{code:string;label:LocalizedText}>; sensitivity:'standard'|'sensitive'; purpose:string; }
```

## 3. Invariants du pack (validation `validateFinancePack`)

En plus de `validatePackage` (core), un pack finance est rejeté si :

1. un `themeId`, `levelId`, `questionId`, `trophyId` n'est pas unique ;
2. un niveau n'a pas exactement 5 `itemIds`, ou un `itemId` n'existe pas dans le Domain, ou n'est pas rattaché au `skillId` du niveau ;
3. un thème offre moins de 3 niveaux, ou plus de 10, **ou** l'un de ses sous-ensembles atteignables par les règles `audience` sort de [3,10] (le validateur énumère les combinaisons d'audience déclarées) ;
4. les `order` d'un thème ne sont pas 1..N contigus ;
5. le graphe de prérequis de thèmes est cyclique, ou référence un thème absent ;
6. une `DiscoveryQuestion` cible un `attributeId` hors `profileCatalog`, ou une option a un `code` hors des valeurs de l'attribut ;
7. un thème `impots` ou `investissement` n'a pas de disclaimer ;
8. `manifestDigest` ne correspond pas ; ou `version` ≠ version du `ContentPackage` référencé ;
9. le seuil diffère de `{correctMin:4,outOf:5}` (fermé au MVP).

Les questions de découverte/onboarding sont **non notées** : elles ne sont jamais des `Item` du Domain runtime et ne produisent jamais d'événement `item.answered` core.

## 4. Personnalisation des niveaux

- Le pack déclare l'univers des niveaux ; la fonction `selectLevels(theme, profile, personalizationVersion)` retourne le sous-ensemble ordonné applicable : niveaux dont `audience` est `null` ou satisfaite par le profil (tout attribut `undisclosed` ne satisfait que `audience:null`).
- Sortie toujours dans [3,10] (garanti par l'invariant 3) ; déterministe : mêmes entrées ⇒ même sortie, versionnée par `personalizationVersion`.
- Le sous-ensemble est **épinglé par thème à la première entrée dans le thème** (`pinnedLevels(themeId)`) ; un changement ultérieur de profil ne retire jamais un niveau déjà validé et ne modifie pas le sous-ensemble épinglé sur la même version de pack.

## 5. Packs France versionnés

- `finance-fr` v1 fournit : 4 thèmes (`budget`, `revenu`, `impots`, `investissement`), onboarding (5–8 questions), découvertes par thème, disclaimers, catalogue de profil (SPEC-PROFILE §2).
- Prérequis MVP : `budget` sans prérequis ; `revenu` sans prérequis ; `impots` requiert `revenu` ; `investissement` requiert `budget`. (Configurable par pack ; ces valeurs sont celles du pack France v1, pas de la couche produit.)
- Contenu France = contenu du pack, jamais du code : la règle 50-30-20 (niveau du thème `revenu`) est un contenu enseigné comme heuristique parmi d'autres, remplaçable par une nouvelle version de pack sans changement de code.
- Impôts : concepts généraux uniquement (voir SPEC-FINANCE-EDUCATION §2.2). Tout chiffre annuel éventuel doit citer sa source dans les métadonnées d'item (`metadata.source`, `metadata.validUntil`) — post-MVP.
- Évolution : SemVer et diff de SPEC-CONTENT ; changement de clé de réponse, retrait de niveau ou changement de seuil = MAJOR.

## 6. Progression, tentatives, échec, reprise, révision

```ts
interface LevelAttempt { attemptId:string; learnerId:string; levelId:string; packVersion:string; sessionId:string; startedAt:string; completedAt:string|null; grades:Array<'correct'|'incorrect'|'skipped'>; outcome:'passed'|'failed'|'in-progress'|'abandoned'; }
interface LearnerProgression { learnerId:string; packId:string; packVersion:string; pinnedLevels:Record<string,string[]>; levelStatus:Record<string,'locked'|'available'|'passed'>; themeStatus:Record<string,'locked'|'available'|'in-progress'|'completed'>; trophies:string[]; updatedAt:string; }
```

- Une tentative = une session core de 5 items (le plan de session contient exactement les 5 `itemIds` du niveau ; l'ordre de présentation est mélangé par le RNG seedé du core ; la contrainte de non-répétition core s'applique à l'intérieur de la session, pas entre tentatives d'un même niveau).
- `outcome='passed'` ⇔ au moins 4 grades `correct`. `skipped` compte comme non correct. Calcul pur, testable, indépendant de la latence.
- Échec : `failed` n'a aucun effet destructif ; le niveau reste `available` et rejouable immédiatement. Le nombre de tentatives est illimité au MVP.
- Reprise : sémantique core (session active unique, curseur, digest) ; une tentative abandonnée est `abandoned` et ne compte pas comme échec.
- Un niveau `passed` le reste sur la même version de pack ; rejouer un niveau validé est autorisé (mode révision) sans pouvoir le dévalider.
- Révision : sessions de révision distinctes, alimentées par les items dus du scheduler core, sans effet sur `levelStatus` ni trophées.
- Changement de version de pack : la progression est épinglée à `packVersion` ; l'adoption d'une nouvelle version suit ADR-003 (pas de migration implicite). Politique MVP : les niveaux `passed` dont le `levelId` persiste et dont le diff est non-MAJOR restent `passed` ; tout cas MAJOR exige une décision admin explicite portée par la nouvelle version.

## 7. Exemple normatif (extrait, pack France v1)

```json
{
  "themeId": "revenu",
  "levels": [
    { "levelId": "revenu-1", "order": 1, "title": "Comprendre sa fiche de paie", "skillId": "skill-revenu-1", "itemIds": ["r1q1","r1q2","r1q3","r1q4","r1q5"], "audience": null, "passThreshold": {"correctMin": 4, "outOf": 5} },
    { "levelId": "revenu-2", "order": 2, "title": "Répartir son revenu : la règle 50-30-20", "skillId": "skill-revenu-2", "itemIds": ["r2q1","r2q2","r2q3","r2q4","r2q5"], "audience": null, "passThreshold": {"correctMin": 4, "outOf": 5} },
    { "levelId": "revenu-3", "order": 3, "title": "Revenus variables et lissage", "skillId": "skill-revenu-3", "itemIds": ["r3q1","r3q2","r3q3","r3q4","r3q5"], "audience": {"all":[{"attributeId":"income-stability","in":["variable"]}]}, "passThreshold": {"correctMin": 4, "outOf": 5} }
  ]
}
```

(`revenu-3` illustre une variante d'audience ; le thème doit offrir au moins 3 niveaux `audience:null` pour garantir la borne basse pour un profil `undisclosed`.)

## 8. Tests

Valider : pack France v1 complet ; rejet de chaque invariant §3 ; `selectLevels` avec profil vide, partiel, complet ; bornes 3 et 10 ; épinglage des niveaux ; calcul `passed` à 3/5, 4/5, 5/5, avec skips ; abandon ; rejouabilité ; indépendance latence ; déterminisme double exécution byte-à-byte.
