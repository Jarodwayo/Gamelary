// Vérifie le déclenchement, pas la fusion elle-même (déjà couverte par
// lib/sync/__tests__/sync-service.test.ts) : syncLibrary est mocké ici, seul
// le COMPTAGE et le MOMENT des appels sont en jeu — une seule synchro par
// transition RÉELLE vers 'signedIn', jamais à chaque rendu tant qu'on y
// reste, et jamais avant d'y être entré pour de vrai (une session déjà
// active à l'ouverture de l'app ne doit pas en redéclencher une).
import { act, create } from 'react-test-renderer';

import { AuthProvider } from '@/lib/auth-store';
import { GameStoreProvider } from '@/lib/game-store';
import { getSupabaseClient } from '@/lib/supabase';
import { syncLibrary } from '@/lib/sync/sync-service';

import { useSignInSync } from '../use-sign-in-sync';

jest.mock('@/lib/supabase', () => ({ getSupabaseClient: jest.fn() }));
jest.mock('@/lib/sync/sync-service', () => ({ syncLibrary: jest.fn() }));

const mockGetSupabaseClient = getSupabaseClient as jest.Mock;
const mockSyncLibrary = syncLibrary as jest.Mock;

// Même fake client que auth-store.test.tsx : la forme exacte attendue par
// AuthProvider (getSession/onAuthStateChange), avec un moyen de simuler un
// événement de connexion réel depuis le test.
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

function Harness() {
  useSignInSync();
  return null;
}

async function mount(client: ReturnType<typeof makeFakeClient> | null) {
  mockGetSupabaseClient.mockReturnValue(client);
  await act(async () => {
    create(
      <AuthProvider>
        <GameStoreProvider>
          <Harness />
        </GameStoreProvider>
      </AuthProvider>
    );
    await Promise.resolve();
    await Promise.resolve();
  });
}

afterEach(() => {
  jest.clearAllMocks();
});

test('une connexion réelle (transition vers signedIn) déclenche syncLibrary une fois', async () => {
  const client = makeFakeClient(null);
  await mount(client);
  expect(mockSyncLibrary).not.toHaveBeenCalled();

  await act(async () => {
    client.__emitAuthStateChange('SIGNED_IN', { user: { id: 'user-1' } });
  });

  expect(mockSyncLibrary).toHaveBeenCalledTimes(1);
  const [userId] = mockSyncLibrary.mock.calls[0];
  expect(userId).toBe('user-1');
});

test('une session déjà active retrouvée au démarrage (cold start) déclenche aussi une synchro', async () => {
  // Le statut part de 'loading' (voir AuthProvider) : la confirmation d'une
  // session déjà persistée EST une vraie transition vers 'signedIn' du
  // point de vue de ce hook, pas un simple "on y était déjà" — sans ça, un
  // utilisateur qui reste connecté pendant des semaines ne bénéficierait
  // jamais de la synchro automatique, seulement du bouton manuel.
  const client = makeFakeClient({ user: { id: 'user-1' } });
  await mount(client);

  expect(mockSyncLibrary).toHaveBeenCalledTimes(1);
  expect(mockSyncLibrary.mock.calls[0][0]).toBe('user-1');
});

test('rester signedIn après la confirmation de session au démarrage ne redéclenche pas la synchro', async () => {
  const client = makeFakeClient({ user: { id: 'user-1' } });
  await mount(client);
  expect(mockSyncLibrary).toHaveBeenCalledTimes(1);

  await act(async () => {
    client.__emitAuthStateChange('TOKEN_REFRESHED', { user: { id: 'user-1' } });
  });

  expect(mockSyncLibrary).toHaveBeenCalledTimes(1);
});

test('rester signedIn (pas de transition) ne redéclenche pas syncLibrary', async () => {
  const client = makeFakeClient(null);
  await mount(client);

  await act(async () => {
    client.__emitAuthStateChange('SIGNED_IN', { user: { id: 'user-1' } });
  });
  expect(mockSyncLibrary).toHaveBeenCalledTimes(1);

  // Un second événement qui ne change pas le statut logique (toujours une
  // session, toujours 'signedIn') ne doit pas recompter comme une nouvelle
  // connexion.
  await act(async () => {
    client.__emitAuthStateChange('TOKEN_REFRESHED', { user: { id: 'user-1' } });
  });

  expect(mockSyncLibrary).toHaveBeenCalledTimes(1);
});

test('déconnexion puis reconnexion déclenche une nouvelle synchro (deux vraies connexions)', async () => {
  const client = makeFakeClient(null);
  await mount(client);

  await act(async () => {
    client.__emitAuthStateChange('SIGNED_IN', { user: { id: 'user-1' } });
  });
  expect(mockSyncLibrary).toHaveBeenCalledTimes(1);

  await act(async () => {
    client.__emitAuthStateChange('SIGNED_OUT', null);
  });
  expect(mockSyncLibrary).toHaveBeenCalledTimes(1);

  await act(async () => {
    client.__emitAuthStateChange('SIGNED_IN', { user: { id: 'user-1' } });
  });
  expect(mockSyncLibrary).toHaveBeenCalledTimes(2);
});

test('sans client configuré : jamais de synchro (rien à observer)', async () => {
  await mount(null);
  expect(mockSyncLibrary).not.toHaveBeenCalled();
});
