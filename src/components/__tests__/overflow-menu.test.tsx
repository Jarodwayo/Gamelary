// Bug remonté : depuis la fiche jeu, le menu ⋯ propose "Ajouter à une
// liste" mais l'action ne mène à rien. Repéré en le rejouant dans un vrai
// navigateur (list-picker-sheet.tsx ouvre bien sa propre <Modal>) : sur
// natif, présenter un second <Modal> RN avant que celui-ci ait fini de se
// fermer peut faire disparaître silencieusement la présentation du second
// (iOS ne présente qu'un view controller modal à la fois) — jamais
// reproduit sur le web, react-native-web n'a pas de vraie présentation
// native, ce qui avait caché le bug jusqu'ici. Ce test vérifie le
// mécanisme du correctif (délai avant `item.onPress()`), pas le rendu
// natif réel qu'aucun outil de ce dépôt ne peut piloter.
import { act, create, type ReactTestInstance } from 'react-test-renderer';
import { Modal } from 'react-native';

import { OverflowMenu, type OverflowMenuItem } from '../overflow-menu';

function findByLabel(tree: ReturnType<typeof create>, label: string): ReactTestInstance {
  const matches = tree.root.findAll(
    (node) => node.props.accessibilityLabel === label && typeof node.props.onPress === 'function'
  );
  if (matches.length !== 1) {
    throw new Error(`attendu exactement 1 nœud pressable avec accessibilityLabel="${label}", trouvé ${matches.length}`);
  }
  return matches[0];
}

// Pas d'accessibilityLabel sur les items du menu (juste du texte, voir
// overflow-menu.tsx) : on retrouve le Pressable via le texte qu'il contient
// plutôt que par référence au composant Pressable importé — react-native-web
// (utilisé sous Jest, voir jest-expo) ne rend pas le composant exporté par
// 'react-native' tel quel dans l'arbre de react-test-renderer. Deux
// candidats matchent toujours ce texte : le Pressable qui bloque la
// propagation du clic sur TOUTE la feuille (ancêtre de tous les items) et
// l'item lui-même — react-test-renderer traverse parent puis enfants, donc
// le second (le plus spécifique) est toujours le DERNIER trouvé.
function findMenuItem(tree: ReturnType<typeof create>, label: string): ReactTestInstance {
  const matches = tree.root.findAll(
    (node) =>
      typeof node.props.onPress === 'function' &&
      node.findAll((child) => child.props.children === label).length > 0
  );
  if (matches.length === 0) {
    throw new Error(`item de menu introuvable : "${label}"`);
  }
  return matches[matches.length - 1];
}

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

test("cliquer un item ferme le menu immédiatement mais retarde son action, pour ne jamais présenter deux <Modal> dans le même tick", () => {
  const onPress = jest.fn();
  const items: OverflowMenuItem[] = [{ key: 'add-list', label: 'Ajouter à une liste', onPress }];

  let tree!: ReturnType<typeof create>;
  act(() => {
    tree = create(<OverflowMenu items={items} />);
  });

  act(() => {
    findByLabel(tree, "Plus d'options").props.onPress();
  });
  expect(tree.root.findByType(Modal).props.visible).toBe(true);

  act(() => {
    findMenuItem(tree, 'Ajouter à une liste').props.onPress();
  });

  // Le menu s'est bien refermé tout de suite...
  expect(tree.root.findByType(Modal).props.visible).toBe(false);
  // ...mais l'action de l'item (typiquement : ouvrir un second <Modal>,
  // voir list-picker-sheet.tsx) n'a pas encore été déclenchée.
  expect(onPress).not.toHaveBeenCalled();

  act(() => {
    jest.advanceTimersByTime(299);
  });
  expect(onPress).not.toHaveBeenCalled();

  act(() => {
    jest.advanceTimersByTime(1);
  });
  expect(onPress).toHaveBeenCalledTimes(1);
});

test('démonter le menu avant la fin du délai ne fait pas planter (le timer ne référence rien de démonté)', () => {
  const onPress = jest.fn();
  const items: OverflowMenuItem[] = [{ key: 'add-list', label: 'Ajouter à une liste', onPress }];

  let tree!: ReturnType<typeof create>;
  act(() => {
    tree = create(<OverflowMenu items={items} />);
  });
  act(() => {
    findByLabel(tree, "Plus d'options").props.onPress();
  });
  act(() => {
    findMenuItem(tree, 'Ajouter à une liste').props.onPress();
  });

  act(() => {
    tree.unmount();
  });

  expect(() => {
    act(() => {
      jest.advanceTimersByTime(300);
    });
  }).not.toThrow();
  // L'appelant a disparu avant le délai (ex. navigation ailleurs) : l'action
  // se déclenche quand même (aucun onDismiss fiable cross-plateforme sur
  // lequel se brancher pour l'annuler, voir le commentaire du composant) —
  // ce test documente ce choix, pas un crash à éviter.
  expect(onPress).toHaveBeenCalledTimes(1);
});
