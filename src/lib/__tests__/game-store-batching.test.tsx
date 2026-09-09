// Vérifie une hypothèse précise plutôt que de la supposer : registerCatalogGame
// puis setTotalHours/addToLibrary sur le MÊME id, appelés à la suite dans le
// même bloc (comme le fait importSteamLibrary, voir profile/index.tsx),
// doivent fonctionner sans attendre un re-rendu intermédiaire. Ça ne marche
// que parce que les trois actions utilisent setState(prev => ...) (forme
// fonctionnelle), que React applique en séquence sur l'état qui s'accumule.
// react-test-renderer suffit ici (déjà présent via jest-expo) : pas besoin
// de React Testing Library pour ce seul test, hors scope de ce chantier.
import { act, create } from 'react-test-renderer';

import { GameStoreProvider, useGameStore } from '../game-store';

function TestConsumer({ capture }: { capture: (store: ReturnType<typeof useGameStore>) => void }) {
  const store = useGameStore();
  capture(store);
  return null;
}

test('registerCatalogGame + setTotalHours + addToLibrary sur le même id, dans le même batch', async () => {
  let store!: ReturnType<typeof useGameStore>;

  act(() => {
    create(
      <GameStoreProvider>
        <TestConsumer capture={(s) => (store = s)} />
      </GameStoreProvider>
    );
  });

  // Laisse le chargement AsyncStorage initial (voir game-store.tsx) se
  // résoudre et déclencher son setReady(true) avant de continuer — sinon ce
  // setState différé arrive après la fin du test, hors de tout act().
  await act(async () => {
    await Promise.resolve();
  });

  act(() => {
    store.registerCatalogGame({ id: 'new-game', title: 'Nouveau Jeu', platform: 'PC', steamAppId: 555 });
    store.setTotalHours('new-game', 10);
    store.addToLibrary('new-game');
  });

  const game = store.games['new-game'];
  expect(game).toBeDefined();
  expect(game.inLibrary).toBe(true);
  expect(game.playSessions.reduce((sum, s) => sum + s.hours, 0)).toBe(10);
});

// Le test ci-dessus appelle les trois actions de façon synchrone dans le
// MÊME act() — mais importSteamLibrary (profile/index.tsx) ne fait pas ça :
// registerCatalogGame est appelé À L'INTÉRIEUR de chaque
// `await fetchIgdbMatchForSteamAppId(...)` (donc à des moments différents,
// entrelacés avec du réseau), et setTotalHours/addToLibrary sont appelés
// PLUS TARD, dans une boucle séparée, après le Promise.all — potentiellement
// après qu'un re-rendu ait eu lieu entre-temps. Le `store` utilisé partout
// dans importSteamLibrary est capturé UNE SEULE FOIS (au rendu où la
// fonction a été créée) et jamais rafraîchi en cours d'exécution — ce test
// reproduit fidèlement ça : une seule capture de `store`, jamais réassignée,
// avec un vrai re-rendu (act() séparé) entre l'enregistrement et la
// complétion des heures.
test('registerCatalogGame puis setTotalHours/addToLibrary dans un ACT séparé, avec une référence store non rafraîchie', async () => {
  // frozenStore : capturé UNE SEULE FOIS, jamais réassigné — sert à APPELER
  // les actions, exactement comme importSteamLibrary qui ferme sur un seul
  // `store` du rendu où la fonction a été créée, sans jamais le relire en
  // cours d'exécution.
  // latestStore : mis à jour à CHAQUE rendu — c'est ce qu'une vraie UI
  // afficherait. L'assertion finale doit lire latestStore, pas frozenStore :
  // vérifier que frozenStore.games se met à jour tout seul n'aurait aucun
  // sens (une référence JS figée ne se met jamais à jour d'elle-même, ça ne
  // dit rien sur la justesse de l'état React réel).
  let frozenStore: ReturnType<typeof useGameStore> | undefined;
  let latestStore!: ReturnType<typeof useGameStore>;

  act(() => {
    create(
      <GameStoreProvider>
        <TestConsumer
          capture={(s) => {
            if (!frozenStore) frozenStore = s;
            latestStore = s;
          }}
        />
      </GameStoreProvider>
    );
  });

  await act(async () => {
    await Promise.resolve();
  });
  // Rebase frozenStore après le chargement initial (sinon il pointerait sur
  // l'état d'avant AsyncStorage) — toujours UNE capture unique à partir d'ici.
  frozenStore = latestStore;
  const storeUsedByImport = frozenStore;

  // Étape 1, isolée dans son propre act() : simule le premier `await`
  // réseau d'importSteamLibrary, après lequel React a eu l'occasion de
  // re-rendre avant l'étape suivante.
  act(() => {
    storeUsedByImport.registerCatalogGame({ id: 'new-game-2', title: 'Autre Jeu', platform: 'PC', steamAppId: 777 });
  });

  // Étape 2, dans un ACT séparé et donc un "tick" différent, avec la MÊME
  // référence storeUsedByImport capturée avant l'étape 1 (jamais relue
  // depuis) — exactement le pattern d'importSteamLibrary.
  act(() => {
    storeUsedByImport.setTotalHours('new-game-2', 7);
    storeUsedByImport.addToLibrary('new-game-2');
  });

  // Vérifie l'état réel (dernier rendu), pas la référence figée utilisée
  // pour appeler les actions.
  const game = latestStore.games['new-game-2'];
  expect(game).toBeDefined();
  expect(game.inLibrary).toBe(true);
  expect(game.playSessions.reduce((sum, s) => sum + s.hours, 0)).toBe(7);
});
