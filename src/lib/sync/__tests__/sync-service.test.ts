// syncLibrary/syncLists sont l'orchestration IMPURE de la politique de
// fusion §9.5 (merge-policy.ts, déjà mutation-testée séparément) : ce
// fichier vérifie qu'elles lisent/écrivent Supabase au bon endroit et
// appliquent bien le verdict calculé — jamais mocké au niveau de
// merge-policy lui-même, pour garder de vrais scénarios de conflit à deux
// appareils de bout en bout (voir les tests "conflit réel").
import { getSupabaseClient } from '@/lib/supabase';
import type { StoredGame, StoredList } from '@/lib/game-store';

import { syncLibrary, syncLists } from '../sync-service';

jest.mock('@/lib/supabase', () => ({ getSupabaseClient: jest.fn() }));

const mockGetSupabaseClient = getSupabaseClient as jest.Mock;

type QueryResult<T> = { data: T | null; error: { message: string } | null };

function ok<T>(data: T): QueryResult<T> {
  return { data, error: null };
}

// Fake tailored aux appels RÉELLEMENT faits par sync-service.ts (voir son
// code) plutôt qu'un faux client Supabase générique : select+eq, insert+
// select+single, update+eq, select+in, upsert — sur les cinq tables
// utilisées (`user_games`, `achievements`, `play_sessions`, `lists`,
// `list_games`). Même esprit que makeFakeClient (auth-store.test.tsx) —
// mocker exactement ce qui est utilisé, pas réimplémenter le SDK.
function makeFakeClient(config: {
  userGames?: QueryResult<unknown[]>;
  achievements?: QueryResult<unknown[]>;
  playSessions?: QueryResult<unknown[]>;
  insertUserGame?: QueryResult<{ id: string }>;
  updateUserGame?: QueryResult<null>;
  upsertAchievements?: QueryResult<null>;
  upsertPlaySessions?: QueryResult<null>;
  lists?: QueryResult<unknown[]>;
  listGames?: QueryResult<unknown[]>;
  insertList?: QueryResult<{ id: string }>;
  updateList?: QueryResult<null>;
  upsertListGames?: QueryResult<null>;
}) {
  const calls: {
    userGamesSelectUserId?: string;
    achievementsSelectIds?: string[];
    playSessionsSelectIds?: string[];
    inserts: Record<string, unknown>[];
    updates: { id: string; patch: Record<string, unknown> }[];
    achievementUpserts: Record<string, unknown>[][];
    playSessionUpserts: Record<string, unknown>[][];
    listsSelectUserId?: string;
    listGamesSelectIds?: string[];
    listInserts: Record<string, unknown>[];
    listUpdates: { id: string; patch: Record<string, unknown> }[];
    listGameUpserts: Record<string, unknown>[][];
  } = {
    inserts: [],
    updates: [],
    achievementUpserts: [],
    playSessionUpserts: [],
    listInserts: [],
    listUpdates: [],
    listGameUpserts: [],
  };

  let insertCounter = 0;
  let listInsertCounter = 0;

  const userGamesTable = {
    select: () => ({
      eq: (_col: string, userId: string) => {
        calls.userGamesSelectUserId = userId;
        return Promise.resolve(config.userGames ?? ok([]));
      },
    }),
    insert: (payload: Record<string, unknown>) => ({
      select: () => ({
        single: () => {
          calls.inserts.push(payload);
          insertCounter += 1;
          return Promise.resolve(config.insertUserGame ?? ok({ id: `nouvelle-ligne-${insertCounter}` }));
        },
      }),
    }),
    update: (patch: Record<string, unknown>) => ({
      eq: (_col: string, id: string) => {
        calls.updates.push({ id, patch });
        return Promise.resolve(config.updateUserGame ?? ok(null));
      },
    }),
  };

  const achievementsTable = {
    select: () => ({
      in: (_col: string, ids: string[]) => {
        calls.achievementsSelectIds = ids;
        return Promise.resolve(config.achievements ?? ok([]));
      },
    }),
    upsert: (rows: Record<string, unknown>[]) => {
      calls.achievementUpserts.push(rows);
      return Promise.resolve(config.upsertAchievements ?? ok(null));
    },
  };

  const playSessionsTable = {
    select: () => ({
      in: (_col: string, ids: string[]) => {
        calls.playSessionsSelectIds = ids;
        return Promise.resolve(config.playSessions ?? ok([]));
      },
    }),
    upsert: (rows: Record<string, unknown>[]) => {
      calls.playSessionUpserts.push(rows);
      return Promise.resolve(config.upsertPlaySessions ?? ok(null));
    },
  };

  const listsTable = {
    select: () => ({
      eq: (_col: string, userId: string) => {
        calls.listsSelectUserId = userId;
        return Promise.resolve(config.lists ?? ok([]));
      },
    }),
    insert: (payload: Record<string, unknown>) => ({
      select: () => ({
        single: () => {
          calls.listInserts.push(payload);
          listInsertCounter += 1;
          return Promise.resolve(config.insertList ?? ok({ id: `nouvelle-liste-${listInsertCounter}` }));
        },
      }),
    }),
    update: (patch: Record<string, unknown>) => ({
      eq: (_col: string, id: string) => {
        calls.listUpdates.push({ id, patch });
        return Promise.resolve(config.updateList ?? ok(null));
      },
    }),
  };

  const listGamesTable = {
    select: () => ({
      in: (_col: string, ids: string[]) => {
        calls.listGamesSelectIds = ids;
        return Promise.resolve(config.listGames ?? ok([]));
      },
    }),
    upsert: (rows: Record<string, unknown>[]) => {
      calls.listGameUpserts.push(rows);
      return Promise.resolve(config.upsertListGames ?? ok(null));
    },
  };

  const client = {
    from: jest.fn((table: string) => {
      if (table === 'user_games') return userGamesTable;
      if (table === 'achievements') return achievementsTable;
      if (table === 'play_sessions') return playSessionsTable;
      if (table === 'lists') return listsTable;
      if (table === 'list_games') return listGamesTable;
      throw new Error(`table inattendue en test : ${table}`);
    }),
  };

  return { client, calls };
}

function localGame(overrides: Partial<StoredGame> = {}): StoredGame {
  return {
    id: 'hollow-knight',
    title: 'Hollow Knight',
    platform: 'PC',
    inLibrary: true,
    stopped: false,
    achievements: [],
    playSessions: [],
    ...overrides,
  };
}

function localList(overrides: Partial<StoredList> = {}): StoredList {
  return {
    id: 'favoris',
    name: 'Favoris',
    builtin: true,
    gameIds: [],
    ...overrides,
  };
}

afterEach(() => {
  jest.clearAllMocks();
});

describe('syncLibrary — user_games/achievements (comportement existant, inchangé)', () => {
  test("sans client configuré : erreur explicite, aucun appel réseau", async () => {
    mockGetSupabaseClient.mockReturnValue(null);
    const applySyncedGames = jest.fn();

    const result = await syncLibrary('user-1', {}, {}, applySyncedGames);

    expect(result.error).not.toBeNull();
    expect(applySyncedGames).not.toHaveBeenCalled();
  });

  test('une erreur de lecture user_games est remontée telle quelle, rien d’autre ne se passe', async () => {
    const { client } = makeFakeClient({ userGames: { data: null, error: { message: 'Réseau indisponible' } } });
    mockGetSupabaseClient.mockReturnValue(client);
    const applySyncedGames = jest.fn();

    const result = await syncLibrary('user-1', { 'hollow-knight': localGame() }, {}, applySyncedGames);

    expect(result).toEqual({ error: 'Réseau indisponible' });
    expect(applySyncedGames).not.toHaveBeenCalled();
  });

  test('jeu local nouveau, aucune correspondance distante : envoi pur (INSERT), pas de fusion', async () => {
    const { client, calls } = makeFakeClient({ userGames: ok([]) });
    mockGetSupabaseClient.mockReturnValue(client);
    const applySyncedGames = jest.fn();

    const local = localGame({
      igdbId: 42,
      rating: 18,
      achievements: [{ id: 'hollow-knight:steam:ACH_1', name: 'Premier pas', unlocked: true }],
    });

    const result = await syncLibrary('user-1', { 'hollow-knight': local }, {}, applySyncedGames);

    expect(result.error).toBeNull();
    expect(calls.inserts).toEqual([
      {
        user_id: 'user-1',
        igdb_id: 42,
        slug: 'hollow-knight',
        title: 'Hollow Knight',
        platform: 'PC',
        steam_app_id: null,
        in_library: true,
        stopped: false,
        rating: 18,
        review: null,
      },
    ]);
    expect(calls.achievementUpserts).toEqual([
      [{ user_game_id: 'nouvelle-ligne-1', source: 'steam', external_key: 'ACH_1', name: 'Premier pas', unlocked: true }],
    ]);
    // Rien à écrire localement : l'appareil qui pousse un jeu ne change rien
    // chez lui-même en le poussant.
    expect(applySyncedGames).not.toHaveBeenCalled();
  });

  test('jeu distant sans correspondance locale : import pur (aucun jeu local traqué)', async () => {
    const remoteRow = {
      id: 'remote-uuid-1',
      igdb_id: 7,
      slug: 'zelda-botw',
      title: 'Zelda: Breath of the Wild',
      platform: 'Switch',
      steam_app_id: null,
      in_library: true,
      stopped: false,
      rating: 20,
      review: 'Chef-d’œuvre',
      updated_at: '2026-03-01T00:00:00.000Z',
    };
    const { client } = makeFakeClient({
      userGames: ok([remoteRow]),
      achievements: ok([{ user_game_id: 'remote-uuid-1', source: 'steam', external_key: 'ACH_X', name: 'Succès distant', unlocked: true }]),
    });
    mockGetSupabaseClient.mockReturnValue(client);
    const applySyncedGames = jest.fn();

    const result = await syncLibrary('user-1', {}, {}, applySyncedGames);

    expect(result.error).toBeNull();
    expect(applySyncedGames).toHaveBeenCalledTimes(1);
    const [[games]] = applySyncedGames.mock.calls;
    expect(games).toEqual([
      {
        id: 'zelda-botw',
        title: 'Zelda: Breath of the Wild',
        platform: 'Switch',
        steamAppId: undefined,
        igdbId: 7,
        updatedAt: Date.parse('2026-03-01T00:00:00.000Z'),
        inLibrary: true,
        stopped: false,
        achievements: [{ id: 'zelda-botw:steam:ACH_X', name: 'Succès distant', unlocked: true }],
        rating: 20,
        review: 'Chef-d’œuvre',
        playSessions: [],
      },
    ]);
  });

  // Le scénario de conflit demandé explicitement : le MÊME jeu, modifié
  // différemment des deux côtés (bibliothèque, note/avis, succès), avec un
  // vrai faux client Supabase — vérifie que la fusion respecte la politique
  // de bout en bout, pas seulement que le code compile.
  test('conflit réel à deux appareils : union bibliothèque, dernier-écrit-gagne note/avis, OU logique succès', async () => {
    const remoteRow = {
      id: 'remote-uuid-2',
      igdb_id: null,
      slug: 'hollow-knight',
      title: 'Hollow Knight',
      platform: 'PC',
      steam_app_id: 367520,
      in_library: false, // appareil A n'a jamais ajouté ce jeu à sa bibliothèque
      stopped: false,
      rating: 18,
      review: 'Écrit sur l’appareil A, plus récent',
      updated_at: '2026-03-01T00:00:00.000Z',
    };
    const { client, calls } = makeFakeClient({
      userGames: ok([remoteRow]),
      achievements: ok([{ user_game_id: 'remote-uuid-2', source: 'steam', external_key: 'ACH_1', name: 'Premier pas', unlocked: false }]),
    });
    mockGetSupabaseClient.mockReturnValue(client);
    const applySyncedGames = jest.fn();

    const local = localGame({
      inLibrary: true, // appareil B, lui, l'a ajoutée -> l'union doit gagner
      rating: 5,
      review: 'Vieil avis local',
      updatedAt: Date.parse('2026-01-01T00:00:00.000Z'), // plus ancien que le distant
      achievements: [{ id: 'hollow-knight:steam:ACH_1', name: 'Premier pas', unlocked: true }], // débloqué localement seulement
    });

    const result = await syncLibrary('user-1', { 'hollow-knight': local }, {}, applySyncedGames);

    expect(result.error).toBeNull();

    // Union : la bibliothèque locale (true) l'emporte, jamais de retrait.
    // Dernier-écrit-gagne : le distant (plus récent) l'emporte sur rating/review.
    const [[games]] = applySyncedGames.mock.calls;
    expect(games).toEqual([
      expect.objectContaining({
        inLibrary: true,
        rating: 18,
        review: 'Écrit sur l’appareil A, plus récent',
        updatedAt: Date.parse('2026-03-01T00:00:00.000Z'),
        achievements: [{ id: 'hollow-knight:steam:ACH_1', name: 'Premier pas', unlocked: true }],
      }),
    ]);

    // Le distant doit refléter l'union de la bibliothèque (il ne l'avait pas).
    expect(calls.updates).toEqual([
      { id: 'remote-uuid-2', patch: { in_library: true, stopped: false, rating: 18, review: 'Écrit sur l’appareil A, plus récent' } },
    ]);

    // Le succès débloqué localement doit remonter : jamais reverrouillé, et le
    // distant ne doit plus rester à false.
    expect(calls.achievementUpserts).toEqual([
      [{ user_game_id: 'remote-uuid-2', source: 'steam', external_key: 'ACH_1', name: 'Premier pas', unlocked: true }],
    ]);
  });

  test('seule inLibrary diverge côté local (rating/review/succès déjà identiques) : la fusion locale est bien appliquée', async () => {
    // Isole la détection de changement sur inLibrary, sans qu'un changement de
    // rating/review/succès ne la masque : local=false, distant=true -> l'union
    // doit faire basculer le LOCAL à true, et rien d'autre ne doit diverger
    // (remoteChanged doit rester false, aucune écriture distante attendue).
    const remoteRow = {
      id: 'remote-uuid-4',
      igdb_id: null,
      slug: 'hollow-knight',
      title: 'Hollow Knight',
      platform: 'PC',
      steam_app_id: 367520,
      in_library: true,
      stopped: false,
      rating: 18,
      review: 'Avis déjà identique',
      updated_at: '2026-01-01T00:00:00.000Z',
    };
    const { client, calls } = makeFakeClient({
      userGames: ok([remoteRow]),
      achievements: ok([{ user_game_id: 'remote-uuid-4', source: 'steam', external_key: 'ACH_1', name: 'Premier pas', unlocked: true }]),
    });
    mockGetSupabaseClient.mockReturnValue(client);
    const applySyncedGames = jest.fn();

    const local = localGame({
      inLibrary: false, // seule divergence réelle : ajouté depuis un autre appareil
      rating: 18,
      review: 'Avis déjà identique',
      updatedAt: Date.parse('2026-02-01T00:00:00.000Z'),
      achievements: [{ id: 'hollow-knight:steam:ACH_1', name: 'Premier pas', unlocked: true }],
    });

    const result = await syncLibrary('user-1', { 'hollow-knight': local }, {}, applySyncedGames);

    expect(result.error).toBeNull();
    expect(applySyncedGames).toHaveBeenCalledTimes(1);
    const [[games]] = applySyncedGames.mock.calls;
    expect(games).toEqual([expect.objectContaining({ inLibrary: true })]);
    expect(calls.updates).toEqual([]);
    expect(calls.achievementUpserts).toEqual([]);
  });

  test('rien ne diverge : aucune écriture locale ni distante (pas de bascule inutile)', async () => {
    const remoteRow = {
      id: 'remote-uuid-3',
      igdb_id: null,
      slug: 'hollow-knight',
      title: 'Hollow Knight',
      platform: 'PC',
      steam_app_id: 367520,
      in_library: true,
      stopped: false,
      rating: 18,
      review: 'Avis déjà identique',
      updated_at: '2026-01-01T00:00:00.000Z',
    };
    const { client, calls } = makeFakeClient({
      userGames: ok([remoteRow]),
      achievements: ok([{ user_game_id: 'remote-uuid-3', source: 'steam', external_key: 'ACH_1', name: 'Premier pas', unlocked: true }]),
    });
    mockGetSupabaseClient.mockReturnValue(client);
    const applySyncedGames = jest.fn();

    const local = localGame({
      inLibrary: true,
      rating: 18,
      review: 'Avis déjà identique',
      updatedAt: Date.parse('2026-02-01T00:00:00.000Z'),
      achievements: [{ id: 'hollow-knight:steam:ACH_1', name: 'Premier pas', unlocked: true }],
    });

    const result = await syncLibrary('user-1', { 'hollow-knight': local }, {}, applySyncedGames);

    expect(result.error).toBeNull();
    expect(applySyncedGames).not.toHaveBeenCalled();
    expect(calls.updates).toEqual([]);
    expect(calls.achievementUpserts).toEqual([]);
  });
});

describe('syncLibrary — play_sessions (union par clientKey/client_key)', () => {
  test('nouveau jeu inséré : ses sessions sont poussées, marquées "correction"', async () => {
    const { client, calls } = makeFakeClient({ userGames: ok([]) });
    mockGetSupabaseClient.mockReturnValue(client);
    const applySyncedGames = jest.fn();

    const local = localGame({
      inLibrary: true,
      playSessions: [{ date: '2026-01-01T00:00:00.000Z', hours: 3, clientKey: 'k1' }],
    });

    const result = await syncLibrary('user-1', { 'hollow-knight': local }, {}, applySyncedGames);

    expect(result.error).toBeNull();
    expect(calls.playSessionUpserts).toEqual([
      [{ user_game_id: 'nouvelle-ligne-1', client_key: 'k1', played_at: '2026-01-01T00:00:00.000Z', hours: 3, kind: 'correction' }],
    ]);
  });

  test('jeu apparié : sessions locales absentes du distant poussées, sessions distantes absentes localement importées', async () => {
    const remoteRow = {
      id: 'remote-uuid-5',
      igdb_id: null,
      slug: 'hollow-knight',
      title: 'Hollow Knight',
      platform: 'PC',
      steam_app_id: 367520,
      in_library: true,
      stopped: false,
      rating: null,
      review: null,
      updated_at: '2026-01-01T00:00:00.000Z',
    };
    const { client, calls } = makeFakeClient({
      userGames: ok([remoteRow]),
      playSessions: ok([{ user_game_id: 'remote-uuid-5', client_key: 'distant-1', played_at: '2026-01-02T00:00:00.000Z', hours: 2 }]),
    });
    mockGetSupabaseClient.mockReturnValue(client);
    const applySyncedGames = jest.fn();

    const local = localGame({
      inLibrary: true,
      playSessions: [{ date: '2026-01-01T00:00:00.000Z', hours: 3, clientKey: 'local-1' }],
    });

    const result = await syncLibrary('user-1', { 'hollow-knight': local }, {}, applySyncedGames);

    expect(result.error).toBeNull();
    expect(calls.playSessionUpserts).toEqual([
      [{ user_game_id: 'remote-uuid-5', client_key: 'local-1', played_at: '2026-01-01T00:00:00.000Z', hours: 3, kind: 'correction' }],
    ]);
    const [[games]] = applySyncedGames.mock.calls;
    expect(games[0].playSessions).toEqual([
      { date: '2026-01-01T00:00:00.000Z', hours: 3, clientKey: 'local-1' },
      { date: '2026-01-02T00:00:00.000Z', hours: 2, clientKey: 'distant-1' },
    ]);
  });

  test('jeu distant importé (aucun jeu local traqué) : ses sessions sont importées avec lui', async () => {
    const remoteRow = {
      id: 'remote-uuid-6',
      igdb_id: 99,
      slug: 'celeste',
      title: 'Celeste',
      platform: 'PC',
      steam_app_id: null,
      in_library: true,
      stopped: false,
      rating: null,
      review: null,
      updated_at: '2026-01-01T00:00:00.000Z',
    };
    const { client } = makeFakeClient({
      userGames: ok([remoteRow]),
      playSessions: ok([{ user_game_id: 'remote-uuid-6', client_key: 'distant-2', played_at: '2026-01-05T00:00:00.000Z', hours: 4 }]),
    });
    mockGetSupabaseClient.mockReturnValue(client);
    const applySyncedGames = jest.fn();

    const result = await syncLibrary('user-1', {}, {}, applySyncedGames);

    expect(result.error).toBeNull();
    const [[games]] = applySyncedGames.mock.calls;
    expect(games[0].playSessions).toEqual([{ date: '2026-01-05T00:00:00.000Z', hours: 4, clientKey: 'distant-2' }]);
  });
});

describe('syncLibrary — portée élargie par les listes (cas Wishlist)', () => {
  test('jeu non traqué mais référencé par une liste locale : monte quand même vers user_games', async () => {
    // Par construction, un jeu de la Wishlist n'est justement PAS "traqué"
    // au sens habituel (ni inLibrary, ni noté, ni de succès) — sans cet
    // élargissement, sa ligne user_games distante ne serait jamais créée et
    // list_games (qui la référence) n'aurait rien à quoi s'accrocher.
    const { client, calls } = makeFakeClient({ userGames: ok([]) });
    mockGetSupabaseClient.mockReturnValue(client);
    const applySyncedGames = jest.fn();

    const untracked = localGame({ id: 'a-wishlister', inLibrary: false, stopped: false });
    const lists = { wishlist: localList({ id: 'wishlist', name: 'Wishlist', gameIds: ['a-wishlister'] }) };

    const result = await syncLibrary('user-1', { 'a-wishlister': untracked }, lists, applySyncedGames);

    expect(result.error).toBeNull();
    expect(calls.inserts).toHaveLength(1);
    expect(calls.inserts[0]).toEqual(expect.objectContaining({ slug: 'a-wishlister', in_library: false }));
  });

  test('jeu non traqué et non référencé par aucune liste : ne monte toujours pas', async () => {
    const { client, calls } = makeFakeClient({ userGames: ok([]) });
    mockGetSupabaseClient.mockReturnValue(client);
    const applySyncedGames = jest.fn();

    const untracked = localGame({ id: 'juste-aperçu', inLibrary: false, stopped: false });

    const result = await syncLibrary('user-1', { 'juste-aperçu': untracked }, {}, applySyncedGames);

    expect(result.error).toBeNull();
    expect(calls.inserts).toEqual([]);
  });
});

describe('syncLists — lists/list_games', () => {
  test("sans client configuré : erreur explicite, aucun appel réseau", async () => {
    mockGetSupabaseClient.mockReturnValue(null);
    const applySyncedLists = jest.fn();

    const result = await syncLists('user-1', {}, {}, applySyncedLists);

    expect(result.error).not.toBeNull();
    expect(applySyncedLists).not.toHaveBeenCalled();
  });

  test('liste intégrée nouvelle (Favoris) : envoi pur via builtin_key, membres traduits vers leur user_game_id distant', async () => {
    const { client, calls } = makeFakeClient({
      userGames: ok([{ id: 'remote-game-1', igdb_id: null, slug: 'hollow-knight' }]),
      lists: ok([]),
    });
    mockGetSupabaseClient.mockReturnValue(client);
    const applySyncedLists = jest.fn();

    const lists = { favoris: localList({ id: 'favoris', name: 'Favoris', gameIds: ['hollow-knight'] }) };

    const result = await syncLists('user-1', {}, lists, applySyncedLists);

    expect(result.error).toBeNull();
    expect(calls.listInserts).toEqual([
      { user_id: 'user-1', builtin_key: 'favoris', client_key: null, name: 'Favoris', description: null, hidden: false },
    ]);
    expect(calls.listGameUpserts).toEqual([
      [{ list_id: 'nouvelle-liste-1', user_game_id: 'remote-game-1', removed_at: null }],
    ]);
  });

  test('liste utilisateur nouvelle : envoi pur via client_key (jamais builtin_key)', async () => {
    const { client, calls } = makeFakeClient({ userGames: ok([]), lists: ok([]) });
    mockGetSupabaseClient.mockReturnValue(client);
    const applySyncedLists = jest.fn();

    const lists = {
      'a-finir-abc': localList({ id: 'a-finir-abc', name: 'À finir', builtin: false, description: 'ma liste', hidden: true, gameIds: [] }),
    };

    const result = await syncLists('user-1', {}, lists, applySyncedLists);

    expect(result.error).toBeNull();
    expect(calls.listInserts).toEqual([
      { user_id: 'user-1', builtin_key: null, client_key: 'a-finir-abc', name: 'À finir', description: 'ma liste', hidden: true },
    ]);
  });

  test('liste distante sans liste locale correspondante : import pur', async () => {
    const { client } = makeFakeClient({
      userGames: ok([{ id: 'remote-game-1', igdb_id: null, slug: 'zelda-botw' }]),
      lists: ok([
        {
          id: 'remote-list-1',
          builtin_key: null,
          client_key: 'sur-un-autre-appareil',
          name: 'Speedrun',
          description: null,
          hidden: false,
          updated_at: '2026-01-01T00:00:00.000Z',
        },
      ]),
      listGames: ok([{ list_id: 'remote-list-1', user_game_id: 'remote-game-1', removed_at: null, updated_at: '2026-01-01T00:00:00.000Z' }]),
    });
    mockGetSupabaseClient.mockReturnValue(client);
    const applySyncedLists = jest.fn();

    const result = await syncLists('user-1', {}, {}, applySyncedLists);

    expect(result.error).toBeNull();
    expect(applySyncedLists).toHaveBeenCalledTimes(1);
    const [[lists]] = applySyncedLists.mock.calls;
    expect(lists).toEqual([
      {
        id: 'sur-un-autre-appareil',
        name: 'Speedrun',
        builtin: false,
        description: undefined,
        hidden: false,
        updatedAt: Date.parse('2026-01-01T00:00:00.000Z'),
        gameIds: ['zelda-botw'],
        memberships: { 'zelda-botw': { removed: undefined, updatedAt: Date.parse('2026-01-01T00:00:00.000Z') } },
      },
    ]);
  });

  // Conflit réel : métadonnées ET appartenance divergent des deux côtés en
  // même temps, avec un vrai faux client — vérifie que les deux fusions
  // (indépendantes dans merge-policy.ts) sont bien appliquées ensemble.
  test('conflit réel : métadonnées distantes plus récentes gagnent, tombstone local plus récent gagne et corrige le distant', async () => {
    const { client, calls } = makeFakeClient({
      userGames: ok([{ id: 'remote-game-1', igdb_id: null, slug: 'hollow-knight' }]),
      lists: ok([
        {
          id: 'remote-list-1',
          builtin_key: 'favoris',
          client_key: null,
          name: 'Favoris (renommé ailleurs)',
          description: 'Depuis un autre appareil',
          hidden: true,
          updated_at: '2026-03-01T00:00:00.000Z',
        },
      ]),
      listGames: ok([
        { list_id: 'remote-list-1', user_game_id: 'remote-game-1', removed_at: null, updated_at: '2026-01-01T00:00:00.000Z' },
      ]),
    });
    mockGetSupabaseClient.mockReturnValue(client);
    const applySyncedLists = jest.fn();

    const lists = {
      favoris: localList({
        id: 'favoris',
        name: 'Favoris (local)',
        description: 'Local',
        hidden: false,
        updatedAt: Date.parse('2026-01-01T00:00:00.000Z'), // plus ancien que le distant -> métadonnées distantes gagnent
        gameIds: ['hollow-knight'],
        memberships: { 'hollow-knight': { removed: true, updatedAt: Date.parse('2026-02-01T00:00:00.000Z') } }, // plus récent que le distant -> tombstone local gagne
      }),
    };

    const result = await syncLists('user-1', {}, lists, applySyncedLists);

    expect(result.error).toBeNull();
    const [[updatedLists]] = applySyncedLists.mock.calls;
    expect(updatedLists).toEqual([
      expect.objectContaining({
        name: 'Favoris (renommé ailleurs)',
        description: 'Depuis un autre appareil',
        hidden: true,
        gameIds: [], // le tombstone local (plus récent) l'emporte
      }),
    ]);

    // Les métadonnées distantes ont GAGNÉ l'arbitrage : elles décrivent déjà
    // ce même état, donc rien à leur pousser en retour.
    expect(calls.listUpdates).toEqual([]);
    // Le distant doit être corrigé pour refléter le retrait local.
    expect(calls.listGameUpserts).toEqual([
      [{ list_id: 'remote-list-1', user_game_id: 'remote-game-1', removed_at: expect.any(String) }],
    ]);
  });

  test('rien ne diverge : aucune écriture locale ni distante', async () => {
    const { client, calls } = makeFakeClient({
      userGames: ok([{ id: 'remote-game-1', igdb_id: null, slug: 'hollow-knight' }]),
      lists: ok([
        {
          id: 'remote-list-1',
          builtin_key: 'favoris',
          client_key: null,
          name: 'Favoris',
          description: null,
          hidden: false,
          updated_at: '2026-01-01T00:00:00.000Z',
        },
      ]),
      listGames: ok([
        { list_id: 'remote-list-1', user_game_id: 'remote-game-1', removed_at: null, updated_at: '2026-01-01T00:00:00.000Z' },
      ]),
    });
    mockGetSupabaseClient.mockReturnValue(client);
    const applySyncedLists = jest.fn();

    const lists = {
      favoris: localList({ id: 'favoris', name: 'Favoris', gameIds: ['hollow-knight'] }),
    };

    const result = await syncLists('user-1', {}, lists, applySyncedLists);

    expect(result.error).toBeNull();
    expect(applySyncedLists).not.toHaveBeenCalled();
    expect(calls.listUpdates).toEqual([]);
    expect(calls.listGameUpserts).toEqual([]);
  });

  test('métadonnées locales plus récentes -> le distant est corrigé pour les refléter', async () => {
    const { client, calls } = makeFakeClient({
      userGames: ok([{ id: 'remote-game-1', igdb_id: null, slug: 'hollow-knight' }]),
      lists: ok([
        {
          id: 'remote-list-1',
          builtin_key: 'favoris',
          client_key: null,
          name: 'Favoris (ancien nom distant)',
          description: null,
          hidden: false,
          updated_at: '2026-01-01T00:00:00.000Z',
        },
      ]),
      listGames: ok([
        { list_id: 'remote-list-1', user_game_id: 'remote-game-1', removed_at: null, updated_at: '2026-01-01T00:00:00.000Z' },
      ]),
    });
    mockGetSupabaseClient.mockReturnValue(client);
    const applySyncedLists = jest.fn();

    const lists = {
      favoris: localList({
        id: 'favoris',
        name: 'Favoris (renommé ici)',
        description: 'Ajoutée localement',
        hidden: true,
        updatedAt: Date.parse('2026-02-01T00:00:00.000Z'), // plus récent que le distant
        gameIds: ['hollow-knight'],
      }),
    };

    const result = await syncLists('user-1', {}, lists, applySyncedLists);

    expect(result.error).toBeNull();
    expect(calls.listUpdates).toEqual([
      { id: 'remote-list-1', patch: { name: 'Favoris (renommé ici)', description: 'Ajoutée localement', hidden: true } },
    ]);
  });

  // Deux appareils peuvent légitimement produire deux ids locaux différents
  // pour LE MÊME jeu (même raisonnement que gameMatchKey côté syncLibrary) :
  // ici, CET appareil connaît déjà ce jeu sous un id différent du `slug`
  // distant — la traduction doit utiliser SON id à lui, jamais celui d'un
  // autre appareil, sans quoi la liste référencerait un id que ce store ne
  // reconnaît pas comme celui du jeu qu'il connaît déjà.
  test('traduction user_game_id -> id local : utilise l’id LOCAL déjà connu, pas le slug distant d’un autre appareil', async () => {
    const { client, calls } = makeFakeClient({
      userGames: ok([{ id: 'remote-game-1', igdb_id: 42, slug: 'slug-cree-par-un-autre-appareil' }]),
      lists: ok([]),
    });
    mockGetSupabaseClient.mockReturnValue(client);
    const applySyncedLists = jest.fn();

    // Ce jeu existe déjà localement sous un id DIFFÉRENT, mais avec le MÊME
    // igdbId -> gameMatchKey doit les faire correspondre.
    const localGames = { 'mon-id-a-moi': localGame({ id: 'mon-id-a-moi', igdbId: 42 }) };
    const lists = { favoris: localList({ id: 'favoris', name: 'Favoris', gameIds: ['mon-id-a-moi'] }) };

    const result = await syncLists('user-1', localGames, lists, applySyncedLists);

    expect(result.error).toBeNull();
    expect(calls.listGameUpserts).toEqual([
      [{ list_id: 'nouvelle-liste-1', user_game_id: 'remote-game-1', removed_at: null }],
    ]);
  });
});
