import Ionicons from '@expo/vector-icons/Ionicons';
import { Link } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GameShelf } from '@/components/game-shelf';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, Fonts, Spacing } from '@/constants/theme';
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

  const [editingSteamId, setEditingSteamId] = useState(false);
  const [steamIdInput, setSteamIdInput] = useState('');

  function startEditingSteamId() {
    setSteamIdInput(store.settings.steamId64 ?? '');
    setEditingSteamId(true);
  }

  function confirmSteamId() {
    const trimmed = steamIdInput.trim();
    store.setSteamId64(trimmed || undefined);
    setEditingSteamId(false);
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['left', 'right']}>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.topRow}>
            <Link href="/profile/notifications" asChild>
              <Pressable hitSlop={8} accessibilityRole="button" accessibilityLabel="Notifications">
                <Ionicons name="notifications-outline" size={24} color={theme.text} />
              </Pressable>
            </Link>
          </View>

          <View style={styles.identity}>
            <View style={[styles.avatar, { backgroundColor: theme.backgroundSelected }]}>
              <ThemedText type="subtitle" style={styles.avatarInitial}>
                {DISPLAY_NAME.charAt(0).toUpperCase()}
              </ThemedText>
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
            {/* Link asChild clone son enfant direct via Slot, qui gère mal un
                style dynamique par callback ({pressed} => {...}) sur cette
                carte-là précisément — même famille de bug que les tableaux
                de styles (voir game-grid.tsx/game-shelf.tsx) : la case
                perdait silencieusement fond/coins/padding, flottant sans
                fond à côté de "Jeux joués". Un objet statique (pas de
                callback, pas de retour visuel au tap) est le seul pattern
                vérifié fiable ici — les deux cases partagent maintenant
                exactement la même structure interne (en-tête + valeur) pour
                rester à la même taille. */}
            <Link href="/profile/stats" asChild>
              <Pressable style={{ ...styles.statTile, backgroundColor: theme.backgroundElement }}>
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
              <View style={styles.statTileHeader}>
                <ThemedText type="small" themeColor="textSecondary">
                  Jeux joués
                </ThemedText>
              </View>
              <ThemedText type="subtitle" style={styles.statValue}>
                {libraryGames.length}
              </ThemedText>
            </ThemedView>
          </View>

          <GameShelf
            title="Jeux joués"
            items={libraryGames}
            size="large"
            emptyLabel="Aucun jeu joué pour le moment."
            emptyAction={{ label: 'Explorer des jeux', href: '/explorer' }}
          />
          <GameShelf
            title="Jeux préférés"
            items={favoriteGames}
            emptyLabel="Aucun jeu préféré pour le moment."
            emptyAction={{ label: 'Explorer des jeux', href: '/explorer' }}
          />

          <ThemedView type="backgroundElement" style={styles.steamSection}>
            <ThemedText type="smallBold">Compte Steam</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Permet de pré-remplir les succès des jeux Steam depuis la fiche jeu.
            </ThemedText>

            {editingSteamId ? (
              <View style={styles.steamEditRow}>
                <TextInput
                  value={steamIdInput}
                  onChangeText={setSteamIdInput}
                  onSubmitEditing={confirmSteamId}
                  placeholder="SteamID64 (ex. 76561197960287930)"
                  placeholderTextColor={theme.textSecondary}
                  keyboardType="number-pad"
                  style={[styles.steamInput, { color: theme.text, borderColor: theme.backgroundSelected }]}
                />
                <Pressable onPress={confirmSteamId} hitSlop={8}>
                  <ThemedText type="linkPrimary">Enregistrer</ThemedText>
                </Pressable>
              </View>
            ) : (
              <View style={styles.steamRow}>
                <ThemedText type="small" themeColor="textSecondary" numberOfLines={1} style={styles.steamValue}>
                  {store.settings.steamId64 ?? 'Non lié'}
                </ThemedText>
                <Pressable onPress={startEditingSteamId} hitSlop={8}>
                  <ThemedText type="linkPrimary">
                    {store.settings.steamId64 ? 'Modifier' : 'Lier mon compte Steam'}
                  </ThemedText>
                </Pressable>
                {store.settings.steamId64 ? (
                  <Pressable onPress={() => store.setSteamId64(undefined)} hitSlop={8}>
                    <ThemedText type="link" themeColor="textSecondary">
                      Délier
                    </ThemedText>
                  </Pressable>
                ) : null}
              </View>
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
    paddingBottom: BottomTabInset + Spacing.four,
    gap: Spacing.four,
  },
  topRow: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.four,
  },
  identity: {
    alignItems: 'center',
    gap: Spacing.one,
    paddingTop: Spacing.three,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.one,
    overflow: 'hidden',
  },
  // type="subtitle" (voir themed-text.tsx) porte un lineHeight (44) pensé
  // pour un vrai sous-titre multi-mots, pas pour une seule lettre centrée
  // dans un cercle de 64px : combiné à la police custom (Bricolage
  // Grotesque, voir §2), ça poussait le glyphe visuellement vers le haut,
  // rogné par le cercle. lineHeight resserré au fontSize + includeFontPadding
  // à false (Android ajoute sinon un padding vertical au rendu du texte,
  // avec le même effet) recentrent la lettre correctement.
  avatarInitial: {
    lineHeight: 32,
    includeFontPadding: false,
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
    // Nombre tabulaire (voir ARCHITECTURE.md §2) : IBM Plex Mono plutôt
    // que la police de titre habituelle, en dehors du type="subtitle".
    fontFamily: Fonts.mono.semiBold,
  },
  pressed: {
    opacity: 0.7,
  },
  steamSection: {
    marginHorizontal: Spacing.three,
    borderRadius: Spacing.three,
    padding: Spacing.three,
    gap: Spacing.one,
  },
  steamRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    marginTop: Spacing.one,
  },
  steamValue: {
    flex: 1,
  },
  steamEditRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    marginTop: Spacing.one,
  },
  steamInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
    fontSize: 14,
  },
});
