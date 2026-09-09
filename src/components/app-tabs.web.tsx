import {
  Tabs,
  TabList,
  TabTrigger,
  TabSlot,
  TabTriggerSlotProps,
  TabListProps,
} from 'expo-router/ui';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, View, StyleSheet } from 'react-native';

import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';

import { APP_TABS } from '@/components/app-tabs-config';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

// Le suffixe .web.tsx est une convention Metro/React Native : sur le
// bundle web, ce fichier remplace automatiquement app-tabs.tsx (natif),
// sans changer un seul import ailleurs dans le code. C'est nécessaire ici
// car NativeTabs (app-tabs.tsx) ne fonctionne pas sur web ; on reconstruit
// donc la même barre d'onglets avec les primitives génériques
// d'expo-router/ui, en gardant les mêmes noms de route ("library",
// "profile") pour que la navigation reste identique entre plateformes.
export default function AppTabs() {
  return (
    <Tabs>
      <TabSlot style={{ height: '100%' }} />
      <TabList asChild>
        <CustomTabList>
          {/* Même liste que la barre native (voir app-tabs-config.ts) :
              ordre, libellés et icônes viennent d'une seule source, seule
              l'implémentation du rendu diffère. */}
          {APP_TABS.map((tab) => (
            <TabTrigger key={tab.name} name={tab.name} href={tab.href} asChild>
              <TabButton icon={tab.icon}>{tab.label}</TabButton>
            </TabTrigger>
          ))}
        </CustomTabList>
      </TabList>
    </Tabs>
  );
}

// Icône au-dessus du libellé, et pastille arrondie sur l'onglet actif :
// c'est la forme que donne la barre native sur iOS/Android (voir
// app-tabs.tsx), reproduite ici à l'identique plutôt qu'une rangée de
// libellés seuls.
export function TabButton({
  children,
  isFocused,
  icon,
  ...props
}: TabTriggerSlotProps & { icon: keyof typeof Ionicons.glyphMap }) {
  const theme = useTheme();
  return (
    <Pressable {...props} style={({ pressed }) => pressed && styles.pressed}>
      {/* Fond uniquement sur l'onglet actif : un onglet inactif ne peint
          rien du tout, plutôt que de repeindre la couleur de la barre —
          sinon il redeviendrait un rectangle visible le jour où la barre
          change de fond. */}
      <View
        style={[
          styles.tabButtonView,
          isFocused ? { backgroundColor: theme.backgroundSelected } : null,
        ]}>
        <Ionicons name={icon} size={22} color={isFocused ? theme.text : theme.textSecondary} />
        <ThemedText type="small" themeColor={isFocused ? 'text' : 'textSecondary'}>
          {children}
        </ThemedText>
      </View>
    </Pressable>
  );
}

// Pilule flottante détachée des bords, centrée, qui épouse son contenu au
// lieu de s'étirer sur toute la largeur — la barre native ne porte pas non
// plus le nom de l'app, retiré ici pour la même raison.
export function CustomTabList(props: TabListProps) {
  return (
    <View {...props} style={styles.tabListContainer}>
      <ThemedView type="backgroundElement" style={styles.innerContainer}>
        {props.children}
      </ThemedView>
    </View>
  );
}

const styles = StyleSheet.create({
  // `bottom: 0` : la barre est en bas, comme la barre native des deux
  // autres plateformes (voir app-tabs.tsx) — à portée de pouce. Elle reste
  // en position absolue, donc superposée au contenu : ce que les écrans
  // compensent avec BottomTabInset, qui vaut justement sa hauteur sur le
  // web (voir constants/theme.ts).
  tabListContainer: {
    position: 'absolute',
    bottom: 0,
    width: '100%',
    padding: Spacing.three,
    // La pilule est centrée et épouse son contenu (pas de flexGrow sur
    // innerContainer) : elle flotte au milieu du bas de l'écran comme la
    // barre native, au lieu de s'étirer d'un bord à l'autre.
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
  },
  innerContainer: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.two,
    // Pilule : la barre native est entièrement arrondie, pas un rectangle
    // à coins adoucis.
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    maxWidth: MaxContentWidth,
    // Ombre portée : c'est ce qui fait "flotter" la barre au-dessus du
    // contenu plutôt que de la coller au bord de l'écran.
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  pressed: {
    opacity: 0.7,
  },
  tabButtonView: {
    alignItems: 'center',
    gap: Spacing.half,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.four,
    borderRadius: 999,
  },
});
