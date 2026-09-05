import { useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';

export type OverflowMenuItem = { key: string; label: string; onPress: () => void };

// Bouton "⋯" + menu déroulant. Rendu dans un Modal transparent plutôt qu'un
// simple View positionné en absolute : React Native n'a pas d'équivalent
// direct du "clic en dehors pour fermer" du web sans écouteur global, un
// Modal plein écran donne ce comportement gratuitement (le fond fait office
// de zone de fermeture). Position approximative sous le bouton (pas de
// mesure dynamique de son ancrage) : suffisant tant que ce menu n'apparaît
// qu'au même endroit (en-tête de la fiche jeu).
export function OverflowMenu({ items }: { items: OverflowMenuItem[] }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Pressable onPress={() => setOpen(true)} hitSlop={8} accessibilityLabel="Plus d'options">
        <ThemedText type="subtitle">⋯</ThemedText>
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <View style={styles.anchor}>
            <Pressable onPress={(event) => event.stopPropagation()}>
              <ThemedView type="backgroundElement" style={styles.menu}>
                {items.map((item) => (
                  <Pressable
                    key={item.key}
                    onPress={() => {
                      setOpen(false);
                      item.onPress();
                    }}
                    style={styles.item}>
                    <ThemedText>{item.label}</ThemedText>
                  </Pressable>
                ))}
              </ThemedView>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
  },
  anchor: {
    position: 'absolute',
    top: 54,
    right: Spacing.three,
  },
  menu: {
    minWidth: 180,
    borderRadius: Spacing.three,
    paddingVertical: Spacing.one,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  item: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
});
