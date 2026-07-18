# SPEC-ADMIN — Publication, rollback et audit MVP2

**Version document :** `2.0.0` · **adminContractVersion :** `2` · **Statut :** normatif

## 1. Autorisation

Les acteurs authentifiés et capabilities viennent de [CONTRACTS-EDITORIAL.md](CONTRACTS-EDITORIAL.md). Seul un humain admin peut publier, retirer ou demander/valider un rollback. Les outils ne peuvent ni review ni admin. Toute décision et tout refus sont audités.

## 2. Registre

```ts
interface PackageRegistry {
 publish(input:{proposalId:string;actor:AuthenticatedActor}):Promise<RegistryEntry>;
 current(packageId:string):Promise<RegistryEntry|null>;
 history(packageId:string):Promise<RegistryEntry[]>;
 get(packageId:string,version:string):Promise<{entry:RegistryEntry;package:ContentPackage}|null>;
 withdraw(input:{packageId:string;version:string;actor:AuthenticatedActor;reason:string}):Promise<RegistryEntry>;
 requestRollback(input:{packageId:string;toVersion:string;actor:AuthenticatedActor;reason:string}):Promise<ChangeProposal>;
}
```

Un `(packageId,version)` est publié une fois ; une seule entrée courante existe. `sourceProposalId` est obligatoire, y compris pour `importInitial`. Une publication ne modifie aucun package historique.

## 3. Import initial et publication

`importInitial` crée une proposition `kind='initial'`, `basePackage=null`, passe validation intrinsèque, checklist, revue et approbation. Il ne publie jamais directement.

`publish` dans une unité `EditorialUnitOfWork` : vérifier capability/admin humain, proposition `approved`, checklist, candidat et source complets, `validatePackage`, `validateEvolution`, digests, base courante inchangée ; alors écrire entrée, superseder l'ancienne, passer proposition à `published` et append audit. Toute divergence produit `stale`/`VersionConflictError`, sans écriture partielle.

## 4. Rollback et retrait

`requestRollback` crée un candidat roll-forward avec nouveau SemVer, nouveau `packageDigest` et `domainDigest`, même `semanticDomainDigest` que la cible, `rollbackOf` renseigné. Il passe le workflow review puis publication admin ; aucune écriture directe du registre.

`withdraw` exige raison et admin humain, marque la version `withdrawn` dans une transaction auditée. Si elle était courante, `current()` devient null ; l'hôte doit disposer d'une copie locale explicitement marquée non-courante et ne doit pas servir automatiquement une autre version. Un rollback de remplacement suit ensuite la revue.

## 5. Audit et concurrence

`AuditRecord` est le type partagé défini dans [CONTRACTS-EDITORIAL.md](CONTRACTS-EDITORIAL.md).

Audit append-only, détail fermé par action, sans apprenant. Publication, rollback, retrait, changement de rôle et refus sont atomiques avec l'action. Le registre utilise CAS sur digest courant et idempotence `(commandId,commandDigest)` ; deux publications concurrentes ne peuvent produire deux courantes.

## 6. APIs analytics et tests

Les rôles ne donnent pas automatiquement accès aux observations : une capability `analytics.query` est requise, et seules les agrégats admissibles sont retournés. Tester import initial, publication stale, rollback via revue, digest sémantique distinct du package digest, retrait courant, concurrence, audit, idempotence et refus des outils.
