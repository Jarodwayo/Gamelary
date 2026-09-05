import { useEffect, useState } from 'react';

import { apiUrl } from '@/lib/api-url';
import { useGameStore } from '@/lib/game-store';
import type { CatalogGame } from '@/types/game';

export type ExploreSection = 'recommended' | 'trending' | 'new' | 'popular' | 'anticipated';

// Cache mémoire par section, même principe que useGameCover/useGame : le
// serveur cache déjà 6h (voir games+api.ts), ce cache client évite un aller-
// retour réseau à chaque montage du composant dans la même session.
const sectionCache = new Map<ExploreSection, CatalogGame[]>();

// Récupère une rangée Explorer et enregistre chaque jeu dans le store
// (game-store.tsx) au passage : un jeu vu ici a déjà son titre/plateforme
// IGDB, useGame n'aura pas besoin de les re-résoudre si l'utilisateur ouvre
// sa fiche.
export function useExploreSection(section: ExploreSection): { games: CatalogGame[]; loading: boolean } {
  const store = useGameStore();
  const [games, setGames] = useState<CatalogGame[]>(sectionCache.get(section) ?? []);
  const [loading, setLoading] = useState(!sectionCache.has(section));

  useEffect(() => {
    if (sectionCache.has(section)) {
      setGames(sectionCache.get(section) ?? []);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    fetch(apiUrl(`/api/games?section=${section}`))
      .then((res) => res.json())
      .then((data: CatalogGame[] | { error: string }) => {
        if (cancelled) return;
        const result = Array.isArray(data) ? data : [];
        sectionCache.set(section, result);
        setGames(result);
        result.forEach((game) => store.registerCatalogGame(game));
      })
      .catch(() => {
        if (!cancelled) setGames([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // store.registerCatalogGame est stable (useMemo côté provider).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [section]);

  return { games, loading };
}
