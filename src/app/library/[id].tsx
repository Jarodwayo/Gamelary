import Ionicons from '@expo/vector-icons/Ionicons';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Share, StyleSheet, TextInput, View } from 'react-native';

import { ExternalLink } from '@/components/external-link';
import { GameCover } from '@/components/game-cover';
import { ListPickerSheet } from '@/components/list-picker-sheet';
import { OverflowMenu, type OverflowMenuItem } from '@/components/overflow-menu';
import { RatingStepper } from '@/components/rating-stepper';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useGame } from '@/hooks/use-game';
import { useTheme } from '@/hooks/use-theme';
import { useGameStore } from '@/lib/game-store';
import { formatHours, hoursInPeriod } from '@/lib/hours';

// [id].tsx : nom de fichier expo-router pour une route dynamique. Le segment
// d'URL /library/hollow-knight se retrouve dans useLocalSearchParams().id —
// c'est le même mécanisme que les [id] de Next.js.
export default function GameDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { game, loading } = useGame(id);
  const store = useGameStore();
  const theme = useTheme();
  const [listPickerOpen, setListPickerOpen] = useState(false);
  const [addingHours, setAddingHours] = useState(false);
  const [hoursInput, setHoursInput] = useState('');
  const [addingAchievement, setAddingAchievement] = useState(false);
  const [achievementName, setAchievementName] = useState('');

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

  function confirmAddHours() {
    const parsed = Number(hoursInput.replace(',', '.'));
    if (Number.isFinite(parsed) && parsed > 0) {
      store.addPlaySession(id, parsed);
    }
    setHoursInput('');
    setAddingHours(false);
  }

  function confirmAddAchievement() {
    if (achievementName.trim()) {
      store.addAchievement(id, achievementName);
    }
    setAchievementName('');
    setAddingAchievement(false);
  }

  const menuItems: OverflowMenuItem[] = [
    {
      key: 'share',
      label: 'Partager',
      onPress: () => {
        // Share.share peut aussi bien rejeter (fermeture de la feuille
        // système) que lever une exception synchrone (non supporté sur
        // certains navigateurs web) : les deux sont des échecs silencieux,
        // rien à faire de plus dans un cas comme dans l'autre.
        try {
          Share.share({ message: `${game.title} sur Gamelary` }).catch(() => {});
        } catch {
          // ignoré
        }
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
        <ThemedView style={styles.hero}>
          <GameCover title={game.title} size="large" />
          <ThemedView style={styles.heroText}>
            <ThemedText type="subtitle">{game.title}</ThemedText>
            <ThemedText themeColor="textSecondary">
              {loading ? 'Chargement…' : game.platform}
              {game.stopped ? ' · Arrêté' : ''}
            </ThemedText>
          </ThemedView>
        </ThemedView>

        {!game.inLibrary && (
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
            <ThemedText type="title" style={styles.hoursValue}>
              {formatHours(totalHours)}
            </ThemedText>
            {addingHours ? (
              <View style={styles.addHoursRow}>
                <TextInput
                  value={hoursInput}
                  onChangeText={setHoursInput}
                  onSubmitEditing={confirmAddHours}
                  keyboardType="decimal-pad"
                  placeholder="Ex. 2.5"
                  placeholderTextColor={theme.textSecondary}
                  autoFocus
                  style={[styles.hoursInput, { color: theme.text, borderColor: theme.backgroundSelected }]}
                />
                <Pressable
                  onPress={confirmAddHours}
                  style={[styles.addHoursConfirm, { backgroundColor: theme.accent }]}>
                  <ThemedText style={{ color: theme.accentInk }}>Ajouter</ThemedText>
                </Pressable>
              </View>
            ) : (
              <Pressable onPress={() => setAddingHours(true)}>
                <ThemedText type="linkPrimary">+ Ajouter des heures</ThemedText>
              </Pressable>
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
            artiste) choisi par l'utilisateur dans la BO du jeu — pas de
            streaming audio dans l'app, donc pas besoin des droits de
            diffusion Spotify (Premium + SDK natif), seulement de l'API de
            recherche. La pochette est un simple repère visuel (icône), pas
            une vraie jaquette Spotify récupérée — la recherche in-app pour
            choisir/changer le morceau reste à faire (voir ARCHITECTURE.md
            §6.4), d'où le lien externe conservé. */}
        <ThemedView type="backgroundElement" style={styles.section}>
          <ThemedText type="smallBold">Musique préférée</ThemedText>
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
            </View>
          ) : (
            <>
              <ThemedText themeColor="textSecondary">Aucun morceau choisi pour ce jeu.</ThemedText>
              <ExternalLink
                href={`https://open.spotify.com/search/${encodeURIComponent(game.title + ' soundtrack')}`}>
                <ThemedText type="linkPrimary">Chercher la BO sur Spotify</ThemedText>
              </ExternalLink>
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
  content: {
    padding: Spacing.three,
    gap: Spacing.three,
  },
  hero: {
    flexDirection: 'row',
    gap: Spacing.three,
    alignItems: 'flex-end',
  },
  heroText: {
    gap: Spacing.half,
    flexShrink: 1,
  },
  primaryButton: {
    borderRadius: 999,
    paddingVertical: Spacing.three,
    alignItems: 'center',
  },
  section: {
    borderRadius: Spacing.three,
    padding: Spacing.three,
    gap: Spacing.one,
  },
  hoursValue: {
    fontSize: 28,
    lineHeight: 34,
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
});
