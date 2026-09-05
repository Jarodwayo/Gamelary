import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';

const STARS = [1, 2, 3, 4, 5];

// Note entière (pas de demi-étoiles) : plus simple à saisir au doigt qu'un
// slider continu, et suffisant pour une note personnelle (contrairement à
// une moyenne communautaire, qui elle a besoin de décimales).
export function StarRating({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  const theme = useTheme();

  return (
    <View style={styles.row}>
      {STARS.map((star) => (
        <Pressable key={star} onPress={() => onChange(star)} hitSlop={4}>
          <ThemedText style={[styles.star, { color: star <= value ? theme.accent : theme.textSecondary }]}>
            ★
          </ThemedText>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 4,
  },
  star: {
    fontSize: 24,
  },
});
