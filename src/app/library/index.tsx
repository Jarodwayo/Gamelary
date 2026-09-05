import { Link } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GameGrid } from '@/components/game-grid';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useGameStore } from '@/lib/game-store';

export default function LibraryScreen() {
  const store = useGameStore();
  const libraryIds = Object.values(store.games)
    .filter((game) => game.inLibrary)
    .map((game) => game.id);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['left', 'right']}>
        <GameGrid
          ids={libraryIds}
          emptyLabel="Aucun jeu suivi pour le moment."
          header={
            <View>
              <ThemedText type="title" style={styles.header}>
                Bibliothèque
              </ThemedText>
              <View style={styles.linksRow}>
                <Link href="/library/wishlist" asChild>
                  <Pressable>
                    <ThemedText type="linkPrimary">Wishlist</ThemedText>
                  </Pressable>
                </Link>
                <Link href="/library/not-started" asChild>
                  <Pressable>
                    <ThemedText type="linkPrimary">Pas commencé</ThemedText>
                  </Pressable>
                </Link>
              </View>
            </View>
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
  header: {
    fontSize: 28,
    lineHeight: 34,
    paddingTop: Spacing.three,
  },
  linksRow: {
    flexDirection: 'row',
    gap: Spacing.four,
    paddingBottom: Spacing.two,
  },
});
