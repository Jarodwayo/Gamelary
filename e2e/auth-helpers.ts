import type { Page } from '@playwright/test';

// AuthGate (voir src/components/auth-gate.tsx) bloque désormais l'accès
// aux onglets tant que `signedIn` n'est pas atteint (voir
// ARCHITECTURE.md §9.7) : toute spec E2E qui teste un écran DERRIÈRE ce
// verrou (Bibliothèque, Explorer, Profil et ses sous-écrans) doit donc
// démarrer déjà connectée. Dérouler un vrai flux Google/e-mail est exclu
// en CI (aucun projet Supabase réel n'existe ici, voir
// playwright.config.ts) — on simule à la place une session déjà persistée,
// exactement comme les specs existantes pré-écrivent déjà l'état du store
// de jeux dans localStorage avant le premier rendu.
//
// Référence de projet fixée en dur, partagée avec playwright.config.ts
// (EXPO_PUBLIC_SUPABASE_URL) : supabase-js dérive lui-même la clé de
// storage de session à partir du host de cette URL
// (`sb-<ref>-auth-token`, vérifié empiriquement — ce n'est pas documenté
// publiquement par le SDK) ; les deux doivent donc pointer sur la même
// valeur pour que la session pré-écrite soit lue sous la bonne clé.
export const E2E_SUPABASE_PROJECT_REF = 'e2etestproject000000';
export const E2E_SUPABASE_URL = `https://${E2E_SUPABASE_PROJECT_REF}.supabase.co`;
export const E2E_SUPABASE_ANON_KEY = 'e2e-fake-anon-key';

const SUPABASE_AUTH_STORAGE_KEY = `sb-${E2E_SUPABASE_PROJECT_REF}-auth-token`;

// `expires_at` dans le futur : GoTrueClient.getSession() lit ce Session
// directement depuis le storage et le renvoie tel quel sans le moindre
// appel réseau tant qu'il n'est pas expiré (vérifié directement contre le
// SDK avant d'écrire ce fichier) — contrairement à un token expiré/absent,
// qui déclencherait une tentative de rafraîchissement contre une URL
// fictive, donc un échec réseau.
function fakeSession() {
  return {
    access_token: 'e2e-fake-access-token',
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    refresh_token: 'e2e-fake-refresh-token',
    user: {
      id: '00000000-0000-0000-0000-000000000000',
      aud: 'authenticated',
      role: 'authenticated',
      email: 'e2e@example.com',
      app_metadata: {},
      user_metadata: {},
      created_at: new Date().toISOString(),
    },
  };
}

// Idempotent comme les autres seeds de ce dossier (addInitScript rejoue à
// chaque navigation) : n'écrase jamais une session déjà présente, pour ne
// pas interférer avec un test qui appellerait signOut() puis re-naviguerait.
export async function seedSignedInSession(page: Page) {
  await page.addInitScript(
    ([key, session]) => {
      if (!localStorage.getItem(key as string)) {
        localStorage.setItem(key as string, JSON.stringify(session));
      }
    },
    [SUPABASE_AUTH_STORAGE_KEY, fakeSession()] as const
  );
}
