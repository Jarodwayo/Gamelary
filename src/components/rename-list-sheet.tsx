import { useState } from 'react';
import { Modal, Pressable, StyleSheet, TextInput } from 'react-native';

import { LIST_NAME_MAX_LENGTH } from '@/app/profile/create-list';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useGameStore } from '@/lib/game-store';

type RenameListSheetProps = {
  visible: boolean;
  listId: string;
  onClose: () => void;
};

// Modale "Renommer" du menu réglages de l'écran d'une liste (voir
// profile/list/[id].tsx) — même gabarit de feuille que game-picker-sheet.tsx/
// list-picker-sheet.tsx, réduit à un seul champ. Réservée aux listes créées
// par l'utilisateur : l'écran appelant ne propose ce menu que pour
// `!list.builtin`.
export function RenameListSheet({ visible, listId, onClose }: RenameListSheetProps) {
  const store = useGameStore();
  const theme = useTheme();
  const list = store.lists[listId];
  const [name, setName] = useState(list?.name ?? '');

  // Cette modale reste montée d'un ouvert/fermé à l'autre (voir son
  // appelant) : un `useState` seul garderait la saisie annulée de la
  // dernière ouverture plutôt que de repartir du nom actuel de la liste.
  // Ajustement pendant le rendu (pattern documenté par React pour "stocker
  // une info venant du rendu précédent"), pas dans un effet : évite le
  // rendu en cascade d'un setState synchrone dans un useEffect.
  const [prevVisible, setPrevVisible] = useState(visible);
  if (visible !== prevVisible) {
    setPrevVisible(visible);
    if (visible) setName(list?.name ?? '');
  }

  const trimmed = name.trim();
  const canSave = trimmed.length > 0 && trimmed !== list?.name;

  function save() {
    if (!canSave) return;
    store.renameList(listId, trimmed);
    onClose();
  }

  // Ne devrait jamais arriver (l'écran appelant garde déjà contre une liste
  // introuvable/supprimée), mais la modale ne suppose pas la liste vivante
  // pour autant — même discipline que game-picker-sheet.tsx.
  if (!list) return null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Fermer">
        <Pressable onPress={(event) => event.stopPropagation()}>
          <ThemedView type="backgroundElement" style={styles.sheet}>
            <ThemedText type="smallBold" style={styles.title}>
              Renommer la liste
            </ThemedText>

            <TextInput
              value={name}
              onChangeText={setName}
              onSubmitEditing={save}
              placeholder="Nom de la liste"
              placeholderTextColor={theme.textSecondary}
              maxLength={LIST_NAME_MAX_LENGTH}
              autoFocus
              style={[styles.input, { color: theme.text, borderColor: theme.textSecondary }]}
            />

            <Pressable
              onPress={save}
              disabled={!canSave}
              accessibilityRole="button"
              accessibilityLabel="Confirmer le renommage"
              style={[styles.saveButton, { backgroundColor: canSave ? theme.accent : theme.backgroundSelected }]}>
              <ThemedText style={{ color: canSave ? theme.accentInk : theme.textSecondary }}>Renommer</ThemedText>
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
    gap: Spacing.two,
  },
  title: {
    marginBottom: Spacing.one,
  },
  input: {
    borderWidth: 1,
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    fontSize: 16,
  },
  saveButton: {
    marginTop: Spacing.two,
    borderRadius: 999,
    paddingVertical: Spacing.two,
    alignItems: 'center',
  },
});
