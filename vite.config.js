import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // NEXT_PUBLIC_* : variables publiques créées par l'intégration Supabase de Vercel.
  // Les clés secrètes (SUPABASE_SERVICE_ROLE_KEY, POSTGRES_*) n'ont pas ces préfixes et restent côté serveur.
  envPrefix: ["VITE_", "NEXT_PUBLIC_"],
  // supabase-js représente l'essentiel du bundle (~145 Ko gzip au total).
  build: { chunkSizeWarningLimit: 600 },
});
