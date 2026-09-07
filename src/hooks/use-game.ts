import { useEffect, useState } from 'react';

import { getTrackedGameById, trackId } from '@/data/tracked-games';
import { apiUrl } from '@/lib/api-url';
import { useGameStore } from '@/lib/game-store';
import type { Game, Track } from '@/types/game';

type IgdbLookup = { title: string; platform: string } | null;

// Cache mémoire côté client, même logique que useGameCover (voir ce fichier
// pour le raisonnement) : plusieurs écrans peuvent redemander le même
// titre IGDB dans la même session.
const igdbLookupCache = new Map<string, IgdbLookup>();

async function fetchIgdbInfo(searchTitle: string): Promise<IgdbLookup> {
  if (igdbLookupCache.has(searchTitle)) return igdbLookupCache.get(searchTitle) ?? null;
  try {
    const res = await fetch(apiUrl(`/api/games?title=${encodeURIComponent(searchTitle)}`));
    const data: { title: string | null; platform: string | null } = await res.json();
    const result: IgdbLookup = data.title
      ? { title: data.title, platform: data.platform ?? 'Plateforme inconnue' }
      : null;
    igdbLookupCache.set(searchTitle, result);
    return result;
  } catch {
    return null;
  }
}

// Jointure entre le store local (src/lib/game-store.tsx — bibliothèque,
// notes/avis, sessions de jeu, tout ce qui est propre à l'utilisateur) et
// IGDB (titre/plateforme canoniques). Ne déclenche une recherche IGDB que
// pour les jeux de démonstration de tracked-games.ts dont la plateforme
// n'est pas encore résolue (`platform === ''`) : un jeu découvert via
// Explorer arrive déjà avec son titre/plateforme IGDB, pas besoin d'un
// second aller-retour.
export function useGame(id: string): { game: Game | null; loading: boolean } {
  const store = useGameStore();
  const stored = store.games[id];
  const tracked = getTrackedGameById(id);
  const [loading, setLoading] = useState(Boolean(tracked) && (!stored || stored.platform === ''));

  useEffect(() => {
    if (!tracked || (stored && stored.platform !== '')) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    fetchIgdbInfo(tracked.igdbTitle).then((info) => {
      if (cancelled) return;
      store.registerCatalogGame({
        id,
        title: info?.title ?? tracked.igdbTitle,
        platform: info?.platform ?? 'Plateforme inconnue',
      });
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
    // store.registerCatalogGame est stable (useMemo côté provider) ; seul
    // l'id suivi doit redéclencher la recherche.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, tracked?.igdbTitle, stored?.platform]);

  if (!stored) return { game: null, loading: false };

  // tracks vient de tracked-games.ts (statique, la bande originale ne
  // change pas), avec les mêmes ids que ceux utilisés pour seeder/écrire
  // favoriteTrackId (voir trackId, partagé avec game-store.tsx) — sans ça,
  // la sélection stockée ne retrouverait jamais la bonne piste.
  const tracks: Track[] = (tracked?.tracks ?? []).map((track) => ({
    id: trackId(stored.id, track.title),
    title: track.title,
    artist: track.artist,
  }));

  return {
    game: {
      id: stored.id,
      title: stored.title,
      platform: stored.platform || 'Plateforme inconnue',
      inLibrary: stored.inLibrary,
      stopped: stored.stopped,
      achievements: stored.achievements,
      // Dérivés de la liste plutôt que stockés à part (voir types/game.ts) :
      // ne peuvent jamais se désynchroniser du détail des succès.
      achievementsUnlocked: stored.achievements.filter((a) => a.unlocked).length,
      achievementsTotal: stored.achievements.length,
      tracks,
      favoriteTrack: tracks.find((track) => track.id === stored.favoriteTrackId),
      rating: stored.rating,
      review: stored.review,
      playSessions: stored.playSessions,
    },
    loading,
  };
}
