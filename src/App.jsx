import React, { useEffect, useMemo, useState } from "react";
import CardLearn from "../CardLearn.jsx";
import { githubEnabled, recoveryInUrl, supabase } from "./supabase.js";
import { createLocalStorage, createSupabaseStorage, forgetLocalCopies } from "./storage.js";

const MIN_PASSWORD = 8;

// Appli ajoutée à l'écran d'accueil : un lien reçu par e-mail s'ouvre dans le navigateur, pas dans
// l'appli (sur iPhone notamment). On y propose donc la connexion par mot de passe uniquement.
const installedApp = (() => {
  try {
    return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
  } catch (err) {
    return false;
  }
})();

// Installe window.storage avant de monter CardLearn, qui le lit au démarrage.
function StorageScope({ storage, children }) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    window.storage = storage;
    setReady(true);
    const flush = () => storage.flush().catch(() => {});
    window.addEventListener("online", flush);
    return () => {
      window.removeEventListener("online", flush);
      if (window.storage === storage) delete window.storage;
    };
  }, [storage]);
  return ready ? children : null;
}

function Brand() {
  return (
    <div className="sh-brand">
      <svg className="sh-logo" width="40" height="40" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect x="7.5" y="2.5" width="13" height="15" rx="2.5" stroke="#8A8EAE" strokeWidth="1.6" />
        <rect x="3.5" y="6.5" width="13" height="15" rx="2.5" fill="#FFC93C" />
      </svg>
      <span className="sh-brand-name">CardLearn</span>
    </div>
  );
}

// Erreur renvoyée dans l'URL par un lien expiré ou déjà utilisé.
function errorFromUrl() {
  try {
    const params = new URLSearchParams(window.location.hash.slice(1) || window.location.search.slice(1));
    const description = params.get("error_description");
    if (!description) return "";
    window.history.replaceState(null, "", window.location.pathname);
    return /expired|invalid/i.test(description)
      ? "Ce lien a expiré ou a déjà servi. Demandes-en un nouveau."
      : `Connexion impossible : ${description}`;
  } catch (err) {
    return "";
  }
}

function authMessage(err, fallback) {
  switch (err?.code) {
    case "invalid_credentials":
      return "Adresse e-mail ou mot de passe incorrect.";
    case "email_not_confirmed":
      return "Confirme d'abord ton adresse : clique sur le lien reçu par e-mail à l'inscription.";
    case "user_already_exists":
      return "Un compte existe déjà avec cette adresse. Connecte-toi, ou utilise « Mot de passe oublié ».";
    case "weak_password":
      return "Mot de passe trop faible. Choisis-en un plus long, avec des lettres et des chiffres.";
    case "same_password":
      return "Le nouveau mot de passe doit être différent de l'ancien.";
    case "email_address_invalid":
      return "Cette adresse e-mail n'est pas valide.";
    case "signup_disabled":
      return "La création de compte est désactivée sur cette application.";
    case "email_provider_disabled":
      return "La connexion par e-mail est désactivée dans Supabase (Authentication → Sign In / Providers).";
    case "over_email_send_rate_limit":
      return "Trop d'e-mails envoyés en peu de temps. Patiente quelques minutes avant de réessayer.";
    default:
      return err?.status === 429 ? "Trop de tentatives en peu de temps. Patiente quelques minutes avant de réessayer." : fallback;
  }
}

function PasswordField({ id, value, onChange, autoComplete, label = "Mot de passe", hint }) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="sh-field">
      <label htmlFor={id}>{label}</label>
      <div className="sh-password">
        <input
          id={id}
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          minLength={autoComplete === "new-password" ? MIN_PASSWORD : undefined}
          aria-describedby={hint ? `${id}-hint` : undefined}
          required
        />
        <button type="button" className="sh-toggle" onClick={() => setVisible((v) => !v)} aria-controls={id} aria-pressed={visible}>
          {visible ? "Masquer" : "Afficher"}
        </button>
      </div>
      {hint && (
        <p id={`${id}-hint`} className="sh-hint">
          {hint}
        </p>
      )}
    </div>
  );
}

const SCREENS = {
  signin: { title: "Connexion", intro: "Retrouve tes niveaux, tes erreurs et tes statistiques sur tous tes appareils.", submit: "Se connecter" },
  signup: { title: "Créer un compte", intro: "Ta progression sera enregistrée et synchronisée sur tous tes appareils.", submit: "Créer mon compte" },
  forgot: { title: "Mot de passe oublié", intro: "Indique ton adresse : tu recevras un lien pour choisir un nouveau mot de passe.", submit: "Envoyer le lien" },
  magic: { title: "Connexion sans mot de passe", intro: "Reçois un lien de connexion par e-mail. Un clic suffit pour te connecter.", submit: "Recevoir le lien" },
};

const FAILURES = {
  signin: "La connexion a échoué. Vérifie ta connexion internet, puis réessaie.",
  signup: "La création du compte a échoué. Vérifie ta connexion internet, puis réessaie.",
  forgot: "L'envoi du lien a échoué. Vérifie l'adresse et ta connexion, puis réessaie.",
  magic: "L'envoi du lien a échoué. Vérifie l'adresse et ta connexion, puis réessaie.",
};

function Login({ notice = "" }) {
  const [mode, setMode] = useState("signin"); // signin | signup | forgot | magic
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(null); // { kind: confirm | reset | magic, email }
  const [error, setError] = useState(errorFromUrl);
  const redirectTo = window.location.origin + window.location.pathname;
  const screen = SCREENS[mode];

  const goTo = (next) => {
    setMode(next);
    setError("");
    setSent(null);
  };

  const submit = async (event) => {
    event.preventDefault();
    const address = email.trim();
    if (!address) return;
    setBusy(true);
    setError("");
    try {
      if (mode === "signin") {
        const { error: authError } = await supabase.auth.signInWithPassword({ email: address, password });
        if (authError) throw authError;
      } else if (mode === "signup") {
        const { data, error: authError } = await supabase.auth.signUp({ email: address, password, options: { emailRedirectTo: redirectTo } });
        if (authError) throw authError;
        // Avec la confirmation d'e-mail activée, une adresse déjà inscrite renvoie un compte sans identité.
        if (!data.session && data.user?.identities?.length === 0) throw { code: "user_already_exists" };
        if (!data.session) setSent({ kind: "confirm", email: address });
      } else if (mode === "forgot") {
        const { error: authError } = await supabase.auth.resetPasswordForEmail(address, { redirectTo });
        if (authError) throw authError;
        setSent({ kind: "reset", email: address });
      } else {
        const { error: authError } = await supabase.auth.signInWithOtp({ email: address, options: { emailRedirectTo: redirectTo } });
        if (authError) throw authError;
        setSent({ kind: "magic", email: address });
      }
    } catch (err) {
      setError(authMessage(err, FAILURES[mode]));
    } finally {
      setBusy(false);
    }
  };

  const withGitHub = async () => {
    setError("");
    const { error: authError } = await supabase.auth.signInWithOAuth({ provider: "github", options: { redirectTo } });
    if (authError) setError("La connexion avec GitHub a échoué. Réessaie ou utilise ton e-mail.");
  };

  const sentText =
    sent &&
    (installedApp
      ? {
          confirm: "Ouvre l'e-mail de confirmation et clique sur le lien, puis reviens dans l'appli et connecte-toi.",
          reset: "Le lien de l'e-mail ouvre CardLearn dans le navigateur pour choisir un nouveau mot de passe. Reviens ensuite dans l'appli pour te connecter.",
          magic: "Ouvre l'e-mail et clique sur le lien pour te connecter.",
        }
      : {
          confirm: "Ouvre l'e-mail de confirmation et clique sur le lien : ton compte sera activé et tu seras connecté.",
          reset: "Ouvre l'e-mail et clique sur le lien pour choisir un nouveau mot de passe.",
          magic: "Ouvre l'e-mail et clique sur le lien pour te connecter.",
        })[sent.kind];

  return (
    <main className="sh-page">
      <div className="sh-login">
        <Brand />
        {notice && (
          <p className="sh-notice" role="status">
            {notice}
          </p>
        )}

        {(mode === "signin" || mode === "signup") && (
          <div className="sh-tabs" role="group" aria-label="Connexion ou création de compte">
            <button type="button" aria-pressed={mode === "signin"} onClick={() => goTo("signin")}>
              Se connecter
            </button>
            <button type="button" aria-pressed={mode === "signup"} onClick={() => goTo("signup")}>
              Créer un compte
            </button>
          </div>
        )}

        <div className="sh-login-text">
          <h1>{screen.title}</h1>
          <p>{screen.intro}</p>
        </div>

        {sent ? (
          <div className="sh-sent" role="status">
            <p>
              E-mail envoyé à <strong>{sent.email}</strong>.
            </p>
            <p>{sentText} Pense à regarder dans les indésirables.</p>
            <button type="button" className="sh-link" onClick={() => goTo("signin")}>
              Retour à la connexion
            </button>
          </div>
        ) : (
          <form className="sh-form" onSubmit={submit}>
            <div className="sh-field">
              <label htmlFor="login-email">Adresse e-mail</label>
              <input
                id="login-email"
                type="email"
                inputMode="email"
                autoComplete={mode === "signup" ? "email" : "username"}
                placeholder="prenom.nom@exemple.fr"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </div>
            {(mode === "signin" || mode === "signup") && (
              <PasswordField
                key={mode}
                id="login-password"
                value={password}
                onChange={setPassword}
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
                hint={mode === "signup" ? `${MIN_PASSWORD} caractères minimum.` : undefined}
              />
            )}
            {mode === "signin" && (
              <button type="button" className="sh-link sh-link--end" onClick={() => goTo("forgot")}>
                Mot de passe oublié&nbsp;?
              </button>
            )}
            <button type="submit" className="sh-btn sh-btn--primary" disabled={busy}>
              {busy ? "Patiente…" : screen.submit}
            </button>
          </form>
        )}

        {error && (
          <p className="sh-error" role="alert">
            {error}
          </p>
        )}

        {(mode === "forgot" || mode === "magic") && !sent && (
          <button type="button" className="sh-link" onClick={() => goTo("signin")}>
            Retour à la connexion
          </button>
        )}

        {(mode === "signin" || mode === "signup") && !installedApp && (
          <div className="sh-alt">
            <p className="sh-or">ou</p>
            <button type="button" className="sh-btn" onClick={() => goTo("magic")}>
              Recevoir un lien par e‑mail
            </button>
            {githubEnabled && (
              <button type="button" className="sh-btn" onClick={withGitHub}>
                Continuer avec GitHub
              </button>
            )}
          </div>
        )}
      </div>
    </main>
  );
}

// Après un lien « mot de passe oublié » : la personne est connectée et choisit son nouveau mot de passe.
function NewPassword({ email, onDone }) {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const { error: authError } = await supabase.auth.updateUser({ password });
      if (authError) throw authError;
      onDone();
    } catch (err) {
      setError(authMessage(err, "L'enregistrement du mot de passe a échoué. Vérifie ta connexion internet, puis réessaie."));
      setBusy(false);
    }
  };

  return (
    <main className="sh-page">
      <div className="sh-login">
        <Brand />
        <div className="sh-login-text">
          <h1>Nouveau mot de passe</h1>
          <p>
            Choisis le mot de passe du compte <strong className="sh-ink">{email}</strong>.
          </p>
        </div>
        <form className="sh-form" onSubmit={submit}>
          <PasswordField id="new-password" label="Nouveau mot de passe" value={password} onChange={setPassword} autoComplete="new-password" hint={`${MIN_PASSWORD} caractères minimum.`} />
          <button type="submit" className="sh-btn sh-btn--primary" disabled={busy}>
            {busy ? "Enregistrement…" : "Enregistrer le mot de passe"}
          </button>
        </form>
        {error && (
          <p className="sh-error" role="alert">
            {error}
          </p>
        )}
        <button type="button" className="sh-link" onClick={onDone}>
          Plus tard
        </button>
      </div>
    </main>
  );
}

function SignedIn({ session, onAccountDeleted }) {
  const userId = session.user.id;
  const storage = useMemo(() => createSupabaseStorage(supabase, userId), [userId]);

  // Appelée par le profil de CardLearn : fonction SQL delete_my_account (voir supabase/schema.sql).
  const deleteAccount = async () => {
    const { error } = await supabase.rpc("delete_my_account");
    if (error) {
      throw new Error(
        error.code === "PGRST202"
          ? "La suppression de compte n'est pas encore activée sur ce site. Réessaie plus tard."
          : "La suppression du compte a échoué. Vérifie ta connexion internet, puis réessaie."
      );
    }
    forgetLocalCopies(userId);
    onAccountDeleted();
    await supabase.auth.signOut({ scope: "local" });
  };

  // Appelée par la barre de navigation de CardLearn.
  const signOut = async () => {
    await storage.flush().catch(() => {}); // hors ligne : la copie locale sera renvoyée à la prochaine connexion
    await supabase.auth.signOut({ scope: "local" });
  };

  // Classement : pseudos (table players) et scores calculés par la fonction SQL get_leaderboard.
  const leaderboard = useMemo(() => {
    const notReady = (error) => ["PGRST202", "PGRST205", "42P01", "42883"].includes(error?.code);
    const fail = (error, fallback) =>
      new Error(notReady(error) ? "Le classement n'est pas encore activé sur ce site. Réessaie plus tard." : fallback);
    return {
      async load() {
        const [board, mine] = await Promise.all([
          supabase.rpc("get_leaderboard"),
          supabase.from("players").select("pseudo").eq("user_id", userId).maybeSingle(),
        ]);
        const error = board.error || mine.error;
        if (error) throw fail(error, "Le classement n'a pas pu être chargé. Vérifie ta connexion internet, puis réessaie.");
        return { entries: Array.isArray(board.data) ? board.data : [], pseudo: mine.data?.pseudo ?? null };
      },
      async join(pseudo) {
        const { error } = await supabase.from("players").upsert({ user_id: userId, pseudo }, { onConflict: "user_id" });
        if (!error) return;
        if (error.code === "23505") throw new Error("Ce pseudo est déjà pris. Choisis-en un autre.");
        if (error.code === "23514") throw new Error("Le pseudo doit faire entre 2 et 20 caractères.");
        throw fail(error, "Le pseudo n'a pas pu être enregistré. Vérifie ta connexion internet, puis réessaie.");
      },
      async leave() {
        const { error } = await supabase.from("players").delete().eq("user_id", userId);
        if (error) throw fail(error, "Impossible de quitter le classement pour le moment. Réessaie.");
      },
    };
  }, [userId]);

  return (
    <StorageScope key={userId} storage={storage}>
      <CardLearn
        account={{ email: session.user.email || "Compte GitHub" }}
        onSignOut={signOut}
        onDeleteAccount={deleteAccount}
        leaderboard={leaderboard}
      />
    </StorageScope>
  );
}

function WithAccount() {
  const [session, setSession] = useState(undefined); // undefined : vérification en cours
  const [recovery, setRecovery] = useState(recoveryInUrl);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let alive = true;
    supabase.auth
      .getSession()
      .then(({ data }) => alive && setSession(data.session ?? null))
      .catch(() => alive && setSession(null));
    const { data } = supabase.auth.onAuthStateChange((event, next) => {
      if (event === "PASSWORD_RECOVERY") setRecovery(true);
      setSession(next ?? null);
    });
    return () => {
      alive = false;
      data.subscription.unsubscribe();
    };
  }, []);

  if (session === undefined) {
    return (
      <main className="sh-page" role="status">
        <p className="sh-loading">Vérification de la connexion…</p>
      </main>
    );
  }
  if (!session) return <Login notice={notice} />;
  if (recovery) return <NewPassword email={session.user.email} onDone={() => setRecovery(false)} />;
  return <SignedIn session={session} onAccountDeleted={() => setNotice("Ton compte et ta progression ont été supprimés.")} />;
}

const localStorageBackend = createLocalStorage();

export default function App() {
  if (!supabase) {
    return (
      <StorageScope storage={localStorageBackend}>
        <CardLearn />
      </StorageScope>
    );
  }
  return <WithAccount />;
}
