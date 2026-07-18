# ARCHIVE NON NORMATIVE — Elicit v0.3.1

Ce document est conservé à titre historique uniquement. Il ne constitue pas une source normative et ne doit pas être implémenté directement. Les contrats normatifs actuels sont référencés dans le README et les documents SPEC/CONTRACTS v2.

# Elicit — Spécification fonctionnelle et technique

**Version :** 0.3.1  
**Statut historique :** cette formulation de la version 0.3.1 n'est pas une autorisation d'implémentation ; toute implémentation doit suivre exclusivement les contrats normatifs v2 et toute divergence exige une nouvelle version de contrat.

## 1. Décision produit et périmètre

Elicit est une librairie headless de micro-sessions adaptatives. Le MVP est strictement limité à `learning`, avec les exercices `binary` et `multiple-choice`, BKT fixe, sélection déterministe, scheduler discret fixe, snapshots atomiques, commandes idempotentes, export, effacement terminal, stockage mémoire transactionnel et IndexedDB transactionnel.

Dans le profil MVP, `Skill.mode = 'learning'`, `Item.mode = 'learning'` et `type Exercise = LearningExercise`. Les exercices et valeurs de mode `preference`, `self-assessment`, `likert` et `slider` ne sont pas exportés ni importés par le profil MVP. Ils appartiennent à un module de contrats post-MVP versionné, non importé par le profil MVP ; toute valeur correspondante produit `ValidationError`.

Les plugins, analytics, synchronisation distante, fusion multi-appareils, placement, génération par LLM, réponses libres, chiffrement, `localStorage` durable et garanties DOM/ARIA/WCAG sont hors contrat MVP. Toute configuration qui les active est rejetée par `ValidationError`.

Le profil MVP accepte uniquement `contractVersion = 1` et `schemaVersion = 1`.

## 2. Principes normatifs

1. Seule une observation objective d’un exercice d’apprentissage modifie `pKnown`.
2. Toute mutation durable utilise une `CommandEnvelope`; elle est confirmée uniquement après commit atomique réussi.
3. Le digest de commande est calculé avant expurgation de sa charge utile. La déduplication par `(commandId, commandDigest)` précède CAS, epoch et révision.
4. Toute écriture durable vérifie `aggregateEpoch` et `expectedRevision` dans la même transaction.
5. Toute publication mémoire et toute résolution de promesse ont lieu après le commit complet.
6. Le snapshot validé est la source de vérité ; les événements sont des sorties expurgées.
7. La reprise exige l’égalité exacte de `contentVersion`, `domainDigest`, `selectorVersion` et `schedulerVersion`.
8. Le déterminisme fixe UTC, seed, versions, ordre des tableaux et algorithmes.
9. Le core n’accède ni au DOM, ni au réseau, ni à une horloge ou un générateur global.
10. Le payload brut d’une réponse ne franchit jamais la frontière du core vers `StoragePort`.
11. L’effacement clôt définitivement l’agrégat `(learnerId, domainId)` dans le MVP ; aucune recréation avec la même identité n’est disponible.
12. Les données persistées sont JSON bornées, sans fonctions, cycles, prototypes dangereux ni clés dangereuses.

## 3. Architecture et ports

```text
Application hôte : UI, navigation, consentement
        │ commandes / lectures / événements expurgés
@elicit/core : validation, session, BKT, sélection, scheduler, projections
        │ ports explicites
StoragePort · ClockPort · SeededRngPort · IdGeneratorPort
```

```ts
interface IdGeneratorPort {
  newId(kind: 'session' | 'event' | 'correlation'): string;
}
interface ClockPort { nowUtc(): string; }
interface SeededRngPort {
  shuffle<T>(items: readonly T[], seed: string, algorithmVersion: 'rng-mvp-1'): T[];
}
```

`newId()` retourne un identifiant opaque, JSON, non vide, borné et suffisamment unique. `commandId` est fourni par l’appelant et reste stable pendant tous les retries. `sessionId`, `eventId` et `correlationId` sont générés par le moteur. `aggregateId` est exactement `learnerId + "\u0000" + domainId` ; les deux identifiants sont donc non vides, bornés et interdits de caractère U+0000. Toute collision persistante produit `StorageError` sans remplacement silencieux.

## 4. Modèle de contenu et JSON canonique

```ts
interface Domain {
  id: string; version: string; locale: string; domainDigest: string;
  skills: Skill[]; items: Item[];
}
interface Skill {
  id: string; title: LocalizedText; mode: 'learning'; prerequisites: string[];
  targetMastery?: number; status?: 'active' | 'deprecated';
}
interface Item {
  id: string; skillId: string; mode: 'learning'; exercise: LearningExercise;
  difficulty: number; formatTier: 1 | 2 | 3; controlOf?: string;
  metadata: Record<string, string>; contentVersion: string;
}
type LearningExercise =
  | { type: 'binary'; prompt: LocalizedText; correct: boolean; feedback?: DeclarativeFeedback }
  | { type: 'multiple-choice'; prompt: LocalizedText; options: LocalizedText[]; correctIndex: number; feedback?: DeclarativeFeedback };
type Exercise = LearningExercise;
type LocalizedText = string | Record<string, string>;
type JsonPrimitive = null | boolean | string | number;
type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };
interface DeclarativeFeedback { correct?: LocalizedText; incorrect?: LocalizedText; }
```

`domainWithoutDigest` est une copie structurelle de `Domain` dont la propriété `domainDigest` est absente (elle n’est jamais remplacée par `null`, une chaîne vide ou une valeur par défaut). `domainDigest = lowercaseHex(SHA-256(UTF8(JCS(domainWithoutDigest))))`. `JCS` est exactement RFC 8785 JSON Canonicalization Scheme : les tableaux conservent leur ordre, les clés suivent le tri RFC 8785, l’encodage est UTF-8 et aucune normalisation Unicode supplémentaire n’est appliquée. Le digest est exclusivement une chaîne ASCII de 64 caractères `[0-9a-f]`; base64 et base64url sont invalides. `NaN`, `Infinity`, `-Infinity` et `-0` sont rejetés. Le digest fourni est comparé à ce calcul avant cache, adaptateur ou persistance.

La même règle JCS UTF-8 est utilisée pour tout digest JSON du contrat, notamment `commandDigest` et `planDigest`. `planDigest = lowercaseHex(SHA-256(JCS(SessionPlan sans planDigest)))`. Un digest ne se calcule jamais sur sa propre valeur.

Validation obligatoire avant cache, adaptateur ou persistance : identifiants uniques, non vides, sans `__proto__`, `constructor` ni `prototype`; graphe de prérequis acyclique; références cohérentes; `contentVersion === Domain.version`; items `learning`; QCM avec au moins deux options, options non vides et `correctIndex` dans les bornes ; clés inconnues rejetées ; feedback déclaratif sans fonction, URL, HTML, expression ou plugin.

### 4.1 Limites JSON normatives

```ts
interface JsonLimits {
  maxSerializedDomainBytes: 1_000_000;
  maxSerializedStateBytes: 2_000_000;
  maxSerializedCommandBytes: 16_384;
  maxSerializedEventBytes: 32_768;
  maxSerializedExportBytes: 8_000_000;
  maxJsonDepth: 8;
  maxObjectProperties: 64;
  maxRecordEntries: 10_000;
  maxSkills: 1_000;
  maxItems: 10_000;
  maxPersistedCommands: 50_000;
  maxArrayItems: 10_000;
  maxStringLength: 4_000;
  maxLocalizedTranslations: 16;
  maxPrerequisitesPerSkill: 32;
  maxMetadataEntries: 32;
  maxMetadataValueLength: 256;
  maxSessionItems: 10;
  maxPersistedEvents: 50_000;
  maxInteger: 1_000_000;
  maxFiniteNumber: 1_000_000;
}
```

`maxObjectProperties = 64` s’applique à chaque objet JSON structuré ordinaire, y compris chaque valeur d’une map, mais pas au nombre d’entrées des maps métier elles-mêmes. Les maps métier `skills`, `items`, `reviews`, `learning.skills`, `learning.reviews`, `learning.items` et `commandResults` sont validées par leurs limites d’entrées dédiées : `maxSkills` pour `Domain.skills`, `maxItems` pour `Domain.items`, `maxPersistedCommands` pour `commandResults`, et `maxRecordEntries` (10 000) pour toute autre map métier. Une limite dédiée remplace `maxRecordEntries` pour la map concernée ; elle ne permet jamais à un objet-valeur de dépasser `maxObjectProperties`. Chaque valeur de ces maps reste soumise à profondeur, taille, clés dangereuses et structure.

Les limites s’appliquent récursivement. Profondeur, entrées, tableaux, chaînes, nombres non finis, bytes sérialisés, cycles, fonctions, instances non JSON, prototypes non standards et clés dangereuses sont rejetés par `ValidationError`. Toute valeur persistée invalide produit `StorageError`. Rien n’est tronqué ou remplacé silencieusement.

## 5. État métier et compteurs

```ts
interface LearningState {
  skillId: string; pKnown: number; attempts: number; correctAttempts: number;
  lastOutcome: 'correct' | 'incorrect' | 'skipped' | null;
  lastPresentedAt: string | null; lastAnsweredAt: string | null; crowned: boolean;
}
type ReviewStep = 0 | 1 | 2 | 3 | 4 | 5;
interface ReviewState { step: ReviewStep; dueAt: string; lapses: number; }
interface ItemStat { attempts: number; correct: number; skips: number; lastPresentedAt: string | null; lastAnsweredAt: string | null; }
interface LearnerState {
  learnerId: string; domainId: string; contentVersion: string; domainDigest: string;
  learning: { skills: Record<string, LearningState>; reviews: Record<string, ReviewState>; items: Record<string, ItemStat> };
  updatedAt: string; schemaVersion: 1;
}
```

Pour une compétence absente : `pKnown = 0.25`, compteurs à zéro, timestamps nuls, `crowned = false`; révision `{step: 0, dueAt: nowUtc, lapses: 0}`. `dueAt` est UTC ISO-8601 tronqué à la seconde. `crowned` est recalculé par `pKnown >= targetMastery && attempts >= 3`, avec cible par défaut `0.9`, et n’entre jamais dans la sélection. Une compétence est dite maîtrisée pour les prérequis si `pKnown >= targetMastery` (cible `0.9` si `targetMastery` est absent) ; cette prédicat n’utilise pas `crowned` ni son minimum de trois tentatives. Un `Skill.status` absent vaut `active`; seul `deprecated` rend ses items inadmissibles.

Tous les compteurs, indices, positions, epochs, révisions, séquences et tailles sont des entiers JSON finis dans `[0, 1_000_000]`. Cela comprend `attempts`, `correctAttempts`, `lapses`, `ItemStat.attempts`, `ItemStat.correct`, `ItemStat.skips`, `ProgressSnapshot.completed`, `total`, `mastered`, `revision`, `aggregateEpoch`, `sequence`, `latencyMs` lorsqu’il est fourni, les compteurs de `SelectionDiagnostic` et les tailles. Toute valeur négative, fractionnaire, non finie ou supérieure à `maxInteger` produit `ValidationError` avant mutation. Invariants : `correctAttempts <= attempts`, `correct <= attempts`, `skips <= attempts`, `mastered <= total`.

`learning.reviews` est indexé exclusivement par `skillId`. `ReviewState.dueAt` est l’unique source de vérité. `ItemStat` ne contient aucune échéance.

## 6. API publique asynchrone

```ts
interface CommandEnvelope<T extends JsonValue> {
  commandId: string; commandType: string; contractVersion: 1; payload: T; commandDigest: string;
}
interface StartSessionOptions { requestedSize?: 5 | 6 | 7 | 8 | 9 | 10; }
interface StartSessionPayload { options?: StartSessionOptions; }
interface AnswerPayload { sessionId: string; answer: BinaryAnswer | MultipleChoiceAnswer; latencyMs?: number; }
interface SkipPayload { sessionId: string; }
interface AbandonPayload { sessionId: string; }
interface EraseLearnerDataPayload { learnerId: string; domainId: string; }
type BinaryAnswer = { type: 'binary'; value: boolean };
type MultipleChoiceAnswer = { type: 'multiple-choice'; index: number };
interface StartSessionResult { sessionId: string; state: 'active' | 'completed' | 'abandoned'; plan: SessionPlan; persistedRevision: number; }
```

`commandType` est fermé : `session.start`, `item.answer`, `item.skip`, `session.abandon`, `learner.erase`. `contractVersion` doit être `1`. `commandDigest` est `lowercaseHex(SHA-256(JCS({commandType, contractVersion, payload})))`, calculé avec le payload brut avant toute notation ou expurgation. Un retry avec le même `(commandId, commandDigest)` retourne exactement le résultat engagé ; un même `commandId` avec une autre empreinte produit `IdempotencyConflictError`.

```ts
interface ElicitConfig {
  domain: Domain; learnerId: string; storage: StoragePort; idGenerator: IdGeneratorPort;
  clock: ClockPort; rng: SeededRngPort;
}

`ElicitConfig` est fermé : aucune clé supplémentaire n’est acceptée. `clock` et `rng` sont les seules dépendances injectables du profil MVP ; ils sont obligatoires car le core n’accède à aucun état global. Les implémentations de maîtrise, de scheduler et de confidentialité sont celles du MVP et ne peuvent pas être remplacées.
interface ElicitEngine {
  ready(): Promise<void>;
  recommend(): Recommendation | null;
  startSession(command: CommandEnvelope<StartSessionPayload>): Promise<StartSessionResult>;
  resumeSession(sessionId: string): Promise<Session | null>;
  getState(): Readonly<LearnerState>;
  getProgress(): ProgressSnapshot;
  exportLearnerData(): Promise<LearnerExport>;
  eraseLearnerData(command: CommandEnvelope<EraseLearnerDataPayload>): Promise<void>;
  close(): Promise<void>;
}
```

Le profil MVP expose uniquement ces ports. `masteryModel`, `scheduler` et `privacy` ne sont pas configurables. Le moteur utilise obligatoirement `masteryModel = bkt-mvp-1`, `scheduler = discrete-mvp-1`, `rawAnswers = discard`. Toute tentative de fournir une implémentation alternative produit `ValidationError`. Les interfaces suivantes sont définies uniquement par le contrat post-MVP, ne sont pas exportées par le profil MVP et ne sont jamais acceptées par `ElicitConfig` :

```ts
interface MasteryModelPort { readonly version: string; }
interface SchedulerPort { readonly version: string; }
interface PrivacyPort { readonly version: string; }
```

Leurs signatures opérationnelles et implémentations appartiennent à une version post-MVP ; leur présence dans un module séparé n’autorise aucune injection dans le MVP.

```ts
interface PresentedItem { itemId: string; skillId: string; exercise: { type: 'binary'; prompt: LocalizedText } | { type: 'multiple-choice'; prompt: LocalizedText; options: LocalizedText[] }; difficulty: number; formatTier: 1 | 2 | 3; }
interface Recommendation { itemId: string; skillId: string; reason: 'due-review' | 'weak-skill' | 'new-skill' | 'prerequisite-frontier'; selectorVersion: 'mvp-1'; }
interface ProgressSnapshot { completed: number; total: number; mastered: number; }
interface SessionSummary { sessionId: string; answered: number; correct: number; skipped: number; }
interface Session { readonly id: string; readonly state: 'active' | 'completed' | 'abandoned'; current(): PresentedItem | null; answer(command: CommandEnvelope<AnswerPayload>): Promise<AnswerOutcome>; skip(command: CommandEnvelope<SkipPayload>): Promise<AnswerOutcome>; abandon(command: CommandEnvelope<AbandonPayload>): Promise<void>; progress(): { index: number; total: number }; }
```

`recommend()` retourne `null` sans exception et sans mutation lorsqu’il n’y a aucun candidat admissible. Un agrégat ne possède qu’une session `active`; toute nouvelle création pendant une session active donne `ConcurrencyError`, sauf retry idempotent de la même commande. `resumeSession(sessionId)` exige toujours l’argument : il retourne `null` si la session est absente ou terminée, et `TombstonedError` si l’agrégat est tombstoné.

Le seed MVP est `rngSeed = lowercaseHex(SHA-256(JCS({aggregateId, domainDigest, selectorVersion})))`, avec les clés dans l’ordre canonique JCS. `recommend()` et la première sélection de `session.start` utilisent exactement ce seed ; `session.start` le persiste dans `SessionPlan`. Il n’existe aucune autre source de hasard.

Les réponses sont fermées et sans coercion : `binary` exige exactement `{type, value:boolean}` ; QCM exactement `{type, index: integer}` dans les bornes. Le cas `step = 0` est explicite : `correct` donne `step = 1`, échéance à `nowUtc + 86_400 secondes`, lapses inchangé ; `incorrect` donne `step = 1`, échéance à `nowUtc + 86_400 secondes`, lapses +1.

## 7. Persistance, idempotence, tombstone et reprise

### 7.1 StoragePort et cycle de vie

```ts
interface AggregateTombstone {
  commandId: string; commandDigest: string; commandType: 'learner.erase';
  erasedAt: string; erasedEpoch: number;
}
interface StoredCommand { commandId: string; commandType: string; contractVersion: 1; commandDigest: string; result: JsonValue; committedRevision: number; committedEpoch: number; }
interface LoadedAggregate {
  state: LearnerState | null; revision: number; aggregateEpoch: number;
  tombstone: AggregateTombstone | null; sessions: PersistedSession[];
  commandResults: Record<string, StoredCommand>;
}
interface StorageCommitCommand { commandId: string; commandType: string; contractVersion: 1; commandDigest: string; }
interface StoragePort {
  readonly guarantees: { atomicCommit: true; durableCommit: boolean; tombstoneOnErase: true; eraseManagedData: true };
  loadAggregate(learnerId: string, domainId: string): Promise<LoadedAggregate>;
  commit(input: { learnerId: string; domainId: string; expectedRevision: number; expectedAggregateEpoch: number; command: StorageCommitCommand; state: LearnerState; sessions: PersistedSession[]; events: DomainEvent[]; result: JsonValue }): Promise<{ revision: number; aggregateEpoch: number; result: JsonValue }>;
  exportLearnerData(learnerId: string, domainId: string): Promise<LearnerExport>;
  eraseLearnerData(input: { learnerId: string; domainId: string; expectedRevision: number; expectedAggregateEpoch: number; command: StorageCommitCommand; tombstone: AggregateTombstone }): Promise<void>;
}
```

Le payload brut n’est jamais transmis à `StoragePort.commit`. Il reste en mémoire volatile pendant validation et notation, puis est détruit avant l’appel. Il ne peut apparaître dans `state`, `sessions`, `events`, `result`, `StoredCommand`, logs, erreurs ou métriques. Le digest a été calculé avant expurgation et sert uniquement à l’idempotence.

`commit` exécute logiquement, dans une transaction atomique : (1) rechercher `commandId`; (2) même digest, retourner le résultat exact sans CAS/epoch/révision ni nouveau calcul ; (3) digest différent, `IdempotencyConflictError`; (4) absence de tombstone ; (5) CAS d’epoch : égalité d’`aggregateEpoch` ; (6) CAS de révision : égalité de `expectedRevision` ; (7) versions et digest de contenu ; (8) écrire snapshot, sessions, événements, commande et nouvelle révision ; (9) retourner après commit. Toute différence d’epoch ou révision donne `ConcurrencyError` sans état partiel.

Valeurs initiales : `initialRevision = 0`, `initialAggregateEpoch = 0`, `currentContractVersion = 1`, `currentSchemaVersion = 1`, `initialEventSequence = 0`. Le premier commit accepté crée l’état initial et `learner.created`, produit `revision = 1` et attribue `sequence = 1`; les commits suivants attribuent chaque séquence en l’incrémentant de un. Une version de contrat ou de schéma différente est rejetée avant mutation. Lors d’un effacement accepté, `erasedEpoch = expectedAggregateEpoch + 1`; cette valeur est conservée dans le tombstone et aucune opération ultérieure ne peut l’utiliser pour recréer ou réouvrir l’agrégat.

L’effacement est terminal. Il attend les mutations locales acceptées, interdit les nouvelles mutations, puis applique exactement : (1) recherche de déduplication, (2) rejet d’un digest différent, (3) CAS d’`aggregateEpoch`, (4) CAS de `revision`, (5) écriture atomique du tombstone et purge. Il supprime atomiquement snapshot, sessions, observations, événements, caches, index, commandes en attente, engagées, dédupliquées ou liées à une session terminée, ainsi que tous les `StoredCommand` et leurs résultats. Il construit et écrit `learner.erased` dans la transaction, puis supprime toutes les données d’événements avec l’agrégat avant le commit observable. Le tombstone conserve uniquement `commandId`, `commandDigest`, `commandType`, `erasedAt`, `erasedEpoch`.

Après tombstone, tout commit, retry, reprise, nouvelle session et export est rejeté par `TombstonedError`, sauf la vérification spéciale du couple `commandId`/`commandDigest` conservé dans le tombstone pour `learner.erase`. Tout ancien `commandId`, digest, snapshot, événement, résultat ou session est inutilisable. Seul le retry exact de `learner.erase` avec le même `commandId` et digest peut être accepté, et il retourne le résultat vide (`void`) sans réintroduire aucune donnée. Aucune recréation avec la même identité n’est autorisée dans le MVP. Une recréation éventuelle exige une future version avec commande dédiée, nouvelle identité d’agrégat et règles d’epoch explicites.

Les sessions `completed` et `abandoned` sont conservées jusqu’à `learner.erase`; aucune purge temporelle automatique n’est définie. `exportLearnerData` rejette après tombstone et ne retourne ni état, session, commande, événement ni tombstone.

### 7.2 Session, événements et reprise

```ts
interface SessionPlan {
  sessionId: string; domainId: string; contentVersion: string; domainDigest: string;
  items: Array<{ itemId: string; skillId: string; reason: 'due-review' | 'weak-skill' | 'new-skill' | 'prerequisite-frontier'; contentVersion: string }>;
  selectorVersion: 'mvp-1'; schedulerVersion: 'discrete-mvp-1'; rngSeed: string;
  diagnostic: SelectionDiagnostic; planDigest: string;
}
interface PersistedSession { id: string; state: 'active' | 'completed' | 'abandoned'; plan: SessionPlan; cursor: number; startedAt: string; completedAt?: string; updatedAt: string; }
interface EventEnvelope<T extends JsonValue = JsonValue> {
  eventId: string; aggregateId: string; aggregateType: 'learner' | 'session'; sequence: number;
  schemaVersion: 1; occurredAt: string; contentVersion: string; type: MvpEventType;
  payload: T; metadata: { commandId: string; correlationId: string; causationId: string | null };
}
type MvpEventType = 'learner.created' | 'session.started' | 'item.presented' | 'item.answered' | 'item.skipped' | 'session.completed' | 'session.abandoned' | 'learner.erased';
type DomainEvent = EventEnvelope<JsonValue>;
```

`aggregateId` est toujours l’identifiant canonique de l’agrégat learner `(learnerId, domainId)` ; `aggregateType = 'session'` désigne seulement l’objet logique à l’origine de l’événement et ne crée pas un second espace de séquence. `sequence` est un entier strictement croissant, sans trou observable, commençant à `1`, dans le scope de l’agrégat `(learnerId, domainId)`, tous types d’événements confondus. Il est attribué dans la même transaction que le snapshot. Une commande idempotente ne crée aucun événement. Aucun événement ne contient `BinaryAnswer`, `MultipleChoiceAnswer` ni réponse brute. `learner.erased` est construit et écrit dans la transaction d’effacement pour satisfaire le catalogue, puis l’ensemble des événements, y compris cet événement, est supprimé avant le commit observable ; il n’est donc jamais retourné ni exporté.

`session.start` persiste un `StartSessionResult` JSON fermé ; son `SelectionDiagnostic` est celui du `SessionPlan` et fait donc partie du résultat sérialisé. Un retry avec même `(commandId, commandDigest)` retourne exactement le même JSON, session, plan, seed, diagnostic et révision, sans nouveau calcul, événement, session ou incrément de révision.

La reprise utilise uniquement plan, `planDigest`, seed, versions et curseur persistés ; elle ne relance pas le sélecteur. Chaque item doit encore exister, avoir le même `skillId`, mode et `contentVersion`, sinon `ContentVersionMismatchError`.

## 8. Confidentialité, export et erreurs

Le profil MVP applique `rawAnswers = discard`, `persistLatency = false`, `analytics = disabled`, `exportIncludesRawAnswers = false`. Les données brutes existent seulement durant validation/notation volatile et sont détruites avant snapshot, session, événement, résultat, `StoredCommand`, erreur, log, métrique, export ou notification.

```ts
interface LearnerExport {
  schemaVersion: 1; learnerId: string; domainId: string; contentVersion: string; domainDigest: string;
  state: LearnerState; exportedAt: string; rawAnswers: [];
  sessions: Array<{ sessionId: string; state: 'active' | 'completed' | 'abandoned'; startedAt: string; completedAt?: string; planDigest: string }>;
}
```

```ts
type ElicitErrorCode = 'ValidationError' | 'StorageError' | 'ConcurrencyError' | 'EngineClosedError' | 'TombstonedError' | 'IdempotencyConflictError' | 'ContentVersionMismatchError';
interface ElicitError { code: ElicitErrorCode; message: string; }
```

## 9. Algorithmes MVP fixes

### 9.1 BKT

```text
masteryModel = bkt-mvp-1
pInit = 0.25, pLearn = 0.15, pSlip = 0.10, pGuess = 0.20, epsilon = 1e-12
pCorrect = clamp(p*(1-pSlip)+(1-p)*pGuess, epsilon, 1-epsilon)
correct: pPosterior = clamp(p*(1-pSlip)/pCorrect,0,1); pNext = clamp(pPosterior+(1-pPosterior)*pLearn,0,1)
pIncorrect = clamp(1-pCorrect,epsilon,1-epsilon)
incorrect: pPosterior = clamp(p*pSlip/pIncorrect,0,1); pNext = clamp(pPosterior+(1-pPosterior)*pLearn,0,1)
skipped: pNext = p
```

Double précision IEEE-754 ; valeurs persistées dans `[0,1]`. `difficulty`, `formatTier` et latence ne modifient jamais BKT. `skip` ne modifie ni `pKnown`, ni `attempts`, ni `correctAttempts`.

### 9.2 Sélection déterministe

Pour chaque position, `requestedSize` est entier dans `{5,6,7,8,9,10}` (défaut `5`). Un candidat est admissible si l’item est `learning`, si sa compétence existe et n’est pas `deprecated`, si sa version est exacte, s’il n’est pas déjà présent dans le plan, et si tous ses prérequis sont maîtrisés. Un item est dû si et seulement si `reviews[item.skillId]` existe et `reviews[item.skillId].dueAt <= nowUtc`; tous les items d’une compétence héritent de cette échéance.

Les raisons sont exclusives et évaluées dans cet ordre :

1. `due-review` : révision existante due et quota de révisions dues disponible ;
2. `prerequisite-frontier` : au moins un prérequis, tous maîtrisés, compétence courante non maîtrisée et `attempts = 0` ;
3. `new-skill` : `attempts = 0` et ne satisfait pas `prerequisite-frontier` ;
4. `weak-skill` : `attempts > 0`, `pKnown < targetMastery` et item non `due-review`.

`pSuccess = pKnown*(1-pSlip)+(1-pKnown)*pGuess`; `adaptationScore = abs(pSuccess-0.80)`; `desiredTier = 1 si pKnown<0.50, 2 si pKnown<0.80, 3 sinon`.

```text
waitingPriority = (presentedFlag, waitRank)
presentedFlag = 0 si lastPresentedAt = null, sinon 1
waitRank = 0 si lastPresentedAt = null
waitRank = -floor((nowUtc-lastPresentedAt)/1 seconde) sinon
```

Le tri est croissant sur `(duePriority, reasonPriority, adaptationScore, abs(formatTier-desiredTier), waitingPriority, rngRank, itemId)`, avec `duePriority = 0` uniquement pour `due-review` avec quota disponible et `reasonPriority = 0,1,2,3` dans l’ordre ci-dessus. Une date `lastPresentedAt` future est invalide. `rngRank` provient d’une permutation déterministe des IDs triés UTF-16 avec seed ; le tie-break est donc seedé et `itemId` final.

Le quota initial est `floor(requestedSize/2)` révisions dues. `non-repetition` interdit deux occurrences du même `itemId` dans le plan ; `control-distance` interdit deux items ayant le même `controlOf` non nul à une distance de positions inférieure à 3 ; `format-tier` interdit deux items consécutifs ayant le même `formatTier`. Les contraintes sont relâchées seulement dans cet ordre : `due-quota`, `non-repetition`, `control-distance`, `format-tier`. À chaque relâchement, la contrainte est ajoutée une fois ; les prédicats de raison et l’ordre des raisons restent inchangés. Aucun candidat donne un plan plus court et `insufficientItems = true`.

```ts
interface SelectionDiagnostic {
  selectorVersion: 'mvp-1';
  requestedSize: 5 | 6 | 7 | 8 | 9 | 10;
  availableCount: number;
  dueAvailableCount: number;
  dueQuota: number;
  selectedCount: number;
  selectedItemIds: string[];
  selectedByReason: Record<'due-review' | 'weak-skill' | 'new-skill' | 'prerequisite-frontier', number>;
  insufficientItems: boolean;
  fallbackApplied: boolean;
  relaxedConstraints: Array<'due-quota' | 'non-repetition' | 'control-distance' | 'format-tier'>;
}
```

`selectorVersion` vaut toujours `mvp-1` dans le profil MVP. `availableCount` est le nombre de candidats admissibles avant tout quota ou relâchement ; `dueAvailableCount` est le nombre de ces candidats classés `due-review` avant quota ; `dueQuota = floor(requestedSize / 2)` ; `selectedCount` est la longueur effective du plan ; `selectedItemIds` est la liste ordonnée des IDs du plan ; `selectedByReason` compte les items effectivement sélectionnés par raison et sa somme vaut `selectedCount`. `fallbackApplied` vaut `true` si et seulement si `relaxedConstraints` n’est pas vide. Tous ces compteurs sont des entiers dans `[0, maxInteger]`. `relaxedConstraints` est sans doublon et dans l’ordre de relâchement. `recommend()` applique exactement ce filtrage, ces prédicats, ce tri, ce fallback et la même `selectorVersion` à la première position de `startSession`; il ne persiste pas de seed et ne mute rien. Toute absence ou différence de `selectorVersion` produit `ContentVersionMismatchError` ou `ValidationError`. Toute évolution de l’algorithme exige une nouvelle `selectorVersion` et un nouveau `contractVersion`.

### 9.3 Scheduler discret

` scheduler = discrete-mvp-1`, `ReviewStep = 0|1|2|3|4|5`, `nowUtc` tronqué à la seconde. La table normative est :

| step | intervalDays(step) |
|---:|---:|
| 0 | 0 |
| 1 | 1 |
| 2 | 3 |
| 3 | 7 |
| 4 | 14 |
| 5 | 30 |

- `correct` : `newStep = min(step + 1, 5)` et `dueAt = nowUtc + intervalDays(newStep)` ;
- `incorrect` : `newStep = 1`, `dueAt = nowUtc + 86_400 secondes`, `lapses = lapses + 1` ;
- `skipped` : étape conservée, `dueAt = nowUtc`, lapses inchangé.

L’addition d’un intervalle est une addition de secondes UTC (jours de 86 400 secondes), jamais une addition de calendrier local. `nowUtc` et tous les `dueAt` sont tronqués à la seconde avant calcul.

Ces règles valent aussi pour `step = 0`; `skipped` ne modifie ni maîtrise ni compteurs. Le scheduler ne dépend ni de maîtrise, difficulté, format ni latence et n’est pas injectable dans le MVP.

## 10. Exercices, plugins et accessibilité

Le core reconnaît uniquement `binary` et `multiple-choice`; tout registre, plugin, callback, préférence, auto-évaluation ou type non intégré est refusé avant création par `ValidationError`.

```ts
interface CoreA11yContract {
  textPrompt: true; textOptions: true; deterministicItemOrder: true; deterministicPosition: true;
  noRequiredDrag: true; noRequiredTimeout: true; feedbackIsTextual: true;
}
```

`noColorOnlySemantics` est retiré : le core headless ne peut pas le vérifier. Couleur, contraste, focus, clavier, lecteurs d’écran et animations relèvent du contrat de l’adaptateur UI hôte.

## 11. Feedback et projections

```ts
type LearningGrade = { kind: 'correct'; score: 1 } | { kind: 'incorrect'; score: 0 } | { kind: 'skipped'; score: null };
interface Feedback { source: 'content' | 'neutral'; message: LocalizedText | null; explanation: LocalizedText | null; }
interface AnswerOutcome { grade: LearningGrade; feedback: Feedback; masteryDelta: number; next: PresentedItem | SessionSummary | null; persistedRevision: number; }
```

Les objets retournés sont des schémas fermés. Aucun objet ne contient de réponse brute. Le feedback est exclusivement déclaratif ou neutre constant. `skip` produit `skipped`, jamais `correct` ou `incorrect`.

## 12. IndexedDB et garanties

L’adaptateur IndexedDB définit `aggregateKey = learnerId + "\u0000" + domainId`; `learnerId` et `domainId` ne peuvent contenir `\u0000`. Aucun object store n’utilise `autoIncrement`. Toutes les transactions filtrent par `aggregateKey`.

```text
aggregate:   keyPath = aggregateKey
sessions:    keyPath = sessionKey; sessionKey = aggregateKey + "\u0000" + sessionId; index aggregateKey
commands:    keyPath = commandKey; commandKey = aggregateKey + "\u0000" + commandId; index aggregateKey
events:      keyPath = eventKey; eventKey = aggregateKey + "\u0000" + zeroPad(sequence, 10); index aggregateKey
`zeroPad(sequence, 10)` encode `sequence` en exactement 10 chiffres décimaux ASCII, avec zéros à gauche ; une séquence hors `[0, 9_999_999_999]` est rejetée (la limite MVP `maxInteger` est donc plus stricte).
tombstones:  keyPath = aggregateKey
```

Toutes les écritures d’un commit sont dans une transaction `readwrite` unique. Fermeture, abort et `QuotaExceededError` deviennent `StorageError`. Crash avant validation : ancien agrégat intact ; après validation : nouvel agrégat complet. L’adaptateur mémoire simule ces garanties mais `durableCommit: false` n’est autorisé que pour les tests.

## 13. Tests et critères d’acceptation

Tests obligatoires : JCS et digest hexadécimal unique ; limites hiérarchisées et maps métier ; versions initiales ; validation des modes et ports MVP ; réponses fermées ; compteurs et invariants ; vecteurs BKT ; table scheduler 0..5, y compris step 0 ; sélection, prédicats, raisons exclusives, quota, fallback, waitingPriority, seed, tie-break, diagnostic, `recommend` vide et `selectorVersion` ; session unique et `resumeSession` ; résultat `session.start` sérialisable et retryable ; ordre déduplication/CAS/epoch ; commit sans payload brut ; événements, catalogue et séquence ; concurrence, crash, tombstone terminal, retry erase et portée de purge ; sessions terminées ; export avant/après effacement ; IndexedDB et mémoire ; accessibilité headless ; absence de données brutes ; plugins et contrats post-MVP rejetés.

Critères mesurables :

1. Un domaine validé avec au moins cinq candidats produit un plan de cinq items ; sinon plan plus court et `insufficientItems = true`.
2. Une mutation valide n’est retournée qu’après commit réussi ; une mutation idempotente ne crée ni événement ni révision supplémentaire.
3. Un retry identique de `session.start` retourne exactement le même JSON, seed, diagnostic, plan et `persistedRevision`.
4. L’ordre déduplication, CAS d’epoch, puis CAS de révision est observable par les résultats d’erreur ; une course commit/erase ne ressuscite aucun snapshot.
5. Le premier commit est `revision = 1`, le premier événement `sequence = 1`, et les compteurs restent dans les invariants.
6. Une réponse brute n’apparaît dans aucun objet persistant, résultat, erreur, log, métrique ou export.
7. `correct` depuis step 0 donne step 1 à +86 400 secondes ; depuis step 1 donne step 2 à +259 200 secondes ; `incorrect` depuis tout step donne step 1 à +86 400 secondes et lapses +1 ; `skipped` fixe dueAt à nowUtc.
8. `recommend()` retourne `null` sans mutation sans candidat et produit la même première sélection que `startSession`.
9. Une seule session active est possible ; `resumeSession` exige un ID et retourne `null` pour une session terminée.
10. Après erase, tout ancien accès est rejeté par `TombstonedError`, sauf retry exact de l’effacement ; aucune recréation identitaire n’est possible.
11. Les sessions terminées sont exportables avant erase, puis l’export est rejeté ; le tombstone interne n’est jamais exporté.
12. Les clés IndexedDB et transactions garantissent l’isolation par `aggregateKey` sans auto-incrément.
13. Les ports `masteryModel`, `scheduler`, `privacy`, preferences et plugins sont refusés dans le profil MVP.
14. Le core satisfait exactement `CoreA11yContract`; les garanties couleur/UI/WCAG sont testées dans l’adaptateur hôte.

## 14. Roadmap et décisions reportées

Lot 2 ajoute les exercices de préférence, `likert`, `slider`, auto-évaluation et contrats UI dans un profil post-MVP versionné et séparé. Lot 3 pourra ajouter plugins isolés, SM-2/FSRS, placement, analytics expurgées, multi-appareils, chiffrement et gamification. Ces extensions ne peuvent pas être activées par configuration dans le profil MVP.

La synchronisation distante, fusion, chiffrement, migration destructive, rotation de clés, format d’export interopérable, modèles de maîtrise autres que BKT, réponses brutes, plugins, garanties WCAG et recréation après tombstone restent hors contrat. Toute évolution de canonicalisation, digest, scheduler, sélecteur, événements, versions ou cycle de vie exige un nouveau `contractVersion` et un profil versionné.
