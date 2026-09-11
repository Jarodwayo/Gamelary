import { expect, test, type Page } from '@playwright/test';

import { seedSignedInSession } from './auth-helpers';

// Deux boutons manquants, en symétrie avec ce qui existe déjà :
// 1. Écran d'une liste personnalisée (profile/list/[id].tsx) : jusqu'ici,
//    le seul moyen de retirer un jeu était de rouvrir le sélecteur
//    (game-picker-sheet.tsx) et de retaper sur le jeu déjà coché — pas
//    assez découvrable. Bouton de retrait directement sur chaque carte de
//    la grille.
// 2. Fiche jeu : "Ajouter à ma bibliothèque" existait déjà (affiché quand
//    !game.inLibrary) sans pendant symétrique "Retirer de ma bibliothèque"
//    (game.inLibrary === true).

const STORAGE_KEY = 'gamelary/game-store/v5';

const SEED_STATE = {
  games: {
    'jeu-en-bibliotheque': {
      id: 'jeu-en-bibliotheque',
      title: 'Jeu En Bibliothèque',
      platform: 'PC',
      inLibrary: true,
      stopped: false,
      achievements: [],
      playSessions: [],
    },
    'jeu-note': {
      id: 'jeu-note',
      title: 'Jeu Noté',
      platform: 'PC',
      inLibrary: true,
      stopped: false,
      rating: 18,
      achievements: [],
      playSessions: [],
    },
  },
  lists: {
    favoris: { id: 'favoris', name: 'Favoris', builtin: true, gameIds: [] },
    wishlist: { id: 'wishlist', name: 'Wishlist', builtin: true, gameIds: [] },
    'liste-perso': {
      id: 'liste-perso',
      name: 'Liste Perso',
      builtin: false,
      gameIds: ['jeu-en-bibliotheque', 'jeu-note'],
    },
  },
  settings: {},
};

async function seedStore(page: Page, state: Record<string, unknown> = {}) {
  await page.addInitScript(
    ([key, value]) => localStorage.setItem(key as string, JSON.stringify(value)),
    [STORAGE_KEY, { ...SEED_STATE, ...state }] as const
  );
}

async function readStore(page: Page) {
  return page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), STORAGE_KEY);
}

test.beforeEach(async ({ page }) => {
  await seedSignedInSession(page);
});

test.describe('retirer un jeu d’une liste depuis sa grille', () => {
  test('le bouton de retrait sur la carte retire le jeu, sans toucher à la bibliothèque', async ({
    page,
  }) => {
    await seedStore(page);
    await page.goto('/profile/list/liste-perso');

    await expect(page.getByText('2 jeux')).toBeVisible();

    await page.getByLabel('Retirer Jeu Noté de la liste').click();

    await expect(page.getByText('1 jeu', { exact: true })).toBeVisible();
    await expect(page.getByText('Jeu Noté')).toHaveCount(0);
    await expect(page.getByText('Jeu En Bibliothèque')).toBeVisible();

    const store = await readStore(page);
    expect(store.lists['liste-perso'].gameIds).toEqual(['jeu-en-bibliotheque']);
    // Retirer d'UNE liste n'est pas retirer de la bibliothèque : les deux
    // restent des actions indépendantes (toggleListMembership ne touche
    // jamais inLibrary).
    expect(store.games['jeu-note'].inLibrary).toBe(true);
    expect(store.games['jeu-note'].rating).toBe(18);
  });

  test('retirer le dernier jeu affiche l’état vide avec le lien "Ajouter un jeu"', async ({ page }) => {
    await seedStore(page, {
      lists: {
        ...SEED_STATE.lists,
        'liste-perso': { id: 'liste-perso', name: 'Liste Perso', builtin: false, gameIds: ['jeu-note'] },
      },
    });
    await page.goto('/profile/list/liste-perso');

    await page.getByLabel('Retirer Jeu Noté de la liste').click();

    await expect(page.getByText('Aucun jeu dans cette liste pour le moment.')).toBeVisible();
    await expect(page.getByText('+ Ajouter un jeu')).toBeVisible();
  });
});

test.describe('retirer un jeu de la bibliothèque depuis sa fiche', () => {
  test('le bouton "Retirer de ma bibliothèque" repasse inLibrary à false sans effacer le reste', async ({
    page,
  }) => {
    await seedStore(page);
    await page.goto('/library/jeu-note');

    await expect(page.getByText('Retirer de ma bibliothèque')).toBeVisible();
    await expect(page.getByText('Ajouter à ma bibliothèque')).toHaveCount(0);

    await page.getByText('Retirer de ma bibliothèque').click();

    // Le bouton bascule vers son pendant symétrique.
    await expect(page.getByText('Ajouter à ma bibliothèque')).toBeVisible();
    await expect(page.getByText('Retirer de ma bibliothèque')).toHaveCount(0);

    const store = await readStore(page);
    expect(store.games['jeu-note'].inLibrary).toBe(false);
    // La note survit au retrait — c'est justement ce qui garde ce jeu
    // synchronisé (isSyncWorthy, sync-service.ts) malgré inLibrary: false.
    expect(store.games['jeu-note'].rating).toBe(18);
  });

  test('un jeu absent de la bibliothèque ne propose que "Ajouter"', async ({ page }) => {
    await seedStore(page, {
      games: {
        ...SEED_STATE.games,
        'jeu-hors-bibliotheque': {
          id: 'jeu-hors-bibliotheque',
          title: 'Jeu Hors Bibliothèque',
          platform: 'PC',
          inLibrary: false,
          stopped: false,
          achievements: [],
          playSessions: [],
        },
      },
    });
    await page.goto('/library/jeu-hors-bibliotheque');

    await expect(page.getByText('Ajouter à ma bibliothèque')).toBeVisible();
    await expect(page.getByText('Retirer de ma bibliothèque')).toHaveCount(0);
  });
});
