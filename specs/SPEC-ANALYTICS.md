# SPEC-ANALYTICS — Analytics MVP2

**Version document :** `2.0.0` · **analyticsContractVersion :** `2` · **Statut :** normatif

La source normative des données transverses est [CONTRACTS-ANALYTICS.md](CONTRACTS-ANALYTICS.md). Ce runtime n'est jamais importé par MVP1 ni par improvement ; improvement consomme uniquement le contrat partagé.

## 1. Consentement et autorisation

L'ingestion exige une capability `analytics.ingest` et un `ConsentRecord` actif issu du registre. Un objet de consentement fourni ponctuellement ne suffit pas. `grant`, `revoke`, `current` et `history` sont les seules APIs de registre ; les opérations sont versionnées, idempotentes et auditées. La concurrence ingestion/révocation est linéarisée par pseudonyme.

## 2. Observation

`AnalyticsObservation` est défini dans `CONTRACTS-ANALYTICS.md`. `chosenIndex` est interdit ; l'hôte peut produire `choiceCounts` dans la zone individuelle pseudonymisée, longueur égale au nombre d'options. `sourceEventId`, `observationId`, `observationDigest`, `ingestedAt`, `pseudonymKeyVersion` sont obligatoires. Les logs, erreurs et audits ne contiennent pas le payload.

Même identifiant + même digest = duplicate ; même identifiant + digest différent = `ObservationConflictError`. Batch trop grand ou observation hors rétention/fenêtre = rejet atomique.

## 3. Fenêtres et agrégats

Fenêtres fixes de 28 jours UTC, `[from,toExclusive)`, identifiées par `windowId`; pas de fenêtre glissante. Les fenêtres incomplètes ne sont pas publiables. Les observations tardives réouvrent une révision d'agrégat versionnée. `K_MIN=10`; cellules rares ou différentiables sont supprimées. L'API ne permet pas de requêtes de soustraction ni de sortie individuelle.

`choiceDistribution` est exposée seulement dans un agrégat admissible et n'est jamais ventilée par pseudonyme. Les agrégats affectés par effacement sont invalidés puis recalculés ou retirés ; aucune promesse de conservation d'un agrégat dérivé sans vérification n'est faite.

## 4. Effacement et rétention

Révocation/erase : blocage immédiat, outbox durable chiffrée au repos, retry avec idempotency key, `404` traité comme succès, dead-letter après plafond et alerte. Les observations sont supprimées 90 jours après `ingestedAt` ou immédiatement après révocation ; consentements sont conservés durée + 12 mois ; outbox/audit 24 mois minimum. Aucun effacement forensique n'est promis.

## 5. APIs fermées

```ts
interface AnalyticsIngestPort { ingestBatch(capability:Capability,batch:AnalyticsObservation[]):Promise<IngestBatchResult>; }
interface ConsentPort { grant(input:GrantConsentCommand):Promise<ConsentRecord>; revoke(input:RevokeConsentCommand):Promise<ConsentRecord>; current(pseudonym:string):Promise<ConsentRecord|null>; history(pseudonym:string):Promise<ConsentRecord[]>; }
interface AnalyticsQueryPort { query(capability:Capability,input:{windowIds:string[];domainId:string;contentVersion?:string}):Promise<AggregatePage>; }
interface AnalyticsErasePort { erase(capability:Capability,input:{pseudonyms:string[];keyVersions:string[];idempotencyKey:string}):Promise<EraseResult>; }
```

Erreurs : `ConsentRequiredError`, `ObservationConflictError`, `ValidationError`, `CapabilityError`, `RetentionError`, `LimitExceededError`, `StorageError`, `OutboxDeadLetterError`.
