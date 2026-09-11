// @react-native-async-storage/async-storage@2.2.0 (voir ARCHITECTURE.md
// §6.6 — version figée pour Expo Go/SDK 57) touche son module natif au
// chargement même du fichier (AsyncStorage.native.ts), pas seulement à
// l'appel d'une méthode : il faut que `jest.mock` remplace le module AVANT
// que quoi que ce soit ne l'importe, d'où ce fichier séparé plutôt qu'un
// require direct du mock officiel dans la config.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

// Le mock officiel garde son stockage en mémoire dans le module lui-même
// (__INTERNAL_MOCK_STORAGE__), qui persiste pour toute la durée du fichier
// de test — contrairement à un automock Jest classique (sans effet,
// toujours "vide"), un test qui écrit dans AsyncStorage fuit donc dans le
// suivant du même fichier tant que rien ne le vide. Repéré via
// game-store-identity.test.tsx : des scénarios "appareil A"/"appareil B"
// censés démarrer chacun d'un stockage vierge lisaient l'état laissé par
// le test précédent.
//
// Défensif (`?.clear` puis repli sur `.default?.clear`) : un fichier de
// test peut fournir son propre `jest.mock(...)` pour ce module avec une
// forme différente (voir supabase.test.ts) — ce hook global s'applique à
// tous les fichiers, il ne doit jamais faire planter ceux qui n'utilisent
// pas ce mock-ci.
beforeEach(async () => {
  const mod = require('@react-native-async-storage/async-storage');
  const clear = mod?.clear ?? mod?.default?.clear;
  if (typeof clear === 'function') await clear();
});
