import { useEffect, useState } from 'react';

import { apiUrl } from '@/lib/api-url';

// Cache mémoire côté client, partagé entre tous les composants GameCover :
// la bibliothèque et la fiche jeu affichent souvent le même jeu dans la
// même session, pas besoin de rappeler /api/cover à chaque montage. Se vide
// au redémarrage de l'app — suffisant ici puisque le serveur a lui-même un
// cache de 7 jours (voir src/app/api/cover+api.ts).
const clientCache = new Map<string, string | null>();

type CoverState = {
  url: string | null;
  loading: boolean;
};

export function useGameCover(title: string): CoverState {
  const [url, setUrl] = useState<string | null>(clientCache.get(title) ?? null);
  const [loading, setLoading] = useState(!clientCache.has(title));

  useEffect(() => {
    if (clientCache.has(title)) {
      setUrl(clientCache.get(title) ?? null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    fetch(apiUrl(`/api/cover?title=${encodeURIComponent(title)}`))
      .then((res) => res.json())
      .then((data: { url?: string | null }) => {
        if (cancelled) return;
        const coverUrl = data.url ?? null;
        clientCache.set(title, coverUrl);
        setUrl(coverUrl);
      })
      .catch(() => {
        // Échec réseau/API : on reste silencieux et on retombe sur le
        // placeholder dans GameCover plutôt que de casser l'écran pour un
        // problème de jaquette, non bloquant pour l'usage de l'app.
        if (!cancelled) clientCache.set(title, null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [title]);

  return { url, loading };
}
