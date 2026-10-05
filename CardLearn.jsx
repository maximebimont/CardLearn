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
const FEEDBACK_MS = 650; // retour vert avant que la carte parte derrière la pile
// Après une erreur, la bonne réponse reste affichée le temps de la lire : 4 à 9 s selon la longueur.
const REVEAL_MIN_MS = 4000;
const REVEAL_MAX_MS = 9000;
const revealDelay = (card, input) => Math.min(REVEAL_MAX_MS, Math.max(REVEAL_MIN_MS, 3000 + 45 * (card.en.length + input.length)));
const EXIT_BACK_MS = 680;
const EXIT_SIDE_MS = 420;
const EXIT_REDUCED_MS = 180;

const CATEGORIES = {
  mots: { label: "Mots métier", badge: "Mot métier", instruction: "Traduisez en anglais" },
  expr: { label: "Expressions", badge: "Expression", instruction: "Traduisez l'expression en anglais" },
  def: { label: "Définitions", badge: "Définition", instruction: "Quel terme anglais correspond à cette définition ?" },
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

const EXPRESSIONS = [
  ["e01", "Déclarer une variable en langage java", "Declare a variable in java language"],
  ["e02", "Utiliser des tableaux pour stocker plusieurs valeurs dans une seule variable", "Use arrays to store multiple values in a single variable"],
  ["e03", "Créer une chaîne en java", "Create a string in java"],
  ["e04", "Exécuter des boucles", "Execute loops"],
  ["e05", "Effectuer une opération d'entrée ou de sortie", "Perform an input or output operation"],
  ["e06", "Traiter une information représentée sous sa forme binaire", "Process a binary information"],
  ["e07", "Comprendre les principaux livrables, les jalons, ainsi que les rôles et les responsabilités de chaque personne impliquée dans une charte de projet", "Understand the main deliverables, milestones, as well as the roles and responsibilities of each person involved in a project charter"],
  ["e08", "Utiliser les opérateurs booléens pour réduire, étendre ou affiner les résultats de recherche", "Use Boolean operators to narrow, expand, or refine search results"],
  ["e09", "Créer une procédure stockée dans une base de données", "Create a stored procedure in a database"],
  ["e10", "Utiliser les algorithmes les plus efficaces possibles pour résoudre des problèmes", "Use the most efficient algorithms possible to solve problems"],
  ["e11", "Développer des solutions logicielles fiables et fonctionnelles", "Develop reliable and functional software solutions"],
  ["e12", "Se positionner comme expert technique", "Position oneself as a technical expert"],
  ["e13", "Gérer et optimiser la base de données", "Manage and optimize the database"],
  ["e14", "Réaliser une étude logicielle", "Conduct a software study"],
  ["e15", "Concevoir l'architecture des applications", "Design application architecture"],
  ["e16", "Assurer la gestion des données", "Ensure data management"],
  ["e17", "Sécuriser les applications", "Secure applications"],
  ["e18", "Implémenter des solutions logicielles", "Implement software solutions"],
  ["e19", "Créer des programmes", "Build programs"],
  ["e20", "Écrire et tester le code", "Write and test code"],
  ["e21", "Collaborer avec des développeurs", "Collaborate with developers"],
  ["e22", "Utiliser des outils de développement", "Use development tools"],
  ["e23", "Créer des applications ergonomiques", "Create ergonomic applications"],
  ["e24", "Écouter, analyser et rédiger les besoins", "Listen, analyze and write needs"],
  ["e25", "Être garant de la pérennité et de l'évolution des solutions", "To guarantee the sustainability and evolution of solutions"],
  ["e26", "Respecter les délais, les coûts et la qualité", "Meet deadlines, costs and quality"],
  ["e27", "Satisfaire les attentes du client", "Meet client expectations"],
  ["e28", "Piloter un projet d'ingénierie logicielle", "Lead a software engineering project"],
  ["e29", "Construire un cahier des charges", "Build specifications"],
  ["e30", "Gérer les données de l'entreprise", "Manage company data"],
  ["e31", "Développer des applications mobiles", "Develop mobile apps"],
  ["e32", "Accompagner la stratégie de l'entreprise", "Support the company's strategy"],
  ["e33", "Suivre les principes et bonnes pratiques de développement", "Follow development principles and best practices"],
  ["e34", "Analyser et identifier tous les problèmes potentiels", "Analyze and identify any potential problems"],
  ["e35", "Améliorer et maintenir le logiciel à long terme", "Improve and maintain the software in the long term"],
  ["e36", "Traduire le besoin du client en demandes fonctionnelles", "Translate the client's need into functional demands"],
  ["e37", "Analyser et décrire les tâches à réaliser par l'ordinateur", "Analyze and describe the tasks to be performed by the computer"],
  ["e38", "Déterminer et schématiser les fonctionnalités du logiciel", "Determine and schematize the software functionalities"],
  ["e39", "Déceler les défauts de programmation", "Identify programming defects"],
  ["e40", "Effectuer des traitements par lot", "Perform batch processes"],
  ["e41", "Contrôler les évolutions et les différentes versions du logiciel", "Control developments and different versions of the software"],
  ["e42", "Maintenir en condition opérationnelle le logiciel", "Keep the software in operational condition"],
  ["e43", "Mettre en production à l'issue des phases de qualification et d'intégration", "Put into production at the end of the qualification and integration phases"],
  ["e44", "Rédiger le code source qui constitue le corps du logiciel", "Write the source code that forms the body of the software"],
  ["e45", "Mettre en œuvre l'agilité au sein d'une équipe de développeurs", "Implement agility as part of a team of developers"],
  ["e46", "Diriger des projets collaboratifs", "Lead collaborative projects"],
  ["e47", "Vérifier que les fonctions offertes par le logiciel correspondent aux attentes du client", "Make sure the features offered by the software are in line with the customer's expectations"],
  ["e48", "Définir les étapes clés de cycle de vie du projet", "Define key lifecycle milestones for the project"],
  ["e49", "Intégrer les environnements de développement", "Integrate development environments"],
  ["e50", "Gérer les modifications apportées au code source", "Manage changes to source code"],
  ["e51", "Déployer le logiciel sur un serveur d'applications", "Deploy the software to an application server"],
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

function isCorrect(card, input) {
  const key = answerKey(input);
  if (!key) return false;
  return card.accepted.has(key) || (key.startsWith("to") && card.accepted.has(key.slice(2)));
}

const CARDS = [
  ...MOTS.map(([id, fr, en]) => ({ id, cat: "mots", fr, en })),
  ...EXPRESSIONS.map(([id, fr, en]) => ({ id, cat: "expr", fr, en })),
  ...DEFINITIONS.map(([id, term, fr, en, masks = []]) => ({ id, cat: "def", fr, en, hint: term, masks: [term, ...masks] })),
].map((card) => ({ ...card, accepted: acceptedKeys(card.en) }));

const CARD_BY_ID = Object.fromEntries(CARDS.map((card) => [card.id, card]));
const TOTAL = CARDS.length;
const CAT_TOTAL = Object.fromEntries(CAT_KEYS.map((cat) => [cat, CARDS.filter((card) => card.cat === cat).length]));

/* ------------------------------------------------------------ Progression -- */

function emptyProgress(size = DEFAULT_SIZE) {
  return {
    version: 1,
    cards: {}, // id → { b: boîte, s: vues, c: réussites, w: erreurs, t: dernière réponse }
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
      cards[id] = { b: Math.min(MAX_BOX, Math.max(1, count(entry.b) || 1)), s: count(entry.s), c: count(entry.c), w: count(entry.w), t: count(entry.t) };
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

function recordAnswer(progress, card, ok, firstOfSession) {
  const prev = progress.cards[card.id] || { b: 1, s: 0, c: 0, w: 0, t: 0 };
  const box = ok ? Math.min(MAX_BOX, prev.b + 1) : 1;
  const catStats = progress.stats.byCat[card.cat];
  const today = dayKey();
  return {
    ...progress,
    cards: {
      ...progress.cards,
      [card.id]: { b: box, s: prev.s + 1, c: prev.c + (ok ? 1 : 0), w: prev.w + (ok ? 0 : 1), t: Date.now() },
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
    if (entry && entry.w > 0 && box < MAX_BOX) toReview += 1;
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
  if (mode === "errors") {
    return CARDS.filter((card) => {
      const entry = progress.cards[card.id];
      return entry && entry.w > 0 && entry.b < MAX_BOX;
    }).map((card) => card.id);
  }
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

function initSession(config) {
  return { queue: config.queue, turn: 0, phase: "answering", exit: null, input: "", hint: false, verdict: null, nextQueue: null, results: [] };
}

function sessionReducer(state, action) {
  switch (action.type) {
    case "input":
      return state.phase === "answering" ? { ...state, input: action.value } : state;
    case "hint":
      return { ...state, hint: true };
    case "answer": {
      if (state.phase !== "answering") return state;
      const verdict = { id: state.queue[0], ok: action.ok, input: action.input, from: action.from, to: action.to, revealMs: action.revealMs };
      return { ...state, phase: action.ok ? "correct" : "wrong", verdict, nextQueue: action.nextQueue, results: [...state.results, verdict] };
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

const Icon = ({ d, size = 18 }) => (
  <svg className="cl-icon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={d} />
  </svg>
);
const IconCheck = (p) => <Icon d="M5 12.5l4.5 4.5L19 7.5" {...p} />;
const IconCross = (p) => <Icon d="M6 6l12 12M18 6L6 18" {...p} />;
const IconChevron = (p) => <Icon d="M6 9l6 6 6-6" {...p} />;
const IconFlame = (p) => <Icon d="M12 3c.4 3.2 5 5 5 10a5 5 0 0 1-10 0c0-2.4 1.1-3.9 2.4-5.3.3 1.5 1 2.4 2.1 2.9C11.2 8.3 10.9 5.6 12 3z" {...p} />;
const IconStack = (p) => <Icon d="M9 3.5h10v13H9zM5.5 7v13.5h10" {...p} />;
const IconBubble = (p) => <Icon d="M4 5h16v11H10l-5 4v-4H4z" {...p} />;
const IconBook = (p) => <Icon d="M5 4.5A1.5 1.5 0 0 1 6.5 3H19v15H6.5A1.5 1.5 0 0 0 5 19.5zM5 19.5A1.5 1.5 0 0 0 6.5 21H19" {...p} />;
const IconPlay = ({ size = 22 }) => (
  <svg className="cl-icon" width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
    <path d="M8 5.2v13.6a1 1 0 0 0 1.5.86l11-6.8a1 1 0 0 0 0-1.72l-11-6.8A1 1 0 0 0 8 5.2z" fill="currentColor" />
  </svg>
);

// Pictogramme de chaque catégorie sur les tuiles de l'accueil.
function CatGlyph({ cat }) {
  if (cat === "mots") return <span className="cl-glyph-text">Aa</span>;
  if (cat === "expr") return <IconBubble size={20} />;
  return <IconBook size={20} />;
}
const IconBack = (p) => <Icon d="M15 5l-7 7 7 7" {...p} />;
const IconNext = (p) => <Icon d="M5 12h14M13 6l6 6-6 6" {...p} />;
const IconHome = (p) => <Icon d="M4 10.5L12 4l8 6.5M6 9v11h4.5v-6h3v6H18V9" {...p} />;
const IconUser = (p) => <Icon d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4.5 20.5c.8-3.6 3.8-5.5 7.5-5.5s6.7 1.9 7.5 5.5" {...p} />;
const IconPodium = (p) => <Icon d="M9 21V9h6v12M3 21v-7h6M15 12h6v9M2 21h20" {...p} />;
const IconLogout = (p) => <Icon d="M10 4H5v16h5M15 8l4 4-4 4M19 12H9" {...p} />;

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
        ? "La sauvegarde n'est pas disponible ici : votre progression sera perdue en fermant la page."
        : "La dernière sauvegarde a échoué. Vos réponses restent comptées et seront réenregistrées à la prochaine réponse."}
    </p>
  );
}

function Session({ config, progress, onAnswer, onEnd, reducedMotion }) {
  const [state, dispatch] = useReducer(sessionReducer, config, initSession);
  const inputRef = useRef(null);
  const revealedAt = useRef(0);
  const onEndRef = useRef(onEnd);
  onEndRef.current = onEnd;

  const { phase, verdict } = state;
  const card = CARD_BY_ID[state.queue[0]];

  // Enchaînement des phases : retour → départ de la carte → carte suivante.
  useEffect(() => {
    let timer;
    if (phase === "correct") timer = setTimeout(() => dispatch({ type: "exit", kind: "back" }), FEEDBACK_MS);
    else if (phase === "wrong") timer = setTimeout(() => dispatch({ type: "exit", kind: "side" }), state.verdict.revealMs);
    else if (phase === "exiting") {
      const duration = reducedMotion ? EXIT_REDUCED_MS : state.exit === "back" ? EXIT_BACK_MS : EXIT_SIDE_MS;
      timer = setTimeout(() => dispatch({ type: "advance", size: config.size }), duration);
    } else if (phase === "done") onEndRef.current(state.results, true);
    return () => clearTimeout(timer);
  }, [phase, state.exit, state.turn, state.results, config.size, reducedMotion]);

  // Le focus revient dans le champ à chaque nouvelle carte.
  useEffect(() => {
    if (phase === "answering") inputRef.current?.focus({ preventScroll: true });
  }, [phase, state.turn]);

  if (phase === "done" || !card) return null;

  const answer = (ok, input) => {
    if (phase !== "answering") return;
    const from = boxOf(progress, card.id);
    const to = ok ? Math.min(MAX_BOX, from + 1) : 1;
    onAnswer(card, ok, state.turn === 0);
    revealedAt.current = Date.now();
    dispatch({ type: "answer", ok, input, from, to, revealMs: ok ? 0 : revealDelay(card, input), nextQueue: requeue(state.queue, card.id, ok, to) });
  };

  const submit = (event) => {
    event.preventDefault();
    if (phase === "answering") {
      const value = state.input.trim();
      if (value) answer(isCorrect(card, value), value);
    } else if (phase === "wrong" && Date.now() - revealedAt.current > 300) {
      dispatch({ type: "exit", kind: "side" });
    }
  };

  const keepFocus = (event) => event.preventDefault(); // évite de fermer le clavier mobile

  const answered = state.results.length;
  const good = state.results.filter((r) => r.ok).length;
  const pending = state.nextQueue ?? state.queue.slice(1);
  const upcoming = Math.max(0, Math.min(config.size - state.turn - 1, pending.length));
  const total = Math.min(config.size, state.turn + 1 + upcoming);
  const backCount = Math.min(3, upcoming);
  const shift = phase === "exiting" ? 1 : 0;

  let boxMeta = `Boîte ${boxOf(progress, card.id)}`;
  if (verdict) {
    if (!verdict.ok) boxMeta = verdict.from === 1 ? "Reste en boîte 1" : `Boîte ${verdict.from} → 1`;
    else if (verdict.from === MAX_BOX) boxMeta = "Boîte 5 · maîtrisée";
    else boxMeta = `Boîte ${verdict.from} → ${verdict.to}${verdict.to === MAX_BOX ? " · maîtrisée" : ""}`;
  }

  return (
    <div className="cl-wrap cl-wrap--session">
      <div className="cl-session-bar">
        <button type="button" className="cl-btn cl-btn--ghost cl-btn--sm" onClick={() => onEndRef.current(state.results, false)}>
          <IconBack size={16} /> Quitter
        </button>
        <div className="cl-session-progress">
          <span className="cl-session-count">
            {config.mode === "errors" ? "Revanche · " : ""}Carte {state.turn + 1}&nbsp;/&nbsp;{total}
          </span>
          <Meter value={answered} max={total} />
        </div>
        <span className="cl-session-score" aria-label={`${good} bonnes réponses, ${answered - good} erreurs`}>
          <span className="is-ok">
            <IconCheck size={14} /> {good}
          </span>
          <span className="is-bad">
            <IconCross size={14} /> {answered - good}
          </span>
        </span>
      </div>

      <div className="cl-deck">
        {Array.from({ length: backCount }, (_, i) => {
          const depth = i + 1 - shift;
          return <div key={`b${state.turn + i + 1}`} className="cl-card cl-card--back" style={{ "--depth": depth, zIndex: 5 - depth }} aria-hidden="true" />;
        })}
        <article
          key={`f${state.turn}`}
          className={cls(
            "cl-card",
            "cl-card--front",
            verdict && (verdict.ok ? "is-correct" : "is-wrong"),
            phase === "exiting" && (reducedMotion ? "is-exit-fade" : `is-exit-${state.exit}`)
          )}
        >
          <header className="cl-card-head">
            <Badge cat={card.cat} />
            <span className="cl-card-box">{boxMeta}</span>
          </header>
          <div className="cl-card-body">
            <p className="cl-card-instruction">{CATEGORIES[card.cat].instruction}</p>
            {card.cat === "def" ? (
              <DefinitionText card={card} reveal={state.hint || !!verdict} />
            ) : (
              <p className={cls("cl-card-fr", card.fr.length > 60 && "is-long", card.fr.length > 110 && "is-xlong")}>{card.fr}</p>
            )}
            {card.cat === "def" && (state.hint || verdict) && (
              <p className="cl-hint">
                Terme français&nbsp;: <strong>{card.hint}</strong>
              </p>
            )}
            <div aria-live="polite">
              {verdict?.ok && (
                <div className="cl-verdict cl-verdict--ok">
                  <span className="cl-verdict-title">
                    <IconCheck /> Correct
                  </span>
                  <span className="cl-answer-text">{card.en}</span>
                </div>
              )}
              {verdict && !verdict.ok && (
                <div className="cl-verdict cl-verdict--bad">
                  <span className="cl-verdict-title">
                    <IconCross /> {verdict.input ? "Incorrect" : "À retenir"}
                  </span>
                  <span className="cl-verdict-label">Réponse attendue</span>
                  <span className="cl-answer-text">{card.en}</span>
                  <span className="cl-given">
                    {verdict.input ? (
                      <>
                        Votre réponse&nbsp;: <s>{verdict.input}</s>
                      </>
                    ) : (
                      "Carte passée avec « Je ne sais pas »."
                    )}
                  </span>
                  {phase === "wrong" && <span className="cl-countdown" style={{ animationDuration: `${verdict.revealMs}ms` }} />}
                </div>
              )}
            </div>
          </div>
        </article>
      </div>

      <form className="cl-answer" onSubmit={submit} autoComplete="off">
        <label htmlFor="cl-answer-input" className="cl-answer-label">
          Votre réponse en anglais
        </label>
        <div className="cl-answer-row">
          <input
            id="cl-answer-input"
            ref={inputRef}
            className={cls("cl-input", verdict && (verdict.ok ? "is-correct" : "is-wrong"))}
            value={state.input}
            onChange={(event) => dispatch({ type: "input", value: event.target.value })}
            readOnly={phase !== "answering"}
            placeholder="Tapez votre réponse…"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            enterKeyHint="done"
          />
          {phase === "wrong" ? (
            <button type="submit" className="cl-btn cl-btn--primary" onMouseDown={keepFocus}>
              Continuer <IconNext size={16} />
            </button>
          ) : (
            <button type="submit" className="cl-btn cl-btn--primary" onMouseDown={keepFocus} disabled={phase !== "answering" || !state.input.trim()}>
              Valider
            </button>
          )}
        </div>
        <div className="cl-answer-actions">
          <button type="button" className="cl-btn cl-btn--quiet" onMouseDown={keepFocus} onClick={() => answer(false, "")} disabled={phase !== "answering"}>
            Je ne sais pas
          </button>
          {card.cat === "def" && (
            <button type="button" className="cl-btn cl-btn--quiet" onMouseDown={keepFocus} onClick={() => dispatch({ type: "hint" })} disabled={phase !== "answering" || state.hint}>
              Indice
            </button>
          )}
          <span className="cl-answer-tip">Entrée pour valider</span>
        </div>
      </form>
    </div>
  );
}

const NAV_ITEMS = [
  { id: "home", label: "Accueil", Glyph: IconHome },
  { id: "profile", label: "Profil", Glyph: IconUser },
  { id: "ranking", label: "Classement (bientôt)", Glyph: IconPodium },
];

// Icônes seules, centrées ; la déconnexion est à gauche.
function NavBar({ screen, onNavigate, account, onSignOut, leaving }) {
  const active = screen === "session" || screen === "summary" ? "home" : screen;
  const logoutLabel = leaving ? "Déconnexion en cours" : account?.email ? `Se déconnecter (${account.email})` : "Se déconnecter";
  return (
    <header className="cl-nav">
      <nav className="cl-nav-inner" aria-label="Navigation principale">
        {onSignOut && (
          <button type="button" className="cl-nav-logout" onClick={onSignOut} disabled={leaving} aria-label={logoutLabel} title={logoutLabel}>
            <IconLogout size={22} />
          </button>
        )}
        <ul className="cl-nav-links">
          {NAV_ITEMS.map(({ id, label, Glyph }) => (
            <li key={id}>
              <button
                type="button"
                className="cl-nav-link"
                aria-current={active === id ? "page" : undefined}
                aria-label={label}
                title={label}
                onClick={() => onNavigate(id)}
              >
                <Glyph size={22} />
              </button>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  );
}

function Ranking({ summary }) {
  return (
    <div className="cl-wrap">
      <header className="cl-page-head">
        <p className="cl-eyebrow">Bientôt disponible</p>
        <h1>Classement</h1>
      </header>
      <section className="cl-panel" aria-labelledby="ranking-title">
        <h2 id="ranking-title">Défiez les autres élèves</h2>
        <p className="cl-muted">
          Le classement mettra les élèves en compétition : chacun gagnera des places en maîtrisant des cartes et en révisant chaque
          jour. Il arrive dans une prochaine version. Voici vos chiffres actuels.
        </p>
        <dl className="cl-stats cl-stats--3">
          <div>
            <dt>Cartes maîtrisées</dt>
            <dd>
              {summary.mastered}&nbsp;/&nbsp;{TOTAL}
            </dd>
          </div>
          <div>
            <dt>Série en cours</dt>
            <dd>{plural(summary.streak, "jour", "jours")}</dd>
          </div>
          <div>
            <dt>Note estimée</dt>
            <dd>{summary.grade}</dd>
          </div>
        </dl>
      </section>
    </div>
  );
}

function Home({ progress, summary, cats, onCatsChange, onSizeChange, onStart, storage }) {
  const size = progress.settings.size;
  const pool = CARDS.filter((card) => cats.includes(card.cat)).length;
  const toggle = (cat) => onCatsChange(cats.includes(cat) ? cats.filter((c) => c !== cat) : CAT_KEYS.filter((c) => c === cat || cats.includes(c)));
  const nextGrade = GRADES.slice().reverse().find((g) => g.min > summary.mastered);

  return (
    <div className="cl-wrap cl-home">
      <StorageNotice state={storage} />

      <section className="cl-hud" aria-label="Vos scores">
        <div className="cl-hud-item">
          <span className="cl-hud-icon" data-tone="streak">
            <IconFlame size={20} />
          </span>
          <span className="cl-hud-text">
            <span className="cl-hud-value">{summary.streak}</span>
            <span className="cl-hud-label">{summary.streak > 1 ? "jours de suite" : "jour de suite"}</span>
          </span>
        </div>
        <div className="cl-hud-item">
          <span className="cl-hud-icon" data-tone="mastered">
            <IconStack size={20} />
          </span>
          <span className="cl-hud-text">
            <span className="cl-hud-value">
              {summary.mastered}
              <small>/{TOTAL}</small>
            </span>
            <span className="cl-hud-label">maîtrisées</span>
          </span>
        </div>
        <div className="cl-hud-item">
          <span className="cl-hud-grade" aria-hidden="true">
            {summary.grade}
          </span>
          <span className="cl-hud-text">
            <span className="cl-hud-value cl-hud-value--word">Note {summary.grade}</span>
            <span className="cl-hud-label">{nextGrade ? `encore ${nextGrade.min - summary.mastered} pour ${nextGrade.grade}` : "note maximale"}</span>
          </span>
        </div>
      </section>

      <section className="cl-play" aria-labelledby="play-title">
        <div className="cl-play-head">
          <h1 id="play-title">Nouvelle partie</h1>
          <p>{TOTAL} cartes de vocabulaire anglais technique</p>
        </div>

        <fieldset className="cl-modes">
          <legend className="cl-sr">Catégories</legend>
          {CAT_KEYS.map((cat) => {
            const on = cats.includes(cat);
            return (
              <label key={cat} className={cls("cl-mode", on && "is-on")} data-cat={cat}>
                <input type="checkbox" id={`cat-${cat}`} className="cl-mode-input" checked={on} onChange={() => toggle(cat)} />
                <span className="cl-mode-glyph" aria-hidden="true">
                  <CatGlyph cat={cat} />
                </span>
                <span className="cl-mode-check" aria-hidden="true">
                  <IconCheck size={14} />
                </span>
                <span className="cl-mode-name">{CATEGORIES[cat].label}</span>
                <span className="cl-mode-meta">
                  {summary.masteredByCat[cat]}/{CAT_TOTAL[cat]} maîtrisées
                </span>
                <span className="cl-mode-bar" aria-hidden="true">
                  <span style={{ width: `${(summary.masteredByCat[cat] / CAT_TOTAL[cat]) * 100}%` }} />
                </span>
              </label>
            );
          })}
        </fieldset>

        <div className="cl-play-foot">
          <div className="cl-rounds">
            <span className="cl-rounds-label" id="rounds-label">
              Cartes par partie
            </span>
            <div className="cl-rounds-options" role="radiogroup" aria-labelledby="rounds-label">
              {SESSION_SIZES.map((n) => (
                <button key={n} type="button" role="radio" aria-checked={size === n} className={cls(size === n && "is-on")} onClick={() => onSizeChange(n)}>
                  {n}
                </button>
              ))}
            </div>
          </div>
          <button type="button" className="cl-play-btn" disabled={!cats.length} onClick={() => onStart("learn")}>
            <IconPlay size={22} />
            Jouer
          </button>
        </div>
        <p className="cl-play-note">{cats.length ? `${Math.min(size, pool)} cartes tirées parmi ${pool}` : "Choisissez au moins une catégorie pour jouer."}</p>
      </section>

      <section className={cls("cl-rematch", !summary.toReview && "is-empty")} aria-labelledby="rematch-title">
        <span className="cl-rematch-count" id="errors-count">
          {summary.toReview}
        </span>
        <div className="cl-rematch-text">
          <h2 id="rematch-title">Revanche</h2>
          <p>
            {summary.toReview
              ? `${plural(summary.toReview, "carte ratée", "cartes ratées")} à reprendre jusqu'à la maîtrise.`
              : "Aucune erreur à reprendre. Bien joué\u00a0!"}
          </p>
        </div>
        <button type="button" className="cl-btn cl-rematch-btn" disabled={!summary.toReview} onClick={() => onStart("errors")}>
          Revoir mes erreurs
        </button>
      </section>
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
            {a.input ? a.ok ? <span>{a.input}</span> : <s>{a.input}</s> : <em>Je ne sais pas</em>}
          </span>
          <span className="cl-attempt-box">
            Boîte {a.from} → {a.to}
          </span>
        </li>
      ))}
    </ol>
  );
}

function Summary({ result, canReplay, onReplay, onHome }) {
  const { results, completed, mode } = result;
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
        <h1>{completed ? "Partie terminée" : "Partie interrompue"}</h1>
      </header>

      <section className="cl-panel cl-score">
        <p className="cl-score-value">
          {good}
          <span>&nbsp;/&nbsp;{total}</span>
        </p>
        <div className="cl-score-text">
          <p className="cl-score-pct">{percent(good, total)}&nbsp;% de bonnes réponses</p>
          <p className="cl-muted">
            {plural(promoted, "carte montée", "cartes montées")} de boîte
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
        <caption className="cl-sr">Nombre de cartes par boîte de Leitner</caption>
        <tbody>
          {boxes.map((n, i) => (
            <tr key={i} title={`Boîte ${i + 1} : ${plural(n, "carte", "cartes")}`}>
              <th scope="row">
                Boîte {i + 1}
                {i === MAX_BOX - 1 && <span className="cl-boxchart-tag">maîtrisées</span>}
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
      <p className="cl-chart-note">La boîte 1 contient {plural(unseen, "carte jamais vue", "cartes jamais vues")}.</p>
    </div>
  );
}

function Profile({ progress, summary, onReset, storage }) {
  const [confirming, setConfirming] = useState(false);
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
              <li key={g.grade} className={cls(g.grade === summary.grade && "is-current")}>
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
        <h2 id="boxes-title">Répartition par boîte</h2>
        <BoxChart boxes={summary.boxes} unseen={summary.unseen} />
      </section>

      <section className="cl-panel" aria-labelledby="stats-title">
        <h2 id="stats-title">Statistiques</h2>
        <dl className="cl-stats">
          <div>
            <dt>Sessions jouées</dt>
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
        {resetDone && !confirming ? <p role="status">Progression réinitialisée. Toutes les cartes sont de retour en boîte 1.</p> : null}
        {confirming ? (
          <div className="cl-confirm" role="alertdialog" aria-labelledby="reset-confirm-text">
            <p id="reset-confirm-text">
              Toutes les cartes reviendront en boîte 1 et vos statistiques, séries et erreurs seront effacées. Cette action est définitive.
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
    </div>
  );
}

/* --------------------------------------------------------------------- App -- */

// account / onSignOut : fournis par le site (connexion Supabase). Absents dans un artifact.
export default function CardLearn({ account = null, onSignOut = null } = {}) {
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

  const startSession = (mode, sessionCats = cats) => {
    const pool = buildPool(mode, sessionCats, progress);
    if (!pool.length) return;
    const size = progress.settings.size;
    setSession({ id: Date.now(), mode, cats: sessionCats, size, queue: drawQueue(pool, progress, size) });
    setScreen("session");
  };

  // Quitter une session par la barre : les réponses données sont déjà enregistrées.
  const navigate = (target) => {
    setSession(null);
    setScreen(target);
  };

  const signOut = async () => {
    if (!onSignOut || leaving) return;
    setLeaving(true);
    // Laisse partir la dernière sauvegarde avant de se déconnecter.
    for (let i = 0; i < 30 && (dirty.current || saver.current.busy || saver.current.pending); i++) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    try {
      await onSignOut();
    } catch (err) {
      setLeaving(false);
    }
  };

  const handleAnswer = useCallback((card, ok, firstOfSession) => update((p) => recordAnswer(p, card, ok, firstOfSession)), [update]);

  const handleEnd = (results, completed) => {
    if (!results.length) {
      setSession(null);
      setScreen("home");
      return;
    }
    setResult({ results, completed, mode: session.mode, cats: session.cats });
    setSession(null);
    setScreen("summary");
  };

  let content;
  if (loading) {
    content = (
      <div className="cl-loading" role="status">
        <span className="cl-spinner" aria-hidden="true" />
        Chargement de votre progression…
      </div>
    );
  } else if (screen === "session" && session) {
    content = <Session key={session.id} config={session} progress={progress} onAnswer={handleAnswer} onEnd={handleEnd} reducedMotion={reducedMotion} />;
  } else if (screen === "summary" && result) {
    content = (
      <Summary
        result={result}
        canReplay={buildPool(result.mode, result.cats, progress).length > 0}
        onReplay={() => startSession(result.mode, result.cats)}
        onHome={() => setScreen("home")}
      />
    );
  } else if (screen === "profile") {
    content = <Profile progress={progress} summary={summary} storage={storage} onReset={() => update((p) => emptyProgress(p.settings.size))} />;
  } else if (screen === "ranking") {
    content = <Ranking summary={summary} />;
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
      />
    );
  }

  return (
    <div className="cl-app">
      <style>{STYLES}</style>
      {!loading && <NavBar screen={screen} onNavigate={navigate} account={account} onSignOut={onSignOut ? signOut : null} leaving={leaving} />}
      <main className="cl-main">{content}</main>
    </div>
  );
}

/* ------------------------------------------------------------------ Styles -- */

const STYLES = `
@import url("https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:ital,wght@0,400;0,700;1,400&family=Bricolage+Grotesque:opsz,wght@12..96,500..800&family=JetBrains+Mono:wght@400;600&display=swap");

/* Mise en page : une colonne d'étude ; la pile de fiches au centre, la saisie juste dessous. */
:root {
  --bg: #eceef4;
  --surface: #ffffff;
  --surface-2: #f4f5f9;
  --ink: #161a2c;
  --ink-2: #444a63;
  --ink-3: #5f6580;
  --line: #d6d9e5;
  --accent: #34399a;
  --accent-ink: #ffffff;
  --accent-soft: #e3e4f6;
  --ok: #1b7a37;
  --ok-soft: #dff1e4;
  --bad: #bf3329;
  --bad-soft: #fae5e3;
  --cat-mots: #2a78d6;
  --cat-expr: #eb6834;
  --cat-def: #1baf7a;
  --rule: rgba(191, 51, 41, 0.32);
  --play-bg: #262a74;
  --play-ink: #ffffff;
  --play-muted: rgba(255, 255, 255, 0.74);
  --play-line: rgba(255, 255, 255, 0.2);
  --play-tile: rgba(255, 255, 255, 0.07);
  --play-tile-on: rgba(255, 255, 255, 0.15);
  --cta: #ffc93c;
  --cta-ink: #231a00;
  --cta-shade: #c9921a;
  --flame: #d4570f;
  --flame-soft: #fde9dc;
  --shadow: 0 1px 2px rgba(22, 26, 44, 0.06), 0 10px 28px rgba(22, 26, 44, 0.09);
  --font-display: "Bricolage Grotesque", "Avenir Next", "Segoe UI", system-ui, sans-serif;
  --font-body: "Atkinson Hyperlegible", "Segoe UI", system-ui, -apple-system, sans-serif;
  --font-mono: "JetBrains Mono", ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace;
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --bg: #10121b;
    --surface: #1a1d29;
    --surface-2: #222636;
    --ink: #eceef7;
    --ink-2: #b6bbcf;
    --ink-3: #9197ae;
    --line: #2f3447;
    --accent: #aeb2f7;
    --accent-ink: #10121b;
    --accent-soft: #2a2d52;
    --ok: #5cc97c;
    --ok-soft: rgba(92, 201, 124, 0.15);
    --bad: #f27b6f;
    --bad-soft: rgba(242, 123, 111, 0.15);
    --cat-mots: #3987e5;
    --cat-expr: #d95926;
    --cat-def: #199e70;
    --rule: rgba(242, 123, 111, 0.34);
    --play-bg: #282c6e;
    --flame: #ff8f4d;
    --flame-soft: rgba(255, 143, 77, 0.15);
    --shadow: 0 1px 2px rgba(0, 0, 0, 0.4), 0 10px 28px rgba(0, 0, 0, 0.38);
    color-scheme: dark;
  }
}
:root[data-theme="dark"] {
  --bg: #10121b;
  --surface: #1a1d29;
  --surface-2: #222636;
  --ink: #eceef7;
  --ink-2: #b6bbcf;
  --ink-3: #9197ae;
  --line: #2f3447;
  --accent: #aeb2f7;
  --accent-ink: #10121b;
  --accent-soft: #2a2d52;
  --ok: #5cc97c;
  --ok-soft: rgba(92, 201, 124, 0.15);
  --bad: #f27b6f;
  --bad-soft: rgba(242, 123, 111, 0.15);
  --cat-mots: #3987e5;
  --cat-expr: #d95926;
  --cat-def: #199e70;
  --rule: rgba(242, 123, 111, 0.34);
  --play-bg: #282c6e;
  --flame: #ff8f4d;
  --flame-soft: rgba(255, 143, 77, 0.15);
  --shadow: 0 1px 2px rgba(0, 0, 0, 0.4), 0 10px 28px rgba(0, 0, 0, 0.38);
  color-scheme: dark;
}

body { margin: 0; background: var(--bg); color: var(--ink); }
.cl-app {
  min-height: 100vh;
  box-sizing: border-box;
  overflow-x: clip;
  background: var(--bg);
  color: var(--ink);
  font: 16px/1.55 var(--font-body);
  -webkit-font-smoothing: antialiased;
}
.cl-app *, .cl-app *::before, .cl-app *::after { box-sizing: border-box; }
.cl-app h1, .cl-app h2, .cl-app h3, .cl-app p, .cl-app ul, .cl-app ol, .cl-app dl, .cl-app dd, .cl-app fieldset { margin: 0; }
.cl-app ul, .cl-app ol { padding: 0; list-style: none; }
.cl-app h1, .cl-app h2, .cl-app h3 { font-family: var(--font-display); color: var(--ink); text-wrap: balance; letter-spacing: -0.01em; }
.cl-app h1 { font-size: 34px; line-height: 1.1; font-weight: 750; }
.cl-app h2 { font-size: 20px; line-height: 1.25; font-weight: 700; }
.cl-sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
.cl-icon { flex: none; }
.cl-muted { color: var(--ink-2); font-size: 15px; }
.cl-ink { color: var(--ink); }

.cl-main { padding-inline: 16px; padding-block: 24px 56px; }
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

/* Barre de navigation */
.cl-nav {
  position: sticky; top: 0; z-index: 40;
  padding-top: env(safe-area-inset-top, 0px);
  background: color-mix(in srgb, var(--surface) 94%, transparent);
  -webkit-backdrop-filter: blur(10px); backdrop-filter: blur(10px);
  border-bottom: 1px solid var(--line);
}
.cl-nav-inner { max-width: 960px; margin-inline: auto; padding-inline: 16px; min-height: 60px; display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 8px; }
.cl-nav-links { grid-column: 2; display: flex; align-items: center; gap: 10px; }
.cl-nav-link, .cl-nav-logout {
  display: inline-grid; place-items: center;
  width: 52px; height: 44px;
  border: 0; border-radius: 10px;
  background: none; color: var(--ink-2);
  cursor: pointer;
  transition: background-color .15s, color .15s;
}
.cl-nav-link:hover { background: var(--surface-2); color: var(--ink); }
.cl-nav-link[aria-current="page"] { background: var(--accent-soft); color: var(--accent); }
.cl-nav-logout { grid-column: 1; justify-self: start; width: 44px; color: var(--ink-3); }
.cl-nav-logout:hover:not(:disabled) { background: var(--bad-soft); color: var(--bad); }
.cl-nav-logout:disabled { opacity: .55; cursor: progress; }
.cl-nav-link:focus-visible, .cl-nav-logout:focus-visible { outline: 3px solid var(--accent); outline-offset: 2px; }

[data-cat="mots"] { --c: var(--cat-mots); }
[data-cat="expr"] { --c: var(--cat-expr); }
[data-cat="def"] { --c: var(--cat-def); }
.cl-cat-dot { width: 10px; height: 10px; border-radius: 50%; background: var(--c); flex: none; }

/* Accueil façon jeu : tableau de scores, plateau « Nouvelle partie », revanche */
.cl-home { gap: 16px; }
.cl-hud { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
.cl-hud-item { display: flex; align-items: center; gap: 10px; min-width: 0; padding: 12px 14px; border-radius: 12px; background: var(--surface); border: 1px solid var(--line); }
.cl-hud-icon { display: grid; place-items: center; width: 38px; height: 38px; flex: none; border-radius: 10px; }
.cl-hud-icon[data-tone="streak"] { background: var(--flame-soft); color: var(--flame); }
.cl-hud-icon[data-tone="mastered"] { background: var(--ok-soft); color: var(--ok); }
.cl-hud-grade { display: grid; place-items: center; width: 38px; height: 38px; flex: none; border-radius: 10px; border: 2px solid var(--ink); font: 800 21px/1 var(--font-display); color: var(--ink); }
.cl-hud-text { display: grid; gap: 1px; min-width: 0; }
.cl-hud-value { font: 800 22px/1.1 var(--font-display); color: var(--ink); font-variant-numeric: tabular-nums; }
.cl-hud-value small { font-size: 14px; font-weight: 600; color: var(--ink-3); }
.cl-hud-value--word { font-size: 17px; }
.cl-hud-label { font-size: 12.5px; line-height: 1.3; color: var(--ink-3); }

.cl-play {
  position: relative; overflow: hidden; isolation: isolate;
  display: grid; gap: 18px;
  padding: 24px;
  border-radius: 16px;
  background: var(--play-bg); color: var(--play-ink);
  box-shadow: var(--shadow);
}
/* Fiches décoratives dans le coin du plateau */
.cl-play::before, .cl-play::after {
  content: ""; position: absolute; z-index: -1;
  width: 150px; height: 104px; border-radius: 10px;
  border: 2px solid var(--play-line); background: var(--play-tile);
  top: -26px; right: -34px; transform: rotate(14deg);
}
.cl-play::after { top: -6px; right: 30px; transform: rotate(-8deg); }
.cl-play-head { display: grid; gap: 4px; }
.cl-app .cl-play-head h1 { color: var(--play-ink); font-size: 36px; font-weight: 800; letter-spacing: -0.02em; }
.cl-play-head p { color: var(--play-muted); font-size: 15px; }

.cl-modes { border: 0; margin: 0; padding: 0; min-width: 0; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
.cl-mode {
  position: relative; display: grid; gap: 6px; align-content: start;
  padding: 14px; border-radius: 12px;
  background: var(--play-tile); border: 2px solid var(--play-line);
  color: var(--play-ink); cursor: pointer; user-select: none;
  transition: background-color .15s, border-color .15s, transform .12s;
}
.cl-mode:hover { background: var(--play-tile-on); }
.cl-mode:active { transform: scale(.98); }
.cl-mode.is-on { background: var(--play-tile-on); border-color: var(--cta); }
.cl-mode:has(.cl-mode-input:focus-visible) { outline: 3px solid var(--play-ink); outline-offset: 2px; }
.cl-mode-input { position: absolute; opacity: 0; width: 1px; height: 1px; pointer-events: none; }
.cl-mode-glyph { display: grid; place-items: center; width: 38px; height: 38px; border-radius: 10px; background: var(--c); color: #ffffff; margin-bottom: 4px; }
.cl-glyph-text { font: 800 17px/1 var(--font-display); letter-spacing: -0.02em; }
.cl-mode-check { position: absolute; top: 12px; right: 12px; display: grid; place-items: center; width: 24px; height: 24px; border-radius: 50%; border: 2px solid var(--play-line); color: transparent; }
.cl-mode.is-on .cl-mode-check { background: var(--cta); border-color: var(--cta); color: var(--cta-ink); }
.cl-mode-name { font: 700 17px/1.2 var(--font-display); }
.cl-mode-meta { font-size: 13px; color: var(--play-muted); font-variant-numeric: tabular-nums; }
.cl-mode-bar { display: block; height: 5px; margin-top: 4px; border-radius: 999px; background: var(--play-line); overflow: hidden; }
.cl-mode-bar > span { display: block; height: 100%; border-radius: 999px; background: var(--c); }

.cl-play-foot { display: flex; flex-wrap: wrap; align-items: flex-end; justify-content: space-between; gap: 16px; }
.cl-rounds { display: grid; gap: 8px; }
.cl-rounds-label { font: 600 12px/1.4 var(--font-mono); letter-spacing: .08em; text-transform: uppercase; color: var(--play-muted); }
.cl-rounds-options { display: inline-flex; gap: 4px; padding: 4px; border-radius: 12px; background: var(--play-tile); border: 1px solid var(--play-line); }
.cl-rounds-options button { min-width: 58px; min-height: 42px; border: 0; border-radius: 8px; background: transparent; color: var(--play-ink); font: 700 16px/1 var(--font-mono); cursor: pointer; }
.cl-rounds-options button.is-on { background: var(--play-ink); color: var(--play-bg); }
.cl-play-btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 10px;
  min-width: 200px; min-height: 60px; padding: 0 34px;
  border: 0; border-radius: 14px;
  background: var(--cta); color: var(--cta-ink);
  font: 800 24px/1 var(--font-display); letter-spacing: -0.01em;
  box-shadow: 0 5px 0 var(--cta-shade);
  cursor: pointer; transition: transform .08s, box-shadow .08s, filter .15s;
}
.cl-play-btn:hover:not(:disabled) { filter: brightness(1.05); }
.cl-play-btn:active:not(:disabled) { transform: translateY(4px); box-shadow: 0 1px 0 var(--cta-shade); }
.cl-play-btn:focus-visible { outline: 3px solid var(--play-ink); outline-offset: 3px; }
.cl-play-btn:disabled { opacity: .45; cursor: not-allowed; }
.cl-app .cl-play-note { font-size: 13px; color: var(--play-muted); margin-top: -6px; }

.cl-rematch { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: center; gap: 16px; padding: 16px 18px; border-radius: 14px; background: var(--surface); border: 1px solid var(--line); }
.cl-rematch-count { display: grid; place-items: center; min-width: 54px; height: 54px; padding: 0 10px; border-radius: 14px; background: var(--bad-soft); color: var(--bad); font: 800 26px/1 var(--font-display); font-variant-numeric: tabular-nums; }
.cl-rematch.is-empty .cl-rematch-count { background: var(--ok-soft); color: var(--ok); }
.cl-rematch-text { display: grid; gap: 2px; min-width: 0; }
.cl-rematch-text p { font-size: 14px; color: var(--ink-2); }
.cl-rematch-btn { white-space: nowrap; }

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

/* Session */
.cl-session-bar { display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: 14px; }
.cl-session-progress { display: grid; gap: 6px; min-width: 0; }
.cl-session-count { font: 600 13px/1.2 var(--font-mono); color: var(--ink-2); font-variant-numeric: tabular-nums; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.cl-session-score { display: inline-flex; gap: 10px; font: 600 14px/1 var(--font-mono); font-variant-numeric: tabular-nums; }
.cl-session-score span { display: inline-flex; align-items: center; gap: 3px; }
.cl-session-score .is-ok { color: var(--ok); }
.cl-session-score .is-bad { color: var(--bad); }

.cl-deck { position: relative; margin-top: 4px; padding-bottom: 38px; }
.cl-card { background: var(--surface); border: 1px solid var(--line); border-radius: 8px; }
.cl-card--back {
  position: absolute; inset: 0 0 38px 0;
  transform-origin: 50% 100%;
  transform: translateY(calc(var(--depth) * 12px)) scale(calc(1 - var(--depth) * .05));
  box-shadow: 0 1px 2px rgba(22, 26, 44, .06);
  transition: transform .42s cubic-bezier(.2, .7, .2, 1);
  animation: cl-fade-in .35s ease-out both;
}
.cl-card--front {
  position: relative; z-index: 10;
  min-height: 260px; padding: 16px 22px 24px;
  display: flex; flex-direction: column; gap: 16px;
  box-shadow: var(--shadow);
  transform-origin: 50% 100%;
  transition: border-color .2s, box-shadow .2s;
}
.cl-card-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding-bottom: 12px; border-bottom: 1.5px solid var(--rule); }
.cl-card-box { font: 600 12px/1.3 var(--font-mono); color: var(--ink-3); font-variant-numeric: tabular-nums; text-align: right; }
.cl-card-body { display: grid; gap: 12px; align-content: start; flex: 1; }
.cl-card--front .cl-card-head, .cl-card--front .cl-card-body { animation: cl-fade-in .3s ease-out both; }
.cl-card-instruction { font-size: 14px; color: var(--ink-3); }
.cl-card-fr { font: 700 34px/1.15 var(--font-display); letter-spacing: -0.015em; color: var(--ink); text-wrap: balance; overflow-wrap: anywhere; }
.cl-card-fr.is-long { font-size: 25px; line-height: 1.25; }
.cl-card-fr.is-xlong { font-size: 21px; line-height: 1.3; }
.cl-card-def { font-size: 18px; line-height: 1.6; color: var(--ink); max-width: 60ch; }
.cl-blank { display: inline-block; min-width: 4.5em; border-bottom: 2px dotted var(--ink-3); line-height: 1.2; }
.cl-blank.is-revealed { min-width: 0; border-bottom-style: solid; border-bottom-color: var(--cat-def); font-weight: 700; }
.cl-hint { font-size: 15px; color: var(--ink-2); padding: 8px 12px; border-radius: 6px; background: var(--surface-2); justify-self: start; }
.cl-hint strong { color: var(--ink); }

.cl-verdict { display: grid; gap: 4px; padding: 12px 14px; border-radius: 8px; position: relative; overflow: hidden; }
.cl-verdict--ok { background: var(--ok-soft); }
.cl-verdict--bad { background: var(--bad-soft); }
.cl-verdict-title { display: inline-flex; align-items: center; gap: 6px; font-weight: 700; }
.cl-verdict--ok .cl-verdict-title { color: var(--ok); }
.cl-verdict--bad .cl-verdict-title { color: var(--bad); }
.cl-verdict-label { font: 600 11.5px/1.5 var(--font-mono); letter-spacing: .06em; text-transform: uppercase; color: var(--ink-2); margin-top: 4px; }
.cl-answer-text { font: 600 19px/1.4 var(--font-mono); color: var(--ink); overflow-wrap: anywhere; }
.cl-given { font-size: 14px; color: var(--ink-2); overflow-wrap: anywhere; }
.cl-given s { text-decoration-thickness: 1.5px; }
.cl-countdown { position: absolute; left: 0; bottom: 0; height: 3px; width: 100%; background: var(--bad); transform-origin: left center; animation: cl-countdown 2s linear forwards; }

.cl-card--front.is-correct { border-color: var(--ok); box-shadow: 0 0 0 3px var(--ok-soft), var(--shadow); animation: cl-pop .32s ease-out; }
.cl-card--front.is-wrong { border-color: var(--bad); box-shadow: 0 0 0 3px var(--bad-soft), var(--shadow); animation: cl-shake .36s ease-in-out; }
.cl-card--front.is-exit-back { animation: cl-to-back .68s cubic-bezier(.45, .05, .35, 1) forwards, cl-sink .68s linear forwards; }
.cl-card--front.is-exit-back .cl-card-head, .cl-card--front.is-exit-back .cl-card-body { animation: cl-fade-out .24s ease-out forwards; }
.cl-card--front.is-exit-side { animation: cl-slide-out .42s cubic-bezier(.55, 0, .8, .2) forwards; }
.cl-card--front.is-exit-fade { animation: cl-fade-out .18s linear forwards; }

/* Saisie */
.cl-answer { display: grid; gap: 8px; }
.cl-answer-label { font: 600 12px/1.4 var(--font-mono); letter-spacing: .08em; text-transform: uppercase; color: var(--ink-3); }
.cl-answer-row { display: flex; gap: 10px; }
.cl-input {
  flex: 1; width: 0; min-width: 0; min-height: 50px; padding: 12px 14px;
  border: 1.5px solid var(--line); border-radius: 8px;
  background: var(--surface); color: var(--ink);
  font: 500 17px/1.3 var(--font-mono);
  transition: border-color .15s, background-color .15s;
}
.cl-input::placeholder { color: var(--ink-3); }
.cl-input:focus { border-color: var(--accent); outline: none; box-shadow: 0 0 0 3px var(--accent-soft); }
.cl-input.is-correct { border-color: var(--ok); background: var(--ok-soft); }
.cl-input.is-wrong { border-color: var(--bad); background: var(--bad-soft); }
.cl-answer-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
.cl-answer-tip { margin-left: auto; font-size: 13px; color: var(--ink-3); }

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
.cl-missed-hint { display: inline-flex; align-items: center; gap: 4px; font-size: 13px; color: var(--ink-3); white-space: nowrap; }
.cl-missed-hint .cl-icon { transition: transform .2s; }
.cl-missed.is-open .cl-missed-hint .cl-icon { transform: rotate(180deg); }
.cl-attempts { display: grid; gap: 6px; padding: 10px 12px; border-radius: 8px; background: var(--surface-2); }
.cl-attempts li { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: baseline; gap: 4px 14px; font-size: 14px; }
.cl-attempt-turn { font: 600 12px/1.4 var(--font-mono); color: var(--ink-3); font-variant-numeric: tabular-nums; white-space: nowrap; }
.cl-attempt-answer { display: inline-flex; align-items: baseline; gap: 6px; min-width: 0; font: 500 14px/1.4 var(--font-mono); color: var(--ink); overflow-wrap: anywhere; }
.cl-attempt-answer .cl-icon { align-self: center; }
.cl-attempts .is-ok .cl-attempt-answer .cl-icon { color: var(--ok); }
.cl-attempts .is-bad .cl-attempt-answer .cl-icon { color: var(--bad); }
.cl-attempt-answer em { font-family: var(--font-body); color: var(--ink-2); }
.cl-attempt-answer s { color: var(--ink-2); text-decoration-thickness: 1.5px; }
.cl-attempt-box { font: 500 12px/1.4 var(--font-mono); color: var(--ink-3); white-space: nowrap; font-variant-numeric: tabular-nums; }
.cl-rank { width: 26px; flex: none; font: 600 15px/1.6 var(--font-mono); color: var(--ink-3); font-variant-numeric: tabular-nums; }

/* Profil */
.cl-cat-progress { display: grid; gap: 14px; }
.cl-cat-progress li { display: grid; grid-template-columns: 1fr auto; gap: 6px 12px; align-items: center; }
.cl-cat-progress .cl-meter { grid-column: 1 / -1; }
.cl-cat-progress-label { display: inline-flex; align-items: center; gap: 8px; font-weight: 700; }
.cl-cat-progress-value { font: 500 14px/1.3 var(--font-mono); color: var(--ink-2); font-variant-numeric: tabular-nums; }
.cl-grade { display: flex; align-items: center; gap: 16px; }
.cl-grade-letter { display: grid; place-items: center; width: 76px; height: 76px; flex: none; border-radius: 10px; border: 2px solid var(--ink); font: 800 46px/1 var(--font-display); color: var(--ink); background: var(--surface-2); }
.cl-grade-scale { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 6px; }
.cl-grade-scale li { display: grid; gap: 2px; padding: 8px; border-radius: 6px; border: 1px solid var(--line); font-size: 12.5px; color: var(--ink-3); font-variant-numeric: tabular-nums; }
.cl-grade-scale li.is-current { border-color: var(--ink); color: var(--ink); background: var(--surface-2); }
.cl-grade-scale-letter { font: 700 18px/1.1 var(--font-display); color: var(--ink); }
.cl-stats { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
.cl-stats.cl-stats--3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
.cl-stats div { display: grid; gap: 4px; padding: 12px; border-radius: 8px; background: var(--surface-2); min-width: 0; }
.cl-stats dt { font-size: 13px; color: var(--ink-2); }
.cl-stats dd { font: 700 24px/1.1 var(--font-body); font-variant-numeric: tabular-nums; color: var(--ink); }

.cl-boxchart { display: grid; gap: 10px; }
.cl-boxchart-table { width: 100%; border-collapse: collapse; }
.cl-boxchart-table th { width: 1%; padding: 6px 14px 6px 0; text-align: left; white-space: nowrap; font: 600 14px/1.3 var(--font-body); color: var(--ink); vertical-align: middle; }
.cl-boxchart-table td { padding: 6px 0; }
.cl-boxchart-table tr:hover th { color: var(--accent); }
.cl-boxchart-tag { display: block; font: 500 12px/1.2 var(--font-mono); color: var(--ink-3); }
.cl-boxchart-track { display: flex; align-items: center; gap: 8px; }
.cl-boxchart-bar { display: block; height: 20px; width: calc((100% - 48px) * var(--r)); border-radius: 0 4px 4px 0; background: var(--accent); transition: width .5s ease; }
.cl-boxchart-bar.is-mastered { background: var(--ok); }
.cl-boxchart-value { font: 600 14px/1 var(--font-mono); color: var(--ink); font-variant-numeric: tabular-nums; }
.cl-chart-note { font-size: 13px; color: var(--ink-3); }

.cl-danger { border-color: color-mix(in srgb, var(--bad) 40%, var(--line)); }
.cl-danger .cl-btn { justify-self: start; }
.cl-confirm { display: grid; gap: 12px; padding: 14px; border-radius: 8px; background: var(--bad-soft); }

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
  .cl-main { padding-block: 16px 40px; }
  .cl-app h1 { font-size: 28px; }
  .cl-grid-2 { grid-template-columns: minmax(0, 1fr); }
  .cl-play { padding: 18px; gap: 16px; }
  .cl-play::before { width: 96px; height: 68px; top: -30px; right: -30px; }
  .cl-play::after { display: none; }
  .cl-app .cl-play-head h1 { font-size: 30px; }
  .cl-modes { grid-template-columns: minmax(0, 1fr); gap: 8px; }
  .cl-mode { grid-template-columns: auto minmax(0, 1fr); column-gap: 12px; row-gap: 2px; padding: 10px 44px 10px 12px; align-items: center; }
  .cl-mode-glyph { grid-row: span 3; margin-bottom: 0; }
  .cl-mode-check { top: 50%; transform: translateY(-50%); }
  .cl-mode-name, .cl-mode-meta, .cl-mode-bar { grid-column: 2; }
  .cl-play-foot { flex-direction: column; align-items: stretch; }
  .cl-rounds-options { display: flex; }
  .cl-rounds-options button { flex: 1; }
  .cl-play-btn { width: 100%; }
  .cl-hud { gap: 8px; }
  .cl-hud-item { flex-direction: column; align-items: flex-start; gap: 8px; padding: 10px; }
  .cl-rematch { grid-template-columns: auto minmax(0, 1fr); }
  .cl-rematch-btn { grid-column: 1 / -1; }
  .cl-stats { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .cl-panel { padding: 16px; }
  .cl-card--front { min-height: 230px; padding: 14px 16px 20px; }
  .cl-card-fr { font-size: 28px; }
  .cl-card-fr.is-long { font-size: 22px; }
  .cl-card-fr.is-xlong { font-size: 19px; }
  .cl-card-def { font-size: 16.5px; }
  .cl-answer-tip { display: none; }
  .cl-score { grid-template-columns: minmax(0, 1fr); gap: 10px; }
  .cl-attempts li { grid-template-columns: auto minmax(0, 1fr); }
  .cl-attempt-box { grid-column: 2; }
}
@media (prefers-reduced-motion: reduce) {
  .cl-app *, .cl-app *::before, .cl-app *::after { transition-duration: .01ms !important; }
  .cl-card--front.is-correct, .cl-card--front.is-wrong, .cl-card--back { animation: none; }
  .cl-card--front.is-exit-fade { animation: cl-fade-out .18s linear forwards; }
  .cl-spinner { animation-duration: 2s; }
}
`;
