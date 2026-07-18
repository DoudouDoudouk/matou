# SPEC — Runtime core Elicit MVP1

**Version document :** `2.0.0` · **contractVersion :** `2` · **Statut :** normatif

MVP1 est déterministe, local, sans analytics, LLM, réseau ni extension dynamique. Il consomme un `Domain` déjà validé et épingle strictement `(contentVersion,domainDigest)`.

## 1. Ports

```ts
interface ClockPort { nowUtc(): string; }
interface SeededRngPort { shuffle<T>(items: readonly T[], seed:string, algorithmVersion:'rng-mvp-1'):T[]; }
interface IdGeneratorPort { newId(kind:'session'|'event'|'correlation'):string; }
interface ElicitConfig { domain:Domain; learnerId:string; storage:StoragePort; idGenerator:IdGeneratorPort; clock:ClockPort; rng:SeededRngPort; }
```

Aucun appel global. `clock.nowUtc()` est lu exactement une fois par nouvelle commande mutante, après validation structurelle et avant validation métier ; les fonctions reçoivent `nowUtc` explicitement. Un retry exact ne lit ni horloge ni RNG.

## 2. État initial

```ts
createInitialLearnerState(domain, learnerId, nowUtc): LearnerState
```

Le résultat contient `contentVersion=domain.version`, `domainDigest=domain.domainDigest`, `schemaVersion=1`, `updatedAt=nowUtc`, une entrée par skill/item dans l'ordre UTF-16. Chaque skill commence `pKnown=0.25`, compteurs zéro, timestamps null, `crowned=false`; chaque review `step=0,dueAt=nowUtc,lapses=0`; chaque item stat compteurs zéro et timestamps null. Un état existant ne reçoit jamais silencieusement un skill d'une autre version.

```ts
interface LearnerState { learnerId:string; domainId:string; contentVersion:string; domainDigest:string; learning:{ skills:Record<string,LearningState>; reviews:Record<string,ReviewState>; items:Record<string,ItemStat> }; updatedAt:string; schemaVersion:1; }
interface LearningState { skillId:string; pKnown:number; attempts:number; correctAttempts:number; lastOutcome:'correct'|'incorrect'|'skipped'|null; lastPresentedAt:string|null; lastAnsweredAt:string|null; crowned:boolean; }
type ReviewStep = 0|1|2|3|4|5;
interface ReviewState { step:ReviewStep; dueAt:string; lapses:number; }
interface ItemStat { attempts:number; correct:number; skips:number; lastPresentedAt:string|null; lastAnsweredAt:string|null; }
```

## 3. Pipeline de commande

```text
validation enveloppe fermée → commandDigest → déduplication
→ load aggregate/tombstone/CAS/content pair → clock unique
→ validation métier → decideV1 pure → events pending
→ commit atomique snapshot+sessions+events+result → réponse après commit
```

```ts
interface CommandContextV1 { nowUtc:string; aggregateId:string; domain:Domain; rngSeed:string; }
type ValidatedCommandV1 = CommandEnvelope<CommandPayloadV1>;
interface DecisionV1 { nextState:LearnerState; nextSessions:PersistedSession[]; events:PendingDomainEventV1[]; result:CommandResultV1; }
function decideV1(state:LearnerState,sessions:readonly PersistedSession[],command:ValidatedCommandV1,context:CommandContextV1):DecisionV1;
function reduceV1(state:LearnerState,event:DomainEventV1):LearnerState;
```

`reduceV1` est pur. Le snapshot est la vérité de production ; les événements permettent replay et contrôle.

```ts
interface SessionPlan { sessionId:string; domainId:string; contentVersion:string; domainDigest:string; items:Array<{itemId:string;skillId:string;reason:'due-review'|'weak-skill'|'new-skill'|'prerequisite-frontier';contentVersion:string}>; selectorVersion:'mvp-1'; schedulerVersion:'discrete-mvp-1'; rngSeed:string; diagnostic:SelectionDiagnostic; planDigest:string; }
interface PersistedSession { id:string; state:'active'|'completed'|'abandoned'; plan:SessionPlan; cursor:number; startedAt:string; completedAt?:string; updatedAt:string; }
interface SelectionDiagnostic { selectorVersion:'mvp-1'; requestedSize:5|6|7|8|9|10; availableCount:number; dueAvailableCount:number; dueQuota:number; selectedCount:number; selectedItemIds:string[]; selectedByReason:Record<'due-review'|'weak-skill'|'new-skill'|'prerequisite-frontier',number>; insufficientItems:boolean; fallbackApplied:boolean; relaxedConstraints:Array<'due-quota'|'control-distance'|'format-tier'>; }
```

## 4. Commandes et sessions

Commandes fermées : `session.start`, `item.answer`, `item.skip`, `session.abandon`, `learner.erase`. Le payload brut de réponse sert à calculer la note puis est détruit ; le storage ne reçoit que grade et projections expurgées. `StartSessionOptions.requestedSize` vaut 5..10, défaut 5. Une seule session active par agrégat.

`SessionPlan` contient `sessionId,domainId,contentVersion,domainDigest,items,selectorVersion:'mvp-1',schedulerVersion:'discrete-mvp-1',rngSeed,diagnostic,planDigest`; chaque item contient `contentVersion`. Une reprise vérifie le digest, les versions et l'existence/identité des items, sans relancer le sélecteur.

## 5. RNG et sélection

`rng-mvp-1` = Fisher–Yates décroissant. Pour chaque tirage, bloc = `SHA-256(UTF8(JCS({algorithmVersion:'rng-mvp-1',seed,counter})))`, 32 bits big-endian, échantillonnage par rejet sans modulo biaisé. L'entrée est la liste d'IDs triée UTF-16. Aucun état global.

Seed contractuel : `lowerHex(SHA-256(UTF8(JCS({aggregateId,domainDigest,selectorVersion:'mvp-1'}))))`. `recommend()` et la première sélection de `session.start` utilisent la même fonction pure et le même seed.

Raisons exclusives : `due-review`, `prerequisite-frontier`, `new-skill`, `weak-skill`. Candidats triés par `(duePriority,reasonPriority,adaptationScore,formatDistance,waitingPriority,rngRank,itemId)`. `dueQuota=floor(requestedSize/2)`, `dueAvailableCount` est calculé avant quota. Les items dus au-delà du quota restent `due-review` et ne deviennent sélectionnables qu'après relâchement de `due-quota`.

Contraintes relâchables : `due-quota`, `control-distance`, `format-tier`. `non-repetition` est dure et ne figure jamais dans `relaxedConstraints`. À chaque position, prendre le premier candidat admissible dans l'ordre total ; relâcher la prochaine contrainte et reprendre la même position. Si aucune solution, plan plus court et `insufficientItems=true`. `fallbackApplied ⇔ relaxedConstraints.length>0`.

## 6. BKT et scheduler

BKT `bkt-mvp-1` : `pInit=.25,pLearn=.15,pSlip=.10,pGuess=.20`, IEEE-754, clamp epsilon `1e-12`; skipped ne modifie pas pKnown. Scheduler `discrete-mvp-1`, steps 0..5, intervalles `[0,1,3,7,14,30]` jours UTC de 86400 secondes ; correct avance d'un step, incorrect step 1 + lapse, skipped conserve step et fixe `dueAt=nowUtc`.

## 7. Contenu et erreurs

Tout commit/reprise exige l'égalité exacte de `(contentVersion,domainDigest)` avec le domaine chargé. Une divergence est `ContentVersionMismatchError`; aucune migration d'état, réécriture de plan ou réécriture d'événement n'est permise. La publication de contenu est MVP2 et n'est pas appelée par le core.

Erreurs : `ValidationError`, `StorageError`, `ConcurrencyError`, `EngineClosedError`, `TombstonedError`, `IdempotencyConflictError`, `ContentVersionMismatchError`. Messages sans payload brut.

## 8. Tests et vecteurs

L'artefact d'implémentation attendu `vectors/mvp1/` doit fournir les vecteurs normatifs couvrant JCS/digests, état initial, BKT, scheduler, RNG, sélection/fallback, commandes/reducer, événements, séquences, reprise et CLI ; ce répertoire n'est pas inclus dans le corpus documentaire. Deux exécutions conformes doivent produire snapshots, plans, événements, résultats et exports identiques octet pour octet.
