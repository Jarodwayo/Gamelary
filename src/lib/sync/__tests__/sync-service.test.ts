// syncLibrary est l'orchestration IMPURE de la politique de fusion §9.5
// (merge-policy.ts, déjà mutation-testée séparément) : ce fichier vérifie
// qu'elle lit/écrit Supabase au bon endroit et applique bien le verdict
// calculé — jamais mocké au niveau de merge-policy lui-même, pour garder un
// vrai scénario de conflit à deux appareils de bout en bout (voir le test
// "conflit réel" plus bas).
import { getSupabaseClient } from '@/lib/supabase';
import type { StoredGame } from '@/lib/game-store';

import { syncLibrary } from '../sync-service';

jest.mock('@/lib/supabase', () => ({ getSupabaseClient: jest.fn() }));

const mockGetSupabaseClient = getSupabaseClient as jest.Mock;

type QueryResult<T> = { data: T | null; error: { message: string } | null };

function ok<T>(data: T): QueryResult<T> {
  return { data, error: null };
}

// Fake tailored aux appels RÉELLEMENT faits par sync-service.ts (voir son
// code) plutôt qu'un faux client Supabase générique : select+eq sur
// user_games, select+in sur achievements, insert+select+single pour un
// nouveau jeu, update+eq pour un jeu déjà apparié, upsert pour les succès.
// Même esprit que makeFakeClient (auth-store.test.tsx) — mocker exactement
// ce qui est utilisé, pas réimplémenter le SDK.
function makeFakeClient(config: {
  userGames?: QueryResult<unknown[]>;
  achievements?: QueryResult<unknown[]>;
  insertUserGame?: QueryResult<{ id: string }>;
  updateUserGame?: QueryResult<null>;
  upsertAchievements?: QueryResult<null>;
}) {
  const calls: {
    userGamesSelectUserId?: string;
    achievementsSelectIds?: string[];
    inserts: Record<string, unknown>[];
    updates: { id: string; patch: Record<string, unknown> }[];
    achievementUpserts: Record<string, unknown>[][];
  } = { inserts: [], updates: [], achievementUpserts: [] };

  let insertCounter = 0;

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

  const client = {
    from: jest.fn((table: string) => {
      if (table === 'user_games') return userGamesTable;
      if (table === 'achievements') return achievementsTable;
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

afterEach(() => {
  jest.clearAllMocks();
});

test("sans client configuré : erreur explicite, aucun appel réseau", async () => {
  mockGetSupabaseClient.mockReturnValue(null);
  const applySyncedGames = jest.fn();

  const result = await syncLibrary('user-1', {}, applySyncedGames);

  expect(result.error).not.toBeNull();
  expect(applySyncedGames).not.toHaveBeenCalled();
});

test('une erreur de lecture user_games est remontée telle quelle, rien d’autre ne se passe', async () => {
  const { client } = makeFakeClient({ userGames: { data: null, error: { message: 'Réseau indisponible' } } });
  mockGetSupabaseClient.mockReturnValue(client);
  const applySyncedGames = jest.fn();

  const result = await syncLibrary('user-1', { 'hollow-knight': localGame() }, applySyncedGames);

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

  const result = await syncLibrary('user-1', { 'hollow-knight': local }, applySyncedGames);

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

  const result = await syncLibrary('user-1', {}, applySyncedGames);

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

  const result = await syncLibrary('user-1', { 'hollow-knight': local }, applySyncedGames);

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

  const result = await syncLibrary('user-1', { 'hollow-knight': local }, applySyncedGames);

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

  const result = await syncLibrary('user-1', { 'hollow-knight': local }, applySyncedGames);

  expect(result.error).toBeNull();
  expect(applySyncedGames).not.toHaveBeenCalled();
  expect(calls.updates).toEqual([]);
  expect(calls.achievementUpserts).toEqual([]);
});
