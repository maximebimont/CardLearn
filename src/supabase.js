import { createClient } from "@supabase/supabase-js";

const env = import.meta.env;

// Noms Vite (VITE_*) ou ceux créés par l'intégration Supabase de Vercel (NEXT_PUBLIC_*).
const url = env.VITE_SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL;
const key =
  env.VITE_SUPABASE_ANON_KEY ||
  env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

// Retour d'un lien « mot de passe oublié » : à lire avant que le client n'efface l'adresse.
export const recoveryInUrl =
  typeof window !== "undefined" && new URLSearchParams(window.location.hash.slice(1)).get("type") === "recovery";

// Sans configuration, l'application tourne en mode local (null).
export const supabase =
  url && key
    ? createClient(url, key, {
        auth: {
          storageKey: "cardlearn-auth",
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          // Le lien magique fonctionne même s'il est ouvert dans un autre navigateur que celui de la demande.
          flowType: "implicit",
        },
      })
    : null;

export const githubEnabled = env.VITE_AUTH_GITHUB === "true";
