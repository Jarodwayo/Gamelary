import type { StoredGame } from '@/lib/game-store';
import { getSupabaseClient } from '@/lib/supabase';
import type { Achievement } from '@/types/game';

import {
  buildAchievementId,
  gameMatchKey,
  mergeAchievements,
  mergeGameFields,
  parseAchievementId,
  type RemoteAchievementRow,
  type RemoteUserGameRow,
} from './merge-policy';

// Orchestration IMPURE de la synchronisation §9.5 (ARCHITECTURE.md), portée
// cette session à `user_games` + `achievements` uniquement — `play_sessions`
// et `lists`/`list_games` restent hors scope (voir la PR et ARCHITECTURE.md
// §9.5/§9.6). Toute la logique de FUSION vit dans merge-policy.ts (pure,
// testée par mutation) ; ce fichier ne fait que lire/écrire Supabase et
// appliquer le verdict déjà calculé — jamais l'inverse.
//
// Ne remplace jamais l'identité déjà résolue côté serveur par une recherche
// ON CONFLICT : les deux index uniques distants sont partiels
// (`(user_id, igdb_id) where igdb_id is not null` / `(user_id, slug) where
// igdb_id is null`, voir la migration), et un upsert PostgREST ne sait viser
// qu'une seule contrainte nommée à la fois. La correspondance est donc
// résolue ICI, en mémoire, à partir de tous les jeux distants déjà chargés
// (select complet par utilisateur, volume d'une bibliothèque solo — voir
// ARCHITECTURE.md §9.3) puis un INSERT ou un UPDATE explicite par id, jamais
// un upsert sur ces deux colonnes. Un vrai risque documenté et non traité
// ici (voir ARCHITECTURE.md §9.6, "Réconciliation d'identité tardive") :
// deux appareils qui créeraient la MÊME identité simultanément depuis zéro
// se heurteraient à la contrainte d'unicité distante — accepté pour cette
// session, comme le reste des limites de concurrence à deux appareils.

export type SyncOutcome = { error: string | null };

const NOT_CONFIGURED_ERROR = 'La synchronisation n’est pas configurée pour cette build.';

const GAME_COLUMNS =
  'id, igdb_id, slug, title, platform, steam_app_id, in_library, stopped, rating, review, updated_at';
const ACHIEVEMENT_COLUMNS = 'user_game_id, source, external_key, name, unlocked';

// Portée de la synchro : seuls les jeux porteurs d'une vraie donnée
// utilisateur montent vers le distant. Un jeu simplement enregistré par
// registerCatalogGame (aperçu dans Explorer, jamais ajouté) n'a pas
// d'updatedAt et ne doit jamais créer de ligne user_games côté serveur —
// sans ce filtre, consulter Explorer suffirait à peupler indéfiniment la
// bibliothèque distante de jeux jamais suivis.
function isTracked(game: StoredGame): boolean {
  return (
    game.inLibrary ||
    game.stopped ||
    game.rating != null ||
    (game.review != null && game.review !== '') ||
    game.achievements.length > 0
  );
}

function toRemoteAchievementInsert(gameRowId: string, achievement: Achievement) {
  const parsed = parseAchievementId(achievement.id);
  if (!parsed) return null;
  return {
    user_game_id: gameRowId,
    source: parsed.source,
    external_key: parsed.externalKey,
    name: achievement.name,
    unlocked: achievement.unlocked,
  };
}

export async function syncLibrary(
  userId: string,
  localGames: Record<string, StoredGame>,
  applySyncedGames: (games: StoredGame[]) => void
): Promise<SyncOutcome> {
  const client = getSupabaseClient();
  if (!client) return { error: NOT_CONFIGURED_ERROR };

  const { data: remoteGamesData, error: gamesError } = await client
    .from('user_games')
    .select(GAME_COLUMNS)
    .eq('user_id', userId);
  if (gamesError) return { error: gamesError.message };
  const remoteRows = (remoteGamesData ?? []) as RemoteUserGameRow[];

  const remoteIds = remoteRows.map((row) => row.id);
  let remoteAchievements: (RemoteAchievementRow & { user_game_id: string })[] = [];
  if (remoteIds.length > 0) {
    const { data, error } = await client.from('achievements').select(ACHIEVEMENT_COLUMNS).in('user_game_id', remoteIds);
    if (error) return { error: error.message };
    remoteAchievements = (data ?? []) as (RemoteAchievementRow & { user_game_id: string })[];
  }

  const achievementsByGameRowId = new Map<string, RemoteAchievementRow[]>();
  for (const achievement of remoteAchievements) {
    const list = achievementsByGameRowId.get(achievement.user_game_id) ?? [];
    list.push(achievement);
    achievementsByGameRowId.set(achievement.user_game_id, list);
  }

  const remoteByKey = new Map(remoteRows.map((row) => [gameMatchKey(row.igdb_id ?? undefined, row.slug), row]));
  const matchedRemoteIds = new Set<string>();
  const localUpdates: StoredGame[] = [];

  for (const game of Object.values(localGames).filter(isTracked)) {
    const key = gameMatchKey(game.igdbId, game.id);
    const remoteRow = remoteByKey.get(key);

    if (!remoteRow) {
      // Aucune correspondance distante : simple envoi, aucun arbitrage.
      const { data: inserted, error } = await client
        .from('user_games')
        .insert({
          user_id: userId,
          igdb_id: game.igdbId ?? null,
          slug: game.id,
          title: game.title,
          platform: game.platform || null,
          steam_app_id: game.steamAppId ?? null,
          in_library: game.inLibrary,
          stopped: game.stopped,
          rating: game.rating ?? null,
          review: game.review ?? null,
        })
        .select('id')
        .single();
      if (error) return { error: error.message };

      if (game.achievements.length > 0) {
        const rows = game.achievements
          .map((achievement) => toRemoteAchievementInsert(inserted.id, achievement))
          .filter((row): row is NonNullable<typeof row> => row !== null);
        if (rows.length > 0) {
          const { error: achError } = await client
            .from('achievements')
            .upsert(rows, { onConflict: 'user_game_id,source,external_key' });
          if (achError) return { error: achError.message };
        }
      }
      continue;
    }

    matchedRemoteIds.add(remoteRow.id);
    const remoteAchievementsForGame = achievementsByGameRowId.get(remoteRow.id) ?? [];
    const merged = mergeGameFields(
      { inLibrary: game.inLibrary, stopped: game.stopped, rating: game.rating, review: game.review, updatedAt: game.updatedAt },
      remoteRow
    );
    const achievementMerge = mergeAchievements(game.id, game.achievements, remoteAchievementsForGame);

    const localChanged =
      merged.inLibrary !== game.inLibrary ||
      merged.stopped !== game.stopped ||
      merged.rating !== game.rating ||
      merged.review !== game.review ||
      achievementMerge.changed;
    if (localChanged) {
      localUpdates.push({
        ...game,
        inLibrary: merged.inLibrary,
        stopped: merged.stopped,
        rating: merged.rating,
        review: merged.review,
        updatedAt: merged.updatedAt,
        achievements: achievementMerge.achievements,
      });
    }

    const remoteChanged =
      merged.inLibrary !== remoteRow.in_library ||
      merged.stopped !== remoteRow.stopped ||
      merged.rating !== (remoteRow.rating ?? undefined) ||
      merged.review !== (remoteRow.review ?? undefined);
    if (remoteChanged) {
      const { error } = await client
        .from('user_games')
        .update({
          in_library: merged.inLibrary,
          stopped: merged.stopped,
          rating: merged.rating ?? null,
          review: merged.review ?? null,
        })
        .eq('id', remoteRow.id);
      if (error) return { error: error.message };
    }

    if (achievementMerge.remoteUpserts.length > 0) {
      const rows = achievementMerge.remoteUpserts.map((upsert) => ({ user_game_id: remoteRow.id, ...upsert }));
      const { error } = await client
        .from('achievements')
        .upsert(rows, { onConflict: 'user_game_id,source,external_key' });
      if (error) return { error: error.message };
    }
  }

  // Jeux distants sans jeu local TRACKÉ correspondant : import. Un éventuel
  // jeu local déjà présent mais non traqué (simple métadonnée de catalogue,
  // ex. aperçu dans Explorer sur CET appareil) sert de base pour ne jamais
  // perdre ses champs propres à cet appareil (favoriteTrackId, playSessions
  // — hors scope de cette synchro, donc jamais écrasés).
  for (const remoteRow of remoteRows) {
    if (matchedRemoteIds.has(remoteRow.id)) continue;
    const achievementsForGame = achievementsByGameRowId.get(remoteRow.id) ?? [];
    const existingLocal = localGames[remoteRow.slug];
    localUpdates.push({
      ...(existingLocal ?? { playSessions: [] }),
      id: remoteRow.slug,
      title: remoteRow.title,
      platform: existingLocal?.platform || remoteRow.platform || '',
      steamAppId: existingLocal?.steamAppId ?? remoteRow.steam_app_id ?? undefined,
      igdbId: existingLocal?.igdbId ?? remoteRow.igdb_id ?? undefined,
      updatedAt: Date.parse(remoteRow.updated_at),
      inLibrary: remoteRow.in_library,
      stopped: remoteRow.stopped,
      achievements: achievementsForGame.map((a) => ({
        id: buildAchievementId(remoteRow.slug, a.source, a.external_key),
        name: a.name,
        unlocked: a.unlocked,
      })),
      rating: remoteRow.rating ?? undefined,
      review: remoteRow.review ?? undefined,
    });
  }

  if (localUpdates.length > 0) applySyncedGames(localUpdates);
  return { error: null };
}
