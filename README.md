# CardLearn

Application de cartes pour apprendre le vocabulaire anglais technique, avec le système de Leitner.
Tout tient dans un seul composant React : [`CardLearn.jsx`](CardLearn.jsx).

## Utilisation

Collez le contenu de `CardLearn.jsx` dans un artifact React sur claude.ai. Le composant exporte
`CardLearn` par défaut et n'importe que `react`.

La progression est enregistrée avec `window.storage` sous la clé `vocab-progress`. Si cette API
n'existe pas, l'application fonctionne quand même et affiche un avertissement : la progression est
alors perdue en fermant la page.

## Fonctionnement

- **Cartes** : le texte français s'affiche, vous tapez la réponse anglaise puis validez avec Entrée.
  Une bonne réponse passe derrière la pile. Une erreur affiche la bonne réponse pendant 2 secondes
  (Entrée ou « Continuer » pour passer plus vite), puis la carte glisse sur le côté.
  « Je ne sais pas » compte comme une erreur.
- **Leitner** : 5 boîtes. Une bonne réponse fait monter la carte d'une boîte, une erreur la renvoie
  en boîte 1. La boîte 5 correspond aux cartes maîtrisées. Le tirage favorise les boîtes basses
  (poids 16 / 8 / 4 / 2 / 1).
- **Dans une session** : une carte ratée revient 3 à 5 cartes plus loin. Une carte réussie revient
  8 à 12 cartes plus loin en boîte 2, 14 à 18 en boîte 3 et 20 à 26 en boîte 4. Elle ne revient pas
  si la session est trop courte ou si elle est maîtrisée. Une session compte 10, 20 ou 50 cartes.
- **Correction** : la casse, la ponctuation, les tirets, les apostrophes et les espaces sont ignorés.
  Les alternatives (« Server / Host ») sont acceptées séparément ou en entier. Pour les sigles
  (« Application Programming Interface - API »), on accepte la forme longue, le sigle ou les deux.
  Le « to » initial des verbes est facultatif. Les fautes de frappe ne sont pas tolérées.
- **Définitions** : le terme français est masqué dans la définition. Le bouton « Indice » le révèle.

## Données

126 cartes, chacune avec un identifiant stable : 50 mots métier (`m01`–`m50`), 51 expressions
(`e01`–`e51`) et 25 définitions (`d01`–`d25`).
