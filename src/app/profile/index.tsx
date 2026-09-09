import Ionicons from '@expo/vector-icons/Ionicons';
import * as Clipboard from 'expo-clipboard';
import { Image } from 'expo-image';
import { Link, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GameShelf } from '@/components/game-shelf';
import { OverflowMenu, type OverflowMenuItem } from '@/components/overflow-menu';
import { ProfileAvatar } from '@/components/profile-avatar';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, Fonts, Spacing, WebTopBarInset } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatHours, hoursInPeriod } from '@/lib/hours';
import { useGameStore, type StoredGame } from '@/lib/game-store';
import { apiUrl } from '@/lib/api-url';
import { displayNameOf, handleOf, usernameOf } from '@/lib/profile';
import { publicProfileLink } from '@/lib/profile-link';
import { steamApiUrl } from '@/lib/steam-api-url';
import { resolveCatalogId } from '@/data/tracked-games';

type SteamOwnedGame = { appid: number; name: string; playtimeMinutes: number };

// Un SteamID64 est toujours un entier 64 bits sur 17 chiffres (voir la doc
// Steam) — keyboardType="number-pad" n'est qu'un indice clavier côté RN, pas
// une validation : un collage peut contenir n'importe quoi (espaces, `&`,
// `#`...). Vérifié ici avant d'atteindre confirmSteamId, pour ne jamais
// interpoler une valeur hors-format dans steamApiUrl.
const STEAM_ID64_PATTERN = /^\d{17}$/;

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

// Distinct de findUntrackedGameId : "connu" veut dire ici "un jeu du store a
// déjà ce steamAppId", suivi ou non — un jeu déjà suivi ne doit ni être
// recréé, ni déclencher un appel IGDB inutile pour un jeu qu'on connaît déjà.
export function isSteamAppIdKnown(games: Record<string, StoredGame>, appid: number): boolean {
  return Object.values(games).some((game) => game.steamAppId === appid);
}

// Résolution inverse (GET /api/games?steamAppId=, voir games+api.ts) pour un
// jeu Steam que le catalogue Gamelary ne connaît pas encore. Exportée
// séparément de importSteamLibrary : logique réseau pure, testable sans
// rendre l'écran (voir __tests__/steam-library-import.test.ts) — le flux
// complet reste vérifié via Playwright, pas de rendu React ici.
// resolveCatalogId (même helper que côté serveur, games+api.ts) plutôt qu'un
// id dérivé autrement : si l'utilisateur tombe plus tard sur ce même jeu via
// Explorer, il rejoint la même entrée au lieu d'en créer un doublon.
// Une erreur réseau ou une réponse inattendue est traitée comme "pas de
// correspondance" (undefined) plutôt que de faire échouer tout l'import pour
// un seul jeu — même philosophie que use-game-cover.ts/use-explore.ts.
export async function fetchIgdbMatchForSteamAppId(
  appid: number
): Promise<{ id: string; title: string; platform: string } | undefined> {
  try {
    const response = await fetch(apiUrl(`/api/games?steamAppId=${appid}`));
    const data: { title: string | null; platform: string | null; ambiguous?: boolean } = await response.json();
    if (!response.ok || !data.title || data.ambiguous) return undefined;
    return { id: resolveCatalogId(data.title), title: data.title, platform: data.platform ?? 'Plateforme inconnue' };
  } catch {
    return undefined;
  }
}

// Un peu plus que Spacing.four : la cloche/le menu du haut restaient trop
// collés en haut de l'écran (SafeAreaView sans l'edge 'top', voir plus
// bas) — ajustement fin, pas un repositionnement radical.
const TOP_ROW_PADDING_TOP = Spacing.five;

// Hauteur de la bannière, et de combien l'avatar déborde dessus : l'avatar
// (72px, voir profile-avatar.tsx) est centré à cheval sur le bas de
// l'image, d'où un décalage d'environ la moitié de sa hauteur.
const BANNER_HEIGHT = 148;
const AVATAR_OVERLAP = 36;

// Combien de temps la confirmation "lien copié" reste affichée avant de
// disparaître d'elle-même : assez pour être lue, pas au point de rester
// coincée en haut du profil.
const SHARE_STATUS_TIMEOUT_MS = 4000;

// Icône claire fixe sur la pastille sombre de la bannière (voir
// styles.headerChip) : pas une couleur du thème, puisque le fond derrière
// est une photo arbitraire dans les deux thèmes.
const HEADER_CHIP_ICON = '#F5F1EC';

export default function ProfileScreen() {
  const store = useGameStore();
  const theme = useTheme();
  const router = useRouter();
  const profile = store.settings.profile;
  const displayName = displayNameOf(profile);
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
  const [steamIdError, setSteamIdError] = useState<string | null>(null);
  const [importingLibrary, setImportingLibrary] = useState(false);
  const [libraryImportStatus, setLibraryImportStatus] = useState<string | null>(null);
  const [shareStatus, setShareStatus] = useState<string | null>(null);

  // La confirmation de copie s'efface d'elle-même : c'est un accusé de
  // réception ponctuel, pas un état du profil qu'il faudrait fermer à la
  // main.
  useEffect(() => {
    if (!shareStatus) return;
    const timer = setTimeout(() => setShareStatus(null), SHARE_STATUS_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [shareStatus]);

  // Le lien est construit au clic et jamais pendant le rendu : sans
  // domaine public configuré, il dépend de `window` (voir
  // profile-link.ts), absent au rendu serveur (web.output: "server").
  async function copyProfileLink() {
    const link = publicProfileLink(usernameOf(profile));
    try {
      await Clipboard.setStringAsync(link);
      setShareStatus(`Lien copié : ${link}`);
    } catch {
      // Copie refusée (permission navigateur) : le lien reste affiché pour
      // pouvoir être sélectionné à la main, plutôt qu'un échec muet.
      setShareStatus(`Copie impossible. Ton lien : ${link}`);
    }
  }

  function startEditingSteamId() {
    setSteamIdInput(store.settings.steamId64 ?? '');
    setSteamIdError(null);
    setEditingSteamId(true);
  }

  function confirmSteamId() {
    const trimmed = steamIdInput.trim();
    if (!trimmed) {
      store.setSteamId64(undefined);
      setSteamIdError(null);
      setEditingSteamId(false);
      return;
    }
    if (!STEAM_ID64_PATTERN.test(trimmed)) {
      setSteamIdError('SteamID64 invalide : doit être un identifiant à 17 chiffres.');
      return;
    }
    store.setSteamId64(trimmed);
    setSteamIdError(null);
    setEditingSteamId(false);
  }

  // N'apparaît que si les deux conditions sont réunies (compte Steam lié,
  // backend gamelary-api déployé) — même garde que steamAchievementsUrl côté
  // fiche jeu (voir library/[id].tsx), ici au niveau du compte plutôt que
  // du jeu puisque GetOwnedGames n'est pas scopé à un jeu précis.
  const steamGamesUrl = store.settings.steamId64
    ? steamApiUrl(`/api/steam/games?steamid=${encodeURIComponent(store.settings.steamId64)}`)
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
      // rien à importer, même règle pour les deux catégories ci-dessous).
      const playedEntries = data.games.filter((entry) => entry.playtimeMinutes > 0);

      // Jeux déjà connus de Gamelary (steamAppId déjà présent, voir
      // isSteamAppIdKnown) mais sans heures suivies (voir findUntrackedGameId).
      const knownMatches = playedEntries
        .map((entry) => ({ entry, gameId: findUntrackedGameId(store.games, entry.appid) }))
        .filter((m): m is { entry: SteamOwnedGame; gameId: string } => Boolean(m.gameId));

      // Jeux Steam sans aucune trace dans le catalogue Gamelary (ni suivis,
      // ni simplement croisés via Explorer) : résolus en parallèle via IGDB
      // (voir fetchIgdbMatchForSteamAppId), puis créés dans le catalogue
      // (registerCatalogGame, même action que pour un jeu découvert via
      // Explorer) avant d'appliquer la même règle que les jeux connus.
      // ambiguous:true et "pas de correspondance" produisent tous les deux
      // `undefined` ici : on ignore proprement ce jeu, sans jamais deviner.
      const unknownEntries = playedEntries.filter((entry) => !isSteamAppIdKnown(store.games, entry.appid));
      const createdMatches = (
        await Promise.all(
          unknownEntries.map(async (entry) => {
            const igdbMatch = await fetchIgdbMatchForSteamAppId(entry.appid);
            if (!igdbMatch) return null;
            store.registerCatalogGame({
              id: igdbMatch.id,
              title: igdbMatch.title,
              platform: igdbMatch.platform,
              steamAppId: entry.appid,
            });
            return { entry, gameId: igdbMatch.id };
          })
        )
      ).filter((m): m is { entry: SteamOwnedGame; gameId: string } => Boolean(m));

      // registerCatalogGame puis setTotalHours/addToLibrary sur le même id
      // fonctionnent dans le même appel (pas besoin d'attendre un re-rendu)
      // parce que les trois actions du store utilisent la forme
      // fonctionnelle setState(prev => ...), appliquée par React en séquence
      // sur l'état qui s'accumule — vérifié par un test dédié, pas supposé.
      const matches = [...knownMatches, ...createdMatches];
      for (const { entry, gameId } of matches) {
        store.setTotalHours(gameId, entry.playtimeMinutes / 60);
        store.addToLibrary(gameId);
      }

      setLibraryImportStatus(
        matches.length > 0
          ? `${matches.length} jeu${matches.length > 1 ? 'x' : ''} complété${matches.length > 1 ? 's' : ''} avec le temps de jeu Steam.`
          : 'Rien à compléter : aucun jeu Steam sans heures déjà suivies ne correspond à ta bibliothèque Gamelary.'
      );
    } catch (error) {
      setLibraryImportStatus(error instanceof Error ? error.message : 'Erreur inconnue');
    } finally {
      setImportingLibrary(false);
    }
  }

  // "Partager le profil" (copie du lien) et "Modifier le profil" sont
  // branchés ; les trois autres restent des stubs faute d'écran dédié
  // (Paramètres/Aide) ou de compte à déconnecter (voir ARCHITECTURE.md
  // §10). "Se déconnecter" en dernier et marqué `destructive` (voir
  // overflow-menu.tsx) : séparé visuellement du reste, comme une action
  // irréversible.
  const profileMenuItems: OverflowMenuItem[] = [
    { key: 'share-profile', label: 'Partager le profil', icon: 'share-outline', onPress: copyProfileLink },
    { key: 'settings', label: 'Paramètres', icon: 'settings-outline', onPress: () => {} },
    {
      key: 'edit-profile',
      label: 'Modifier le profil',
      icon: 'pencil-outline',
      onPress: () => router.push('/profile/edit'),
    },
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
          {/* Bannière derrière la photo de profil : image choisie par
              l'utilisateur (voir profile/edit.tsx), sinon un simple aplat
              du thème — jamais un trou visuel quand rien n'est choisi. La
              cloche et le menu "⋯" sont posés dessus, dans des pastilles
              sombres : leur couleur de thème habituelle deviendrait
              illisible sur une photo claire. */}
          <View style={styles.banner}>
            {profile?.backgroundUri ? (
              <Image
                source={{ uri: profile.backgroundUri }}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
                accessibilityLabel="Arrière-plan du profil"
              />
            ) : (
              <View style={[StyleSheet.absoluteFill, { backgroundColor: theme.backgroundElement }]} />
            )}
            <View style={styles.topRow}>
              <Link href="/profile/notifications" asChild>
                <Pressable hitSlop={8} accessibilityRole="button" accessibilityLabel="Notifications">
                  <View style={styles.headerChip}>
                    <Ionicons name="notifications-outline" size={24} color={HEADER_CHIP_ICON} />
                  </View>
                </Pressable>
              </Link>
              {/* Symétrique de la cloche : même ligne, même marge horizontale
                  (topRow.paddingHorizontal, commune aux deux) que la cloche
                  à gauche. */}
              <View style={styles.headerChip}>
                <OverflowMenu
                  icon="ellipsis-horizontal"
                  iconColor={HEADER_CHIP_ICON}
                  anchorTop={topRowMenuAnchorTop}
                  items={profileMenuItems}
                />
              </View>
            </View>
          </View>

          <View style={styles.identity}>
            <ProfileAvatar uri={profile?.avatarUri} name={displayName} />
            <ThemedText type="subtitle">{displayName}</ThemedText>
            <ThemedText themeColor="textSecondary">{handleOf(profile)}</ThemedText>
            {profile?.bio ? (
              <ThemedText type="small" themeColor="textSecondary" style={styles.bio}>
                {profile.bio}
              </ThemedText>
            ) : null}
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
            {shareStatus ? (
              <ThemedView type="backgroundElement" style={styles.shareStatus}>
                <Ionicons name="link-outline" size={16} color={theme.accent} />
                <ThemedText type="small" themeColor="textSecondary" style={styles.shareStatusText}>
                  {shareStatus}
                </ThemedText>
              </ThemedView>
            ) : null}
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
              <>
                <View style={styles.steamEditRow}>
                  <TextInput
                    value={steamIdInput}
                    onChangeText={(text) => {
                      setSteamIdInput(text);
                      setSteamIdError(null);
                    }}
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
                {steamIdError ? (
                  <ThemedText type="small" themeColor="danger">
                    {steamIdError}
                  </ThemedText>
                ) : null}
              </>
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
  banner: {
    // WebTopBarInset (0 sur natif) : sur le web, la barre d'onglets couvre
    // le haut de l'écran, donc la bannière s'allonge d'autant pour que la
    // cloche et le menu "⋯" restent visibles et cliquables dessous.
    height: BANNER_HEIGHT + WebTopBarInset,
    // L'image remplit la bannière en absolute : sans overflow hidden, elle
    // déborderait sous le contenu qui suit.
    overflow: 'hidden',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    // Même paddingHorizontal des deux côtés : garde la cloche (gauche) et
    // le menu "⋯" (droite) à une marge symétrique par construction, plutôt
    // que deux valeurs choisies séparément.
    paddingHorizontal: Spacing.four,
    // Décalé sous la barre d'onglets du web (WebTopBarInset, 0 sur natif) :
    // sans ça, la cloche et le menu "⋯" se retrouvent dessous, invisibles
    // et intapables sur le bundle web.
    paddingTop: TOP_ROW_PADDING_TOP + WebTopBarInset,
  },
  // Pastille sombre semi-transparente derrière les icônes de la bannière,
  // avec une icône claire fixe : contrairement au reste de l'app, ces deux
  // icônes ne sont pas posées sur une couleur du thème mais sur une image
  // arbitraire, donc ni `text` (illisible sur une photo claire en thème
  // clair) ni un aplat opaque (qui masquerait la photo) ne conviennent.
  headerChip: {
    width: 36,
    height: 36,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
  identity: {
    alignItems: 'center',
    gap: Spacing.one,
    // Remonte l'avatar à cheval sur le bas de la bannière (voir
    // AVATAR_OVERLAP), comme sur les profils de l'app de référence.
    marginTop: -AVATAR_OVERLAP,
  },
  bio: {
    textAlign: 'center',
    paddingHorizontal: Spacing.four,
    marginTop: Spacing.one,
  },
  shareStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    marginTop: Spacing.two,
    marginHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.three,
  },
  // flexShrink : un lien long doit passer à la ligne dans la pastille
  // plutôt que déborder hors de l'écran.
  shareStatusText: {
    flexShrink: 1,
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
