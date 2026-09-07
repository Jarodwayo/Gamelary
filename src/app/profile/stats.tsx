import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatHours, hoursInPeriod, type StatsPeriod } from '@/lib/hours';
import { useGameStore } from '@/lib/game-store';
import {
  completionPercent,
  currentStreakDays,
  hoursByMonthThisYear,
  hoursByPlatform,
  longestStreakDays,
} from '@/lib/play-stats';

const MONTH_LETTERS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
const CHART_HEIGHT = 90;
const PERIODS: { key: StatsPeriod; label: string }[] = [
  { key: 'week', label: 'Semaine' },
  { key: 'month', label: 'Mois' },
  { key: 'all', label: 'Tout' },
];

function StatCard({ label, value }: { label: string; value: string }) {
  const theme = useTheme();
  return (
    <View style={[styles.statCard, { backgroundColor: theme.backgroundElement }]}>
      <ThemedText type="small" themeColor="textSecondary" style={styles.statLabel}>
        {label}
      </ThemedText>
      <ThemedText type="subtitle" style={styles.statValue}>
        {value}
      </ThemedText>
    </View>
  );
}

// Refonte "cartes + graphique + barres" : §10 de la maquette d'origine
// (contrôle segmenté seul) est remplacé par une vraie vue d'activité.
// "Vert (couleur accent)" dans la spec de référence devient `accent` du
// design system Gamelary (or, pas vert — voir ARCHITECTURE.md §2) : la
// couleur accent reste unique dans toute l'app, on n'introduit pas un vert
// à part juste pour ce graphique.
export default function StatsScreen() {
  const store = useGameStore();
  const theme = useTheme();
  const [period, setPeriod] = useState<StatsPeriod>('all');

  const libraryGames = Object.values(store.games).filter((game) => game.inLibrary);
  const totalHoursAll = libraryGames.reduce((sum, game) => sum + hoursInPeriod(game.playSessions, 'all'), 0);
  const periodHours = libraryGames.reduce((sum, game) => sum + hoursInPeriod(game.playSessions, period), 0);
  const completion = completionPercent(libraryGames);
  const currentStreak = currentStreakDays(libraryGames);
  const longestStreak = longestStreakDays(libraryGames);
  const monthly = hoursByMonthThisYear(libraryGames);
  const maxMonthHours = Math.max(1, ...monthly.map((m) => m.hours));
  const currentMonth = new Date().getMonth();
  const platforms = hoursByPlatform(libraryGames);
  const maxPlatformHours = platforms[0]?.hours ?? 1;
  const periodLabel = period === 'week' ? 'cette semaine' : period === 'month' ? 'ce mois-ci' : 'au total';

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
        <ScrollView contentContainerStyle={styles.content}>
          <ThemedText type="smallBold" style={styles.sectionTitle}>
            Combiné
          </ThemedText>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.cardsRow}>
            <StatCard label="Heures jouées" value={formatHours(totalHoursAll)} />
            <StatCard label="Jeux suivis" value={String(libraryGames.length)} />
            <StatCard label="Complétion" value={`${completion}%`} />
            <StatCard label="Streak actuel" value={`🌱 ${currentStreak}j`} />
            <StatCard label="Streak record" value={`🏆 ${longestStreak}j`} />
          </ScrollView>

          <ThemedView type="backgroundElement" style={styles.section}>
            <View style={styles.activityHead}>
              <ThemedText type="smallBold">Activité</ThemedText>
              <View style={[styles.segmented, { backgroundColor: theme.background }]}>
                {PERIODS.map(({ key, label }) => (
                  <Pressable
                    key={key}
                    onPress={() => setPeriod(key)}
                    style={[styles.segment, period === key && { backgroundColor: theme.accent }]}>
                    <ThemedText
                      type="small"
                      themeColor={period === key ? 'accentInk' : 'textSecondary'}>
                      {label}
                    </ThemedText>
                  </Pressable>
                ))}
              </View>
            </View>

            <ThemedText type="title" style={styles.periodValue}>
              {formatHours(periodHours)}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {periodLabel}
            </ThemedText>

            <View style={styles.chart}>
              {monthly.map((bucket) => (
                <View key={bucket.month} style={styles.barColumn}>
                  <View
                    style={[
                      styles.bar,
                      {
                        height: Math.max(3, (bucket.hours / maxMonthHours) * CHART_HEIGHT),
                        backgroundColor: bucket.month === currentMonth ? theme.text : theme.accent,
                      },
                    ]}
                  />
                </View>
              ))}
            </View>
            <View style={[styles.baseline, { borderColor: theme.backgroundSelected }]} />
            <View style={styles.monthLabels}>
              {MONTH_LETTERS.map((letter, index) => (
                <ThemedText
                  key={index}
                  type="small"
                  themeColor={index === currentMonth ? 'text' : 'textSecondary'}
                  style={styles.monthLabel}>
                  {letter}
                </ThemedText>
              ))}
            </View>
          </ThemedView>

          <ThemedView type="backgroundElement" style={styles.section}>
            <ThemedText type="smallBold">Plateformes les plus jouées</ThemedText>
            {platforms.length === 0 ? (
              <ThemedText themeColor="textSecondary">Pas encore d'heures enregistrées.</ThemedText>
            ) : (
              platforms.map((platform) => (
                <View key={platform.platform} style={styles.platformRow}>
                  <View style={styles.platformLabelRow}>
                    <ThemedText type="small">{platform.platform}</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      {formatHours(platform.hours)}
                    </ThemedText>
                  </View>
                  <View style={[styles.progressTrack, { backgroundColor: theme.background }]}>
                    <View
                      style={[
                        styles.progressFill,
                        {
                          width: `${(platform.hours / maxPlatformHours) * 100}%`,
                          backgroundColor: theme.accent,
                        },
                      ]}
                    />
                  </View>
                </View>
              ))
            )}
          </ThemedView>
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
    padding: Spacing.three,
    paddingBottom: BottomTabInset + Spacing.four,
    gap: Spacing.three,
  },
  sectionTitle: {
    paddingHorizontal: Spacing.one,
  },
  cardsRow: {
    gap: Spacing.two,
    paddingVertical: Spacing.half,
  },
  statCard: {
    borderRadius: Spacing.three,
    padding: Spacing.three,
    gap: Spacing.one,
    minWidth: 120,
  },
  statLabel: {
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontSize: 11,
  },
  statValue: {
    fontSize: 22,
    lineHeight: 26,
  },
  section: {
    borderRadius: Spacing.three,
    padding: Spacing.three,
    gap: Spacing.one,
  },
  activityHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  segmented: {
    flexDirection: 'row',
    borderRadius: 999,
    padding: 2,
    gap: 2,
  },
  segment: {
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
    borderRadius: 999,
  },
  periodValue: {
    fontSize: 32,
    lineHeight: 38,
    marginTop: Spacing.two,
  },
  chart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: CHART_HEIGHT,
    gap: 4,
    marginTop: Spacing.three,
  },
  barColumn: {
    flex: 1,
    alignItems: 'center',
  },
  bar: {
    width: '70%',
    borderRadius: 3,
  },
  baseline: {
    borderTopWidth: 1,
    borderStyle: 'dashed',
  },
  monthLabels: {
    flexDirection: 'row',
    marginTop: Spacing.one,
  },
  monthLabel: {
    flex: 1,
    textAlign: 'center',
    fontSize: 10,
  },
  platformRow: {
    gap: Spacing.one,
    paddingVertical: Spacing.one,
  },
  platformLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  progressTrack: {
    height: 6,
    borderRadius: 999,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
  },
});
