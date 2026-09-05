import Ionicons from '@expo/vector-icons/Ionicons';
import { VectorIcon } from 'expo-router';
import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { useColorScheme } from 'react-native';

import { Colors } from '@/constants/theme';

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
        <NativeTabs.Trigger.Icon src={<VectorIcon family={Ionicons} name="albums" />} />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="profile">
        <NativeTabs.Trigger.Label>Profil</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon src={<VectorIcon family={Ionicons} name="person-circle" />} />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
