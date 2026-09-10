// La connexion est désormais un prérequis pour atteindre l'app (voir
// AuthGate, ARCHITECTURE.md §9.7) : il n'y a plus de mode "essayer sans
// compte" à amorcer avec des jeux de démonstration. Ce test vérifie que le
// tout premier lancement (aucun contenu AsyncStorage — le mock natif par
// défaut de jest-expo se comporte déjà ainsi, voir game-store-identity.test
// pour le même harnais sans mock explicite) part d'une bibliothèque
// entièrement vide, pas des six jeux de démo (Hollow Knight, Elden Ring,
// Celeste, Hades, Zelda BOTW, Stardew Valley) que seedStore préchargeait
// avant.
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
  await act(async () => {
    create(
      <GameStoreProvider>
        <TestConsumer capture={(s) => (latest = s)} />
      </GameStoreProvider>
    );
    await Promise.resolve();
  });
  return () => latest;
}

const FORMER_DEMO_GAME_IDS = [
  'hollow-knight',
  'elden-ring',
  'celeste',
  'hades',
  'zelda-botw',
  'stardew-valley',
];

test('premier lancement : la bibliothèque est vide, aucun jeu de démo précréé', async () => {
  const store = await mountStore();
  expect(Object.keys(store().games)).toHaveLength(0);
  for (const id of FORMER_DEMO_GAME_IDS) {
    expect(store().games[id]).toBeUndefined();
  }
});

test('premier lancement : les listes intégrées existent toujours (Favoris/Wishlist), vides', async () => {
  const store = await mountStore();
  expect(store().lists.favoris?.gameIds).toEqual([]);
  expect(store().lists.wishlist?.gameIds).toEqual([]);
});
