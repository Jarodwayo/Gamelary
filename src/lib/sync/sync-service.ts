import type { StoredGame, StoredList } from '@/lib/game-store';
import { getSupabaseClient } from '@/lib/supabase';
import type { Achievement } from '@/types/game';

import {
  buildAchievementId,
  gameMatchKey,
  mergeAchievements,
  mergeGameFields,
  mergeListMembership,
  mergeListMetadata,
  mergePlaySessions,
  parseAchievementId,
  type RemoteAchievementRow,
  type RemoteListMembershipRow,
  type RemoteListRow,
  type RemotePlaySessionRow,
  type RemoteUserGameRow,
} from './merge-policy';

// Orchestration IMPURE de la synchronisation §9.5 (ARCHITECTURE.md) : couvre
// maintenant les six tables du schéma (`user_games`, `achievements`,
// `play_sessions`, `lists`, `list_games` — `profiles` reste hors scope, voir
// §9.6). Toute la logique de FUSION vit dans merge-policy.ts (pure, testée
// par mutation) ; ce fichier ne fait que lire/écrire Supabase et appliquer
// le verdict déjà calculé — jamais l'inverse.
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
const MIN_GAME_COLUMNS = 'id, igdb_id, slug';
const ACHIEVEMENT_COLUMNS = 'user_game_id, source, external_key, name, unlocked';
const PLAY_SESSION_COLUMNS = 'user_game_id, client_key, played_at, hours';
const LIST_COLUMNS = 'id, builtin_key, client_key, name, description, hidden, deleted_at, updated_at';
const LIST_MEMBERSHIP_COLUMNS = 'list_id, user_game_id, removed_at, updated_at';

// Portée de la synchro : seuls les jeux porteurs d'une vraie donnée
// utilisateur montent vers le distant. Un jeu simplement enregistré par
// registerCatalogGame (aperçu dans Explorer, jamais ajouté) n'a pas
// d'updatedAt et ne doit jamais créer de ligne user_games côté serveur —
// sans ce filtre, consulter Explorer suffirait à peupler indéfiniment la
// bibliothèque distante de jeux jamais suivis.
//
// Référencé par une liste (Wishlist en tête : par construction, un jeu qui
// y figure n'est justement PAS encore dans la bibliothèque, donc jamais
// "traqué" au sens ci-dessus) élargit volontairement cette portée : sans
// ça, sa ligne `user_games` distante n'existerait jamais, et `list_games`
// (qui y référence une clé étrangère) n'aurait tout simplement rien à quoi
// s'accrocher pour ce jeu.
function isSyncWorthy(game: StoredGame, listReferencedGameIds: ReadonlySet<string>): boolean {
  return (
    game.inLibrary ||
    game.stopped ||
    game.rating != null ||
    (game.review != null && game.review !== '') ||
    game.achievements.length > 0 ||
    listReferencedGameIds.has(game.id)
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
  localLists: Record<string, StoredList>,
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
  let remotePlaySessions: (RemotePlaySessionRow & { user_game_id: string })[] = [];
  if (remoteIds.length > 0) {
    const [achievementsResult, playSessionsResult] = await Promise.all([
      client.from('achievements').select(ACHIEVEMENT_COLUMNS).in('user_game_id', remoteIds),
      client.from('play_sessions').select(PLAY_SESSION_COLUMNS).in('user_game_id', remoteIds),
    ]);
    if (achievementsResult.error) return { error: achievementsResult.error.message };
    if (playSessionsResult.error) return { error: playSessionsResult.error.message };
    remoteAchievements = (achievementsResult.data ?? []) as (RemoteAchievementRow & { user_game_id: string })[];
    remotePlaySessions = (playSessionsResult.data ?? []) as (RemotePlaySessionRow & { user_game_id: string })[];
  }

  const achievementsByGameRowId = new Map<string, RemoteAchievementRow[]>();
  for (const achievement of remoteAchievements) {
    const list = achievementsByGameRowId.get(achievement.user_game_id) ?? [];
    list.push(achievement);
    achievementsByGameRowId.set(achievement.user_game_id, list);
  }

  const playSessionsByGameRowId = new Map<string, RemotePlaySessionRow[]>();
  for (const session of remotePlaySessions) {
    const list = playSessionsByGameRowId.get(session.user_game_id) ?? [];
    list.push(session);
    playSessionsByGameRowId.set(session.user_game_id, list);
  }

  const listReferencedGameIds = new Set<string>();
  for (const list of Object.values(localLists)) {
    for (const gameId of list.gameIds) listReferencedGameIds.add(gameId);
  }

  const remoteByKey = new Map(remoteRows.map((row) => [gameMatchKey(row.igdb_id ?? undefined, row.slug), row]));
  const matchedRemoteIds = new Set<string>();
  const localUpdates: StoredGame[] = [];

  for (const game of Object.values(localGames).filter((g) => isSyncWorthy(g, listReferencedGameIds))) {
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

      if (game.playSessions.length > 0) {
        const rows = game.playSessions.map((session) => ({
          user_game_id: inserted.id,
          client_key: session.clientKey,
          played_at: session.date,
          hours: session.hours,
          // Toute session locale vient de setTotalHours (voir game-store.tsx) :
          // un écart par rapport au total précédent, jamais du temps de jeu
          // journalisé au fil de l'eau — voir la colonne `kind` de la
          // migration.
          kind: 'correction' as const,
        }));
        const { error: sessionsError } = await client
          .from('play_sessions')
          .upsert(rows, { onConflict: 'user_game_id,client_key' });
        if (sessionsError) return { error: sessionsError.message };
      }
      continue;
    }

    matchedRemoteIds.add(remoteRow.id);
    const remoteAchievementsForGame = achievementsByGameRowId.get(remoteRow.id) ?? [];
    const remotePlaySessionsForGame = playSessionsByGameRowId.get(remoteRow.id) ?? [];
    const merged = mergeGameFields(
      { inLibrary: game.inLibrary, stopped: game.stopped, rating: game.rating, review: game.review, updatedAt: game.updatedAt },
      remoteRow
    );
    const achievementMerge = mergeAchievements(game.id, game.achievements, remoteAchievementsForGame);
    const sessionMerge = mergePlaySessions(game.playSessions, remotePlaySessionsForGame);

    const localChanged =
      merged.inLibrary !== game.inLibrary ||
      merged.stopped !== game.stopped ||
      merged.rating !== game.rating ||
      merged.review !== game.review ||
      achievementMerge.changed ||
      sessionMerge.changed;
    if (localChanged) {
      localUpdates.push({
        ...game,
        inLibrary: merged.inLibrary,
        stopped: merged.stopped,
        rating: merged.rating,
        review: merged.review,
        updatedAt: merged.updatedAt,
        achievements: achievementMerge.achievements,
        playSessions: sessionMerge.sessions,
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

    if (sessionMerge.remoteInserts.length > 0) {
      const rows = sessionMerge.remoteInserts.map((insert) => ({
        user_game_id: remoteRow.id,
        ...insert,
        kind: 'correction' as const,
      }));
      const { error } = await client
        .from('play_sessions')
        .upsert(rows, { onConflict: 'user_game_id,client_key' });
      if (error) return { error: error.message };
    }
  }

  // Jeux distants sans jeu local TRACKÉ (ni référencé par une liste)
  // correspondant : import. Un éventuel jeu local déjà présent mais non
  // traqué (simple métadonnée de catalogue, ex. aperçu dans Explorer sur CET
  // appareil) sert de base pour ne jamais perdre ses champs propres à cet
  // appareil (favoriteTrackId notamment).
  for (const remoteRow of remoteRows) {
    if (matchedRemoteIds.has(remoteRow.id)) continue;
    const achievementsForGame = achievementsByGameRowId.get(remoteRow.id) ?? [];
    const playSessionsForGame = playSessionsByGameRowId.get(remoteRow.id) ?? [];
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
      playSessions: playSessionsForGame.map((s) => ({
        clientKey: s.client_key,
        date: s.played_at,
        hours: s.hours,
      })),
    });
  }

  if (localUpdates.length > 0) applySyncedGames(localUpdates);
  return { error: null };
}

// Traduit chaque ligne `user_games` distante vers L'ID LOCAL de CET
// appareil pour le même jeu, quand il en a déjà un — jamais vers
// `remoteRow.slug` tel quel, qui peut être celui d'un AUTRE appareil (deux
// appareils peuvent légitimement produire deux slugs différents pour la
// même identité IGDB, voir gameMatchKey/ARCHITECTURE.md §9.2). Un jeu que
// CET appareil n'a jamais vu du tout retombe sur `remoteRow.slug` comme
// nouvel id local — même convention que l'import de jeux dans syncLibrary.
function buildGameIdByRemoteId(
  remoteGameRows: { id: string; igdb_id: number | null; slug: string }[],
  localGames: Record<string, StoredGame>
): Map<string, string> {
  const localIdByMatchKey = new Map<string, string>();
  for (const game of Object.values(localGames)) {
    localIdByMatchKey.set(gameMatchKey(game.igdbId, game.id), game.id);
  }
  const gameIdByRemoteId = new Map<string, string>();
  for (const row of remoteGameRows) {
    const key = gameMatchKey(row.igdb_id ?? undefined, row.slug);
    gameIdByRemoteId.set(row.id, localIdByMatchKey.get(key) ?? row.slug);
  }
  return gameIdByRemoteId;
}

type RemoteListRowSelected = RemoteListRow & { id: string; builtin_key: string | null; client_key: string | null };

// Une liste intégrée (Favoris/Wishlist) s'apparie par `builtin_key` (partagé
// par construction, voir game-store.tsx : ids fixes 'favoris'/'wishlist') ;
// une liste créée par l'utilisateur, elle, s'apparie par `client_key`,
// l'id local choisi par CE client — jamais par l'`id` distant, généré côté
// serveur et donc inconnu tant que la ligne n'existe pas encore (voir la
// migration 20260911120000_lists_sync_columns.sql).
function listMatchKey(builtin: boolean, id: string): string {
  return builtin ? `builtin:${id}` : `custom:${id}`;
}

export async function syncLists(
  userId: string,
  localGames: Record<string, StoredGame>,
  localLists: Record<string, StoredList>,
  applySyncedLists: (lists: StoredList[]) => void
): Promise<SyncOutcome> {
  const client = getSupabaseClient();
  if (!client) return { error: NOT_CONFIGURED_ERROR };

  const { data: remoteGamesData, error: gamesError } = await client
    .from('user_games')
    .select(MIN_GAME_COLUMNS)
    .eq('user_id', userId);
  if (gamesError) return { error: gamesError.message };
  const remoteGameRows = (remoteGamesData ?? []) as { id: string; igdb_id: number | null; slug: string }[];

  const gameIdByRemoteId = buildGameIdByRemoteId(remoteGameRows, localGames);
  const remoteGameIdByGameId = new Map<string, string>();
  for (const [remoteId, gameId] of gameIdByRemoteId) remoteGameIdByGameId.set(gameId, remoteId);

  const { data: remoteListsData, error: listsError } = await client
    .from('lists')
    .select(LIST_COLUMNS)
    .eq('user_id', userId);
  if (listsError) return { error: listsError.message };
  const remoteListRows = (remoteListsData ?? []) as RemoteListRowSelected[];

  const remoteListIds = remoteListRows.map((row) => row.id);
  let remoteMemberships: { list_id: string; user_game_id: string; removed_at: string | null; updated_at: string }[] = [];
  if (remoteListIds.length > 0) {
    const { data, error } = await client.from('list_games').select(LIST_MEMBERSHIP_COLUMNS).in('list_id', remoteListIds);
    if (error) return { error: error.message };
    remoteMemberships = data ?? [];
  }
  const membershipsByListId = new Map<string, typeof remoteMemberships>();
  for (const row of remoteMemberships) {
    const list = membershipsByListId.get(row.list_id) ?? [];
    list.push(row);
    membershipsByListId.set(row.list_id, list);
  }

  const remoteByMatchKey = new Map(
    remoteListRows.map((row) => [row.builtin_key != null ? listMatchKey(true, row.builtin_key) : listMatchKey(false, row.client_key ?? ''), row])
  );
  const matchedRemoteListIds = new Set<string>();
  const localUpdates: StoredList[] = [];

  function remoteMembershipRowsFor(remoteListId: string): RemoteListMembershipRow[] {
    return (membershipsByListId.get(remoteListId) ?? [])
      .map((row) => {
        const gameId = gameIdByRemoteId.get(row.user_game_id);
        if (gameId == null) return null;
        return { gameId, removedAt: row.removed_at, updatedAt: row.updated_at };
      })
      .filter((row): row is RemoteListMembershipRow => row !== null);
  }

  for (const list of Object.values(localLists)) {
    const remoteRow = remoteByMatchKey.get(listMatchKey(list.builtin, list.id));

    if (!remoteRow) {
      // Aucune correspondance distante : simple envoi, aucun arbitrage —
      // même schéma que l'insertion d'un nouveau jeu dans syncLibrary.
      const { data: inserted, error } = await client
        .from('lists')
        .insert({
          user_id: userId,
          builtin_key: list.builtin ? list.id : null,
          client_key: list.builtin ? null : list.id,
          name: list.name,
          description: list.description ?? null,
          hidden: list.hidden ?? false,
          deleted_at: list.deletedAt != null ? new Date(list.deletedAt).toISOString() : null,
        })
        .select('id')
        .single();
      if (error) return { error: error.message };

      // Une liste supprimée avant sa toute première synchro (créée puis
      // supprimée hors-ligne) a déjà `gameIds` vide (voir deleteList,
      // game-store.tsx) : cette boucle ne produit alors naturellement rien à
      // upserter, sans branche séparée à écrire pour ce cas.
      const rows = list.gameIds
        .map((gameId) => remoteGameIdByGameId.get(gameId))
        .filter((remoteGameId): remoteGameId is string => remoteGameId != null)
        .map((remoteGameId) => ({ list_id: inserted.id, user_game_id: remoteGameId, removed_at: null }));
      if (rows.length > 0) {
        const { error: membershipError } = await client
          .from('list_games')
          .upsert(rows, { onConflict: 'list_id,user_game_id' });
        if (membershipError) return { error: membershipError.message };
      }
      continue;
    }

    matchedRemoteListIds.add(remoteRow.id);
    const metadataMerge = mergeListMetadata(
      {
        name: list.name,
        description: list.description,
        hidden: list.hidden,
        deletedAt: list.deletedAt,
        updatedAt: list.updatedAt,
      },
      remoteRow
    );
    // Verdict "supprimée" (par l'un OU l'autre côté) : plus rien à arbitrer
    // côté appartenance, aucun appareil n'a plus besoin de savoir quels jeux
    // s'y trouvaient. Court-circuite mergeListMembership plutôt que de la
    // laisser importer depuis un distant pas encore nettoyé (voir plus bas)
    // et ainsi repeupler `gameIds` d'une liste qu'on vient pourtant de vider.
    const isDeleted = metadataMerge.deletedAt != null;
    const membershipMerge = isDeleted
      ? {
          gameIds: [] as string[],
          memberships: {} as Record<string, { removed?: boolean; updatedAt?: number }>,
          changed: list.gameIds.length > 0 || Object.keys(list.memberships ?? {}).length > 0,
          remoteUpserts: [] as { gameId: string; removed: boolean }[],
        }
      : mergeListMembership(list.gameIds, list.memberships ?? {}, remoteMembershipRowsFor(remoteRow.id));

    const metadataChanged =
      metadataMerge.name !== list.name ||
      metadataMerge.description !== list.description ||
      metadataMerge.hidden !== list.hidden ||
      metadataMerge.deletedAt !== list.deletedAt;
    const localChanged = metadataChanged || membershipMerge.changed;
    if (localChanged) {
      localUpdates.push({
        ...list,
        name: metadataMerge.name,
        description: metadataMerge.description,
        hidden: metadataMerge.hidden,
        deletedAt: metadataMerge.deletedAt,
        updatedAt: metadataMerge.updatedAt,
        gameIds: membershipMerge.gameIds,
        memberships: membershipMerge.memberships,
      });
    }

    // `hidden`/`description` sont optionnels côté local (absent = valeur par
    // défaut, voir StoredList) mais toujours renseignés côté distant (`not
    // null`) : comparer sans harmoniser ferait lire une simple absence
    // locale comme un vrai changement et pousserait une écriture distante
    // qui ne change rien en pratique.
    const remoteDeletedAt = remoteRow.deleted_at != null ? Date.parse(remoteRow.deleted_at) : undefined;
    const remoteMetadataChanged =
      metadataMerge.name !== remoteRow.name ||
      (metadataMerge.description ?? undefined) !== (remoteRow.description ?? undefined) ||
      (metadataMerge.hidden ?? false) !== remoteRow.hidden ||
      metadataMerge.deletedAt !== remoteDeletedAt;
    if (remoteMetadataChanged) {
      const { error } = await client
        .from('lists')
        .update({
          name: metadataMerge.name,
          description: metadataMerge.description ?? null,
          hidden: metadataMerge.hidden ?? false,
          deleted_at: metadataMerge.deletedAt != null ? new Date(metadataMerge.deletedAt).toISOString() : null,
        })
        .eq('id', remoteRow.id);
      if (error) return { error: error.message };
    }

    // La suppression vient d'être constatée côté distant PAR CE ROUND (elle
    // ne l'était pas encore, `remoteDeletedAt` absent) : ses lignes
    // list_games n'ont plus aucune utilité pour aucun appareil — une liste
    // supprimée ne se restaure pas, contrairement à une simple appartenance
    // retirée (`removed_at`). Nettoyage immédiat plutôt que des lignes mortes
    // qui traîneraient indéfiniment sans jamais plus être lues.
    if (isDeleted && remoteDeletedAt == null) {
      const { error } = await client.from('list_games').delete().eq('list_id', remoteRow.id);
      if (error) return { error: error.message };
    }

    if (membershipMerge.remoteUpserts.length > 0) {
      const rows = membershipMerge.remoteUpserts
        .map((upsert) => {
          const remoteGameId = remoteGameIdByGameId.get(upsert.gameId);
          if (!remoteGameId) return null;
          return {
            list_id: remoteRow.id,
            user_game_id: remoteGameId,
            removed_at: upsert.removed ? new Date().toISOString() : null,
          };
        })
        .filter((row): row is NonNullable<typeof row> => row !== null);
      if (rows.length > 0) {
        const { error } = await client.from('list_games').upsert(rows, { onConflict: 'list_id,user_game_id' });
        if (error) return { error: error.message };
      }
    }
  }

  // Listes distantes sans liste locale correspondante : import — créées sur
  // un autre appareil, jamais vues ici (même schéma que l'import de jeux
  // dans syncLibrary).
  for (const remoteRow of remoteListRows) {
    if (matchedRemoteListIds.has(remoteRow.id)) continue;
    // Une liste jamais vue par CET appareil et déjà supprimée ailleurs
    // n'apporte rien à importer : elle serait de toute façon immédiatement
    // cachée de tous les écrans qui énumèrent les listes (voir
    // ARCHITECTURE.md « Suppression et renommage d'une liste »), sans même
    // avoir besoin de traduire ses appartenances passées vers cet appareil.
    if (remoteRow.deleted_at != null) continue;
    const memberships: Record<string, { removed?: boolean; updatedAt?: number }> = {};
    const gameIds: string[] = [];
    for (const row of remoteMembershipRowsFor(remoteRow.id)) {
      const removed = row.removedAt != null;
      memberships[row.gameId] = { removed: removed || undefined, updatedAt: Date.parse(row.updatedAt) };
      if (!removed) gameIds.push(row.gameId);
    }
    localUpdates.push({
      id: remoteRow.builtin_key ?? remoteRow.client_key ?? remoteRow.id,
      name: remoteRow.name,
      builtin: remoteRow.builtin_key != null,
      description: remoteRow.description ?? undefined,
      hidden: remoteRow.hidden,
      updatedAt: Date.parse(remoteRow.updated_at),
      gameIds,
      memberships,
    });
  }

  if (localUpdates.length > 0) applySyncedLists(localUpdates);
  return { error: null };
}
