// Couvre le chemin d'écriture DÉDIÉ au service de synchronisation
// (applySyncedGames, voir game-store.tsx et lib/sync/sync-service.ts) : la
// seule action de tout le store qui n'horodate PAS automatiquement à
// `Date.now()` — parce que la valeur qu'elle écrit vient déjà d'une fusion
// (mergeGameFields) qui a elle-même déjà décidé quel horodatage est le bon.
// La rendre équivalente à updateGame (horodatage automatique) romprait
// silencieusement l'arbitrage §9.5 à la toute prochaine synchronisation.
import { act, create } from 'react-test-renderer';

import { GameStoreProvider, useGameStore, type StoredGame } from '../game-store';

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
  await act(async () => {
    await Promise.resolve();
  });
  return () => latest;
}

function syncedGame(overrides: Partial<StoredGame> = {}): StoredGame {
  return {
    id: 'jeu-synchronise-test',
    title: 'Jeu Synchronisé Test',
    platform: 'PC',
    inLibrary: true,
    stopped: false,
    achievements: [],
    playSessions: [],
    ...overrides,
  };
}

test('applySyncedGames crée un jeu absent du store local (import pur depuis le distant)', async () => {
  const store = await mountStore();
  expect(store().games['jeu-synchronise-test']).toBeUndefined();

  act(() => {
    store().applySyncedGames([syncedGame({ updatedAt: 1_700_000_000_000 })]);
  });

  expect(store().games['jeu-synchronise-test']).toEqual(syncedGame({ updatedAt: 1_700_000_000_000 }));
});

test("applySyncedGames écrase le jeu existant avec l'état fusionné, SANS jamais poser Date.now()", async () => {
  const nowSpy = jest.spyOn(Date, 'now').mockImplementation(() => 9_999_999_999_999);
  try {
    const store = await mountStore();

    act(() => {
      store().registerCatalogGame({ id: 'jeu-synchronise-test', title: 'Jeu Synchronisé Test', platform: 'PC' });
      store().addToLibrary('jeu-synchronise-test');
    });

    // La fusion a déjà tranché un horodatage PASSÉ (celui du côté gagnant) :
    // s'il devenait Date.now() au passage, l'appareil qui vient de
    // synchroniser gagnerait à tort le prochain arbitrage §9.5, quel que
    // soit le côté réellement le plus récent.
    const merged = syncedGame({ inLibrary: true, rating: 18, updatedAt: 1_234_000_000_000 });

    act(() => {
      store().applySyncedGames([merged]);
    });

    expect(store().games['jeu-synchronise-test']).toEqual(merged);
    expect(store().games['jeu-synchronise-test'].updatedAt).not.toBe(9_999_999_999_999);
  } finally {
    nowSpy.mockRestore();
  }
});

test("applySyncedGames peut écrire un jeu SANS updatedAt (fusion jamais arbitrée faute d'horodatage local)", async () => {
  const store = await mountStore();

  act(() => {
    store().applySyncedGames([syncedGame({ updatedAt: undefined })]);
  });

  expect(store().games['jeu-synchronise-test'].updatedAt).toBeUndefined();
});

test('applySyncedGames avec une liste vide ne modifie rien (pas de re-render/écriture inutile)', async () => {
  const store = await mountStore();

  act(() => {
    store().registerCatalogGame({ id: 'jeu-synchronise-test', title: 'Jeu Synchronisé Test', platform: 'PC' });
  });
  const before = store().games;

  act(() => {
    store().applySyncedGames([]);
  });

  expect(store().games).toBe(before);
});

test('applySyncedGames met à jour plusieurs jeux en un seul passage', async () => {
  const store = await mountStore();

  act(() => {
    store().applySyncedGames([
      syncedGame({ id: 'hollow-knight', title: 'Hollow Knight' }),
      syncedGame({ id: 'zelda-botw', title: 'Zelda: Breath of the Wild' }),
    ]);
  });

  expect(store().games['hollow-knight'].title).toBe('Hollow Knight');
  expect(store().games['zelda-botw'].title).toBe('Zelda: Breath of the Wild');
});
