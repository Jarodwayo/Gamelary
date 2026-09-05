import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GameGrid } from '@/components/game-grid';
import { ThemedView } from '@/components/themed-view';
import { useGameStore } from '@/lib/game-store';

// "Pas commencé" = suivi mais sans la moindre trace d'activité : ni heures
// saisies, ni succès débloqués. achievementsUnlocked seul ne suffirait pas
// (un jeu sans succès trackés, ex. Switch, aurait toujours 0) — d'où le
// double critère avec playSessions.
export default function NotStartedScreen() {
  const store = useGameStore();
  const ids = Object.values(store.games)
    .filter((game) => game.inLibrary && game.playSessions.length === 0 && game.achievementsUnlocked === 0)
    .map((game) => game.id);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
        <GameGrid ids={ids} emptyLabel="Tous tes jeux suivis ont au moins un peu de progression." />
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
