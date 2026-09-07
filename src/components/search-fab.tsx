import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

// Rendu au niveau racine (voir app/_layout.tsx), pas dans la barre d'onglets
// elle-même : NativeTabs ne permet pas d'insérer un élément personnalisé
// dans la barre native, donc ce composant est une vue superposée
// indépendante — visible au-dessus de tous les onglets. Barre pleine
// largeur avec placeholder plutôt qu'une simple icône isolée : une icône
// seule ne se lit pas comme un champ de recherche fonctionnel.
export function SearchFab() {
  const router = useRouter();
  const theme = useTheme();

  return (
    <Pressable
      onPress={() => router.push('/library/search')}
      style={({ pressed }) => [
        styles.bar,
        { backgroundColor: theme.backgroundElement, borderColor: theme.backgroundSelected },
        pressed && styles.pressed,
      ]}
      accessibilityRole="search"
      accessibilityLabel="Rechercher un jeu">
      <Ionicons name="search" size={18} color={theme.textSecondary} />
      <ThemedText type="small" themeColor="textSecondary">
        Rechercher un jeu…
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: Spacing.three,
    right: Spacing.three,
    bottom: BottomTabInset + Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  pressed: {
    opacity: 0.85,
  },
});
