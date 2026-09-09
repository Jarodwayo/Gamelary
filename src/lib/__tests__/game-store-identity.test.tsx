// Couvre les deux prérequis restants de la §9.3 (ARCHITECTURE.md) :
// l'identité canonique IGDB stockée à côté du slug local, et l'horodatage
// posé à chaque mutation d'un jeu. Les deux ne servent à rien aujourd'hui —
// ils ne servent qu'à la synchronisation à venir (§9.5) — donc rien dans
// l'app ne casserait visiblement s'ils cessaient de fonctionner : c'est
// précisément pour ça qu'ils ont besoin de tests.
// Même harnais que game-store-batching.test.tsx : react-test-renderer, déjà
// présent via jest-expo, suffit pour piloter le provider.
import { act, create } from 'react-test-renderer';

import { GameStoreProvider, useGameStore } from '../game-store';

type Store = ReturnType<typeof useGameStore>;

function TestConsumer({ capture }: { capture: (store: Store) => void }) {
  const store = useGameStore();
  capture(store);
  return null;
}

// Date.now avance d'une seconde à chaque lecture. Sans ça, deux mutations
// successives tombent dans la même milliseconde et un test "l'horodatage a
// changé" passerait même contre un code qui ne l'écrit qu'une fois — le
// même piège que celui rencontré sur les tests d'idempotence de la
// migration (voir store-migrations.test.ts).
let now = 1_700_000_000_000;
let nowSpy: jest.SpyInstance;

beforeEach(() => {
  now = 1_700_000_000_000;
  nowSpy = jest.spyOn(Date, 'now').mockImplementation(() => (now += 1000));
});

afterEach(() => {
  nowSpy.mockRestore();
});

async function mountStore(): Promise<() => Store> {
  let latest!: Store;
  act(() => {
    create(
      <GameStoreProvider>
        <TestConsumer capture={(s) => (latest = s)} />
      </GameStoreProvider>
    );
  });
  // Laisse le chargement AsyncStorage initial se résoudre (voir
  // game-store.tsx) avant que le test ne commence à muter l'état.
  await act(async () => {
    await Promise.resolve();
  });
  return () => latest;
}

const CATALOG_GAME = { id: 'jeu-test', title: 'Jeu Test', platform: 'PC', steamAppId: 42, igdbId: 1234 };

test("registerCatalogGame conserve l'id IGDB à la création", async () => {
  const store = await mountStore();

  act(() => {
    store().registerCatalogGame(CATALOG_GAME);
  });

  expect(store().games['jeu-test'].igdbId).toBe(1234);
  // L'id local reste le slug : l'identité IGDB est transportée À CÔTÉ, pas à
  // la place (les ids de tracked-games.ts sont écrits en dur, et le schéma
  // distant garde lui aussi les deux — voir §9.4).
  expect(store().games['jeu-test'].id).toBe('jeu-test');
});

test("un jeu déjà stocké sans id IGDB le gagne quand une résolution le fournit", async () => {
  // Le vrai cas de bascule : toutes les bibliothèques existantes ont été
  // écrites avant l'introduction du champ. Si la garde "rien n'a changé" de
  // registerCatalogGame ne compare pas l'igdbId, elle court-circuite dès que
  // titre/plateforme/appid sont déjà à jour — et ces jeux-là n'obtiennent
  // JAMAIS leur identité canonique, sans que rien ne le signale.
  const store = await mountStore();

  act(() => {
    store().registerCatalogGame({ id: 'jeu-test', title: 'Jeu Test', platform: 'PC', steamAppId: 42 });
  });
  expect(store().games['jeu-test'].igdbId).toBeUndefined();

  act(() => {
    store().registerCatalogGame(CATALOG_GAME);
  });

  expect(store().games['jeu-test'].igdbId).toBe(1234);
});

test("une résolution sans id IGDB n'efface pas celui déjà connu, et n'écrit rien", async () => {
  // Un jeu qui perd son identité canonique devrait être re-résolu à
  // l'aveugle depuis son titre (§9.3) : une réponse IGDB dégradée ne doit
  // jamais la faire disparaître. Et comme rien ne change réellement,
  // l'horodatage ne doit pas bouger non plus.
  const store = await mountStore();

  act(() => {
    store().registerCatalogGame(CATALOG_GAME);
  });
  const stampAfterCreate = store().games['jeu-test'].updatedAt;

  act(() => {
    store().registerCatalogGame({ id: 'jeu-test', title: 'Jeu Test', platform: 'PC', steamAppId: 42 });
  });

  expect(store().games['jeu-test'].igdbId).toBe(1234);
  expect(store().games['jeu-test'].updatedAt).toBe(stampAfterCreate);
});

// Chaque mutation d'un jeu doit avancer son updatedAt. Écrit comme une table
// plutôt qu'en neuf tests copiés : une action ajoutée plus tard sans
// horodatage se repère en ajoutant sa ligne ici, et l'oubli devient visible
// au lieu de rester silencieux jusqu'à la première synchronisation.
const MUTATIONS: [string, (store: Store) => void][] = [
  ['addToLibrary', (s) => s.addToLibrary('jeu-test')],
  ['toggleStopped', (s) => s.toggleStopped('jeu-test')],
  ['setTotalHours', (s) => s.setTotalHours('jeu-test', 12)],
  ['setRating', (s) => s.setRating('jeu-test', 15)],
  ['setReview', (s) => s.setReview('jeu-test', 'Très bon')],
  ['addAchievement', (s) => s.addAchievement('jeu-test', 'Premier succès')],
  ['importAchievements', (s) => s.importAchievements('jeu-test', [{ apiname: 'ACH_1', name: 'Un', unlocked: true }])],
  ['setFavoriteTrack', (s) => s.setFavoriteTrack('jeu-test', 'piste-1')],
  [
    'registerCatalogGame (mise à jour réelle)',
    (s) => s.registerCatalogGame({ ...CATALOG_GAME, platform: 'PlayStation 5' }),
  ],
];

test.each(MUTATIONS)('%s horodate le jeu', async (_label, mutate) => {
  const store = await mountStore();

  act(() => {
    store().registerCatalogGame(CATALOG_GAME);
  });
  const before = store().games['jeu-test'].updatedAt;
  expect(before).toBeDefined();

  act(() => {
    mutate(store());
  });

  expect(store().games['jeu-test'].updatedAt).toBeGreaterThan(before!);
});

test('toggleAchievement horodate le jeu', async () => {
  // À part des autres : a besoin d'un succès existant, dont l'id n'est connu
  // qu'après coup (makeAchievementId).
  const store = await mountStore();

  act(() => {
    store().registerCatalogGame(CATALOG_GAME);
    store().addAchievement('jeu-test', 'Premier succès');
  });
  const before = store().games['jeu-test'].updatedAt!;
  const achievementId = store().games['jeu-test'].achievements[0].id;

  act(() => {
    store().toggleAchievement('jeu-test', achievementId);
  });

  expect(store().games['jeu-test'].achievements[0].unlocked).toBe(true);
  expect(store().games['jeu-test'].updatedAt).toBeGreaterThan(before);
});

// L'autre moitié de la règle, et la plus facile à casser : une action qui
// ne change rien ne doit PAS horodater. Un appareil qui se contente de
// relire sa bibliothèque gagnerait sinon l'arbitrage "le plus récent gagne"
// (§9.5) face à un appareil qui, lui, a réellement modifié la donnée.
const NO_OPS: [string, (store: Store) => void][] = [
  ['addToLibrary sur un jeu déjà dans la bibliothèque', (s) => s.addToLibrary('jeu-test')],
  ['setTotalHours avec le total déjà atteint', (s) => s.setTotalHours('jeu-test', 12)],
  ['registerCatalogGame avec des données identiques', (s) => s.registerCatalogGame(CATALOG_GAME)],
];

test.each(NO_OPS)("%s n'horodate pas", async (_label, mutate) => {
  const store = await mountStore();

  act(() => {
    store().registerCatalogGame(CATALOG_GAME);
    store().addToLibrary('jeu-test');
    store().setTotalHours('jeu-test', 12);
  });
  const before = store().games['jeu-test'].updatedAt!;

  act(() => {
    mutate(store());
  });

  expect(store().games['jeu-test'].updatedAt).toBe(before);
});

test("l'appartenance à une liste n'horodate pas le jeu", async () => {
  // Choix délibéré, pas un oubli : les listes fusionnent par UNION (§9.5),
  // jamais par récence — leur schéma distant ne porte d'ailleurs pas
  // d'updated_at (§9.4). Rien à arbitrer, donc rien à horodater.
  const store = await mountStore();

  act(() => {
    store().registerCatalogGame(CATALOG_GAME);
  });
  const before = store().games['jeu-test'].updatedAt!;

  act(() => {
    store().toggleListMembership('favoris', 'jeu-test');
  });

  expect(store().lists.favoris.gameIds).toContain('jeu-test');
  expect(store().games['jeu-test'].updatedAt).toBe(before);
});
