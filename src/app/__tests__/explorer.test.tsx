// Vérifie l'écran Explorer après son passage de "grille murale (GameGrid)
// pour 4 rangées sur 5" à "toutes les rangées défilent horizontalement via
// FeaturedShelf" (voir ARCHITECTURE.md §2/§6.5) : mocke useExploreSection
// (données) et FeaturedShelf (déjà couvert par son propre usage pour
// "Recommandé pour toi", pas réévalué ici) pour isoler le CÂBLAGE
// d'explorer.tsx — quelle rangée reçoit quel titre/badge, avec combien de
// jeux — sans dépendre du rendu profond de <Link>/GameCoverFeatured.
import { act, create } from 'react-test-renderer';

import { FeaturedShelf } from '@/components/game-shelf';
import { useExploreSection, type ExploreSection } from '@/hooks/use-explore';
import type { CatalogGame } from '@/types/game';

import ExplorerScreen from '../explorer';

jest.mock('@/hooks/use-explore', () => ({ useExploreSection: jest.fn() }));
jest.mock('@/components/game-shelf', () => ({ FeaturedShelf: jest.fn(() => null) }));

const mockUseExploreSection = useExploreSection as jest.Mock;
const mockFeaturedShelf = FeaturedShelf as unknown as jest.Mock;

function makeGames(prefix: string, count: number): CatalogGame[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `${prefix}-${i}`,
    title: `${prefix} ${i}`,
    platform: 'PC',
  }));
}

// Nombres volontairement tous différents (y compris 0 pour "popular") :
// une section qui recevrait par erreur les jeux d'une autre serait
// détectée par la longueur, pas seulement par l'identité de la section.
const GAMES_BY_SECTION: Record<ExploreSection, CatalogGame[]> = {
  recommended: makeGames('rec', 2),
  trending: makeGames('trend', 3),
  new: makeGames('new', 4),
  popular: [],
  anticipated: makeGames('antic', 1),
};

beforeEach(() => {
  mockFeaturedShelf.mockClear();
  mockUseExploreSection.mockImplementation((section: ExploreSection) => ({
    games: GAMES_BY_SECTION[section],
    loading: false,
  }));
});

function propsForTitle(title: string) {
  const call = mockFeaturedShelf.mock.calls.find(([props]) => props.title === title);
  if (!call) throw new Error(`FeaturedShelf jamais appelé avec title="${title}"`);
  return call[0];
}

test('les 5 rangées d\'Explorer (dont les 4 anciennement en grille) utilisent toutes FeaturedShelf', () => {
  act(() => {
    create(<ExplorerScreen />);
  });

  // "Recommandé pour toi" + Tendances/Nouveaux/Populaires/Attendus : plus
  // aucune rangée n'utilise la grille murale GameGrid, qu'explorer.tsx
  // n'importe même plus.
  expect(mockFeaturedShelf).toHaveBeenCalledTimes(5);
});

test.each([
  ['Jeux tendances', 'Tendance', 'trending' as ExploreSection],
  ['Nouveaux jeux', 'Nouveau', 'new' as ExploreSection],
  ['Jeux populaires', 'Populaire', 'popular' as ExploreSection],
  ['Jeux les plus attendus', 'Attendu', 'anticipated' as ExploreSection],
])(
  '"%s" reçoit le badge "%s" et exactement les jeux renvoyés par useExploreSection("%s")',
  (title, badge, section) => {
    act(() => {
      create(<ExplorerScreen />);
    });

    const props = propsForTitle(title);
    expect(props.badge).toBe(badge);
    expect(props.items).toEqual(GAMES_BY_SECTION[section]);
  }
);

test('"Recommandé pour toi" garde son titre/badge fixes, indépendants de GRID_SECTIONS', () => {
  act(() => {
    create(<ExplorerScreen />);
  });

  const props = propsForTitle('Recommandé pour toi');
  expect(props.badge).toBe('Recommandé');
  expect(props.items).toEqual(GAMES_BY_SECTION.recommended);
});
