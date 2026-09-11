// Logique pure (réseau + décision) extraite de profile/index.tsx et
// exportée nommément pour être testable sans rendre l'écran (RTL n'est pas
// en place ici, voir chantier CI/Playwright) — le flux complet
// importSteamLibrary reste vérifié manuellement via Playwright.
import { fetchIgdbMatchForSteamAppId, isSteamAppIdKnown } from '../index';
import type { StoredGame } from '@/lib/game-store';

// apiUrl (voir @/lib/api-url) résout l'URL de l'API à partir du runtime Expo
// (Constants.expoConfig, Platform.OS), absent sous Jest — sans ce mock, elle
// lève avant même d'appeler fetch, et l'erreur se retrouve absorbée par le
// try/catch de fetchIgdbMatchForSteamAppId (silencieusement traitée comme
// "pas de correspondance"). Le chemin exact de l'URL n'est pas ce que ce
// test vérifie, donc un passthrough simple suffit. jest.mock est hoisté par
// Babel au-dessus des imports quelle que soit sa position dans le fichier.
jest.mock('@/lib/api-url', () => ({ apiUrl: (path: string) => path }));

function makeGame(overrides: Partial<StoredGame> = {}): StoredGame {
  return {
    id: 'some-id',
    title: 'Un jeu',
    platform: 'PC',
    inLibrary: false,
    stopped: false,
    achievements: [],
    playSessions: [],
    ...overrides,
  };
}

describe('isSteamAppIdKnown', () => {
  test('faux quand aucun jeu du store ne porte ce steamAppId', () => {
    const games = { a: makeGame({ id: 'a', steamAppId: 111 }) };
    expect(isSteamAppIdKnown(games, 222)).toBe(false);
  });

  test('vrai même si le jeu connu a déjà des heures suivies (pas seulement les jeux non suivis)', () => {
    const games = {
      a: makeGame({
        id: 'a',
        steamAppId: 111,
        playSessions: [{ date: '2024-01-01T00:00:00.000Z', hours: 5, clientKey: 'k0' }],
      }),
    };
    expect(isSteamAppIdKnown(games, 111)).toBe(true);
  });
});

describe('fetchIgdbMatchForSteamAppId', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  test('renvoie id/title/platform quand IGDB trouve une correspondance unique', async () => {
    global.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({ title: 'Hollow Knight', platform: 'PC', steamAppId: 367520, ambiguous: false }),
    })) as unknown as typeof fetch;

    const result = await fetchIgdbMatchForSteamAppId(367520);

    expect(result).toEqual({ id: 'hollow-knight', title: 'Hollow Knight', platform: 'PC' });
  });

  test('renvoie undefined quand la route signale une ambiguïté, sans deviner', async () => {
    global.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({ title: null, platform: null, steamAppId: null, ambiguous: true }),
    })) as unknown as typeof fetch;

    const result = await fetchIgdbMatchForSteamAppId(22222);

    expect(result).toBeUndefined();
  });

  test('renvoie undefined quand aucune correspondance IGDB', async () => {
    global.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({ title: null, platform: null, steamAppId: null, ambiguous: false }),
    })) as unknown as typeof fetch;

    const result = await fetchIgdbMatchForSteamAppId(11111);

    expect(result).toBeUndefined();
  });

  test('renvoie undefined (jamais une exception) si la requête réseau échoue', async () => {
    global.fetch = jest.fn(async () => {
      throw new Error('network down');
    }) as unknown as typeof fetch;

    const result = await fetchIgdbMatchForSteamAppId(99999);

    expect(result).toBeUndefined();
  });
});
