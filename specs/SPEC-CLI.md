# SPEC-CLI — Adaptateur CLI MVP1

**Version document :** `2.0.0` · **cliContractVersion :** `2` · **Statut :** normatif

JSON stdout exclusivement, diagnostics stderr, aucun réseau. Enveloppe de toute sortie : `{cliContractVersion:2,command:string,ok:boolean,result:null|JsonValue,error:null|{code,path,message}}`; schéma fermé. Codes : 0 succès, 1 erreur métier/assertion, 2 usage, 3 interne.

## Commandes

- `validate file` : `validatePackage` intrinsèque.
- `validate evolve candidate-file --source source-file` : `validatePackage` puis `validateEvolution`; `--source` est obligatoire et jamais recherché implicitement.
- `digest file --kind domain|semantic-domain|package|plan|command`.
- `diff source candidate` : `diffContentPackages` et requiredBump.
- `run scenario [--state file] [--out file] [--events]`.
- `export --state file`.
- `vectors jcs|digests|rng|bkt|scheduler|selection|events|storage|cli`.

## Scénario fermé

```ts
interface CliScenario { cliContractVersion:2; package:string; learnerId:string; clock:{start:string}; seedOverride:string|null; steps:CliStep[]; }
```

`seedOverride` est exclusivement CLI, non transmis à `ElicitConfig` ou au core. `null` utilise le seed contractuel ; une chaîne non vide est utilisée telle quelle comme seed, sans trim/coercion, sous `maxStringLength`. Il est persisté dans l'enveloppe runtime externe :

```ts
interface CliRuntimeStateV2 { cliContractVersion:2; aggregate:LoadedAggregate; seedOverride:string|null; seedUsed:string; }
```

Une reprise ne recalcule jamais un plan ; un override différent de celui enregistré est rejeté avant exécution, un identique est accepté. `clockNow` n'est jamais réutilisé comme horloge métier.

`--events` émet uniquement les événements engagés, fermés et expurgés ; aucune réponse brute, `chosenIndex`, `latencyMs` ou payload libre. Les étapes `answer` peuvent recevoir une réponse en mémoire, détruite avant commit.

## Vecteurs et CI

Les fichiers de vecteurs attendus sous `vectors/mvp1/` sont fermés `{vectorVersion:1,kind:string,vectors:[{input,expected}]}` ; ce répertoire relève de l'artefact d'implémentation, pas de ce dépôt documentaire. La CI exécute deux fois chaque scénario et compare état, snapshots, résultats, événements et exports octet pour octet ; tout drift exige un bump. Les sorties de digest et d'erreur sont stables.
