// Helpers purs de l'identité de profil (voir profile.ts) : testables sans
// runtime Expo ni rendu React, contrairement à la résolution de la base du
// lien (profile-link.ts), qui dépend de `window`/du schéma natif et reste
// vérifiée par le test E2E Playwright.
import {
  DEFAULT_DISPLAY_NAME,
  DEFAULT_USERNAME,
  USERNAME_MAX_LENGTH,
  displayNameOf,
  handleOf,
  isValidUsername,
  normalizeUsername,
  profileLink,
  usernameOf,
} from '@/lib/profile';

describe('valeurs par défaut', () => {
  test('profil absent ou champs vides : retombe sur le nom/identifiant par défaut', () => {
    expect(displayNameOf(undefined)).toBe(DEFAULT_DISPLAY_NAME);
    expect(usernameOf(undefined)).toBe(DEFAULT_USERNAME);
    // Un champ présent mais vide (ou seulement des espaces) compte comme
    // absent : sinon le profil afficherait une ligne vide après un
    // enregistrement où l'utilisateur a tout effacé.
    expect(displayNameOf({ displayName: '   ' })).toBe(DEFAULT_DISPLAY_NAME);
    expect(usernameOf({ username: '' })).toBe(DEFAULT_USERNAME);
  });

  test('handleOf préfixe une seule fois, quel que soit le stockage', () => {
    expect(handleOf({ username: 'ana' })).toBe('@ana');
    expect(handleOf(undefined)).toBe(`@${DEFAULT_USERNAME}`);
  });
});

describe('normalizeUsername', () => {
  test('met en minuscules, retire "@", accents, espaces et ponctuation', () => {
    expect(normalizeUsername('  @Jarod Wayo!  ')).toBe('jarodwayo');
    expect(normalizeUsername('Céline_92')).toBe('celine_92');
  });

  test('tronque à la longueur maximale plutôt que de rejeter la saisie', () => {
    expect(normalizeUsername('a'.repeat(USERNAME_MAX_LENGTH + 10))).toHaveLength(USERNAME_MAX_LENGTH);
  });

  test('une saisie sans aucun caractère utilisable donne une chaîne vide (donc invalide)', () => {
    expect(normalizeUsername('!!! ???')).toBe('');
    expect(isValidUsername(normalizeUsername('!!! ???'))).toBe(false);
  });
});

describe('isValidUsername', () => {
  test('accepte lettres/chiffres/underscore à partir de 3 caractères', () => {
    expect(isValidUsername('ana')).toBe(true);
    expect(isValidUsername('jarod_wayo92')).toBe(true);
  });

  test('refuse trop court, trop long, ou hors alphabet autorisé', () => {
    expect(isValidUsername('ab')).toBe(false);
    expect(isValidUsername('a'.repeat(USERNAME_MAX_LENGTH + 1))).toBe(false);
    expect(isValidUsername('Ana')).toBe(false);
    expect(isValidUsername('ana wayo')).toBe(false);
    expect(isValidUsername('ana-wayo')).toBe(false);
  });
});

describe('profileLink', () => {
  test('construit /u/<identifiant> sous la base fournie', () => {
    expect(profileLink('ana', 'https://gamelary.example')).toBe('https://gamelary.example/u/ana');
  });

  test('ne double jamais le slash, quelle que soit la base configurée', () => {
    // La base vient d'une variable d'environnement (voir profile-link.ts) :
    // elle peut très bien être collée avec un slash final.
    expect(profileLink('ana', 'https://gamelary.example/')).toBe('https://gamelary.example/u/ana');
    expect(profileLink('ana', 'https://gamelary.example///')).toBe('https://gamelary.example/u/ana');
  });

  test('encode l\'identifiant même si normalizeUsername le rend déjà sûr', () => {
    // Défense en profondeur : profileLink est exporté séparément de la
    // normalisation, rien ne garantit que tout appelant futur lui passe une
    // valeur déjà normalisée.
    expect(profileLink('a b', 'https://gamelary.example')).toBe('https://gamelary.example/u/a%20b');
  });
});
