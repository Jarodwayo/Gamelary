import { ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SettingsGroup, SettingsSectionTitle, type SettingsItem } from '@/components/settings-list';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { FEATURE_REQUESTS_URL, REPORT_PROBLEM_URL, supportContactUrl } from '@/lib/support-links';

// "Aide et idées" (menu ⋯ du Profil). Les trois entrées ouvrent le suivi
// d'issues du dépôt public plutôt qu'un portail maison : c'est le canal qui
// existe réellement aujourd'hui (voir support-links.ts), pas une promesse
// d'assistance qui n'aboutirait nulle part.
export default function HelpScreen() {
  const community: SettingsItem[] = [
    {
      key: 'feature-requests',
      icon: 'bulb-outline',
      label: 'Demandes de fonctionnalités',
      href: FEATURE_REQUESTS_URL,
    },
  ];

  const support: SettingsItem[] = [
    {
      key: 'report-problem',
      icon: 'bug-outline',
      label: 'Signaler un problème',
      href: REPORT_PROBLEM_URL,
    },
    {
      key: 'contact',
      icon: 'mail-outline',
      label: "Contacter l'assistance",
      href: supportContactUrl(),
    },
  ];

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
        <ScrollView contentContainerStyle={styles.content}>
          <SettingsSectionTitle>COMMUNAUTÉ</SettingsSectionTitle>
          <SettingsGroup items={community} />

          <SettingsSectionTitle>ASSISTANCE</SettingsSectionTitle>
          <SettingsGroup items={support} />

          <ThemedText type="small" themeColor="textSecondary" style={styles.hint}>
            Propose des fonctionnalités, signale un problème ou écris-nous. Tout passe par le suivi
            d’issues du dépôt Gamelary sur GitHub.
          </ThemedText>
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
  hint: {
    marginTop: Spacing.three,
    marginHorizontal: Spacing.four,
  },
});
