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
   (RLS) est activée : chacun ne lit et n'écrit que sa propre progression.
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

## Fonctionnement

- **Accueil** : tableau de scores (série de jours, cartes maîtrisées, note estimée), plateau
  « Nouvelle partie » avec les catégories en tuiles, le nombre de cartes et le bouton « Jouer », et
  la « Revanche » pour reprendre les cartes ratées pas encore maîtrisées.
- **Cartes** : le texte français s'affiche, vous tapez la réponse anglaise puis validez avec Entrée.
  Une bonne réponse passe derrière la pile. Une erreur affiche la bonne réponse le temps de la lire,
  de 4 à 9 secondes selon sa longueur (Entrée ou « Continuer » pour passer plus vite), puis la carte
  glisse sur le côté.
  « Je ne sais pas » compte comme une erreur.
- **Leitner** : 5 boîtes. Une bonne réponse fait monter la carte d'une boîte, une erreur la renvoie
  en boîte 1. La boîte 5 correspond aux cartes maîtrisées. Le tirage favorise les boîtes basses
  (poids 16 / 8 / 4 / 2 / 1).
- **Dans une partie** : une carte ratée revient 3 à 5 cartes plus loin. Une carte réussie revient
  8 à 12 cartes plus loin en boîte 2, 14 à 18 en boîte 3 et 20 à 26 en boîte 4. Elle ne revient pas
  si la partie est trop courte ou si elle est maîtrisée. Une partie compte 10, 20 ou 50 cartes.
- **Correction** : la casse, la ponctuation, les tirets, les apostrophes et les espaces sont ignorés.
  Les alternatives (« Server / Host ») sont acceptées séparément ou en entier. Pour les sigles
  (« Application Programming Interface - API »), on accepte la forme longue, le sigle ou les deux.
  Le « to » initial des verbes est facultatif. Les fautes de frappe ne sont pas tolérées.
- **Définitions** : le terme français est masqué dans la définition. Le bouton « Indice » le révèle.
- **Fin de partie** : score et cartes ratées, regroupées par carte. Un clic sur une carte affiche
  le détail de ses tentatives : réponse donnée, réussie ou non, boîte avant et après.
- **Navigation** : une barre d'icônes centrée en haut mène à l'accueil, au profil et au classement.
  Le logo (à gauche) ramène à l'accueil ; une fois connecté, l'icône de déconnexion est à droite.
- **Classement** (à venir) : il mettra les élèves en compétition selon leurs cartes maîtrisées et
  leur régularité. Pour l'instant, la page affiche vos chiffres.

## Structure

| Fichier | Rôle |
|---|---|
| `CardLearn.jsx` | L'application : données, correction, Leitner, interface |
| `src/App.jsx` | Connexion Supabase et choix du stockage (Supabase ou navigateur) |
| `src/storage.js` | Implémentations de `window.storage` |
| `src/supabase.js` | Client Supabase, configuré par les variables d'environnement |
| `supabase/schema.sql` | Table `progress` et règles d'accès |

## Données

126 cartes, chacune avec un identifiant stable : 50 mots métier (`m01`–`m50`), 51 expressions
(`e01`–`e51`) et 25 définitions (`d01`–`d25`).
