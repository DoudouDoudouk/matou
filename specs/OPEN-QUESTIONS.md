# OPEN-QUESTIONS — Décisions non bloquantes

Les contrats normatifs ne dépendent d'aucune entrée ci-dessous. Toute recommandation est informative et ne peut pas remplacer une décision obligatoire déjà publiée.

## Q1 — Authentification de l'hôte

Le mécanisme d'authentification OIDC, proxy ou compte OS reste hors contrat ; l'hôte fournit un acteur authentifié. Une future décision pourra préciser une intégration multi-organisation.

## Q2 — Stockage concret MVP2

SQLite est la recommandation opérationnelle pour un opérateur unique, mais les ports transactionnels restent indépendants du moteur. Le choix peut évoluer sans modifier les contrats.

## Q3 — Politique de retard analytics

Le contrat fixe déjà les fenêtres et les révisions d'agrégats. La durée opérationnelle de conservation des fenêtres révisables et le calendrier de batch restent à choisir par l'opérateur, sans changer `windowId` ni la formule.

## Q4 — Paramètres UI multilingues

Le core impose la forme `LocalizedText` et laisse le fallback d'affichage à l'hôte. La sélection visuelle de locale et les messages manquants restent une décision d'adaptateur UI.

## Q5 — Fournisseur LLM post-MVP

Le fournisseur, s'il existe, est un choix d'exploitation. Le contrat interdit déjà l'envoi de données apprenant et toute publication autonome.
