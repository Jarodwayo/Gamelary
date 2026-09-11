import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import type { StoredProfile } from '@/lib/profile';
import type { TitleArtwork } from '@/lib/title-artwork';
import { makePlaySessionClientKey } from '@/lib/play-session-key';
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

// Métadonnées de synchro d'UNE appartenance (gameId -> liste), voir
// ARCHITECTURE.md §9.5 : `gameIds` reste la seule source de vérité pour
// « ce jeu est-il actuellement dans cette liste » (tout le reste de l'app
// le lit ainsi, inchangé) — `memberships` ne porte que ce qu'il faut pour
// arbitrer un conflit de synchro : `removed` distingue un retrait (tombstone)
// d'un ajout, `updatedAt` date ce dernier changement. Absent pour une
// entrée jamais touchée depuis l'introduction de ce champ, même convention
// que `StoredGame.updatedAt` — une simple union suffit alors, rien à
// arbitrer par date.
export type ListMembership = {
  removed?: boolean;
  updatedAt?: number;
};

export type StoredList = {
  id: string;
  name: string;
  builtin: boolean;
  // Facultative (voir profile/create-list.tsx) : absente sur les listes
  // intégrées et sur celles créées à la volée depuis la fiche jeu.
  description?: string;
  // "Ne pas afficher sur le profil" : la liste existe et reste utilisable
  // partout (sélecteur de listes de la fiche jeu), elle n'apparaît
  // simplement pas dans les rangées du Profil (voir profile/index.tsx).
  // Absent = visible, pour ne pas avoir à migrer les listes déjà stockées.
  hidden?: boolean;
  // Horodatage des métadonnées (nom/description/hidden) pour l'arbitrage
  // "le plus récent gagne" de la synchro (§9.5) — même principe que
  // StoredGame.updatedAt : absent = jamais modifié depuis l'introduction du
  // champ, rien à arbitrer plutôt que de deviner un gagnant.
  updatedAt?: number;
  gameIds: string[];
  memberships?: Record<string, ListMembership>;
};

// Réglages globaux, pas propres à un jeu (SteamID64, identité affichée du
// profil), donc un simple objet plutôt qu'une nouvelle table ; à faire
// grossir si d'autres réglages s'ajoutent.
type Settings = {
  steamId64?: string;
  // Horodatage dédié, PAS le mécanisme partagé des jeux (updateGame) : la
  // table de fusion de §9.5 promet « le plus récent gagne » pour
  // `steam_id64` spécifiquement (ligne `profiles` distante, voir §9.4),
  // pas pour les autres réglages ci-dessous — `profile`/`titleArtwork` ne
  // sont pas encore représentés côté schéma distant, leur politique de
  // fusion reste à trancher (voir §9.6). Absent = jamais modifié depuis
  // l'écran des réglages, même sens que `StoredGame.updatedAt`.
  steamId64UpdatedAt?: number;
  // Absent tant que l'utilisateur n'a rien personnalisé : les écrans
  // passent alors par les valeurs par défaut de profile.ts (displayNameOf,
  // usernameOf) plutôt que d'afficher des champs vides.
  profile?: StoredProfile;
  // En-tête de la fiche jeu : bandeau large + logo, ou jaquette portrait
  // (voir profile/settings-artwork.tsx). Absent = valeur par défaut
  // DEFAULT_TITLE_ARTWORK, pas besoin de migrer les stores existants.
  titleArtwork?: TitleArtwork;
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

// Un seul chemin d'écriture pour toute mutation des DONNÉES UTILISATEUR
// d'un jeu : `updatedAt` est posé ici plutôt que recopié dans chacune des
// actions ci-dessous. L'oublier dans une seule d'entre elles ne ferait
// échouer strictement rien — ça rendrait juste faux, bien plus tard,
// l'arbitrage "le plus récent gagne" prévu pour la synchronisation (voir
// ARCHITECTURE.md §9.5).
//
// "Données utilisateur" est la partie importante : registerCatalogGame ne
// passe volontairement PAS par ici (voir son commentaire). Les métadonnées
// de catalogue (titre, plateforme, appid Steam, id IGDB) viennent d'IGDB et
// sont re-dérivables à tout moment — les horodater ferait gagner
// l'arbitrage à un appareil qui a simplement ouvert Explorer, contre un
// appareil où l'utilisateur a réellement écrit une note ou un avis.
//
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
// lancement ait rien écrit) : bibliothèque vide. La connexion est désormais
// un prérequis pour atteindre cet écran (voir AuthGate, src/components/
// auth-gate.tsx) — il n'y a plus de mode "essayer sans compte" à amorcer
// avec des jeux de démonstration ; un nouvel utilisateur connecté part d'une
// bibliothèque vide et ajoute/importe ses propres jeux. Ancien historique
// déjà écrit une fois -> AsyncStorage prend le dessus dans le useEffect de
// chargement, ce seed ne sert qu'au tout premier lancement.
function seedStore(): StoreShape {
  return {
    version: STORE_VERSION,
    games: {},
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
  setTitleArtwork: (titleArtwork: TitleArtwork) => void;
  setFavoriteTrack: (id: string, favoriteTrackId: string | undefined) => void;
  toggleListMembership: (listId: string, gameId: string) => void;
  createList: (name: string, options?: { description?: string; hidden?: boolean }) => string;
  applySyncedGames: (games: StoredGame[]) => void;
  applySyncedLists: (lists: StoredList[]) => void;
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
            // Une absence n'écrase jamais un igdbId OU un steamAppId déjà
            // connus : une résolution IGDB qui échoue, ou une réponse sans
            // correspondance (ex. le jeu ne référence plus external_games
            // côté IGDB au moment de ce rafraîchissement), ne doit pas
            // faire perdre l'identité canonique — un jeu qui la perd doit
            // être re-résolu à l'aveugle depuis son titre (voir
            // ARCHITECTURE.md §9.3). Même raisonnement pour les deux : ce
            // sont deux identifiants externes re-dérivables, jamais des
            // données que l'absence d'une réponse doit effacer.
            const igdbId = game.igdbId ?? existing.igdbId;
            const steamAppId = game.steamAppId ?? existing.steamAppId;
            // La garde compare les valeurs RÉSULTANTES, pas celles qui
            // arrivent. Sans igdbId/steamAppId du tout ici, un jeu
            // enregistré avant l'introduction du champ ne le gagnerait
            // jamais (la garde court-circuiterait dès que titre/plateforme
            // sont déjà à jour) ; avec la valeur entrante brute, une
            // résolution sans id rouvrirait une écriture qui ne change
            // rien, et un updatedAt injustifié avec elle.
            if (
              existing.title === game.title &&
              existing.platform === game.platform &&
              existing.steamAppId === steamAppId &&
              existing.igdbId === igdbId
            ) {
              return prev;
            }
            // Écriture directe, PAS updateGame : rafraîchir des
            // métadonnées de catalogue ne doit jamais toucher `updatedAt`
            // (voir le commentaire d'updateGame — sinon ouvrir Explorer
            // suffirait à faire gagner l'arbitrage de §9.5 à un appareil
            // sans donnée utilisateur, et à effacer la note/l'avis écrits
            // sur un autre).
            const refreshed: StoredGame = {
              ...existing,
              title: game.title,
              platform: game.platform,
              steamAppId,
              igdbId,
            };
            return { ...prev, games: { ...prev.games, [game.id]: refreshed } };
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
            // Pas d'updatedAt : un jeu simplement aperçu dans Explorer n'a
            // encore reçu aucune donnée utilisateur. Absent = "jamais
            // modifié par l'utilisateur", ce qui est exactement le cas.
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
          const session: PlaySession = { date: new Date().toISOString(), hours: delta, clientKey: makePlaySessionClientKey() };
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
      // Consigne aussi, dans `memberships`, l'horodatage et le sens de ce
      // changement (voir ListMembership) — nécessaire à la synchro §9.5
      // pour distinguer un vrai retrait (à répercuter côté distant via un
      // tombstone) d'un simple ajout, ce qu'une union de `gameIds` seule ne
      // permettrait pas de faire une fois les deux appareils fusionnés.
      toggleListMembership: (listId: string, gameId: string) => {
        setState((prev) => {
          const list = prev.lists[listId];
          if (!list) return prev;
          const wasMember = list.gameIds.includes(gameId);
          const gameIds = wasMember
            ? list.gameIds.filter((existingId) => existingId !== gameId)
            : [...list.gameIds, gameId];
          const memberships: Record<string, ListMembership> = {
            ...list.memberships,
            [gameId]: { removed: wasMember, updatedAt: Date.now() },
          };
          return { ...prev, lists: { ...prev.lists, [listId]: { ...list, gameIds, memberships } } };
        });
      },
      // `options` facultatif : la création à la volée depuis la fiche jeu
      // (voir list-picker-sheet.tsx) ne demande qu'un nom, l'écran dédié
      // (profile/create-list.tsx) y ajoute description et visibilité.
      // `updatedAt` horodate ces métadonnées dès la création (voir §9.5) :
      // une liste tout juste créée EST une vraie donnée utilisateur, au
      // même titre qu'une note ou un avis — contrairement à
      // registerCatalogGame, qui n'horodate jamais un simple aperçu de
      // catalogue.
      createList: (name: string, options?: { description?: string; hidden?: boolean }): string => {
        const id = `${slugify(name)}-${Date.now().toString(36)}`;
        setState((prev) => ({
          ...prev,
          lists: {
            ...prev.lists,
            [id]: {
              id,
              name,
              builtin: false,
              description: options?.description,
              hidden: options?.hidden,
              updatedAt: Date.now(),
              gameIds: [],
            },
          },
        }));
        return id;
      },
      // Pas de vraie authentification (voir ARCHITECTURE.md §9) : l'utilisateur
      // colle lui-même son SteamID64 (Profil, "Lier mon compte Steam"), utilisé
      // pour appeler gamelary-api (voir §6.3) — jamais vérifié côté serveur.
      setSteamId64: (steamId64: string | undefined) => {
        setState((prev) => {
          // Garde "rien n'a changé", même raisonnement que partout ailleurs
          // (voir updateGame) : re-confirmer le même identifiant (ou délier
          // un compte déjà délié) ne doit pas avancer l'horodatage — ça
          // ferait gagner l'arbitrage §9.5 à un appareil qui n'a rien
          // modifié.
          if (prev.settings.steamId64 === steamId64) return prev;
          return {
            ...prev,
            settings: { ...prev.settings, steamId64, steamId64UpdatedAt: Date.now() },
          };
        });
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
      setTitleArtwork: (titleArtwork: TitleArtwork) => {
        setState((prev) => ({ ...prev, settings: { ...prev.settings, titleArtwork } }));
      },
      // Chemin d'écriture DÉDIÉ pour le service de synchronisation (voir
      // lib/sync/sync-service.ts), volontairement séparé d'updateGame :
      // celui-ci horodate systématiquement à `Date.now()`, ce qui ferait
      // gagner à tort l'arbitrage §9.5 à l'appareil qui vient juste de
      // synchroniser, quel que soit le côté qui a réellement écrit en
      // dernier. Les jeux fournis ici portent déjà le résultat complet de la
      // fusion (voir mergeGameFields) — `updatedAt` y est soit celui d'un
      // des deux appareils, soit absent, jamais "maintenant".
      applySyncedGames: (games: StoredGame[]) => {
        if (games.length === 0) return;
        setState((prev) => {
          const nextGames = { ...prev.games };
          for (const game of games) nextGames[game.id] = game;
          return { ...prev, games: nextGames };
        });
      },
      // Même chemin dédié qu'applySyncedGames, et pour la même raison :
      // jamais d'horodatage posé ici, les listes fournies portent déjà le
      // résultat complet de la fusion (voir mergeListMetadata/
      // mergeListMembership, lib/sync/merge-policy.ts) — `updatedAt` y est
      // soit celui d'un des deux appareils, soit absent, jamais "maintenant".
      applySyncedLists: (lists: StoredList[]) => {
        if (lists.length === 0) return;
        setState((prev) => {
          const nextLists = { ...prev.lists };
          for (const list of lists) nextLists[list.id] = list;
          return { ...prev, lists: nextLists };
        });
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
