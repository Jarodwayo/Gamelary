import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

// Note sur 20 plutôt que 5 étoiles : 20 étoiles tapables serait illisible,
// un +/- reste précis au doigt tout en couvrant toute l'échelle demandée.
export function RatingStepper({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  const theme = useTheme();

  return (
    <View style={styles.row}>
      <Pressable
        onPress={() => onChange(Math.max(0, value - 1))}
        hitSlop={8}
        style={[styles.button, { backgroundColor: theme.backgroundSelected }]}>
        <ThemedText type="smallBold">−</ThemedText>
      </Pressable>
      <ThemedText type="subtitle" style={styles.value}>
        {value}
        <ThemedText themeColor="textSecondary">/20</ThemedText>
      </ThemedText>
      <Pressable
        onPress={() => onChange(Math.min(20, value + 1))}
        hitSlop={8}
        style={[styles.button, { backgroundColor: theme.backgroundSelected }]}>
        <ThemedText type="smallBold">+</ThemedText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  button: {
    width: 32,
    height: 32,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  value: {
    fontSize: 22,
    lineHeight: 26,
    minWidth: 64,
    textAlign: 'center',
  },
});
