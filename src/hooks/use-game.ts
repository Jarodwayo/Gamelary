import { useEffect, useState } from 'react';

import { getTrackedGameById, type TrackedGame } from '@/data/tracked-games';
import { apiUrl } from '@/lib/api-url';
import type { Game } from '@/types/game';

type IgdbLookup = { title: string | null; platform: string | null };

// Cache mémoire côté client, même logique que useGameCover (voir ce fichier
// pour le raisonnement) : la bibliothèque et la fiche jeu recherchent
// souvent le même titre IGDB dans la même session.
const clientCache = new Map<string, IgdbLookup>();

function useIgdbLookup(igdbTitle: string): { lookup: IgdbLookup | null; loading: boolean } {
  const [lookup, setLookup] = useState<IgdbLookup | null>(clientCache.get(igdbTitle) ?? null);
  const [loading, setLoading] = useState(!clientCache.has(igdbTitle));

  useEffect(() => {
    // igdbTitle vide : id inconnu dans tracked-games (voir useGame), rien à
    // chercher côté IGDB.
    if (!igdbTitle) {
      setLoading(false);
      return;
    }

    if (clientCache.has(igdbTitle)) {
      setLookup(clientCache.get(igdbTitle) ?? null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    fetch(apiUrl(`/api/games?title=${encodeURIComponent(igdbTitle)}`))
      .then((res) => res.json())
      .then((data: IgdbLookup) => {
        if (cancelled) return;
        clientCache.set(igdbTitle, data);
        setLookup(data);
      })
      .catch(() => {
        // Échec réseau/API IGDB : on retombe sur igdbTitle tel quel côté
        // appelant (voir toGame ci-dessous) plutôt que de bloquer l'écran —
        // même philosophie que le repli placeholder de GameCover.
        if (!cancelled) {
          const fallback: IgdbLookup = { title: null, platform: null };
          clientCache.set(igdbTitle, fallback);
          setLookup(fallback);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [igdbTitle]);

  return { lookup, loading };
}

function toGame(tracked: TrackedGame, lookup: IgdbLookup | null): Game {
  return {
    id: tracked.id,
    title: lookup?.title ?? tracked.igdbTitle,
    platform: lookup?.platform ?? 'Plateforme inconnue',
    achievementsUnlocked: tracked.achievementsUnlocked,
    achievementsTotal: tracked.achievementsTotal,
    favoriteTrack: tracked.favoriteTrack,
  };
}

// Fait la jointure entre la liste suivie localement (src/data/tracked-games.ts
// — succès, musique préférée) et le catalogue réel (IGDB, via /api/games —
// titre canonique, plateforme). game reste non-null tant que l'id existe
// dans tracked-games : le titre affiché est igdbTitle en attendant/à défaut
// de réponse IGDB, jamais un état vide.
export function useGame(id: string): { game: Game | null; loading: boolean } {
  const tracked = getTrackedGameById(id);
  const { lookup, loading } = useIgdbLookup(tracked?.igdbTitle ?? '');

  if (!tracked) return { game: null, loading: false };
  return { game: toGame(tracked, lookup), loading };
}
