import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GameGrid, type GridItem } from '@/components/game-grid';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useGameStore, type StoredGame } from '@/lib/game-store';
import { hoursInPeriod } from '@/lib/hours';

type LibraryFilter = 'all' | 'wishlist' | 'not-started' | 'in-progress' | 'completed';

const FILTERS: { key: LibraryFilter; label: string }[] = [
  { key: 'all', label: 'Tous' },
  { key: 'wishlist', label: 'Wishlist' },
  { key: 'not-started', label: 'Pas commencé' },
  { key: 'in-progress', label: 'En cours' },
  { key: 'completed', label: 'Terminé' },
];

function isCompleted(game: StoredGame) {
  return game.achievements.length > 0 && game.achievements.every((a) => a.unlocked);
}

function isStarted(game: StoredGame) {
  return game.playSessions.length > 0 || game.achievements.some((a) => a.unlocked);
}

// "Pas commencé"/"En cours"/"Terminé" filtrent tous les 3 la bibliothèque
// suivie (inLibrary) ; "Wishlist" est la seule à piocher dans une liste à
// part (un jeu en wishlist n'est pas nécessairement suivi — voir
// game-store.tsx §6.6). "Terminé" se base sur achievementsTotal/Unlocked,
// donc un jeu sans succès trackés (ex. Switch) ne peut pas y apparaître —
// limite connue tant qu'il n'y a pas de bouton "marquer comme terminé"
// indépendant des succès.
function filterIds(filter: LibraryFilter, games: Record<string, StoredGame>, wishlistIds: string[]): string[] {
  const all = Object.values(games);
  switch (filter) {
    case 'wishlist':
      return wishlistIds;
    case 'not-started':
      return all.filter((g) => g.inLibrary && !isStarted(g) && !isCompleted(g)).map((g) => g.id);
    case 'in-progress':
      return all.filter((g) => g.inLibrary && isStarted(g) && !isCompleted(g)).map((g) => g.id);
    case 'completed':
      return all.filter((g) => g.inLibrary && isCompleted(g)).map((g) => g.id);
    case 'all':
    default:
      return all.filter((g) => g.inLibrary).map((g) => g.id);
  }
}

const EMPTY_LABELS: Record<LibraryFilter, string> = {
  all: 'Aucun jeu suivi pour le moment.',
  wishlist: 'Ajoute un jeu à ta wishlist depuis sa fiche.',
  'not-started': 'Tous tes jeux suivis ont au moins un peu de progression.',
  'in-progress': 'Aucun jeu en cours pour le moment.',
  completed: 'Aucun jeu terminé pour le moment.',
};

export default function LibraryScreen() {
  const store = useGameStore();
  const theme = useTheme();
  const [filter, setFilter] = useState<LibraryFilter>('all');
  const ids = filterIds(filter, store.games, store.lists.wishlist?.gameIds ?? []);
  // Pas de platform (voir GridItem, game-grid.tsx — retiré volontairement
  // des cartes de grille) ; hours vient de playSessions, jamais stocké à
  // part, comme partout ailleurs dans l'app.
  const items: GridItem[] = ids
    .map((id) => store.games[id])
    .filter((game): game is StoredGame => Boolean(game))
    .map((game) => ({
      id: game.id,
      title: game.title,
      steamAppId: game.steamAppId,
      hours: hoursInPeriod(game.playSessions, 'all'),
    }));

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['left', 'right']}>
        <ScrollView contentContainerStyle={styles.content}>
          <GameGrid
            items={items}
            emptyLabel={EMPTY_LABELS[filter]}
            header={
              <View>
                <ThemedText type="title" style={styles.header}>
                  Bibliothèque
                </ThemedText>
                <View style={styles.filterRow}>
                  {FILTERS.map(({ key, label }) => {
                    const active = key === filter;
                    return (
                      <Pressable
                        key={key}
                        onPress={() => setFilter(key)}
                        style={[
                          styles.filterPill,
                          { borderColor: theme.backgroundSelected },
                          active && { backgroundColor: theme.accent, borderColor: theme.accent },
                        ]}>
                        <ThemedText type="small" themeColor={active ? 'accentInk' : 'textSecondary'}>
                          {label}
                        </ThemedText>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            }
          />
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
  },
  header: {
    fontSize: 28,
    lineHeight: 34,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three,
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.three,
  },
  filterPill: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
  },
});
