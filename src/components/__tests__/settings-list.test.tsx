// SettingsItem (settings-list.tsx) : union discriminée par `kind`
// ('external' | 'internal' | 'action') plutôt que trois champs de
// navigation optionnels (href/to/onPress) sur un seul type plat — l'ancienne
// forme laissait le compilateur accepter deux modes à la fois, silencieusement
// départagés par SettingsGroup selon la PRÉSENCE de champ plutôt qu'un
// discriminant explicite. Repéré lors d'un audit LSP/ISP (voir AGENTS.md,
// "Revue de code : substitution de Liskov et ségrégation des interfaces").
import Ionicons from '@expo/vector-icons/Ionicons';
import { act, create, type ReactTestInstance } from 'react-test-renderer';

import { SettingsGroup, type SettingsItem } from '../settings-list';

// --- Test de type : deux champs de navigation à la fois sont refusés ---
//
// Volontairement PAS dans un bloc test() : c'est `tsc --noEmit` (déjà lancé
// à chaque vérification dans ce projet, voir les autres tâches de cette
// session) qui fait foi ici, pas Jest — Jest exécute ce fichier via Babel,
// qui efface les types sans les vérifier. Si `SettingsItem` redevenait un
// type plat à champs optionnels (régression de la correction), la ligne
// ci-dessous cesserait de produire une erreur et `// @ts-expect-error`
// ferait alors échouer la compilation avec "Unused '@ts-expect-error'
// directive" — donc CE fichier ne compile proprement QUE si le discriminant
// est bien appliqué.
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- jamais lu : sa seule raison d'être est d'être type-checké (voir ci-dessus).
const _invalidTwoNavigationFields: SettingsItem = {
  kind: 'internal',
  key: 'x',
  icon: 'star-outline',
  label: 'Invalide',
  to: '/profile/edit',
  // @ts-expect-error — kind 'internal' n'accepte pas onPress (ni l'inverse) : deux modes de navigation fournis en même temps doivent être rejetés à la compilation, pas silencieusement départagés au runtime.
  onPress: () => {},
};

function findIconNames(tree: ReturnType<typeof create>): (keyof typeof Ionicons.glyphMap)[] {
  return tree.root.findAllByType(Ionicons).map((node) => node.props.name);
}

function findRow(tree: ReturnType<typeof create>, label: string): ReactTestInstance {
  const matches = tree.root.findAll((node) => node.props.accessibilityLabel === label);
  if (matches.length === 0) {
    throw new Error(`ligne introuvable : "${label}"`);
  }
  return matches[0];
}

// await act(async ...), pas act(() => ...) : @expo/vector-icons vérifie de
// façon asynchrone si sa police custom est chargée (createIconSet.tsx) et
// met à jour son état après le montage — hors d'un act() synchrone, React
// avertit d'une mise à jour "not wrapped in act(...)" (même motif que
// sign-in-screen.test.tsx, qui rend lui aussi des Ionicons).
async function mount(items: SettingsItem[]): Promise<ReturnType<typeof create>> {
  let tree!: ReturnType<typeof create>;
  await act(async () => {
    tree = create(<SettingsGroup items={items} />);
  });
  return tree;
}

test('kind "external" : flèche sortante, accessibilityRole "link"', async () => {
  const tree = await mount([
    { kind: 'external', key: 'ext', icon: 'bulb-outline', label: 'Lien externe', href: 'https://example.com' },
  ]);

  expect(findIconNames(tree)).toContain('open-outline');
  expect(findRow(tree, 'Lien externe').props.accessibilityRole).toBe('link');
});

test('kind "internal" : chevron de navigation, accessibilityRole "button"', async () => {
  const tree = await mount([
    { kind: 'internal', key: 'int', icon: 'person-outline', label: 'Route interne', to: '/profile/edit' },
  ]);

  expect(findIconNames(tree)).toContain('chevron-forward');
  expect(findIconNames(tree)).not.toContain('open-outline');
  expect(findRow(tree, 'Route interne').props.accessibilityRole).toBe('button');
});

test('kind "action" : déclenche onPress au clic, pas de navigation (chevron, pas de flèche sortante)', async () => {
  const onPress = jest.fn();
  const tree = await mount([
    { kind: 'action', key: 'act', icon: 'sync-outline', label: 'Action locale', onPress },
  ]);

  expect(findIconNames(tree)).toContain('chevron-forward');

  act(() => {
    findRow(tree, 'Action locale').props.onPress();
  });
  expect(onPress).toHaveBeenCalledTimes(1);
});
