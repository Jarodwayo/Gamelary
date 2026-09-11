import { expect, test, type Page } from '@playwright/test';

import { seedSignedInSession } from './auth-helpers';

// Formalise les deux scénarios vérifiés manuellement en ad hoc lors de la
// mise en place de l'import de bibliothèque Steam (voir profile/index.tsx) :
// mêmes mocks, mêmes assertions, mais rejouables en CI plutôt que des
// scripts jetables.

const SEED_STATE = {
  games: {
    'test-untracked': {
      id: 'test-untracked',
      title: 'Test Untracked Game',
      platform: 'PC',
      steamAppId: 111,
      inLibrary: false,
      stopped: false,
      achievements: [],
      playSessions: [],
    },
    'test-tracked': {
      id: 'test-tracked',
      title: 'Test Tracked Game',
      platform: 'PlayStation 5',
      steamAppId: 222,
      inLibrary: true,
      stopped: false,
      achievements: [],
      playSessions: [{ date: '2024-01-01T00:00:00.000Z', hours: 5 }],
    },
  },
  lists: {
    favoris: { id: 'favoris', name: 'Favoris', builtin: true, gameIds: [] },
    wishlist: { id: 'wishlist', name: 'Wishlist', builtin: true, gameIds: [] },
  },
  settings: { steamId64: '76561197960287930' },
};

// addInitScript s'exécute avant tout script de la page, à chaque navigation
// dans ce contexte — pas besoin de naviguer une première fois "à vide" pour
// pouvoir écrire dans localStorage avant que l'app démarre (contrairement
// aux scripts ad hoc précédents, qui devaient faire goto -> set -> reload).
async function seedGameStore(page: Page) {
  await page.addInitScript((state) => {
    localStorage.setItem('gamelary/game-store/v5', JSON.stringify(state));
  }, SEED_STATE);
}

async function mockSteamGames(page: Page, body: unknown) {
  await page.route('**/api/steam/games**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) })
  );
}

async function importAndWait(page: Page) {
  await page.goto('/profile');
  await page.getByText('Importer ma bibliothèque Steam').scrollIntoViewIfNeeded();
  await page.getByText('Importer ma bibliothèque Steam').click();
  await expect(page.getByText('Import en cours')).toHaveCount(0, { timeout: 15_000 });
}

// Contrairement à mockSteamGames (qui tient lieu de gamelary-api, service
// externe jamais démarré par ce webServer) : /api/games est une vraie route
// expo-router de CE projet (games+api.ts), servie par le même serveur Metro
// que la page — mockée ici uniquement pour ne pas dépendre de la vraie API
// IGDB externe (données non déterministes) dans un test committé, comme
// gamelary-api.test.invalid le fait déjà pour Steam côté webServer config.
async function mockIgdbSteamAppIdLookup(page: Page, appid: number, body: unknown) {
  await page.route(`**/api/games?steamAppId=${appid}`, (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) })
  );
}

// AuthGate (voir ARCHITECTURE.md §9.7) bloque tout écran tant que
// `signedIn` n'est pas atteint : chaque test de ce fichier a besoin d'une
// session déjà valide pour atteindre le Profil qu'il teste réellement.
test.beforeEach(async ({ page }) => {
  await seedSignedInSession(page);
});

test('succès avec jeux mixtes : complète le jeu non suivi, ne touche jamais aux heures déjà suivies', async ({
  page,
}) => {
  await seedGameStore(page);
  await mockSteamGames(page, {
    games: [
      { appid: 111, name: 'Test Untracked Game', playtimeMinutes: 600 },
      { appid: 222, name: 'Test Tracked Game', playtimeMinutes: 1200 },
      { appid: 999, name: 'Unrelated Game Not In Catalog', playtimeMinutes: 300 },
    ],
  });

  await importAndWait(page);

  await expect(page.getByText('1 jeu complété avec le temps de jeu Steam.')).toBeVisible();

  const games = await page.evaluate(
    () => JSON.parse(localStorage.getItem('gamelary/game-store/v5')!).games
  );

  // Jeu non suivi : complété avec le temps de jeu Steam (600 min = 10h) et
  // ajouté à la bibliothèque. `clientKey` (voir types/game.ts, ARCHITECTURE.md
  // §9.5) est assigné à la création par setTotalHours, jamais prévisible.
  expect(games['test-untracked'].playSessions).toEqual([
    { date: expect.any(String), hours: 10, clientKey: expect.any(String) },
  ]);
  expect(games['test-untracked'].inLibrary).toBe(true);

  // Le piège verrouillé : un jeu déjà suivi (ici PS5, steamAppId présent par
  // coïncidence) ne doit JAMAIS être écrasé par le temps de jeu Steam,
  // strictement inchangé. `clientKey` est comblé par la migration de forme au
  // chargement (voir store-migrations.ts) : absent du seed, présent ici.
  expect(games['test-tracked'].playSessions).toEqual([
    { date: '2024-01-01T00:00:00.000Z', hours: 5, clientKey: expect.any(String) },
  ]);
});

test('jeu Steam inconnu du catalogue : résolu via la route IGDB de Gamelary puis créé, temps de jeu importé', async ({
  page,
}) => {
  // Scénario complet jamais couvert bout-en-bout jusqu'ici (voir
  // fetchIgdbMatchForSteamAppId, profile/index.tsx) : un jeu Steam que ni la
  // bibliothèque ni le catalogue Gamelary ne connaissent encore (contraste
  // avec 'test-untracked'/'test-tracked' du scénario ci-dessus, déjà dans le
  // catalogue) doit déclencher la résolution IGDB (registerCatalogGame),
  // créer l'entrée de catalogue correspondante, puis lui appliquer le même
  // traitement que les jeux déjà connus (temps de jeu + ajout à la
  // bibliothèque).
  await seedGameStore(page);
  await mockSteamGames(page, {
    games: [{ appid: 555, name: 'Test New Game', playtimeMinutes: 900 }],
  });
  await mockIgdbSteamAppIdLookup(page, 555, {
    title: 'Test New Game',
    platform: 'PC',
    steamAppId: 555,
    ambiguous: false,
  });

  await importAndWait(page);

  await expect(page.getByText('1 jeu complété avec le temps de jeu Steam.')).toBeVisible();

  const store = await page.evaluate(
    () => JSON.parse(localStorage.getItem('gamelary/game-store/v5')!) as typeof SEED_STATE & {
      games: Record<string, unknown>;
    }
  );

  // resolveCatalogId('Test New Game') retombe sur slugify (aucune piste
  // tracked-games.ts sous ce titre) : 'test-new-game'.
  const created = store.games['test-new-game'];
  expect(created).toMatchObject({
    id: 'test-new-game',
    title: 'Test New Game',
    platform: 'PC',
    steamAppId: 555,
    inLibrary: true,
  });
  expect((created as { playSessions: unknown }).playSessions).toEqual([
    { date: expect.any(String), hours: 15, clientKey: expect.any(String) },
  ]);
});

test('bibliothèque Steam vide (profil privé) : message explicite, rien de modifié silencieusement', async ({
  page,
}) => {
  await seedGameStore(page);
  await mockSteamGames(page, { games: [] });

  await importAndWait(page);

  await expect(
    page.getByText(
      'Rien à compléter : aucun jeu Steam sans heures déjà suivies ne correspond à ta bibliothèque Gamelary.'
    )
  ).toBeVisible();

  const games = await page.evaluate(
    () => JSON.parse(localStorage.getItem('gamelary/game-store/v5')!).games
  );
  expect(games['test-untracked'].playSessions).toEqual([]);
  expect(games['test-untracked'].inLibrary).toBe(false);
  expect(games['test-tracked'].playSessions).toEqual([
    { date: '2024-01-01T00:00:00.000Z', hours: 5, clientKey: expect.any(String) },
  ]);
});
