import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';

import { BottomTabInset, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

// Rendu au niveau racine (voir app/_layout.tsx), pas dans la barre d'onglets
// elle-même : NativeTabs ne permet pas d'insérer un bouton flottant dans la
// barre native, donc ce composant est une vue superposée indépendante —
// visible au-dessus de tous les onglets, comme sur la capture de référence
// (bouton recherche séparé, pas juste un onglet parmi d'autres).
export function SearchFab() {
  const router = useRouter();
  const theme = useTheme();

  return (
    <Pressable
      onPress={() => router.push('/search')}
      style={({ pressed }) => [styles.fab, { backgroundColor: theme.accent }, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel="Rechercher">
      <Ionicons name="search" size={20} color={theme.accentInk} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: Spacing.three,
    bottom: BottomTabInset + Spacing.three,
    width: 48,
    height: 48,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  pressed: {
    opacity: 0.8,
  },
});
