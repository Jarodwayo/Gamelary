import { Link } from 'expo-router';
import { FlatList, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GameCover } from '@/components/game-cover';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { mockGames } from '@/data/mock-games';
import type { Game } from '@/types/game';

function GameCard({ game }: { game: Game }) {
  return (
    <Link href={`/library/${game.id}`} asChild>
      <Pressable style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
        <GameCover title={game.title} />
        <ThemedText type="small" numberOfLines={1} style={styles.cardTitle}>
          {game.title}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {game.platform}
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
          data={mockGames}
          keyExtractor={(game) => game.id}
          numColumns={2}
          columnWrapperStyle={styles.row}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => <GameCard game={item} />}
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
