# SPEC-REVIEW-PUBLISHING — Revue MVP2

**Version document :** `2.0.0` · **reviewContractVersion :** `2` · **Statut :** normatif

La source unique des contrats communs est [CONTRACTS-EDITORIAL.md](CONTRACTS-EDITORIAL.md). Review ne publie jamais et ne dépend d'aucun runtime.

## 1. États et transitions

```text
draft → proposed → in-review → approved → published
                         └────→ rejected
proposed ────────────────→ rejected
draft|proposed|in-review|approved → stale
stale ──rebase/resubmit──→ proposed
```

`rejected` et `published` sont terminaux. `stale` est persistant avec raison, digest observé et timestamp ; ce n'est pas un alias de `proposed`. Toute transition est append-only et CAS. `approved` est revalidé contre la base au moment de publish ; une divergence matérialise `stale`, jamais une publication.

## 2. Validation et checklist

À la création et à l'approbation : `validatePackage(candidate)`, résolution explicite et validation de `sourcePackage`, puis `validateEvolution(candidate,source)`. Aucun source absent/introuvable n'est interprété comme une évolution valide. Une checklist persistée et complète couvre validation intrinsèque, évolution/bump, pédagogie, impact runtime, provenance, sûreté, rollback et base courante. Rebase ou changement de digest invalide la checklist.

Un reviewer humain distinct de l'auteur approuve ; un outil peut créer/soumettre mais ne peut jamais prendre en revue, approuver, rejeter ou publier. `advisory` est structurellement non publiable. Les capacités effectives sont vérifiées et tout refus est audité.

## 3. API

```ts
interface ReviewPort {
 create(input:CreateProposalCommand):Promise<ChangeProposal>;
 submit(id:string,actor:AuthenticatedActor):Promise<ChangeProposal>;
 startReview(id:string,actor:AuthenticatedActor):Promise<ChangeProposal>;
 approve(id:string,actor:AuthenticatedActor,checklist:ReviewChecklist):Promise<ChangeProposal>;
 reject(id:string,actor:AuthenticatedActor,reason:string):Promise<ChangeProposal>;
 rebase(id:string,actor:AuthenticatedActor,newBase:PackageRef):Promise<ChangeProposal>;
 list(filter:{status?:ProposalStatus;packageId?:string}):Promise<ChangeProposal[]>;
}
```

Chaque mutation utilise `EditorialUnitOfWork` : transition, checklist, idempotence et audit sont une unité atomique. `publish()` n'existe pas dans ce module.

## 4. Tests

Matrice complète des transitions et capabilities, stale entre approbation/publication, revalidation source/candidat, checklist immuable, auto-approbation, idempotence/concurrence, advisory non publiable, rollback soumis à revue et absence de publication autonome.
