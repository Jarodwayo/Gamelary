import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { trackedGames } from '@/data/tracked-games';
import { slugify } from '@/lib/slug';
import type { CatalogGame, PlaySession } from '@/types/game';

const STORAGE_KEY = 'gamelary/game-store/v1';

export type StoredGame = {
  id: string;
  title: string;
  // Vide tant qu'IGDB n'a pas résolu la plateforme (voir useGame) : jamais
  // undefined pour éviter d'avoir à distinguer "pas encore chargé" de
  // "champ absent" à chaque lecture.
  platform: string;
  inLibrary: boolean;
  stopped: boolean;
  achievementsUnlocked: number;
  achievementsTotal: number;
  rating?: number;
  review?: string;
  playSessions: PlaySession[];
};

export type StoredList = {
  id: string;
  name: string;
  builtin: boolean;
  gameIds: string[];
};

type StoreShape = {
  games: Record<string, StoredGame>;
  lists: Record<string, StoredList>;
};

// État initial avant toute lecture d'AsyncStorage (et avant que le premier
// lancement ait rien écrit) : les 6 jeux de démonstration de
// tracked-games.ts, plateforme vide (résolue par useGame via IGDB), aucune
// liste peuplée. Ancien historique déjà écrit une fois -> AsyncStorage
// prend le dessus dans le useEffect de chargement, ce seed ne sert qu'au
// tout premier lancement.
function seedStore(): StoreShape {
  const games: Record<string, StoredGame> = {};
  for (const tracked of trackedGames) {
    games[tracked.id] = {
      id: tracked.id,
      title: tracked.igdbTitle,
      platform: '',
      inLibrary: true,
      stopped: false,
      achievementsUnlocked: tracked.achievementsUnlocked,
      achievementsTotal: tracked.achievementsTotal,
      playSessions: [],
    };
  }
  return {
    games,
    lists: {
      favoris: { id: 'favoris', name: 'Favoris', builtin: true, gameIds: [] },
      wishlist: { id: 'wishlist', name: 'Wishlist', builtin: true, gameIds: [] },
    },
  };
}

type GameStoreContextValue = {
  ready: boolean;
  games: Record<string, StoredGame>;
  lists: Record<string, StoredList>;
  registerCatalogGame: (game: CatalogGame) => void;
  addToLibrary: (id: string) => void;
  toggleStopped: (id: string) => void;
  addPlaySession: (id: string, hours: number) => void;
  setRating: (id: string, rating: number) => void;
  setReview: (id: string, review: string) => void;
  toggleListMembership: (listId: string, gameId: string) => void;
  createList: (name: string) => string;
};

const GameStoreContext = createContext<GameStoreContextValue | null>(null);

// Pas de backend/compte utilisateur (voir ARCHITECTURE.md §9) : cet état
// (bibliothèque, notes/avis, listes, sessions de jeu) vit uniquement sur
// l'appareil via AsyncStorage — un seul blob JSON, largement suffisant pour
// le volume de données d'un solo (quelques dizaines de jeux), pas besoin
// d'une vraie base locale (SQLite) pour l'instant.
export function GameStoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<StoreShape>(seedStore);
  const [ready, setReady] = useState(false);
  const hasLoaded = useRef(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (raw) setState(JSON.parse(raw) as StoreShape);
      })
      .catch(() => {
        // Lecture impossible (stockage indisponible/corrompu) : on repart du
        // seed déjà en mémoire plutôt que de bloquer le montage de l'app.
      })
      .finally(() => {
        hasLoaded.current = true;
        setReady(true);
      });
  }, []);

  useEffect(() => {
    // Ne jamais écrire avant la lecture initiale : sinon le seed écraserait
    // une session précédente le temps qu'AsyncStorage réponde.
    if (!hasLoaded.current) return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state)).catch(() => {
      // Écriture impossible : les changements restent valables pour la
      // session en cours, seule la persistance au prochain lancement saute.
    });
  }, [state]);

  const actions = useMemo(
    () => ({
      registerCatalogGame: (game: CatalogGame) => {
        setState((prev) => {
          const existing = prev.games[game.id];
          if (existing && existing.title === game.title && existing.platform === game.platform) {
            return prev;
          }
          const next: StoredGame = existing
            ? { ...existing, title: game.title, platform: game.platform }
            : {
                id: game.id,
                title: game.title,
                platform: game.platform,
                inLibrary: false,
                stopped: false,
                achievementsUnlocked: 0,
                achievementsTotal: 0,
                playSessions: [],
              };
          return { ...prev, games: { ...prev.games, [game.id]: next } };
        });
      },
      addToLibrary: (id: string) => {
        setState((prev) => {
          const existing = prev.games[id];
          if (!existing || existing.inLibrary) return prev;
          return { ...prev, games: { ...prev.games, [id]: { ...existing, inLibrary: true } } };
        });
      },
      toggleStopped: (id: string) => {
        setState((prev) => {
          const existing = prev.games[id];
          if (!existing) return prev;
          return { ...prev, games: { ...prev.games, [id]: { ...existing, stopped: !existing.stopped } } };
        });
      },
      addPlaySession: (id: string, hours: number) => {
        setState((prev) => {
          const existing = prev.games[id];
          if (!existing || !(hours > 0)) return prev;
          const session: PlaySession = { date: new Date().toISOString(), hours };
          return {
            ...prev,
            games: { ...prev.games, [id]: { ...existing, playSessions: [...existing.playSessions, session] } },
          };
        });
      },
      setRating: (id: string, rating: number) => {
        setState((prev) => {
          const existing = prev.games[id];
          if (!existing) return prev;
          return { ...prev, games: { ...prev.games, [id]: { ...existing, rating } } };
        });
      },
      setReview: (id: string, review: string) => {
        setState((prev) => {
          const existing = prev.games[id];
          if (!existing) return prev;
          return { ...prev, games: { ...prev.games, [id]: { ...existing, review } } };
        });
      },
      toggleListMembership: (listId: string, gameId: string) => {
        setState((prev) => {
          const list = prev.lists[listId];
          if (!list) return prev;
          const gameIds = list.gameIds.includes(gameId)
            ? list.gameIds.filter((existingId) => existingId !== gameId)
            : [...list.gameIds, gameId];
          return { ...prev, lists: { ...prev.lists, [listId]: { ...list, gameIds } } };
        });
      },
      createList: (name: string): string => {
        const id = `${slugify(name)}-${Date.now().toString(36)}`;
        setState((prev) => ({
          ...prev,
          lists: { ...prev.lists, [id]: { id, name, builtin: false, gameIds: [] } },
        }));
        return id;
      },
    }),
    []
  );

  const value = useMemo<GameStoreContextValue>(
    () => ({ ready, games: state.games, lists: state.lists, ...actions }),
    [ready, state, actions]
  );

  return <GameStoreContext.Provider value={value}>{children}</GameStoreContext.Provider>;
}

export function useGameStore(): GameStoreContextValue {
  const ctx = useContext(GameStoreContext);
  if (!ctx) throw new Error('useGameStore doit être utilisé sous GameStoreProvider');
  return ctx;
}
