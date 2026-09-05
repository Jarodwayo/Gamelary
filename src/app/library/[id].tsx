import { Stack, useLocalSearchParams } from 'expo-router';
import { ScrollView, StyleSheet } from 'react-native';

import { ExternalLink } from '@/components/external-link';
import { GameCover } from '@/components/game-cover';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { getGameById } from '@/data/mock-games';

export default function GameDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const game = getGameById(id);

  if (!game) {
    return (
      <ThemedView style={styles.container}>
        <ThemedText type="subtitle">Jeu introuvable</ThemedText>
      </ThemedView>
    );
  }

  const hasAchievements = game.achievementsTotal > 0;
  const completion = hasAchievements
    ? Math.round((game.achievementsUnlocked / game.achievementsTotal) * 100)
    : null;

  return (
    <>
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
