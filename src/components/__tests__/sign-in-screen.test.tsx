// Suite dédiée à SignInScreen (voir son commentaire) : mocke useAuth()
// directement plutôt que de piloter un vrai AuthProvider + client Supabase
// fictif (déjà fait pour la robustesse de bout en bout dans
// auth-store.test.tsx/auth-gate.test.tsx) — ici, c'est le CÂBLAGE du
// composant qui est en jeu (quel bouton appelle quelle méthode, avec quels
// arguments, dans quel ordre d'étapes), pas le comportement réel de
// supabase-js.
import { act, create, type ReactTestInstance } from 'react-test-renderer';

import { useAuth } from '@/lib/auth-store';

import { SignInScreen } from '../sign-in-screen';

jest.mock('@/lib/auth-store', () => ({ useAuth: jest.fn() }));

const mockUseAuth = useAuth as jest.Mock;

type AuthMock = {
  status: 'unconfigured' | 'loading' | 'signedOut' | 'signedIn' | 'passwordRecovery';
  session: null;
  signInWithGoogle: jest.Mock;
  signInWithEmail: jest.Mock;
  signUpWithPassword: jest.Mock;
  signInWithPassword: jest.Mock;
  resetPasswordForEmail: jest.Mock;
  updatePassword: jest.Mock;
  completeSignInFromCode: jest.Mock;
  signOut: jest.Mock;
};

function makeAuthMock(overrides: Partial<AuthMock> = {}): AuthMock {
  return {
    status: 'signedOut',
    session: null,
    signInWithGoogle: jest.fn(async () => ({ error: null })),
    signInWithEmail: jest.fn(async () => ({ error: null })),
    signUpWithPassword: jest.fn(async () => ({ error: null })),
    signInWithPassword: jest.fn(async () => ({ error: null })),
    resetPasswordForEmail: jest.fn(async () => ({ error: null })),
    updatePassword: jest.fn(async () => ({ error: null })),
    completeSignInFromCode: jest.fn(async () => ({ error: null })),
    signOut: jest.fn(async () => {}),
    ...overrides,
  };
}

async function render(authOverrides: Partial<AuthMock> = {}) {
  const auth = makeAuthMock(authOverrides);
  mockUseAuth.mockReturnValue(auth);
  let tree!: ReturnType<typeof create>;
  await act(async () => {
    tree = create(<SignInScreen />);
  });
  return { tree, auth };
}

// Sérialise en JSON plutôt qu'un match de texte exact sur un nœud unique :
// ThemedText éclate son texte en plusieurs nœuds (voir auth-gate.test.tsx,
// même raisonnement).
function renderedText(tree: ReturnType<typeof create>): string {
  return JSON.stringify(tree.toJSON());
}

// Filtré sur la présence d'un onPress fonction, pas sur l'identité du
// composant Pressable (comparer node.type === Pressable échoue : la
// référence importée ici ne matche pas celle résolue dans
// sign-in-screen.tsx, un piège deux-instances-du-même-module déjà vu
// ailleurs sous Jest) : accessibilityLabel est forwardé à la fois par le
// composite Pressable et par la View hôte qu'il rend (accessibilité
// native), mais `onPress` reste une prop réservée au composite — donc
// filtrer sur les deux ensemble retombe forcément sur le bon nœud, sans
// dépendre de quel type exact React lui attribue.
function findByLabel(tree: ReturnType<typeof create>, label: string): ReactTestInstance {
  const matches = tree.root.findAll(
    (node) => node.props.accessibilityLabel === label && typeof node.props.onPress === 'function'
  );
  if (matches.length !== 1) {
    throw new Error(`attendu exactement 1 nœud pressable avec accessibilityLabel="${label}", trouvé ${matches.length}`);
  }
  return matches[0];
}

function hasLabel(tree: ReturnType<typeof create>, label: string): boolean {
  return (
    tree.root.findAll((node) => typeof node.type === 'string' && node.props.accessibilityLabel === label).length > 0
  );
}

async function press(tree: ReturnType<typeof create>, label: string) {
  await act(async () => {
    findByLabel(tree, label).props.onPress();
    // Laisse la promesse du handler (souvent async, appelle auth.signXxx)
    // se résoudre avant que le test ne lise l'état qui en résulte.
    await Promise.resolve();
    await Promise.resolve();
  });
}

afterEach(() => {
  jest.clearAllMocks();
});

test('unconfigured : message explicite, aucune des trois méthodes proposée', async () => {
  const { tree } = await render({ status: 'unconfigured' });
  expect(renderedText(tree)).toContain('pas configurée');
  expect(hasLabel(tree, 'Continuer avec Google')).toBe(false);
});

test("loading : indicateur de chargement, aucune des trois méthodes proposée", async () => {
  const { tree } = await render({ status: 'loading' });
  expect(hasLabel(tree, 'Continuer avec Google')).toBe(false);
  expect(hasLabel(tree, 'Créer un compte avec e-mail et mot de passe')).toBe(false);
});

test('signedOut : les trois méthodes sont visibles dès le premier affichage, aucune cachée', async () => {
  const { tree } = await render();
  expect(hasLabel(tree, 'Continuer avec Google')).toBe(true);
  expect(hasLabel(tree, 'Créer un compte avec e-mail et mot de passe')).toBe(true);
  expect(hasLabel(tree, 'Envoyer le lien de connexion')).toBe(true);
});

test('Google : appelle signInWithGoogle, affiche une erreur éventuelle', async () => {
  const { tree, auth } = await render({
    signInWithGoogle: jest.fn(async () => ({ error: 'Connexion Google refusée' })),
  });

  await press(tree, 'Continuer avec Google');

  expect(auth.signInWithGoogle).toHaveBeenCalledTimes(1);
  expect(renderedText(tree)).toContain('Connexion Google refusée');
});

test('lien magique : inchangé — appelle signInWithEmail avec l’e-mail saisi', async () => {
  const { tree, auth } = await render();

  const input = findByLabel(tree, 'Envoyer le lien de connexion'); // pill désactivée tant que le champ est vide
  expect(input.props.disabled).toBe(true);

  const emailField = tree.root.findByProps({ placeholder: 'toi@exemple.com', keyboardType: 'email-address' });
  await act(async () => {
    emailField.props.onChangeText('jarod@example.com');
  });
  await press(tree, 'Envoyer le lien de connexion');

  expect(auth.signInWithEmail).toHaveBeenCalledWith('jarod@example.com');
});

test('ouvre le formulaire e-mail + mot de passe en mode "créer un compte" par défaut', async () => {
  const { tree } = await render();

  await press(tree, 'Créer un compte avec e-mail et mot de passe');

  expect(hasLabel(tree, 'Créer un compte')).toBe(true);
  expect(hasLabel(tree, 'Déjà un compte ? Se connecter')).toBe(true);
  // Les trois options du premier écran ne sont plus affichées en même
  // temps : "en second temps", pas tout d'un coup (voir la demande).
  expect(hasLabel(tree, 'Continuer avec Google')).toBe(false);
});

test('bascule "déjà un compte ? se connecter" : passe en mode connexion', async () => {
  const { tree } = await render();
  await press(tree, 'Créer un compte avec e-mail et mot de passe');

  await press(tree, 'Déjà un compte ? Se connecter');

  expect(hasLabel(tree, 'Se connecter')).toBe(true);
  expect(hasLabel(tree, 'Pas de compte ? Créer un compte')).toBe(true);
});

test('« Retour » revient aux trois options', async () => {
  const { tree } = await render();
  await press(tree, 'Créer un compte avec e-mail et mot de passe');

  await press(tree, 'Retour');

  expect(hasLabel(tree, 'Continuer avec Google')).toBe(true);
});

async function fillPasswordForm(tree: ReturnType<typeof create>, email: string, password: string) {
  const emailField = tree.root.findAllByProps({ placeholder: 'toi@exemple.com' })[0];
  const passwordField = tree.root.findByProps({ placeholder: '6 caractères minimum' });
  await act(async () => {
    emailField.props.onChangeText(email);
    passwordField.props.onChangeText(password);
  });
}

test('mode "créer un compte" : soumettre appelle signUpWithPassword avec e-mail (rogné) et mot de passe', async () => {
  const { tree, auth } = await render();
  await press(tree, 'Créer un compte avec e-mail et mot de passe');
  await fillPasswordForm(tree, '  jarod@example.com  ', 'un-mot-de-passe');

  await press(tree, 'Créer un compte');

  expect(auth.signUpWithPassword).toHaveBeenCalledWith('jarod@example.com', 'un-mot-de-passe');
  expect(auth.signInWithPassword).not.toHaveBeenCalled();
});

test('mode "se connecter" : soumettre appelle signInWithPassword, pas signUpWithPassword', async () => {
  const { tree, auth } = await render();
  await press(tree, 'Créer un compte avec e-mail et mot de passe');
  await press(tree, 'Déjà un compte ? Se connecter');
  await fillPasswordForm(tree, 'jarod@example.com', 'un-mot-de-passe');

  await press(tree, 'Se connecter');

  expect(auth.signInWithPassword).toHaveBeenCalledWith('jarod@example.com', 'un-mot-de-passe');
  expect(auth.signUpWithPassword).not.toHaveBeenCalled();
});

test('mot de passe trop court : le bouton reste désactivé, aucun appel réseau', async () => {
  const { tree, auth } = await render();
  await press(tree, 'Créer un compte avec e-mail et mot de passe');
  await fillPasswordForm(tree, 'jarod@example.com', 'court');

  const button = findByLabel(tree, 'Créer un compte');
  expect(button.props.disabled).toBe(true);

  await press(tree, 'Créer un compte');
  expect(auth.signUpWithPassword).not.toHaveBeenCalled();
});

test('e-mail déjà utilisé (signUpWithPassword) : erreur affichée', async () => {
  const { tree } = await render({
    signUpWithPassword: jest.fn(async () => ({ error: 'User already registered' })),
  });
  await press(tree, 'Créer un compte avec e-mail et mot de passe');
  await fillPasswordForm(tree, 'jarod@example.com', 'un-mot-de-passe');

  await press(tree, 'Créer un compte');

  expect(renderedText(tree)).toContain('User already registered');
});

test('mauvais mot de passe (signInWithPassword) : erreur affichée', async () => {
  const { tree } = await render({
    signInWithPassword: jest.fn(async () => ({ error: 'Invalid login credentials' })),
  });
  await press(tree, 'Créer un compte avec e-mail et mot de passe');
  await press(tree, 'Déjà un compte ? Se connecter');
  await fillPasswordForm(tree, 'jarod@example.com', 'mauvais-mdp');

  await press(tree, 'Se connecter');

  expect(renderedText(tree)).toContain('Invalid login credentials');
});

// --- Mot de passe oublié ---

test('« Mot de passe oublié ? » visible en mode connexion, absent en mode création de compte', async () => {
  const { tree } = await render();
  await press(tree, 'Créer un compte avec e-mail et mot de passe');
  expect(hasLabel(tree, 'Mot de passe oublié ?')).toBe(false);

  await press(tree, 'Déjà un compte ? Se connecter');
  expect(hasLabel(tree, 'Mot de passe oublié ?')).toBe(true);
});

test('« Mot de passe oublié ? » ouvre le formulaire de réinitialisation ; « Retour » revient au mode connexion', async () => {
  const { tree } = await render();
  await press(tree, 'Créer un compte avec e-mail et mot de passe');
  await press(tree, 'Déjà un compte ? Se connecter');

  await press(tree, 'Mot de passe oublié ?');

  expect(hasLabel(tree, 'Envoyer le lien de réinitialisation')).toBe(true);
  expect(hasLabel(tree, 'Se connecter')).toBe(false);

  await press(tree, 'Retour');

  expect(hasLabel(tree, 'Se connecter')).toBe(true);
});

test('réinitialisation : appelle resetPasswordForEmail avec l’e-mail rogné, affiche la confirmation', async () => {
  const { tree, auth } = await render();
  await press(tree, 'Créer un compte avec e-mail et mot de passe');
  await press(tree, 'Déjà un compte ? Se connecter');
  await press(tree, 'Mot de passe oublié ?');

  const emailField = tree.root.findByProps({ placeholder: 'toi@exemple.com' });
  await act(async () => {
    emailField.props.onChangeText('  jarod@example.com  ');
  });
  await press(tree, 'Envoyer le lien de réinitialisation');

  expect(auth.resetPasswordForEmail).toHaveBeenCalledWith('jarod@example.com');
  expect(renderedText(tree)).toContain('jarod@example.com');
});

test('réinitialisation : erreur serveur affichée', async () => {
  const { tree } = await render({
    resetPasswordForEmail: jest.fn(async () => ({ error: 'Adresse invalide' })),
  });
  await press(tree, 'Créer un compte avec e-mail et mot de passe');
  await press(tree, 'Déjà un compte ? Se connecter');
  await press(tree, 'Mot de passe oublié ?');
  const emailField = tree.root.findByProps({ placeholder: 'toi@exemple.com' });
  await act(async () => {
    emailField.props.onChangeText('jarod@example.com');
  });

  await press(tree, 'Envoyer le lien de réinitialisation');

  expect(renderedText(tree)).toContain('Adresse invalide');
});

// --- passwordRecovery : formulaire "nouveau mot de passe" ---

test('passwordRecovery : affiche le formulaire "nouveau mot de passe", pas le formulaire de connexion', async () => {
  const { tree } = await render({ status: 'passwordRecovery' });

  expect(hasLabel(tree, 'Mettre à jour le mot de passe')).toBe(true);
  expect(hasLabel(tree, 'Continuer avec Google')).toBe(false);
  expect(hasLabel(tree, 'Se connecter')).toBe(false);
});

test('passwordRecovery : soumettre appelle updatePassword avec le nouveau mot de passe', async () => {
  const { tree, auth } = await render({ status: 'passwordRecovery' });
  const passwordField = tree.root.findByProps({ placeholder: '6 caractères minimum' });
  await act(async () => {
    passwordField.props.onChangeText('nouveau-mot-de-passe');
  });

  await press(tree, 'Mettre à jour le mot de passe');

  expect(auth.updatePassword).toHaveBeenCalledWith('nouveau-mot-de-passe');
});

test('passwordRecovery : mot de passe trop court, bouton désactivé, aucun appel', async () => {
  const { tree, auth } = await render({ status: 'passwordRecovery' });
  const passwordField = tree.root.findByProps({ placeholder: '6 caractères minimum' });
  await act(async () => {
    passwordField.props.onChangeText('court');
  });

  const button = findByLabel(tree, 'Mettre à jour le mot de passe');
  expect(button.props.disabled).toBe(true);

  await press(tree, 'Mettre à jour le mot de passe');
  expect(auth.updatePassword).not.toHaveBeenCalled();
});

test('passwordRecovery : erreur serveur affichée', async () => {
  const { tree } = await render({
    status: 'passwordRecovery',
    updatePassword: jest.fn(async () => ({ error: 'Mot de passe trop faible' })),
  });
  const passwordField = tree.root.findByProps({ placeholder: '6 caractères minimum' });
  await act(async () => {
    passwordField.props.onChangeText('nouveau-mdp');
  });

  await press(tree, 'Mettre à jour le mot de passe');

  expect(renderedText(tree)).toContain('Mot de passe trop faible');
});
