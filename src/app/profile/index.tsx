import { Link } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GameShelf } from '@/components/game-shelf';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatHours, hoursInPeriod } from '@/lib/hours';
import { useGameStore } from '@/lib/game-store';

// Pas de compte utilisateur pour l'instant (voir ARCHITECTURE.md §9) : nom
// et handle sont des constantes le temps qu'une vraie auth existe, plutôt
// que d'inventer un profil rempli comme si c'était déjà branché.
const DISPLAY_NAME = 'Joueur';
const DISPLAY_HANDLE = '@joueur';

export default function ProfileScreen() {
  const store = useGameStore();
  const theme = useTheme();
  const games = Object.values(store.games);
  const libraryGames = games.filter((game) => game.inLibrary);
  const favoriteIds = store.lists.favoris?.gameIds ?? [];
  const favoriteGames = favoriteIds.map((id) => store.games[id]).filter((game): game is NonNullable<typeof game> => Boolean(game));

  const totalHours = libraryGames.reduce((sum, game) => sum + hoursInPeriod(game.playSessions, 'all'), 0);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['left', 'right']}>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.identity}>
            <View style={[styles.avatar, { backgroundColor: theme.backgroundSelected }]}>
              <ThemedText type="subtitle">{DISPLAY_NAME.charAt(0).toUpperCase()}</ThemedText>
            </View>
            <ThemedText type="subtitle">{DISPLAY_NAME}</ThemedText>
            <ThemedText themeColor="textSecondary">{DISPLAY_HANDLE}</ThemedText>
            {/* Système d'amis pas encore implémenté (voir ARCHITECTURE.md §9) :
                figés à 0 plutôt que masqués, pour garder la même structure que
                l'app de référence en attendant. */}
            <View style={styles.followRow}>
              <ThemedText type="small" themeColor="textSecondary">
                <ThemedText type="smallBold">0</ThemedText> Abonnements
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                <ThemedText type="smallBold">0</ThemedText> Abonné
              </ThemedText>
            </View>
          </View>

          <View style={styles.statsRow}>
            <Link href="/profile/stats" asChild>
              <Pressable
                style={({ pressed }) => [
                  styles.statTile,
                  { backgroundColor: theme.backgroundElement },
                  pressed && styles.pressed,
                ]}>
                <View style={styles.statTileHeader}>
                  <ThemedText type="small" themeColor="textSecondary">
                    Temps de jeu
                  </ThemedText>
                  <ThemedText themeColor="textSecondary">›</ThemedText>
                </View>
                <ThemedText type="subtitle" style={styles.statValue}>
                  {formatHours(totalHours)}
                </ThemedText>
              </Pressable>
            </Link>

            <ThemedView type="backgroundElement" style={styles.statTile}>
              <ThemedText type="small" themeColor="textSecondary">
                Jeux joués
              </ThemedText>
              <ThemedText type="subtitle" style={styles.statValue}>
                {libraryGames.length}
              </ThemedText>
            </ThemedView>
          </View>

          <GameShelf title="Jeux suivis" items={libraryGames} emptyLabel="Aucun jeu suivi pour le moment." />
          <GameShelf
            title="Jeux préférés"
            items={favoriteGames}
            emptyLabel="Ajoute un jeu à tes favoris depuis sa fiche."
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
    gap: Spacing.four,
  },
  identity: {
    alignItems: 'center',
    gap: Spacing.one,
    paddingTop: Spacing.four,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.one,
  },
  followRow: {
    flexDirection: 'row',
    gap: Spacing.three,
    marginTop: Spacing.one,
  },
  statsRow: {
    flexDirection: 'row',
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
  },
  statTile: {
    flex: 1,
    borderRadius: Spacing.three,
    padding: Spacing.three,
    gap: Spacing.one,
  },
  statTileHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statValue: {
    fontSize: 22,
    lineHeight: 26,
  },
  pressed: {
    opacity: 0.7,
  },
});
