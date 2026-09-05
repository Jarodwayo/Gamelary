import { StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';

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

// Jaquette temporaire (couleur + initiales) tant que l'intégration IGDB
// n'est pas branchée. Une fois l'API en place, ce composant sera remplacé
// par une <Image> pointant sur l'URL de cover IGDB, avec ce placeholder
// gardé comme fallback pendant le chargement ou si l'image est manquante.
export function GameCover({ title, size = 'small' }: GameCoverProps) {
  const initials = title
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join('')
    .toUpperCase();

  return (
    <ThemedView
      style={[
        styles.cover,
        size === 'large' ? styles.large : styles.small,
        { backgroundColor: colorForTitle(title) },
      ]}>
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
