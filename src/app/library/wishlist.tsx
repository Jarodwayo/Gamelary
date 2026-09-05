import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GameGrid } from '@/components/game-grid';
import { ThemedView } from '@/components/themed-view';
import { useGameStore } from '@/lib/game-store';

// Liste séparée de la bibliothèque suivie (voir game-store.tsx : liste
// intégrée "wishlist", au même titre que "favoris") — un jeu peut être en
// wishlist sans jamais avoir été ajouté à la bibliothèque (achievements 0/0
// tant qu'il n'y est pas).
export default function WishlistScreen() {
  const store = useGameStore();
  const ids = store.lists.wishlist?.gameIds ?? [];

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
        <GameGrid ids={ids} emptyLabel="Ajoute un jeu à ta wishlist depuis sa fiche." />
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
});
