import { defineConfig, devices } from '@playwright/test';

// Suite E2E qui formalise les vérifications manuelles faites en ad hoc
// (import de bibliothèque Steam, voir profile/index.tsx) : mêmes scénarios,
// mais répétables et committés plutôt que des scripts jetables dans /tmp.
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: 'list',

  use: {
    baseURL: 'http://localhost:8081',
    trace: 'on-first-retry',
  },

  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],

  // Démarre et arrête Metro/Expo web automatiquement plutôt que de lancer un
  // serveur à la main (start && sleep && curl poll && kill, comme les
  // scripts ad hoc précédents) : Playwright attend que `url` réponde avant
  // de lancer les tests. reuseExistingServer : confort en local (réutilise
  // un serveur déjà lancé), toujours faux en CI (repart propre à chaque
  // run). Timeout généreux : le premier bundle Metro à froid prend souvent
  // 15-30s dans cet environnement.
  webServer: {
    command: 'npx expo start --web --port 8081',
    url: 'http://localhost:8081',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    // EXPO_PUBLIC_STEAM_API_URL committé (.env) pointe vers la vraie
    // instance Render — surchargé ici vers un domaine qui échoue en DNS
    // (.test.invalid, réservé par la RFC 2606) : si un test a un
    // page.route() mal écrit qui ne matche pas la requête, l'appel échoue
    // bruyamment plutôt que de silencieusement taper la vraie API de prod.
    // EXPO_PUBLIC_PROFILE_BASE_URL : figée ici pour que le lien de profil
    // partagé soit prévisible (voir profile-identity.spec.ts). Sans elle,
    // il retomberait sur l'origine du serveur de dev — donc sur le port —
    // et un .env local qui la renseignerait ferait échouer le test.
    env: {
      EXPO_PUBLIC_STEAM_API_URL: 'http://gamelary-api.test.invalid',
      EXPO_PUBLIC_PROFILE_BASE_URL: 'https://gamelary.test.invalid',
    },
  },
});
