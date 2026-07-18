# CONTRACTS-EDITORIAL — Contrats éditoriaux partagés (MVP2)

**Version :** `editorialContractVersion = 2` · **Statut :** normatif

Ce document est l'unique source normative des types communs à `content-review`, `admin` et `improvement`. Il ne contient ni stockage concret, ni publication, ni accès aux apprenants.

## Dépendances

`schemas` fournit uniquement les primitives JSON, digests et erreurs de base. `content` fournit `ContentPackage`, `PackageRef` et `ContentDiff` sans importer ce document. Aucun module contractuel n'importe un runtime. Graphe autorisé :

```text
schemas → content → editorial-contracts → content-review
                         └──────────────→ admin
schemas → editorial-contracts → analytics-contracts
content ────────────────────────┘          │
editorial-contracts → content-review      ├→ improvement
editorial-contracts → admin               │
content + analytics-contracts ────────────┘
adapter-cli assemble les implémentations ; aucun contrat n'en dépend.
```

Les types `ContentPackage`, `PackageRef`, `ContentDiff`, `AuthorRef` et `GeneratorInfo` viennent de `content`; `JsonValue` vient de `schemas`. Les registres et audits sont des contrats de données définis ici, sans implémentation.

```ts
interface RegistryEntry { editorialContractVersion:2; adminContractVersion:2; packageId:string; version:string; packageDigest:string; domainDigest:string; semanticDomainDigest:string; status:'published'|'superseded'|'withdrawn'; publishedAt:string; publishedBy:string; sourceProposalId:string; supersededBy:string|null; notes:string|null; }
interface AuditRecord { editorialContractVersion:2; auditId:string; at:string; actorId:string; actorKind:'human'|'tool'; action:string; subject:{packageId?:string;version?:string;proposalId?:string;targetActorId?:string}; detail:JsonValue; }
interface AuditPort { list(capability:Capability, filter:{from?:string;to?:string;action?:string;subjectId?:string}):Promise<AuditRecord[]>; }
interface RolePort { grant(capability:Capability, actor:AuthenticatedActor, targetActorId:string, role:Role):Promise<AuthenticatedActor>; revoke(capability:Capability, actor:AuthenticatedActor, targetActorId:string, role:Role):Promise<AuthenticatedActor>; }
```

## Acteurs et capacités

```ts
type Role = 'author' | 'reviewer' | 'admin';
type ActorKind = 'human' | 'tool';
interface AuthenticatedActor { actorId: string; kind: ActorKind; roles: readonly Role[]; }
type EditorialAction = 'proposal.create'|'proposal.submit'|'review.start'|'review.approve'|'review.reject'|'registry.publish'|'registry.rollback'|'registry.withdraw'|'audit.read'|'analytics.ingest'|'analytics.aggregate'|'analytics.query'|'analytics.consent.grant'|'analytics.consent.revoke'|'analytics.rights.access'|'analytics.rights.export'|'analytics.erase'|'analytics.outbox.drain'|'analytics.key.rotate'|'role.grant'|'role.revoke';
interface Capability { capabilityVersion: 1; capabilityId: string; action: EditorialAction; resource: string; issuedAt: string; expiresAt: string; constraints: JsonValue; }
```

Les capabilities effectives sont émises par l'hôte et injectées séparément ; elles ne sont jamais auto-déclarées dans une commande. Un outil ne peut recevoir `reviewer` ou `admin`. `review.approve`, `registry.publish` et `registry.rollback` exigent un acteur humain ; l'auteur ne peut pas approuver sa propre proposition. Tout refus est audité sans donnée apprenant.

## Proposition fermée

```ts
interface CreateProposalCommand { commandId:string; commandDigest:string; actor:AuthenticatedActor; kind:ProposalKind; packageId:string; basePackage:PackageRef|null; sourcePackage:PackageRef|null; candidate:ContentPackage|null; targetRollbackVersion:string|null; rationale:string; }
type ProposalKind = 'initial'|'content-change'|'rollback'|'advisory';
type ProposalStatus = 'draft'|'proposed'|'in-review'|'approved'|'rejected'|'stale'|'published';
interface ChangeProposal {
  reviewContractVersion: 2; proposalId: string; proposalDigest: string;
  status: ProposalStatus; kind: ProposalKind; packageId: string;
  basePackage: PackageRef | null; sourcePackage: PackageRef | null;
  candidate: ContentPackage | null; targetRollbackVersion: string | null;
  diff: ContentDiff | null; requiredBump: 'none'|'patch'|'minor'|'major';
  rationale: string; findings: Finding[]; impact: ImpactAssessment;
  author: AuthorRef; generator: GeneratorInfo | null; supersedes: string | null;
  stale: StaleReason | null; createdAt: string; updatedAt: string;
  history: ProposalTransition[];
}
interface Finding { findingId: string; detector: string; detectorVersion: string; severity: 'info'|'warn'|'critical'; targetId: string; evidenceDigest: string; messageCode: string; }
interface ImpactAssessment { impactVersion: 1; category: ImpactCategory; migrationRequired: boolean; affectedStateKinds: string[]; bounds: { lower: number|null; upper: number|null }; rationaleCode: string; }
type ImpactCategory = 'none'|'presentation-only'|'compatible-additive'|'requires-new-session'|'requires-state-migration'|'withdrawal-safety-critical'|'unknown';
interface StaleReason { code: 'base-changed'|'candidate-changed'|'policy-changed'|'source-unresolved'; observedDigest: string; at: string; }
interface ProposalTransition { from: ProposalStatus|null; to: ProposalStatus; actor: AuthenticatedActor; at: string; reason: string|null; }
```

Invariants : `initial` exige `basePackage = null`; `rollback` exige une cible et un candidat matériellement nouveau ; `advisory` est non publiable ; `published` et `rejected` sont terminaux ; `stale` persiste sa raison ; toute transition est append-only et protégée par révision CAS. `proposalDigest` couvre le candidat/références/diff/findings/impact/politique et sert à l'idempotence.

## Checklist persistée

```ts
interface ReviewChecklist { checklistVersion: 1; proposalId: string; completedBy: AuthenticatedActor; completedAt: string; items: ReviewChecklistItem[]; result: 'pass'|'fail'; snapshot: { candidateDigest: string|null; basePackageDigest: string|null; diffDigest: string|null; impactDigest: string; }; }
interface ReviewChecklistItem { itemId: 'intrinsic'|'evolution'|'pedagogy'|'runtime-impact'|'provenance'|'safety'|'rollback'|'current-base'; result: 'pass'|'fail'; comment: string; reviewerId: string; }
```

Une checklist complète et inchangée est obligatoire pour `approved`. Rebase, changement de candidat, source ou base invalide la checklist.

## Unité transactionnelle

```ts
interface EditorialUnitOfWork {
  begin(): Promise<void>;
  getProposal(id: string): Promise<ChangeProposal|null>;
  getChecklist(id: string): Promise<ReviewChecklist|null>;
  getCurrent(packageId: string): Promise<RegistryEntry|null>;
  getIdempotency(commandId: string): Promise<IdempotencyRecord|null>;
  saveProposal(value: ChangeProposal, expectedRevision: number): Promise<void>;
  saveChecklist(value: ReviewChecklist, expectedRevision: number): Promise<void>;
  publishRegistryEntry(value: RegistryEntry, expectedCurrentDigest: string|null): Promise<void>;
  appendAudit(value: AuditRecord): Promise<void>;
  saveIdempotency(value: IdempotencyRecord): Promise<void>;
  commit(): Promise<CommitReceipt>;
  rollback(): Promise<void>;
}
interface IdempotencyRecord { commandId: string; commandDigest: string; resultDigest: string; result: JsonValue; createdAt: string; }
interface CommitReceipt { committedAt: string; resultDigest: string; }
```

Une mutation, sa transition, sa checklist, son audit et son résultat d'idempotence sont atomiques. `approve` et `publish` relisent la base courante et matérialisent `stale` dans la même transaction si le digest diverge ; aucune promesse de mise à jour globale automatique des propositions n'est faite.

## Erreurs

`EditorialErrorCode = 'InvalidTransitionError'|'ForbiddenError'|'StaleProposalError'|'ValidationError'|'IdempotencyConflictError'|'ConcurrencyError'|'NotApprovedError'|'VersionConflictError'|'StorageError'`.

