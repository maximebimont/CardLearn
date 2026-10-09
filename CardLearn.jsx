import React, { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";

/* =============================================================================
   CardLearn — vocabulaire anglais technique, révisé avec le système de Leitner.
   Fichier unique : données, correction des réponses, algorithme de révision,
   sauvegarde (window.storage) et interface.
   ============================================================================= */

const STORAGE_KEY = "vocab-progress";
const MAX_BOX = 5;
const SESSION_SIZES = [10, 20, 50];
const DEFAULT_SIZE = 20;

// Durées des retours et animations (ms)
// Bonne réponse : le panneau vert reste ce temps-là, puis la partie continue seule (Entrée ou « Continuer » pour aller plus vite).
// Erreur : le panneau rouge attend « Continuer », sans limite de temps pour lire.
const FEEDBACK_MS = 1000;
const NEAR_MS = 2600; // réponse acceptée à quelques fautes près : le temps de voir la bonne orthographe
const CHOICES = 4; // propositions par carte en QCM
const MAX_REMATCH_ERRORS = 3; // Revanche : à la 3e erreur, la carte ne revient plus dans la partie et reste en Revanche
const EXIT_BACK_MS = 680;
const EXIT_SIDE_MS = 420;
const EXIT_REDUCED_MS = 180;

const CATEGORIES = {
  mots: { label: "Mots métier", badge: "Mot métier", instruction: "Écris la traduction anglaise" },
  // choices : la carte se joue en QCM (4 propositions, une seule juste) au lieu d'être tapée.
  expr: { label: "Expressions", badge: "Expression", instruction: "Choisis la bonne traduction", choices: true },
  def: { label: "Définitions", badge: "Définition", instruction: "Écris le terme anglais qui correspond à cette définition" },
};
const CAT_KEYS = Object.keys(CATEGORIES);

/* ---------------------------------------------------------------- Données -- */

const MOTS = [
  ["m01", "Logiciel", "Software"],
  ["m02", "Cahier des charges", "Specifications"],
  ["m03", "Navigateur", "Browser"],
  ["m04", "Moteur de recherche", "Search engine"],
  ["m05", "Programmation", "Programming"],
  ["m06", "Nom de domaine", "Domain name"],
  ["m07", "Compte", "Account"],
  ["m08", "Créer un compte", "To sign up"],
  ["m09", "Définir un mot de passe", "To set a password"],
  ["m10", "Utilisateur", "User"],
  ["m11", "Identifiant", "Username"],
  ["m12", "Bibliothèque", "Library"],
  ["m13", "Cadre de travail", "Framework"],
  ["m14", "Environnement de développement", "Integrated development environment - IDE"],
  ["m15", "Maintenance", "Maintenance"],
  ["m16", "Sauvegarde", "Backup"],
  ["m17", "Base de données", "Database"],
  ["m18", "Flux de données", "Data flow"],
  ["m19", "Stockage de données", "Data storage"],
  ["m20", "Pare-feu", "Firewall"],
  ["m21", "Logiciel espion", "Spyware"],
  ["m22", "Bande passante", "Bandwidth"],
  ["m23", "Interface de programmation", "Application Programming Interface - API"],
  ["m24", "Balise", "Markup"],
  ["m25", "Langage binaire", "Binary language"],
  ["m26", "Système de gestion de contenu", "Content management system - CMS"],
  ["m27", "Serveur", "Server / Host"],
  ["m28", "Service d'hébergement", "Hosting service"],
  ["m29", "Plan de site / Arborescence", "Sitemap"],
  ["m30", "Site statique", "Static site"],
  ["m31", "Site dynamique", "Dynamic site"],
  ["m32", "Site animé", "Animated site"],
  ["m33", "Refonte", "Redesign"],
  ["m34", "Charte graphique", "Graphic charter"],
  ["m35", "Bannière", "Banner"],
  ["m36", "Référencement", "Referencing"],
  ["m37", "Optimisation pour les moteurs de recherche", "Search Engine Optimization - SEO"],
  ["m38", "Référencement payant", "Search Engine Advertising - SEA"],
  ["m39", "Référencement abusif", "Spamdexing"],
  ["m40", "Réseau social", "Social Network"],
  ["m41", "Protocole de transfert de fichier", "File Transfer Protocol"],
  ["m42", "Transfert de fichier", "File transfer"],
  ["m43", "Partage de fichier", "File sharing"],
  ["m44", "Télécharger", "To download / To upload"],
  ["m45", "Visite virtuelle", "Virtual visit"],
  ["m46", "Objet interactif", "Interactive object"],
  ["m47", "Interface utilisateur graphique", "Graphic user interface"],
  ["m48", "Prototype d'interface utilisateur", "Mock-up"],
  ["m49", "Expérience utilisateur", "User experience"],
  ["m50", "Maquette fonctionnelle d'un site", "Wireframe"],
];

// Expressions : [id, français, anglais, pièges du QCM]. Un piège est [passage juste, variante fausse] :
// faux ami, calque, ordre des mots ou faute typique d'un francophone.
const EXPRESSIONS = [
  ["e01", "Déclarer une variable en langage java", "Declare a variable in java language", [["Declare", "Declarate"], ["java language", "language java"]]],
  ["e02", "Utiliser des tableaux pour stocker plusieurs valeurs dans une seule variable", "Use arrays to store multiple values in a single variable", [["arrays", "tables"], ["store", "stock"], ["a single", "an only"]]],
  ["e03", "Créer une chaîne en java", "Create a string in java", [["string", "chain"], ["Create", "Creat"]]],
  ["e04", "Exécuter des boucles", "Execute loops", [["Execute", "Excecute"], ["loops", "buckles"]]],
  ["e05", "Effectuer une opération d'entrée ou de sortie", "Perform an input or output operation", [["input", "entry"], ["output", "exit"], ["Perform", "Effectuate"]]],
  ["e06", "Traiter une information représentée sous sa forme binaire", "Process a binary information", [["Process", "Treat"], ["information", "informations"]]],
  ["e07", "Comprendre les principaux livrables, les jalons, ainsi que les rôles et les responsabilités de chaque personne impliquée dans une charte de projet", "Understand the main deliverables, milestones, as well as the roles and responsibilities of each person involved in a project charter", [["responsibilities", "responsabilities"], ["involved", "implicated"], ["milestones", "landmarks"]]],
  ["e08", "Utiliser les opérateurs booléens pour réduire, étendre ou affiner les résultats de recherche", "Use Boolean operators to narrow, expand, or refine search results", [["refine", "affine"], ["search results", "research results"], ["Boolean operators", "operators Boolean"]]],
  ["e09", "Créer une procédure stockée dans une base de données", "Create a stored procedure in a database", [["stored", "stocked"], ["procedure", "proceeding"]]],
  ["e10", "Utiliser les algorithmes les plus efficaces possibles pour résoudre des problèmes", "Use the most efficient algorithms possible to solve problems", [["algorithms", "algorythms"], ["most efficient", "more efficient"], ["to solve", "for solve"]]],
  ["e11", "Développer des solutions logicielles fiables et fonctionnelles", "Develop reliable and functional software solutions", [["Develop", "Developp"], ["functional", "functionnal"], ["software solutions", "solutions software"]]],
  ["e12", "Se positionner comme expert technique", "Position oneself as a technical expert", [["technical", "technic"], ["as a", "like a"]]],
  ["e13", "Gérer et optimiser la base de données", "Manage and optimize the database", [["optimize", "optimalize"], ["the database", "the basis of data"]]],
  ["e14", "Réaliser une étude logicielle", "Conduct a software study", [["Conduct", "Realize"], ["a software study", "a study software"]]],
  ["e15", "Concevoir l'architecture des applications", "Design application architecture", [["Design", "Conceive"], ["application architecture", "applicative architecture"]]],
  ["e16", "Assurer la gestion des données", "Ensure data management", [["Ensure", "Assure"], ["data", "datas"]]],
  ["e17", "Sécuriser les applications", "Secure applications", [["Secure", "Securize"], ["applications", "appliances"]]],
  ["e18", "Implémenter des solutions logicielles", "Implement software solutions", [["Implement", "Implant"], ["software solutions", "softwares solutions"]]],
  ["e19", "Créer des programmes", "Build programs", [["Build", "Built"], ["programs", "programmations"]]],
  ["e20", "Écrire et tester le code", "Write and test code", [["Write", "Redact"], ["code", "codes"]]],
  ["e21", "Collaborer avec des développeurs", "Collaborate with developers", [["Collaborate with", "Collaborate to"], ["developers", "developpers"]]],
  ["e22", "Utiliser des outils de développement", "Use development tools", [["development", "developpement"], ["tools", "toolings"]]],
  ["e23", "Créer des applications ergonomiques", "Create ergonomic applications", [["Create", "Creat"], ["ergonomic applications", "applications ergonomic"]]],
  ["e24", "Écouter, analyser et rédiger les besoins", "Listen, analyze and write needs", [["write", "redact"], ["needs", "needings"]]],
  ["e25", "Être garant de la pérennité et de l'évolution des solutions", "To guarantee the sustainability and evolution of solutions", [["guarantee", "garantee"], ["sustainability", "perennity"]]],
  ["e26", "Respecter les délais, les coûts et la qualité", "Meet deadlines, costs and quality", [["deadlines", "delays"], ["quality", "qualities"]]],
  ["e27", "Satisfaire les attentes du client", "Meet client expectations", [["Meet", "Encounter"], ["expectations", "waitings"]]],
  ["e28", "Piloter un projet d'ingénierie logicielle", "Lead a software engineering project", [["Lead", "Pilot"], ["software engineering", "engineering software"]]],
  ["e29", "Construire un cahier des charges", "Build specifications", [["Build", "Constitute"], ["specifications", "charges notebook"]]],
  ["e30", "Gérer les données de l'entreprise", "Manage company data", [["company", "society"], ["data", "datas"]]],
  ["e31", "Développer des applications mobiles", "Develop mobile apps", [["Develop", "Developp"], ["mobile apps", "apps mobile"]]],
  ["e32", "Accompagner la stratégie de l'entreprise", "Support the company's strategy", [["Support", "Accompany"], ["company's", "society's"]]],
  ["e33", "Suivre les principes et bonnes pratiques de développement", "Follow development principles and best practices", [["development", "developpement"], ["principles", "principals"]]],
  ["e34", "Analyser et identifier tous les problèmes potentiels", "Analyze and identify any potential problems", [["potential", "eventual"], ["problems", "problematics"]]],
  ["e35", "Améliorer et maintenir le logiciel à long terme", "Improve and maintain the software in the long term", [["maintain", "maintenance"], ["software", "softwares"], ["in the long term", "at long term"]]],
  ["e36", "Traduire le besoin du client en demandes fonctionnelles", "Translate the client's need into functional demands", [["into", "in"], ["functional", "functionnal"]]],
  ["e37", "Analyser et décrire les tâches à réaliser par l'ordinateur", "Analyze and describe the tasks to be performed by the computer", [["to be performed", "to realize"], ["computer", "ordinator"]]],
  ["e38", "Déterminer et schématiser les fonctionnalités du logiciel", "Determine and schematize the software functionalities", [["software", "softwares"], ["functionalities", "fonctionalities"]]],
  ["e39", "Déceler les défauts de programmation", "Identify programming defects", [["programming", "programmation"], ["defects", "defaults"]]],
  ["e40", "Effectuer des traitements par lot", "Perform batch processes", [["Perform", "Effectuate"], ["batch", "lot"], ["processes", "treatments"]]],
  ["e41", "Contrôler les évolutions et les différentes versions du logiciel", "Control developments and different versions of the software", [["developments", "evolutions"], ["different", "differents"], ["software", "softwares"]]],
  ["e42", "Maintenir en condition opérationnelle le logiciel", "Keep the software in operational condition", [["operational", "operationnal"], ["software", "softwares"]]],
  ["e43", "Mettre en production à l'issue des phases de qualification et d'intégration", "Put into production at the end of the qualification and integration phases", [["into production", "into producing"], ["at the end of", "at the issue of"]]],
  ["e44", "Rédiger le code source qui constitue le corps du logiciel", "Write the source code that forms the body of the software", [["source code", "code source"], ["body", "corpse"], ["software", "softwares"]]],
  ["e45", "Mettre en œuvre l'agilité au sein d'une équipe de développeurs", "Implement agility as part of a team of developers", [["Implement", "Implant"], ["as part of", "in the breast of"], ["developers", "developpers"]]],
  ["e46", "Diriger des projets collaboratifs", "Lead collaborative projects", [["Lead", "Pilot"], ["collaborative", "collaboratives"]]],
  ["e47", "Vérifier que les fonctions offertes par le logiciel correspondent aux attentes du client", "Make sure the features offered by the software are in line with the customer's expectations", [["software", "softwares"], ["customer's", "costumer's"], ["expectations", "waitings"]]],
  ["e48", "Définir les étapes clés de cycle de vie du projet", "Define key lifecycle milestones for the project", [["Define", "Definite"], ["key", "keys"]]],
  ["e49", "Intégrer les environnements de développement", "Integrate development environments", [["Integrate", "Integrated"], ["development", "developpement"], ["environments", "environements"]]],
  ["e50", "Gérer les modifications apportées au code source", "Manage changes to source code", [["to", "at"], ["source code", "code source"]]],
  ["e51", "Déployer le logiciel sur un serveur d'applications", "Deploy the software to an application server", [["Deploy", "Unfold"], ["software", "softwares"], ["application server", "server of applications"]]],
];

// [id, terme français (indice), définition, terme anglais, autres mots à masquer]
const DEFINITIONS = [
  ["d01", "Dette technique", "La dette technique correspond au non-respect de la conception d'un logiciel, intentionnel ou non, qui induit des coûts supplémentaires dans le futur.", "Technical debt"],
  ["d02", "Progiciel de Gestion Intégré – PGI", "Système d'information qui sert à gérer et à suivre au quotidien l'ensemble des informations et des services opérationnels d'une entreprise.", "Enterprise Resource Planning - ERP"],
  ["d03", "Facteur clé de succès", "Élément essentiel à prendre en compte pour s'attaquer à un marché. Chaque entreprise fait face à plusieurs FCS qu'il est nécessaire de maîtriser au risque de ne pas être compétitif.", "Key success factor", ["FCS"]],
  ["d04", "Test unitaire", "Procédure permettant de vérifier le bon fonctionnement d'une partie précise d'un logiciel ou d'une portion d'un programme.", "Unit testing"],
  ["d05", "Gestion des erreurs", "Regroupe les différents moyens visant à protéger l'utilisateur des erreurs et à lui permettre de les corriger. L'objectif est de minimiser les interruptions dues aux erreurs.", "Error management"],
  ["d06", "Gestion des versions", "Consiste à gérer l'ensemble des versions d'un ou plusieurs fichiers.", "Version management / Versioning management"],
  ["d07", "Pipeline logiciel", "Technique utilisée par les compilateurs pour optimiser l'exécution des boucles.", "Software pipelining"],
  ["d08", "Maintenabilité", "Dans le domaine informatique, la capacité pour des composants ou des applications à être maintenus, de manière cohérente et à moindre coût, en état de fonctionnement.", "Maintainability"],
  ["d09", "Patron de conception", "Arrangement caractéristique de modules, reconnu comme bonne pratique en réponse à un problème de conception d'un logiciel. Il décrit une solution standard, utilisable dans la conception de différents logiciels.", "Design pattern"],
  ["d10", "Politique de test", "Document de haut niveau décrivant les principes, approches et objectifs majeurs de l'organisation concernant l'activité de test. C'est donc un document qui décrit pourquoi on fait des tests.", "Testing policy"],
  ["d11", "Requête base de données", "Interrogation d'une base de données. Elle peut comporter un certain nombre de critères pour préciser la demande. Il existe plusieurs langages de requêtes, spécifiques à la structure des bases de données.", "Database query"],
  ["d12", "Visualisation de données", "Ensemble de méthodes de représentation graphique, en deux ou trois dimensions, utilisant ou non de la couleur et des trames, pour représenter des ensembles complexes de données de manière plus simple et pédagogique.", "Data visualization"],
  ["d13", "Microservices", "Technique de développement logiciel, variante du style architectural de l'architecture orientée services, qui structure une application comme un ensemble de services faiblement couplés.", "Microservices"],
  ["d14", "Plateforme à la demande", "Catégorie de services cloud qui propose une plateforme de traitement et une couche logicielle en tant que service.", "Platform as a service - PaaS"],
  ["d15", "Critères de choix", "Définir des critères de choix permet de retenir les critères les plus pertinents en fonction d'un objectif à atteindre.", "Selection criteria"],
  ["d16", "Architecture logicielle", "Conçue en prenant en considération les besoins du futur utilisateur de l'application, sur lesquels seront basés l'étude et les résultats de la création d'un élément ou d'une fonctionnalité du logiciel.", "Software architecture"],
  ["d17", "Informatique en nuage", "Logiciels ou données hébergés ou lancés sur des serveurs distants, accessibles depuis n'importe où sur internet.", "Cloud computing"],
  ["d18", "Test d'intrusion", "Technique de piratage éthique consistant à tester la vulnérabilité d'un système informatique, d'une application ou d'un site web en détectant les failles susceptibles d'être exploitées par un hacker ou un logiciel malveillant.", "Pentest"],
  ["d19", "Politique de sécurité", "Plan d'action défini pour préserver l'intégrité et la pérennité d'un groupe social.", "Security policy"],
  ["d20", "Feuille de route", "Propose généralement le recensement des moyens, la ou les cibles, les principes à suivre et les valeurs à respecter, la priorité des tâches, ainsi qu'un calendrier pour atteindre ces buts.", "Roadmap"],
  ["d21", "Argumenter pour convaincre", "Permet d'appuyer une affirmation à l'aide d'un raisonnement ou de preuves.", "Arguing to convince"],
  ["d22", "Mise en place d'un outil d'audit", "A pour objectif d'identifier et d'évaluer les risques (opérationnels, financiers, de réputation notamment) associés aux activités informatiques d'une entreprise ou d'une administration.", "Setting up an audit tool"],
  ["d23", "Perfectionnement du développement", "Démarche qui vise à améliorer les programmes développés en proposant des solutions techniques innovantes.", "Development improvement"],
  ["d24", "Mise en œuvre d'une démarche qualité", "Ensemble des actions menées par une entreprise pour améliorer la gestion de la qualité, proposer de meilleurs produits et prestations aux clients, et faire évoluer les salariés.", "Setting up a quality approach"],
  ["d25", "Définir une matrice de choix", "Tableau qui regroupe tous nos choix ainsi que les différents critères à considérer pour les départager. Elle facilite la prise de décision grâce à un système de pondération.", "Matrix of choices"],
];

/* ------------------------------------------------- Correction des réponses -- */

// Minuscules, sans accents, apostrophes supprimées, ponctuation et tirets → espaces.
function toWords(text) {
  return String(text)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/['’‘`´]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

// Clé de comparaison : « to » initial optionnel, espaces et tirets ignorés (« mock-up » = « mockup »).
function answerKey(text) {
  const words = toWords(text);
  if (words.length > 1 && words[0] === "to") words.shift();
  return words.join("");
}

// « Forme longue - SIGLE »
const ACRONYM = /^(.+?)\s+[-–—]\s+([A-Za-z]{2,8})$/;

function acceptedKeys(en) {
  const keys = new Set();
  const add = (text) => {
    const key = answerKey(text);
    if (key) keys.add(key);
  };
  add(en);
  // Alternatives « A / B » : chaque partie seule, ou la forme complète.
  const parts = en.split("/").map((part) => part.trim()).filter(Boolean);
  for (const part of parts) {
    add(part);
    const match = part.match(ACRONYM);
    if (match && /[A-Z].*[A-Z]/.test(match[2])) {
      const [, long, acronym] = match;
      add(long);
      add(acronym);
      add(`${long} ${acronym}`);
      add(`${acronym} ${long}`);
    }
  }
  if (parts.length > 1) add(parts.map(answerKey).join(" "));
  return keys;
}

// Formes acceptées écrites telles quelles dans la réponse : entière, chaque alternative, forme longue, sigle.
// Chacune est un intervalle [début, fin) du texte, pour y situer les lettres à corriger.
function answerForms(en) {
  const forms = [[0, en.length]];
  const add = (start, end) => {
    if (!forms.some(([s, e]) => s === start && e === end)) forms.push([start, end]);
  };
  let at = 0;
  for (const raw of en.split("/")) {
    const start = at + raw.length - raw.trimStart().length;
    const part = raw.trim();
    at += raw.length + 1;
    if (!part) continue;
    add(start, start + part.length);
    const match = part.match(ACRONYM);
    if (match && /[A-Z].*[A-Z]/.test(match[2])) {
      add(start, start + match[1].length);
      add(start + part.length - match[2].length, start + part.length);
    }
  }
  return forms;
}

// Lettres et chiffres comparés, avec leur position dans le texte (mêmes règles que answerKey).
function keyChars(text) {
  const words = [];
  let word = null;
  for (let i = 0; i < text.length; i++) {
    const c = text[i].toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
    if (/^[a-z0-9]$/.test(c)) {
      if (!word) words.push((word = []));
      word.push({ i, c });
    } else if (c && !/['’‘`´]/.test(c)) {
      word = null;
    }
  }
  if (words.length > 1 && words[0].map((x) => x.c).join("") === "to") words.shift();
  return words.flat();
}

// Fautes tolérées selon la longueur de la réponse attendue (lettres et chiffres).
function typoAllowance(length) {
  if (length <= 4) return 0;
  if (length <= 10) return 1;
  if (length <= 20) return 2;
  return 3;
}

// Distance d'édition entre deux suites de lettres (deux lettres voisines inversées comptent pour une faute),
// avec, pour chaque lettre, si elle est fausse (a) ou à corriger (b), et où manquent des lettres de b dans a.
function align(a, b) {
  const n = a.length;
  const m = b.length;
  const d = Array.from({ length: n + 1 }, (_, i) => Array.from({ length: m + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)));
  const swapped = (i, j) => i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1] && a[i - 1] !== b[j - 1];
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (swapped(i, j)) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  }
  const badA = new Array(n).fill(false);
  const badB = new Array(m).fill(false);
  const pairs = []; // lettres identiques alignées [i, j]
  const missing = []; // lettre j de b absente de a, à insérer avant la lettre i de a
  // Remontée depuis la fin : à coût égal, les lettres en trop ou manquantes sont placées le plus loin possible,
  // pour qu'une réponse commencée (« data » pour « database ») reste alignée sur le début.
  let i = n;
  let j = m;
  while (i > 0 || j > 0) {
    if (i > 0 && d[i][j] === d[i - 1][j] + 1) {
      badA[--i] = true;
    } else if (j > 0 && d[i][j] === d[i][j - 1] + 1) {
      badB[--j] = true;
      missing.push([i, j]);
    } else if (a[i - 1] === b[j - 1] && d[i][j] === d[i - 1][j - 1]) {
      pairs.push([--i, --j]);
    } else if (swapped(i, j) && d[i][j] === d[i - 2][j - 2] + 1) {
      badA[i - 1] = badA[i - 2] = badB[j - 1] = badB[j - 2] = true;
      i -= 2;
      j -= 2;
    } else {
      badA[--i] = badB[--j] = true;
    }
  }
  // Lettre manquante au milieu de la réponse, dans une suite de lettres identiques (« company's strategy ») :
  // c'est la première qui manque. En fin de réponse (réponse inachevée), elle reste à la fin.
  const pairOfB = new Map(pairs.map((pair) => [pair[1], pair]));
  for (const gap of missing) {
    while (gap[0] < n && gap[1] > 0 && b[gap[1] - 1] === b[gap[1]] && pairOfB.get(gap[1] - 1)?.[0] === gap[0] - 1) {
      const pair = pairOfB.get(gap[1] - 1);
      pairOfB.delete(pair[1]);
      pair[1] = gap[1];
      pairOfB.set(pair[1], pair);
      badB[gap[1]] = false;
      gap[0] -= 1;
      gap[1] -= 1;
      badB[gap[1]] = true;
    }
  }
  return { distance: d[n][m], badA, badB, pairs, missing };
}

// Texte découpé en segments : null (normal), "bad" (lettre fausse), "gap" (lettre manquante), "fix" (lettre à corriger).
function segment(text, kindAt, gaps = new Map()) {
  const segments = [];
  const push = (kind, piece) => {
    const last = segments[segments.length - 1];
    if (last && last.kind === kind) last.text += piece;
    else segments.push({ kind, text: piece });
  };
  for (let i = 0; i <= text.length; i++) {
    if (gaps.has(i)) push("gap", gaps.get(i) > 3 ? "___…" : "_".repeat(gaps.get(i)));
    if (i < text.length) push(kindAt(i), text[i]);
  }
  return segments;
}

// Compare la réponse à la forme attendue la plus proche. ok : exacte, ou à quelques fautes près (near).
// given / expected : la réponse et la forme attendue, avec les lettres à revoir mises en évidence.
function grade(card, input) {
  const key = answerKey(input);
  if (!key) return { ok: false, near: false, typos: 0, given: null, expected: null };
  if (card.accepted.has(key) || (key.startsWith("to") && card.accepted.has(key.slice(2)))) {
    return { ok: true, near: false, typos: 0, given: null, expected: null };
  }
  const typed = keyChars(input);
  if (!typed.length) return { ok: false, near: false, typos: 0, given: null, expected: null };
  let best = null;
  for (const [start, end] of card.forms) {
    const target = keyChars(card.en.slice(start, end)).map(({ i, c }) => ({ i: i + start, c }));
    const result = align(typed.map((x) => x.c), target.map((x) => x.c));
    const within = result.distance <= typoAllowance(target.length);
    if (!best || within > best.within || (within === best.within && result.distance < best.distance)) best = { ...result, target, within };
  }
  // Une autre carte de la liste, écrite sans faute, n'est pas une faute de frappe.
  const near = best.within && !OTHER_ANSWERS.get(key)?.some((id) => id !== card.id);
  const { badA, badB, pairs, target } = best;

  // Une lettre juste isolée au milieu d'erreurs n'est qu'une coïncidence : elle compte comme fausse.
  const isBadA = (i) => i < 0 || i >= typed.length || badA[i];
  const isBadB = (j) => j < 0 || j >= target.length || badB[j];
  const stray = pairs.filter(([i, j]) => typed.length > 1 && target.length > 1 && isBadA(i - 1) && isBadA(i + 1) && isBadB(j - 1) && isBadB(j + 1));
  for (const [i, j] of stray) badA[i] = badB[j] = true;
  const matched = pairs.length - stray.length;

  // Réponse sans rapport avec la forme attendue : toute la réponse est fausse, rien n'est détaillé.
  if (matched * 2 < typed.length && matched * 2 < target.length) {
    const typedAt = new Set(typed.map((x) => x.i));
    return { ok: false, near: false, typos: best.distance, given: segment(input, (i) => (typedAt.has(i) ? "bad" : null)), expected: null };
  }

  const badAt = new Set(typed.filter((_, i) => badA[i]).map((x) => x.i));
  const fixAt = new Set(target.filter((_, j) => badB[j]).map((x) => x.i));
  // Lettre manquante : en début de mot, avant le mot suivant de la réponse ; sinon juste après la lettre précédente.
  // Entre deux lettres fausses, elle n'apprend rien de plus : elle n'est pas montrée.
  const gaps = new Map();
  for (const [i, j] of best.missing) {
    if (isBadA(i - 1) && isBadA(i)) continue;
    const startsWord = j === 0 || /[^'’‘`´̀-ͯ]/.test(card.en.slice(target[j - 1].i + 1, target[j].i));
    const at = i === 0 ? typed[0].i : i === typed.length || !startsWord ? typed[i - 1].i + 1 : typed[i].i;
    gaps.set(at, (gaps.get(at) || 0) + 1);
  }
  return {
    ok: near,
    near,
    typos: best.distance,
    given: segment(input, (i) => (badAt.has(i) ? "bad" : null), gaps),
    expected: segment(card.en, (i) => (fixAt.has(i) ? "fix" : null)),
  };
}

const CARDS = [
  ...MOTS.map(([id, fr, en]) => ({ id, cat: "mots", fr, en })),
  ...EXPRESSIONS.map(([id, fr, en, traps = []]) => ({ id, cat: "expr", fr, en, traps })),
  ...DEFINITIONS.map(([id, term, fr, en, masks = []]) => ({ id, cat: "def", fr, en, hint: term, masks: [term, ...masks] })),
].map((card) => ({ ...card, accepted: acceptedKeys(card.en), forms: answerForms(card.en) }));

// Réponses exactes de chaque carte : clé → cartes.
const OTHER_ANSWERS = new Map();
for (const card of CARDS) {
  for (const key of card.accepted) OTHER_ANSWERS.set(key, [...(OTHER_ANSWERS.get(key) || []), card.id]);
}

/* -------------------------------------------------------------------- QCM -- */

const STOP_WORDS = new Set(["a", "an", "the", "to", "of", "and", "or", "in", "on", "for", "by", "as", "at", "into", "be", "with"]);
const contentWords = (text) => new Set(toWords(text).filter((word) => !STOP_WORDS.has(word)));

function shuffle(items) {
  const list = [...items];
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

// Position d'un passage dans le texte, en mots entiers (-1 s'il n'y est pas).
function findWords(text, part) {
  for (let i = text.indexOf(part); i >= 0; i = text.indexOf(part, i + 1)) {
    if (!/[A-Za-z']/.test(text[i - 1] || "") && !/[A-Za-z']/.test(text[i + part.length] || "")) return i;
  }
  return -1;
}

// Deux pièges de la carte, chacun juste ou faux : 4 propositions, une seule entièrement juste.
// Chaque variante fausse figure dans deux propositions : la bonne réponse ne se repère pas par élimination.
// segments : les passages piégés, faux ("bad") ou justes ("fix"), mis en évidence après la réponse.
function trapChoices(card) {
  const traps = shuffle(card.traps)
    .slice(0, 2)
    .map(([right, wrong]) => ({ right, wrong, at: findWords(card.en, right) }))
    .sort((a, b) => a.at - b.at);
  return [[false, false], [true, false], [false, true], [true, true]].map((flags) => {
    const segments = [];
    let from = 0;
    traps.forEach((trap, k) => {
      segments.push({ kind: null, text: card.en.slice(from, trap.at) });
      segments.push(flags[k] ? { kind: "bad", text: trap.wrong } : { kind: flags.some(Boolean) ? null : "fix", text: trap.right });
      from = trap.at + trap.right.length;
    });
    segments.push({ kind: null, text: card.en.slice(from) });
    return { text: segments.map((seg) => seg.text).join(""), segments: segments.filter((seg) => seg.text) };
  });
}

// Les propositions d'une carte en QCM : { text, segments }.
function makeChoices(card) {
  if (card.traps?.length >= 2) return shuffle(trapChoices(card));
  // Sans pièges : 3 autres réponses de la même catégorie, de longueur proche et partageant des mots avec la bonne.
  const words = contentWords(card.en);
  const decoys = CARDS.filter((other) => other.cat === card.cat && other.en !== card.en)
    .map((other) => {
      const shared = [...contentWords(other.en)].filter((word) => words.has(word)).length;
      const length = Math.min(other.en.length, card.en.length) / Math.max(other.en.length, card.en.length);
      return { en: other.en, score: shared + 1.5 * length + 0.8 * Math.random() };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, CHOICES - 1)
    .map((other) => other.en);
  return shuffle([card.en, ...decoys]).map((text) => ({ text, segments: null }));
}

const CARD_BY_ID = Object.fromEntries(CARDS.map((card) => [card.id, card]));
const TOTAL = CARDS.length;
const CAT_TOTAL = Object.fromEntries(CAT_KEYS.map((cat) => [cat, CARDS.filter((card) => card.cat === cat).length]));

/* ------------------------------------------------------------ Progression -- */

function emptyProgress(size = DEFAULT_SIZE) {
  return {
    version: 1,
    cards: {}, // id → { b: boîte, s: vues, c: réussites, w: erreurs, t: dernière réponse, r: 1 si la carte est en Revanche }
    stats: { sessions: 0, answers: 0, correct: 0, byCat: { mots: { a: 0, c: 0 }, expr: { a: 0, c: 0 }, def: { a: 0, c: 0 } } },
    days: [], // jours d'activité (AAAA-MM-JJ, heure locale)
    settings: { size },
  };
}

function sanitizeProgress(raw) {
  if (!raw || typeof raw !== "object") return emptyProgress();
  const count = (value) => (Number.isFinite(value) && value > 0 ? Math.floor(value) : 0);
  const cards = {};
  if (raw.cards && typeof raw.cards === "object") {
    for (const [id, entry] of Object.entries(raw.cards)) {
      if (!CARD_BY_ID[id] || !entry || typeof entry !== "object") continue;
      const b = Math.min(MAX_BOX, Math.max(1, count(entry.b) || 1));
      const w = count(entry.w);
      // Progression enregistrée avant le champ r : en Revanche si la dernière réponse était fausse.
      const r = entry.r === undefined ? (w > 0 && b === 1 ? 1 : 0) : entry.r ? 1 : 0;
      cards[id] = { b, s: count(entry.s), c: count(entry.c), w, t: count(entry.t), r };
    }
  }
  const stats = raw.stats && typeof raw.stats === "object" ? raw.stats : {};
  const byCat = {};
  for (const cat of CAT_KEYS) byCat[cat] = { a: count(stats.byCat?.[cat]?.a), c: count(stats.byCat?.[cat]?.c) };
  const days = Array.isArray(raw.days)
    ? [...new Set(raw.days.filter((day) => typeof day === "string" && /^\d{4}-\d{2}-\d{2}$/.test(day)))].sort().slice(-400)
    : [];
  const size = SESSION_SIZES.includes(raw.settings?.size) ? raw.settings.size : DEFAULT_SIZE;
  return {
    version: 1,
    cards,
    stats: { sessions: count(stats.sessions), answers: count(stats.answers), correct: count(stats.correct), byCat },
    days,
    settings: { size },
  };
}

const boxOf = (progress, id) => progress.cards[id]?.b ?? 1;

function dayKey(date = new Date()) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

// Jours consécutifs jusqu'à aujourd'hui (ou hier, si la journée n'est pas encore jouée).
function currentStreak(days) {
  const played = new Set(days);
  const cursor = new Date();
  if (!played.has(dayKey(cursor))) cursor.setDate(cursor.getDate() - 1);
  let streak = 0;
  while (played.has(dayKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

// Une erreur met la carte en Revanche ; seule une bonne réponse pendant une Revanche (rematch) l'en retire.
function recordAnswer(progress, card, ok, firstOfSession, rematch = false) {
  const prev = progress.cards[card.id] || { b: 1, s: 0, c: 0, w: 0, t: 0, r: 0 };
  const inRematch = !ok ? 1 : rematch ? 0 : prev.r ? 1 : 0;
  const box = ok ? Math.min(MAX_BOX, prev.b + 1) : 1;
  const catStats = progress.stats.byCat[card.cat];
  const today = dayKey();
  return {
    ...progress,
    cards: {
      ...progress.cards,
      [card.id]: { b: box, s: prev.s + 1, c: prev.c + (ok ? 1 : 0), w: prev.w + (ok ? 0 : 1), t: Date.now(), r: inRematch },
    },
    stats: {
      ...progress.stats,
      sessions: progress.stats.sessions + (firstOfSession ? 1 : 0),
      answers: progress.stats.answers + 1,
      correct: progress.stats.correct + (ok ? 1 : 0),
      byCat: { ...progress.stats.byCat, [card.cat]: { a: catStats.a + 1, c: catStats.c + (ok ? 1 : 0) } },
    },
    days: progress.days.includes(today) ? progress.days : [...progress.days, today].slice(-400),
  };
}

const GRADES = [
  { grade: "A", min: 100, max: TOTAL },
  { grade: "B", min: 75, max: 99 },
  { grade: "C", min: 50, max: 74 },
  { grade: "D", min: 0, max: 49 },
];
// Les 5 boîtes de Leitner, présentées comme des niveaux.
const LEVEL_NAMES = ["À apprendre", "En cours", "Retenue", "Solide", "Maîtrisée"];

// Ce que devient une carte après une réponse, en une courte phrase.
function levelMove(from, to, ok) {
  if (!ok) return from === 1 ? "Reste au niveau 1" : `Niveau ${from} → 1`;
  if (from === MAX_BOX) return "Niveau 5 · maîtrisée";
  return `Niveau ${from} → ${to}${to === MAX_BOX ? " · maîtrisée" : ""}`;
}

const gradeFor = (mastered) => GRADES.find((g) => mastered >= g.min).grade;

function summarize(progress) {
  const boxes = [0, 0, 0, 0, 0];
  const masteredByCat = { mots: 0, expr: 0, def: 0 };
  let unseen = 0;
  let toReview = 0;
  for (const card of CARDS) {
    const entry = progress.cards[card.id];
    const box = entry?.b ?? 1;
    boxes[box - 1] += 1;
    if (!entry || !entry.s) unseen += 1;
    if (box === MAX_BOX) masteredByCat[card.cat] += 1;
    if (entry?.r) toReview += 1;
  }
  const mastered = boxes[MAX_BOX - 1];
  return { boxes, unseen, mastered, masteredByCat, toReview, streak: currentStreak(progress.days), grade: gradeFor(mastered) };
}

/* ------------------------------------------------- Algorithme de révision -- */

// Le tirage favorise les boîtes basses.
const DRAW_WEIGHT = { 1: 16, 2: 8, 3: 4, 4: 2, 5: 1 };
// Position de retour dans la session (1 = carte suivante).
const RETRY_POSITION = [3, 5];
const RETURN_POSITION = { 2: [8, 12], 3: [14, 18], 4: [20, 26] };

const randInt = (min, max) => min + Math.floor(Math.random() * (max - min + 1));

function buildPool(mode, cats, progress) {
  // Revanche : les cartes ratées, tant qu'elles n'ont pas été réussies pendant une Revanche.
  if (mode === "errors") return CARDS.filter((card) => progress.cards[card.id]?.r).map((card) => card.id);
  return CARDS.filter((card) => cats.includes(card.cat)).map((card) => card.id);
}

// Tirage pondéré sans remise (Efraimidis–Spirakis).
function drawQueue(pool, progress, size) {
  return pool
    .map((id) => ({ id, key: Math.pow(Math.random(), 1 / DRAW_WEIGHT[boxOf(progress, id)]) }))
    .sort((a, b) => b.key - a.key)
    .slice(0, size)
    .map((item) => item.id);
}

// Ratée : revient 3 à 5 cartes plus loin. Réussie : beaucoup plus loin selon sa boîte,
// ou plus du tout dans cette session si la file est trop courte ou la carte maîtrisée.
function requeue(queue, id, ok, newBox) {
  const rest = queue.slice(1);
  if (!ok) {
    rest.splice(Math.min(randInt(...RETRY_POSITION) - 1, rest.length), 0, id);
  } else if (RETURN_POSITION[newBox]) {
    const at = randInt(...RETURN_POSITION[newBox]) - 1;
    if (at <= rest.length) rest.splice(at, 0, id);
  }
  return rest;
}

/* ---------------------------------------------------------------- Session -- */

// progress : copie de travail, enregistrée seulement à la fin de la partie.
function initSession({ config, progress }) {
  return { queue: config.queue, progress, turn: 0, phase: "answering", exit: null, input: "", hint: false, verdict: null, nextQueue: null, results: [] };
}

function sessionReducer(state, action) {
  switch (action.type) {
    case "input":
      return state.phase === "answering" ? { ...state, input: action.value } : state;
    case "hint":
      return { ...state, hint: true };
    case "answer": {
      if (state.phase !== "answering") return state;
      const { verdict } = action;
      return { ...state, phase: verdict.ok ? "correct" : "wrong", verdict, progress: action.progress, nextQueue: action.nextQueue, results: [...state.results, verdict] };
    }
    case "exit":
      if (state.phase !== "correct" && state.phase !== "wrong") return state;
      return { ...state, phase: "exiting", exit: action.kind };
    case "advance": {
      if (state.phase !== "exiting") return state;
      const turn = state.turn + 1;
      if (turn >= action.size || state.nextQueue.length === 0) return { ...state, turn, phase: "done" };
      return { ...state, queue: state.nextQueue, nextQueue: null, turn, phase: "answering", exit: null, input: "", hint: false, verdict: null };
    }
    default:
      return state;
  }
}

const cls = (...names) => names.filter(Boolean).join(" ");
const percent = (part, whole) => (whole ? Math.round((part / whole) * 100) : 0);
const plural = (n, one, many) => `${n} ${n > 1 ? many : one}`;

function usePrefersReducedMotion() {
  const query = "(prefers-reduced-motion: reduce)";
  const [reduced, setReduced] = useState(() => {
    try {
      return window.matchMedia(query).matches;
    } catch (err) {
      return false;
    }
  });
  useEffect(() => {
    let media;
    try {
      media = window.matchMedia(query);
    } catch (err) {
      return undefined;
    }
    const onChange = () => setReduced(media.matches);
    media.addEventListener?.("change", onChange);
    return () => media.removeEventListener?.("change", onChange);
  }, []);
  return reduced;
}

/* ------------------------------------------------------------------ Icônes -- */

// Icônes de la maquette : trait de 2 px, bouts arrondis.
const Icon = ({ d, size = 18, stroke = 2 }) => (
  <svg className="cl-icon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={d} />
  </svg>
);
const IconCheck = (p) => <Icon d="M5 12.5 10 17.5 19 7" stroke={3} {...p} />;
const IconCross = (p) => <Icon d="M6 6l12 12M18 6 6 18" stroke={2.6} {...p} />;
const IconChevron = (p) => <Icon d="M6 9l6 6 6-6" stroke={2.2} {...p} />;
const IconChevronRight = (p) => <Icon d="M9 6l6 6-6 6" stroke={2.2} {...p} />;
const IconInfo = (p) => <Icon d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 11v5.5M12 7.5v.01" {...p} />;
const IconFlame = (p) => <Icon d="M12 2.5c.8 3.2 4.8 5.4 4.8 10.1a4.8 4.8 0 0 1-9.6 0c0-2.3 1.1-3.8 2.3-4.8.1 1.5.8 2.6 2 3 0-2.9-.6-5.6.5-8.3z" {...p} />;
const IconStack = (p) => <Icon d="M9 3.5h10v13H9zM5.5 7v13.5h10" {...p} />;
const IconBubble = (p) => <Icon d="M4 5h16v11H9.5L4 20z" stroke={2.2} {...p} />;
const IconBook = (p) => <Icon d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3zM5 17a3 3 0 0 1 3-3h11" stroke={2.2} {...p} />;
const IconNext = (p) => <Icon d="M5 12h14M13 6l6 6-6 6" stroke={2.4} {...p} />;
const IconHome = (p) => <Icon d="M3 10.5 12 3l9 7.5M5 9.5V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9.5" {...p} />;
const IconUser = (p) => <Icon d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21c0-4 3.6-7 8-7s8 3 8 7" {...p} />;
const IconPodium = (p) => <Icon d="M3 21v-8h6v8M9 21V7h6v14M15 21v-6h6v6" {...p} />;
const IconLogout = (p) => <Icon d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l5-5-5-5M15 12H4" {...p} />;
const IconRefresh = (p) => <Icon d="M20 11a8 8 0 0 0-14.3-4.9L4 8M4 3v5h5M4 13a8 8 0 0 0 14.3 4.9L20 16M20 21v-5h-5" {...p} />;
const IconPencil = (p) => <Icon d="M4 20h4L19 9l-4-4L4 16z" stroke={2.2} {...p} />;
const IconReplay = (p) => <Icon d="M3 12a9 9 0 1 0 3-6.7M3 4v5h5" stroke={2.6} {...p} />;
const IconPlay = ({ size = 18 }) => (
  <svg className="cl-icon" width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
    <path d="M7 4.5v15l13-7.5z" fill="currentColor" />
  </svg>
);
const IconCup = ({ size = 24 }) => (
  <svg className="cl-icon cl-cup" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M8 4h8v5a4 4 0 0 1-8 0z" fill="currentColor" />
    <path d="M8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8.5 20h7" />
  </svg>
);

// Logo : deux cartes, celle de devant en jaune.
const Logo = ({ size = 32 }) => (
  <svg className="cl-logo" width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <rect x="7.5" y="2.5" width="13" height="15" rx="2.5" stroke="#8A8EAE" strokeWidth="1.6" />
    <rect x="3.5" y="6.5" width="13" height="15" rx="2.5" fill="#FFC93C" />
  </svg>
);

// Pictogramme de chaque catégorie.
function CatGlyph({ cat, size = 18 }) {
  if (cat === "mots") return <span className="cl-glyph-text">Aa</span>;
  if (cat === "expr") return <IconBubble size={size} />;
  return <IconBook size={size} />;
}

// Carré coloré de la catégorie, avec son pictogramme.
function CatIcon({ cat, size = 34 }) {
  return (
    <span className="cl-cat-icon" data-cat={cat} style={{ "--s": `${size}px` }} aria-hidden="true">
      <CatGlyph cat={cat} size={Math.round(size * 0.53)} />
    </span>
  );
}

/* -------------------------------------------------------------- Composants -- */

function Badge({ cat }) {
  return (
    <span className="cl-badge" data-cat={cat}>
      {CATEGORIES[cat].badge}
    </span>
  );
}

// Définition affichée sans le nom du terme : ses occurrences deviennent des blancs.
function DefinitionText({ card, reveal }) {
  const pattern = new RegExp(`(${card.masks.map((m) => m.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "giu");
  const parts = card.fr.split(pattern);
  return (
    <p className="cl-card-def">
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <span key={i} className={cls("cl-blank", reveal && "is-revealed")} aria-label={reveal ? part : "terme masqué"}>
            {reveal ? part : " ".repeat(6)}
          </span>
        ) : (
          <React.Fragment key={i}>{part}</React.Fragment>
        )
      )}
    </p>
  );
}

function Meter({ value, max, tone }) {
  return (
    <span className="cl-meter" data-tone={tone} role="presentation">
      <span style={{ width: `${max ? (value / max) * 100 : 0}%` }} />
    </span>
  );
}

function StorageNotice({ state }) {
  if (state === "ok") return null;
  return (
    <p className="cl-notice" role="status">
      {state === "unavailable"
        ? "La sauvegarde n'est pas disponible ici : ta progression sera perdue en fermant la page."
        : "La dernière sauvegarde a échoué. Tes réponses restent comptées et seront réenregistrées à la prochaine réponse."}
    </p>
  );
}

// Initiale du pseudo dans une pastille ronde.
function Avatar({ name, size = 44, tone = "yellow" }) {
  const initial = (name || "").trim().charAt(0).toUpperCase();
  return (
    <span className="cl-avatar" data-tone={tone} style={{ "--s": `${size}px` }} aria-hidden="true">
      {initial || <IconUser size={Math.round(size * 0.45)} />}
    </span>
  );
}

// Série de jours joués d'affilée (flamme).
function StreakPill({ days, short = false }) {
  return (
    <span className="cl-streak" aria-label={`Série : ${plural(days, "jour", "jours")} de suite`}>
      <IconFlame size={17} />
      <span className="cl-streak-n">{days}</span>
      <span className="cl-streak-label">{short ? (days > 1 ? "jours" : "jour") : days > 1 ? "jours de suite" : "jour de suite"}</span>
    </span>
  );
}

// Niveau d'une carte : 5 points, pleins jusqu'au niveau.
function LevelDots({ level, tone = "paper", size = 8 }) {
  return (
    <span className="cl-dots" data-tone={tone} style={{ "--s": `${size}px` }} role="img" aria-label={`Niveau ${level} sur ${MAX_BOX}`}>
      {Array.from({ length: MAX_BOX }, (_, i) => (
        <span key={i} className={cls(i < level && "is-on")} />
      ))}
    </span>
  );
}

// Barre de note : un segment par note (D, C, B, A), large comme le nombre de cartes qu'il couvre.
// before : cartes maîtrisées avant la partie ; l'écart est dessiné en jaune clair.
const GRADE_SPANS = [...GRADES].reverse().map((g) => ({ ...g, size: g.max - g.min + 1 }));
const ratio = (value, g) => Math.min(1, Math.max(0, (value - g.min) / g.size));

function GradeBar({ mastered, before = mastered, scale = "short" }) {
  const current = gradeFor(mastered);
  return (
    <div className="cl-gradebar" data-scale={scale}>
      <div className="cl-gradebar-track" role="img" aria-label={`${plural(mastered, "carte maîtrisée", "cartes maîtrisées")} sur ${TOTAL} : note ${current}`}>
        {GRADE_SPANS.map((g) => {
          const base = ratio(Math.min(before, mastered), g);
          const fill = ratio(mastered, g);
          return (
            <span key={g.grade} className="cl-gradebar-seg" style={{ flex: g.size }}>
              {base > 0 && <span className="cl-gradebar-fill" style={{ width: `${base * 100}%` }} />}
              {fill > base && <span className="cl-gradebar-gain" style={{ left: `${base * 100}%`, width: `${(fill - base) * 100}%` }} />}
            </span>
          );
        })}
      </div>
      <div className="cl-gradebar-labels" aria-hidden="true">
        {GRADE_SPANS.map((g) => (
          <span key={g.grade} className={cls(g.grade === current && "is-current")} style={{ flex: g.size }}>
            {scale === "long" ? (
              <>
                <b>{g.grade}</b>
                <small>{g.grade === "A" ? `${g.min}+` : `${g.min}–${g.max}`}</small>
              </>
            ) : g.min ? (
              `${g.grade}·${g.min}`
            ) : (
              g.grade
            )}
          </span>
        ))}
      </div>
    </div>
  );
}

// Note suivante à viser, et le nombre de cartes qui manquent.
function nextGradeFor(mastered) {
  const next = GRADES.slice().reverse().find((g) => g.min > mastered);
  return next ? { grade: next.grade, missing: next.min - mastered } : null;
}

// Texte d'une réponse comparée, avec les lettres fausses, manquantes ou à corriger mises en évidence.
function Marked({ segments }) {
  return segments.map(({ kind, text }, i) =>
    kind === "bad" ? (
      <strong key={i} className="cl-diff-bad">
        {text}
      </strong>
    ) : kind === "gap" ? (
      <span key={i} className="cl-diff-gap" title={text.length > 1 ? "Lettres manquantes" : "Lettre manquante"}>
        {text}
      </span>
    ) : kind === "fix" ? (
      <mark key={i} className="cl-diff-fix">
        {text}
      </mark>
    ) : (
      <React.Fragment key={i}>{text}</React.Fragment>
    )
  );
}

const TYPO_WORDS = ["", "une faute", "deux fautes", "trois fautes"];
const LETTERS = ["A", "B", "C", "D"];

// Les propositions d'une carte en QCM (A à D) ; touches 1 à 4 ou A à D pour choisir au clavier.
function Choices({ card, verdict, disabled, onChoose, onOptions }) {
  const [options] = useState(() => makeChoices(card));
  useEffect(() => {
    onOptions?.(options);
  }, [options, onOptions]);
  useEffect(() => {
    if (disabled) return undefined;
    const onKey = (event) => {
      if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey || document.querySelector("dialog[open]")) return;
      const key = event.key.toUpperCase();
      const n = LETTERS.includes(key) ? LETTERS.indexOf(key) : Number(key) - 1;
      if (n >= 0 && n < options.length) {
        event.preventDefault();
        onChoose(options[n].text);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [disabled, options, onChoose]);
  return (
    <div className="cl-choices" role="group" aria-labelledby="cl-choices-label">
      <span id="cl-choices-label" className="cl-sr">
        Propositions
      </span>
      {options.map(({ text, segments }, i) => {
        const right = verdict && text === card.en;
        const chosen = verdict && text === verdict.input;
        return (
          <button
            key={text}
            type="button"
            className={cls("cl-choice", right && "is-right", chosen && !right && "is-wrong", verdict && !right && !chosen && "is-off")}
            disabled={disabled}
            aria-keyshortcuts={`${i + 1} ${LETTERS[i]}`}
            onClick={() => onChoose(text)}
          >
            <span className="cl-choice-key" aria-hidden="true">
              {right ? <IconCheck size={18} /> : chosen ? <IconCross size={16} /> : LETTERS[i]}
            </span>
            <span className="cl-choice-text">{verdict && segments ? <Marked segments={segments} /> : text}</span>
            {chosen && <span className="cl-sr">{right ? " (ton choix, juste)" : " (ton choix)"}</span>}
          </button>
        );
      })}
    </div>
  );
}

// Revanche : erreurs faites sur cette carte pendant la partie.
function Strikes({ count }) {
  return (
    <span className="cl-strikes" role="img" aria-label={`${count} erreur${count > 1 ? "s" : ""} sur ${MAX_REMATCH_ERRORS} pour cette carte`}>
      {Array.from({ length: MAX_REMATCH_ERRORS }, (_, i) => (
        <span key={i} className={cls("cl-strike", i < count && "is-used")}>
          <IconCross size={11} />
        </span>
      ))}
    </span>
  );
}

// Ce que devient la carte, dans le panneau de résultat.
function levelLine({ ok, from, to }) {
  if (!ok) return from === 1 ? "La carte reste au niveau 1" : "Retour au niveau 1";
  if (from === MAX_BOX) return "La carte reste maîtrisée";
  return to === MAX_BOX ? "Carte maîtrisée : niveau 5\u00a0!" : `La carte monte au niveau ${to}`;
}

// Panneau qui monte du bas après une réponse : vert (bonne réponse) ou rouge (erreur), avec « Continuer ».
function ResultSheet({ verdict, card, choice, letter, rematch, misses, autoMs, onContinue, buttonRef }) {
  const { ok } = verdict;
  const title = ok ? "Bien joué\u00a0!" : choice ? `C'était la réponse ${letter}` : verdict.input ? "Pas tout à fait" : "À retenir";
  return (
    <section className={cls("cl-sheet", "cl-verdict", ok ? "cl-verdict--ok" : "cl-verdict--bad")} aria-live="polite" aria-labelledby="cl-sheet-title">
      {autoMs > 0 && <span className="cl-countdown" style={{ animationDuration: `${autoMs}ms` }} />}
      <div className="cl-sheet-head">
        <span className="cl-sheet-icon" aria-hidden="true">
          {ok ? <IconCheck size={22} /> : <IconCross size={20} />}
        </span>
        <div className="cl-sheet-text">
          <h2 id="cl-sheet-title" className="cl-verdict-title">
            {title}
          </h2>
          {ok && verdict.near && <span className="cl-near-note">Acceptée à {TYPO_WORDS[verdict.typos]} près</span>}
          {!ok && !choice && verdict.input && <span className="cl-verdict-label">Réponse attendue</span>}
          {(!choice || !ok) && <span className="cl-answer-text">{verdict.expected ? <Marked segments={verdict.expected} /> : card.en}</span>}
          {!choice && verdict.input && verdict.given && (
            <span className="cl-given">
              Ta réponse&nbsp;: <Marked segments={verdict.given} />
            </span>
          )}
          {!ok && !choice && verdict.input && !verdict.given && <span className="cl-given">Ta réponse&nbsp;: {verdict.input}</span>}
          {!verdict.input && <span className="cl-given">Carte passée avec «\u00a0Je ne sais pas\u00a0».</span>}
        </div>
      </div>
      {rematch && !ok && (
        <p className="cl-strike-note">
          {verdict.setAside
            ? `Erreur ${MAX_REMATCH_ERRORS} sur ${MAX_REMATCH_ERRORS}\u00a0: la carte reste dans la Revanche pour la prochaine fois.`
            : `Erreur ${misses} sur ${MAX_REMATCH_ERRORS}${misses === MAX_REMATCH_ERRORS - 1 ? "\u00a0: plus qu'une chance." : "."}`}
        </p>
      )}
      <div className="cl-sheet-level">
        <span>{levelLine(verdict)}</span>
        <LevelDots level={verdict.to} tone={ok ? "ok" : "bad"} size={10} />
      </div>
      <button type="button" ref={buttonRef} className={cls("cl-cta", ok ? "cl-cta--ok" : "cl-cta--bad", "cl-answer-next")} onClick={onContinue}>
        Continuer <IconNext size={18} />
      </button>
    </section>
  );
}

function Session({ config, progress: initialProgress, onEnd, onQuit, reducedMotion }) {
  const [state, dispatch] = useReducer(sessionReducer, { config, progress: initialProgress }, initSession);
  const { progress } = state;
  const inputRef = useRef(null);
  const nextRef = useRef(null);
  const revealedAt = useRef(0);
  const onEndRef = useRef(onEnd);
  onEndRef.current = onEnd;
  const [options, setOptions] = useState(null); // propositions du QCM affiché, pour « C'était la réponse B »

  const { phase, verdict } = state;
  const card = CARD_BY_ID[state.queue[0]];
  const answeredPhase = phase === "correct" || phase === "wrong";
  // Une bonne réponse continue seule ; une erreur attend « Continuer ».
  const autoMs = phase === "correct" ? verdict.revealMs : 0;

  // Enchaînement des phases : retour → départ de la carte → carte suivante.
  useEffect(() => {
    let timer;
    if (phase === "correct") timer = setTimeout(() => dispatch({ type: "exit", kind: "back" }), state.verdict.revealMs);
    else if (phase === "exiting") {
      const duration = reducedMotion ? EXIT_REDUCED_MS : state.exit === "back" ? EXIT_BACK_MS : EXIT_SIDE_MS;
      timer = setTimeout(() => dispatch({ type: "advance", size: config.size }), duration);
    } else if (phase === "done") onEndRef.current(state.results, state.progress);
    return () => clearTimeout(timer);
  }, [phase, state.exit, state.turn, state.results, state.progress, config.size, reducedMotion]);

  // Focus : le champ à chaque nouvelle carte. Après une erreur (ou en QCM), le bouton « Continuer » :
  // sur téléphone, le clavier se ferme et laisse voir le panneau.
  const choice = !!card && !!CATEGORIES[card.cat].choices;
  useEffect(() => {
    if (phase === "answering") inputRef.current?.focus({ preventScroll: true });
    else if (phase === "wrong" || (phase === "correct" && choice)) nextRef.current?.focus({ preventScroll: true });
  }, [phase, state.turn, choice]);

  if (phase === "done" || !card) return null;
  const rematch = config.mode === "errors";
  const misses = state.results.filter((r) => r.id === card.id && !r.ok).length; // erreurs sur cette carte dans la partie

  // input vide : « Je ne sais pas ». En QCM, input est la proposition choisie.
  const answer = (input) => {
    if (phase !== "answering") return;
    const result = !input
      ? { ok: false, near: false, typos: 0, given: null, expected: null }
      : choice
        ? { ok: input === card.en, near: false, typos: 0, given: null, expected: null }
        : grade(card, input);
    const from = boxOf(progress, card.id);
    const to = result.ok ? Math.min(MAX_BOX, from + 1) : 1;
    const revealMs = result.near ? NEAR_MS : FEEDBACK_MS;
    // Revanche : à la 3e erreur, la carte est mise de côté jusqu'à la prochaine partie.
    const setAside = rematch && !result.ok && misses + 1 >= MAX_REMATCH_ERRORS;
    revealedAt.current = Date.now();
    dispatch({
      type: "answer",
      verdict: { id: card.id, input, ...result, from, to, revealMs, setAside },
      progress: recordAnswer(progress, card, result.ok, state.turn === 0, rematch),
      nextQueue: setAside ? state.queue.slice(1) : requeue(state.queue, card.id, result.ok, to),
    });
  };

  const next = () => {
    if (answeredPhase && Date.now() - revealedAt.current > 300) dispatch({ type: "exit", kind: verdict.ok ? "back" : "side" });
  };

  const submit = (event) => {
    event.preventDefault();
    if (phase === "answering") {
      const value = state.input.trim();
      if (value) answer(value);
    } else next();
  };

  const keepFocus = (event) => event.preventDefault(); // évite de fermer le clavier mobile

  const answered = state.results.length;
  const pending = state.nextQueue ?? state.queue.slice(1);
  const upcoming = Math.max(0, Math.min(config.size - state.turn - 1, pending.length));
  const total = Math.min(config.size, state.turn + 1 + upcoming);
  const backCount = Math.min(2, upcoming);
  const shift = phase === "exiting" ? 1 : 0;
  const level = verdict ? verdict.from : boxOf(progress, card.id);
  const letter = options ? LETTERS[options.findIndex((o) => o.text === card.en)] : "";
  const frSize = card.fr.length > 110 ? "is-xlong" : card.fr.length > 60 ? "is-long" : choice ? "is-mid" : null;

  return (
    <div className={cls("cl-run", verdict && phase !== "exiting" && "has-sheet")}>
      <div className="cl-run-bar">
        <button type="button" className="cl-run-close" onClick={onQuit} aria-label="Quitter la partie" aria-haspopup="dialog" title="Quitter la partie">
          <IconCross size={22} />
        </button>
        <span className="cl-run-meter" role="progressbar" aria-label="Progression de la partie" aria-valuemin={0} aria-valuemax={total} aria-valuenow={answered}>
          <span style={{ width: `${percent(answered, total)}%` }} />
        </span>
        <span className="cl-session-count" aria-label={`${rematch ? "Revanche, " : ""}carte ${state.turn + 1} sur ${total}`}>
          {state.turn + 1}
          <span>/{total}</span>
        </span>
        {rematch && <Strikes count={misses} />}
      </div>

      <div className="cl-deck">
        {Array.from({ length: backCount }, (_, i) => {
          const depth = i + 1 - shift;
          return <div key={`b${state.turn + i + 1}`} className="cl-card cl-card--back" data-depth={depth} aria-hidden="true" />;
        })}
        <article
          key={`f${state.turn}`}
          className={cls(
            "cl-card",
            "cl-card--front",
            choice && "is-choice",
            verdict && (verdict.ok ? "is-correct" : "is-wrong"),
            phase === "exiting" && (reducedMotion ? "is-exit-fade" : `is-exit-${state.exit}`)
          )}
        >
          <header className="cl-card-head">
            <span className="cl-pill" data-cat={card.cat}>
              <CatGlyph cat={card.cat} size={13} />
              <span>{CATEGORIES[card.cat].badge}</span>
            </span>
            <span className="cl-card-level">
              <span>Niveau</span>
              <LevelDots level={level} />
            </span>
          </header>
          {card.cat === "def" ? (
            <DefinitionText card={card} reveal={state.hint || !!verdict} />
          ) : (
            <h1 className={cls("cl-card-fr", frSize)}>{card.fr}</h1>
          )}
          {card.cat === "def" && (state.hint || verdict) && (
            <p className="cl-hint">
              Terme français&nbsp;: <strong>{card.hint}</strong>
            </p>
          )}
          <p className="cl-card-foot">
            <span className="cl-card-dir">FR → EN</span>
            <span>{CATEGORIES[card.cat].instruction}</span>
          </p>
        </article>
      </div>

      <form className="cl-answer" onSubmit={submit} autoComplete="off">
        {choice ? (
          <Choices key={`c${state.turn}`} card={card} verdict={verdict} disabled={phase !== "answering"} onChoose={answer} onOptions={setOptions} />
        ) : (
          <>
            <label htmlFor="cl-answer-input" className="cl-answer-label">
              Ta réponse en anglais
            </label>
            <input
              id="cl-answer-input"
              ref={inputRef}
              className={cls("cl-input", verdict && (verdict.ok ? "is-correct" : "is-wrong"))}
              value={state.input}
              onChange={(event) => dispatch({ type: "input", value: event.target.value })}
              readOnly={phase !== "answering"}
              placeholder="Tape ta traduction…"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              enterKeyHint="done"
            />
            {!verdict && (
              <button type="submit" className="cl-cta cl-validate" onMouseDown={keepFocus} disabled={phase !== "answering" || !state.input.trim()}>
                Valider
              </button>
            )}
          </>
        )}
        <div className="cl-answer-actions">
          <button type="button" className="cl-quiet" onMouseDown={keepFocus} onClick={() => answer("")} disabled={phase !== "answering"}>
            Je ne sais pas
          </button>
          {card.cat === "def" && (
            <button type="button" className="cl-quiet" onMouseDown={keepFocus} onClick={() => dispatch({ type: "hint" })} disabled={phase !== "answering" || state.hint}>
              Indice
            </button>
          )}
          <span className="cl-answer-tip">{choice ? "Touches A à D (ou 1 à 4)" : "Entrée pour valider"}</span>
        </div>
      </form>

      {verdict && phase !== "exiting" && (
        <ResultSheet
          verdict={verdict}
          card={card}
          choice={choice}
          letter={letter}
          rematch={rematch}
          misses={misses}
          autoMs={autoMs}
          onContinue={next}
          buttonRef={nextRef}
        />
      )}
    </div>
  );
}

const NAV_ITEMS = [
  { id: "home", label: "Accueil", Glyph: IconHome },
  { id: "profile", label: "Profil", Glyph: IconUser },
  { id: "ranking", label: "Classement", Glyph: IconPodium },
];

// Mobile : barre d'onglets en bas. Desktop : barre du haut avec libellés, série, avatar et déconnexion.
// Absente pendant une partie (sa propre barre a la croix pour quitter) et en fin de partie.
function NavBar({ screen, onNavigate, account, onSignOut, leaving, streak, pseudo }) {
  const active = screen;
  const logoutLabel = leaving ? "Déconnexion en cours" : account?.email ? `Se déconnecter (${account.email})` : "Se déconnecter";
  return (
    <>
      <header className="cl-nav cl-topbar">
        <div className="cl-topbar-inner">
          <button type="button" className="cl-topbar-logo" onClick={() => onNavigate("home")} aria-label="CardLearn, accueil" title="CardLearn">
            <Logo />
          </button>
          <nav className="cl-topbar-links" aria-label="Navigation principale">
            {NAV_ITEMS.map(({ id, label, Glyph }) => (
              <button key={id} type="button" className="cl-topbar-link" aria-current={active === id ? "page" : undefined} onClick={() => onNavigate(id)}>
                <Glyph size={18} />
                <span>{label}</span>
              </button>
            ))}
          </nav>
          <div className="cl-topbar-end">
            <StreakPill days={streak} short />
            <button type="button" className="cl-topbar-avatar" onClick={() => onNavigate("profile")} aria-label="Mon profil" title="Mon profil">
              <Avatar name={pseudo} size={44} />
            </button>
            {onSignOut && (
              <button type="button" className="cl-nav-logout" onClick={onSignOut} disabled={leaving} aria-label={logoutLabel} title={logoutLabel}>
                <IconLogout size={18} />
              </button>
            )}
          </div>
        </div>
      </header>
      <nav className="cl-nav cl-tabbar" aria-label="Navigation principale">
        {NAV_ITEMS.map(({ id, label, Glyph }) => (
          <button key={id} type="button" className="cl-tab" aria-current={active === id ? "page" : undefined} onClick={() => onNavigate(id)}>
            <span className="cl-tab-icon">
              <Glyph size={20} />
            </span>
            <span>{label}</span>
          </button>
        ))}
      </nav>
    </>
  );
}

// Coupe du podium : or, argent ou bronze.
function Trophy({ medal, size = 40 }) {
  return (
    <svg className="cl-trophy" data-medal={medal} width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path className="cl-trophy-handles" d="M7 5H4.2v1.4A3.6 3.6 0 0 0 7.8 10M17 5h2.8v1.4A3.6 3.6 0 0 1 16.2 10" />
      <path d="M6.8 3h10.4v5.6a5.2 5.2 0 0 1-10.4 0z" />
      <path d="M10.2 13.6h3.6l.6 3.6H9.6z" />
      <path d="M7.4 17.2h9.2v3.6H7.4z" />
    </svg>
  );
}

const MEDALS = { 1: "gold", 2: "silver", 3: "bronze" };
const ordinal = (n) => (n === 1 ? "1er" : `${n}e`);

// Places du podium : 2e à gauche, 1er au centre, 3e à droite (ordre visuel géré en CSS).
function Podium({ entries }) {
  const slots = [0, 1, 2].map((i) => entries[i] || null);
  return (
    <ol className="cl-podium" aria-label="Podium">
      {slots.map((entry, i) => {
        const medal = entry ? MEDALS[entry.rank] || "none" : "none";
        return (
          <li key={i} className={cls("cl-podium-slot", entry?.is_me && "is-me")} data-place={i + 1}>
            {entry ? (
              <>
                {medal !== "none" ? <Trophy medal={medal} size={i === 0 ? 56 : 44} /> : <span className="cl-podium-spacer" />}
                <span className="cl-podium-name">
                  {entry.pseudo}
                  {entry.is_me && <span className="cl-me-tag">toi</span>}
                </span>
                <span className="cl-podium-score">{plural(entry.mastered, "carte", "cartes")}</span>
              </>
            ) : (
              <span className="cl-podium-empty">Place libre</span>
            )}
            <span className="cl-podium-step" data-medal={medal}>
              {entry ? entry.rank : i + 1}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function PseudoForm({ initial = "", submitLabel, onSubmit, onCancel }) {
  const [value, setValue] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const pseudo = value.trim();
  const valid = pseudo.length >= 2 && pseudo.length <= 20;
  return (
    <form
      className="cl-pseudo-form"
      onSubmit={async (event) => {
        event.preventDefault();
        if (!valid || busy) return;
        setBusy(true);
        setError("");
        try {
          await onSubmit(pseudo);
        } catch (err) {
          setError(err?.message || "L'enregistrement du pseudo a échoué. Réessaie.");
          setBusy(false);
        }
      }}
    >
      <label htmlFor="pseudo-input">Ton pseudo</label>
      <div className="cl-pseudo-row">
        <input
          id="pseudo-input"
          className="cl-pseudo-input"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          maxLength={20}
          autoComplete="nickname"
          placeholder="2 à 20 caractères"
          autoFocus
        />
        <button type="submit" className="cl-btn cl-btn--primary" disabled={!valid || busy}>
          {busy ? "Enregistrement…" : submitLabel}
        </button>
        {onCancel && (
          <button type="button" className="cl-btn" onClick={onCancel} disabled={busy}>
            Annuler
          </button>
        )}
      </div>
      <p className="cl-pseudo-hint">Ton pseudo est visible par les autres élèves. Ton adresse e-mail ne l'est jamais.</p>
      {error && (
        <p className="cl-confirm-error" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}

// leaderboard : fourni par le site connecté (load, join, leave). Absent dans un artifact ou hors connexion.
// board : classement chargé par l'appli ; onReload le recharge (à l'ouverture de l'écran et après un changement).
function Ranking({ summary, leaderboard, board: state, onReload: load }) {
  const [editing, setEditing] = useState(false);
  const [actionError, setActionError] = useState("");

  useEffect(() => {
    load();
  }, [load]);

  const join = async (pseudo) => {
    await leaderboard.join(pseudo);
    setEditing(false);
    await load();
  };
  const leave = async () => {
    setActionError("");
    try {
      await leaderboard.leave();
      await load();
    } catch (err) {
      setActionError(err?.message || "Impossible de quitter le classement pour le moment. Réessaie.");
    }
  };

  const head = (
    <header className="cl-page-head cl-page-head--split">
      <div>
        <h1>Classement</h1>
        <p className="cl-muted">Les élèves classés par nombre de cartes maîtrisées.</p>
      </div>
      {state.status === "ready" && state.pseudo && (
        <button type="button" className="cl-btn cl-btn--sm" onClick={load} disabled={state.refreshing}>
          {state.refreshing ? "Actualisation…" : "Actualiser"}
        </button>
      )}
    </header>
  );

  if (state.status === "offline") {
    return (
      <div className="cl-wrap">
        {head}
        <section className="cl-panel">
          <p>Le classement nécessite un compte : connecte-toi sur le site CardLearn pour affronter les autres élèves.</p>
          <p className="cl-muted">Tu as pour l'instant {plural(summary.mastered, "carte maîtrisée", "cartes maîtrisées")}.</p>
        </section>
      </div>
    );
  }
  if (state.status === "loading") {
    return (
      <div className="cl-wrap">
        {head}
        <p className="cl-loading cl-loading--inline" role="status">
          <span className="cl-spinner" aria-hidden="true" />
          Chargement du classement…
        </p>
      </div>
    );
  }
  if (state.status === "error") {
    return (
      <div className="cl-wrap">
        {head}
        <section className="cl-panel">
          <p role="alert">{state.message}</p>
          <button type="button" className="cl-btn" onClick={load}>
            Réessayer
          </button>
        </section>
      </div>
    );
  }

  const entries = state.entries || [];
  const me = entries.find((e) => e.is_me);

  if (!state.pseudo) {
    return (
      <div className="cl-wrap">
        {head}
        <section className="cl-panel cl-join" aria-labelledby="join-title">
          <Trophy medal="gold" size={48} />
          <h2 id="join-title">Entre dans la compétition</h2>
          <p className="cl-muted">
            Choisis un pseudo pour apparaître dans le classement avec tes {plural(summary.mastered, "carte maîtrisée", "cartes maîtrisées")}.
            {entries.length ? ` ${plural(entries.length, "élève y participe", "élèves y participent")} déjà.` : ""}
          </p>
          <PseudoForm submitLabel="Rejoindre le classement" onSubmit={join} />
        </section>
      </div>
    );
  }

  return (
    <div className="cl-wrap">
      {head}
      {me && (
        <p className="cl-rank-summary">
          Tu es <strong>{ordinal(me.rank)}</strong> sur {entries.length} avec {plural(me.mastered, "carte maîtrisée", "cartes maîtrisées")}.
        </p>
      )}
      <Podium entries={entries} />
      {entries.length > 3 && (
        <ol className="cl-board" start={4} aria-label="Suite du classement">
          {entries.slice(3).map((entry, i) => (
            <li key={`${entry.pseudo}-${i}`} className={cls(entry.is_me && "is-me")}>
              <span className="cl-board-rank">{entry.rank}</span>
              <span className="cl-board-name">
                {entry.pseudo}
                {entry.is_me && <span className="cl-me-tag">toi</span>}
              </span>
              <span className="cl-board-score">{plural(entry.mastered, "carte", "cartes")}</span>
            </li>
          ))}
        </ol>
      )}
      <section className="cl-panel cl-pseudo-panel" aria-label="Ton pseudo">
        {editing ? (
          <PseudoForm initial={state.pseudo} submitLabel="Enregistrer" onSubmit={join} onCancel={() => setEditing(false)} />
        ) : (
          <div className="cl-pseudo-current">
            <span>
              Ton pseudo : <strong>{state.pseudo}</strong>
            </span>
            <span className="cl-actions">
              <button type="button" className="cl-btn cl-btn--sm" onClick={() => setEditing(true)}>
                Modifier
              </button>
              <button type="button" className="cl-btn cl-btn--sm cl-btn--danger-outline" onClick={leave}>
                Quitter le classement
              </button>
            </span>
          </div>
        )}
        {actionError && (
          <p className="cl-confirm-error" role="alert">
            {actionError}
          </p>
        )}
      </section>
    </div>
  );
}

// Accueil : salut, progression vers la note, nouvelle partie, revanche.
// Mobile : une colonne ; desktop : la nouvelle partie à gauche, progression et revanche à droite.
function Home({ progress, summary, cats, onCatsChange, onSizeChange, onStart, onProfile, storage, pseudo }) {
  const size = progress.settings.size;
  const pool = CARDS.filter((card) => cats.includes(card.cat)).length;
  const draw = Math.min(size, pool);
  const next = nextGradeFor(summary.mastered);
  const rematch = summary.toReview;
  // Au moins une catégorie reste sélectionnée.
  const toggle = (cat) => {
    if (!cats.includes(cat)) onCatsChange(CAT_KEYS.filter((c) => c === cat || cats.includes(c)));
    else if (cats.length > 1) onCatsChange(cats.filter((c) => c !== cat));
  };

  return (
    <div className="cl-home">
      <StorageNotice state={storage} />

      <header className="cl-home-head">
        <div className="cl-home-hello">
          <p>{progress.stats.sessions ? "Content de te revoir" : "Bienvenue sur CardLearn"}</p>
          <h1>{pseudo ? `Salut ${pseudo}` : "Salut"}</h1>
        </div>
        <StreakPill days={summary.streak} />
      </header>

      <div className="cl-home-grid">
        <section className="cl-progress cl-card-dark" aria-labelledby="prog-title">
          <div className="cl-progress-top">
            <div className="cl-progress-count">
              <h2 id="prog-title">Cartes maîtrisées</h2>
              <p className="cl-num">
                <span className="cl-num-big">{summary.mastered}</span>
                <span className="cl-num-of">/{TOTAL}</span>
              </p>
            </div>
            <div className="cl-progress-grade">
              <p className="cl-progress-next">
                <span>Note estimée</span>
                <strong>{next ? `encore ${next.missing} pour ${next.grade}` : "note maximale"}</strong>
              </p>
              <span className="cl-grade-badge" role="img" aria-label={`Note estimée ${summary.grade}`}>
                {summary.grade}
              </span>
            </div>
          </div>
          <GradeBar mastered={summary.mastered} />
          <p className="cl-progress-sentence">
            Note estimée {summary.grade}
            {next ? (
              <>
                {" "}· encore <strong>{plural(next.missing, "carte", "cartes")}</strong> pour viser {next.grade}
              </>
            ) : (
              " · note maximale, bravo\u00a0!"
            )}
          </p>
          <button type="button" className="cl-link cl-progress-link" onClick={onProfile}>
            Voir mon profil <IconNext size={15} />
          </button>
        </section>

        <section className="cl-play cl-indigo" aria-labelledby="play-title">
          <span className="cl-deco cl-deco--1" aria-hidden="true" />
          <span className="cl-deco cl-deco--2" aria-hidden="true" />
          <div className="cl-play-head">
            <h2 id="play-title">Nouvelle partie</h2>
            <p>
              Tirage parmi {pool} cartes<span className="cl-wide-only"> de vocabulaire anglais technique</span>
            </p>
          </div>

          <fieldset className="cl-modes">
            <legend className="cl-sr">Catégories</legend>
            {CAT_KEYS.map((cat) => {
              const on = cats.includes(cat);
              return (
                <label key={cat} className={cls("cl-mode", on && "is-on")} data-cat={cat}>
                  <input type="checkbox" id={`cat-${cat}`} className="cl-mode-input" checked={on} onChange={() => toggle(cat)} />
                  <span className="cl-mode-top">
                    <CatIcon cat={cat} size={34} />
                    {on && (
                      <span className="cl-mode-check" aria-hidden="true">
                        <IconCheck size={12} />
                      </span>
                    )}
                  </span>
                  <span className="cl-mode-name">{CATEGORIES[cat].label}</span>
                  <span className="cl-mode-foot">
                    <span className="cl-mode-meta">
                      {summary.masteredByCat[cat]}/{CAT_TOTAL[cat]}
                      <span className="cl-wide-only"> maîtrisées</span>
                    </span>
                    <span className="cl-mode-bar" aria-hidden="true">
                      <span style={{ width: `${percent(summary.masteredByCat[cat], CAT_TOTAL[cat])}%` }} />
                    </span>
                  </span>
                </label>
              );
            })}
          </fieldset>

          <div className="cl-play-foot">
            <div className="cl-rounds">
              <span className="cl-rounds-label" id="rounds-label">
                Cartes / partie
              </span>
              <div className="cl-rounds-options" role="radiogroup" aria-labelledby="rounds-label">
                {SESSION_SIZES.map((n) => (
                  <button key={n} type="button" role="radio" aria-checked={size === n} onClick={() => onSizeChange(n)}>
                    {n}
                  </button>
                ))}
              </div>
            </div>
            <button type="button" className="cl-cta cl-play-btn" onClick={() => onStart("learn")} aria-label={`Jouer, ${plural(draw, "carte", "cartes")}`}>
              <IconPlay size={18} />
              <span>Jouer</span>
              <span className="cl-cta-tag">{plural(draw, "carte", "cartes")}</span>
            </button>
          </div>
        </section>

        <section className={cls("cl-rematch cl-card-dark", !rematch && "is-empty")} aria-labelledby="rematch-title">
          <span className="cl-rematch-stack" aria-hidden="true">
            <span />
            <span id="errors-count">{rematch}</span>
          </span>
          <div className="cl-rematch-text">
            <h2 id="rematch-title">Revanche</h2>
            <p>{rematch ? `${plural(rematch, "carte ratée", "cartes ratées")} à retenter` : "Aucune carte à retenter. Bien joué\u00a0!"}</p>
          </div>
          <button type="button" className="cl-ghost cl-rematch-btn" disabled={!rematch} onClick={() => onStart("errors")} aria-label="Lancer la Revanche">
            Lancer <IconNext size={16} />
          </button>
        </section>
      </div>
    </div>
  );
}

// Toutes les tentatives d'une carte pendant la session, dans l'ordre.
function Attempts({ id, attempts }) {
  return (
    <ol id={`attempts-${id}`} className="cl-attempts">
      {attempts.map((a) => (
        <li key={a.turn} className={a.ok ? "is-ok" : "is-bad"}>
          <span className="cl-attempt-turn">Carte {a.turn}</span>
          <span className="cl-attempt-answer">
            {a.ok ? <IconCheck size={16} /> : <IconCross size={16} />}
            {a.input ? <span>{a.given ? <Marked segments={a.given} /> : a.input}</span> : <em>Je ne sais pas</em>}
            {a.near && <span className="cl-attempt-near">à {TYPO_WORDS[a.typos]} près</span>}
          </span>
          <span className="cl-attempt-box">{levelMove(a.from, a.to, a.ok)}</span>
        </li>
      ))}
    </ol>
  );
}

// inRematch(id) : la carte est en Revanche après la partie.
function Summary({ result, canReplay, inRematch, onReplay, onHome }) {
  const { results, mode } = result;
  const [open, setOpen] = useState(() => new Set());
  const total = results.length;
  const good = results.filter((r) => r.ok).length;
  const missed = [];
  const byId = new Map();
  results.forEach((r, i) => {
    const attempt = { ...r, turn: i + 1 };
    if (byId.has(r.id)) byId.get(r.id).attempts.push(attempt);
    else byId.set(r.id, { id: r.id, attempts: [attempt] });
  });
  for (const entry of byId.values()) if (entry.attempts.some((a) => !a.ok)) missed.push(entry);
  const toggle = (id) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const promoted = new Set(results.filter((r) => r.ok && r.to > r.from).map((r) => r.id)).size;
  const newlyMastered = new Set(results.filter((r) => r.ok && r.to === MAX_BOX && r.from < MAX_BOX).map((r) => r.id)).size;

  return (
    <div className="cl-wrap">
      <header className="cl-page-head">
        <p className="cl-eyebrow">{mode === "errors" ? "Revanche" : "Nouvelle partie"}</p>
        <h1>Partie terminée</h1>
      </header>

      <section className="cl-panel cl-score">
        <p className="cl-score-value">
          {good}
          <span>&nbsp;/&nbsp;{total}</span>
        </p>
        <div className="cl-score-text">
          <p className="cl-score-pct">{percent(good, total)}&nbsp;% de bonnes réponses</p>
          <p className="cl-muted">
            {plural(promoted, "carte montée", "cartes montées")} de niveau
            {newlyMastered ? ` · ${plural(newlyMastered, "nouvelle carte maîtrisée", "nouvelles cartes maîtrisées")}` : ""}
            {missed.length ? ` · ${plural(missed.length, "carte", "cartes")} à retravailler` : ""}
          </p>
        </div>
      </section>

      <section className="cl-panel" aria-labelledby="missed-title">
        <h2 id="missed-title">Cartes ratées</h2>
        {missed.length ? (
          <ul className="cl-list">
            {missed.map(({ id, attempts }) => {
              const card = CARD_BY_ID[id];
              const isOpen = open.has(id);
              const errors = attempts.filter((a) => !a.ok).length;
              const stays = inRematch(id);
              return (
                <li key={id} className={cls("cl-list-item", "cl-missed", isOpen && "is-open")}>
                  <button type="button" className="cl-missed-toggle" aria-expanded={isOpen} aria-controls={`attempts-${id}`} onClick={() => toggle(id)}>
                    <span className="cl-list-main">
                      <Badge cat={card.cat} />
                      <span className="cl-list-fr">{card.cat === "def" ? card.hint : card.fr}</span>
                      <span className="cl-list-en">{card.en}</span>
                    </span>
                    <span className="cl-missed-meta">
                      <span className="cl-list-count">{plural(errors, "erreur", "erreurs")}</span>
                      {stays && <span className="cl-missed-stay">Reste en Revanche</span>}
                      <span className="cl-missed-hint">
                        {plural(attempts.length, "tentative", "tentatives")}
                        <IconChevron size={16} />
                      </span>
                    </span>
                  </button>
                  {isOpen && <Attempts id={id} attempts={attempts} />}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="cl-muted">Aucune erreur pendant cette partie.</p>
        )}
      </section>

      <div className="cl-actions">
        <button type="button" className="cl-btn cl-btn--primary cl-btn--lg" onClick={onReplay} disabled={!canReplay}>
          Rejouer
        </button>
        <button type="button" className="cl-btn cl-btn--lg" onClick={onHome}>
          Accueil
        </button>
        {!canReplay && <span className="cl-foot-note">Plus aucune erreur à revoir.</span>}
      </div>
    </div>
  );
}

function BoxChart({ boxes, unseen }) {
  const max = Math.max(1, ...boxes);
  return (
    <div className="cl-boxchart">
      <table className="cl-boxchart-table">
        <caption className="cl-sr">Nombre de cartes à chaque niveau</caption>
        <tbody>
          {boxes.map((n, i) => (
            <tr key={i} title={`Niveau ${i + 1} (${LEVEL_NAMES[i].toLowerCase()})\u00a0: ${plural(n, "carte", "cartes")}`}>
              <th scope="row">
                <span className="cl-level-num">{i + 1}</span>
                <span className="cl-level-name">{LEVEL_NAMES[i]}</span>
              </th>
              <td>
                <span className="cl-boxchart-track">
                  <span className={cls("cl-boxchart-bar", i === MAX_BOX - 1 && "is-mastered")} style={{ "--r": n / max }} />
                  <span className="cl-boxchart-value">{n}</span>
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {unseen > 0 && <p className="cl-chart-note">Dont {plural(unseen, "carte jamais jouée", "cartes jamais jouées")} au niveau 1.</p>}
    </div>
  );
}

// Fenêtre modale d'information ; un clic sur le fond la ferme aussi.
function InfoDialog({ open, onClose, id, title, children }) {
  const ref = useRef(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      try {
        dialog.showModal();
      } catch (err) {
        dialog.setAttribute("open", "");
      }
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);
  return (
    <dialog
      ref={ref}
      id={id}
      className="cl-dialog"
      aria-labelledby={`${id}-title`}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === ref.current) onClose();
      }}
    >
      <div className="cl-dialog-body">
        <div className="cl-dialog-head">
          <h2 id={`${id}-title`}>{title}</h2>
          <button type="button" className="cl-dialog-close" onClick={onClose} aria-label="Fermer">
            <IconCross size={18} />
          </button>
        </div>
        {children}
        <button type="button" className="cl-btn cl-btn--primary cl-dialog-ok" onClick={onClose}>
          J'ai compris
        </button>
      </div>
    </dialog>
  );
}

// Quitter une partie en cours : rien n'est enregistré.
function QuitDialog({ open, onStay, onQuit }) {
  const ref = useRef(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      try {
        dialog.showModal();
      } catch (err) {
        dialog.setAttribute("open", "");
      }
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);
  return (
    <dialog
      ref={ref}
      id="quit-dialog"
      className="cl-dialog"
      aria-labelledby="quit-dialog-title"
      aria-describedby="quit-dialog-text"
      onClose={onStay}
      onClick={(event) => {
        if (event.target === ref.current) onStay();
      }}
    >
      <div className="cl-dialog-body">
        <h2 id="quit-dialog-title">Quitter la partie&nbsp;?</h2>
        <p id="quit-dialog-text" className="cl-muted">
          Les réponses de cette partie ne seront pas enregistrées&nbsp;: tes cartes restent au niveau qu'elles avaient avant la partie.
        </p>
        <div className="cl-dialog-actions">
          <button type="button" className="cl-btn" onClick={onStay}>
            Continuer la partie
          </button>
          <button type="button" className="cl-btn cl-btn--danger" onClick={onQuit}>
            Quitter sans enregistrer
          </button>
        </div>
      </div>
    </dialog>
  );
}

// Les règles de progression, en trois phrases.
function LevelRules() {
  return (
    <ul className="cl-rules">
      <li>
        <span className="cl-rule-icon" data-tone="ok">
          <IconCheck size={16} />
        </span>
        <span>
          <strong>Bonne réponse</strong> : la carte monte d'un niveau.
        </span>
      </li>
      <li>
        <span className="cl-rule-icon" data-tone="bad">
          <IconCross size={16} />
        </span>
        <span>
          <strong>Erreur</strong> : elle redescend au niveau 1.
        </span>
      </li>
      <li>
        <span className="cl-rule-icon" data-tone="mastered">
          <IconStack size={16} />
        </span>
        <span>
          <strong>Niveau 5</strong> : la carte est maîtrisée et compte pour ta note.
        </span>
      </li>
    </ul>
  );
}

// Suppression définitive du compte : il faut taper SUPPRIMER pour confirmer.
const DELETE_WORD = "SUPPRIMER";

function DeleteAccount({ account, onDelete }) {
  const [confirming, setConfirming] = useState(false);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const ready = typed.trim().toUpperCase() === DELETE_WORD;

  const cancel = () => {
    setConfirming(false);
    setTyped("");
    setError("");
  };
  const confirm = async () => {
    if (!ready || busy) return;
    setBusy(true);
    setError("");
    try {
      await onDelete();
    } catch (err) {
      setError(err?.message || "La suppression du compte a échoué. Réessaie dans un moment.");
      setBusy(false);
    }
  };

  return (
    <section className="cl-panel cl-danger" aria-labelledby="delete-title">
      <h2 id="delete-title">Supprimer mon compte</h2>
      <p className="cl-muted">Ton compte et toute ta progression seront effacés, sur tous tes appareils.</p>
      {confirming ? (
        <form
          className="cl-confirm"
          role="alertdialog"
          aria-labelledby="delete-confirm-text"
          onSubmit={(event) => {
            event.preventDefault();
            confirm();
          }}
        >
          <p id="delete-confirm-text">
            Le compte <strong>{account?.email || "connecté"}</strong> sera supprimé définitivement, avec ses niveaux, ses statistiques et ses
            séries. Cette action ne peut pas être annulée.
          </p>
          <label htmlFor="delete-confirm" className="cl-confirm-label">
            Pour confirmer, tape <strong>{DELETE_WORD}</strong>
          </label>
          <input
            id="delete-confirm"
            className="cl-confirm-input"
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            autoFocus
          />
          {error && (
            <p className="cl-confirm-error" role="alert">
              {error}
            </p>
          )}
          <div className="cl-actions">
            <button type="submit" className="cl-btn cl-btn--danger" disabled={!ready || busy}>
              {busy ? "Suppression…" : "Supprimer définitivement"}
            </button>
            <button type="button" className="cl-btn" onClick={cancel} disabled={busy}>
              Annuler
            </button>
          </div>
        </form>
      ) : (
        <button type="button" className="cl-btn cl-btn--danger-outline" onClick={() => setConfirming(true)}>
          Supprimer mon compte
        </button>
      )}
    </section>
  );
}

function Profile({ progress, summary, onReset, storage, account, onDeleteAccount }) {
  const [confirming, setConfirming] = useState(false);
  const [levelsHelp, setLevelsHelp] = useState(false);
  const [resetDone, setResetDone] = useState(false);
  const { stats } = progress;
  const nextGrade = GRADES.slice().reverse().find((g) => g.min > summary.mastered);
  const topMissed = CARDS.filter((card) => progress.cards[card.id]?.w > 0)
    .sort((a, b) => progress.cards[b.id].w - progress.cards[a.id].w || progress.cards[b.id].t - progress.cards[a.id].t)
    .slice(0, 10);

  return (
    <div className="cl-wrap cl-wrap--wide">
      <header className="cl-page-head">
        <h1>Profil</h1>
      </header>

      <StorageNotice state={storage} />

      <div className="cl-grid-2">
        <section className="cl-panel" aria-labelledby="progress-title">
          <h2 id="progress-title">Avancement global</h2>
          <p className="cl-big-number">
            {summary.mastered}
            <span>&nbsp;/&nbsp;{TOTAL} cartes maîtrisées</span>
          </p>
          <Meter value={summary.mastered} max={TOTAL} tone="ok" />
          <ul className="cl-cat-progress">
            {CAT_KEYS.map((cat) => (
              <li key={cat} data-cat={cat}>
                <span className="cl-cat-progress-label">
                  <span className="cl-cat-dot" aria-hidden="true" />
                  {CATEGORIES[cat].label}
                </span>
                <span className="cl-cat-progress-value">
                  {summary.masteredByCat[cat]}&nbsp;/&nbsp;{CAT_TOTAL[cat]}
                </span>
                <Meter value={summary.masteredByCat[cat]} max={CAT_TOTAL[cat]} tone={cat} />
              </li>
            ))}
          </ul>
        </section>

        <section className="cl-panel" aria-labelledby="grade-title">
          <h2 id="grade-title">Note d'examen estimée</h2>
          <div className="cl-grade">
            <span className="cl-grade-letter" data-grade={summary.grade}>
              {summary.grade}
            </span>
            <p className="cl-muted">
              Estimation basée sur {plural(summary.mastered, "carte maîtrisée", "cartes maîtrisées")}.
              {nextGrade && summary.grade !== "A" ? ` Encore ${plural(nextGrade.min - summary.mastered, "carte", "cartes")} à maîtriser pour viser ${nextGrade.grade}.` : ""}
            </p>
          </div>
          <ol className="cl-grade-scale">
            {GRADES.map((g) => (
              <li key={g.grade} className={cls(g.grade === summary.grade && "is-current")} data-grade={g.grade}>
                <span className="cl-grade-scale-letter">{g.grade}</span>
                <span>
                  {g.min}–{g.max} cartes
                </span>
              </li>
            ))}
          </ol>
        </section>
      </div>

      <section className="cl-panel" aria-labelledby="boxes-title">
        <div className="cl-heading-row">
          <h2 id="boxes-title">Niveau de tes cartes</h2>
          <button
            type="button"
            className="cl-info-btn"
            onClick={() => setLevelsHelp(true)}
            aria-label="Comment fonctionnent les niveaux ?"
            aria-haspopup="dialog"
            aria-controls="levels-help"
            title="Comment fonctionnent les niveaux ?"
          >
            <IconInfo size={20} />
          </button>
        </div>
        <BoxChart boxes={summary.boxes} unseen={summary.unseen} />
        <InfoDialog id="levels-help" open={levelsHelp} onClose={() => setLevelsHelp(false)} title="Comment fonctionnent les niveaux ?">
          <p className="cl-muted">
            Chaque carte a un niveau de 1 à 5. Les cartes des premiers niveaux reviennent plus souvent dans tes parties, pour que tu les
            travailles davantage.
          </p>
          <LevelRules />
        </InfoDialog>
      </section>

      <section className="cl-panel" aria-labelledby="stats-title">
        <h2 id="stats-title">Statistiques</h2>
        <dl className="cl-stats">
          <div>
            <dt>Parties jouées</dt>
            <dd>{stats.sessions}</dd>
          </div>
          <div>
            <dt>Réponses</dt>
            <dd>{stats.answers}</dd>
          </div>
          <div>
            <dt>Taux de réussite</dt>
            <dd>{stats.answers ? `${percent(stats.correct, stats.answers)} %` : "—"}</dd>
          </div>
          <div>
            <dt>Série en cours</dt>
            <dd>{plural(summary.streak, "jour", "jours")}</dd>
          </div>
        </dl>
        <h3 className="cl-subhead">Réussite par catégorie</h3>
        <ul className="cl-cat-progress">
          {CAT_KEYS.map((cat) => {
            const { a, c } = stats.byCat[cat];
            return (
              <li key={cat} data-cat={cat}>
                <span className="cl-cat-progress-label">
                  <span className="cl-cat-dot" aria-hidden="true" />
                  {CATEGORIES[cat].label}
                </span>
                <span className="cl-cat-progress-value">{a ? `${percent(c, a)} % · ${c}/${a}` : "pas encore jouée"}</span>
                <Meter value={c} max={a} tone={cat} />
              </li>
            );
          })}
        </ul>
      </section>

      <section className="cl-panel" aria-labelledby="top-title">
        <h2 id="top-title">Les 10 cartes les plus ratées</h2>
        {topMissed.length ? (
          <ol className="cl-list cl-list--ranked">
            {topMissed.map((card, i) => (
              <li key={card.id} className="cl-list-item">
                <span className="cl-rank">{i + 1}</span>
                <div className="cl-list-main">
                  <Badge cat={card.cat} />
                  <span className="cl-list-fr">{card.cat === "def" ? card.hint : card.fr}</span>
                  <span className="cl-list-en">{card.en}</span>
                </div>
                <span className="cl-list-count">{plural(progress.cards[card.id].w, "erreur", "erreurs")}</span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="cl-muted">Aucune carte ratée pour l'instant.</p>
        )}
      </section>

      <section className="cl-panel cl-danger" aria-labelledby="reset-title">
        <h2 id="reset-title">Réinitialiser</h2>
        {resetDone && !confirming ? <p role="status">Progression réinitialisée. Toutes les cartes sont de retour au niveau 1.</p> : null}
        {confirming ? (
          <div className="cl-confirm" role="alertdialog" aria-labelledby="reset-confirm-text">
            <p id="reset-confirm-text">
              Toutes les cartes reviendront au niveau 1 et tes statistiques, séries et erreurs seront effacées. Cette action est définitive.
            </p>
            <div className="cl-actions">
              <button
                type="button"
                className="cl-btn cl-btn--danger"
                onClick={() => {
                  onReset();
                  setConfirming(false);
                  setResetDone(true);
                }}
              >
                Oui, tout effacer
              </button>
              <button type="button" className="cl-btn" onClick={() => setConfirming(false)} autoFocus>
                Annuler
              </button>
            </div>
          </div>
        ) : (
          <button type="button" className="cl-btn cl-btn--danger-outline" onClick={() => setConfirming(true)}>
            Réinitialiser ma progression
          </button>
        )}
      </section>

      {onDeleteAccount && <DeleteAccount account={account} onDelete={onDeleteAccount} />}
    </div>
  );
}

/* --------------------------------------------------------------------- App -- */

// account / onSignOut / onDeleteAccount / leaderboard : fournis par le site (connexion Supabase). Absents dans un artifact.
export default function CardLearn({ account = null, onSignOut = null, onDeleteAccount = null, leaderboard = null } = {}) {
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState(emptyProgress);
  const [storage, setStorage] = useState("ok"); // ok | unavailable | error
  const [screen, setScreen] = useState("home"); // home | session | summary | profile | ranking
  const [cats, setCats] = useState(CAT_KEYS);
  const [session, setSession] = useState(null);
  const [result, setResult] = useState(null);
  const dirty = useRef(false);
  const saver = useRef({ busy: false, pending: null });
  const reducedMotion = usePrefersReducedMotion();
  const [leaving, setLeaving] = useState(false);
  const [quitting, setQuitting] = useState(false);
  // Classement (site connecté) : pseudo et rang, affichés dans l'en-tête, l'accueil et le profil.
  const [board, setBoard] = useState(leaderboard ? { status: "loading" } : { status: "offline" });

  // Chargement de la progression au démarrage.
  useEffect(() => {
    let alive = true;
    (async () => {
      let data = null;
      let state = "ok";
      if (typeof window === "undefined" || !window.storage || typeof window.storage.get !== "function") {
        state = "unavailable";
      } else {
        try {
          const res = await window.storage.get(STORAGE_KEY);
          const raw = typeof res === "string" ? res : res?.value;
          if (raw) data = JSON.parse(raw);
        } catch (err) {
          // Clé absente ou lecture impossible : on démarre avec une progression vide.
        }
      }
      if (!alive) return;
      setProgress(sanitizeProgress(data));
      setStorage(state);
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, []);

  // Sauvegarde : une écriture à la fois, seule la dernière version en attente est envoyée.
  const persist = useCallback(async (data) => {
    const saving = saver.current;
    saving.pending = data;
    if (saving.busy) return;
    saving.busy = true;
    while (saving.pending) {
      const next = saving.pending;
      saving.pending = null;
      try {
        if (!window.storage || typeof window.storage.set !== "function") throw new Error("window.storage indisponible");
        await window.storage.set(STORAGE_KEY, JSON.stringify(next));
        setStorage("ok");
      } catch (err) {
        setStorage(window.storage && typeof window.storage.set === "function" ? "error" : "unavailable");
      }
    }
    saving.busy = false;
  }, []);

  useEffect(() => {
    if (loading || !dirty.current) return;
    dirty.current = false;
    persist(progress);
  }, [progress, loading, persist]);

  const update = useCallback((fn) => {
    dirty.current = true;
    setProgress(fn);
  }, []);

  useEffect(() => {
    try {
      window.scrollTo({ top: 0 });
    } catch (err) {
      // sans effet hors navigateur
    }
  }, [screen]);

  const summary = useMemo(() => summarize(progress), [progress]);

  const loadBoard = useCallback(async () => {
    if (!leaderboard) return;
    setBoard((prev) => (prev.status === "ready" ? { ...prev, refreshing: true } : { status: "loading" }));
    try {
      const data = await leaderboard.load();
      setBoard({ status: "ready", ...data });
    } catch (err) {
      setBoard({ status: "error", message: err?.message || "Le classement n'a pas pu être chargé." });
    }
  }, [leaderboard]);

  useEffect(() => {
    loadBoard();
  }, [loadBoard]);

  const pseudo = board.status === "ready" ? board.pseudo : null;

  const startSession = (mode, sessionCats = cats) => {
    const pool = buildPool(mode, sessionCats, progress);
    if (!pool.length) return;
    const size = progress.settings.size;
    setSession({ id: Date.now(), mode, cats: sessionCats, size, queue: drawQueue(pool, progress, size) });
    setScreen("session");
  };

  const navigate = (target) => {
    setSession(null);
    setScreen(target);
  };

  // Abandon d'une partie : sa copie de travail est jetée, rien n'est enregistré.
  const quitSession = () => {
    setQuitting(false);
    setSession(null);
    setScreen("home");
  };

  const stayInSession = () => {
    setQuitting(false);
    setTimeout(() => (document.querySelector(".cl-answer-next") || document.getElementById("cl-answer-input") || document.querySelector(".cl-choice:not(:disabled)"))?.focus({ preventScroll: true }), 0);
  };

  // Laisse partir la dernière sauvegarde (3 s au plus).
  const waitForSaves = async () => {
    for (let i = 0; i < 30 && (dirty.current || saver.current.busy || saver.current.pending); i++) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  };

  const signOut = async () => {
    if (!onSignOut || leaving) return;
    setLeaving(true);
    await waitForSaves();
    try {
      await onSignOut();
    } catch (err) {
      setLeaving(false);
    }
  };

  // Fin de partie : la progression de la partie est enregistrée d'un coup.
  const handleEnd = (results, finalProgress) => {
    setQuitting(false);
    update(() => finalProgress);
    setResult({ results, mode: session.mode, cats: session.cats });
    setSession(null);
    setScreen("summary");
  };

  const inSession = !loading && screen === "session" && !!session;
  let content;
  if (loading) {
    content = (
      <div className="cl-loading" role="status">
        <span className="cl-spinner" aria-hidden="true" />
        Chargement de ta progression…
      </div>
    );
  } else if (screen === "session" && session) {
    content = (
      <Session key={session.id} config={session} progress={progress} onEnd={handleEnd} onQuit={() => setQuitting(true)} reducedMotion={reducedMotion} />
    );
  } else if (screen === "summary" && result) {
    content = (
      <Summary
        result={result}
        canReplay={buildPool(result.mode, result.cats, progress).length > 0}
        inRematch={(id) => !!progress.cards[id]?.r}
        onReplay={() => startSession(result.mode, result.cats)}
        onHome={() => setScreen("home")}
      />
    );
  } else if (screen === "profile") {
    content = (
      <Profile
        progress={progress}
        summary={summary}
        storage={storage}
        account={account}
        onReset={() => update((p) => emptyProgress(p.settings.size))}
        onDeleteAccount={
          onDeleteAccount
            ? async () => {
                await waitForSaves();
                await onDeleteAccount();
              }
            : null
        }
      />
    );
  } else if (screen === "ranking") {
    content = <Ranking summary={summary} leaderboard={leaderboard} board={board} onReload={loadBoard} />;
  } else {
    content = (
      <Home
        progress={progress}
        summary={summary}
        cats={cats}
        storage={storage}
        onCatsChange={setCats}
        onSizeChange={(size) => update((p) => ({ ...p, settings: { ...p.settings, size } }))}
        onStart={startSession}
        onProfile={() => navigate("profile")}
        pseudo={pseudo}
      />
    );
  }

  return (
    <div lang="fr" className={cls("cl-app", !loading && screen !== "session" && screen !== "summary" && "has-tabbar")}>
      <style>{STYLES}</style>
      {!loading && !inSession && screen !== "summary" && (
        <NavBar
          screen={screen}
          onNavigate={navigate}
          account={account}
          onSignOut={onSignOut ? signOut : null}
          leaving={leaving}
          streak={summary.streak}
          pseudo={pseudo}
        />
      )}
      <main className="cl-main">{content}</main>
      {inSession && <QuitDialog open={quitting} onStay={stayInSession} onQuit={quitSession} />}
    </div>
  );
}

/* ------------------------------------------------------------------ Styles -- */

const STYLES = `
@import url("https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500..800&family=Instrument+Sans:wght@400..700&family=JetBrains+Mono:wght@400..700&display=swap");

/* Jetons de la refonte (design/maquette-refonte/HANDOFF.md) : thème sombre uniquement. */
:root {
  color-scheme: dark;
  --bg: #0d0e1a;
  --surface: #161829;
  --surface-2: #1d2036;
  --line: #2a2e4a;
  --line-2: #3a3f63;
  --nav: #12142a;
  --text: #f3f2ee;
  --muted: #a3a7c4;
  --faint: #8a8eae;
  --indigo: #262a6e;
  --indigo-2: #33388c;
  --on-indigo: #c5c8f0;
  --yellow: #ffc93c;
  --yellow-shadow: #b8860b;
  --on-yellow: #1b1400;
  --yellow-soft: #2e2a1a;
  --paper: #f6f3ea;
  --paper-ink: #15162b;
  --paper-muted: #5a5d78;
  --success: #3ddc84;
  --success-bg: #0f2a1c;
  --success-text: #5be59a;
  --success-shadow: #1f9a57;
  --on-success: #06210f;
  --error: #ff6b6b;
  --error-bg: #2e1215;
  --error-text: #ff9a9a;
  --error-shadow: #b83a3a;
  --on-error: #2a0606;
  --streak: #ff9f5a;
  --streak-bg: #2a1c12;
  --streak-line: #4d311d;
  --cat-mots: #63a4ff;
  --cat-expr: #ff9255;
  --cat-def: #c09cff;
  --box-1: #4a4f7e;
  --box-2: #5e66c4;
  --box-3: #7f8bf0;
  --box-4: #a9b3ff;
  --box-5: #ffc93c;
  --fix-bg: #ffd75e;
  --fix-ink: #231a00;
  --r-btn: 16px;
  --r-card: 20px;
  --r-block: 24px;
  --font-display: "Bricolage Grotesque", "Avenir Next", "Segoe UI", system-ui, sans-serif;
  --font-body: "Instrument Sans", "Segoe UI", system-ui, -apple-system, sans-serif;
  --font-mono: "JetBrains Mono", ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace;

  /* Anciens noms, le temps de refaire chaque écran. */
  --ink: var(--text);
  --ink-2: var(--muted);
  --ink-3: var(--faint);
  --accent: var(--yellow);
  --accent-ink: var(--on-yellow);
  --accent-soft: var(--yellow-soft);
  --ok: var(--success);
  --ok-soft: var(--success-bg);
  --bad: var(--error);
  --bad-soft: var(--error-bg);
  --rule: rgba(255, 107, 107, 0.32);
  --play-bg: var(--indigo);
  --play-ink: var(--text);
  --play-muted: var(--on-indigo);
  --play-line: rgba(255, 255, 255, 0.14);
  --play-tile: rgba(255, 255, 255, 0.04);
  --play-tile-on: var(--indigo-2);
  --cta: var(--yellow);
  --cta-ink: var(--on-yellow);
  --cta-shade: var(--yellow-shadow);
  --flame: var(--streak);
  --flame-soft: var(--streak-bg);
  --grade-a: var(--yellow);
  --grade-b: var(--yellow);
  --grade-c: var(--yellow);
  --grade-d: var(--yellow);
  --gold: #ffc93c;
  --gold-edge: #8f6200;
  --silver: #c9cde8;
  --silver-edge: #5f6b7c;
  --bronze: #e39a6a;
  --bronze-edge: #85461b;
  --shadow: 0 18px 40px rgba(0, 0, 0, 0.35);
}

body { margin: 0; background: var(--bg); color: var(--ink); }
.cl-app {
  min-height: 100vh;
  box-sizing: border-box;
  overflow-x: clip;
  background: var(--bg);
  color: var(--text);
  font: 16px/1.5 var(--font-body);
  -webkit-font-smoothing: antialiased;
}
/* :where() : sans priorité, pour que chaque composant garde sa propre police. */
:where(.cl-app) button, :where(.cl-app) input { font: inherit; color: inherit; }
:where(.cl-app) button { cursor: pointer; }
.cl-app :focus-visible { outline: 2px solid var(--yellow); outline-offset: 2px; }
.cl-app *, .cl-app *::before, .cl-app *::after { box-sizing: border-box; }
.cl-app h1, .cl-app h2, .cl-app h3, .cl-app p, .cl-app ul, .cl-app ol, .cl-app dl, .cl-app dd, .cl-app fieldset { margin: 0; }
.cl-app ul, .cl-app ol { padding: 0; list-style: none; }
.cl-app h1, .cl-app h2, .cl-app h3 { font-family: var(--font-display); color: var(--text); text-wrap: balance; letter-spacing: -0.01em; }
.cl-app h1 { font-size: 30px; line-height: 1.1; font-weight: 800; letter-spacing: -0.02em; }
.cl-app h2 { font-size: 20px; line-height: 1.25; font-weight: 700; }
.cl-sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
.cl-icon { flex: none; }
.cl-muted { color: var(--ink-2); font-size: 15px; }
.cl-ink { color: var(--ink); }

/* Place pour la barre d'état en haut, et pour la barre d'onglets en bas (mobile). */
.cl-main {
  padding-inline: max(16px, env(safe-area-inset-left, 0px)) max(16px, env(safe-area-inset-right, 0px));
  padding-block: calc(20px + env(safe-area-inset-top, 0px)) calc(32px + env(safe-area-inset-bottom, 0px));
}
.cl-app.has-tabbar .cl-main { padding-bottom: calc(104px + env(safe-area-inset-bottom, 0px)); }
@media (min-width: 768px) {
  .cl-main { padding-block: 40px 56px; }
  .cl-app.has-tabbar .cl-main { padding-bottom: 56px; }
}
.cl-wrap { max-width: 640px; margin-inline: auto; display: grid; grid-template-columns: minmax(0, 1fr); gap: 20px; }
.cl-wrap--wide { max-width: 760px; }
.cl-wrap--session { max-width: 600px; gap: 16px; }

/* Boutons */
.cl-btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 8px;
  min-height: 44px; padding: 10px 18px;
  border: 1px solid var(--line); border-radius: 8px;
  background: var(--surface); color: var(--ink);
  font: 700 15px/1.2 var(--font-body);
  cursor: pointer; text-decoration: none;
  transition: background-color .15s, border-color .15s, color .15s, transform .1s;
}
.cl-btn:hover:not(:disabled) { border-color: var(--ink-3); }
.cl-btn:active:not(:disabled) { transform: translateY(1px); }
.cl-btn:focus-visible, .cl-app input:focus-visible, .cl-rounds-options button:focus-visible { outline: 3px solid var(--accent); outline-offset: 2px; }
.cl-btn:disabled { opacity: .45; cursor: not-allowed; }
.cl-btn--primary { background: var(--accent); border-color: var(--accent); color: var(--accent-ink); }
.cl-btn--primary:hover:not(:disabled) { border-color: var(--accent); filter: brightness(1.08); }
.cl-btn--ghost { background: transparent; border-color: transparent; color: var(--ink-2); padding-inline: 10px; }
.cl-btn--ghost:hover:not(:disabled) { border-color: var(--line); color: var(--ink); }
.cl-btn--quiet { background: transparent; color: var(--ink-2); min-height: 40px; padding: 8px 14px; font-size: 14px; }
.cl-btn--sm { min-height: 36px; padding: 6px 10px; font-size: 14px; }
.cl-btn--lg { min-height: 50px; padding-inline: 22px; font-size: 16px; }
.cl-btn--danger { background: var(--bad); border-color: var(--bad); color: var(--surface); }
.cl-btn--danger-outline { color: var(--bad); border-color: var(--bad); background: transparent; }

/* Panneaux */
.cl-panel { display: grid; gap: 14px; align-content: start; padding: 20px; background: var(--surface); border: 1px solid var(--line); border-radius: 10px; min-width: 0; }
.cl-grid-2 { display: grid; gap: 20px; grid-template-columns: repeat(2, minmax(0, 1fr)); }
.cl-big-number { font: 700 40px/1 var(--font-body); font-variant-numeric: tabular-nums; color: var(--ink); }
.cl-big-number span { font-size: 16px; font-weight: 400; color: var(--ink-2); }
.cl-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; }
.cl-notice { padding: 10px 14px; border-radius: 8px; background: var(--bad-soft); color: var(--ink); font-size: 14px; }
.cl-eyebrow { font: 600 12px/1.4 var(--font-mono); letter-spacing: .08em; text-transform: uppercase; color: var(--ink-3); }
.cl-page-head { display: grid; gap: 6px; }
.cl-app .cl-subhead { font-size: 15px; font-family: var(--font-body); font-weight: 700; color: var(--ink-2); margin-top: 4px; }

/* Barre de navigation : onglets en bas sur mobile, barre du haut sur desktop. */
.cl-topbar { display: none; }
.cl-tabbar {
  position: fixed; left: 0; right: 0; bottom: 0; z-index: 40;
  display: grid; grid-template-columns: repeat(3, minmax(0, 1fr));
  padding: 8px max(12px, env(safe-area-inset-right, 0px)) max(12px, env(safe-area-inset-bottom, 0px)) max(12px, env(safe-area-inset-left, 0px));
  background: var(--nav); border-top: 1px solid #23263f;
}
.cl-tab {
  display: flex; flex-direction: column; align-items: center; gap: 4px;
  min-height: 52px; padding: 4px 0; border: 0; border-radius: 12px; background: none;
  color: var(--muted); font-size: 12px; font-weight: 600;
}
.cl-tab-icon { display: grid; place-items: center; width: 56px; height: 30px; border-radius: 999px; transition: background-color .15s; }
.cl-tab[aria-current="page"] { color: var(--yellow); font-weight: 700; }
.cl-tab[aria-current="page"] .cl-tab-icon { background: var(--yellow-soft); }
@media (min-width: 768px) {
  .cl-tabbar { display: none; }
  .cl-topbar { display: block; position: sticky; top: 0; z-index: 40; padding-top: env(safe-area-inset-top, 0px); background: #0f1120; border-bottom: 1px solid #1f2238; }
}
.cl-topbar-inner { max-width: 1120px; margin-inline: auto; padding: 12px 24px; display: flex; align-items: center; gap: 12px 24px; }
.cl-topbar-logo { display: grid; place-items: center; width: 44px; height: 44px; border: 0; border-radius: 12px; background: none; }
.cl-topbar-links { display: flex; gap: 4px; }
.cl-topbar-link {
  display: flex; align-items: center; gap: 8px; height: 44px; padding: 0 16px;
  border: 0; border-radius: 12px; background: none;
  color: var(--muted); font-weight: 600; font-size: 15px;
  transition: background-color .15s, color .15s;
}
.cl-topbar-link:hover { color: var(--text); background: var(--surface); }
.cl-topbar-link[aria-current="page"] { background: #22253f; color: var(--yellow); font-weight: 700; }
.cl-topbar-end { margin-left: auto; display: flex; align-items: center; gap: 10px; }
.cl-topbar-avatar { display: grid; place-items: center; padding: 0; border: 0; border-radius: 50%; background: none; }
.cl-nav-logout {
  display: grid; place-items: center; width: 44px; height: 44px; flex: none;
  border: 1px solid var(--line); border-radius: 12px; background: var(--surface); color: var(--on-indigo);
}
.cl-nav-logout:hover:not(:disabled) { border-color: var(--error); color: var(--error-text); }
.cl-nav-logout:disabled { opacity: .55; cursor: progress; }

/* Composants communs */
.cl-logo { flex: none; display: block; }
.cl-avatar {
  width: var(--s); height: var(--s); flex: none; border-radius: 50%;
  display: grid; place-items: center;
  background: var(--yellow); color: var(--on-yellow);
  font: 800 calc(var(--s) * 0.42)/1 var(--font-display);
}
.cl-avatar[data-tone="silver"] { background: #c9cde8; color: #1b1c3a; }
.cl-avatar[data-tone="bronze"] { background: #e39a6a; color: #2a1405; }
.cl-avatar[data-tone="plain"] { background: #2f3357; color: var(--on-indigo); font-family: var(--font-body); font-weight: 700; }
.cl-streak {
  display: inline-flex; align-items: center; gap: 6px; height: 40px; padding: 0 14px; flex: none;
  border-radius: 999px; background: var(--streak-bg); border: 1px solid var(--streak-line); color: var(--streak);
}
.cl-streak-n { font: 700 15px/1 var(--font-mono); }
.cl-streak-label { font-size: 13px; color: #f5cdb0; white-space: nowrap; }
.cl-cat-icon {
  width: var(--s); height: var(--s); flex: none; border-radius: calc(var(--s) * 0.29);
  display: grid; place-items: center; background: var(--c); color: var(--bg);
}
.cl-cat-icon .cl-glyph-text { font-size: calc(var(--s) * 0.41); }
.cl-dots { display: inline-flex; gap: 3px; }
.cl-dots > span { width: var(--s); height: var(--s); border-radius: 50%; border: 1.5px solid var(--dot); }
.cl-dots > span.is-on { background: var(--dot); }
.cl-dots[data-tone="paper"] { --dot: #2b2e5c; }
.cl-dots[data-tone="ok"] { --dot: var(--success); gap: 4px; }
.cl-dots[data-tone="bad"] { --dot: var(--error); gap: 4px; }

/* Barre de note D | C | B | A */
.cl-gradebar { display: grid; gap: 6px; }
.cl-gradebar-track { display: flex; gap: 3px; height: 10px; }
.cl-gradebar[data-scale="long"] .cl-gradebar-track { height: 12px; }
.cl-gradebar-seg { position: relative; overflow: hidden; background: #262a45; border-radius: 2px; }
.cl-gradebar-seg:first-child { border-radius: 999px 2px 2px 999px; }
.cl-gradebar-seg:last-child { border-radius: 2px 999px 999px 2px; }
.cl-gradebar-fill, .cl-gradebar-gain { position: absolute; top: 0; bottom: 0; left: 0; background: var(--yellow); }
.cl-gradebar-gain { background: #fff0c2; }
.cl-gradebar-labels { display: flex; gap: 3px; font: 11px/1.3 var(--font-mono); color: var(--faint); }
.cl-gradebar-labels .is-current { color: var(--yellow); font-weight: 700; }
.cl-gradebar[data-scale="long"] .cl-gradebar-labels > span { display: flex; flex-direction: column; gap: 1px; color: var(--on-indigo); }
.cl-gradebar[data-scale="long"] .cl-gradebar-labels b { font: 800 16px/1.2 var(--font-display); }
.cl-gradebar[data-scale="long"] .cl-gradebar-labels small { font-size: 10px; }
.cl-gradebar[data-scale="long"] .cl-gradebar-labels .is-current { color: #ffe08a; }
.cl-gradebar[data-scale="long"] .cl-gradebar-labels .is-current b { color: var(--yellow); }
.cl-indigo .cl-gradebar-seg { background: rgba(255, 255, 255, 0.14); }

/* Bouton jaune « 3D » (ombre pleine dessous), et ses variantes vertes et rouges */
.cl-cta {
  display: flex; align-items: center; justify-content: center; gap: 10px;
  min-height: 56px; padding: 0 24px; margin-bottom: 5px;
  border: 0; border-radius: var(--r-btn);
  background: var(--yellow); color: var(--on-yellow); box-shadow: 0 5px 0 var(--yellow-shadow);
  font: 800 19px/1 var(--font-display); text-decoration: none;
  transition: transform .08s, box-shadow .08s, filter .15s;
}
.cl-cta:hover:not(:disabled) { filter: brightness(1.06); }
.cl-cta:active:not(:disabled) { transform: translateY(3px); box-shadow: 0 2px 0 var(--yellow-shadow); }
.cl-cta:disabled { opacity: .5; cursor: not-allowed; }
.cl-cta-tag { font: 700 13px/1 var(--font-mono); padding: 4px 8px; border-radius: 8px; background: rgba(27, 20, 0, 0.12); }
.cl-cta--ok { background: var(--success); color: var(--on-success); box-shadow: 0 5px 0 var(--success-shadow); }
.cl-cta--ok:active:not(:disabled) { box-shadow: 0 2px 0 var(--success-shadow); }
.cl-cta--bad { background: var(--error); color: var(--on-error); box-shadow: 0 5px 0 var(--error-shadow); }
.cl-cta--bad:active:not(:disabled) { box-shadow: 0 2px 0 var(--error-shadow); }
/* Bouton secondaire à bordure */
.cl-ghost {
  display: inline-flex; align-items: center; justify-content: center; gap: 6px;
  min-height: 44px; padding: 0 16px; border: 1px solid var(--line-2); border-radius: 12px;
  background: transparent; color: var(--text); font-weight: 600; font-size: 14px; text-decoration: none;
}
.cl-ghost:hover:not(:disabled) { background: var(--surface-2); }
.cl-ghost:disabled { opacity: .45; cursor: not-allowed; }
/* Carte sombre */
.cl-card-dark { background: var(--surface); border: 1px solid var(--line); border-radius: var(--r-card); }
.cl-indigo { position: relative; overflow: hidden; background: var(--indigo); border-radius: var(--r-block); }
.cl-label-mono { font: 700 11px/1.4 var(--font-mono); letter-spacing: .1em; text-transform: uppercase; color: var(--muted); }

[data-cat="mots"] { --c: var(--cat-mots); }
[data-cat="expr"] { --c: var(--cat-expr); }
[data-cat="def"] { --c: var(--cat-def); }
.cl-cat-dot { width: 10px; height: 10px; border-radius: 50%; background: var(--c); flex: none; }

/* Accueil */
.cl-home { max-width: 560px; margin-inline: auto; display: grid; grid-template-columns: minmax(0, 1fr); gap: 14px; }
.cl-home-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding-inline: 4px; }
.cl-home-hello { display: grid; gap: 2px; min-width: 0; }
.cl-home-hello p { font-size: 14px; color: var(--muted); }
.cl-home-grid { display: grid; grid-template-columns: minmax(0, 1fr); gap: 14px; }
.cl-wide-only { display: none; }
.cl-link { display: inline-flex; align-items: center; gap: 6px; min-height: 44px; padding: 0; border: 0; background: none; color: var(--yellow); font-weight: 600; font-size: 14px; }
.cl-link:hover { color: #ffd86b; }

.cl-progress { display: grid; gap: 14px; padding: 16px 18px 14px; }
.cl-progress-top { display: flex; align-items: flex-end; justify-content: space-between; gap: 12px; }
.cl-progress-count { display: grid; gap: 6px; }
.cl-app .cl-progress h2 { font: 500 13px/1.3 var(--font-body); color: var(--muted); }
.cl-num { display: flex; align-items: baseline; gap: 4px; font-family: var(--font-mono); }
.cl-num-big { font-size: 36px; font-weight: 700; line-height: 1; letter-spacing: -0.03em; }
.cl-num-of { font-size: 16px; color: var(--faint); }
.cl-progress-grade { display: flex; align-items: center; gap: 10px; }
.cl-progress-next { display: grid; justify-items: end; gap: 2px; font-size: 12px; color: var(--muted); }
.cl-progress-next strong { font-size: 13px; font-weight: 600; color: var(--text); }
.cl-grade-badge {
  display: grid; place-items: center; width: 48px; height: 48px; flex: none;
  border-radius: 14px; background: var(--surface-2); border: 2px solid var(--yellow);
  font: 800 26px/1 var(--font-display); color: var(--yellow);
}
.cl-progress-sentence, .cl-progress-link { display: none; }
.cl-progress-sentence { font-size: 14px; color: var(--on-indigo); }
.cl-progress-sentence strong { color: var(--text); }

.cl-play { display: grid; gap: 16px; padding: 20px 16px 22px; }
.cl-deco { position: absolute; border-radius: 18px; border: 1.5px solid rgba(255, 255, 255, 0.16); pointer-events: none; }
.cl-deco--1 { top: -34px; right: -26px; width: 112px; height: 140px; background: rgba(255, 255, 255, 0.05); transform: rotate(16deg); }
.cl-deco--2 { top: -18px; right: 38px; width: 92px; height: 116px; border-radius: 16px; border-color: rgba(255, 255, 255, 0.10); transform: rotate(-8deg); }
.cl-play-head { position: relative; display: grid; gap: 4px; padding-inline: 4px; }
.cl-app .cl-play-head h2 { font-size: 26px; font-weight: 800; letter-spacing: -0.02em; }
.cl-play-head p { font-size: 14px; color: var(--on-indigo); }

.cl-modes { position: relative; border: 0; margin: 0; padding: 0; min-width: 0; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
.cl-mode {
  position: relative; display: flex; flex-direction: column; gap: 8px; min-width: 0; min-height: 112px;
  padding: 12px 10px 12px 12px; border-radius: var(--r-btn);
  border: 2px dashed #4a4f8a; background: rgba(255, 255, 255, 0.03); opacity: .75;
  cursor: pointer; user-select: none; transition: background-color .15s, border-color .15s, opacity .15s, transform .12s;
}
.cl-mode.is-on { border: 2px solid var(--yellow); background: var(--indigo-2); opacity: 1; }
.cl-mode:active { transform: scale(.98); }
.cl-mode:has(.cl-mode-input:focus-visible) { outline: 2px solid var(--yellow); outline-offset: 2px; }
.cl-mode-input { position: absolute; opacity: 0; width: 1px; height: 1px; pointer-events: none; }
.cl-mode-top { display: flex; justify-content: space-between; align-items: flex-start; }
.cl-mode-check { display: grid; place-items: center; width: 20px; height: 20px; border-radius: 50%; background: var(--yellow); color: var(--on-yellow); }
.cl-glyph-text { font: 800 14px/1 var(--font-display); letter-spacing: -0.02em; }
.cl-mode-name { font-weight: 600; font-size: 14px; line-height: 1.2; overflow-wrap: anywhere; hyphens: auto; }
.cl-mode-foot { display: grid; gap: 6px; margin-top: auto; }
.cl-mode-meta { font: 12px/1.2 var(--font-mono); color: var(--on-indigo); }
.cl-mode-bar { display: block; height: 4px; border-radius: 99px; background: rgba(255, 255, 255, 0.14); overflow: hidden; }
.cl-mode-bar > span { display: block; height: 100%; border-radius: 99px; background: var(--c); }

.cl-play-foot { position: relative; display: grid; gap: 16px; }
.cl-rounds { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding-left: 4px; }
.cl-rounds-label { font: 700 12px/1.3 var(--font-mono); letter-spacing: .08em; text-transform: uppercase; color: var(--on-indigo); }
.cl-rounds-options { display: flex; gap: 4px; padding: 4px; border-radius: 14px; background: rgba(13, 14, 26, 0.35); border: 1px solid rgba(255, 255, 255, 0.12); }
.cl-rounds-options button { width: 56px; height: 44px; border: 0; border-radius: 10px; background: transparent; color: var(--on-indigo); font: 700 15px/1 var(--font-mono); }
.cl-rounds-options button[aria-checked="true"] { background: var(--text); color: #1b1c3a; }
.cl-play-btn { min-height: 58px; font-size: 21px; }

.cl-rematch { display: flex; align-items: center; gap: 14px; padding: 12px 12px 12px 16px; }
.cl-rematch-stack { position: relative; width: 42px; height: 50px; flex: none; }
.cl-rematch-stack > span { position: absolute; inset: 0; border-radius: 10px; }
.cl-rematch-stack > span:first-child { background: #3a1e22; transform: rotate(-9deg); }
.cl-rematch-stack > span:last-child { display: grid; place-items: center; background: #4a2328; border: 1.5px solid #ff7a7a; font: 700 19px/1 var(--font-mono); color: var(--error-text); }
.cl-rematch.is-empty .cl-rematch-stack > span:first-child { background: #12301f; }
.cl-rematch.is-empty .cl-rematch-stack > span:last-child { background: var(--success-bg); border-color: var(--success); color: var(--success-text); }
.cl-rematch-text { flex: 1; min-width: 0; display: grid; gap: 2px; }
.cl-app .cl-rematch-text h2 { font-size: 18px; font-weight: 700; }
.cl-rematch-text p { font-size: 13px; line-height: 1.35; color: var(--muted); }

/* Accueil desktop : même composants, grille large (maquette Accueil-desktop) */
@media (min-width: 768px) {
  .cl-home { max-width: 1120px; gap: 28px; }
  .cl-home-head .cl-streak { display: none; }
  .cl-home-hello p { font-size: 15px; }
  .cl-app .cl-home-hello h1 { font-size: 44px; letter-spacing: -0.025em; line-height: 1.05; }
  .cl-wide-only { display: inline; }
  .cl-home-grid { gap: 16px; }
  .cl-play { padding: 32px; gap: 24px; border-radius: 28px; }
  .cl-deco--1 { top: -50px; right: -40px; width: 180px; height: 220px; border-radius: 24px; border-color: rgba(255, 255, 255, 0.14); background: rgba(255, 255, 255, 0.04); }
  .cl-deco--2 { top: -30px; right: 90px; width: 140px; height: 172px; border-radius: 20px; border-color: rgba(255, 255, 255, 0.09); }
  .cl-app .cl-play-head h2 { font-size: 40px; letter-spacing: -0.025em; line-height: 1.05; }
  .cl-play-head p { font-size: 16px; }
  .cl-modes { grid-template-columns: repeat(auto-fit, minmax(min(170px, 100%), 1fr)); gap: 12px; }
  .cl-mode { min-height: 150px; padding: 16px; border-radius: 18px; gap: 12px; }
  .cl-mode .cl-cat-icon { --s: 42px !important; }
  .cl-mode .cl-glyph-text { font-size: 17px; }
  .cl-mode-check { width: 24px; height: 24px; }
  .cl-mode-name { font-weight: 700; font-size: 17px; }
  .cl-mode-meta { font-size: 13px; }
  .cl-mode-bar { height: 5px; }
  .cl-play-foot { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 16px; }
  .cl-rounds { gap: 14px; }
  .cl-rounds-options button { width: 60px; }
  .cl-play-btn { flex: 0 1 280px; margin-bottom: 5px; padding: 0 28px; }
  .cl-progress { padding: 22px; gap: 18px; border-radius: 22px; }
  .cl-progress-top { align-items: flex-start; }
  .cl-progress-next { display: none; }
  .cl-app .cl-progress h2 { font-size: 14px; }
  .cl-num-big { font-size: 42px; }
  .cl-num-of { font-size: 17px; }
  .cl-grade-badge { width: 56px; height: 56px; border-radius: 16px; font-size: 30px; }
  .cl-progress-sentence { display: block; }
  .cl-progress-link { display: inline-flex; justify-self: start; }
  .cl-rematch { padding: 18px 18px 18px 20px; border-radius: 22px; flex-wrap: wrap; }
  .cl-rematch-stack { width: 46px; height: 56px; }
  .cl-app .cl-rematch-text h2 { font-size: 20px; }
  .cl-rematch-text p { font-size: 14px; }
}
@media (min-width: 960px) {
  .cl-home-grid { grid-template-columns: minmax(0, 1fr) minmax(300px, 340px); grid-template-rows: auto 1fr; grid-template-areas: "play progress" "play rematch"; gap: 16px 24px; align-items: start; }
  .cl-play { grid-area: play; }
  .cl-progress { grid-area: progress; }
  .cl-rematch { grid-area: rematch; }
}

/* Badge de catégorie */
.cl-badge { display: inline-flex; align-items: center; gap: 7px; padding: 3px 10px 3px 8px; border-radius: 999px; background: color-mix(in srgb, var(--c) 16%, var(--surface)); color: var(--ink); font: 600 11.5px/1.5 var(--font-mono); letter-spacing: .06em; text-transform: uppercase; white-space: nowrap; }
.cl-badge::before { content: ""; width: 8px; height: 8px; border-radius: 50%; background: var(--c); }

/* Jauges */
.cl-meter { --fill: var(--accent); display: block; height: 8px; border-radius: 999px; background: var(--surface-2); box-shadow: inset 0 0 0 1px var(--line); overflow: hidden; }
.cl-meter > span { display: block; height: 100%; border-radius: 999px; background: var(--fill); transition: width .4s ease; }
.cl-meter[data-tone="ok"] { --fill: var(--ok); }
.cl-meter[data-tone="mots"] { --fill: var(--cat-mots); }
.cl-meter[data-tone="expr"] { --fill: var(--cat-expr); }
.cl-meter[data-tone="def"] { --fill: var(--cat-def); }

/* Partie : barre du haut, carte « papier » sur sa pile, saisie ou QCM, panneau de résultat */
.cl-run { max-width: 560px; margin-inline: auto; display: grid; grid-template-columns: minmax(0, 1fr); gap: 0; }
.cl-run.has-sheet { padding-bottom: 300px; }
.cl-run-bar { display: flex; align-items: center; gap: 12px; margin-left: -8px; }
.cl-run-close { display: grid; place-items: center; width: 44px; height: 44px; flex: none; border: 0; border-radius: 12px; background: none; color: var(--muted); }
.cl-run-close:hover { background: var(--surface); color: var(--text); }
.cl-run-meter { flex: 1; height: 10px; border-radius: 999px; background: var(--surface-2); overflow: hidden; }
.cl-run-meter > span { display: block; height: 100%; border-radius: 999px; background: var(--yellow); transition: width .4s ease; }
.cl-session-count { font: 700 14px/1 var(--font-mono); font-variant-numeric: tabular-nums; white-space: nowrap; }
.cl-session-count > span { color: var(--faint); }
.cl-strikes { display: inline-flex; gap: 3px; flex: none; }
.cl-strike { display: grid; place-items: center; width: 18px; height: 18px; border-radius: 50%; background: var(--surface-2); box-shadow: inset 0 0 0 1px var(--line-2); color: transparent; }
.cl-strike.is-used { background: var(--error); box-shadow: none; color: var(--on-error); }

/* Pile : la carte de devant, et jusqu'à deux cartes qui dépassent dessous */
.cl-deck { position: relative; margin: 22px 0 40px; }
.cl-card--back {
  position: absolute; left: calc(var(--d) * 13px); right: calc(var(--d) * 13px); bottom: calc(var(--d) * -8px); height: 60px;
  border-radius: var(--r-block); background: var(--back);
  transition: left .42s cubic-bezier(.2, .7, .2, 1), right .42s cubic-bezier(.2, .7, .2, 1), bottom .42s cubic-bezier(.2, .7, .2, 1), background-color .42s;
  animation: cl-fade-in .35s ease-out both;
}
.cl-card--back[data-depth="0"] { --d: 0; --back: #4a4f84; }
.cl-card--back[data-depth="1"] { --d: 1; --back: #383c6b; z-index: 2; }
.cl-card--back[data-depth="2"] { --d: 2; --back: #23264a; z-index: 1; }
.cl-card--front {
  position: relative; z-index: 10;
  min-height: 236px; padding: 20px;
  display: flex; flex-direction: column; justify-content: space-between; gap: 16px;
  border-radius: var(--r-block); background: var(--paper); color: var(--paper-ink);
  box-shadow: 0 18px 40px rgba(0, 0, 0, 0.35);
  transform-origin: 50% 100%;
}
.cl-card--front.is-choice { min-height: 204px; }
.cl-card--front > * { animation: cl-fade-in .3s ease-out both; }
.cl-card-head { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
.cl-pill {
  display: inline-flex; align-items: center; gap: 6px; height: 28px; padding: 0 10px; border-radius: 999px;
  font: 700 11px/1 var(--font-mono); letter-spacing: .08em; text-transform: uppercase; white-space: nowrap;
}
.cl-pill .cl-glyph-text { font-size: 12px; letter-spacing: 0; text-transform: none; }
.cl-pill[data-cat="mots"] { background: #dce9ff; color: #1d4c9c; }
.cl-pill[data-cat="expr"] { background: #ffe3d3; color: #8a3a0e; }
.cl-pill[data-cat="def"] { background: #ece2ff; color: #5a2ea6; }
.cl-card-level { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; color: var(--paper-muted); }
.cl-app .cl-card-fr { font: 800 34px/1.05 var(--font-display); letter-spacing: -0.02em; color: var(--paper-ink); text-wrap: balance; overflow-wrap: anywhere; }
.cl-app .cl-card-fr.is-mid { font-size: 29px; line-height: 1.08; }
.cl-app .cl-card-fr.is-long { font-size: 24px; line-height: 1.15; }
.cl-app .cl-card-fr.is-xlong { font-size: 20px; line-height: 1.25; }
.cl-card-def { font-size: 17px; line-height: 1.55; color: var(--paper-ink); }
.cl-blank { display: inline-block; min-width: 4.5em; border-bottom: 2px dotted var(--paper-muted); line-height: 1.2; }
.cl-blank.is-revealed { min-width: 0; border-bottom: 2px solid #8a5ad8; font-weight: 700; }
.cl-hint { justify-self: start; align-self: flex-start; padding: 6px 10px; border-radius: 8px; background: #e8e3d6; color: #3b3e5c; font-size: 14px; }
.cl-hint strong { color: var(--paper-ink); }
.cl-card-foot { display: flex; align-items: center; gap: 8px; font-size: 14px; color: var(--paper-muted); }
.cl-card-dir { flex: none; font: 700 11px/1 var(--font-mono); padding: 4px 6px; border-radius: 6px; background: #e8e3d6; color: #3b3e5c; }
.cl-card--front.is-correct { box-shadow: 0 0 0 3px var(--success), 0 18px 40px rgba(0, 0, 0, 0.35); animation: cl-pop .32s ease-out; }
.cl-card--front.is-wrong { box-shadow: 0 0 0 3px var(--error), 0 18px 40px rgba(0, 0, 0, 0.35); animation: cl-shake .36s ease-in-out; }
.cl-card--front.is-exit-back { animation: cl-to-back .68s cubic-bezier(.45, .05, .35, 1) forwards, cl-sink .68s linear forwards; }
.cl-card--front.is-exit-back > * { animation: cl-fade-out .24s ease-out forwards; }
.cl-card--front.is-exit-side { animation: cl-slide-out .42s cubic-bezier(.55, 0, .8, .2) forwards; }
.cl-card--front.is-exit-fade { animation: cl-fade-out .18s linear forwards; }

/* Saisie : juste sous la carte, pour rester visible avec le clavier ouvert */
.cl-answer { display: grid; gap: 8px; }
.cl-answer-label { font-size: 13px; font-weight: 600; color: var(--muted); padding-left: 4px; }
.cl-input {
  width: 100%; min-width: 0; height: 58px; padding: 0 18px;
  border: 2px solid var(--line-2); border-radius: var(--r-btn);
  background: var(--surface); color: var(--text);
  font: 500 18px/1.2 var(--font-mono);
  transition: border-color .15s;
}
.cl-input::placeholder { color: var(--faint); }
.cl-app .cl-input:focus { outline: none; border-color: var(--yellow); }
.cl-app .cl-input.is-correct { border-color: var(--success); }
.cl-app .cl-input.is-wrong { border-color: var(--error); }
.cl-validate { margin-top: 6px; }
.cl-answer-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 12px; margin-top: 4px; }
.cl-quiet { min-height: 44px; padding: 0 12px; border: 0; border-radius: 12px; background: none; color: var(--muted); font-weight: 600; font-size: 14px; }
.cl-quiet:hover:not(:disabled) { background: var(--surface); color: var(--text); }
.cl-quiet:disabled { opacity: .45; cursor: default; }
.cl-answer-actions .cl-quiet:first-child { margin-left: -12px; }
.cl-answer-tip { margin-left: auto; font-size: 13px; color: var(--faint); }
@media (max-width: 767px) { .cl-answer-tip { display: none; } }

/* QCM : 4 boutons A à D, texte anglais en mono */
.cl-choices { display: grid; gap: 10px; }
.cl-choice {
  display: flex; align-items: center; gap: 14px; width: 100%; min-height: 60px; padding: 8px 14px 8px 8px;
  border: 2px solid var(--line); border-radius: var(--r-btn); background: var(--surface); color: var(--text); text-align: left;
  transition: border-color .15s, background-color .15s, opacity .2s, transform .1s;
}
.cl-choice:hover:not(:disabled) { border-color: var(--line-2); background: var(--surface-2); }
.cl-choice:active:not(:disabled) { transform: scale(.99); }
.cl-choice:disabled { cursor: default; }
.cl-choice-key { display: grid; place-items: center; width: 40px; height: 40px; flex: none; border-radius: 11px; background: var(--surface-2); color: var(--on-indigo); font: 700 15px/1 var(--font-mono); }
.cl-choice-text { font: 15px/1.35 var(--font-mono); overflow-wrap: anywhere; }
.cl-choice.is-right { background: var(--success-bg); border-color: var(--success); }
.cl-choice.is-right .cl-choice-key { background: var(--success); color: var(--on-success); }
.cl-choice.is-wrong { background: var(--error-bg); border-color: var(--error); }
.cl-choice.is-wrong .cl-choice-key { background: var(--error); color: var(--on-error); }
.cl-choice.is-off { opacity: .45; }

/* Panneau de résultat : monte du bas, vert ou rouge */
.cl-sheet {
  position: fixed; z-index: 30; left: 0; right: 0; bottom: 0; margin-inline: auto; width: min(100%, 592px);
  display: grid; gap: 16px; overflow: hidden;
  padding: 20px max(20px, env(safe-area-inset-right, 0px)) calc(24px + env(safe-area-inset-bottom, 0px)) max(20px, env(safe-area-inset-left, 0px));
  border-radius: 28px 28px 0 0; border-top: 2px solid var(--tone);
  background: var(--tone-bg); box-shadow: 0 -12px 40px rgba(0, 0, 0, 0.45);
  animation: cl-sheet-in .24s cubic-bezier(.2, .8, .2, 1);
}
.cl-verdict--ok { --tone: var(--success); --tone-bg: var(--success-bg); --tone-text: var(--success-text); --tone-soft: #d7f5e4; --tone-row: rgba(61, 220, 132, 0.10); --tone-ink: var(--on-success); }
.cl-verdict--bad { --tone: var(--error); --tone-bg: var(--error-bg); --tone-text: var(--error-text); --tone-soft: #f6d3d3; --tone-row: rgba(255, 107, 107, 0.10); --tone-ink: var(--on-error); }
.cl-sheet-head { display: flex; align-items: flex-start; gap: 12px; }
.cl-sheet-icon { display: grid; place-items: center; width: 44px; height: 44px; flex: none; border-radius: 50%; background: var(--tone); color: var(--tone-ink); }
.cl-sheet-text { display: grid; gap: 4px; min-width: 0; padding-top: 6px; }
.cl-app .cl-verdict-title { font: 800 24px/1.1 var(--font-display); color: var(--tone-text); }
.cl-near-note { font-size: 13px; font-weight: 600; color: var(--tone-soft); }
.cl-verdict-label { margin-top: 2px; font: 700 11px/1.4 var(--font-mono); letter-spacing: .08em; text-transform: uppercase; color: #f0b4b4; }
.cl-answer-text { font: 700 18px/1.35 var(--font-mono); color: #ffffff; overflow-wrap: anywhere; }
.cl-verdict--ok .cl-answer-text { font-weight: 500; font-size: 15px; color: var(--tone-soft); }
.cl-given { font-size: 13px; color: #e7bdbd; overflow-wrap: anywhere; }
.cl-verdict--ok .cl-given { color: var(--tone-soft); }
.cl-given .cl-diff-bad, .cl-given .cl-diff-gap { font-family: var(--font-mono); }
.cl-strike-note { font-size: 14px; font-weight: 700; color: var(--tone-text); }
.cl-sheet-level { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 12px 14px; border-radius: 14px; background: var(--tone-row); font-size: 14px; color: var(--tone-soft); }
.cl-sheet .cl-cta { margin-bottom: 5px; }
.cl-countdown { position: absolute; left: 0; top: 0; height: 3px; width: 100%; background: var(--tone); transform-origin: left center; animation: cl-countdown 1s linear forwards; }
@keyframes cl-sheet-in { from { transform: translateY(100%); } }

/* Lettres à revoir : fausses (gras, rouge) ou manquantes (_) dans la réponse donnée, à corriger dans la réponse attendue. */
.cl-diff-bad { font-weight: 800; color: var(--error-text); text-decoration: underline; text-decoration-thickness: 2px; text-underline-offset: 3px; }
.cl-diff-gap { font-weight: 800; color: var(--error-text); }
.cl-diff-fix { font-weight: 800; color: var(--fix-ink); background: var(--fix-bg); border-radius: 3px; }

/* Fin de session */
.cl-score { grid-template-columns: auto 1fr; align-items: center; gap: 20px; }
.cl-score-value { font: 700 56px/1 var(--font-body); font-variant-numeric: tabular-nums; }
.cl-score-value span { font-size: 22px; color: var(--ink-2); font-weight: 400; }
.cl-score-text { display: grid; gap: 4px; min-width: 0; }
.cl-score-pct { font-weight: 700; font-size: 18px; }

/* Listes de cartes */
.cl-list { display: grid; }
.cl-list-item { display: flex; align-items: flex-start; gap: 12px; padding: 12px 0; border-top: 1px solid var(--line); }
.cl-list-item:first-child { border-top: 0; padding-top: 0; }
.cl-list-main { display: grid; gap: 4px; justify-items: start; flex: 1; min-width: 0; }
.cl-list-fr { font-weight: 700; overflow-wrap: anywhere; }
.cl-list-en { font: 500 15px/1.4 var(--font-mono); color: var(--ink-2); overflow-wrap: anywhere; }
.cl-list-count { font: 600 13px/1.6 var(--font-mono); color: var(--bad); white-space: nowrap; font-variant-numeric: tabular-nums; }
.cl-missed { display: grid; gap: 10px; }
.cl-missed-toggle {
  display: flex; align-items: flex-start; gap: 12px;
  margin: -8px; padding: 8px; width: calc(100% + 16px);
  border: 0; border-radius: 8px; background: none; color: inherit; font: inherit; text-align: left; cursor: pointer;
}
.cl-missed-toggle:hover { background: var(--surface-2); }
.cl-missed-toggle:focus-visible { outline: 3px solid var(--accent); outline-offset: 0; }
.cl-missed-meta { display: grid; gap: 4px; justify-items: end; flex: none; }
.cl-missed-stay { font-size: 12px; font-weight: 700; color: var(--ink-2); padding: 1px 8px; border-radius: 999px; background: var(--bad-soft); white-space: nowrap; }
.cl-missed-hint { display: inline-flex; align-items: center; gap: 4px; font-size: 13px; color: var(--ink-3); white-space: nowrap; }
.cl-missed-hint .cl-icon { transition: transform .2s; }
.cl-missed.is-open .cl-missed-hint .cl-icon { transform: rotate(180deg); }
.cl-app .cl-attempts { display: grid; gap: 6px; padding: 10px 12px; border-radius: 8px; background: var(--surface-2); }
.cl-attempts li { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: baseline; gap: 4px 14px; font-size: 14px; }
.cl-attempt-turn { font: 600 12px/1.4 var(--font-mono); color: var(--ink-3); font-variant-numeric: tabular-nums; white-space: nowrap; }
.cl-attempt-answer { display: inline-flex; align-items: baseline; gap: 6px; min-width: 0; font: 500 14px/1.4 var(--font-mono); color: var(--ink); overflow-wrap: anywhere; }
.cl-attempt-answer .cl-icon { align-self: center; }
.cl-attempts .is-ok .cl-attempt-answer .cl-icon { color: var(--ok); }
.cl-attempts .is-bad .cl-attempt-answer .cl-icon { color: var(--bad); }
.cl-attempt-answer em { font-family: var(--font-body); color: var(--ink-2); }
.cl-attempt-near { font: 500 12px/1.4 var(--font-body); color: var(--ink-3); white-space: nowrap; }
.cl-attempt-box { font: 500 12px/1.4 var(--font-mono); color: var(--ink-3); white-space: nowrap; font-variant-numeric: tabular-nums; }
.cl-rank { width: 26px; flex: none; font: 600 15px/1.6 var(--font-mono); color: var(--ink-3); font-variant-numeric: tabular-nums; }

/* Profil */
.cl-cat-progress { display: grid; gap: 14px; }
.cl-cat-progress li { display: grid; grid-template-columns: 1fr auto; gap: 6px 12px; align-items: center; }
.cl-cat-progress .cl-meter { grid-column: 1 / -1; }
.cl-cat-progress-label { display: inline-flex; align-items: center; gap: 8px; font-weight: 700; }
.cl-cat-progress-value { font: 500 14px/1.3 var(--font-mono); color: var(--ink-2); font-variant-numeric: tabular-nums; }
.cl-grade { display: flex; align-items: center; gap: 16px; }
.cl-grade-letter { display: grid; place-items: center; width: 76px; height: 76px; flex: none; border-radius: 10px; border: 2px solid var(--g, var(--ink)); font: 800 46px/1 var(--font-display); color: var(--g, var(--ink)); background: color-mix(in srgb, var(--g, var(--ink)) 12%, var(--surface)); }
.cl-grade-scale { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 6px; }
.cl-grade-scale li { display: grid; gap: 2px; padding: 8px; border-radius: 6px; border: 1px solid var(--line); border-top: 4px solid var(--g); font-size: 12.5px; color: var(--ink-3); font-variant-numeric: tabular-nums; }
.cl-grade-scale li.is-current { border-color: var(--g); color: var(--ink); background: color-mix(in srgb, var(--g) 12%, var(--surface)); }
.cl-grade-scale-letter { font: 700 18px/1.1 var(--font-display); color: var(--g); }
.cl-stats { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
/* Classement */
.cl-page-head--split { display: flex; align-items: flex-end; justify-content: space-between; gap: 12px; }
.cl-page-head--split > div { display: grid; gap: 4px; }
.cl-loading--inline { min-height: 0; justify-content: flex-start; padding: 24px 0; }
.cl-rank-summary { font-size: 16px; color: var(--ink-2); }
.cl-rank-summary strong { color: var(--ink); font-family: var(--font-display); font-size: 20px; }
[data-medal="gold"] { --medal: var(--gold); --medal-edge: var(--gold-edge); }
[data-medal="silver"] { --medal: var(--silver); --medal-edge: var(--silver-edge); }
[data-medal="bronze"] { --medal: var(--bronze); --medal-edge: var(--bronze-edge); }
[data-medal="none"] { --medal: var(--play-tile-on); --medal-edge: var(--play-line); }
.cl-trophy { flex: none; }
.cl-trophy path { fill: var(--medal); stroke: var(--medal-edge); stroke-width: 1.4; stroke-linejoin: round; }
.cl-trophy .cl-trophy-handles { fill: none; stroke: var(--medal); stroke-width: 1.8; stroke-linecap: round; }

.cl-app .cl-podium {
  position: relative; overflow: hidden;
  display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); align-items: end; gap: 10px;
  padding: 32px 16px 0; border-radius: 16px;
  background: var(--play-bg); color: var(--play-ink);
  box-shadow: var(--shadow);
}
.cl-podium-slot { display: grid; justify-items: center; align-content: end; gap: 6px; min-width: 0; text-align: center; }
.cl-podium-slot[data-place="1"] { order: 2; }
.cl-podium-slot[data-place="2"] { order: 1; }
.cl-podium-slot[data-place="3"] { order: 3; }
.cl-podium-name { display: inline-flex; flex-wrap: wrap; justify-content: center; align-items: center; gap: 4px 6px; max-width: 100%; font: 700 16px/1.2 var(--font-display); overflow-wrap: anywhere; }
.cl-podium-slot[data-place="1"] .cl-podium-name { font-size: 19px; }
.cl-podium-score { font: 600 13px/1.3 var(--font-mono); color: var(--play-muted); font-variant-numeric: tabular-nums; }
.cl-podium-empty { font-size: 13px; color: var(--play-muted); padding-bottom: 6px; }
.cl-podium-spacer { height: 44px; }
.cl-podium-step {
  display: grid; place-items: center; width: 100%; margin-top: 4px;
  border-radius: 10px 10px 0 0;
  background: var(--play-tile-on); border-top: 4px solid var(--medal);
  font: 800 30px/1 var(--font-display); color: var(--play-ink);
}
.cl-podium-slot[data-place="1"] .cl-podium-step { height: 112px; }
.cl-podium-slot[data-place="2"] .cl-podium-step { height: 84px; }
.cl-podium-slot[data-place="3"] .cl-podium-step { height: 64px; }
.cl-me-tag { padding: 1px 7px; border-radius: 999px; background: var(--cta); color: var(--cta-ink); font: 700 11px/1.5 var(--font-mono); letter-spacing: .04em; text-transform: uppercase; }

.cl-board { display: grid; gap: 6px; }
.cl-board li { display: grid; grid-template-columns: 40px minmax(0, 1fr) auto; align-items: center; gap: 12px; padding: 10px 14px; border-radius: 10px; background: var(--surface); border: 1px solid var(--line); }
.cl-board li.is-me { border-color: var(--accent); background: var(--accent-soft); }
.cl-board-rank { font: 700 16px/1 var(--font-mono); color: var(--ink-3); font-variant-numeric: tabular-nums; }
.cl-board-name { display: inline-flex; align-items: center; gap: 8px; min-width: 0; font-weight: 700; overflow-wrap: anywhere; }
.cl-board-score { font: 600 14px/1 var(--font-mono); color: var(--ink-2); font-variant-numeric: tabular-nums; white-space: nowrap; }

.cl-join { justify-items: start; }
.cl-pseudo-form { display: grid; gap: 8px; width: 100%; }
.cl-pseudo-form label { font: 600 12px/1.4 var(--font-mono); letter-spacing: .08em; text-transform: uppercase; color: var(--ink-3); }
.cl-pseudo-row { display: flex; flex-wrap: wrap; gap: 10px; }
.cl-pseudo-input { flex: 1 1 200px; min-width: 0; min-height: 46px; padding: 10px 12px; border: 1.5px solid var(--line); border-radius: 8px; background: var(--surface); color: var(--ink); font: 600 16px/1.2 var(--font-body); }
.cl-pseudo-input:focus { outline: none; border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-soft); }
.cl-pseudo-hint { font-size: 13px; color: var(--ink-3); }
.cl-pseudo-current { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 10px 16px; }
.cl-stats.cl-stats--3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
.cl-stats div { display: grid; gap: 4px; padding: 12px; border-radius: 8px; background: var(--surface-2); min-width: 0; }
.cl-stats dt { font-size: 13px; color: var(--ink-2); }
.cl-stats dd { font: 700 24px/1.1 var(--font-body); font-variant-numeric: tabular-nums; color: var(--ink); }

.cl-boxchart { display: grid; gap: 10px; }
.cl-boxchart-table { width: 100%; border-collapse: collapse; }
.cl-boxchart-table th { width: 1%; padding: 6px 14px 6px 0; text-align: left; white-space: nowrap; font: 600 14px/1.3 var(--font-body); color: var(--ink); vertical-align: middle; }
.cl-boxchart-table th > span { vertical-align: middle; }
.cl-level-num { display: inline-grid; place-items: center; width: 24px; height: 24px; margin-right: 8px; border-radius: 6px; background: var(--surface-2); border: 1px solid var(--line); font: 700 13px/1 var(--font-mono); color: var(--ink); }
.cl-level-name { display: inline-block; min-width: 88px; }
.cl-boxchart-table td { padding: 6px 0; }
.cl-boxchart-table tr:hover th { color: var(--accent); }
.cl-boxchart-track { display: flex; align-items: center; gap: 8px; }
.cl-boxchart-bar { display: block; height: 20px; width: calc((100% - 48px) * var(--r)); border-radius: 0 4px 4px 0; background: var(--accent); transition: width .5s ease; }
.cl-boxchart-bar.is-mastered { background: var(--ok); }
.cl-boxchart-value { font: 600 14px/1 var(--font-mono); color: var(--ink); font-variant-numeric: tabular-nums; }
.cl-chart-note { font-size: 13px; color: var(--ink-3); }
.cl-heading-row { display: flex; align-items: center; gap: 8px; }
.cl-info-btn { display: inline-grid; place-items: center; width: 34px; height: 34px; padding: 0; border: 0; border-radius: 50%; background: none; color: var(--ink-3); cursor: pointer; transition: background-color .15s, color .15s; }
.cl-info-btn:hover { background: var(--accent-soft); color: var(--accent); }
.cl-info-btn:focus-visible, .cl-dialog-close:focus-visible { outline: 3px solid var(--accent); outline-offset: 1px; }

.cl-dialog {
  width: min(460px, calc(100vw - 32px)); max-height: calc(100vh - 32px);
  padding: 0; border: 1px solid var(--line); border-radius: 16px;
  background: var(--surface); color: var(--ink);
  box-shadow: 0 24px 60px rgba(0, 0, 0, .3);
}
.cl-dialog[open] { animation: cl-dialog-in .18s ease-out; }
.cl-dialog::backdrop { background: rgba(10, 12, 24, .55); }
.cl-dialog-body { display: grid; gap: 14px; padding: 20px; }
.cl-dialog-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
.cl-dialog-close { display: grid; place-items: center; width: 36px; height: 36px; flex: none; margin: -6px -6px 0 0; padding: 0; border: 0; border-radius: 50%; background: none; color: var(--ink-3); cursor: pointer; }
.cl-dialog-close:hover { background: var(--surface-2); color: var(--ink); }
.cl-dialog-ok { justify-self: end; }
.cl-dialog-actions { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 10px; }
.cl-dialog-actions .cl-btn { flex: 1 1 auto; }
.cl-dialog .cl-rules { grid-template-columns: minmax(0, 1fr); }
@keyframes cl-dialog-in { from { opacity: 0; transform: translateY(8px) scale(.98); } }
.cl-rules { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
.cl-rules li { display: flex; align-items: flex-start; gap: 10px; padding: 10px 12px; border-radius: 8px; background: var(--surface-2); font-size: 14px; line-height: 1.4; color: var(--ink-2); }
.cl-rules strong { color: var(--ink); }
.cl-rule-icon { display: grid; place-items: center; width: 26px; height: 26px; flex: none; border-radius: 7px; }
.cl-rule-icon[data-tone="ok"] { background: var(--ok-soft); color: var(--ok); }
.cl-rule-icon[data-tone="bad"] { background: var(--bad-soft); color: var(--bad); }
.cl-rule-icon[data-tone="mastered"] { background: var(--accent-soft); color: var(--accent); }

.cl-danger { border-color: color-mix(in srgb, var(--bad) 40%, var(--line)); }
.cl-danger .cl-btn { justify-self: start; }
.cl-confirm { display: grid; gap: 12px; padding: 14px; border-radius: 8px; background: var(--bad-soft); }
.cl-confirm-label { font-size: 14px; color: var(--ink); }
.cl-confirm-input { max-width: 260px; min-height: 46px; padding: 10px 12px; border: 1.5px solid var(--line); border-radius: 8px; background: var(--surface); color: var(--ink); font: 600 16px/1.2 var(--font-mono); letter-spacing: .06em; text-transform: uppercase; }
.cl-confirm-input:focus { outline: none; border-color: var(--bad); box-shadow: 0 0 0 3px var(--bad-soft); }
.cl-confirm-error { font-size: 14px; font-weight: 700; color: var(--bad); }

/* Chargement */
.cl-loading { min-height: 60vh; display: flex; align-items: center; justify-content: center; gap: 12px; color: var(--ink-2); }
.cl-spinner { width: 22px; height: 22px; border-radius: 50%; border: 3px solid var(--line); border-top-color: var(--accent); animation: cl-spin .8s linear infinite; }

@keyframes cl-spin { to { transform: rotate(360deg); } }
@keyframes cl-fade-in { from { opacity: 0; } to { opacity: 1; } }
@keyframes cl-fade-out { to { opacity: 0; } }
@keyframes cl-countdown { from { transform: scaleX(1); } to { transform: scaleX(0); } }
@keyframes cl-pop { 0% { transform: scale(1); } 45% { transform: scale(1.018); } 100% { transform: scale(1); } }
@keyframes cl-shake {
  0%, 100% { transform: translateX(0); }
  20% { transform: translateX(-7px); }
  40% { transform: translateX(6px); }
  60% { transform: translateX(-4px); }
  80% { transform: translateX(2px); }
}
/* La carte réussie se soulève, rétrécit puis glisse sous la pile. */
@keyframes cl-to-back {
  0% { transform: translateY(0) scale(1) rotate(0); opacity: 1; }
  45% { transform: translateY(-34%) scale(.9) rotate(-2.5deg); opacity: 1; }
  80% { opacity: 1; }
  100% { transform: translateY(36px) scale(.85) rotate(0); opacity: 0; }
}
@keyframes cl-sink { 0%, 45% { z-index: 10; } 47%, 100% { z-index: 0; } }
/* La carte ratée glisse sur le côté. */
@keyframes cl-slide-out { to { transform: translateX(118%) rotate(8deg); opacity: 0; } }

@media (max-width: 400px) {
  .cl-stats.cl-stats--3 { grid-template-columns: minmax(0, 1fr); }
}
@media (max-width: 640px) {
  .cl-grid-2 { grid-template-columns: minmax(0, 1fr); }
  .cl-app .cl-podium { gap: 6px; padding: 24px 10px 0; }
  .cl-podium-name { font-size: 14px; }
  .cl-podium-slot[data-place="1"] .cl-podium-name { font-size: 16px; }
  .cl-podium-step { font-size: 24px; }
  .cl-rules { grid-template-columns: minmax(0, 1fr); }
  .cl-stats { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .cl-panel { padding: 16px; }
  .cl-score { grid-template-columns: minmax(0, 1fr); gap: 10px; }
  .cl-attempts li { grid-template-columns: auto minmax(0, 1fr); }
  .cl-attempt-box { grid-column: 2; }
}
@media (prefers-reduced-motion: reduce) {
  .cl-app *, .cl-app *::before, .cl-app *::after { transition-duration: .01ms !important; }
  .cl-card--front.is-correct, .cl-card--front.is-wrong, .cl-card--back, .cl-sheet { animation: none; }
  .cl-card--front.is-exit-fade { animation: cl-fade-out .18s linear forwards; }
  .cl-spinner { animation-duration: 2s; }
  .cl-dialog[open] { animation: none; }
}
`;
