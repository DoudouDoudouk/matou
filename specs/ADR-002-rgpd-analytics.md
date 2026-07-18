# ADR-002 — Analytics, consentement et RGPD

**Statut :** accepté · **Date :** 2026-07-18 · **Version :** 2 · **Portée :** MVP2

## Décision

Deux zones sont séparées : observations individuelles pseudonymisées (données personnelles, consentement/capability, droits et rétention) et agrégats admissibles (sans pseudonyme, seuil `K_MIN=10`, cellules rares/différentiables supprimées). `chosenIndex` individuel est interdit ; `choiceCounts` reste personnel en ingestion et ne sort jamais individuellement.

Consentement = registre versionné grant/revoke avec historique, preuve de politique et idempotence. Ingestion et révocation sont linéarisées par pseudonyme. Les observations possèdent `observationId`, digest, `sourceEventId`, `ingestedAt`, `pseudonymKeyVersion`. Les fenêtres sont fixes de 28 jours UTC et versionnées ; les arrivées tardives créent une révision d'agrégat.

Révocation/erase : bloque immédiatement, crée une outbox durable chiffrée au repos, retry avec clé d'idempotence, `404` succès, dead-letter après plafond. Les observations dérivées/agrégats/findings affectés sont invalidés et recalculés ou retirés ; aucune promesse de maintien d'un agrégat dont la base a été effacée. Aucun effacement forensique n'est promis.

Rétention : observations 90 jours après `ingestedAt`, consentement durée + 12 mois, outbox/audit 24 mois minimum. Rotation de clé : `pseudonymKeyVersion` obligatoire, anciennes clés lecture/effacement pendant transition, destruction rend les résidus non corrélables mais ne remplace pas l'effacement lorsque la clé existe.

## Conséquences

Les API analytics exigent des capabilities séparées (`ingest`, `aggregate`, `query`, `consent`, `erase`, `outbox`, `key.rotate`). Les rôles ne sont pas une autorisation runtime. Toute modification de seuil, fenêtre, formule ou politique exige un bump d'`analyticsContractVersion` et de cet ADR. Les garanties sont conditionnelles à un stockage transactionnel et à l'outbox effectivement durable ; aucune implémentation non transactionnelle ne peut se déclarer conforme.
