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

// steamAppId (résolu depuis IGDB, voir games+api.ts) donne une clé de cache
// plus précise que le titre seul : deux jeux au titre identique n'ont pas
// le même app id Steam, l'inverse n'arrivant jamais.
function cacheKeyFor(title: string, steamAppId?: number): string {
  return steamAppId ? `steam:${steamAppId}` : `title:${title}`;
}

export function useGameCover(title: string, steamAppId?: number): CoverState {
  const cacheKey = cacheKeyFor(title, steamAppId);
  const [url, setUrl] = useState<string | null>(clientCache.get(cacheKey) ?? null);
  const [loading, setLoading] = useState(!clientCache.has(cacheKey));

  useEffect(() => {
    if (clientCache.has(cacheKey)) {
      // Même raisonnement que useExploreSection (use-explore.ts) :
      // nécessaire quand cacheKey change après montage, pas au tout premier
      // rendu (déjà couvert par l'état initial).
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setUrl(clientCache.get(cacheKey) ?? null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    const query = steamAppId
      ? `title=${encodeURIComponent(title)}&steamAppId=${steamAppId}`
      : `title=${encodeURIComponent(title)}`;

    fetch(apiUrl(`/api/cover?${query}`))
      .then((res) => res.json())
      .then((data: { url?: string | null }) => {
        if (cancelled) return;
        const coverUrl = data.url ?? null;
        clientCache.set(cacheKey, coverUrl);
        setUrl(coverUrl);
      })
      .catch(() => {
        // Échec réseau/API : on reste silencieux et on retombe sur le
        // placeholder dans GameCover plutôt que de casser l'écran pour un
        // problème de jaquette, non bloquant pour l'usage de l'app.
        if (!cancelled) clientCache.set(cacheKey, null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [cacheKey, title, steamAppId]);

  return { url, loading };
}
