// AuthProvider ne doit jamais toucher au vrai SDK Supabase ni au vrai
// expo-web-browser/expo-linking en test : @/lib/supabase est mocké pour
// injecter un client entièrement contrôlé (auth.getSession/
// onAuthStateChange/etc. en jest.fn()), et expo-web-browser/expo-linking le
// sont aussi — Linking.createURL et Linking.parse échouent tous les deux
// sous Jest sans manifeste natif (vérifié : "needs access to the expo-
// constants manifest" / "Cannot read properties of undefined"), donc les
// laisser réels ferait planter ces tests pour une raison sans rapport avec
// ce qu'ils vérifient.
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';
import { act, create } from 'react-test-renderer';

import { getSupabaseClient } from '@/lib/supabase';

import { AuthProvider, useAuth } from '../auth-store';

// jest.mock est hoisté par babel-jest au sommet du module, avant même ces
// imports (voir import/first dans les autres fichiers de tests du projet) :
// les mettre après les imports plutôt qu'avant est la convention déjà
// établie ici, pas un oubli.
jest.mock('@/lib/supabase', () => ({ getSupabaseClient: jest.fn() }));
jest.mock('expo-web-browser', () => ({ openAuthSessionAsync: jest.fn() }));
jest.mock('expo-linking', () => ({
  createURL: jest.fn(() => 'gamelary://profile/sign-in'),
  // Repose sur le vrai URL/URLSearchParams du runtime Node (disponibles
  // sous Jest, contrairement au module natif expo-linking) : suffisant
  // pour extraire un `code` d'une URL de retour simulée.
  parse: jest.fn((url: string) => {
    const query = url.includes('?') ? url.slice(url.indexOf('?') + 1) : '';
    const params = Object.fromEntries(new URLSearchParams(query));
    return { queryParams: params };
  }),
}));

const mockGetSupabaseClient = getSupabaseClient as jest.Mock;
const mockOpenAuthSessionAsync = WebBrowser.openAuthSessionAsync as jest.Mock;

type Auth = ReturnType<typeof useAuth>;

function TestConsumer({ capture }: { capture: (auth: Auth) => void }) {
  const auth = useAuth();
  capture(auth);
  return null;
}

// onAuthStateChange doit renvoyer { data: { subscription: { unsubscribe } } }
// (forme exacte attendue par supabase-js) : un fake incomplet ferait
// planter le cleanup de useEffect, silencieusement avalé par
// react-test-renderer sous forme d'avertissement plutôt que d'échec net —
// mieux vaut le shape correct dès le départ.
function makeFakeClient(overrides: Partial<Record<string, jest.Mock>> = {}) {
  const authStateCallbacks: ((event: string, session: unknown) => void)[] = [];
  return {
    auth: {
      getSession: jest.fn(async () => ({ data: { session: null } })),
      onAuthStateChange: jest.fn((cb: (event: string, session: unknown) => void) => {
        authStateCallbacks.push(cb);
        return { data: { subscription: { unsubscribe: jest.fn() } } };
      }),
      signOut: jest.fn(async () => ({ error: null })),
      signInWithOAuth: jest.fn(async () => ({ data: { url: 'https://accounts.google.example/auth' }, error: null })),
      signInWithOtp: jest.fn(async () => ({ error: null })),
      exchangeCodeForSession: jest.fn(async () => ({ data: {}, error: null })),
      ...overrides,
    },
    __emitAuthStateChange: (event: string, session: unknown) => {
      for (const cb of authStateCallbacks) cb(event, session);
    },
  };
}

async function mountAuth(client: ReturnType<typeof makeFakeClient> | null) {
  mockGetSupabaseClient.mockReturnValue(client);
  let latest!: Auth;
  await act(async () => {
    create(
      <AuthProvider>
        <TestConsumer capture={(a) => (latest = a)} />
      </AuthProvider>
    );
    // Laisse le getSession() initial (une vraie promesse, même simulée) se
    // résoudre avant que le test ne lise le premier statut stabilisé.
    await Promise.resolve();
    await Promise.resolve();
  });
  return () => latest;
}

afterEach(() => {
  jest.clearAllMocks();
});

test("sans client (build non configurée) : statut 'unconfigured' immédiat, jamais 'loading'", async () => {
  const auth = await mountAuth(null);
  expect(auth().status).toBe('unconfigured');
});

test("avec client, aucune session : statut passe à 'signedOut'", async () => {
  const client = makeFakeClient();
  const auth = await mountAuth(client);
  expect(auth().status).toBe('signedOut');
  expect(client.auth.getSession).toHaveBeenCalledTimes(1);
});

test("avec client, une session existante : statut 'signedIn' dès le chargement", async () => {
  const fakeSession = { user: { email: 'jarod@example.com' } };
  const client = makeFakeClient({
    getSession: jest.fn(async () => ({ data: { session: fakeSession } })),
  });
  const auth = await mountAuth(client);
  expect(auth().status).toBe('signedIn');
  expect(auth().session).toBe(fakeSession);
});

test('onAuthStateChange met à jour statut et session en direct (retour de connexion ailleurs)', async () => {
  const client = makeFakeClient();
  const auth = await mountAuth(client);
  expect(auth().status).toBe('signedOut');

  const fakeSession = { user: { email: 'jarod@example.com' } };
  await act(async () => {
    client.__emitAuthStateChange('SIGNED_IN', fakeSession);
  });

  expect(auth().status).toBe('signedIn');
  expect(auth().session).toBe(fakeSession);
});

test('signOut() appelle bien client.auth.signOut', async () => {
  const client = makeFakeClient();
  const auth = await mountAuth(client);

  await act(async () => {
    await auth().signOut();
  });

  expect(client.auth.signOut).toHaveBeenCalledTimes(1);
});

test('signInWithEmail() transmet email et emailRedirectTo, remonte une erreur éventuelle', async () => {
  const client = makeFakeClient({
    signInWithOtp: jest.fn(async () => ({ error: { message: 'Adresse invalide' } })),
  });
  const auth = await mountAuth(client);

  const result = await auth().signInWithEmail('jarod@example.com');

  expect(client.auth.signInWithOtp).toHaveBeenCalledWith({
    email: 'jarod@example.com',
    options: { emailRedirectTo: 'gamelary://profile/sign-in' },
  });
  expect(result).toEqual({ error: 'Adresse invalide' });
});

test('signInWithGoogle() (natif) : ouvre le navigateur puis échange le code au retour', async () => {
  const client = makeFakeClient();
  mockOpenAuthSessionAsync.mockResolvedValue({
    type: 'success',
    url: 'gamelary://profile/sign-in?code=le-vrai-code',
  });
  const auth = await mountAuth(client);

  const result = await auth().signInWithGoogle();

  expect(client.auth.signInWithOAuth).toHaveBeenCalledWith({
    provider: 'google',
    options: { redirectTo: 'gamelary://profile/sign-in', skipBrowserRedirect: true },
  });
  expect(client.auth.exchangeCodeForSession).toHaveBeenCalledWith('le-vrai-code');
  expect(result).toEqual({ error: null });
});

test("signInWithGoogle() (natif) : l'utilisateur ferme le navigateur -> pas d'erreur affichée, pas d'échange", async () => {
  const client = makeFakeClient();
  mockOpenAuthSessionAsync.mockResolvedValue({ type: 'dismiss' });
  const auth = await mountAuth(client);

  const result = await auth().signInWithGoogle();

  expect(client.auth.exchangeCodeForSession).not.toHaveBeenCalled();
  expect(result).toEqual({ error: null });
});

test("signInWithGoogle() (natif) : retour sans code -> erreur explicite plutôt qu'un échange silencieusement raté", async () => {
  const client = makeFakeClient();
  mockOpenAuthSessionAsync.mockResolvedValue({
    type: 'success',
    url: 'gamelary://profile/sign-in', // pas de ?code=
  });
  const auth = await mountAuth(client);

  const result = await auth().signInWithGoogle();

  expect(client.auth.exchangeCodeForSession).not.toHaveBeenCalled();
  expect(result.error).not.toBeNull();
});

test('signInWithGoogle() (web) : redirige via signInWithOAuth, sans navigateur ni échange de code', async () => {
  const original = Platform.OS;
  const originalLocation = (window as { location?: unknown }).location;
  (Platform as { OS: string }).OS = 'web';
  // Sous Jest, `window` existe mais `window.location` non (voir
  // auth-redirect.ts) : posé ici pour de vrai plutôt que de figer
  // l'attente sur le repli '' — c'est ce chemin, avec une vraie origine,
  // qu'un navigateur emprunte réellement.
  (window as { location?: unknown }).location = { origin: 'https://gamelary.example.com' };
  try {
    const client = makeFakeClient();
    const auth = await mountAuth(client);

    const result = await auth().signInWithGoogle();

    expect(client.auth.signInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: { redirectTo: 'https://gamelary.example.com/profile/sign-in' },
    });
    expect(mockOpenAuthSessionAsync).not.toHaveBeenCalled();
    expect(result).toEqual({ error: null });
  } finally {
    (Platform as { OS: string }).OS = original;
    (window as { location?: unknown }).location = originalLocation;
  }
});

test("sans client : signInWithGoogle/signInWithEmail renvoient le même message explicite, pas d'appel réseau", async () => {
  const auth = await mountAuth(null);

  expect(await auth().signInWithGoogle()).toEqual({
    error: 'La connexion en ligne n’est pas configurée pour cette build.',
  });
  expect(await auth().signInWithEmail('jarod@example.com')).toEqual({
    error: 'La connexion en ligne n’est pas configurée pour cette build.',
  });
  expect(mockOpenAuthSessionAsync).not.toHaveBeenCalled();
});

test('completeSignInFromCode() échange directement le code (retour de lien magique)', async () => {
  const client = makeFakeClient();
  const auth = await mountAuth(client);

  const result = await auth().completeSignInFromCode('code-du-lien-magique');

  expect(client.auth.exchangeCodeForSession).toHaveBeenCalledWith('code-du-lien-magique');
  expect(result).toEqual({ error: null });
});

test('le démontage se désabonne de onAuthStateChange (pas de fuite)', async () => {
  // Aucun des tests précédents ne démonte l'arbre : retirer l'appel à
  // unsubscribe() dans le cleanup de useEffect ne les faisait donc
  // échouer. Celui-ci le vérifie pour de vrai plutôt que de le supposer
  // couvert par les autres.
  const client = makeFakeClient();
  mockGetSupabaseClient.mockReturnValue(client);
  const unsubscribe = jest.fn();
  client.auth.onAuthStateChange = jest.fn((_cb: (event: string, session: unknown) => void) => ({
    data: { subscription: { unsubscribe } },
  }));

  let tree!: ReturnType<typeof create>;
  await act(async () => {
    tree = create(
      <AuthProvider>
        <TestConsumer capture={() => {}} />
      </AuthProvider>
    );
    await Promise.resolve();
    await Promise.resolve();
  });

  expect(unsubscribe).not.toHaveBeenCalled();
  act(() => {
    tree.unmount();
  });
  expect(unsubscribe).toHaveBeenCalledTimes(1);
});

test('useAuth hors AuthProvider lève une erreur explicite', () => {
  function Bare() {
    useAuth();
    return null;
  }
  // console.error de React pour l'erreur non capturée : attendu, pas un
  // signal d'échec du test lui-même.
  const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
  expect(() => {
    act(() => {
      create(<Bare />);
    });
  }).toThrow('useAuth doit être utilisé sous AuthProvider');
  spy.mockRestore();
});
