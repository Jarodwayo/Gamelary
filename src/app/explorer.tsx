import { ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FeaturedShelf } from '@/components/game-shelf';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, ScreenTitleGap, Spacing } from '@/constants/theme';
import { useExploreSection, type ExploreSection } from '@/hooks/use-explore';

const SHELF_SECTIONS: { key: ExploreSection; title: string; badge: string }[] = [
  { key: 'trending', title: 'Jeux tendances', badge: 'Tendance' },
  { key: 'new', title: 'Nouveaux jeux', badge: 'Nouveau' },
  { key: 'popular', title: 'Jeux populaires', badge: 'Populaire' },
  { key: 'anticipated', title: 'Jeux les plus attendus', badge: 'Attendu' },
];

// Reste une fonction à part de ExploreShelfSection (même si les deux
// rendent un FeaturedShelf) : seule section personnalisée (platform la
// plus jouée de l'utilisateur, voir use-explore.ts), titre/badge fixes
// plutôt que pilotés par une entrée de SHELF_SECTIONS.
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
//
// Même composant que RecommendedSection (FeaturedShelf) plutôt que la
// grille murale (GameGrid, réservée à Bibliothèque désormais) : les 5
// sections d'Explorer défilent maintenant toutes horizontalement, avec un
// badge par carte qui identifie la section même une fois scrollée hors de
// vue de son titre.
function ExploreShelfSection({
  section,
  title,
  badge,
}: {
  section: ExploreSection;
  title: string;
  badge: string;
}) {
  const { games, loading } = useExploreSection(section);
  return (
    <FeaturedShelf
      title={title}
      badge={badge}
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
          <RecommendedSection />
          {SHELF_SECTIONS.map(({ key, title, badge }) => (
            <ExploreShelfSection key={key} section={key} title={title} badge={badge} />
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
    // L'air va au-dessus du titre (voir ScreenTitleGap), pas en dessous :
    // "Recommandé pour toi" et les rangées suivantes restent collées au
    // titre qui les annonce.
    paddingTop: ScreenTitleGap,
    paddingBottom: Spacing.two,
  },
});
