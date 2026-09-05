import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { mockGames } from '@/data/mock-games';

export default function ProfileScreen() {
  // "100% terminé" = tous les succès trackés débloqués. On exclut
  // explicitement achievementsTotal === 0 (jeu sans succès suivis) pour ne
  // pas le compter comme "terminé" par un simple 0 === 0.
  const gamesCompleted = mockGames.filter(
    (game) => game.achievementsTotal > 0 && game.achievementsUnlocked === game.achievementsTotal
  ).length;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['left', 'right']}>
        <ThemedText type="title" style={styles.header}>
          Profil
        </ThemedText>

        <ThemedView type="backgroundElement" style={styles.statsRow}>
          <ThemedView style={styles.stat}>
            <ThemedText type="title" style={styles.statValue}>
              {mockGames.length}
            </ThemedText>
            <ThemedText themeColor="textSecondary">Jeux suivis</ThemedText>
          </ThemedView>
          <ThemedView style={styles.stat}>
            <ThemedText type="title" style={styles.statValue}>
              {gamesCompleted}
            </ThemedText>
            <ThemedText themeColor="textSecondary">100% terminés</ThemedText>
          </ThemedView>
        </ThemedView>
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
    paddingHorizontal: Spacing.three,
    paddingBottom: BottomTabInset + Spacing.four,
    gap: Spacing.three,
  },
  header: {
    fontSize: 28,
    lineHeight: 34,
    paddingTop: Spacing.three,
  },
  statsRow: {
    flexDirection: 'row',
    borderRadius: Spacing.three,
    padding: Spacing.three,
    gap: Spacing.four,
  },
  stat: {
    alignItems: 'center',
    gap: Spacing.half,
    flex: 1,
  },
  statValue: {
    fontSize: 28,
    lineHeight: 34,
  },
});
