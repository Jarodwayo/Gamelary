// AuthGate est le verrou qui impose la connexion avant les onglets (voir
// ARCHITECTURE.md §9.7) : ces tests pilotent un VRAI AuthProvider (même
// fake client que auth-store.test.tsx/use-sign-in-sync.test.tsx — la forme
// exacte attendue par supabase-js, avec un moyen d'émettre un événement de
// connexion/déconnexion réel) plutôt que de mocker useAuth, pour vérifier le
// comportement observable (le formulaire apparaît/disparaît), pas juste
// qu'un statut est lu.
import { act, create } from 'react-test-renderer';

import { AuthProvider } from '@/lib/auth-store';
import { getSupabaseClient } from '@/lib/supabase';

import { AuthGate } from '../auth-gate';

jest.mock('@/lib/supabase', () => ({ getSupabaseClient: jest.fn() }));

const mockGetSupabaseClient = getSupabaseClient as jest.Mock;

function makeFakeClient(initialSession: unknown = null) {
  const authStateCallbacks: ((event: string, session: unknown) => void)[] = [];
  return {
    auth: {
      getSession: jest.fn(async () => ({ data: { session: initialSession } })),
      onAuthStateChange: jest.fn((cb: (event: string, session: unknown) => void) => {
        authStateCallbacks.push(cb);
        return { data: { subscription: { unsubscribe: jest.fn() } } };
      }),
    },
    __emitAuthStateChange: (event: string, session: unknown) => {
      for (const cb of authStateCallbacks) cb(event, session);
    },
  };
}

async function mount(client: ReturnType<typeof makeFakeClient> | null) {
  mockGetSupabaseClient.mockReturnValue(client);
  let tree!: ReturnType<typeof create>;
  await act(async () => {
    tree = create(
      <AuthProvider>
        <AuthGate />
      </AuthProvider>
    );
    await Promise.resolve();
    await Promise.resolve();
  });
  return tree;
}

// Cherche par accessibilityLabel plutôt que par texte : react-test-renderer
// éclate le texte visible en plusieurs nœuds (voir ThemedText), le label
// d'accessibilité du Pressable, lui, reste une chaîne unique et stable.
// Filtré aux seuls nœuds HOST (type string) : le même accessibilityLabel se
// retrouve aussi sur le composant composite Pressable et ses intermédiaires
// internes, sans ce filtre `findAll` en compte plusieurs pour un seul
// bouton affiché.
function findGoogleButton(tree: ReturnType<typeof create>) {
  return tree.root.findAll(
    (node) => typeof node.type === 'string' && node.props.accessibilityLabel === 'Continuer avec Google'
  );
}

afterEach(() => {
  jest.clearAllMocks();
});

// Sérialise tout le sous-arbre en JSON et cherche une sous-chaîne : plus
// robuste qu'un findByProps sur `children` (ThemedText éclate souvent son
// texte en plusieurs nœuds, un match exact sur un enfant unique serait
// fragile face au moindre changement de mise en forme).
function renderedText(tree: ReturnType<typeof create>): string {
  return JSON.stringify(tree.toJSON());
}

test('build non configurée (unconfigured) : le verrou reste affiché (message explicite, pas les onglets)', async () => {
  const tree = await mount(null);
  expect(renderedText(tree)).toContain('pas configurée');
  expect(findGoogleButton(tree)).toHaveLength(0);
});

test('signedOut : le formulaire de connexion est affiché', async () => {
  const client = makeFakeClient(null);
  const tree = await mount(client);
  expect(findGoogleButton(tree)).toHaveLength(1);
});

test("signedIn : le verrou disparaît (rend null, plus de formulaire)", async () => {
  const client = makeFakeClient({ user: { email: 'jarod@example.com' } });
  const tree = await mount(client);
  // toJSON() à null plutôt que "pas de bouton Google" : un statut coincé sur
  // 'loading' n'a lui non plus aucun bouton Google (voir SignInScreen), donc
  // ne pas confondre "AuthGate a rendu null" avec "SignInScreen affiche son
  // indicateur de chargement" — seul le premier est le comportement attendu
  // ici.
  expect(tree.toJSON()).toBeNull();
});

test('une déconnexion en cours de session refait réapparaître le verrou (retombe sur la connexion, pas coincé)', async () => {
  const client = makeFakeClient({ user: { email: 'jarod@example.com' } });
  const tree = await mount(client);
  expect(tree.toJSON()).toBeNull();

  await act(async () => {
    client.__emitAuthStateChange('SIGNED_OUT', null);
  });

  expect(findGoogleButton(tree)).toHaveLength(1);
});
