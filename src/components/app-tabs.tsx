import Ionicons from '@expo/vector-icons/Ionicons';
import { VectorIcon } from 'expo-router';
import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { useColorScheme } from 'react-native';

import { APP_TABS } from '@/components/app-tabs-config';
import { Colors } from '@/constants/theme';

// NativeTabs (expo-router/unstable-native-tabs, SDK 57+) délègue la barre
// d'onglets au vrai composant natif (UITabBarController sur iOS,
// BottomNavigationView sur Android) au lieu de la redessiner en JS comme
// l'ancien <Tabs>. Gain : rendu, gestes et transitions 100% natifs.
//
// Pourquoi app-tabs.web.tsx existe malgré tout : NativeTabs a bien un rendu
// web dans ce SDK (build/native-tabs/NativeTabsView.web.js, à base de
// @radix-ui/react-tabs), mais il ne dessine QUE les libellés — les
// <Trigger.Icon> ci-dessous y sont ignorés — dans une barre fixée en HAUT
// de l'écran par sa feuille de style (assets/native-tabs.module.css,
// `position: fixed; top: 24px`). L'utiliser sur le web éloignerait donc du
// rendu natif au lieu de s'en rapprocher : pas d'icônes, pas de pilule
// active, pas de barre en bas. D'où une réimplémentation web à partir des
// primitives expo-router/ui — mais une seule liste d'onglets pour les deux
// (voir app-tabs-config.ts), pour qu'elles ne puissent pas diverger.
//
// Chaque onglet `name` correspond à un fichier/dossier src/app/<name>.
// "library" et "profile" pointent vers des dossiers avec leur propre
// _layout (Stack) pour pousser une fiche/sous-écran par-dessus tout en
// gardant la barre d'onglets visible ; "explorer" est un simple fichier
// (pas de navigation imbriquée pour l'instant).
export default function AppTabs() {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'unspecified' ? 'light' : scheme];

  return (
    <NativeTabs
      backgroundColor={colors.background}
      indicatorColor={colors.backgroundElement}
      labelStyle={{ selected: { color: colors.text } }}>
      {APP_TABS.map((tab) => (
        <NativeTabs.Trigger key={tab.name} name={tab.name}>
          <NativeTabs.Trigger.Label>{tab.label}</NativeTabs.Trigger.Label>
          {/* VectorIcon (Ionicons) plutôt que des PNG ou des SF Symbols : un
              seul jeu d'icônes vectorielles qui rend correctement sur iOS
              comme Android, sans avoir à fournir un asset par plateforme. */}
          <NativeTabs.Trigger.Icon src={<VectorIcon family={Ionicons} name={tab.icon} />} />
        </NativeTabs.Trigger>
      ))}
    </NativeTabs>
  );
}
