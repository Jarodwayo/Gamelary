import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

// Écran d'accueil pour l'icône notification du Profil. Toujours vide pour
// l'instant : les notifications visées sont celles des personnes suivies,
// et le système d'abonnés/abonnements n'existe pas encore (voir
// ARCHITECTURE.md §9/§10, backlog) — l'écran existe déjà pour ne pas
// bloquer l'icône sur un futur système, plutôt que de l'omettre puis devoir
// retoucher toute la navigation quand les abonnements arriveront.
export default function NotificationsScreen() {
  const theme = useTheme();
  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
        <Ionicons name="notifications-outline" size={40} color={theme.textSecondary} />
        <ThemedText type="smallBold" style={styles.title}>
          Aucune notification
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary" style={styles.message}>
          Les activités des personnes que tu suis apparaîtront ici.
        </ThemedText>
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
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.four,
    gap: Spacing.one,
  },
  title: {
    marginTop: Spacing.two,
  },
  message: {
    textAlign: 'center',
  },
});
