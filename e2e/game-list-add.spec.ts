import { expect, test, type Page } from '@playwright/test';

import { seedSignedInSession } from './auth-helpers';

// Deux points d'entrée cassés/manquants pour ajouter un jeu à une liste,
// remontés en usage réel :
// 1. Fiche jeu, menu ⋯ "Ajouter à une liste" : le sélecteur (list-picker-
//    sheet.tsx) était déjà câblé, mais présenter sa <Modal> juste après la
//    fermeture de celle du menu ⋯ (même tick) peut faire disparaître
//    silencieusement la présentation du second Modal sur natif — jamais
//    reproduit sur le web (voir overflow-menu.tsx et son test unitaire),
//    d'où ce bug qui ne pouvait pas être remonté ici, seulement en
//    formalisant que le flux reste correct une fois le délai en place.
// 2. Écran d'une liste personnalisée : n'existait tout simplement pas avant
//    ce correctif (une liste créée n'était qu'une rangée en lecture seule
//    du Profil) — nouvel écran (profile/list/[id].tsx) + nouveau sélecteur
//    symétrique (game-picker-sheet.tsx, "jeux pour une liste" plutôt que
//    "listes pour un jeu").

const STORAGE_KEY = 'gamelary/game-store/v5';

const SEED_STATE = {
  games: {
    'jeu-hors-bibliotheque': {
      id: 'jeu-hors-bibliotheque',
      title: 'Jeu Hors Bibliothèque',
      platform: 'PC',
      inLibrary: false,
      stopped: false,
      achievements: [],
      playSessions: [],
    },
    'jeu-connu': {
      id: 'jeu-connu',
      title: 'Jeu Déjà Connu',
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
    'liste-perso': { id: 'liste-perso', name: 'Liste Perso', builtin: false, gameIds: [] },
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

test.describe('point d’entrée 1 : fiche jeu -> menu ⋯ -> "Ajouter à une liste"', () => {
  test('ajoute un jeu qui n’est PAS dans la bibliothèque à la Wishlist, sans l’y ajouter', async ({
    page,
  }) => {
    await seedStore(page);
    await page.goto('/library/jeu-hors-bibliotheque');
    await page.getByLabel("Plus d'options").click();
    await page.getByText('Ajouter à une liste').click();

    // La feuille s'ouvre bien (voir le test unitaire du délai
    // d'overflow-menu.tsx pour le mécanisme) et propose la Wishlist.
    await expect(page.getByText('Wishlist')).toBeVisible();
    await page.getByText('Wishlist').click();
    await page.getByText('Terminé', { exact: true }).click();

    const store = await readStore(page);
    expect(store.lists.wishlist.gameIds).toContain('jeu-hors-bibliotheque');
    // Le point important du ticket : ajouter à la wishlist ne force PAS un
    // ajout à la bibliothèque (comportement déjà prévu côté sync, voir
    // ARCHITECTURE.md).
    expect(store.games['jeu-hors-bibliotheque'].inLibrary).toBe(false);
  });

  test('crée une nouvelle liste à la volée et y ajoute le jeu immédiatement', async ({ page }) => {
    await seedStore(page);
    await page.goto('/library/jeu-connu');
    await page.getByLabel("Plus d'options").click();
    await page.getByText('Ajouter à une liste').click();

    await page.getByText('+ Créer une liste').click();
    await page.getByPlaceholder('Nom de la liste').fill('Coups de cœur');
    await page.getByPlaceholder('Nom de la liste').press('Enter');
    await page.getByText('Terminé', { exact: true }).click();

    const store = await readStore(page);
    const created = Object.values(store.lists as Record<string, { name: string; gameIds: string[] }>).find(
      (list) => list.name === 'Coups de cœur'
    );
    expect(created?.gameIds).toEqual(['jeu-connu']);
  });
});

test.describe('point d’entrée 2 : profil -> rangée d’une liste -> écran de la liste -> "+"', () => {
  test('la rangée d’une liste personnalisée mène à son écran dédié', async ({ page }) => {
    await seedStore(page);
    await page.goto('/profile');
    await page.getByText('Liste Perso').click();

    await expect(page).toHaveURL(/\/profile\/list\/liste-perso/);
    // .last() : le Profil reste monté sous cet écran poussé par-dessus (pile
    // de navigation expo-router) et affiche le même texte vide pour sa
    // propre rangée de cette liste — les deux coexistent dans le DOM, seul
    // l'écran de la liste (ajouté en dernier) est réellement à l'écran.
    await expect(page.getByText('Aucun jeu dans cette liste pour le moment.').last()).toBeVisible();
  });

  test('ajoute un jeu déjà connu localement (bibliothèque ou déjà croisé) sans appel réseau', async ({
    page,
  }) => {
    await seedStore(page);
    // Un appel à /api/games ici signalerait que le sélecteur a MANQUÉ le
    // jeu déjà connu localement et est reparti chercher sur IGDB à tort —
    // échec bruyant plutôt qu'un faux positif silencieux.
    await page.route('**/api/games*', (route) => route.abort());

    await page.goto('/profile/list/liste-perso');
    await page.getByLabel('Ajouter un jeu').click();
    await page.getByPlaceholder("Titre d'un jeu").fill('Déjà Connu');

    const sheet = page.getByLabel('Fermer');
    await expect(sheet.getByText('Jeu Déjà Connu')).toBeVisible();
    await sheet.getByText('Jeu Déjà Connu').click();
    await page.getByText('Terminé', { exact: true }).click();

    const store = await readStore(page);
    expect(store.lists['liste-perso'].gameIds).toEqual(['jeu-connu']);

    // Reflété immédiatement sur l'écran de la liste, sans recharger.
    await expect(page.getByText('1 jeu')).toBeVisible();
    await expect(page.getByText('Jeu Déjà Connu')).toBeVisible();
  });

  test('un titre inconnu localement retombe sur une recherche IGDB et l’ajoute dès trouvé', async ({
    page,
  }) => {
    await seedStore(page);
    await page.route('**/api/games?title=*', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          title: 'Jeu Jamais Croisé',
          platform: 'PC',
          steamAppId: null,
          igdbId: 777,
          summary: null,
        }),
      })
    );

    await page.goto('/profile/list/liste-perso');
    await page.getByLabel('Ajouter un jeu').click();
    await page.getByPlaceholder("Titre d'un jeu").fill('Jeu Jamais Croisé');

    await page.getByText('Chercher « Jeu Jamais Croisé » sur IGDB').click();
    await page.getByText('Terminé', { exact: true }).click();

    const store = await readStore(page);
    const created = Object.values(store.games as Record<string, { title: string; id: string }>).find(
      (game) => game.title === 'Jeu Jamais Croisé'
    );
    expect(created).toBeTruthy();
    expect(store.lists['liste-perso'].gameIds).toEqual([created!.id]);
  });

  test('aucun résultat IGDB : message explicite, rien d’ajouté', async ({ page }) => {
    await seedStore(page);
    await page.route('**/api/games?title=*', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ title: null, platform: null }),
      })
    );

    await page.goto('/profile/list/liste-perso');
    await page.getByLabel('Ajouter un jeu').click();
    await page.getByPlaceholder("Titre d'un jeu").fill('Introuvable Sur IGDB');
    await page.getByText('Chercher « Introuvable Sur IGDB » sur IGDB').click();

    await expect(page.getByText('Aucun jeu trouvé pour « Introuvable Sur IGDB ».')).toBeVisible();
    const store = await readStore(page);
    expect(store.lists['liste-perso'].gameIds).toEqual([]);
  });
});
