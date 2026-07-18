# SPEC-CONTENT — ContentPackage et versionnage (`@elicit/content`)

**Version document :** `2.0.0` · **packageSchemaVersion :** `2` · **Statut :** normatif

## 1. Frontière

`content` dépend de `schemas` seulement. Il valide des artefacts et calcule des diffs ; il ne publie pas, ne résout pas automatiquement un package source et ne migre pas un état apprenant.

## 2. Package fermé

```ts
interface ContentPackage { packageSchemaVersion:2; packageId:string; domain:Domain; version:string; packageDigest:string; provenance:Provenance; changelog:ChangelogEntry[]; }
interface PackageRef { packageId:string; version:string; packageDigest:string; domainDigest:string; }
interface AuthorRef { actorId:string; displayName:string|null; }
interface GeneratorInfo { name:string; version:string; configurationDigest:string|null; }
interface Provenance { createdAt:string; authoredBy:AuthorRef[]; generator:GeneratorInfo|null; sourcePackage:PackageRef|null; }
interface ChangelogEntry { version:string; date:string; summary:string; kind:'initial'|'patch'|'minor'|'major'|'rollback'; rollbackOf:PackageRef|null; }
interface ContentDiff { packageId:string; source:PackageRef; candidate:PackageRef; entries:ContentDiffEntry[]; requiredBump:'none'|'patch'|'minor'|'major'; diffDigest:string; }
interface ContentDiffEntry { kind:'added'|'removed'|'changed'; path:string; before:JsonValue|null; after:JsonValue|null; }
type PackageValidationResult = { valid:true; packageDigest:string; domainDigest:string; semanticDomainDigest:string; } | { valid:false; errors:string[]; }
type EvolutionValidationResult = { valid:true; requiredBump:'none'|'patch'|'minor'|'major'; diff:ContentDiff; } | { valid:false; errors:string[]; }
```

`rollbackOf` est non nul si et seulement si `kind='rollback'`. `packageDigest` couvre le package sans sa propre clé. `semanticDomainDigest` est défini par `SPEC-SCHEMAS.md`.

## 3. Validation séparée

```ts
validatePackage(pkg: unknown): PackageValidationResult;
validateEvolution(candidate: ContentPackage, source: ContentPackage|null): EvolutionValidationResult;
diffContentPackages(source: ContentPackage, candidate: ContentPackage): ContentDiff;
migratePackage(input: unknown, fromVersion:number, toVersion:number): ContentPackage;
```

`validatePackage` ne regarde que le package : schéma/limites, SemVer, cohérence domaine/version/items, provenance/changelog, `domainDigest` et `packageDigest`. Elle est pure et sans registre.

`validateEvolution` exige `source=null` uniquement pour `initial`. Pour toute autre évolution, le source complet doit avoir été résolu par l'appelant et validé ; la fonction vérifie identité du package, référence exacte, digest du source, version strictement supérieure, diff déterministe et bump suffisant. Aucun lookup implicite n'est autorisé.

Erreurs fermées : `InvalidPackage`, `DigestMismatch`, `UnsupportedPackageSchema`, `UnresolvedSourcePackage`, `SourcePackageMismatch`, `VersionConflict`, `InsufficientVersionBump`, `InvalidRollback`.

## 4. SemVer et rollback

PATCH : présentation/métadonnées sans effet sur notation/sélection. MINOR : ajout compatible. MAJOR : suppression, prérequis, clé de réponse, ordre/options, difficulté/format/contrôle modifiés. Le diff est trié par type puis IDs UTF-16 et contient `requiredBump`.

Rollback : charger la cible complète, créer une version jamais utilisée, reconstruire `domain.version` et chaque `Item.contentVersion`, conserver la projection sémantique, recalculer de nouveaux `domainDigest` et `packageDigest`, renseigner `rollbackOf`, puis soumettre le candidat à revue. Les digests d'identité de candidat et cible sont nécessairement distincts ; leurs `semanticDomainDigest` sont égaux.

## 5. Migration

`migratePackage` est pure, déterministe, par étapes `vN→vN+1`, non destructive et suivie de `validatePackage`. Un schéma futur est rejeté. **MVP1 ne définit aucune migration de `LearnerState` entre contentVersion** : une paire `(contentVersion,domainDigest)` divergente est refusée. La migration d'état est hors contrat jusqu'à un contrat dédié.

## 6. Tests

Fixtures obligatoires : validation intrinsèque sans source, évolution sans source, source incohérent, bump insuffisant, migration 1→2, rollback sémantiquement égal avec nouveaux digests, rollback refusé si projection différente, package futur rejeté.
