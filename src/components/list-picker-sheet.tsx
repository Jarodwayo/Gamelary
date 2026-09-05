import { useState } from 'react';
import { Modal, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useGameStore } from '@/lib/game-store';

type ListPickerSheetProps = {
  visible: boolean;
  gameId: string;
  onClose: () => void;
};

// Modale "Ajouter à une liste" (menu ⋯ de la fiche jeu) : coche/décoche
// l'appartenance du jeu à chaque liste (Favoris/Wishlist intégrées, plus
// les listes créées par l'utilisateur), et permet d'en créer une nouvelle
// à la volée. Favoris est justement ce qui alimente "Jeux préférés" sur le
// Profil — voir game-store.tsx.
export function ListPickerSheet({ visible, gameId, onClose }: ListPickerSheetProps) {
  const store = useGameStore();
  const theme = useTheme();
  const [creating, setCreating] = useState(false);
  const [newListName, setNewListName] = useState('');

  function confirmNewList() {
    const name = newListName.trim();
    if (!name) return;
    const id = store.createList(name);
    store.toggleListMembership(id, gameId);
    setNewListName('');
    setCreating(false);
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Fermer">
        <Pressable onPress={(event) => event.stopPropagation()}>
          <ThemedView type="backgroundElement" style={styles.sheet}>
            <ThemedText type="smallBold" style={styles.title}>
              Ajouter à une liste
            </ThemedText>

            {Object.values(store.lists).map((list) => {
              const checked = list.gameIds.includes(gameId);
              return (
                <Pressable
                  key={list.id}
                  onPress={() => store.toggleListMembership(list.id, gameId)}
                  style={styles.row}>
                  <ThemedText>{list.name}</ThemedText>
                  <View
                    style={[
                      styles.checkbox,
                      { borderColor: theme.textSecondary },
                      checked && { backgroundColor: theme.accent, borderColor: theme.accent },
                    ]}
                  />
                </Pressable>
              );
            })}

            {creating ? (
              <View style={styles.createRow}>
                <TextInput
                  value={newListName}
                  onChangeText={setNewListName}
                  onSubmitEditing={confirmNewList}
                  placeholder="Nom de la liste"
                  placeholderTextColor={theme.textSecondary}
                  autoFocus
                  style={[styles.input, { color: theme.text, borderColor: theme.textSecondary }]}
                />
              </View>
            ) : (
              <Pressable onPress={() => setCreating(true)} style={styles.row}>
                <ThemedText themeColor="textSecondary">+ Créer une liste</ThemedText>
              </Pressable>
            )}

            <Pressable
              onPress={onClose}
              style={[styles.doneButton, { backgroundColor: theme.accent }]}>
              <ThemedText style={{ color: theme.accentInk }}>Terminé</ThemedText>
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
    gap: Spacing.one,
  },
  title: {
    marginBottom: Spacing.two,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.two,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: Spacing.one,
    borderWidth: 1,
  },
  createRow: {
    paddingVertical: Spacing.two,
  },
  input: {
    borderWidth: 1,
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  doneButton: {
    marginTop: Spacing.three,
    borderRadius: 999,
    paddingVertical: Spacing.two,
    alignItems: 'center',
  },
});
