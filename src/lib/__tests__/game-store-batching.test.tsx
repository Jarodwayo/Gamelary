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
