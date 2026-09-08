import { ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GameGrid } from '@/components/game-grid';
import { FeaturedShelf } from '@/components/game-shelf';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { useExploreSection, type ExploreSection } from '@/hooks/use-explore';

const GRID_SECTIONS: { key: ExploreSection; title: string }[] = [
  { key: 'trending', title: 'Jeux tendances' },
  { key: 'new', title: 'Nouveaux jeux' },
  { key: 'popular', title: 'Jeux populaires' },
  { key: 'anticipated', title: 'Jeux les plus attendus' },
];

// "Recommandé pour toi" reste à part (voir FeaturedShelf, game-shelf.tsx) :
// seule section personnalisée (voir use-explore.ts), mise en avant en plus
// grand plutôt que noyée dans la grille des 4 autres rangées génériques.
function RecommendedSection() {
  const { games, loading } = useExploreSection('recommended');
  return (
    <FeaturedShelf
      title="Recommandé pour toi"
      badge="Recommandé"
      items={games}
      emptyLabel={loading ? 'Chargement…' : 'Rien à afficher pour le moment.'}
    />
  );
}

// "Jeux joués par tes amis" volontairement absent : ça suppose un système
// de comptes/amis qui n'existe pas encore (voir ARCHITECTURE.md §9).
function ExploreGridSection({ section, title }: { section: ExploreSection; title: string }) {
  const { games, loading } = useExploreSection(section);
  return (
    <ThemedView style={styles.gridSection}>
      {/* Accent plutôt que le texte par défaut : cohérent avec FeaturedShelf
          (voir game-shelf.tsx) — meilleur contraste en sombre. */}
      <ThemedText type="smallBold" themeColor="accent" style={styles.gridSectionTitle}>
        {title}
      </ThemedText>
      <GameGrid items={games} emptyLabel={loading ? 'Chargement…' : 'Rien à afficher pour le moment.'} />
    </ThemedView>
  );
}

export default function ExplorerScreen() {
  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['left', 'right']}>
        <ScrollView contentContainerStyle={styles.content}>
          <ThemedText type="title" style={styles.header}>
            Explorer
          </ThemedText>
          <RecommendedSection />
          {GRID_SECTIONS.map(({ key, title }) => (
            <ExploreGridSection key={key} section={key} title={title} />
          ))}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  content: {
    paddingBottom: BottomTabInset + Spacing.four,
    gap: Spacing.four,
  },
  header: {
    fontSize: 28,
    lineHeight: 34,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.two,
  },
  gridSection: {
    gap: Spacing.two,
  },
  gridSectionTitle: {
    paddingHorizontal: Spacing.three,
  },
});
