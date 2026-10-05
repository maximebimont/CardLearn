import React, { useEffect, useMemo, useState } from "react";
import CardLearn from "../CardLearn.jsx";
import { githubEnabled, supabase } from "./supabase.js";
import { createLocalStorage, createSupabaseStorage } from "./storage.js";

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
      <span className="sh-logo" aria-hidden="true">
        <span />
        <span />
        <span />
      </span>
      <span className="sh-brand-name">CardLearn</span>
    </div>
  );
}

// Erreur renvoyée dans l'URL par un lien de connexion expiré ou déjà utilisé.
function errorFromUrl() {
  try {
    const params = new URLSearchParams(window.location.hash.slice(1) || window.location.search.slice(1));
    const description = params.get("error_description");
    if (!description) return "";
    window.history.replaceState(null, "", window.location.pathname);
    return /expired|invalid/i.test(description)
      ? "Ce lien de connexion a expiré ou a déjà servi. Demandez-en un nouveau."
      : `Connexion impossible : ${description}`;
  } catch (err) {
    return "";
  }
}

function Login() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("idle"); // idle | sending | sent
  const [error, setError] = useState(errorFromUrl);
  const redirectTo = window.location.origin + window.location.pathname;

  const sendLink = async (event) => {
    event.preventDefault();
    const address = email.trim();
    if (!address) return;
    setStatus("sending");
    setError("");
    try {
      const { error: authError } = await supabase.auth.signInWithOtp({ email: address, options: { emailRedirectTo: redirectTo } });
      if (authError) throw authError;
      setStatus("sent");
    } catch (err) {
      setStatus("idle");
      setError(
        err?.status === 429
          ? "Trop de demandes en peu de temps. Patientez quelques minutes avant de redemander un lien."
          : "L'envoi du lien a échoué. Vérifiez l'adresse et votre connexion, puis réessayez."
      );
    }
  };

  const withGitHub = async () => {
    setError("");
    const { error: authError } = await supabase.auth.signInWithOAuth({ provider: "github", options: { redirectTo } });
    if (authError) setError("La connexion avec GitHub a échoué. Réessayez ou utilisez le lien par e-mail.");
  };

  return (
    <main className="sh-page">
      <div className="sh-login">
        <Brand />
        <div className="sh-login-text">
          <h1>Connexion</h1>
          <p>Connectez-vous pour retrouver vos boîtes, vos erreurs et vos statistiques sur tous vos appareils.</p>
        </div>

        {status === "sent" ? (
          <div className="sh-sent" role="status">
            <p>
              Lien envoyé à <strong>{email.trim()}</strong>.
            </p>
            <p>Ouvrez l'e-mail et cliquez sur le lien pour vous connecter. Pensez à regarder dans les indésirables.</p>
            <button type="button" className="sh-btn sh-btn--quiet" onClick={() => setStatus("idle")}>
              Utiliser une autre adresse
            </button>
          </div>
        ) : (
          <form className="sh-form" onSubmit={sendLink}>
            <label htmlFor="login-email">Adresse e-mail</label>
            <input
              id="login-email"
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="vous@exemple.fr"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
            <button type="submit" className="sh-btn sh-btn--primary" disabled={status === "sending" || !email.trim()}>
              {status === "sending" ? "Envoi…" : "Recevoir un lien de connexion"}
            </button>
          </form>
        )}

        {githubEnabled && status !== "sent" && (
          <>
            <p className="sh-or">ou</p>
            <button type="button" className="sh-btn" onClick={withGitHub}>
              Continuer avec GitHub
            </button>
          </>
        )}

        {error && (
          <p className="sh-error" role="alert">
            {error}
          </p>
        )}
      </div>
    </main>
  );
}

function SignedIn({ session }) {
  const userId = session.user.id;
  const storage = useMemo(() => createSupabaseStorage(supabase, userId), [userId]);
  const [leaving, setLeaving] = useState(false);

  const signOut = async () => {
    setLeaving(true);
    await storage.flush().catch(() => {}); // hors ligne : la copie locale sera renvoyée à la prochaine connexion
    await supabase.auth.signOut({ scope: "local" });
  };

  return (
    <div className="sh-signed-in">
      <div className="sh-account">
        <span className="sh-account-who">
          Connecté · <span className="sh-account-email">{session.user.email || "compte GitHub"}</span>
        </span>
        <button type="button" className="sh-btn sh-btn--quiet sh-btn--sm" onClick={signOut} disabled={leaving}>
          {leaving ? "Déconnexion…" : "Se déconnecter"}
        </button>
      </div>
      <StorageScope key={userId} storage={storage}>
        <CardLearn />
      </StorageScope>
    </div>
  );
}

function WithAccount() {
  const [session, setSession] = useState(undefined); // undefined : vérification en cours

  useEffect(() => {
    let alive = true;
    supabase.auth
      .getSession()
      .then(({ data }) => alive && setSession(data.session ?? null))
      .catch(() => alive && setSession(null));
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next ?? null));
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
  return session ? <SignedIn session={session} /> : <Login />;
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
