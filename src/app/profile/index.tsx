import Ionicons from '@expo/vector-icons/Ionicons';
import { Link } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GameShelf } from '@/components/game-shelf';
import { OverflowMenu, type OverflowMenuItem } from '@/components/overflow-menu';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, Fonts, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatHours, hoursInPeriod } from '@/lib/hours';
import { useGameStore, type StoredGame } from '@/lib/game-store';
import { steamApiUrl } from '@/lib/steam-api-url';

type SteamOwnedGame = { appid: number; name: string; playtimeMinutes: number };

// steamAppId ne veut dire que "ce jeu existe sur Steam" (résolu depuis les
// external_games d'IGDB, voir ARCHITECTURE.md §6.1/§6.2) — pas "le joueur y
// joue sur Steam". Un jeu suivi comme PS5 peut très bien avoir un
// steamAppId renseigné sans avoir jamais été lancé côté Steam. Importer
// écraserait alors ses heures réelles par un 0 Steam. D'où la règle : ne
// compléter que les jeux sans aucune heure déjà suivie, jamais remplacer un
// total existant, quelle que soit la plateforme derrière ce total.
function findUntrackedGameId(games: Record<string, StoredGame>, appid: number): string | undefined {
  return Object.values(games).find((game) => game.steamAppId === appid && game.playSessions.length === 0)?.id;
}

// Pas de compte utilisateur pour l'instant (voir ARCHITECTURE.md §9) : nom
// et handle sont des constantes le temps qu'une vraie auth existe, plutôt
// que d'inventer un profil rempli comme si c'était déjà branché.
const DISPLAY_NAME = 'Joueur';
const DISPLAY_HANDLE = '@joueur';

// Un peu plus que Spacing.four : la cloche/le menu du haut restaient trop
// collés en haut de l'écran (SafeAreaView sans l'edge 'top', voir plus
// bas) — ajustement fin, pas un repositionnement radical.
const TOP_ROW_PADDING_TOP = Spacing.five;

export default function ProfileScreen() {
  const store = useGameStore();
  const theme = useTheme();
  const games = Object.values(store.games);
  const libraryGames = games.filter((game) => game.inLibrary);
  const favoriteIds = store.lists.favoris?.gameIds ?? [];
  const favoriteGames = favoriteIds.map((id) => store.games[id]).filter((game): game is NonNullable<typeof game> => Boolean(game));
  // "100%" = au moins un succès suivi, et tous cochés — un jeu sans aucun
  // succès saisi n'est pas "terminé", juste pas encore renseigné.
  const completedGames = libraryGames.filter(
    (game) => game.achievements.length > 0 && game.achievements.every((a) => a.unlocked)
  );

  const totalHours = libraryGames.reduce((sum, game) => sum + hoursInPeriod(game.playSessions, 'all'), 0);

  const [editingSteamId, setEditingSteamId] = useState(false);
  const [steamIdInput, setSteamIdInput] = useState('');
  const [importingLibrary, setImportingLibrary] = useState(false);
  const [libraryImportStatus, setLibraryImportStatus] = useState<string | null>(null);

  function startEditingSteamId() {
    setSteamIdInput(store.settings.steamId64 ?? '');
    setEditingSteamId(true);
  }

  function confirmSteamId() {
    const trimmed = steamIdInput.trim();
    store.setSteamId64(trimmed || undefined);
    setEditingSteamId(false);
  }

  // N'apparaît que si les deux conditions sont réunies (compte Steam lié,
  // backend gamelary-api déployé) — même garde que steamAchievementsUrl côté
  // fiche jeu (voir library/[id].tsx), ici au niveau du compte plutôt que
  // du jeu puisque GetOwnedGames n'est pas scopé à un jeu précis.
  const steamGamesUrl = store.settings.steamId64
    ? steamApiUrl(`/api/steam/games?steamid=${store.settings.steamId64}`)
    : null;

  async function importSteamLibrary() {
    if (!steamGamesUrl) return;
    setImportingLibrary(true);
    setLibraryImportStatus(null);
    try {
      const response = await fetch(steamGamesUrl);
      const data: { games?: SteamOwnedGame[]; error?: string } = await response.json();
      if (!response.ok || !data.games) {
        throw new Error(data.error ?? 'Erreur inconnue');
      }

      // Ne traite que les jeux Steam avec du temps de jeu réel (0 minute ==
      // rien à importer) qui correspondent à un jeu déjà connu de Gamelary
      // et pas encore suivi (voir findUntrackedGameId) : les jeux Steam sans
      // équivalent local ne peuvent pas être créés ici (demanderait une
      // résolution inverse appid -> catalogue IGDB, hors scope).
      const matches = data.games
        .filter((entry) => entry.playtimeMinutes > 0)
        .map((entry) => ({ entry, gameId: findUntrackedGameId(store.games, entry.appid) }))
        .filter((m): m is { entry: SteamOwnedGame; gameId: string } => Boolean(m.gameId));

      for (const { entry, gameId } of matches) {
        store.setTotalHours(gameId, entry.playtimeMinutes / 60);
        store.addToLibrary(gameId);
      }

      setLibraryImportStatus(
        matches.length > 0
          ? `${matches.length} jeu${matches.length > 1 ? 'x' : ''} complété${matches.length > 1 ? 's' : ''} avec leur temps de jeu Steam.`
          : 'Rien à compléter : aucun jeu Steam sans heures déjà suivies ne correspond à ta bibliothèque Gamelary.'
      );
    } catch (error) {
      setLibraryImportStatus(error instanceof Error ? error.message : 'Erreur inconnue');
    } finally {
      setImportingLibrary(false);
    }
  }

  // Contenu de chaque option pas encore développé (pas d'écran "Partager le
  // profil"/"Paramètres"/"Modifier le profil"/liste/"Aide" dédié, pas de
  // compte à déconnecter — voir ARCHITECTURE.md §9) — seule l'interface du
  // menu est demandée pour cette itération, voir §10. "Se déconnecter" en
  // dernier et marqué `destructive` (voir overflow-menu.tsx) : séparé
  // visuellement du reste, comme une action irréversible.
  const profileMenuItems: OverflowMenuItem[] = [
    { key: 'share-profile', label: 'Partager le profil', icon: 'share-outline', onPress: () => {} },
    { key: 'settings', label: 'Paramètres', icon: 'settings-outline', onPress: () => {} },
    { key: 'edit-profile', label: 'Modifier le profil', icon: 'pencil-outline', onPress: () => {} },
    { key: 'create-list', label: 'Créer une liste', icon: 'add-outline', onPress: () => {} },
    { key: 'help', label: 'Aide et idées', icon: 'bulb-outline', onPress: () => {} },
    { key: 'sign-out', label: 'Se déconnecter', icon: 'log-out-outline', destructive: true, onPress: () => {} },
  ];
  // Sous topRow (TOP_ROW_PADDING_TOP + hauteur d'icône 24px), pour ancrer le
  // menu juste sous le bouton plutôt qu'à la hauteur (différente) de la
  // fiche jeu (voir overflow-menu.tsx, valeur par défaut 54).
  const topRowMenuAnchorTop = TOP_ROW_PADDING_TOP + 24 + Spacing.two;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['left', 'right']}>
        {/* automaticallyAdjustKeyboardInsets (iOS) : sans lui, le champ
            SteamID64 (tout en bas du ScrollView, voir steamSection) se
            retrouvait caché sous le clavier numérique dès la saisie — les
            chiffres tapés s'affichaient bien dans le champ, mais le champ
            lui-même n'était plus visible pour les relire/les corriger. RN
            décale et fait défiler automatiquement vers le champ actif
            plutôt qu'un KeyboardAvoidingView manuel ici. */}
        <ScrollView contentContainerStyle={styles.content} automaticallyAdjustKeyboardInsets keyboardShouldPersistTaps="handled">
          <View style={styles.topRow}>
            <Link href="/profile/notifications" asChild>
              <Pressable hitSlop={8} accessibilityRole="button" accessibilityLabel="Notifications">
                <Ionicons name="notifications-outline" size={24} color={theme.text} />
              </Pressable>
            </Link>
            {/* Symétrique de la cloche : même ligne, même marge horizontale
                (topRow.paddingHorizontal, commune aux deux) que la cloche
                à gauche. Options pas encore branchées (pas d'écrans dédiés
                pour l'instant) — seule l'interface du menu est demandée à
                ce stade. */}
            <OverflowMenu icon="ellipsis-horizontal" anchorTop={topRowMenuAnchorTop} items={profileMenuItems} />
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
            size="large"
            emptyLabel="Aucun jeu préféré pour le moment."
            emptyAction={{ label: 'Explorer des jeux', href: '/explorer' }}
          />
          <GameShelf
            title="Jeux terminés à 100%"
            items={completedGames}
            size="large"
            emptyLabel="Aucun jeu terminé à 100% pour le moment."
          />

          <ThemedView type="backgroundElement" style={styles.steamSection}>
            <ThemedText type="smallBold">Compte Steam</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Permet de pré-remplir les succès des jeux Steam depuis la fiche jeu, et de compléter le
              temps de jeu des jeux de ta bibliothèque Gamelary déjà repérés sur Steam.
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
                  autoFocus
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

            {steamGamesUrl ? (
              <>
                <Pressable
                  onPress={importSteamLibrary}
                  disabled={importingLibrary}
                  style={styles.importRow}>
                  {importingLibrary ? <ActivityIndicator size="small" color={theme.accent} /> : null}
                  <ThemedText type="linkPrimary">
                    {importingLibrary
                      ? 'Import en cours (jusqu’à 1 min si le service vient de se réveiller)…'
                      : 'Importer ma bibliothèque Steam'}
                  </ThemedText>
                </Pressable>
                {libraryImportStatus ? (
                  <ThemedText type="small" themeColor="textSecondary">
                    {libraryImportStatus}
                  </ThemedText>
                ) : null}
              </>
            ) : null}
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    // Même paddingHorizontal des deux côtés : garde la cloche (gauche) et
    // le menu "⋯" (droite) à une marge symétrique par construction, plutôt
    // que deux valeurs choisies séparément.
    paddingHorizontal: Spacing.four,
    paddingTop: TOP_ROW_PADDING_TOP,
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
  importRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
});
