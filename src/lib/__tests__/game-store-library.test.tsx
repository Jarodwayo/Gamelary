// removeFromLibrary (game-store.tsx) : pendant symétrique d'addToLibrary,
// pour le bouton "Retirer de ma bibliothèque" de la fiche jeu
// (library/[id].tsx). Le point qui mérite un test dédié : ce retrait ne
// doit JAMAIS effacer les autres données utilisateur (note, avis, succès,
// "arrêté de jouer") — c'est précisément ce qui garde un jeu synchronisé
// (isSyncWorthy, sync-service.ts, voir aussi sync-service.test.ts) après
// un retrait de bibliothèque, tant que l'un de ces signaux subsiste.
import { act, create } from 'react-test-renderer';

import { GameStoreProvider, useGameStore } from '../game-store';

type Store = ReturnType<typeof useGameStore>;

function TestConsumer({ capture }: { capture: (store: Store) => void }) {
  const store = useGameStore();
  capture(store);
  return null;
}

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

const CATALOG_GAME = { id: 'jeu-test', title: 'Jeu Test', platform: 'PC' };

test('retire bien inLibrary, symétrique à addToLibrary', async () => {
  const store = await mountStore();

  act(() => {
    store().registerCatalogGame(CATALOG_GAME);
    store().addToLibrary('jeu-test');
  });
  expect(store().games['jeu-test'].inLibrary).toBe(true);

  act(() => {
    store().removeFromLibrary('jeu-test');
  });
  expect(store().games['jeu-test'].inLibrary).toBe(false);
});

test('idempotent : retirer un jeu déjà absent de la bibliothèque ne fait rien', async () => {
  const store = await mountStore();

  act(() => {
    store().registerCatalogGame(CATALOG_GAME);
  });
  expect(store().games['jeu-test'].inLibrary).toBe(false);
  expect(store().games['jeu-test'].updatedAt).toBeUndefined();

  act(() => {
    store().removeFromLibrary('jeu-test');
  });
  // Même garde qu'addToLibrary (voir son commentaire) : un no-op ne doit
  // jamais horodater, sous peine de faire gagner l'arbitrage §9.5 à un
  // appareil qui n'a pourtant rien changé.
  expect(store().games['jeu-test'].inLibrary).toBe(false);
  expect(store().games['jeu-test'].updatedAt).toBeUndefined();
});

test('id inconnu : ne plante pas, ne crée rien', async () => {
  const store = await mountStore();

  expect(() => {
    act(() => {
      store().removeFromLibrary('jeu-jamais-vu');
    });
  }).not.toThrow();
  expect(store().games['jeu-jamais-vu']).toBeUndefined();
});

test("ne touche jamais stopped/rating/review/achievements : le jeu reste synchronisable après le retrait", async () => {
  const store = await mountStore();

  act(() => {
    store().registerCatalogGame(CATALOG_GAME);
    store().addToLibrary('jeu-test');
    store().toggleStopped('jeu-test');
    store().setRating('jeu-test', 16);
    store().setReview('jeu-test', 'Très bon jeu.');
    store().addAchievement('jeu-test', 'Premier succès');
  });

  const beforeRemoval = store().games['jeu-test'];
  expect(beforeRemoval.stopped).toBe(true);
  expect(beforeRemoval.rating).toBe(16);
  expect(beforeRemoval.review).toBe('Très bon jeu.');
  expect(beforeRemoval.achievements).toHaveLength(1);

  act(() => {
    store().removeFromLibrary('jeu-test');
  });

  const afterRemoval = store().games['jeu-test'];
  expect(afterRemoval.inLibrary).toBe(false);
  // Rien d'autre n'a bougé : mêmes valeurs qu'avant le retrait.
  expect(afterRemoval.stopped).toBe(true);
  expect(afterRemoval.rating).toBe(16);
  expect(afterRemoval.review).toBe('Très bon jeu.');
  expect(afterRemoval.achievements).toEqual(beforeRemoval.achievements);
});
