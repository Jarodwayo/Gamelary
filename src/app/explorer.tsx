import { ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GameShelf } from '@/components/game-shelf';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { useExploreSection, type ExploreSection } from '@/hooks/use-explore';

const SECTIONS: { key: ExploreSection; title: string }[] = [
  { key: 'recommended', title: 'Recommandé pour toi' },
  { key: 'trending', title: 'Jeux tendances' },
  { key: 'new', title: 'Nouveaux jeux' },
  { key: 'popular', title: 'Jeux populaires' },
  { key: 'anticipated', title: 'Jeux les plus attendus' },
];

// "Jeux joués par tes amis" volontairement absent : ça suppose un système
// de comptes/amis qui n'existe pas encore (voir ARCHITECTURE.md §9).
function ExploreSectionRow({ section, title }: { section: ExploreSection; title: string }) {
  const { games, loading } = useExploreSection(section);
  return (
    <GameShelf
      title={title}
      items={games}
      emptyLabel={loading ? 'Chargement…' : 'Rien à afficher pour le moment.'}
    />
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
          {SECTIONS.map(({ key, title }) => (
            <ExploreSectionRow key={key} section={key} title={title} />
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
});
