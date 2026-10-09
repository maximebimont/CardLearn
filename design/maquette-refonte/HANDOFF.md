# Refonte visuelle — brief pour Claude Code

Ce dossier contient la maquette de la refonte visuelle de l'application de vocabulaire anglais technique (PWA, système de Leitner).

## Les fichiers

Chaque fichier `.dc.html` est un écran de la maquette. Ce sont des **références visuelles**, pas du code à copier tel quel : ils utilisent un format de maquette (`<x-dc>`, `{{variable}}`, `<sc-for>`, `<sc-if>`, `class Component extends DCLogic`). Il faut reproduire le rendu (structure, styles, couleurs, tailles, espacements) dans le code existant de l'app, avec sa propre stack et sa propre logique.

| Fichier | Écran |
|---|---|
| `Main.dc.html` | Accueil (mobile) |
| `Partie-saisie.dc.html` | Partie : carte à traduire en tapant (mots métier, définitions) |
| `Partie-qcm.dc.html` | Partie : carte à 4 choix (expressions) |
| `Fin-partie.dc.html` | Fin de partie (nouvel écran) |
| `Profil.dc.html` | Profil (page qui défile) |
| `Classement.dc.html` | Classement |
| `Accueil-desktop.dc.html` | Accueil en version large (desktop) |

Les données affichées (Max, 13 cartes, Léa, Yanis…) sont des exemples : il faut brancher les vraies données de l'app.

## Règles générales

- **Ne pas changer la logique métier** (Leitner, tirage, calcul de la note, Revanche, classement). Seul le visuel et la navigation changent.
- Mobile d'abord. La largeur de référence est 390 px. Le desktop reprend les mêmes composants dans une grille plus large.
- Zones cliquables d'au moins 44 px de haut.
- Ne pas dessiner de fausse barre d'état : laisser la place en haut (`env(safe-area-inset-top)`), et en bas pour la barre d'onglets (`env(safe-area-inset-bottom)`).

## Design tokens

Polices (Google Fonts) :
- **Bricolage Grotesque** (500–800) : titres, gros boutons, lettres de note.
- **Instrument Sans** (400–700) : texte courant.
- **JetBrains Mono** (400–700) : **tout le texte en anglais** et tous les chiffres.

Couleurs :
```
--bg:            #0D0E1A   fond de l'app
--surface:       #161829   cartes
--surface-2:     #1D2036   tuiles internes
--line:          #2A2E4A   bordures
--nav:           #12142A   barre d'onglets
--text:          #F3F2EE
--muted:         #A3A7C4
--faint:         #8A8EAE
--indigo:        #262A6E   bloc « Nouvelle partie », carte de note
--indigo-2:      #33388C   tuile sélectionnée sur indigo
--on-indigo:     #C5C8F0
--yellow:        #FFC93C   action principale + progression
--yellow-shadow: #B8860B   ombre « 3D » des boutons jaunes (box-shadow: 0 5px 0)
--on-yellow:     #1B1400
--paper:         #F6F3EA   cartes-questions (texte #15162B)
--success:       #3DDC84   (fond #0F2A1C, texte #5BE59A)
--error:         #FF6B6B   (fond #2E1215, texte #FF9A9A)
--streak:        #FF9F5A   (fond #2A1C12)
Catégories :
--cat-mots:      #63A4FF   Mots métier
--cat-expr:      #FF9255   Expressions
--cat-def:       #C09CFF   Définitions (passe du vert au lilas : le vert est réservé aux bonnes réponses)
Boîtes Leitner 1→5 : #4A4F7E, #5E66C4, #7F8BF0, #A9B3FF, #FFC93C
```

Rayons : 16 px (boutons, tuiles), 20 px (cartes), 24 px (blocs indigo, cartes-questions), 999 px (pastilles).

## Changements par écran

**Navigation**
- Mobile : barre d'onglets **en bas** avec icône + libellé (Accueil, Profil, Classement). L'onglet actif est en jaune, avec une pastille derrière l'icône.
- Le bouton de déconnexion passe dans l'en-tête du Profil.
- Desktop : barre du haut avec libellés, série de jours, avatar et déconnexion.

**Accueil**
- En-tête : « Salut {pseudo} » + pastille de série (flamme + nombre de jours).
- Carte de progression : cartes maîtrisées X/126 + badge de note. Barre segmentée D | C | B | A, proportionnelle aux seuils (0–49, 50–74, 75–105, 106–126), + « encore N pour C ».
- Bloc indigo « Nouvelle partie » : 3 tuiles de catégorie qu'on peut activer ou non (sélectionnée : bordure jaune + coche ; désélectionnée : bordure en pointillés ; au moins une catégorie reste toujours sélectionnée), un sélecteur 10/20/50 et le gros bouton jaune « Jouer · N cartes ».
- Carte Revanche : petite pile de cartes avec le nombre d'erreurs + bouton « Lancer ».

**Partie (saisie et QCM)**
- Barre du haut : bouton fermer (X), barre de progression jaune, compteur « 7/20 ».
- Carte-question « papier » crème posée sur une pile. Elle affiche la pastille de catégorie, le niveau de la carte (5 points), le texte français en gros et le libellé « FR → EN ».
- Saisie : champ en police mono, juste sous la carte (pour rester visible avec le clavier ouvert), puis le bouton « Valider ».
- QCM : 4 boutons A/B/C/D, texte anglais en mono. Une fois la réponse donnée, la bonne réponse passe en vert avec une coche, la mauvaise choisie en rouge avec une croix, les autres sont estompées.
- Après la réponse : un panneau monte du bas, vert (« Bien joué ! », « La carte monte au niveau N ») ou rouge (« Pas tout à fait », réponse attendue, réponse donnée barrée, « Retour au niveau 1 »), avec un bouton « Continuer ».

**Fin de partie (nouvel écran)**
- Anneau du score : arc vert pour les réponses justes, arc rouge pour les erreurs, « 15/20 » au centre. Titre + légende « justes · erreurs · % ».
- Carte de progression : maîtrisées +N. Dans la barre de note, le gain de la partie est en jaune clair. En dessous, les 5 boîtes avec leur nombre de cartes après la partie et l'écart.
- « À revoir » : les cartes ratées (français + anglais en mono), avec « Voir les N ».
- En bas : [Accueil] [Rejouer · 20 cartes] sur une ligne, puis le gros bouton jaune « Revanche · N cartes ».

**Profil**
- En-tête : avatar, pseudo, rang au classement et série, bouton de déconnexion.
- Carte indigo de la note : grosse lettre, « Encore N cartes pour viser C », barre D/C/B/A avec les seuils, progression par catégorie.
- « Tes 5 boîtes » : une barre empilée et 5 tuiles (nombre + nom), avec la boîte 5 en jaune.
- Statistiques : 4 tuiles et la réussite par catégorie.
- Cartes les plus ratées (top 5) et zone Réinitialiser en bas, dans un cadre en pointillés rouges.

**Classement**
- Podium dans un bloc indigo (1er au centre, plus haut, en jaune).
- Liste à partir du 4e. La ligne de l'utilisateur est en surbrillance jaune, avec la pastille « VOUS » et « Plus que N cartes pour dépasser X ».
- Carte du pseudo avec « Modifier » et « Quitter ».

## Méthode conseillée

1. Créer les design tokens (variables CSS ou thème) et charger les polices.
2. Construire les composants communs : barre d'onglets, bouton jaune 3D, carte, pastille de catégorie, barre de note D/C/B/A, points de niveau, panneau de résultat.
3. Refaire les écrans un par un, en vérifiant chacun à 390 px et en desktop avant de passer au suivant.
