/* Implémentations de window.storage (get / set / delete, valeurs en texte) pour CardLearn.jsx.
   - mode local : localStorage uniquement ;
   - mode Supabase : table `progress` (une ligne par personne et par clé), avec une copie locale
     qui sert hors ligne et qui est renvoyée au serveur dès que possible. */

const PREFIX = "cardlearn";

function readLocal(name) {
  try {
    const raw = localStorage.getItem(name);
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    return null;
  }
}

function writeLocal(name, record) {
  try {
    localStorage.setItem(name, JSON.stringify(record));
    return true;
  } catch (err) {
    return false;
  }
}

function removeLocal(name) {
  try {
    localStorage.removeItem(name);
  } catch (err) {
    // stockage local indisponible : rien à effacer
  }
}

const time = (iso) => Date.parse(iso) || 0;

export function createLocalStorage() {
  const name = (key) => `${PREFIX}:local:${key}`;
  return {
    async get(key) {
      const record = readLocal(name(key));
      return record ? { key, value: record.value } : null;
    },
    async set(key, value) {
      if (!writeLocal(name(key), { value, updatedAt: new Date().toISOString(), synced: true })) {
        throw new Error("Le stockage du navigateur est indisponible.");
      }
      return { key, value };
    },
    async delete(key) {
      removeLocal(name(key));
      return { key, deleted: true };
    },
    async flush() {},
  };
}

export function createSupabaseStorage(client, userId) {
  const name = (key) => `${PREFIX}:${userId}:${key}`;
  const touched = new Set();

  async function push(key, value, updatedAt) {
    const { error } = await client
      .from("progress")
      .upsert({ user_id: userId, key, value, updated_at: updatedAt }, { onConflict: "user_id,key" });
    if (error) throw error;
    const current = readLocal(name(key));
    // Ne marque la copie comme synchronisée que si aucune écriture plus récente n'est arrivée entre-temps.
    if (!current || current.updatedAt === updatedAt) writeLocal(name(key), { value, updatedAt, synced: true });
  }

  return {
    async get(key) {
      touched.add(key);
      const local = readLocal(name(key));
      let remote;
      try {
        const { data, error } = await client
          .from("progress")
          .select("value, updated_at")
          .eq("user_id", userId)
          .eq("key", key)
          .maybeSingle();
        if (error) throw error;
        remote = data;
      } catch (err) {
        // Hors ligne ou serveur indisponible : on repart de la copie locale.
        return local ? { key, value: local.value } : null;
      }
      // Des réponses données hors ligne, plus récentes que le serveur : on les garde et on les renvoie.
      if (local && !local.synced && (!remote || time(local.updatedAt) > time(remote.updated_at))) {
        push(key, local.value, local.updatedAt).catch(() => {});
        return { key, value: local.value };
      }
      if (remote) {
        writeLocal(name(key), { value: remote.value, updatedAt: remote.updated_at, synced: true });
        return { key, value: remote.value };
      }
      return local ? { key, value: local.value } : null;
    },

    async set(key, value) {
      touched.add(key);
      const updatedAt = new Date().toISOString();
      writeLocal(name(key), { value, updatedAt, synced: false });
      await push(key, value, updatedAt); // en cas d'échec, l'erreur remonte et la copie locale attend
      return { key, value };
    },

    async delete(key) {
      removeLocal(name(key));
      const { error } = await client.from("progress").delete().eq("user_id", userId).eq("key", key);
      if (error) throw error;
      return { key, deleted: true };
    },

    // Renvoie au serveur les copies locales pas encore synchronisées (retour du réseau, déconnexion).
    async flush() {
      for (const key of touched) {
        const local = readLocal(name(key));
        if (local && !local.synced) await push(key, local.value, local.updatedAt);
      }
    },
  };
}
