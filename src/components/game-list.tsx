import { Link } from 'expo-router';
import type { ReactElement } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';

import { GameCover } from '@/components/game-cover';
import { ThemedText } from '@/components/themed-text';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { useGame } from '@/hooks/use-game';
import { useTheme } from '@/hooks/use-theme';
import { formatHours, hoursInPeriod } from '@/lib/hours';

function GameRow({ id }: { id: string }) {
  const { game } = useGame(id);
  const theme = useTheme();
  if (!game) return null;

  const completed = game.achievementsTotal > 0 && game.achievementsUnlocked === game.achievementsTotal;
  const totalHours = hoursInPeriod(game.playSessions, 'all');

  return (
    <Link href={{ pathname: '/library/[id]', params: { id } }} asChild>
      <Pressable
        style={({ pressed }) => [
          styles.row,
          { backgroundColor: theme.backgroundElement },
          pressed && styles.pressed,
        ]}>
        <GameCover title={game.title} />
        <View style={styles.text}>
          <ThemedText type="smallBold" numberOfLines={1}>
            {game.title}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
            {game.platform}
          </ThemedText>
          {totalHours > 0 && (
            <ThemedText
              type="small"
              themeColor="textSecondary"
              style={styles.tertiary}
              numberOfLines={1}>
              {formatHours(totalHours)} jouées
            </ThemedText>
          )}
        </View>
        <View
          style={[
            styles.checkCircle,
            { borderColor: completed ? theme.success : theme.backgroundSelected },
            completed && { backgroundColor: theme.success },
          ]}>
          {completed && <ThemedText style={styles.checkMark}>✓</ThemedText>}
        </View>
      </Pressable>
    </Link>
  );
}

type GameListProps = {
  ids: string[];
  emptyLabel?: string;
  header?: ReactElement;
};

// Liste verticale compacte (bibliothèque) : une ligne = jaquette + texte
// empilé + indicateur de complétion, plutôt que la grille de grandes
// jaquettes d'avant — densité d'information plus élevée, scroll léger.
// Distincte de GameShelf (rangées horizontales d'Explorer/Profil).
export function GameList({ ids, emptyLabel, header }: GameListProps) {
  return (
    <FlatList
      data={ids}
      keyExtractor={(id) => id}
      renderItem={({ item }) => <GameRow id={item} />}
      ItemSeparatorComponent={() => <View style={styles.separator} />}
      contentContainerStyle={styles.list}
      ListHeaderComponent={header}
      ListEmptyComponent={
        emptyLabel ? (
          <ThemedText themeColor="textSecondary" style={styles.empty}>
            {emptyLabel}
          </ThemedText>
        ) : undefined
      }
    />
  );
}

const styles = StyleSheet.create({
  list: {
    flexGrow: 1,
    paddingHorizontal: Spacing.three,
    paddingBottom: BottomTabInset + Spacing.four,
  },
  separator: {
    height: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Spacing.three,
    padding: Spacing.two,
    gap: Spacing.three,
  },
  text: {
    flex: 1,
    gap: 2,
  },
  tertiary: {
    opacity: 0.65,
  },
  checkCircle: {
    width: 24,
    height: 24,
    borderRadius: 999,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkMark: {
    fontSize: 13,
    color: '#ffffff',
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.8,
  },
  empty: {
    textAlign: 'center',
    paddingTop: Spacing.four,
  },
});
