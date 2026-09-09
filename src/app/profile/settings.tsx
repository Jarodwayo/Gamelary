import { ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SettingsGroup, SettingsSectionTitle, type SettingsItem } from '@/components/settings-list';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { useGameStore } from '@/lib/game-store';
import { DEFAULT_TITLE_ARTWORK, titleArtworkLabel } from '@/lib/title-artwork';

// Écran "Paramètres" (menu ⋯ du Profil). Volontairement limité à ce qui
// existe vraiment : pas de ligne Compte/Langue/Import-Export tant que ces
// écrans n'existent pas (voir ARCHITECTURE.md §10) — une ligne qui n'ouvre
// rien serait pire que son absence.
export default function SettingsScreen() {
  const store = useGameStore();
  const artwork = store.settings.titleArtwork ?? DEFAULT_TITLE_ARTWORK;

  const display: SettingsItem[] = [
    {
      key: 'title-artwork',
      icon: 'images-outline',
      label: 'Affiche de la page titre',
      value: titleArtworkLabel(artwork),
      to: '/profile/settings-artwork',
    },
  ];

  const account: SettingsItem[] = [
    { key: 'edit-profile', icon: 'person-outline', label: 'Modifier le profil', to: '/profile/edit' },
    { key: 'help', icon: 'bulb-outline', label: 'Aide et idées', to: '/profile/help' },
  ];

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
        <ScrollView contentContainerStyle={styles.content}>
          <SettingsSectionTitle>AFFICHAGE</SettingsSectionTitle>
          <SettingsGroup items={display} />

          <SettingsSectionTitle>PROFIL</SettingsSectionTitle>
          <SettingsGroup items={account} />
        </ScrollView>
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
  },
  content: {
    paddingBottom: BottomTabInset + Spacing.five,
  },
});
