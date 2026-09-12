// GamePickerSheet (game-picker-sheet.tsx) : même classe de bug que le champ
// SteamID64 (profile/index.tsx) — le clavier peut recouvrir une partie du
// contenu affiché sous le champ actif. Là-bas, un simple ScrollView plein
// écran suffisait (automaticallyAdjustKeyboardInsets délègue tout à RN).
// Cette feuille est une Modal positionnée en bas de l'écran dont la
// ScrollView interne des résultats a une hauteur fixe (voir styles.results
// dans le composant) — rien à qui déléguer un ajustement automatique. Corrigé
// en enveloppant la feuille dans un KeyboardAvoidingView, avec un
// comportement différent iOS/Android ('padding' peu fiable sur Android).
//
// react-test-renderer ne simule ni vrai clavier natif ni vraie mesure
// d'inset : ce test vérifie uniquement que le bon `behavior` est câblé par
// plateforme (voir Platform.OS mocké ci-dessous, même pattern que
// lib/__tests__/supabase.test.ts) — l'effet visuel réel doit être vérifié
// manuellement sur un simulateur/appareil iOS et sur un émulateur/appareil
// Android.
import { KeyboardAvoidingView } from 'react-native';
import { act, create } from 'react-test-renderer';

import { GameStoreProvider } from '@/lib/game-store';

import { GamePickerSheet } from '../game-picker-sheet';

async function mount(listId: string): Promise<ReturnType<typeof create>> {
  let tree!: ReturnType<typeof create>;
  act(() => {
    tree = create(
      <GameStoreProvider>
        <GamePickerSheet visible listId={listId} onClose={() => {}} />
      </GameStoreProvider>
    );
  });
  // Laisse la lecture AsyncStorage du provider se résoudre (même pattern que
  // game-store-lists.test.tsx) avant d'inspecter l'arbre rendu.
  await act(async () => {
    await Promise.resolve();
  });
  return tree;
}

async function withPlatformOS<T>(os: 'ios' | 'android', run: () => Promise<T>): Promise<T> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const RN = require('react-native');
  const original = RN.Platform.OS;
  RN.Platform.OS = os;
  try {
    return await run();
  } finally {
    RN.Platform.OS = original;
  }
}

test('iOS : KeyboardAvoidingView avec behavior="padding"', async () => {
  await withPlatformOS('ios', async () => {
    const tree = await mount('favoris');
    expect(tree.root.findByType(KeyboardAvoidingView).props.behavior).toBe('padding');
  });
});

test("Android : KeyboardAvoidingView avec behavior=\"height\" ('padding' y est peu fiable)", async () => {
  await withPlatformOS('android', async () => {
    const tree = await mount('favoris');
    expect(tree.root.findByType(KeyboardAvoidingView).props.behavior).toBe('height');
  });
});

test('liste introuvable : pas de KeyboardAvoidingView orphelin (le composant ne rend rien)', async () => {
  const tree = await mount('liste-jamais-creee');
  expect(tree.root.findAllByType(KeyboardAvoidingView)).toHaveLength(0);
});
