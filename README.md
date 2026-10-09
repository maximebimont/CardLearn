# CardLearn

Application de cartes pour apprendre le vocabulaire anglais technique, avec le système de Leitner.
Toute l'application tient dans un seul composant React : [`CardLearn.jsx`](CardLearn.jsx). Le
dossier `src/` l'habille pour le web : connexion Supabase et sauvegarde en ligne.

## Utilisation

### Comme site web (Vite + React)

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # génère dist/
```

Sans configuration Supabase, l'application tourne **en mode local** : pas de connexion, et la
progression reste dans le navigateur (`localStorage`).

Avec Supabase, il faut **se connecter** : adresse e-mail et mot de passe (création de compte et
« mot de passe oublié » compris), lien de connexion envoyé par e-mail, ou GitHub en option.
La progression est alors enregistrée dans la table `progress`, une ligne par personne, et retrouvée sur
tous les appareils. Une copie reste dans le navigateur : les réponses données hors ligne sont envoyées
au serveur dès que la connexion revient.

### Dans un artifact claude.ai

`CardLearn.jsx` reste autonome : collez-le dans un artifact React. Il n'importe que `react` et
enregistre la progression avec `window.storage` sous la clé `vocab-progress`. Sur le site, c'est
`src/App.jsx` qui fournit ce `window.storage`, branché sur Supabase ou sur le navigateur.

## Déployer sur Vercel avec Supabase

1. **Créer la base.** Dans Vercel, ouvrez *Storage → Create → Supabase* (offre gratuite), ou créez un
   projet sur supabase.com.
2. **Créer la table.** Dans Supabase, ouvrez *SQL Editor*, collez le contenu de
   [`supabase/schema.sql`](supabase/schema.sql) et cliquez sur *Run*. La sécurité au niveau des lignes
   (RLS) est activée : chacun ne lit et n'écrit que sa propre progression. Le script crée aussi la
   fonction `delete_my_account`, utilisée par le bouton « Supprimer mon compte » du profil ; elle ne
   peut supprimer que le compte connecté. Il crée enfin la table `players` (pseudos) et la fonction
   `get_leaderboard`, qui calcule le classement sans exposer les adresses ni la progression détaillée.
   Le script peut être relancé sans risque.
3. **Autoriser les redirections.** Dans *Authentication → URL Configuration* :
   - *Site URL* : `https://votre-app.vercel.app`
   - *Redirect URLs* : `https://votre-app.vercel.app/**` et `http://localhost:5173/**`
4. **Importer le dépôt dans Vercel** (*Add New → Project*). Vercel détecte Vite tout seul.
5. **Variables d'environnement** (*Settings → Environment Variables*) :
   - `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY` : à copier depuis *Project Settings → API* dans
     Supabase. Si vous avez créé la base depuis Vercel, les variables `NEXT_PUBLIC_SUPABASE_URL` et
     `NEXT_PUBLIC_SUPABASE_ANON_KEY` ajoutées par l'intégration suffisent.
   - `VITE_AUTH_GITHUB=true` (facultatif) : affiche « Continuer avec GitHub ». Il faut d'abord activer
     le fournisseur GitHub dans *Authentication → Providers*.

   Ces variables sont lues au moment du build : **redéployez** après les avoir ajoutées ou modifiées.

Pour le développement local, copiez `.env.example` en `.env.local` et remplissez-le.

N'utilisez jamais la clé `service_role` dans le site : seule la clé `anon` (ou `publishable`) est
publique.

**Comptes par mot de passe.** Le fournisseur *Email* est actif par défaut dans Supabase
(*Authentication → Sign In / Providers*). Avec l'option *Confirm email* (activée par défaut), un
nouveau compte doit cliquer sur le lien reçu avant de pouvoir se connecter ; désactivez-la pour
une connexion immédiate après l'inscription. L'application demande 8 caractères minimum. Le lien
« mot de passe oublié » ramène sur le site, qui demande alors le nouveau mot de passe : son adresse
doit figurer dans les *Redirect URLs*.

L'envoi d'e-mails intégré à Supabase est limité à quelques messages par heure. Pour plus
d'utilisateurs, configurez votre propre serveur SMTP dans *Authentication → Emails*.

## Installer sur le téléphone

Le site est une appli web installable : elle s'ouvre en plein écran depuis l'écran d'accueil, avec
son icône, et démarre même sans connexion (les réponses données hors ligne sont envoyées au retour
du réseau).

- **iPhone / iPad** (Safari) : bouton **Partager** → **Sur l'écran d'accueil**.
- **Android** (Chrome) : menu **⋮** → **Ajouter à l'écran d'accueil** ou **Installer l'application**.

Dans l'appli installée, la connexion se fait par e-mail et mot de passe : un lien reçu par e-mail
s'ouvre dans le navigateur, pas dans l'appli. Les liens de confirmation et de mot de passe oublié
mènent donc au site, puis on revient dans l'appli pour se connecter.

Fichiers concernés : `public/manifest.webmanifest`, les icônes de `public/icons/` et
`src/service-worker.js` (la liste des fichiers à garder hors connexion est ajoutée au build par
`vite.config.js`).

## Fonctionnement

- **Apparence** : thème sombre unique (fond bleu nuit, bouton principal jaune, cartes « papier »),
  polices Bricolage Grotesque, Instrument Sans et JetBrains Mono (Google Fonts). L'appli tutoie.
  La maquette de cette refonte est dans [`design/maquette-refonte/`](design/maquette-refonte/)
  (`HANDOFF.md` et les écrans `.dc.html`).
- **Navigation** : sur mobile, une barre d'onglets en bas (Accueil, Profil, Classement) ; à partir de
  768 px, une barre en haut avec le logo, les mêmes onglets, la série de jours, l'avatar (vers le
  profil) et la déconnexion. La barre disparaît pendant une partie et sur l'écran de fin.
- **Accueil** : « Salut » suivi du pseudo choisi pour le classement (sinon « Salut » seul), la série
  de jours, la note avec sa barre de progression (D, C·50, B·75, A·100 cartes maîtrisées), le plateau
  « Nouvelle partie » (catégories en tuiles, 10, 20 ou 50 cartes, bouton « Jouer ») et la carte
  « Revanche » pour retenter les cartes ratées. Toute erreur y met la carte, même si elle est
  réussie plus tard dans la même partie classique ; seule une bonne réponse pendant une Revanche
  l'en retire, et le compteur descend.
- **Cartes** : le texte français s'affiche sur une carte posée sur sa pile ; on tape la réponse
  anglaise puis on valide avec Entrée ou « Valider ». Un panneau monte alors du bas :
  - vert, « Bien joué ! », avec le niveau gagné : la partie continue seule après 1 seconde
    (2,6 secondes si la réponse est acceptée à une faute près, pour voir la bonne orthographe), et la
    carte passe derrière la pile ;
  - rouge, avec la réponse attendue et la tienne : il reste affiché sans limite de temps, jusqu'à
    « Continuer » (ou Entrée), puis la carte glisse sur le côté.

  La réponse donnée n'est pas barrée : ses lettres fausses sont en gras et en rouge, une lettre
  oubliée est marquée « _ », et les lettres à corriger sont surlignées dans la réponse attendue. Une
  réponse sans rapport est entièrement en gras. « Je ne sais pas » compte comme une erreur.
- **Expressions en QCM** : les expressions ne se tapent pas. Quatre traductions sont proposées
  (A à D), une seule est juste. Les trois autres sont des pièges tirés de la bonne réponse : chaque
  expression a 2 ou 3 passages piégés par une erreur typique d'un francophone (faux ami comme
  « realize » pour réaliser ou « delays » pour délais, calque ou ordre des mots comme « code source »,
  faute comme « softwares » ou « developper »). Une partie en tire deux, et les 4 propositions sont
  toutes les combinaisons juste/faux : chaque piège apparaît dans deux propositions, la bonne ne se
  devine pas par élimination. Un clic (ou les touches A à D, 1 à 4) valide le choix : la bonne réponse
  passe en vert, un mauvais choix en rouge, et les passages piégés sont mis en évidence. Les pièges
  sont le 4e élément de chaque ligne de `EXPRESSIONS` dans `CardLearn.jsx`.
- **Leitner** : 5 boîtes, présentées dans l'appli comme des **niveaux** (1 À apprendre, 2 En cours,
  3 Retenue, 4 Solide, 5 Maîtrisée). Une bonne réponse fait monter la carte d'un niveau, une erreur la
  renvoie au niveau 1. Le niveau 5 correspond aux cartes maîtrisées. Dans le profil, le bouton ⓘ à
  côté de « Tes 5 niveaux » ouvre une fenêtre qui explique ces règles. Le tirage favorise les
  niveaux bas (poids 16 / 8 / 4 / 2 / 1).
- **Dans une partie** : la progression n'est enregistrée qu'à la fin de la partie. En haut, une croix
  « Quitter la partie », la barre d'avancement et le compteur (7/20) : après confirmation, la partie
  est abandonnée et rien n'est enregistré (les cartes gardent leur niveau d'avant la partie).
  Une carte ratée revient 3 à 5 cartes plus loin. En Revanche, une carte ne peut être ratée que
  3 fois par partie : à la 3e erreur, elle ne revient plus dans la partie et reste dans la Revanche
  pour la fois suivante (trois marques en haut de l'écran comptent les erreurs). Une carte réussie
  revient 8 à 12 cartes plus loin au niveau 2, 14 à 18 au niveau 3 et 20 à 26 au niveau 4. Elle ne
  revient pas si la partie est trop courte ou si elle est maîtrisée.
- **Correction** (mots métier et définitions, réponses tapées) : la casse, la ponctuation, les
  tirets, les apostrophes et les espaces sont ignorés. Les alternatives (« Server / Host ») sont
  acceptées séparément ou en entier. Pour les sigles (« Application Programming Interface - API »),
  on accepte la forme longue, le sigle ou les deux. Le « to » initial des verbes est facultatif. Une
  marge d'erreur dépend de la longueur de la réponse (lettres et chiffres comptés) : aucune faute
  jusqu'à 4, une de 5 à 10, deux de 11 à 20, trois au-delà. Une lettre en trop, en moins ou
  remplacée, ou deux lettres voisines inversées, comptent chacune pour une faute. Une réponse
  acceptée ainsi compte comme bonne (« Acceptée à une faute près »). La réponse exacte d'une autre
  carte n'est jamais acceptée.
- **Définitions** : le terme français est masqué dans la définition. Le bouton « Indice » le révèle.
- **Fin de partie** : score en anneau (8/10), justes, erreurs et pourcentage, puis la progression :
  cartes maîtrisées gagnées, barre de note avant/après, et l'évolution de chaque niveau. « À revoir »
  liste les cartes ratées (3 d'abord, puis « Voir les N »). Un clic sur une carte affiche le détail
  de ses tentatives : réponse donnée (lettres fausses en gras), réussie ou non, niveau avant et
  après. « Reste en Revanche » signale les cartes qui sont dans la Revanche après la partie. En bas :
  retour à l'accueil, « Rejouer » et « Revanche » (ou « Nouvelle partie » sans carte ratée).
- **Profil** : pseudo, rang et série de jours ; la note et ce qu'il manque pour la suivante, la
  progression par catégorie ; « Tes 5 niveaux » ; les statistiques (réponses, réussite, série, taux
  par catégorie) ; les cartes les plus ratées ; et la zone « Réinitialiser » / « Supprimer mon
  compte ». Sur mobile, la déconnexion est en haut du profil.
- **Suppression de compte** (site connecté à Supabase) : dans le profil, « Supprimer mon compte »
  demande de taper SUPPRIMER, puis efface le compte, sa progression et ses copies locales.
- **Classement** (site connecté à Supabase) : les élèves qui choisissent un pseudo sont classés par
  nombre de cartes maîtrisées (niveau 5), calculé depuis leur progression. « Tu es 4e sur 7 »,
  podium avec coupes or, argent et bronze, puis la suite du classement avec, sur ta ligne, le nombre
  de cartes à maîtriser pour dépasser le joueur juste devant ; les ex æquo partagent le même rang.
  Seuls le pseudo et le score sont visibles des autres, jamais l'adresse e-mail. On peut modifier
  son pseudo ou quitter le classement.

## Structure

| Fichier | Rôle |
|---|---|
| `CardLearn.jsx` | L'application : données, correction, Leitner, interface |
| `src/App.jsx` | Connexion Supabase et choix du stockage (Supabase ou navigateur) |
| `src/storage.js` | Implémentations de `window.storage` |
| `src/supabase.js` | Client Supabase, configuré par les variables d'environnement |
| `supabase/schema.sql` | Tables `progress` et `players`, règles d'accès, suppression de compte, classement |
| `public/manifest.webmanifest`, `public/icons/` | Appli web installable : nom, icônes, plein écran |
| `src/service-worker.js` | Démarrage hors connexion |
| `design/maquette-refonte/` | Maquette de la refonte visuelle (consignes et écrans) |

## Données

126 cartes, chacune avec un identifiant stable : 50 mots métier (`m01`–`m50`), 51 expressions
(`e01`–`e51`) et 25 définitions (`d01`–`d25`).
