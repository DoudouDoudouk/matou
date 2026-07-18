# SPEC-STORAGE — Persistance MVP1

**Version document :** `2.0.0` · **contractVersion :** `2` · **storageSchemaVersion :** `2` · **Statut :** normatif

`LearnerState.schemaVersion=1` et `EventEnvelopeV1.schemaVersion=1` restent les versions de leurs schémas de données ; `storageSchemaVersion=2` concerne uniquement la base et ses stores.

## 1. LoadedAggregate et port

```ts
interface AggregateTombstone { commandId:string; commandDigest:string; commandType:'learner.erase'; erasedAt:string; erasedEpoch:number; }
interface LoadedAggregate { state:LearnerState|null; revision:number; aggregateEpoch:number; lastEventSequence:number; tombstone:AggregateTombstone|null; sessions:PersistedSession[]; commandResults:Record<string,StoredCommand>; }
interface EventReadRequest { learnerId:string; domainId:string; afterSequence:number; limit:number; }
interface EventReadPage { events:DomainEventV1[]; firstSequence:number|null; lastSequence:number|null; hasMore:boolean; }
interface CommitInput { learnerId:string; domainId:string; expectedRevision:number; expectedAggregateEpoch:number; commandId:string; commandDigest:string; state:LearnerState; sessions:PersistedSession[]; events:PendingDomainEventV1[]; result:CommandResultV1; }
interface EraseInput { learnerId:string; domainId:string; expectedRevision:number; expectedAggregateEpoch:number; commandId:string; commandDigest:string; event:PendingDomainEventV1; }
interface CommitReceipt { revision:number; aggregateEpoch:number; result:CommandResultV1; resultDigest:string; }
interface StoredCommand { commandId:string; commandDigest:string; result:CommandResultV1; committedRevision:number; committedEpoch:number; }
interface LearnerExport { schemaVersion:1; learnerId:string; domainId:string; contentVersion:string; domainDigest:string; state:LearnerState; sessions:Array<{sessionId:string;state:'active'|'completed'|'abandoned';startedAt:string;completedAt?:string;planDigest:string}>; exportedAt:string; rawAnswers:[]; }
interface StoragePort {
  readonly guarantees:{atomicCommit:true; durableCommit:boolean; tombstoneOnErase:true; eraseManagedData:true};
  loadAggregate(learnerId:string,domainId:string):Promise<LoadedAggregate>;
  readEvents(request:EventReadRequest):Promise<EventReadPage>;
  commit(input:CommitInput):Promise<CommitReceipt>;
  exportLearnerData(learnerId:string,domainId:string):Promise<LearnerExport>;
  eraseLearnerData(input:EraseInput):Promise<void>;
}
```

Valeurs initiales : `revision=0`, `aggregateEpoch=0`, `lastEventSequence=0`, `state=null`. Si l'état est non nul, `revision>=1`; les séquences relues sont contiguës, strictement croissantes et bornées. `readEvents` ne lit que des événements engagés, filtre par agrégat, trie croissant et renvoie vide après la dernière séquence. Il ne constitue ni queue distante ni ack.

## 2. Commit atomique

Ordre obligatoire :

```text
1 déduplication commandId + digest
2 tombstone
3 CAS aggregateEpoch
4 CAS revision
5 cohérence contentVersion + domainDigest + lastEventSequence
6 attribution des séquences aux PendingDomainEventV1
7 snapshot + sessions + événements + StoredCommand dans une transaction unique
8 résultat après commit
```

Un retry exact retourne le résultat engagé sans clock, RNG, reducer, événement ou révision. Un digest différent produit `IdempotencyConflictError`. Le premier commit crée `learner.created`, `revision=1`, `sequence=1`. Le storage attribue les séquences ; l'appelant ne peut pas fournir `sequence`.

Le commit refuse toute paire de contenu différente du domaine chargé. Il rejette aussi une séquence de départ incohérente ou un trou. Aucun état partiel n'est observable.

## 3. Effacement

L'effacement est terminal : snapshot, sessions, résultats, journal et index apprenant sont purgés atomiquement ; une tombstone minimale conserve `commandId,commandDigest,commandType,erasedAt,erasedEpoch`. `learner.erased` est créé dans la transaction puis supprimé avant lecture. Après tombstone, toute opération est `TombstonedError` sauf retry exact de l'effacement ; aucune recréation identitaire n'est promise.

La purge couvre les données gérées. Aucun effacement forensique des sauvegardes ou supports physiques n'est promis.

## 4. IndexedDB

`aggregateKey = learnerId + U+0000 + domainId`; aucun identifiant ne contient U+0000 et aucun store n'utilise `autoIncrement`. Stores : `aggregate`, `sessions`, `commands`, `events`, `tombstones`. `eventKey` contient la séquence décimale à largeur fixe et le stockage vérifie la borne avant insertion.

Snapshot, sessions, events et commande sont écrits dans une transaction `readwrite` unique. `durableCommit=true` signifie commit IndexedDB accepté par le navigateur, pas survie à éviction OS ; l'usage de `navigator.storage.persist()` appartient à l'hôte. Une migration de base est explicite dans `onupgradeneeded`, idempotente, non destructive ; version future rejetée.

## 5. Memory

`storage-memory` est copy-on-write, `durableCommit=false` uniquement pour tests/CLI. Il doit passer exactement la suite contractuelle IndexedDB. Aucun adaptateur ne doit promettre plus que `guarantees`.

## 6. Tests

Tester pagination, séquences, retry, conflit d'idempotence, CAS, course commit/erase, crash avant/après commit, mismatch de contenu, tombstone, purge, export, isolation IndexedDB, migration de base et absence de données brutes.
