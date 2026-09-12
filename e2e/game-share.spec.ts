import { expect, test, type Page } from '@playwright/test';

import { seedSignedInSession } from './auth-helpers';

// Formalise le bug remonté (menu ⋯ de la fiche jeu, "Partager" ne faisait
// rien au clic, voir library/[id].tsx) : Chromium headless n'implémente pas
// navigator.share (voir react-native-web/Share), donc Share.share() rejette
// systématiquement ici — exactement le cas que le clic silencieux masquait.
// Ce test vérifie le repli presse-papiers plutôt que la vraie feuille
// système, qui n'existe pas dans cet environnement (comme pour la
// vérification manuelle faite avant d'écrire ce fichier : `expo start
// --web` + ce même Chromium, même constat).

const SEED_STATE = {
  games: {
    'jeu-steam': {
      id: 'jeu-steam',
      title: 'Jeu Steam Test',
      platform: 'PC',
      steamAppId: 413150,
      inLibrary: true,
      stopped: false,
      achievements: [],
      playSessions: [],
    },
    'jeu-sans-steam': {
      id: 'jeu-sans-steam',
      title: 'Jeu Sans Steam',
      platform: 'Nintendo Switch',
      inLibrary: true,
      stopped: false,
      achievements: [],
      playSessions: [],
    },
  },
  lists: {
    favoris: { id: 'favoris', name: 'Favoris', builtin: true, gameIds: [] },
    wishlist: { id: 'wishlist', name: 'Wishlist', builtin: true, gameIds: [] },
  },
  settings: {},
};

async function seedGameStore(page: Page) {
  await page.addInitScript((state) => {
    localStorage.setItem('gamelary/game-store/v5', JSON.stringify(state));
  }, SEED_STATE);
}

async function openShareMenu(page: Page, gameId: string) {
  await page.goto(`/library/${gameId}`);
  await page.getByLabel("Plus d'options").click();
  await page.getByText('Partager').click();
}

test.beforeEach(async ({ page }) => {
  await seedSignedInSession(page);
});

test.describe('partage de la fiche jeu', () => {
  test.use({ permissions: ['clipboard-read', 'clipboard-write'] });

  test('jeu avec steamAppId : partage (repli presse-papiers) le titre et le lien Steam', async ({
    page,
  }) => {
    await seedGameStore(page);
    await openShareMenu(page, 'jeu-steam');

    const expectedLink = 'https://store.steampowered.com/app/413150';
    await expect(page.getByText(`Lien copié : ${expectedLink}`)).toBeVisible();
    // La confirmation visuelle ne prouve pas à elle seule que le
    // presse-papiers a reçu quelque chose : on relit son contenu réel,
    // même vérification que profile-identity.spec.ts pour le même motif.
    await expect
      .poll(() => page.evaluate(() => navigator.clipboard.readText()))
      .toBe(`Jeu Steam Test sur Gamelary\n${expectedLink}`);
  });

  test("jeu sans steamAppId : partage seulement le titre, aucun lien inventé", async ({ page }) => {
    await seedGameStore(page);
    await openShareMenu(page, 'jeu-sans-steam');

    await expect(page.getByText('Copié dans le presse-papiers.')).toBeVisible();
    await expect
      .poll(() => page.evaluate(() => navigator.clipboard.readText()))
      .toBe('Jeu Sans Steam sur Gamelary');
  });
});
