// Mock scopé à ce fichier plutôt que de dépendre du mock global
// (jest.async-storage-mock.js, voir jest.config.js) : createClient()
// déclenche en interne un chargement de session (_emitInitialSession) qui
// n'est jamais attendu par l'appelant — un rejet non intercepté à cet
// endroit fait planter tout le worker Jest, pas seulement échouer le test.
// Un mock minimal et local, garanti disponible avant tout `require('../
// supabase')` (voir jest.resetModules ci-dessous), retire toute dépendance
// à l'ordre de résolution des mocks partagés pour ce risque précis.
jest.mock('@react-native-async-storage/async-storage', () => {
  const store = new Map<string, string>();
  return {
    __esModule: true,
    default: {
      getItem: async (key: string) => store.get(key) ?? null,
      setItem: async (key: string, value: string) => {
        store.set(key, value);
      },
      removeItem: async (key: string) => {
        store.delete(key);
      },
    },
  };
});

// Une instance fraîche du module par test (jest.resetModules + require
// dynamique) : getSupabaseClient() mémoïse son résultat au niveau module
// (voir supabase.ts), donc rejouer les deux scénarios (configuré / non
// configuré) sur le MÊME module chargé une fois ne prouverait que le
// premier appel — même raisonnement que app.test.js côté gamelary-api pour
// ALLOWED_ORIGINS, lu une seule fois au chargement.
const ENV_KEYS = ['EXPO_PUBLIC_SUPABASE_URL', 'EXPO_PUBLIC_SUPABASE_ANON_KEY'] as const;
const original: Record<string, string | undefined> = {};

// @supabase/realtime-js construit un client Realtime dès createClient(),
// même si on ne s'en sert jamais (aucun .channel() nulle part dans ce
// projet) — et il exige un WebSocket global pour ça. Node 22+ en expose un
// nativement (ce qui masquait ce problème en local) ; le Node 20 de la CI
// de ce projet non, ce qui a fait planter cette suite en CI avec "Node.js
// detected but native WebSocket not found" alors qu'elle passait ici.
// Sans rapport avec un vrai risque en production : côté web, le navigateur
// a toujours un WebSocket ; côté natif, c'est le moteur JS de React Native
// (Hermes) qui tourne, pas Node, donc la branche qui détecte spécifiquement
// "Node.js sans WebSocket" ne s'y déclenche jamais. Et sur un déploiement
// serveur Node (web.output: "server"), le garde SSR de supabase.ts renvoie
// null avant même d'atteindre createClient() — jamais construit côté
// serveur, donc jamais ce problème là non plus. Stub minimal, jamais
// réellement utilisé pour se connecter à quoi que ce soit.
let originalWebSocket: typeof globalThis.WebSocket | undefined;

beforeAll(() => {
  originalWebSocket = globalThis.WebSocket;
  (globalThis as any).WebSocket = class {};
});

afterAll(() => {
  (globalThis as any).WebSocket = originalWebSocket;
});

beforeEach(() => {
  for (const key of ENV_KEYS) {
    original[key] = process.env[key];
    delete process.env[key];
  }
  jest.resetModules();
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (original[key] === undefined) delete process.env[key];
    else process.env[key] = original[key];
  }
});

test('sans configuration : renvoie null, pas de client fantôme', () => {
  // require() plutôt qu'un import statique : c'est ce qui permet à
  // jest.resetModules() ci-dessus de vraiment recharger le module entre
  // deux scénarios — un import() dynamique n'interagit pas de façon fiable
  // avec le registre de modules que resetModules() vide (contrairement à
  // require(), conçu précisément autour de ce registre).
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { getSupabaseClient } = require('../supabase');
  expect(getSupabaseClient()).toBeNull();
});

test('configuré : renvoie un client, mémoïsé sur des appels successifs', () => {
  process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://abcdefgh.supabase.co';
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'anon-key-value';

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { getSupabaseClient } = require('../supabase');
  const first = getSupabaseClient();
  const second = getSupabaseClient();

  expect(first).not.toBeNull();
  // Même référence : pas deux GoTrueClient distincts gérant la même session
  // AsyncStorage en parallèle (voir le commentaire de mémoïsation dans
  // supabase.ts).
  expect(first).toBe(second);
});

describe("rendu côté serveur web (web.output: 'server') : jamais de client construit sans window", () => {
  // Reproduit précisément le crash trouvé en conditions réelles (`expo
  // start --web` avec des clés Supabase configurées) : GoTrueClient lit une
  // session en arrière-plan dès sa construction, ce qui déclenche
  // AsyncStorage -> `window.localStorage` -> `ReferenceError: window is not
  // defined`, non intercepté, qui fait planter tout le processus Node — sur
  // n'importe quelle page, puisqu'AuthProvider enveloppe toute l'app (voir
  // app/_layout.tsx). Le mock jest.mock ci-dessus masquerait ce crash-là
  // précisément (il fournit un AsyncStorage qui fonctionne toujours), d'où
  // un test dédié qui retire `window` pour de vrai plutôt que de supposer
  // le garde-fou suffisant parce que la relecture du code semble correcte.
  let originalWindow: typeof globalThis.window | undefined;
  let originalPlatformOS: string;

  beforeEach(() => {
    originalWindow = (globalThis as { window?: typeof globalThis.window }).window;
    delete (globalThis as { window?: unknown }).window;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    originalPlatformOS = require('react-native').Platform.OS;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('react-native').Platform.OS = 'web';
  });

  afterEach(() => {
    (globalThis as { window?: unknown }).window = originalWindow;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('react-native').Platform.OS = originalPlatformOS;
  });

  test('configuré, mais sans window (passe SSR) : renvoie null au lieu de construire un client', () => {
    process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://abcdefgh.supabase.co';
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'anon-key-value';

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getSupabaseClient } = require('../supabase');
    expect(getSupabaseClient()).toBeNull();
  });

  test('même config, avec window (vrai navigateur après hydratation) : construit bien un client', () => {
    process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://abcdefgh.supabase.co';
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'anon-key-value';
    (globalThis as { window?: unknown }).window = { location: { origin: 'https://gamelary.example.com' } };

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getSupabaseClient } = require('../supabase');
    expect(getSupabaseClient()).not.toBeNull();
  });

  test("natif (Platform.OS 'ios'), toujours sans window par nature : n'est PAS bloqué par ce garde-fou", () => {
    // Le garde ne doit filtrer QUE le passage serveur du bundle web — le
    // natif n'a jamais de `window` et ce n'est jamais un problème là-bas
    // (AsyncStorage y utilise le vrai module natif, pas localStorage). Une
    // version du garde qui checke seulement `typeof window === 'undefined'`
    // sans la condition Platform.OS === 'web' bloquerait le natif à tort —
    // ce test est celui qui l'attrape (vérifié par mutation).
    process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://abcdefgh.supabase.co';
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'anon-key-value';
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('react-native').Platform.OS = 'ios';

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getSupabaseClient } = require('../supabase');
    expect(getSupabaseClient()).not.toBeNull();
  });
});
