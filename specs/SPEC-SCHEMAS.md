# SPEC-SCHEMAS — Schémas partagés (`@elicit/schemas`)

**Version document :** `2.0.0` · **contractVersion :** `2` · **schemaVersion :** `2` · **Statut :** normatif

Source unique de vérité pour les primitives JSON, le contenu runtime MVP1, les commandes, événements, résultats, digests et erreurs. Aucune dépendance interne, I/O ou effet de bord.

## 1. Primitives et fermeture

```ts
type JsonPrimitive = null|boolean|string|number;
type JsonValue = JsonPrimitive|JsonValue[]|{ [key:string]: JsonValue };
type LocalizedText = string | { locale: string; text: string }[];
```

Toute clé inconnue, valeur non JSON, cycle, prototype dangereux (`__proto__`, `constructor`, `prototype`), nombre non fini ou `-0` est rejeté. `LocalizedText` est soit une chaîne, soit une liste non vide d'entrées `{locale,text}` sans doublon, triée par `locale` UTF-16 ; chaque text est non vide. Le fallback est hors core ; l'hôte choisit uniquement une entrée existante, sinon erreur d'affichage.

## 3. Modèle de contenu runtime

```ts
interface Domain { id:string; version:string; locale:string; domainDigest:string; skills:Skill[]; items:Item[]; }
interface Skill { id:string; title:LocalizedText; mode:'learning'; prerequisites:string[]; targetMastery?:number; status?:'active'|'deprecated'; }
interface Item { id:string; skillId:string; mode:'learning'; exercise:LearningExercise; difficulty:number; formatTier:1|2|3; controlOf?:string; metadata:Record<string,string>; contentVersion:string; }
type LearningExercise = { type:'binary'; prompt:LocalizedText; correct:boolean; feedback?:DeclarativeFeedback } | { type:'multiple-choice'; prompt:LocalizedText; options:LocalizedText[]; correctIndex:number; feedback?:DeclarativeFeedback };
interface DeclarativeFeedback { correct?:LocalizedText; incorrect?:LocalizedText; }
```

`validateDomain` vérifie uniquement le package runtime intrinsèque : IDs uniques et non vides, références cohérentes, graphe de prérequis acyclique, `domain.version === item.contentVersion`, mode learning, QCM avec au moins deux options et index dans les bornes. Le digest fourni est vérifié avant usage.

## 4. Canonicalisation et digests

JCS = RFC 8785, UTF-8, sans normalisation Unicode. Tous les digests sont hexadécimaux minuscules, 64 caractères.

```text
domainDigest = SHA-256(JCS(domain sans la clé domainDigest))
semanticDomainDigest = SHA-256(JCS(domain sans domainDigest, version, et contentVersion de chaque Item))
packageDigest = SHA-256(JCS(package sans packageDigest))
commandDigest = SHA-256(JCS({commandType, contractVersion, payload}))
planDigest = SHA-256(JCS(plan sans planDigest))
rngSeed = SHA-256(JCS({aggregateId, domainDigest, selectorVersion}))
```

Une clé supprimée est absente, jamais remplacée. `semanticDomainDigest` ne remplace pas l'identité runtime `(contentVersion,domainDigest)`.

## 5. Événements fermés

```ts
type MvpEventTypeV1 = 'learner.created'|'session.started'|'item.presented'|'item.answered'|'item.skipped'|'session.completed'|'session.abandoned'|'learner.erased';
type DomainEventV1 =
 | EventEnvelopeV1<'learner.created', LearnerCreatedPayloadV1>
 | EventEnvelopeV1<'session.started', SessionStartedPayloadV1>
 | EventEnvelopeV1<'item.presented', ItemPresentedPayloadV1>
 | EventEnvelopeV1<'item.answered', ItemAnsweredPayloadV1>
 | EventEnvelopeV1<'item.skipped', ItemSkippedPayloadV1>
 | EventEnvelopeV1<'session.completed', SessionCompletedPayloadV1>
 | EventEnvelopeV1<'session.abandoned', SessionAbandonedPayloadV1>
 | EventEnvelopeV1<'learner.erased', LearnerErasedPayloadV1>;
interface EventEnvelopeV1<T extends MvpEventTypeV1,P extends JsonValue>{ eventId:string; aggregateId:string; aggregateType:'learner'|'session'; sequence:number; schemaVersion:1; occurredAt:string; contentVersion:string; domainDigest:string; type:T; payload:P; metadata:{commandId:string; correlationId:string; causationId:string|null}; }
interface LearnerCreatedPayloadV1 { learnerId:string; domainId:string; contentVersion:string; domainDigest:string; }
interface SessionStartedPayloadV1 { sessionId:string; planDigest:string; itemCount:number; }
interface ItemPresentedPayloadV1 { sessionId:string; itemId:string; skillId:string; position:number; }
interface ItemAnsweredPayloadV1 { sessionId:string; itemId:string; skillId:string; grade:'correct'|'incorrect'; }
interface ItemSkippedPayloadV1 { sessionId:string; itemId:string; skillId:string; }
interface SessionCompletedPayloadV1 { sessionId:string; answered:number; correct:number; skipped:number; }
interface SessionAbandonedPayloadV1 { sessionId:string; cursor:number; }
interface LearnerErasedPayloadV1 { learnerId:string; domainId:string; erasedEpoch:number; }
type PendingDomainEventV1 = Omit<DomainEventV1,'sequence'> & { sequence?: never };
```

Payloads fermés : `learner.created {learnerId,domainId,contentVersion,domainDigest}`, `session.started {sessionId,planDigest,itemCount}`, `item.presented {sessionId,itemId,skillId,position}`, `item.answered {sessionId,itemId,skillId,grade:'correct'|'incorrect'}`, `item.skipped {sessionId,itemId,skillId}`, `session.completed {sessionId,answered,correct,skipped}`, `session.abandoned {sessionId,cursor}`, `learner.erased {learnerId,domainId,erasedEpoch}`. Aucune réponse brute, `chosenIndex` ou `latencyMs`.

`learner.erased` est construit dans la transaction puis supprimé avec le journal avant toute lecture observable ; seule la tombstone minimale subsiste.

## 6. Commandes et résultats

```ts
type CommandTypeV1='session.start'|'item.answer'|'item.skip'|'session.abandon'|'learner.erase';
interface CommandEnvelope<T extends CommandPayloadV1>{ commandId:string; commandType:CommandTypeV1; contractVersion:2; payload:T; commandDigest:string; }
type CommandResultV1 = SessionStartedResultV1|ItemAnsweredResultV1|ItemSkippedResultV1|SessionAbandonedResultV1|LearnerErasedResultV1;
```

```ts
interface StartSessionPayload { options?: { requestedSize?: 5|6|7|8|9|10 }; }
interface AnswerPayload { sessionId:string; answer: { type:'binary'; value:boolean } | { type:'multiple-choice'; index:number }; latencyMs?: number; }
interface SkipPayload { sessionId:string; }
interface AbandonPayload { sessionId:string; }
interface EraseLearnerDataPayload { learnerId:string; domainId:string; }
type CommandPayloadV1 = StartSessionPayload|AnswerPayload|SkipPayload|AbandonPayload|EraseLearnerDataPayload;
interface SessionStartedResultV1 { kind:'session.started'; sessionId:string; state:'active'; plan:SessionPlan; persistedRevision:number; }
interface ItemAnsweredResultV1 { kind:'item.answered'; sessionId:string; grade:'correct'|'incorrect'; persistedRevision:number; }
interface ItemSkippedResultV1 { kind:'item.skipped'; sessionId:string; persistedRevision:number; }
interface SessionAbandonedResultV1 { kind:'session.abandoned'; sessionId:string; persistedRevision:number; }
interface LearnerErasedResultV1 { kind:'learner.erased'; erased:true; }
```

`SessionPlan`, `PersistedSession` et `SelectionDiagnostic` sont les types publics fermés de `SPEC.md`; ce schéma les référence sans les redéfinir.

Chaque payload est discriminé et fermé. `latencyMs` est volatile et jamais persisté. Le digest est calculé sur le payload brut avant notation puis le payload brut est détruit.

## 7. Limites et erreurs

Les limites numériques existantes restent applicables ; sont ajoutées `maxAnalyticsBatch`, `maxAnalyticsWindows`, `maxProposalFindings`, `maxRetryAttempts`. N+1 est toujours rejeté, sans troncature. Timestamps : UTC ISO-8601 à la seconde.

```ts
type ElicitErrorCode='ValidationError'|'StorageError'|'ConcurrencyError'|'EngineClosedError'|'TombstonedError'|'IdempotencyConflictError'|'ContentVersionMismatchError';
```

Les erreurs ne contiennent jamais de payload brut, réponse, pseudonyme ou donnée personnelle inutile.

## 8. Versionnage

Toute clé, union, limite ou sémantique incompatible exige un nouveau contractVersion/schemaVersion. Les modules MVP2 utilisent leurs documents contractuels v2 et ne modifient pas rétroactivement les événements MVP1.
