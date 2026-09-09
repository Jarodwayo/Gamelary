// Route expo-router appelée directement (même approche que
// games-steam-appid.test.ts, voir ../cover+api.ts) : ce fichier verrouille
// le paramètre `kind` ajouté pour le réglage "Affiche de la page titre" —
// quel endpoint SteamGridDB est interrogé selon le format demandé, et le
// fait que les trois formats ne partagent pas leur entrée de cache.
import { GET } from '../cover+api';

const originalFetch = global.fetch;

afterEach(() => {
  global.fetch = originalFetch;
});

beforeEach(() => {
  process.env.STEAMGRIDDB_API_KEY = 'test-sgdb-key';
});

// Mémorise les URL appelées pour pouvoir affirmer QUEL endpoint a servi,
// pas seulement que la réponse est correcte.
function mockSteamGridDb(artworkUrl: string | null) {
  const calls: string[] = [];
  global.fetch = jest.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    calls.push(url);
    if (url.includes('/games/steam/')) {
      return { ok: true, status: 200, json: async () => ({ success: true, data: { id: 7545 } }) };
    }
    return {
      ok: true,
      status: 200,
      json: async () => ({ data: artworkUrl ? [{ url: artworkUrl, thumb: artworkUrl }] : [] }),
    };
  }) as unknown as typeof fetch;
  return calls;
}

function request(query: string): Request {
  return new Request(`http://localhost/api/cover?${query}`);
}

test('sans "kind", sert la jaquette portrait comme avant l\'ajout du réglage', async () => {
  const calls = mockSteamGridDb('https://cdn2.steamgriddb.com/grid/a.png');

  const res = await GET(request('title=Sans%20Kind&steamAppId=101'));

  expect(res.status).toBe(200);
  await expect(res.json()).resolves.toEqual({ url: 'https://cdn2.steamgriddb.com/grid/a.png' });
  expect(calls.some((url) => url.includes('/grids/game/7545'))).toBe(true);
});

test('kind=hero interroge les bandeaux larges, kind=logo les logos', async () => {
  const heroCalls = mockSteamGridDb('https://cdn2.steamgriddb.com/hero/b.png');
  const heroRes = await GET(request('title=Avec%20Hero&steamAppId=102&kind=hero'));

  expect(heroRes.status).toBe(200);
  await expect(heroRes.json()).resolves.toEqual({ url: 'https://cdn2.steamgriddb.com/hero/b.png' });
  expect(heroCalls.some((url) => url.includes('/heroes/game/7545'))).toBe(true);

  const logoCalls = mockSteamGridDb('https://cdn2.steamgriddb.com/logo/c.png');
  const logoRes = await GET(request('title=Avec%20Logo&steamAppId=103&kind=logo'));

  expect(logoRes.status).toBe(200);
  await expect(logoRes.json()).resolves.toEqual({ url: 'https://cdn2.steamgriddb.com/logo/c.png' });
  expect(logoCalls.some((url) => url.includes('/logos/game/7545'))).toBe(true);
});

test('rejette un "kind" inconnu avec 400 plutôt que de servir une jaquette', async () => {
  global.fetch = jest.fn();

  const res = await GET(request('title=Peu%20Importe&kind=banner'));

  expect(res.status).toBe(400);
  await expect(res.json()).resolves.toEqual({ error: 'Paramètre "kind" invalide' });
  expect(global.fetch).not.toHaveBeenCalled();
});

test('les formats ne partagent pas leur entrée de cache pour un même jeu', async () => {
  // Le cache est indexé par format ET par jeu : sans ça, demander le
  // bandeau après la jaquette du même jeu renverrait la jaquette.
  mockSteamGridDb('https://cdn2.steamgriddb.com/grid/d.png');
  await expect((await GET(request('title=Meme%20Jeu&steamAppId=104'))).json()).resolves.toEqual({
    url: 'https://cdn2.steamgriddb.com/grid/d.png',
  });

  mockSteamGridDb('https://cdn2.steamgriddb.com/hero/d.png');
  await expect(
    (await GET(request('title=Meme%20Jeu&steamAppId=104&kind=hero'))).json()
  ).resolves.toEqual({ url: 'https://cdn2.steamgriddb.com/hero/d.png' });
});

test('aucun bandeau pour ce jeu : url null, pas une erreur', async () => {
  // C'est ce cas qui déclenche le repli sur la jaquette côté fiche jeu
  // (voir game-title-header.tsx) — il doit rester une réponse valide.
  mockSteamGridDb(null);

  const res = await GET(request('title=Sans%20Illustration&steamAppId=105&kind=hero'));

  expect(res.status).toBe(200);
  await expect(res.json()).resolves.toEqual({ url: null });
});
