import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatHours, hoursInPeriod, type StatsPeriod } from '@/lib/hours';
import { useGameStore } from '@/lib/game-store';

const PERIODS: { key: StatsPeriod; label: string }[] = [
  { key: 'week', label: 'Semaine' },
  { key: 'month', label: 'Mois' },
  { key: 'all', label: 'Tout' },
];

// Filtre par période plutôt qu'un menu "⋯" (maquette initiale) : un
// contrôle segmenté réel évite d'avoir à gérer un popover positionné et sa
// fermeture au clic extérieur en React Native, pour le même résultat
// fonctionnel. hoursInPeriod (src/lib/hours.ts) dérive Semaine/Mois/Tout de
// vraies sessions datées — jamais des nombres inventés.
export default function StatsScreen() {
  const store = useGameStore();
  const theme = useTheme();
  const [period, setPeriod] = useState<StatsPeriod>('all');

  const libraryGames = Object.values(store.games).filter((game) => game.inLibrary);
  const totalHours = libraryGames.reduce((sum, game) => sum + hoursInPeriod(game.playSessions, period), 0);
  const completedGames = libraryGames.filter(
    (game) => game.achievementsTotal > 0 && game.achievementsUnlocked === game.achievementsTotal
  ).length;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
        <ThemedView type="backgroundElement" style={styles.segmented}>
          {PERIODS.map(({ key, label }) => (
            <Pressable
              key={key}
              onPress={() => setPeriod(key)}
              style={[styles.segment, period === key && { backgroundColor: theme.accent }]}>
              <ThemedText type="smallBold" themeColor={period === key ? 'accentInk' : 'textSecondary'}>
                {label}
              </ThemedText>
            </Pressable>
          ))}
        </ThemedView>

        <ThemedView type="backgroundElement" style={styles.heroTile}>
          <ThemedText type="small" themeColor="textSecondary">
            Heures jouées
          </ThemedText>
          <ThemedText type="title" style={styles.heroValue}>
            {formatHours(totalHours)}
          </ThemedText>
        </ThemedView>

        <View style={styles.statsRow}>
          <ThemedView type="backgroundElement" style={styles.statTile}>
            <ThemedText type="small" themeColor="textSecondary">
              Jeux suivis
            </ThemedText>
            <ThemedText type="subtitle" style={styles.statValue}>
              {libraryGames.length}
            </ThemedText>
          </ThemedView>
          <ThemedView type="backgroundElement" style={styles.statTile}>
            <ThemedText type="small" themeColor="textSecondary">
              100% terminés
            </ThemedText>
            <ThemedText type="subtitle" themeColor="success" style={styles.statValue}>
              {completedGames}
            </ThemedText>
          </ThemedView>
        </View>
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
    padding: Spacing.three,
    gap: Spacing.three,
  },
  segmented: {
    flexDirection: 'row',
    borderRadius: Spacing.four,
    padding: Spacing.half,
    gap: Spacing.half,
  },
  segment: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.two,
    borderRadius: Spacing.three,
  },
  heroTile: {
    borderRadius: Spacing.three,
    padding: Spacing.four,
  },
  heroValue: {
    fontSize: 40,
    lineHeight: 46,
  },
  statsRow: {
    flexDirection: 'row',
    gap: Spacing.three,
  },
  statTile: {
    flex: 1,
    borderRadius: Spacing.three,
    padding: Spacing.three,
    gap: Spacing.one,
  },
  statValue: {
    fontSize: 22,
    lineHeight: 26,
  },
});
