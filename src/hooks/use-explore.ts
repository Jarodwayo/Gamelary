import { useEffect, useState } from 'react';

import { apiUrl } from '@/lib/api-url';
import { useGameStore } from '@/lib/game-store';
import type { CatalogGame } from '@/types/game';

export type ExploreSection = 'recommended' | 'trending' | 'new' | 'popular' | 'anticipated';

// Cache mémoire par (section, plateforme), même principe que useGameCover/
// useGame : le serveur cache déjà 6h (voir games+api.ts), ce cache client
// évite un aller-retour réseau à chaque montage du composant dans la même
// session. La plateforme fait partie de la clé (comme côté serveur) : elle
// ne change en pratique jamais en cours de session, mais deux valeurs
// différentes ne doivent pas partager une entrée.
const sectionCache = new Map<string, CatalogGame[]>();

// "recommended" n'a pas de vrai profil utilisateur/historique à exploiter
// (pas de compte, voir ARCHITECTURE.md §9), mais la bibliothèque locale
// donne un signal simple et déjà disponible : la plateforme la plus
// fréquente parmi les jeux suivis. Transmise au serveur pour biaiser la
// requête IGDB (voir games+api.ts) plutôt que le classement générique
// identique pour tout le monde. Repli implicite (undefined) sur une
// bibliothèque vide/à égalité.
function mostCommonLibraryPlatform(games: Record<string, { inLibrary: boolean; platform: string }>): string | undefined {
  const counts = new Map<string, number>();
  for (const game of Object.values(games)) {
    if (!game.inLibrary || !game.platform) continue;
    counts.set(game.platform, (counts.get(game.platform) ?? 0) + 1);
  }
  let best: string | undefined;
  let bestCount = 0;
  for (const [platform, count] of counts) {
    if (count > bestCount) {
      best = platform;
      bestCount = count;
    }
  }
  return best;
}

// Récupère une rangée Explorer et enregistre chaque jeu dans le store
// (game-store.tsx) au passage : un jeu vu ici a déjà son titre/plateforme
// IGDB, useGame n'aura pas besoin de les re-résoudre si l'utilisateur ouvre
// sa fiche.
export function useExploreSection(section: ExploreSection): { games: CatalogGame[]; loading: boolean } {
  const store = useGameStore();
  const platform = section === 'recommended' ? mostCommonLibraryPlatform(store.games) : undefined;
  const cacheKey = `${section}:${platform ?? ''}`;
  const [games, setGames] = useState<CatalogGame[]>(sectionCache.get(cacheKey) ?? []);
  const [loading, setLoading] = useState(!sectionCache.has(cacheKey));

  useEffect(() => {
    if (sectionCache.has(cacheKey)) {
      setGames(sectionCache.get(cacheKey) ?? []);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    const query = platform ? `section=${section}&platform=${encodeURIComponent(platform)}` : `section=${section}`;

    fetch(apiUrl(`/api/games?${query}`))
      .then((res) => res.json())
      .then((data: CatalogGame[] | { error: string }) => {
        if (cancelled) return;
        const result = Array.isArray(data) ? data : [];
        sectionCache.set(cacheKey, result);
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
    // store.registerCatalogGame est stable (useMemo côté provider) ; platform
    // n'a besoin de redéclencher l'effet que via cacheKey (dérivé plus haut),
    // pas de le lister séparément.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheKey]);

  return { games, loading };
}
