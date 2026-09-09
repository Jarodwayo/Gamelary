// Route expo-router : GET exporté est une simple fonction (Request) =>
// Response, testable en l'appelant directement sous Jest, sans serveur réel
// ni Supertest (voir ../games+api.ts). Fichier hors de src/app/api/ (pas de
// suffixe +api dans son nom) pour ne jamais risquer d'être interprété comme
// une route par expo-router (voir la regex de matching dans
// expo-router/build/getRoutesCore.js).
import { GET } from '../games+api';

const originalFetch = global.fetch;

afterEach(() => {
  global.fetch = originalFetch;
});

beforeEach(() => {
  process.env.IGDB_CLIENT_ID = 'test-client-id';
  process.env.IGDB_ACCESS_TOKEN = 'test-access-token';
});

function mockIgdbGamesFetch(games: unknown[], status = 200) {
  global.fetch = jest.fn(async () => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => games,
  })) as unknown as typeof fetch;
}

function request(query: string): Request {
  return new Request(`http://localhost/api/games?${query}`);
}

test('résout un appid Steam vers son jeu IGDB quand la correspondance est unique', async () => {
  mockIgdbGamesFetch([
    {
      name: 'Hollow Knight',
      platforms: [{ name: 'PC' }],
      external_games: [{ uid: '367520', external_game_source: 1 }],
    },
  ]);

  const res = await GET(request('steamAppId=367520'));

  expect(res.status).toBe(200);
  await expect(res.json()).resolves.toEqual({
    title: 'Hollow Knight',
    platform: 'PC',
    steamAppId: 367520,
    ambiguous: false,
  });
});

test('rejette un appid manquant ou invalide avec 400, sans appeler IGDB', async () => {
  global.fetch = jest.fn();

  const resMissing = await GET(new Request('http://localhost/api/games'));
  expect(resMissing.status).toBe(400);

  const resInvalid = await GET(request('steamAppId=abc'));
  expect(resInvalid.status).toBe(400);

  const resNegative = await GET(request('steamAppId=-5'));
  expect(resNegative.status).toBe(400);

  expect(global.fetch).not.toHaveBeenCalled();
});

test('rejette un steamAppId présent mais vide avec 400 (message générique, sans appeler IGDB)', async () => {
  // '?steamAppId=' donne une chaîne vide, falsy comme un paramètre absent :
  // tombe donc sur le même message générique que "aucun des trois paramètres"
  // plutôt que sur "steamAppId invalide" (jamais atteint dans ce cas), voir
  // GET dans ../games+api.ts. Comportement correct mais jusqu'ici jamais
  // vérifié par un test.
  global.fetch = jest.fn();

  const res = await GET(request('steamAppId='));

  expect(res.status).toBe(400);
  await expect(res.json()).resolves.toEqual({
    error: 'Paramètre "title", "section" ou "steamAppId" requis',
  });
  expect(global.fetch).not.toHaveBeenCalled();
});

test('mappe une erreur HTTP IGDB vers 502 sans exposer les identifiants IGDB', async () => {
  mockIgdbGamesFetch([], 500);

  const res = await GET(request('steamAppId=99999'));

  expect(res.status).toBe(502);
  const body = await res.json();
  expect(Object.keys(body)).toEqual(['error']);
  expect(body.error).not.toContain('test-access-token');
  expect(body.error).not.toContain('test-client-id');
});

test('traite une absence de correspondance IGDB comme "non trouvé", pas une erreur', async () => {
  mockIgdbGamesFetch([]);

  const res = await GET(request('steamAppId=11111'));

  expect(res.status).toBe(200);
  await expect(res.json()).resolves.toEqual({
    title: null,
    platform: null,
    steamAppId: null,
    ambiguous: false,
  });
});

test('dédoublonne par nom : deux lignes IGDB redondantes pour le même jeu ne sont pas une ambiguïté', async () => {
  // Contrairement au test d'ambiguïté ci-dessous (deux JEUX distincts), ici
  // les deux entrées external_games renvoyées par IGDB pointent vers le même
  // nom : donnée IGDB incohérente (le même jeu revendique deux fois le même
  // uid Steam), pas deux jeux concurrents — distinctNames doit les fusionner
  // en un seul match plutôt que de signaler ambiguous: true.
  mockIgdbGamesFetch([
    { name: 'Hollow Knight', platforms: [{ name: 'PC' }], external_games: [{ uid: '367521', external_game_source: 1 }] },
    { name: 'Hollow Knight', platforms: [{ name: 'PC' }], external_games: [{ uid: '367521', external_game_source: 1 }] },
  ]);

  const res = await GET(request('steamAppId=367521'));

  expect(res.status).toBe(200);
  await expect(res.json()).resolves.toEqual({
    title: 'Hollow Knight',
    platform: 'PC',
    steamAppId: 367521,
    ambiguous: false,
  });
});

test('signale une ambiguïté quand deux jeux IGDB distincts revendiquent le même appid, sans deviner', async () => {
  mockIgdbGamesFetch([
    { name: 'Jeu A', platforms: [{ name: 'PC' }], external_games: [{ uid: '22222', external_game_source: 1 }] },
    { name: 'Jeu B', platforms: [{ name: 'PC' }], external_games: [{ uid: '22222', external_game_source: 1 }] },
  ]);

  const res = await GET(request('steamAppId=22222'));

  expect(res.status).toBe(200);
  await expect(res.json()).resolves.toEqual({
    title: null,
    platform: null,
    steamAppId: null,
    ambiguous: true,
  });
});
