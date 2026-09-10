import { expect, test, type Page } from '@playwright/test';

import { seedSignedInSession } from './auth-helpers';

// Création de liste, Aide et idées, et réglage "Affiche de la page titre"
// (voir profile/create-list.tsx, profile/help.tsx,
// profile/settings-artwork.tsx). Même approche que les autres specs : état
// de départ écrit dans localStorage, puis vérification de ce que l'app a
// écrit en retour plutôt que du seul rendu.

const STORAGE_KEY = 'gamelary/game-store/v5';

const SEED_STATE = {
  games: {},
  lists: {
    favoris: { id: 'favoris', name: 'Favoris', builtin: true, gameIds: [] },
    wishlist: { id: 'wishlist', name: 'Wishlist', builtin: true, gameIds: [] },
  },
  settings: {},
};

// Idempotent (voir profile-identity.spec.ts) : addInitScript rejoue à
// chaque navigation, écraser inconditionnellement effacerait ce que l'app
// vient d'enregistrer dès qu'un test change d'écran.
async function seedStore(page: Page, state: Record<string, unknown> = {}) {
  await page.addInitScript(
    ([key, value]) => {
      if (!localStorage.getItem(key as string)) {
        localStorage.setItem(key as string, JSON.stringify(value));
      }
    },
    [STORAGE_KEY, { ...SEED_STATE, ...state }] as const
  );
}

async function readStore(page: Page) {
  return page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), STORAGE_KEY);
}

async function openFromProfileMenu(page: Page, label: string) {
  await page.goto('/profile');
  await page.getByLabel("Plus d'options").click();
  await page.getByText(label).click();
}

// AuthGate (voir ARCHITECTURE.md §9.7) bloque tout écran tant que
// `signedIn` n'est pas atteint : chaque test de ce fichier a besoin d'une
// session déjà valide pour atteindre le Profil qu'il teste réellement.
test.beforeEach(async ({ page }) => {
  await seedSignedInSession(page);
});

test('créer une liste : nom, description et visibilité enregistrés', async ({ page }) => {
  await seedStore(page);
  await openFromProfileMenu(page, 'Créer une liste');

  await page.getByPlaceholder('Nouvelle liste').fill('Metroidvanias');
  await page.getByPlaceholder('(facultatif)').fill('À finir avant la fin de l’année.');
  await page.getByLabel('Créer la liste').click();

  const lists = (await readStore(page)).lists as Record<string, Record<string, unknown>>;
  const created = Object.values(lists).find((list) => list.name === 'Metroidvanias');
  expect(created).toMatchObject({
    name: 'Metroidvanias',
    description: 'À finir avant la fin de l’année.',
    builtin: false,
    gameIds: [],
  });

  // Liste visible : elle apparaît en rangée sur le profil, description
  // comprise.
  await expect(page.getByText('Metroidvanias')).toBeVisible();
  await expect(page.getByText('À finir avant la fin de l’année.')).toBeVisible();
});

test('le bouton reste inactif tant que la liste n’a pas de nom', async ({ page }) => {
  await seedStore(page);
  await openFromProfileMenu(page, 'Créer une liste');

  // Un nom est la seule donnée obligatoire : tant qu'il manque, le bouton
  // est réellement désactivé (pas seulement sans effet), donc rien ne peut
  // être créé par erreur.
  await expect(page.getByLabel('Créer la liste')).toBeDisabled();
  expect(Object.keys((await readStore(page)).lists)).toEqual(['favoris', 'wishlist']);

  // Il s'active dès qu'un nom est saisi.
  await page.getByPlaceholder('Nouvelle liste').fill('Une liste');
  await expect(page.getByLabel('Créer la liste')).toBeEnabled();
});

test('« Ne pas afficher sur le profil » : la liste existe mais reste hors du profil', async ({
  page,
}) => {
  await seedStore(page);
  await openFromProfileMenu(page, 'Créer une liste');

  await page.getByPlaceholder('Nouvelle liste').fill('Plaisirs coupables');
  await page.getByLabel('Ne pas afficher sur le profil').click();
  await page.getByLabel('Créer la liste').click();

  const lists = (await readStore(page)).lists as Record<string, Record<string, unknown>>;
  const created = Object.values(lists).find((list) => list.name === 'Plaisirs coupables');
  expect(created).toMatchObject({ name: 'Plaisirs coupables', hidden: true });

  // C'est tout l'intérêt du réglage : la liste est bien créée (elle reste
  // utilisable depuis la fiche d'un jeu) mais n'apparaît pas sur le profil.
  await expect(page.getByText('Plaisirs coupables')).toHaveCount(0);
});

test('Aide et idées : les trois entrées pointent vers des destinations réelles', async ({ page }) => {
  await seedStore(page);
  await openFromProfileMenu(page, 'Aide et idées');

  // On vérifie les cibles des liens sans les suivre : ce sont des URL
  // externes (GitHub), qu'un test ne doit pas aller charger.
  await expect(page.getByLabel('Demandes de fonctionnalités')).toHaveAttribute(
    'href',
    /github\.com\/Jarodwayo\/Gamelary\/issues/
  );
  await expect(page.getByLabel('Signaler un problème')).toHaveAttribute('href', /labels=bug/);
  await expect(page.getByLabel("Contacter l'assistance")).toHaveAttribute('href', /github\.com|mailto:/);
});

test('réglage de l’affiche : le choix est enregistré et affiché dans les Paramètres', async ({
  page,
}) => {
  await seedStore(page);
  await openFromProfileMenu(page, 'Paramètres');

  // Valeur par défaut (voir DEFAULT_TITLE_ARTWORK) affichée en face de la
  // ligne, avant même d'avoir choisi quoi que ce soit.
  await expect(page.getByText('Arrière-plan')).toBeVisible();
  await page.getByLabel('Affiche de la page titre').click();

  await page.getByText('Affiche', { exact: true }).click();
  await expect.poll(async () => (await readStore(page)).settings.titleArtwork).toBe('poster');

  // De retour sur Paramètres, la ligne reflète le nouveau choix.
  await page.goBack();
  await expect(page.getByText('Affiche', { exact: true })).toBeVisible();
});
