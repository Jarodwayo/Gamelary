import { StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';

const PLACEHOLDER_COLORS = ['#5B4B8A', '#2E6E5E', '#8A4B4B', '#4B6B8A', '#8A7A4B', '#6B4B8A'];

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

// Jaquette temporaire tant que l'intégration IGDB/Steam n'est pas branchée.
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
