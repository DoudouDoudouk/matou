# CONTRACTS-ANALYTICS — Contrats analytics partagés (MVP2)

**Version :** `analyticsContractVersion = 2` · **Statut :** normatif

Source unique des observations, consentements, fenêtres, agrégats, droits et outbox. Il importe uniquement `Capability` depuis `CONTRACTS-EDITORIAL.md` (sans importer de workflow) ; `analytics-runtime` implémente ces contrats ; `improvement` ne dépend que des contrats, jamais du runtime.

## Consentement versionné

```ts
interface ConsentRecord { analyticsContractVersion: 2; consentId: string; pseudonyms: Array<{ value: string; keyVersion: string }>; scope: 'aggregates-v2'; policyVersion: string; status: 'granted'|'revoked'; grantedAt: string; revokedAt: string|null; evidenceDigest: string; lastCommandId: string; }
interface ConsentPort { grant(input: GrantConsentCommand): Promise<ConsentRecord>; revoke(input: RevokeConsentCommand): Promise<ConsentRecord>; current(pseudonym: string): Promise<ConsentRecord|null>; history(pseudonym: string): Promise<ConsentRecord[]>; }
```

```ts
interface GrantConsentCommand { commandId:string; commandDigest:string; pseudonyms:Array<{value:string;keyVersion:string}>; policyVersion:string; evidenceDigest:string; }
interface RevokeConsentCommand { commandId:string; commandDigest:string; pseudonyms:Array<{value:string;keyVersion:string}>; reason:'user-request'|'learner-erased'; }
```

`grant` et `revoke` sont idempotents par `(commandId, commandDigest)`. Une révocation est linéarisée avec ingestion par pseudonyme : l'observation est soit engagée avant la révocation, soit rejetée après, jamais acceptée après une révocation engagée. Une preuve de consentement n'est pas supprimée par la révocation pendant sa rétention légale.

## Observation et idempotence

```ts
interface AnalyticsObservation { observationId: string; observationDigest: string; analyticsContractVersion: 2; learnerPseudonym: string; pseudonymKeyVersion: string; sourceEventId: string; domainId: string; contentVersion: string; domainDigest: string; itemId: string; skillId: string; outcome: 'correct'|'incorrect'|'skipped'; choiceCounts: number[]|null; latencyBucket: LatencyBucket|null; windowId: string; occurredAt: string; ingestedAt: string; }
```

`sourceEventId` est obligatoire et garantit que deux occurrences légitimes ne sont pas fusionnées. `observationId = lowerHex(HMAC-SHA-256(observationIdKey, JCS({sourceEventId, learnerPseudonym, pseudonymKeyVersion, domainId, contentVersion, domainDigest, itemId, windowId, outcome, choiceCounts, latencyBucket})))`. Même identifiant + même digest = `duplicate` sans nouvelle écriture ; identifiant + digest différent = `ObservationConflictError`.

`choiceCounts` remplace définitivement `chosenIndex` : longueur exacte du nombre d'options, comptes entiers, transmis seulement dans la zone individuelle pseudonymisée, jamais retourné. Aucun `learnerId`, réponse brute ou payload individuel n'est exposé à improvement/review/admin.

## Fenêtres et agrégation

```ts
interface FixedWindow { windowId: string; from: string; toExclusive: string; durationDays: 28; timezone: 'UTC'; complete: boolean; }
```

`n = floor((occurredAt - 1970-01-01T00:00:00Z)/(28 jours))`; intervalle `[from,toExclusive)`. Les événements futurs sont rejetés. Une observation tardive pour une fenêtre déjà close ouvre une nouvelle révision d'agrégat (`aggregateRevision`), jamais une mutation silencieuse. Les fenêtres incomplètes ne sont pas publiables.

`choiceDistribution` est soit `null`, soit un tableau d'entiers finis non négatifs dont la longueur est exactement celle des options de l'item validé ; ses cellules sont indexées par position et sa somme ne dépasse pas `attempts`. `K_MIN = 10`, `learnerCount` compte les pseudonymes distincts. Une cellule sous le seuil est absente. Les requêtes imposent fenêtres et dimensions autorisées, interdisent les requêtes de différence et retournent uniquement des agrégats sans pseudonymes. Les cellules rares, dominées ou permettant une soustraction sont supprimées.

```ts
interface ItemAggregate { analyticsContractVersion: 2; aggregateRevision: number; domainId: string; contentVersion: string; itemId: string; skillId: string; windowId: string; learnerCount: number; attempts: number; correct: number; skipped: number; choiceDistribution: number[]|null; latencyDistribution: Record<LatencyBucket,number>|null; complete: true; computedAt: string; }
type LatencyBucket = 'lt2s'|'lt5s'|'lt15s'|'lt60s'|'gte60s';
```

## Outbox d'effacement

```ts
interface EraseOutboxEntry { outboxId: string; subjectDigest: string; encryptedPseudonymsRef: string; keyVersions: string[]; reason: 'consent-revoked'|'learner-erased'; requestedAt: string; nextAttemptAt: string; attemptCount: number; status: 'pending'|'in-flight'|'completed'|'dead-letter'; idempotencyKey: string; lastErrorCode: string|null; }
```

La révocation et la création de l'outbox sont atomiques. Retry borné avec backoff ; `404` est succès ; échec transitoire reste `pending`, échec permanent devient `dead-letter` et alerte l'opérateur. Les observations individuelles sont purgées, puis les agrégats dérivés concernés sont invalidés et recalculés ou marqués non publiables. Les findings/propositions fondés sur un agrégat invalidé deviennent `superseded`.

Rétention : observations 90 jours après `ingestedAt`, consentements durée du consentement + 12 mois, outbox 24 mois minimum, agrégats conservés seulement s'ils restent admissibles. Aucun effacement forensique n'est promis.

```ts
interface IngestBatchResult { accepted:number; duplicate:number; rejected:number; }
interface AggregationResult { windowIds:string[]; aggregateRevision:number; computedAt:string; }
interface AggregatePage { items:ItemAggregate[]; nextCursor:string|null; }
interface EraseResult { idempotencyKey:string; status:'accepted'|'completed'|'dead-letter'; affectedPseudonymCount:number; }
interface PersonalDataInventory { subject:SubjectRef; consentRecords:ConsentRecord[]; observationCount:number; outboxCount:number; }
interface PersonalDataExport { subject:SubjectRef; consentRecords:ConsentRecord[]; observations:AnalyticsObservation[]; exportedAt:string; }
interface EraseReceipt { idempotencyKey:string; acceptedAt:string; status:'accepted'|'completed'|'dead-letter'; }
```

## APIs et capacités

```ts
interface AnalyticsIngestPort { ingestBatch(capability: Capability, batch: AnalyticsObservation[]): Promise<IngestBatchResult>; }
interface AnalyticsAggregationPort { aggregate(capability: Capability, input: { windowIds: string[]; domainId: string; contentVersion: string }): Promise<AggregationResult>; }
interface AnalyticsQueryPort { query(capability: Capability, input: { windowIds: string[]; domainId: string; contentVersion?: string }): Promise<AggregatePage>; }
interface AnalyticsErasePort { erase(capability: Capability, input: { pseudonyms: string[]; keyVersions: string[]; idempotencyKey: string }): Promise<EraseResult>; }
```

Actions distinctes : `analytics.ingest`, `.aggregate`, `.query`, `.consent.grant`, `.consent.revoke`, `.rights.access`, `.rights.export`, `.erase`, `.outbox.drain`, `.key.rotate`. Une capability n'autorise jamais une autre action.

```ts
interface AnalyticsRightsPort {
  access(capability: Capability, subject: SubjectRef): Promise<PersonalDataInventory>;
  export(capability: Capability, subject: SubjectRef): Promise<PersonalDataExport>;
  erase(capability: Capability, subject: SubjectRef): Promise<EraseReceipt>;
}
interface SubjectRef { pseudonyms: string[]; keyVersions: string[]; }
```

`access` et `export` retournent uniquement les données personnelles encore gérées par l'opérateur et n'exposent jamais de données d'un autre sujet. `erase` engage la même outbox que la révocation et retourne un reçu sans payload.

Limites fermées : `maxObservationsPerBatch`, `maxBatchSerializedBytes`, `maxChoiceOptions`, `maxWindowsPerQuery`, `maxAggregateCellsPerPage`, `maxOutboxAttempts`. Dépassement = rejet atomique, jamais troncature ni sortie partielle.

