import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { trackedGames, trackId } from '@/data/tracked-games';
import type { StoredProfile } from '@/lib/profile';
import { slugify } from '@/lib/slug';
import { migrateStore, STORE_VERSION } from '@/lib/store-migrations';
import type { Achievement, CatalogGame, PlaySession } from '@/types/game';

// Clé désormais figée : son suffixe `/v5` n'est plus qu'un nom historique.
// La version de forme vit DANS le blob (STORE_VERSION, store-migrations.ts)
// et les changements passent par une migration — changer la clé revenait à
// effacer silencieusement la bibliothèque (voir ARCHITECTURE.md §9.3).
const STORAGE_KEY = 'gamelary/game-store/v5';

export type StoredGame = {
  id: string;
  title: string;
  // Vide tant qu'IGDB n'a pas résolu la plateforme (voir useGame) : jamais
  // undefined pour éviter d'avoir à distinguer "pas encore chargé" de
  // "champ absent" à chaque lecture.
  platform: string;
  // Résolu en même temps que platform (voir registerCatalogGame) — permet à
  // GameCover de demander sa jaquette par correspondance exacte plutôt que
  // par recherche floue sur le titre (voir cover+api.ts). Absent tant
  // qu'IGDB n'a pas répondu, ou si le jeu n'a pas de référence Steam.
  steamAppId?: number;
  // Identité canonique IGDB (voir ARCHITECTURE.md §9.2) : le slug dérivé du
  // titre ne suffit pas — deux appareils peuvent en produire deux différents
  // pour le même jeu. Absent tant qu'aucune résolution ne l'a fourni.
  igdbId?: number;
  // Absent = antérieur à l'horodatage. Jamais inventé rétroactivement.
  updatedAt?: number;
  inLibrary: boolean;
  stopped: boolean;
  achievements: Achievement[];
  // Doit correspondre à l'id d'une piste de tracked-games.ts (voir trackId)
  // — les pistes elles-mêmes ne sont pas dupliquées ici, seule la sélection
  // de l'utilisateur l'est.
  favoriteTrackId?: string;
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

// Réglages globaux, pas propres à un jeu (SteamID64, identité affichée du
// profil), donc un simple objet plutôt qu'une nouvelle table ; à faire
// grossir si d'autres réglages s'ajoutent.
type Settings = {
  steamId64?: string;
  // Absent tant que l'utilisateur n'a rien personnalisé : les écrans
  // passent alors par les valeurs par défaut de profile.ts (displayNameOf,
  // usernameOf) plutôt que d'afficher des champs vides.
  profile?: StoredProfile;
};

export type StoreShape = {
  version: number;
  games: Record<string, StoredGame>;
  lists: Record<string, StoredList>;
  settings: Settings;
};

function makeAchievementId(gameId: string, name: string): string {
  return `${gameId}:${slugify(name)}-${Date.now().toString(36)}`;
}

// Un seul chemin d'écriture pour toute mutation d'un jeu : `updatedAt` est
// posé ici plutôt que recopié dans chacune des actions ci-dessous. L'oublier
// dans une seule d'entre elles ne ferait échouer strictement rien — ça
// rendrait juste faux, bien plus tard, l'arbitrage "le plus récent gagne"
// prévu pour la synchronisation (voir ARCHITECTURE.md §9.5).
// Les gardes "rien n'a changé" restent chez l'appelant, AVANT cet appel :
// horodater un no-op ferait gagner cet arbitrage à un appareil qui n'a
// pourtant rien modifié.
function updateGame(prev: StoreShape, id: string, patch: Partial<StoredGame>): StoreShape {
  const existing = prev.games[id];
  if (!existing) return prev;
  return {
    ...prev,
    games: { ...prev.games, [id]: { ...existing, ...patch, updatedAt: Date.now() } },
  };
}

// État initial avant toute lecture d'AsyncStorage (et avant que le premier
// lancement ait rien écrit) : les jeux de démonstration de tracked-games.ts
// (demoSeed: true seulement — les autres entrées n'y sont que pour leur
// bande originale curatée, voir tracked-games.ts, pas pour peupler la
// bibliothèque de démo), plateforme vide (résolue par useGame via IGDB),
// aucune liste peuplée. Ancien historique déjà écrit une fois -> AsyncStorage
// prend le dessus dans le useEffect de chargement, ce seed ne sert qu'au
// tout premier lancement.
function seedStore(): StoreShape {
  const games: Record<string, StoredGame> = {};
  for (const tracked of trackedGames.filter((game) => game.demoSeed)) {
    games[tracked.id] = {
      id: tracked.id,
      title: tracked.igdbTitle,
      platform: '',
      inLibrary: true,
      stopped: false,
      achievements: tracked.achievements.map((a) => ({
        id: makeAchievementId(tracked.id, a.name),
        name: a.name,
        unlocked: a.unlocked,
      })),
      favoriteTrackId: tracked.favoriteTrackTitle
        ? trackId(tracked.id, tracked.favoriteTrackTitle)
        : undefined,
      playSessions: [],
    };
  }
  return {
    version: STORE_VERSION,
    games,
    lists: {
      favoris: { id: 'favoris', name: 'Favoris', builtin: true, gameIds: [] },
      wishlist: { id: 'wishlist', name: 'Wishlist', builtin: true, gameIds: [] },
    },
    settings: {},
  };
}

// Frontière système (voir AGENTS.md/le principe du projet : valider aux
// frontières, faire confiance au code interne) : ce qui sort d'AsyncStorage
// n'est jamais garanti conforme au shape actuel de StoredGame — un blob
// écrit par une version antérieure du store (avant l'ajout de tel champ),
// une écriture partielle, ou tout simplement un JSON corrompu peut manquer
// `achievements`/`playSessions`, provoquant un crash sur `.length`/`.map`
// bien plus loin dans l'app (fiche jeu, filtres de bibliothèque) sans lien
// évident avec la vraie cause. Corrigé une seule fois ici, à la lecture,
// plutôt que de parsemer des `?? []` dans chaque écran qui lit ces champs.
type GameStoreContextValue = {
  ready: boolean;
  games: Record<string, StoredGame>;
  lists: Record<string, StoredList>;
  settings: Settings;
  registerCatalogGame: (game: CatalogGame) => void;
  addToLibrary: (id: string) => void;
  toggleStopped: (id: string) => void;
  setTotalHours: (id: string, totalHours: number) => void;
  setRating: (id: string, rating: number) => void;
  setReview: (id: string, review: string) => void;
  addAchievement: (id: string, name: string) => void;
  toggleAchievement: (id: string, achievementId: string) => void;
  importAchievements: (id: string, achievements: { apiname: string; name: string; unlocked: boolean }[]) => void;
  setSteamId64: (steamId64: string | undefined) => void;
  updateProfile: (patch: Partial<StoredProfile>) => void;
  setFavoriteTrack: (id: string, favoriteTrackId: string | undefined) => void;
  toggleListMembership: (listId: string, gameId: string) => void;
  createList: (name: string) => string;
};

const GameStoreContext = createContext<GameStoreContextValue | null>(null);

// Pas de backend/compte utilisateur (voir ARCHITECTURE.md §10) : cet état
// (bibliothèque, succès, notes/avis, listes, sessions de jeu) vit
// uniquement sur l'appareil via AsyncStorage — un seul blob JSON, largement
// suffisant pour le volume de données d'un solo (quelques dizaines de
// jeux), pas besoin d'une vraie base locale (SQLite) pour l'instant.
export function GameStoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<StoreShape>(seedStore);
  const [ready, setReady] = useState(false);
  const hasLoaded = useRef(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (raw) setState(migrateStore(JSON.parse(raw)));
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
          if (existing) {
            // Une absence n'écrase jamais un igdbId déjà connu : une
            // résolution IGDB qui échoue, ou une réponse sans
            // correspondance, ne doit pas faire perdre l'identité canonique
            // — un jeu qui la perd doit être re-résolu à l'aveugle depuis
            // son titre (voir ARCHITECTURE.md §9.3).
            const igdbId = game.igdbId ?? existing.igdbId;
            // La garde compare la valeur RÉSULTANTE, pas celle qui arrive.
            // Sans igdbId du tout ici, un jeu enregistré avant
            // l'introduction du champ ne le gagnerait jamais (la garde
            // court-circuiterait dès que titre/plateforme sont déjà à
            // jour) ; avec la valeur entrante brute, une résolution sans id
            // rouvrirait une écriture qui ne change rien, et un updatedAt
            // injustifié avec elle.
            if (
              existing.title === game.title &&
              existing.platform === game.platform &&
              existing.steamAppId === game.steamAppId &&
              existing.igdbId === igdbId
            ) {
              return prev;
            }
            return updateGame(prev, game.id, {
              title: game.title,
              platform: game.platform,
              steamAppId: game.steamAppId,
              igdbId,
            });
          }
          const created: StoredGame = {
            id: game.id,
            title: game.title,
            platform: game.platform,
            steamAppId: game.steamAppId,
            igdbId: game.igdbId,
            inLibrary: false,
            stopped: false,
            achievements: [],
            playSessions: [],
            updatedAt: Date.now(),
          };
          return { ...prev, games: { ...prev.games, [game.id]: created } };
        });
      },
      addToLibrary: (id: string) => {
        setState((prev) => {
          const existing = prev.games[id];
          if (!existing || existing.inLibrary) return prev;
          return updateGame(prev, id, { inLibrary: true });
        });
      },
      toggleStopped: (id: string) => {
        setState((prev) => {
          const existing = prev.games[id];
          if (!existing) return prev;
          return updateGame(prev, id, { stopped: !existing.stopped });
        });
      },
      // Ajoute une session "correctrice" égale à l'écart avec le total
      // actuel plutôt que de remplacer purement et simplement playSessions :
      // ça garde un historique daté exploitable par les statistiques
      // (streaks, répartition mensuelle — voir play-stats.ts) même quand
      // l'utilisateur corrige son total au lieu d'ajouter du temps au fil
      // de l'eau.
      setTotalHours: (id: string, totalHours: number) => {
        const target = Math.max(0, totalHours);
        setState((prev) => {
          const existing = prev.games[id];
          if (!existing) return prev;
          const currentTotal = existing.playSessions.reduce((sum, s) => sum + s.hours, 0);
          const delta = target - currentTotal;
          if (delta === 0) return prev;
          const session: PlaySession = { date: new Date().toISOString(), hours: delta };
          return updateGame(prev, id, { playSessions: [...existing.playSessions, session] });
        });
      },
      setRating: (id: string, rating: number) => {
        const clamped = Math.max(0, Math.min(20, Math.round(rating)));
        setState((prev) => {
          const existing = prev.games[id];
          if (!existing) return prev;
          return updateGame(prev, id, { rating: clamped });
        });
      },
      setReview: (id: string, review: string) => {
        setState((prev) => {
          const existing = prev.games[id];
          if (!existing) return prev;
          return updateGame(prev, id, { review });
        });
      },
      addAchievement: (id: string, name: string) => {
        const trimmed = name.trim();
        if (!trimmed) return;
        setState((prev) => {
          const existing = prev.games[id];
          if (!existing) return prev;
          const achievement: Achievement = { id: makeAchievementId(id, trimmed), name: trimmed, unlocked: false };
          return updateGame(prev, id, { achievements: [...existing.achievements, achievement] });
        });
      },
      toggleAchievement: (id: string, achievementId: string) => {
        setState((prev) => {
          const existing = prev.games[id];
          if (!existing) return prev;
          const achievements = existing.achievements.map((a) =>
            a.id === achievementId ? { ...a, unlocked: !a.unlocked } : a
          );
          return updateGame(prev, id, { achievements });
        });
      },
      // Remplace entièrement la liste par celle de Steam (source faisant
      // autorité une fois le compte lié) plutôt que de la fusionner avec les
      // entrées ajoutées à la main : évite les doublons "même succès, deux
      // fois" si l'utilisateur avait déjà saisi certains noms manuellement.
      // Id dérivé de `apiname` (stable côté Steam) plutôt que du timestamp
      // utilisé par addAchievement : un second import du même jeu retombe
      // sur les mêmes ids au lieu d'empiler des doublons.
      importAchievements: (id: string, achievements: { apiname: string; name: string; unlocked: boolean }[]) => {
        setState((prev) => {
          const existing = prev.games[id];
          if (!existing) return prev;
          const imported: Achievement[] = achievements.map((a) => ({
            id: `${id}:steam:${a.apiname}`,
            name: a.name,
            unlocked: a.unlocked,
          }));
          return updateGame(prev, id, { achievements: imported });
        });
      },
      setFavoriteTrack: (id: string, favoriteTrackId: string | undefined) => {
        setState((prev) => {
          const existing = prev.games[id];
          if (!existing) return prev;
          return updateGame(prev, id, { favoriteTrackId });
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
      // Pas de vraie authentification (voir ARCHITECTURE.md §9) : l'utilisateur
      // colle lui-même son SteamID64 (Profil, "Lier mon compte Steam"), utilisé
      // pour appeler gamelary-api (voir §6.3) — jamais vérifié côté serveur.
      setSteamId64: (steamId64: string | undefined) => {
        setState((prev) => ({ ...prev, settings: { ...prev.settings, steamId64 } }));
      },
      // Un patch partiel plutôt qu'un setter par champ : l'écran d'édition
      // (voir profile/edit.tsx) enregistre nom/identifiant/bio d'un coup,
      // tandis que le choix d'une image ne touche qu'elle — les deux
      // passent par le même chemin sans écraser les champs absents du
      // patch.
      updateProfile: (patch: Partial<StoredProfile>) => {
        setState((prev) => ({
          ...prev,
          settings: { ...prev.settings, profile: { ...prev.settings.profile, ...patch } },
        }));
      },
    }),
    []
  );

  const value = useMemo<GameStoreContextValue>(
    () => ({ ready, games: state.games, lists: state.lists, settings: state.settings, ...actions }),
    [ready, state, actions]
  );

  return <GameStoreContext.Provider value={value}>{children}</GameStoreContext.Provider>;
}

export function useGameStore(): GameStoreContextValue {
  const ctx = useContext(GameStoreContext);
  if (!ctx) throw new Error('useGameStore doit être utilisé sous GameStoreProvider');
  return ctx;
}
