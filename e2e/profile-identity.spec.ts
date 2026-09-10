import { expect, test, type Page } from '@playwright/test';

import { seedSignedInSession } from './auth-helpers';

// Profil : photo + arrière-plan, édition de l'identité, partage du lien
// (voir profile/index.tsx, profile/edit.tsx). Même approche que
// steam-library-import.spec.ts — état de départ écrit dans localStorage
// avant le démarrage de l'app, puis vérification de ce que l'app a écrit en
// retour, plutôt que de se fier au seul rendu.

const STORAGE_KEY = 'gamelary/game-store/v5';

// Base publique figée par playwright.config.ts (EXPO_PUBLIC_PROFILE_BASE_URL)
// : sans elle, le lien retomberait sur l'origine du serveur de dev et
// l'assertion dépendrait du port — et un .env local qui renseignerait cette
// variable ferait échouer le test.
const PROFILE_BASE_URL = 'https://gamelary.test.invalid';

// Images 1x1 valides : le sélecteur d'images du web lit un vrai File et en
// mesure la largeur/hauteur (voir readFile dans expo-image-picker), donc un
// buffer arbitraire ne suffirait pas. Deux formats différents (PNG pour
// l'arrière-plan, GIF pour la photo) plutôt que deux fois le même fichier :
// c'est ce qui permet de vérifier que chaque image atterrit bien dans SON
// champ, et pas que les deux pointent vers la dernière choisie.
const PNG_1X1_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const GIF_1X1_BASE64 = 'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

const SEED_STATE = {
  games: {},
  lists: {
    favoris: { id: 'favoris', name: 'Favoris', builtin: true, gameIds: [] },
    wishlist: { id: 'wishlist', name: 'Wishlist', builtin: true, gameIds: [] },
  },
  settings: {},
};

// N'écrit l'état de départ que s'il n'y en a pas déjà un : addInitScript
// rejoue à CHAQUE navigation du contexte, donc écrire inconditionnellement
// effacerait ce que l'app vient d'enregistrer dès qu'un test change d'écran
// (ex. retour au profil après avoir choisi une image).
async function seedStore(page: Page, settings: Record<string, unknown> = {}) {
  await page.addInitScript(
    ([key, state]) => {
      if (!localStorage.getItem(key as string)) {
        localStorage.setItem(key as string, JSON.stringify(state));
      }
    },
    [STORAGE_KEY, { ...SEED_STATE, settings }] as const
  );
}

async function readProfile(page: Page) {
  return page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)!).settings.profile ?? {},
    STORAGE_KEY
  );
}

async function openProfileMenu(page: Page) {
  await page.goto('/profile');
  await page.getByLabel("Plus d'options").click();
}

// AuthGate (voir ARCHITECTURE.md §9.7) bloque tout écran tant que
// `signedIn` n'est pas atteint : chaque test de ce fichier a besoin d'une
// session déjà valide pour atteindre le Profil qu'il teste réellement.
test.beforeEach(async ({ page }) => {
  await seedSignedInSession(page);
});

test('identité par défaut tant que rien n’est personnalisé', async ({ page }) => {
  await seedStore(page);
  await page.goto('/profile');

  // Mêmes valeurs qu'avant l'écran d'édition (anciennes constantes
  // DISPLAY_NAME/DISPLAY_HANDLE) : ajouter la personnalisation ne doit pas
  // laisser un profil vide à celui qui n'y touche jamais.
  await expect(page.getByText('Joueur', { exact: true })).toBeVisible();
  await expect(page.getByText('@joueur', { exact: true })).toBeVisible();
});

test('modifier le profil : nom, identifiant et bio enregistrés puis affichés', async ({ page }) => {
  await seedStore(page);
  await openProfileMenu(page);
  await page.getByText('Modifier le profil').click();

  await page.getByPlaceholder('Ton nom').fill('Jarod Wayo');
  // Saisie volontairement "sale" : l'identifiant est normalisé à la frappe
  // (majuscules, espace et ponctuation retirés), pas seulement au moment
  // d'enregistrer.
  await page.getByPlaceholder('identifiant').fill('Jarod Wayo!');
  await expect(page.getByPlaceholder('identifiant')).toHaveValue('jarodwayo');
  await page.getByPlaceholder('(facultatif)').fill('Je joue surtout à des metroidvanias.');
  await page.getByText('Enregistrer').click();

  await expect(page.getByText('Jarod Wayo', { exact: true })).toBeVisible();
  await expect(page.getByText('@jarodwayo', { exact: true })).toBeVisible();
  await expect(page.getByText('Je joue surtout à des metroidvanias.')).toBeVisible();

  expect(await readProfile(page)).toMatchObject({
    displayName: 'Jarod Wayo',
    username: 'jarodwayo',
    bio: 'Je joue surtout à des metroidvanias.',
  });
});

test('identifiant invalide : refusé avec un message, rien enregistré', async ({ page }) => {
  await seedStore(page);
  await openProfileMenu(page);
  await page.getByText('Modifier le profil').click();

  await page.getByPlaceholder('Ton nom').fill('Ana');
  // Trop court une fois normalisé (2 caractères) : le seul cas où
  // l'enregistrement doit s'arrêter au lieu d'écrire un identifiant
  // inutilisable dans une URL de profil.
  await page.getByPlaceholder('identifiant').fill('ab');
  await page.getByText('Enregistrer').click();

  await expect(page.getByText(/L'identifiant doit faire au moins 3 caractères/)).toBeVisible();
  expect(await readProfile(page)).toEqual({});
});

test('photo de profil et arrière-plan se choisissent séparément', async ({ page }) => {
  await seedStore(page);
  await openProfileMenu(page);
  await page.getByText('Modifier le profil').click();

  // Le sélecteur web d'expo-image-picker crée un <input type="file"> et le
  // déclenche : Playwright l'expose comme un filechooser, à écouter AVANT
  // le clic sous peine de le voir annulé automatiquement.
  const backgroundChooser = page.waitForEvent('filechooser');
  await page.getByText('Ajouter un arrière-plan').click();
  await (await backgroundChooser).setFiles({
    name: 'background.png',
    mimeType: 'image/png',
    buffer: Buffer.from(PNG_1X1_BASE64, 'base64'),
  });

  await expect.poll(async () => (await readProfile(page)).backgroundUri).toContain('data:image/png;base64,');
  // Choisir l'arrière-plan ne doit pas toucher à la photo de profil : ce
  // sont deux images distinctes, pas un seul champ "image du profil".
  expect((await readProfile(page)).avatarUri).toBeUndefined();

  const avatarChooser = page.waitForEvent('filechooser');
  await page.getByLabel('Changer la photo de profil').click();
  await (await avatarChooser).setFiles({
    name: 'avatar.gif',
    mimeType: 'image/gif',
    buffer: Buffer.from(GIF_1X1_BASE64, 'base64'),
  });

  await expect.poll(async () => (await readProfile(page)).avatarUri).toContain('data:image/gif;base64,');

  // Les deux images cohabitent, chacune dans son champ : choisir la photo
  // n'a pas remplacé l'arrière-plan choisi juste avant.
  const profile = await readProfile(page);
  expect(profile.backgroundUri).toContain('data:image/png;base64,');
  expect(profile.avatarUri).not.toBe(profile.backgroundUri);

  // Et l'arrière-plan choisi est bien rendu derrière l'avatar sur le profil.
  // getByAltText : expo-image rend `accessibilityLabel` en `alt` sur le web
  // (voir web/ImageWrapper.tsx), là où c'est une vraie étiquette
  // d'accessibilité sur natif.
  await page.goto('/profile');
  await expect(page.getByAltText('Arrière-plan du profil')).toBeVisible();
});

test.describe('partage du lien de profil', () => {
  test.use({ permissions: ['clipboard-read', 'clipboard-write'] });

  test('copie le lien public et confirme visuellement', async ({ page }) => {
    await seedStore(page, { profile: { username: 'jarodwayo' } });
    await openProfileMenu(page);
    await page.getByText('Partager le profil').click();

    const expectedLink = `${PROFILE_BASE_URL}/u/jarodwayo`;
    await expect(page.getByText(`Lien copié : ${expectedLink}`)).toBeVisible();
    // La confirmation ne prouve pas à elle seule que le presse-papiers a
    // reçu quelque chose : on relit son contenu réel.
    await expect
      .poll(() => page.evaluate(() => navigator.clipboard.readText()))
      .toBe(expectedLink);
  });
});
