import Ionicons from '@expo/vector-icons/Ionicons';
import { VectorIcon } from 'expo-router';
import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { useColorScheme } from 'react-native';

import { Colors } from '@/constants/theme';

// NativeTabs (expo-router/unstable-native-tabs, SDK 57+) délègue la barre
// d'onglets au vrai composant natif (UITabBarController sur iOS,
// BottomNavigationView sur Android) au lieu de la redessiner en JS comme
// l'ancien <Tabs>. Gain : rendu, gestes et transitions 100% natifs. En
// contrepartie l'API ne fonctionne pas sur web, d'où l'existence de
// app-tabs.web.tsx qui réimplémente la même interface avec expo-router/ui.
//
// Chaque <NativeTabs.Trigger name="X"> correspond à un fichier/dossier
// src/app/X. "library" pointe vers un dossier avec son propre _layout
// (Stack) pour permettre de pousser la fiche jeu par-dessus la liste tout
// en gardant la barre d'onglets visible ; "profile" est un simple fichier
// car cet onglet n'a pas (encore) de navigation imbriquée.
export default function AppTabs() {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'unspecified' ? 'light' : scheme];

  return (
    <NativeTabs
      backgroundColor={colors.background}
      indicatorColor={colors.backgroundElement}
      labelStyle={{ selected: { color: colors.text } }}>
      <NativeTabs.Trigger name="library">
        <NativeTabs.Trigger.Label>Bibliothèque</NativeTabs.Trigger.Label>
        {/* VectorIcon (Ionicons) plutôt que des PNG ou des SF Symbols : un
            seul jeu d'icônes vectorielles qui rend correctement sur iOS,
            Android ET web, sans avoir à fournir un asset par plateforme. */}
        <NativeTabs.Trigger.Icon src={<VectorIcon family={Ionicons} name="albums" />} />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="profile">
        <NativeTabs.Trigger.Label>Profil</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon src={<VectorIcon family={Ionicons} name="person-circle" />} />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
