import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useGameStore } from '@/lib/game-store';
import { DEFAULT_TITLE_ARTWORK, TITLE_ARTWORK_OPTIONS } from '@/lib/title-artwork';

// Choix du mode d'en-tête de la fiche jeu. Liste à coche plutôt qu'un
// interrupteur : les deux modes sont deux options nommées, pas un
// "activé/désactivé", et la liste laisse la place à un troisième mode plus
// tard sans changer de composant.
export default function SettingsArtworkScreen() {
  const store = useGameStore();
  const theme = useTheme();
  const selected = store.settings.titleArtwork ?? DEFAULT_TITLE_ARTWORK;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
        <ScrollView contentContainerStyle={styles.content}>
          <ThemedView type="backgroundElement" style={styles.group}>
            {TITLE_ARTWORK_OPTIONS.map((option, index) => (
              <Pressable
                key={option.value}
                onPress={() => store.setTitleArtwork(option.value)}
                accessibilityRole="radio"
                accessibilityState={{ selected: option.value === selected }}
                style={[
                  styles.row,
                  index > 0 ? [styles.separated, { borderTopColor: theme.backgroundSelected }] : null,
                ]}>
                <ThemedText style={styles.label}>{option.label}</ThemedText>
                {option.value === selected ? (
                  <Ionicons name="checkmark" size={20} color={theme.accent} />
                ) : null}
              </Pressable>
            ))}
          </ThemedView>

          <View style={styles.hint}>
            <ThemedText type="small" themeColor="textSecondary">
              « Arrière-plan » ouvre la fiche du jeu avec son image large et son logo. « Affiche »
              montre la jaquette à la place. Un jeu sans image large chez SteamGridDB retombe
              automatiquement sur sa jaquette.
            </ThemedText>
          </View>
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
    paddingTop: Spacing.four,
    paddingBottom: BottomTabInset + Spacing.five,
  },
  group: {
    marginHorizontal: Spacing.three,
    borderRadius: Spacing.three,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
  },
  separated: {
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  label: {
    flex: 1,
  },
  hint: {
    marginTop: Spacing.two,
    marginHorizontal: Spacing.four,
  },
});
