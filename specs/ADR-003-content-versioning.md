# ADR-003 — Version de contenu, sessions et rollback

**Statut :** accepté · **Date :** 2026-07-18 · **Version :** 2

## Décision

L'identité runtime est la paire `(contentVersion,domainDigest)`. `semanticDomainDigest` prouve l'équivalence de contenu métier en ignorant les champs de version, mais ne remplace jamais la paire runtime. L'état, les sessions, plans et événements portent la paire et refusent toute divergence.

MVP1 ne définit aucune migration de `LearnerState`. Une nouvelle version est utilisée soit avec un agrégat neuf, soit après abandon explicite de la session ; aucun snapshot, plan ou événement historique n'est réécrit. Les skills supprimés restent historiques/inertes uniquement ; aucune insertion silencieuse de skill nouveau dans un état existant.

Les sessions actives terminent avec leur package épinglé ou sont abandonnées explicitement. La publication ne pousse rien au runtime.

Un rollback est un roll-forward : nouveau SemVer jamais utilisé, candidat revu et publié comme nouvelle proposition, nouveau `domainDigest` et `packageDigest`, même `semanticDomainDigest` que la cible, `rollbackOf` exact. Il ne contourne ni revue humaine ni publication admin.

## Conséquences

`validatePackage` et `validateEvolution` sont séparées ; la seconde exige un package source complet résolu explicitement. Le registre reste immuable et les états historiques restent segmentables par version/digest. Toute future migration d'état exige un contrat et une version dédiés.
