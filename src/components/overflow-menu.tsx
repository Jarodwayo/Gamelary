import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type OverflowMenuItem = {
  key: string;
  label: string;
  onPress: () => void;
  // Icône optionnelle (ex. menu du Profil, voir profile/index.tsx) — le
  // menu de la fiche jeu (library/[id].tsx) n'en passe pas, purement
  // textuel, les deux cohabitent dans le même composant.
  icon?: keyof typeof Ionicons.glyphMap;
  // Action destructive/irréversible (ex. "Se déconnecter") : texte en
  // rouge et séparée visuellement des autres options par une ligne, plutôt
  // que noyée dans la même liste — évite un tap accidentel qui la
  // confondrait avec une option anodine.
  destructive?: boolean;
};

// Durée de l'animation "fade" du Modal ci-dessous (voir son commentaire) —
// pas de constante exposée par React Native pour ça, 300ms est la valeur
// usuelle documentée pour ce genre de transition modale.
const ANIMATION_CLOSE_DELAY_MS = 300;

// Bouton "⋯" + menu déroulant. Rendu dans un Modal transparent plutôt qu'un
// simple View positionné en absolute : React Native n'a pas d'équivalent
// direct du "clic en dehors pour fermer" du web sans écouteur global, un
// Modal plein écran donne ce comportement gratuitement (le fond fait office
// de zone de fermeture). Position approximative sous le bouton (pas de
// mesure dynamique de son ancrage), réglable via `anchorTop` : le bouton
// n'apparaît pas toujours à la même hauteur selon l'écran (en-tête de la
// fiche jeu vs. Profil, voir profile/index.tsx). `icon` optionnel (sinon le
// glyphe "⋯" par défaut) pour matcher un bouton Ionicons voisin, comme la
// cloche de notification du Profil.
export function OverflowMenu({
  items,
  icon,
  iconColor,
  anchorTop = 54,
}: {
  items: OverflowMenuItem[];
  icon?: keyof typeof Ionicons.glyphMap;
  // Uniquement pour un bouton posé sur autre chose qu'une couleur du thème
  // (bannière du Profil, voir profile/index.tsx) : partout ailleurs, la
  // couleur de texte du thème reste la bonne et cette prop est omise.
  iconColor?: string;
  anchorTop?: number;
}) {
  const [open, setOpen] = useState(false);
  const theme = useTheme();

  return (
    <>
      <Pressable onPress={() => setOpen(true)} hitSlop={8} accessibilityLabel="Plus d'options">
        {icon ? (
          <Ionicons name={icon} size={24} color={iconColor ?? theme.text} />
        ) : (
          <ThemedText type="subtitle">⋯</ThemedText>
        )}
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <View style={[styles.anchor, { top: anchorTop }]}>
            <Pressable onPress={(event) => event.stopPropagation()}>
              <ThemedView type="backgroundElement" style={styles.menu}>
                {items.map((item, index) => {
                  const previousDestructive = index > 0 && items[index - 1].destructive;
                  return (
                    <Pressable
                      key={item.key}
                      onPress={() => {
                        setOpen(false);
                        // Sur natif, présenter un second <Modal> (ex.
                        // "Ajouter à une liste" -> list-picker-sheet.tsx)
                        // avant que celui-ci ait fini de se fermer peut
                        // faire disparaître silencieusement la présentation
                        // du second : iOS ne présente qu'un view
                        // controller modal à la fois, et fermer/ouvrir dans
                        // le même tick queue les deux au même instant côté
                        // UIKit. Jamais reproduit sur le web
                        // (react-native-web n'a pas de vraie présentation
                        // native) — c'est justement ce qui avait caché ce
                        // bug jusqu'ici. ANIMATION_CLOSE_DELAY_MS laisse le
                        // temps à l'animation de fermeture de ce menu de se
                        // terminer avant que l'appelant n'ouvre quoi que ce
                        // soit d'autre.
                        setTimeout(() => item.onPress(), ANIMATION_CLOSE_DELAY_MS);
                      }}
                      style={[
                        styles.item,
                        // Séparateur juste avant la première option destructive
                        // (et seulement là) : le groupe d'actions normales et
                        // l'action destructive doivent rester visuellement
                        // distincts, pas une ligne entre chaque option.
                        item.destructive && !previousDestructive
                          ? [styles.destructiveGroup, { borderTopColor: theme.backgroundSelected }]
                          : null,
                      ]}>
                      {item.icon ? (
                        <Ionicons
                          name={item.icon}
                          size={18}
                          color={item.destructive ? theme.danger : theme.text}
                          style={styles.itemIcon}
                        />
                      ) : null}
                      <ThemedText themeColor={item.destructive ? 'danger' : undefined}>{item.label}</ThemedText>
                    </Pressable>
                  );
                })}
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
    minWidth: 220,
    borderRadius: Spacing.three,
    paddingVertical: Spacing.one,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
  itemIcon: {
    marginRight: Spacing.two,
  },
  destructiveGroup: {
    marginTop: Spacing.one,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: Spacing.two + Spacing.one,
  },
});
