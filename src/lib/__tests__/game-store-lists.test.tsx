// toggleListMembership (game-store.tsx) : seule action "par id" du store à
// ne pas garder le même contrat que ses pairs (setRating, addAchievement,
// toggleStopped...) — elle validait bien la liste (prev.lists[listId]) mais
// jamais le jeu (prev.games[gameId]), acceptant silencieusement n'importe
// quel id dans gameIds/memberships. Repéré lors d'un audit LSP/ISP (voir
// AGENTS.md, "Revue de code : substitution de Liskov et ségrégation des
// interfaces") : une implémentation qui se comporte différemment de ses
// pairs sans que l'appelant n'ait de raison de le deviner.
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

test("id de jeu inexistant : no-op silencieux, même contrat que setRating/addAchievement/toggleStopped", async () => {
  const store = await mountStore();

  // 'favoris' existe déjà dans le seed (voir seedStore, game-store.tsx) :
  // seule la validation du JEU est en jeu ici, pas celle de la liste.
  expect(store().lists.favoris).toBeDefined();
  expect(store().games['jeu-jamais-vu']).toBeUndefined();

  act(() => {
    store().toggleListMembership('favoris', 'jeu-jamais-vu');
  });

  expect(store().lists.favoris.gameIds).toEqual([]);
  expect(store().lists.favoris.memberships ?? {}).toEqual({});
});

test('id de liste ET de jeu valides : bascule normalement (comportement inchangé)', async () => {
  const store = await mountStore();

  act(() => {
    store().registerCatalogGame(CATALOG_GAME);
    store().toggleListMembership('favoris', 'jeu-test');
  });
  expect(store().lists.favoris.gameIds).toEqual(['jeu-test']);

  act(() => {
    store().toggleListMembership('favoris', 'jeu-test');
  });
  expect(store().lists.favoris.gameIds).toEqual([]);
});

test('id de liste inexistant : no-op silencieux (garde déjà existante, inchangée)', async () => {
  const store = await mountStore();

  act(() => {
    store().registerCatalogGame(CATALOG_GAME);
    store().toggleListMembership('liste-jamais-creee', 'jeu-test');
  });

  expect(store().lists['liste-jamais-creee']).toBeUndefined();
});

// renameList/deleteList : réservées aux listes créées par l'utilisateur
// (voir ARCHITECTURE.md « Suppression et renommage d'une liste ») —
// Favoris/Wishlist doivent rester intouchables par ces deux actions, pas
// seulement par l'UI qui ne propose pas le menu pour elles.
describe('renameList', () => {
  test('liste créée par l’utilisateur : renomme et avance updatedAt', async () => {
    const store = await mountStore();
    let id!: string;
    act(() => {
      id = store().createList('Metroidvanias');
    });
    const createdAt = store().lists[id].updatedAt;

    act(() => {
      store().renameList(id, 'Metroidvanias 2D');
    });

    expect(store().lists[id].name).toBe('Metroidvanias 2D');
    expect(store().lists[id].updatedAt).toBeGreaterThanOrEqual(createdAt!);
  });

  test('nom vide ou seulement des espaces : no-op silencieux', async () => {
    const store = await mountStore();
    let id!: string;
    act(() => {
      id = store().createList('Metroidvanias');
    });

    act(() => {
      store().renameList(id, '   ');
    });

    expect(store().lists[id].name).toBe('Metroidvanias');
  });

  test('même nom resoumis : no-op, n’avance pas updatedAt (rien n’a changé)', async () => {
    const store = await mountStore();
    let id!: string;
    act(() => {
      id = store().createList('Metroidvanias');
    });
    const updatedAtBefore = store().lists[id].updatedAt;

    act(() => {
      store().renameList(id, 'Metroidvanias');
    });

    expect(store().lists[id].updatedAt).toBe(updatedAtBefore);
  });

  test('liste intégrée (Favoris) : no-op, jamais renommable', async () => {
    const store = await mountStore();

    act(() => {
      store().renameList('favoris', 'Mes coups de cœur');
    });

    expect(store().lists.favoris.name).toBe('Favoris');
  });

  test('id de liste inexistant : no-op silencieux', async () => {
    const store = await mountStore();

    act(() => {
      store().renameList('liste-jamais-creee', 'Nouveau nom');
    });

    expect(store().lists['liste-jamais-creee']).toBeUndefined();
  });
});

describe('deleteList', () => {
  test('liste créée par l’utilisateur : tombstone posé, gameIds/memberships vidés', async () => {
    const store = await mountStore();
    let id!: string;
    act(() => {
      store().registerCatalogGame(CATALOG_GAME);
      id = store().createList('Metroidvanias');
      store().toggleListMembership(id, 'jeu-test');
    });
    expect(store().lists[id].gameIds).toEqual(['jeu-test']);

    act(() => {
      store().deleteList(id);
    });

    expect(store().lists[id].deletedAt).toBeDefined();
    expect(store().lists[id].gameIds).toEqual([]);
    expect(store().lists[id].memberships).toBeUndefined();
    // Tombstone, pas un retrait de l'entrée : la ligne doit survivre pour
    // que la synchro ait quelque chose à pousser (voir ARCHITECTURE.md).
    expect(store().lists[id]).toBeDefined();
  });

  test('liste déjà supprimée : no-op, ne réavance pas deletedAt', async () => {
    const store = await mountStore();
    let id!: string;
    act(() => {
      id = store().createList('Metroidvanias');
      store().deleteList(id);
    });
    const deletedAtFirst = store().lists[id].deletedAt;

    act(() => {
      store().deleteList(id);
    });

    expect(store().lists[id].deletedAt).toBe(deletedAtFirst);
  });

  test('liste intégrée (Wishlist) : no-op, jamais supprimable', async () => {
    const store = await mountStore();

    act(() => {
      store().deleteList('wishlist');
    });

    expect(store().lists.wishlist.deletedAt).toBeUndefined();
  });

  test('id de liste inexistant : no-op silencieux', async () => {
    const store = await mountStore();

    act(() => {
      store().deleteList('liste-jamais-creee');
    });

    expect(store().lists['liste-jamais-creee']).toBeUndefined();
  });

  test('toggleListMembership sur une liste supprimée : no-op, ne repeuple pas gameIds', async () => {
    const store = await mountStore();
    let id!: string;
    act(() => {
      store().registerCatalogGame(CATALOG_GAME);
      id = store().createList('Metroidvanias');
      store().deleteList(id);
    });

    act(() => {
      store().toggleListMembership(id, 'jeu-test');
    });

    expect(store().lists[id].gameIds).toEqual([]);
  });
});
