import Ionicons from '@expo/vector-icons/Ionicons';
import * as Clipboard from 'expo-clipboard';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Share, StyleSheet, TextInput, View } from 'react-native';

import { ExternalLink } from '@/components/external-link';
import { GameTitleHeader } from '@/components/game-title-header';
import { ListPickerSheet } from '@/components/list-picker-sheet';
import { OverflowMenu, type OverflowMenuItem } from '@/components/overflow-menu';
import { RatingStepper } from '@/components/rating-stepper';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, Fonts, Spacing } from '@/constants/theme';
import { useGame } from '@/hooks/use-game';
import { useTheme } from '@/hooks/use-theme';
import { useGameStore } from '@/lib/game-store';
import { formatHours, hoursInPeriod } from '@/lib/hours';
import { gameShareMessage, steamStoreLink } from '@/lib/share-game';
import { steamApiUrl } from '@/lib/steam-api-url';
import { DEFAULT_TITLE_ARTWORK } from '@/lib/title-artwork';

type SteamAchievement = { apiname: string; name: string; unlocked: boolean };

// Même délai que profile/index.tsx (copyProfileLink) : un simple accusé de
// réception ponctuel, pas une valeur qui mérite sa propre justification ici.
const SHARE_STATUS_TIMEOUT_MS = 4000;

// [id].tsx : nom de fichier expo-router pour une route dynamique. Le segment
// d'URL /library/hollow-knight se retrouve dans useLocalSearchParams().id —
// c'est le même mécanisme que les [id] de Next.js.
export default function GameDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { game, loading } = useGame(id);
  const store = useGameStore();
  const theme = useTheme();
  const [listPickerOpen, setListPickerOpen] = useState(false);
  const [editingHours, setEditingHours] = useState(false);
  const [hoursInput, setHoursInput] = useState('');
  const [addingAchievement, setAddingAchievement] = useState(false);
  const [achievementName, setAchievementName] = useState('');
  const [importingAchievements, setImportingAchievements] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [shareStatus, setShareStatus] = useState<string | null>(null);

  // La confirmation de repli presse-papiers s'efface d'elle-même (même motif
  // que copyProfileLink dans profile/index.tsx) : un accusé de réception
  // ponctuel, pas un état du jeu qu'il faudrait fermer à la main.
  useEffect(() => {
    if (!shareStatus) return;
    const timer = setTimeout(() => setShareStatus(null), SHARE_STATUS_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [shareStatus]);

  // useGame ne renvoie null que si l'id n'existe dans aucune source connue
  // (id invalide dans l'URL, lien partagé cassé...) : ce n'est jamais l'état
  // de chargement IGDB, qui garde un titre/plateforme de repli — voir
  // src/hooks/use-game.ts. On gère cet état "introuvable" explicitement
  // plutôt que de laisser planter le rendu sur `game.title`.
  if (!game) {
    return (
      <ThemedView style={styles.container}>
        <ThemedText type="subtitle">Jeu introuvable</ThemedText>
      </ThemedView>
    );
  }

  const totalHours = hoursInPeriod(game.playSessions, 'all');
  const isFavorite = store.lists.favoris?.gameIds.includes(id) ?? false;

  function startEditingHours() {
    setHoursInput(totalHours > 0 ? String(totalHours) : '');
    setEditingHours(true);
  }

  function confirmHours() {
    const parsed = Number(hoursInput.replace(',', '.'));
    if (Number.isFinite(parsed) && parsed >= 0) {
      store.setTotalHours(id, parsed);
    }
    setEditingHours(false);
  }

  function confirmAddAchievement() {
    if (achievementName.trim()) {
      store.addAchievement(id, achievementName);
    }
    setAchievementName('');
    setAddingAchievement(false);
  }

  // gamelary-api (backend Express séparé — voir ARCHITECTURE.md §6.3) :
  // remplace la liste de succès par celle de Steam plutôt que de la
  // fusionner avec les entrées manuelles (voir importAchievements,
  // game-store.tsx). Ne s'affiche que si les trois conditions sont réunies
  // (app id Steam connu, compte Steam lié, backend déployé) — sinon la
  // saisie manuelle reste le seul chemin, comme avant cette intégration.
  const steamAchievementsUrl =
    game.steamAppId && store.settings.steamId64
      ? steamApiUrl(
          `/api/steam/achievements?appid=${encodeURIComponent(game.steamAppId)}&steamid=${encodeURIComponent(store.settings.steamId64)}`
        )
      : null;

  async function importFromSteam() {
    if (!steamAchievementsUrl) return;
    setImportingAchievements(true);
    setImportError(null);
    try {
      const response = await fetch(steamAchievementsUrl);
      const data: { achievements?: SteamAchievement[]; error?: string } = await response.json();
      if (!response.ok || !data.achievements) {
        throw new Error(data.error ?? 'Erreur inconnue');
      }
      store.importAchievements(id, data.achievements);
    } catch (error) {
      setImportError(error instanceof Error ? error.message : 'Erreur inconnue');
    } finally {
      setImportingAchievements(false);
    }
  }

  // importAchievements remplace entièrement la liste (voir game-store.tsx) :
  // un import par erreur écraserait silencieusement des succès cochés à la
  // main. On ne demande confirmation que s'il y a réellement quelque chose
  // à perdre (liste non vide) — un premier import sur un jeu sans succès
  // suivis n'a rien à confirmer. hasExistingAchievements capture le
  // booléen ici (où `game` est déjà non-null) : TypeScript ne fait pas
  // persister ce narrowing dans une fonction imbriquée définie plus loin.
  const hasExistingAchievements = game.achievements.length > 0;

  function handleImportPress() {
    if (hasExistingAchievements) {
      Alert.alert(
        'Remplacer les succès existants ?',
        'Ça va remplacer tes succès actuels par ceux importés depuis Steam.',
        [
          { text: 'Annuler', style: 'cancel' },
          { text: 'Continuer', style: 'destructive', onPress: importFromSteam },
        ]
      );
    } else {
      importFromSteam();
    }
  }

  // Capturés ici (où `game` est déjà non-null) plutôt que lus dans
  // shareGame ci-dessous : même raison que hasExistingAchievements plus
  // haut, TypeScript ne fait pas persister ce narrowing dans une fonction
  // imbriquée définie plus loin. Logique extraite dans lib/share-game.ts
  // (testable sans monter tout l'écran).
  const steamStoreUrl = steamStoreLink(game.steamAppId);
  const shareMessage = gameShareMessage(game.title, game.steamAppId);

  async function shareGame() {
    // `url` (ShareContent) n'est lu que côté iOS — Android l'ignore
    // entièrement et ne construit son intent qu'à partir de `message`/
    // `title` (voir react-native/Libraries/Share/Share.js) — d'où le lien
    // intégré directement dans le texte partagé plutôt que passé à part,
    // pour apparaître sur les deux plateformes.
    try {
      await Share.share(steamStoreUrl ? { message: shareMessage, url: steamStoreUrl } : { message: shareMessage });
    } catch {
      // La feuille système a rejeté (erreur) ou n'existe pas du tout sur
      // cette plateforme (web sans navigator.share, voir
      // react-native-web/Share) : sans repli, le clic ne produisait
      // jusqu'ici aucun effet visible, d'où ce bug remonté. Presse-papiers
      // en repli, même motif que copyProfileLink (profile/index.tsx).
      try {
        await Clipboard.setStringAsync(shareMessage);
        setShareStatus(steamStoreUrl ? `Lien copié : ${steamStoreUrl}` : 'Copié dans le presse-papiers.');
      } catch {
        setShareStatus('Partage indisponible sur cet appareil.');
      }
    }
  }

  const menuItems: OverflowMenuItem[] = [
    {
      key: 'share',
      label: 'Partager',
      onPress: () => {
        shareGame();
      },
    },
    game.inLibrary
      ? {
          key: 'stop',
          label: game.stopped ? 'Reprendre' : 'Arrêter de jouer',
          onPress: () => store.toggleStopped(id),
        }
      : {
          key: 'add-library',
          label: 'Ajouter à ma bibliothèque',
          onPress: () => store.addToLibrary(id),
        },
    {
      key: 'add-list',
      label: 'Ajouter à une liste',
      onPress: () => setListPickerOpen(true),
    },
  ];

  return (
    <>
      {/* Titre du header natif du Stack (voir library/_layout.tsx), défini
          dynamiquement depuis les données plutôt que statiquement dans le
          layout puisqu'il dépend du jeu affiché. */}
      <Stack.Screen
        options={{ title: game.title, headerRight: () => <OverflowMenu items={menuItems} /> }}
      />
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {/* Jaquette ou bandeau large + logo selon le réglage "Affiche de la
            page titre" (voir profile/settings-artwork.tsx) — le composant
            gère lui-même le repli sur la jaquette quand aucun bandeau
            n'existe pour ce jeu. */}
        <GameTitleHeader
          mode={store.settings.titleArtwork ?? DEFAULT_TITLE_ARTWORK}
          title={game.title}
          steamAppId={game.steamAppId}
          subtitle={`${loading ? 'Chargement…' : game.platform}${game.stopped ? ' · Arrêté' : ''}`}
          action={
            /* "Jeux préférés" du Profil (voir profile/index.tsx) est la
               liste intégrée `favoris` résolue en jeux — ce bouton en est le
               seul point d'entrée direct depuis la fiche jeu (jusqu'ici
               accessible uniquement via "Ajouter à une liste" dans le menu
               ⋯). */
            <Pressable
              onPress={() => store.toggleListMembership('favoris', id)}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={isFavorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}>
              <Ionicons
                name={isFavorite ? 'heart' : 'heart-outline'}
                size={26}
                color={isFavorite ? theme.accent : theme.textSecondary}
              />
            </Pressable>
          }
        />

        {shareStatus ? (
          <ThemedView type="backgroundElement" style={styles.shareStatus}>
            <Ionicons name="link-outline" size={16} color={theme.accent} />
            <ThemedText type="small" themeColor="textSecondary" style={styles.shareStatusText}>
              {shareStatus}
            </ThemedText>
          </ThemedView>
        ) : null}

        {game.summary && (
          <ThemedView type="backgroundElement" style={styles.section}>
            <ThemedText type="smallBold">Description</ThemedText>
            <ThemedText themeColor="textSecondary">{game.summary}</ThemedText>
          </ThemedView>
        )}

        {game.inLibrary ? (
          // Pendant symétrique du bouton ci-dessous : ne touche que
          // `inLibrary` (removeFromLibrary, game-store.tsx) — jamais
          // `stopped`/note/avis/succès, qui restent intacts après ce
          // retrait. C'est justement ce qui garde le jeu synchronisé
          // (isSyncWorthy, sync-service.ts) s'il porte encore l'un de ces
          // signaux ; il ne redevient non traqué que si plus aucun ne le
          // qualifie.
          <Pressable
            onPress={() => store.removeFromLibrary(id)}
            style={[styles.primaryButton, { backgroundColor: theme.backgroundSelected }]}>
            <ThemedText>Retirer de ma bibliothèque</ThemedText>
          </Pressable>
        ) : (
          <Pressable
            onPress={() => store.addToLibrary(id)}
            style={[styles.primaryButton, { backgroundColor: theme.accent }]}>
            <ThemedText style={{ color: theme.accentInk }}>Ajouter à ma bibliothèque</ThemedText>
          </Pressable>
        )}

        <ThemedView type="backgroundElement" style={styles.section}>
          <ThemedText type="smallBold">Ta note</ThemedText>
          <RatingStepper value={game.rating ?? 0} onChange={(value) => store.setRating(id, value)} />
          <TextInput
            value={game.review ?? ''}
            onChangeText={(text) => store.setReview(id, text)}
            placeholder="Ajoute un avis (optionnel)"
            placeholderTextColor={theme.textSecondary}
            multiline
            style={[styles.reviewInput, { color: theme.text, borderColor: theme.backgroundSelected }]}
          />
        </ThemedView>

        {game.inLibrary && (
          <ThemedView type="backgroundElement" style={styles.section}>
            <ThemedText type="smallBold">Heures jouées</ThemedText>
            {editingHours ? (
              // Champ éditable qui fixe directement le total (pas un simple
              // incrément) : permet de corriger une saisie précédente, pas
              // seulement d'en ajouter. Voir game-store.tsx#setTotalHours —
              // l'historique daté (pour les statistiques) reste cohérent via
              // une session correctrice égale à l'écart.
              <View style={styles.addHoursRow}>
                <TextInput
                  value={hoursInput}
                  onChangeText={setHoursInput}
                  onSubmitEditing={confirmHours}
                  keyboardType="decimal-pad"
                  placeholder="Ex. 12.5"
                  placeholderTextColor={theme.textSecondary}
                  autoFocus
                  style={[styles.hoursInput, { color: theme.text, borderColor: theme.backgroundSelected }]}
                />
                <Pressable
                  onPress={confirmHours}
                  style={[styles.addHoursConfirm, { backgroundColor: theme.accent }]}>
                  <ThemedText style={{ color: theme.accentInk }}>Enregistrer</ThemedText>
                </Pressable>
              </View>
            ) : (
              <>
                <ThemedText type="title" style={styles.hoursValue}>
                  {formatHours(totalHours)}
                </ThemedText>
                <Pressable onPress={startEditingHours}>
                  <ThemedText type="linkPrimary">Modifier</ThemedText>
                </Pressable>
              </>
            )}
          </ThemedView>
        )}

        {/* En attendant une vraie API succès (Steam Web API — voir
            ARCHITECTURE.md §6.3), l'utilisateur construit lui-même sa liste
            de succès nommés et les coche au fur et à mesure : plus utile
            qu'un simple ratio qui ne dit pas CE QUI a été débloqué. */}
        <ThemedView type="backgroundElement" style={styles.section}>
          <ThemedText type="smallBold">Succès</ThemedText>
          {game.achievements.length > 0 ? (
            <ThemedText themeColor="textSecondary">
              {game.achievementsUnlocked} / {game.achievementsTotal} débloqués
            </ThemedText>
          ) : (
            <ThemedText themeColor="textSecondary">Aucun succès suivi pour ce jeu pour le moment.</ThemedText>
          )}
          {game.achievements.map((achievement) => (
            <Pressable
              key={achievement.id}
              onPress={() => store.toggleAchievement(id, achievement.id)}
              style={styles.achievementRow}>
              <View
                style={[
                  styles.achievementCheck,
                  { borderColor: theme.backgroundSelected },
                  achievement.unlocked && { backgroundColor: theme.success, borderColor: theme.success },
                ]}>
                {achievement.unlocked && <ThemedText style={styles.achievementCheckMark}>✓</ThemedText>}
              </View>
              <ThemedText themeColor={achievement.unlocked ? 'text' : 'textSecondary'}>
                {achievement.name}
              </ThemedText>
            </Pressable>
          ))}
          {steamAchievementsUrl ? (
            <Pressable
              onPress={handleImportPress}
              disabled={importingAchievements}
              style={styles.importRow}>
              {importingAchievements ? <ActivityIndicator size="small" color={theme.accent} /> : null}
              <ThemedText type="linkPrimary">
                {importingAchievements
                  ? 'Import en cours (jusqu’à 1 min si le service vient de se réveiller)…'
                  : 'Pré-remplir depuis Steam'}
              </ThemedText>
            </Pressable>
          ) : null}
          {importError ? (
            <ThemedText type="small" themeColor="textSecondary">
              {importError}
            </ThemedText>
          ) : null}
          {addingAchievement ? (
            <View style={styles.addHoursRow}>
              <TextInput
                value={achievementName}
                onChangeText={setAchievementName}
                onSubmitEditing={confirmAddAchievement}
                placeholder="Nom du succès"
                placeholderTextColor={theme.textSecondary}
                autoFocus
                style={[styles.hoursInput, { color: theme.text, borderColor: theme.backgroundSelected }]}
              />
              <Pressable
                onPress={confirmAddAchievement}
                style={[styles.addHoursConfirm, { backgroundColor: theme.accent }]}>
                <ThemedText style={{ color: theme.accentInk }}>Ajouter</ThemedText>
              </Pressable>
            </View>
          ) : (
            <Pressable onPress={() => setAddingAchievement(true)}>
              <ThemedText type="linkPrimary">+ Ajouter un succès</ThemedText>
            </Pressable>
          )}
        </ThemedView>

        {/* Fonctionnalité "musique préférée" : contrairement à un lecteur
            intégré, l'app ne stocke qu'une référence au morceau (titre +
            artiste) choisi par l'utilisateur — pas de streaming audio dans
            l'app, donc pas besoin des droits de diffusion Spotify (Premium +
            SDK natif). tracks (la BO complète) vient de tracked-games.ts,
            statique — seule la sélection est propre à l'utilisateur (voir
            ARCHITECTURE.md §6.4). La pochette est un simple repère visuel
            (icône), pas une vraie jaquette Spotify récupérée. */}
        <ThemedView type="backgroundElement" style={styles.section}>
          <ThemedText type="smallBold">Musique préférée</ThemedText>
          {game.tracks.length === 0 ? (
            <ThemedText themeColor="textSecondary">Aucune piste disponible pour ce jeu.</ThemedText>
          ) : (
            <>
              {game.favoriteTrack ? (
                <View style={styles.trackRow}>
                  <View style={[styles.trackArt, { backgroundColor: theme.backgroundSelected }]}>
                    <Ionicons name="musical-notes" size={20} color={theme.textSecondary} />
                  </View>
                  <View style={styles.trackText}>
                    <ThemedText type="smallBold" numberOfLines={1}>
                      {game.favoriteTrack.title}
                    </ThemedText>
                    <ThemedText themeColor="textSecondary" numberOfLines={1}>
                      {game.favoriteTrack.artist}
                    </ThemedText>
                  </View>
                  <ExternalLink
                    asChild
                    href={`https://open.spotify.com/search/${encodeURIComponent(
                      `${game.favoriteTrack.title} ${game.favoriteTrack.artist}`
                    )}`}>
                    <Pressable hitSlop={8}>
                      <Ionicons name="open-outline" size={18} color={theme.textSecondary} />
                    </Pressable>
                  </ExternalLink>
                </View>
              ) : (
                <ThemedText themeColor="textSecondary">Aucun morceau choisi pour ce jeu.</ThemedText>
              )}

              <ThemedText type="small" themeColor="textSecondary" style={styles.trackListLabel}>
                Choisir dans la BO
              </ThemedText>
              {game.tracks.map((track) => {
                const selected = track.id === game.favoriteTrack?.id;
                return (
                  <Pressable
                    key={track.id}
                    onPress={() => store.setFavoriteTrack(id, track.id)}
                    style={styles.trackPickRow}>
                    <View
                      style={[
                        styles.trackRadio,
                        { borderColor: theme.backgroundSelected },
                        selected && { borderColor: theme.accent },
                      ]}>
                      {selected && <View style={[styles.trackRadioDot, { backgroundColor: theme.accent }]} />}
                    </View>
                    <View style={styles.trackPickText}>
                      <ThemedText numberOfLines={1}>{track.title}</ThemedText>
                      <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                        {track.artist}
                      </ThemedText>
                    </View>
                  </Pressable>
                );
              })}
            </>
          )}
        </ThemedView>
      </ScrollView>

      <ListPickerSheet visible={listPickerOpen} gameId={id} onClose={() => setListPickerOpen(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  importRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  content: {
    padding: Spacing.three,
    // Le bas de la fiche (bande originale) passerait sous la barre
    // d'onglets du web sans ce dégagement.
    paddingBottom: BottomTabInset + Spacing.three,
    gap: Spacing.three,
  },
  primaryButton: {
    borderRadius: 999,
    paddingVertical: Spacing.three,
    alignItems: 'center',
  },
  // Même motif que shareStatus dans profile/index.tsx (copyProfileLink) :
  // ici pas de marginTop/marginHorizontal, le `gap` de `content` ci-dessus
  // espace déjà les enfants de la ScrollView.
  shareStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.three,
  },
  shareStatusText: {
    flexShrink: 1,
  },
  section: {
    borderRadius: Spacing.three,
    padding: Spacing.three,
    gap: Spacing.one,
  },
  hoursValue: {
    fontSize: 28,
    lineHeight: 34,
    fontFamily: Fonts.mono.semiBold,
  },
  addHoursRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    alignItems: 'center',
  },
  hoursInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
  },
  addHoursConfirm: {
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  reviewInput: {
    borderWidth: 1,
    borderRadius: Spacing.two,
    padding: Spacing.two,
    minHeight: 60,
    textAlignVertical: 'top',
  },
  achievementRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.one,
  },
  achievementCheck: {
    width: 20,
    height: 20,
    borderRadius: 999,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  achievementCheckMark: {
    fontSize: 12,
    color: '#ffffff',
    fontWeight: '700',
  },
  trackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  trackArt: {
    width: 44,
    height: 44,
    borderRadius: Spacing.two,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trackText: {
    flex: 1,
    gap: Spacing.half,
  },
  trackListLabel: {
    marginTop: Spacing.two,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontSize: 11,
  },
  trackPickRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.one,
  },
  trackRadio: {
    width: 18,
    height: 18,
    borderRadius: 999,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trackRadioDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
  },
  trackPickText: {
    flex: 1,
    gap: 1,
  },
});
