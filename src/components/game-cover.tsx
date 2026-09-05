import { Image } from 'expo-image';
import { StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useGameCover } from '@/hooks/use-game-cover';

const PLACEHOLDER_COLORS = ['#5B4B8A', '#2E6E5E', '#8A4B4B', '#4B6B8A', '#8A7A4B', '#6B4B8A'];

// Hash déterministe (djb2-like) du titre -> même jeu = toujours la même
// couleur, sans avoir besoin de stocker cette couleur nulle part. C'est
// juste un moyen de différencier les jaquettes placeholder visuellement ;
// pas besoin de cryptographiquement solide, juste stable et bien réparti.
function colorForTitle(title: string) {
  let hash = 0;
  for (let i = 0; i < title.length; i++) {
    hash = title.charCodeAt(i) + ((hash << 5) - hash);
  }
  return PLACEHOLDER_COLORS[Math.abs(hash) % PLACEHOLDER_COLORS.length];
}

type GameCoverProps = {
  title: string;
  size?: 'small' | 'large';
};

// Jaquette réelle (SteamGridDB, via /api/cover) avec repli sur un
// placeholder coloré (couleur + initiales) pendant le chargement, si aucune
// jaquette n'a été trouvée, ou si le jeu n'a pas encore été recherché. Le
// placeholder n'est donc pas juste une étape temporaire du projet : il reste
// l'état d'erreur/chargement permanent du composant.
export function GameCover({ title, size = 'small' }: GameCoverProps) {
  const { url, loading } = useGameCover(title);

  const initials = title
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join('')
    .toUpperCase();

  const sizeStyle = size === 'large' ? styles.large : styles.small;

  if (url) {
    // expo-image gère lui-même le cache mémoire + disque des images
    // distantes : pas besoin de logique de cache supplémentaire côté client
    // pour éviter de retélécharger la même jaquette à chaque affichage.
    return <Image source={{ uri: url }} style={[styles.cover, sizeStyle]} contentFit="cover" />;
  }

  return (
    <ThemedView
      style={[styles.cover, sizeStyle, { backgroundColor: colorForTitle(title) }]}
      accessibilityLabel={loading ? `Chargement de la jaquette de ${title}` : undefined}>
      <ThemedText style={size === 'large' ? styles.textLarge : styles.textSmall}>
        {initials}
      </ThemedText>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  cover: {
    borderRadius: Spacing.two,
    alignItems: 'center',
    justifyContent: 'center',
  },
  small: {
    width: '100%',
    aspectRatio: 3 / 4,
  },
  large: {
    width: 160,
    aspectRatio: 3 / 4,
  },
  textSmall: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '700',
  },
  textLarge: {
    color: '#ffffff',
    fontSize: 36,
    fontWeight: '700',
  },
});
