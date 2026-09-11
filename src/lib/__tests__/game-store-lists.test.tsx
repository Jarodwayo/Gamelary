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
