import { Stack, useLocalSearchParams } from 'expo-router';
import { ScrollView, StyleSheet } from 'react-native';

import { ExternalLink } from '@/components/external-link';
import { GameCover } from '@/components/game-cover';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { getGameById } from '@/data/mock-games';

// [id].tsx : nom de fichier expo-router pour une route dynamique. Le segment
// d'URL /library/hollow-knight se retrouve dans useLocalSearchParams().id —
// c'est le même mécanisme que les [id] de Next.js.
export default function GameDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const game = getGameById(id);

  // getGameById peut renvoyer undefined (id invalide dans l'URL, jeu
  // supprimé, lien partagé cassé...) : on gère l'état "introuvable"
  // explicitement plutôt que de laisser planter le rendu sur `game.title`.
  if (!game) {
    return (
      <ThemedView style={styles.container}>
        <ThemedText type="subtitle">Jeu introuvable</ThemedText>
      </ThemedView>
    );
  }

  // achievementsTotal peut être 0 (jeu pas encore suivi sur une plateforme
  // avec succès, ex. Switch dans les données de démo) : on distingue "0%"
  // de "pas de données" pour ne pas afficher un 0% trompeur, et on évite
  // une division par zéro au passage.
  const hasAchievements = game.achievementsTotal > 0;
  const completion = hasAchievements
    ? Math.round((game.achievementsUnlocked / game.achievementsTotal) * 100)
    : null;

  return (
    <>
      {/* Titre du header natif du Stack (voir library/_layout.tsx), défini
          dynamiquement depuis les données plutôt que statiquement dans le
          layout puisqu'il dépend du jeu affiché. */}
      <Stack.Screen options={{ title: game.title }} />
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <ThemedView style={styles.hero}>
          <GameCover title={game.title} size="large" />
          <ThemedView style={styles.heroText}>
            <ThemedText type="subtitle">{game.title}</ThemedText>
            <ThemedText themeColor="textSecondary">{game.platform}</ThemedText>
          </ThemedView>
        </ThemedView>

        <ThemedView type="backgroundElement" style={styles.section}>
          <ThemedText type="smallBold">Succès</ThemedText>
          {hasAchievements ? (
            <>
              <ThemedText type="title" style={styles.completionValue}>
                {completion}%
              </ThemedText>
              <ThemedText themeColor="textSecondary">
                {game.achievementsUnlocked} / {game.achievementsTotal} succès débloqués
              </ThemedText>
            </>
          ) : (
            <ThemedText themeColor="textSecondary">
              Aucun succès suivi pour ce jeu pour le moment.
            </ThemedText>
          )}
        </ThemedView>

        {/* Fonctionnalité "musique préférée" : contrairement à un lecteur
            intégré, l'app ne stocke qu'une référence au morceau (titre +
            artiste) choisi par l'utilisateur dans la BO du jeu — pas de
            streaming audio dans l'app, donc pas besoin des droits de
            diffusion Spotify (Premium + SDK natif), seulement de l'API de
            recherche. Le lien ci-dessous ouvre Spotify pour choisir/écouter,
            et c'est cette sélection qui sera persistée plus tard (backend +
            écriture sur `favoriteTrack`, aujourd'hui en dur dans les mocks). */}
        <ThemedView type="backgroundElement" style={styles.section}>
          <ThemedText type="smallBold">Musique préférée</ThemedText>
          {game.favoriteTrack ? (
            <ThemedView style={styles.trackRow}>
              <ThemedText>{game.favoriteTrack.title}</ThemedText>
              <ThemedText themeColor="textSecondary">{game.favoriteTrack.artist}</ThemedText>
            </ThemedView>
          ) : (
            <>
              <ThemedText themeColor="textSecondary">
                Aucun morceau choisi pour ce jeu.
              </ThemedText>
              <ExternalLink
                href={`https://open.spotify.com/search/${encodeURIComponent(game.title + ' soundtrack')}`}>
                <ThemedText type="linkPrimary">Chercher la BO sur Spotify</ThemedText>
              </ExternalLink>
            </>
          )}
        </ThemedView>
      </ScrollView>
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
  section: {
    borderRadius: Spacing.three,
    padding: Spacing.three,
    gap: Spacing.one,
  },
  completionValue: {
    fontSize: 32,
    lineHeight: 38,
  },
  trackRow: {
    gap: Spacing.half,
  },
});
