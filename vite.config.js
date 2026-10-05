import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Fichiers de public/ (icônes, manifeste), copiés tels quels dans dist/.
function publicFiles(dir = "public") {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? publicFiles(path) : [relative("public", path).split("\\").join("/")];
  });
}

// Écrit dist/sw.js avec la liste des fichiers de l'appli construite, pour le démarrage hors connexion.
function serviceWorker() {
  return {
    name: "cardlearn-service-worker",
    apply: "build",
    enforce: "post",
    generateBundle(_, bundle) {
      const files = [...Object.keys(bundle), ...publicFiles()].filter((file) => file !== "index.html" && !file.endsWith(".map")).sort();
      const html = bundle["index.html"]?.source ?? "";
      const version = createHash("sha256").update(files.join("\n")).update(String(html)).digest("hex").slice(0, 12);
      const source = readFileSync("src/service-worker.js", "utf8")
        .replaceAll("__VERSION__", version)
        .replaceAll("__FILES__", JSON.stringify(["/", ...files.map((file) => `/${file}`)]));
      this.emitFile({ type: "asset", fileName: "sw.js", source });
    },
  };
}

export default defineConfig({
  plugins: [react(), serviceWorker()],
  // NEXT_PUBLIC_* : variables publiques créées par l'intégration Supabase de Vercel.
  // Les clés secrètes (SUPABASE_SERVICE_ROLE_KEY, POSTGRES_*) n'ont pas ces préfixes et restent côté serveur.
  envPrefix: ["VITE_", "NEXT_PUBLIC_"],
  // supabase-js représente l'essentiel du bundle (~145 Ko gzip au total).
  build: { chunkSizeWarningLimit: 600 },
});
