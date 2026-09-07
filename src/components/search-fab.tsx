import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';

import { BottomTabInset, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

// Rendu au niveau racine (voir app/_layout.tsx), pas dans la barre d'onglets
// elle-même : NativeTabs ne permet pas d'insérer un élément personnalisé
// dans la barre native. Un unique bouton icône, à côté de la barre plutôt
// qu'une barre de recherche factice superposée à l'écran (essayé
// précédemment : rendu incohérent selon l'écran, retiré).
export function SearchFab() {
  const router = useRouter();
  const theme = useTheme();

  return (
    <Pressable
      onPress={() => router.push('/library/search')}
      style={({ pressed }) => [styles.fab, { backgroundColor: theme.accent }, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel="Rechercher un jeu">
      <Ionicons name="search" size={20} color={theme.accentInk} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: Spacing.three,
    bottom: BottomTabInset + Spacing.two,
    width: 48,
    height: 48,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  pressed: {
    opacity: 0.85,
  },
});
