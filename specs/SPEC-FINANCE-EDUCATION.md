# SPEC-FINANCE-EDUCATION — Produit éducatif finance personnelle (module finance)

**Version document :** `1.0.0` · **financeContractVersion :** `1` · **Statut :** normatif (module finance, MVP-F)

Ce document définit le produit « Matou Finance » : une application éducative inspirée de Duolingo pour apprendre la finance personnelle et la gestion de budget. Il s'appuie sur le core Elicit sans le modifier : les règles runtime restent celles de [SPEC.md](SPEC.md), [SPEC-SCHEMAS.md](SPEC-SCHEMAS.md) et [SPEC-STORAGE.md](SPEC-STORAGE.md). Ce document n'y redéfinit rien ; il ajoute une couche produit (thèmes, niveaux, progression, trophées, offres) et des packs de contenu.

## 1. Vision et périmètre

- Produit éducatif de micro-apprentissage : sessions courtes, questions fermées, feedback immédiat, progression par niveaux et thèmes, trophées.
- Premier pays cible : la France, via un **pack de contenu France versionné** (voir [SPEC-THEMES-LEVELS.md](SPEC-THEMES-LEVELS.md)). Le core et la couche produit restent agnostiques au pays ; aucune règle française n'est codée en dur.
- Volume cible MVP : milliers d'apprenants.
- Métrique principale du produit : la **qualité des réponses élicitées** (voir [SPEC-FINANCE-ANALYTICS.md](SPEC-FINANCE-ANALYTICS.md)).
- Moteurs LLM : externes d'abord, locaux ensuite ; exclusivement hors runtime pédagogique (pipeline offline, voir [SPEC-FINANCE-IMPROVEMENT.md](SPEC-FINANCE-IMPROVEMENT.md)).

### Répartition modulaire

| Couche | Contenu | Documents |
|---|---|---|
| Core générique | runtime déterministe, schémas, storage, contenu | SPEC.md, SPEC-SCHEMAS.md, SPEC-CONTENT.md, SPEC-STORAGE.md |
| Module finance (générique) | thèmes, niveaux, progression, profil, trophées, offres, analytics finance | ce document + SPEC-PROFILE.md, SPEC-THEMES-LEVELS.md, SPEC-TROPHIES-OFFERS.md, SPEC-FINANCE-ANALYTICS.md |
| Packs de contenu | contenu France versionné (thèmes, niveaux, questions, textes) | SPEC-THEMES-LEVELS.md §5 |
| Admin | validation, publication, configuration des offres | SPEC-ADMIN.md + SPEC-TROPHIES-OFFERS.md §5 |
| Improvement | détection de faiblesses, propositions | SPEC-IMPROVEMENT.md + SPEC-FINANCE-IMPROVEMENT.md |

## 2. Limites éducatives et légales (normatives)

1. **Aucune recommandation financière, d'investissement ou fiscale personnalisée.** Le produit enseigne des concepts ; il ne conseille jamais un produit, un portefeuille, une allocation, une optimisation fiscale ou une décision individuelle. Le profil apprenant adapte **l'apprentissage** (choix des questions, rythme, exemples), jamais des décisions financières.
2. **Impôts (France)** : concepts généraux uniquement au MVP (assiette, barème progressif comme concept, TVA comme concept, prélèvement à la source comme mécanisme). Aucun calcul fiscal officiel, aucun simulateur. Toute future règle annuelle (barèmes, plafonds) doit être livrée comme **pack sourcé et versionné** avec source officielle citée et date de validité — post-MVP.
3. **Investissement** : enseigner les concepts (risque/rendement, diversification, horizon, frais, inflation) et la notion de risque ; ne jamais recommander de produit, d'émetteur ou de portefeuille.
4. **Seules « recommandations » autorisées** : des offres partenaires sponsorisées, opt-in, clairement étiquetées « sponsorisé », présentées comme un privilège gagné après un trophée, sans incitation trompeuse ni urgence artificielle (voir [SPEC-TROPHIES-OFFERS.md](SPEC-TROPHIES-OFFERS.md)).
5. **Avertissement obligatoire** : chaque écran de thème « investissement » et « impôts » affiche un disclaimer éducatif fourni par le pack (contenu localisé). Le texte exact appartient au pack, l'obligation d'affichage appartient à la couche produit.
6. Données : minimisation, consentement, tranches plutôt que valeurs exactes — voir [SPEC-PROFILE.md](SPEC-PROFILE.md).

## 3. Persona et parcours utilisateur

Persona MVP : adulte francophone en France, sans formation financière, qui veut comprendre et gérer son budget. Usage mobile-first, sessions de 2 à 5 minutes.

Parcours nominal :

```text
1. Création de compte (identité hors contrat, LearnerId opaque)
2. Onboarding déterministe (questions fixes, §4)
3. Consentements (profil, analytics — distincts, révocables)
4. Accueil : 4 thèmes (budget, revenu, impôts, investissement)
5. Premier accès à un thème → phase de découverte du thème (§5)
6. Niveaux du thème, 5 questions par niveau, validation à 4/5 (80 %)
7. Tous les niveaux d'un thème terminés → trophée
8. Après trophée : offres partenaires opt-in éventuelles (privilège, jamais bloquant)
9. Révision périodique (répétition espacée du core)
```

## 4. Onboarding déterministe

L'onboarding est une séquence **fixe, ordonnée et versionnée** de questions déterministes, définie par le pack actif (`onboardingSet`, voir SPEC-THEMES-LEVELS §3). Propriétés normatives :

- Les questions sont fermées (binaire ou QCM) et **non notées** : aucune réponse n'est « correcte », aucun impact sur la progression.
- Les réponses alimentent exclusivement le profil apprenant selon les règles de [SPEC-PROFILE.md](SPEC-PROFILE.md) (tranches, provenance `onboarding`).
- Chaque question est sautable ; un saut est enregistré comme `undisclosed` dans le profil.
- L'ordre et le contenu sont identiques pour tous les apprenants d'une même version de pack ; deux exécutions sont identiques (déterminisme).
- L'onboarding est terminé quand toutes les questions ont reçu une réponse ou un saut ; l'état `onboardingCompleted` est persistant et idempotent.
- MVP : 5 à 8 questions maximum (situation générale, familiale, tolérance au risque déclarative, préférences d'apprentissage).

## 5. Thèmes et découverte par thème

Quatre thèmes initiaux, fournis par le pack France : `budget`, `revenu`, `impots`, `investissement`. Le modèle Theme/Level est spécifié dans [SPEC-THEMES-LEVELS.md](SPEC-THEMES-LEVELS.md).

**Découverte de thème (obligatoire)** : lorsqu'un apprenant aborde un thème pour la première fois, une phase de questions déterministes de découverte du profil est présentée avant le niveau 1 :

- Questions fermées, fixes par version de pack, non notées, sautables (→ `undisclosed`).
- Elles alimentent la section thématique du profil (provenance `theme-discovery:<themeId>`).
- La découverte est un prérequis dur du niveau 1 du thème : `discoveryCompleted(themeId)` doit être vrai. Elle n'est jamais représentée pour ce thème sur la même version de pack.
- Exemple (thème budget, pack France) : « Suivez-vous déjà vos dépenses ? », « Votre logement est-il loué ou possédé ? » (tranches/catégories, jamais montants exacts).

## 6. Niveaux et règles de progression

Règles normatives (détails de modèle dans SPEC-THEMES-LEVELS) :

- Un niveau contient **exactement 5 questions**.
- Un niveau est **validé à 4/5 correctes ou plus (≥ 80 %)** sur une même tentative.
- Une question sautée compte comme incorrecte pour le score de la tentative.
- Nombre de niveaux par thème et par profil : **minimum 3, maximum 10** (le pack définit l'univers des niveaux ; la personnalisation §7 sélectionne le sous-ensemble, dans ces bornes).
- Les niveaux d'un thème sont ordonnés ; le niveau N+1 exige la validation du niveau N. Les prérequis inter-thèmes sont possibles et déclarés par le pack.
- Échec (< 4/5) : le niveau reste rejouable immédiatement, sans pénalité de progression ; une nouvelle tentative est une nouvelle session (mêmes 5 questions, ordre de présentation re-mélangé par le RNG seedé du core).
- Reprise : une session interrompue reprend à son curseur (règles de reprise du core, plan épinglé, digest vérifié).
- **Le passage de niveau est purement déterministe et testable** : il ne dépend que des grades des 5 réponses de la tentative. La latence n'entre jamais dans la notation ni la progression.
- Feedback : chaque réponse peut afficher un feedback déclaratif (`DeclarativeFeedback` du core) ; le feedback n'altère pas le score.

Exemple canonique (pack France) : thème `revenu`, niveau « Répartir son revenu — la règle 50-30-20 ». Le 50-30-20 y est enseigné **comme une heuristique répandue parmi d'autres**, jamais comme vérité universelle ni comme recommandation personnelle ; le pack peut le remplacer ou le compléter sans changement de la couche produit.

## 7. Personnalisation

La personnalisation est **déterministe, versionnée et bornée** :

- Entrées autorisées : profil (tranches et catégories consenties), réponses de découverte de thème, historique de progression. Jamais la latence, jamais de sortie LLM au runtime.
- Sorties autorisées : sélection du sous-ensemble de niveaux (3–10) et de leur ordre parmi les niveaux offerts par le pack ; choix de variantes de niveau prévues par le pack (`audience`, SPEC-THEMES-LEVELS §4). La fonction de sélection porte un `personalizationVersion` ; à profil, pack et version identiques, la sortie est identique.
- Interdits : modifier le contenu d'une question, la clé de réponse, le seuil 4/5, ou générer du contenu au runtime.
- La personnalisation adapte l'apprentissage, jamais des décisions financières (§2.1).

## 8. Répétition et révision

La répétition espacée est celle du core (`discrete-mvp-1`, BKT `bkt-mvp-1` — SPEC.md §6), inchangée. La couche produit expose des **sessions de révision** distinctes des niveaux : items dus sélectionnés par le sélecteur core, sans effet sur la validation des niveaux ni sur les trophées. La révision est facultative et jamais bloquante au MVP.

## 9. Trophées et offres

- Un **trophée** est décerné quand tous les niveaux (du sous-ensemble personnalisé) d'un thème sont validés. Attribution déterministe, idempotente, datée.
- Après un trophée, des offres partenaires **configurées par un administrateur** peuvent être présentées, opt-in, mises en évidence comme récompense/privilège gagné, sans incitation trompeuse et avec disclosure « sponsorisé ». Spécification complète : [SPEC-TROPHIES-OFFERS.md](SPEC-TROPHIES-OFFERS.md).

## 10. MVP-F vs post-MVP

| MVP-F | Post-MVP |
|---|---|
| 4 thèmes, pack France v1, questions fermées binaire/QCM | nouveaux pays/packs, formats ouverts |
| onboarding + découverte déterministes | onboarding adaptatif |
| personnalisation par règles versionnées | personnalisation assistée par pipeline offline |
| trophée par thème, offres opt-in post-trophée | séries (streaks), ligues, badges secondaires |
| impôts : concepts généraux | packs annuels sourcés (barèmes) |
| analytics agrégées k-anonymes | tableaux de bord avancés |
| improvement : détecteurs + propositions, publication admin | brouillons LLM (toujours non publiables sans revue) |

## 11. Invariants transverses

1. Le runtime pédagogique est déterministe de bout en bout ; tout pipeline non déterministe (LLM, génération) est offline, versionné, validé, et publiable uniquement via revue + admin avec rollback (SPEC-REVIEW-PUBLISHING, SPEC-ADMIN).
2. Aucun contenu n'atteint un apprenant sans passer par `validatePackage` + revue + publication admin.
3. La latence n'est jamais un critère de notation, de progression ou de personnalisation ; seuls des agrégats de latence catégorisés (buckets de CONTRACTS-ANALYTICS) sont possibles, sous consentement.
4. Aucune réponse correcte (`correctIndex`, `correct`) n'est exposée dans une API destinée à l'apprenant avant ou pendant une question (voir `openapi.yml`).
5. `LearnerId` est opaque ; aucune donnée d'identité n'entre dans les contrats du module finance.
