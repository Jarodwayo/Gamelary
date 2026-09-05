import { Link } from 'expo-router';
import { FlatList, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GameCover } from '@/components/game-cover';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { trackedGames, type TrackedGame } from '@/data/tracked-games';
import { useGame } from '@/hooks/use-game';

// asChild fait passer les props de navigation (onPress, href...) directement
// au Pressable enfant au lieu d'insérer un <a>/<Text> supplémentaire : la
// carte entière reste stylable comme un composant RN normal tout en restant
// un vrai lien (touch native + <a href> côté web, donc accessible/SEO-friendly).
// useGame ici (plutôt qu'un fetch fait une fois pour toute la liste) : même
// pattern que GameCover, un appel /api/games par carte, caché côté serveur
// (30 jours) et côté client — voir src/hooks/use-game.ts.
function GameCard({ trackedGame }: { trackedGame: TrackedGame }) {
  const { game } = useGame(trackedGame.id);
  const title = game?.title ?? trackedGame.igdbTitle;

  return (
    <Link href={`/library/${trackedGame.id}`} asChild>
      <Pressable style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
        <GameCover title={title} />
        <ThemedText type="small" numberOfLines={1} style={styles.cardTitle}>
          {title}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {game?.platform}
        </ThemedText>
      </Pressable>
    </Link>
  );
}

export default function LibraryScreen() {
  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['left', 'right']}>
        <FlatList
          data={trackedGames}
          keyExtractor={(trackedGame) => trackedGame.id}
          numColumns={2}
          columnWrapperStyle={styles.row}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => <GameCard trackedGame={item} />}
          ListHeaderComponent={
            <ThemedText type="title" style={styles.header}>
              Bibliothèque
            </ThemedText>
          }
        />
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
  listContent: {
    paddingHorizontal: Spacing.three,
    paddingBottom: BottomTabInset + Spacing.four,
    gap: Spacing.three,
  },
  header: {
    fontSize: 28,
    lineHeight: 34,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.two,
  },
  row: {
    gap: Spacing.three,
  },
  card: {
    flex: 1,
    gap: Spacing.one,
  },
  cardTitle: {
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.7,
  },
});
