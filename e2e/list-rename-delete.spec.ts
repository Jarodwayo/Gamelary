import { expect, test, type Page } from '@playwright/test';

import { seedSignedInSession } from './auth-helpers';

// Renommer/supprimer une liste personnalisée (voir ARCHITECTURE.md
// « Suppression et renommage d'une liste ») — jusqu'ici, une fois créée, une
// liste ne pouvait ni être renommée ni supprimée : le seul bouton présent
// sur son écran dédié (profile/list/[id].tsx) servait à ajouter un jeu, pas
// à gérer la liste elle-même. Favoris/Wishlist (listes intégrées) restent
// volontairement hors de portée de ces deux actions.
//
// La confirmation de suppression passe par une <Modal> maison
// (DeleteListSheet), jamais Alert.alert : ce dernier est un NO-OP sur
// react-native-web (voir son commentaire dans le composant) — impossible à
// piloter depuis Playwright de toute façon, puisqu'il n'affiche rien du
// tout sur cette plateforme.

const STORAGE_KEY = 'gamelary/game-store/v5';

const SEED_STATE = {
  games: {
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
    'liste-perso': {
      id: 'liste-perso',
      name: 'Liste Perso',
      builtin: false,
      updatedAt: 1,
      gameIds: ['jeu-connu'],
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

test.describe('menu réglages : réservé aux listes créées par l’utilisateur', () => {
  test('Favoris (liste intégrée) : pas de bouton réglages, seulement "Ajouter un jeu"', async ({ page }) => {
    await seedStore(page);
    await page.goto('/profile/list/favoris');

    await expect(page.getByLabel('Ajouter un jeu')).toBeVisible();
    await expect(page.getByLabel('Réglages de la liste')).toHaveCount(0);
  });

  test('liste créée par l’utilisateur : le bouton réglages propose Renommer et Supprimer', async ({ page }) => {
    await seedStore(page);
    await page.goto('/profile/list/liste-perso');

    await page.getByLabel('Réglages de la liste').click();
    await expect(page.getByText('Renommer')).toBeVisible();
    await expect(page.getByText('Supprimer la liste')).toBeVisible();
  });
});

test.describe('renommer une liste', () => {
  test('change le nom affiché et persisté, sans toucher aux jeux qu’elle contient', async ({ page }) => {
    await seedStore(page);
    await page.goto('/profile/list/liste-perso');

    await page.getByLabel('Réglages de la liste').click();
    await page.getByText('Renommer').click();

    const input = page.getByPlaceholder('Nom de la liste');
    await expect(input).toHaveValue('Liste Perso');
    await input.fill('Metroidvanias');
    await page.getByLabel('Confirmer le renommage').click();

    // Reflété immédiatement dans le titre de l'écran, sans recharger.
    await expect(page.getByRole('heading', { name: 'Metroidvanias' }).or(page.getByText('Metroidvanias')).first()).toBeVisible();

    const store = await readStore(page);
    expect(store.lists['liste-perso'].name).toBe('Metroidvanias');
    expect(store.lists['liste-perso'].gameIds).toEqual(['jeu-connu']);
  });

  test('bouton désactivé tant que le nom est vide ou inchangé', async ({ page }) => {
    await seedStore(page);
    await page.goto('/profile/list/liste-perso');

    await page.getByLabel('Réglages de la liste').click();
    await page.getByText('Renommer').click();

    const confirm = page.getByLabel('Confirmer le renommage');
    // Inchangé (même nom resoumis) : pas de raison de l'activer.
    await expect(confirm).toBeDisabled();

    const input = page.getByPlaceholder('Nom de la liste');
    await input.fill('   ');
    await expect(confirm).toBeDisabled();

    await input.fill('Un vrai nouveau nom');
    await expect(confirm).toBeEnabled();
  });
});

test.describe('supprimer une liste', () => {
  test('Annuler : la liste et son contenu restent intacts', async ({ page }) => {
    await seedStore(page);
    await page.goto('/profile/list/liste-perso');

    await page.getByLabel('Réglages de la liste').click();
    await page.getByText('Supprimer la liste').click();

    await expect(page.getByText('Supprimer cette liste ?')).toBeVisible();
    await page.getByText('Annuler', { exact: true }).click();

    await expect(page).toHaveURL(/\/profile\/list\/liste-perso/);
    const store = await readStore(page);
    expect(store.lists['liste-perso'].deletedAt).toBeUndefined();
    expect(store.lists['liste-perso'].gameIds).toEqual(['jeu-connu']);
  });

  test('Supprimer : tombstone posé, gameIds vidés, jeu contenu conservé dans la bibliothèque, retour au Profil', async ({
    page,
  }) => {
    await seedStore(page);

    // Navigation par un vrai clic (pas page.goto) : router.back() ci-dessous
    // dépend de la pile de navigation d'expo-router, pas seulement de
    // l'historique brut du navigateur.
    await page.goto('/profile');
    await expect(page.getByText('Liste Perso')).toBeVisible();
    await page.getByText('Liste Perso').click();
    await expect(page).toHaveURL(/\/profile\/list\/liste-perso/);

    await page.getByLabel('Réglages de la liste').click();
    await page.getByText('Supprimer la liste').click();
    await page.getByLabel('Confirmer la suppression').click();

    // Revenu sur le Profil, où la liste supprimée n'apparaît plus.
    await expect(page).toHaveURL(/\/profile$/);
    await expect(page.getByText('Liste Perso')).toHaveCount(0);

    const store = await readStore(page);
    expect(store.lists['liste-perso'].deletedAt).toBeDefined();
    expect(store.lists['liste-perso'].gameIds).toEqual([]);
    // Le jeu qu'elle contenait reste connu et dans la bibliothèque — seule
    // l'appartenance à CETTE liste disparaît, jamais le jeu lui-même.
    expect(store.games['jeu-connu']).toMatchObject({ id: 'jeu-connu', inLibrary: true });
  });

  test('liste déjà supprimée : "Ajouter à une liste" depuis une fiche jeu ne la propose plus', async ({ page }) => {
    await seedStore(page, {
      lists: {
        ...SEED_STATE.lists,
        'liste-perso': { ...SEED_STATE.lists['liste-perso'], deletedAt: Date.now(), gameIds: [] },
      },
    });
    await page.goto('/library/jeu-connu');
    await page.getByLabel("Plus d'options").click();
    await page.getByText('Ajouter à une liste').click();

    await expect(page.getByText('Favoris')).toBeVisible();
    await expect(page.getByText('Liste Perso')).toHaveCount(0);
  });
});
