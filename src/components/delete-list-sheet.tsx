import { Modal, Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useGameStore } from '@/lib/game-store';

type DeleteListSheetProps = {
  visible: boolean;
  listId: string;
  onClose: () => void;
  // Distinct de onClose : l'écran appelant (profile/list/[id].tsx) doit
  // quitter l'écran désormais introuvable une fois la liste réellement
  // supprimée, pas seulement fermer cette feuille comme le ferait Annuler.
  onDeleted: () => void;
};

// Confirmation avant suppression (action destructive/irréversible, voir
// constants/theme.ts) — une <Modal> custom plutôt qu'Alert.alert (déjà
// utilisé ailleurs pour ce type de confirmation, ex. "Remplacer les succès
// existants ?" dans library/[id].tsx) : Alert.alert est un NO-OP sur
// react-native-web (voir node_modules/react-native-web/.../exports/Alert —
// `static alert() {}`), donc invisible et sans le moindre effet sur le web.
// Une régression inacceptable pour une action destructive dans une app qui
// supporte le web comme cible à part entière (voir ARCHITECTURE.md §1) :
// le bouton "Supprimer" n'aurait alors littéralement aucun effet sur cette
// plateforme. Même gabarit de feuille que les autres modales de cet écran
// (game-picker-sheet.tsx, rename-list-sheet.tsx).
export function DeleteListSheet({ visible, listId, onClose, onDeleted }: DeleteListSheetProps) {
  const store = useGameStore();
  const theme = useTheme();
  const list = store.lists[listId];

  // Ne devrait jamais arriver (l'écran appelant garde déjà contre une liste
  // introuvable/supprimée), mais la modale ne suppose pas la liste vivante
  // pour autant — même discipline que les autres feuilles de cet écran.
  if (!list) return null;

  function confirmDelete() {
    store.deleteList(listId);
    onDeleted();
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Fermer">
        <Pressable onPress={(event) => event.stopPropagation()}>
          <ThemedView type="backgroundElement" style={styles.sheet}>
            <ThemedText type="smallBold" style={styles.title}>
              Supprimer cette liste ?
            </ThemedText>
            <ThemedText themeColor="textSecondary">
              « {list.name} » sera définitivement supprimée. Les jeux qu’elle contient restent dans ta
              bibliothèque.
            </ThemedText>

            {/* "Annuler" reste l'option visuellement prononcée (fond plein) :
                l'option destructive ne doit jamais être celle qui attire
                l'œil, seulement celle qu'on choisit en le décidant vraiment —
                même logique que la distinction danger/accent de
                constants/theme.ts. */}
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              style={[styles.button, { backgroundColor: theme.backgroundSelected }]}>
              <ThemedText type="smallBold">Annuler</ThemedText>
            </Pressable>
            <Pressable
              onPress={confirmDelete}
              accessibilityRole="button"
              accessibilityLabel="Confirmer la suppression"
              style={styles.button}>
              <ThemedText type="smallBold" themeColor="danger">
                Supprimer la liste
              </ThemedText>
            </Pressable>
          </ThemedView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheet: {
    borderTopLeftRadius: Spacing.four,
    borderTopRightRadius: Spacing.four,
    padding: Spacing.four,
    gap: Spacing.three,
  },
  title: {
    marginBottom: Spacing.one,
  },
  button: {
    borderRadius: 999,
    paddingVertical: Spacing.two,
    alignItems: 'center',
  },
});
