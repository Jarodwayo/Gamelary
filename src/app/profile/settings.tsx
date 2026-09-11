import { useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SettingsGroup, SettingsSectionTitle, type SettingsItem } from '@/components/settings-list';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { useAuth } from '@/lib/auth-store';
import { useGameStore } from '@/lib/game-store';
import { syncLibrary, syncLists } from '@/lib/sync/sync-service';
import { DEFAULT_TITLE_ARTWORK, titleArtworkLabel } from '@/lib/title-artwork';

type SyncState = { kind: 'idle' } | { kind: 'syncing' } | { kind: 'success' } | { kind: 'error'; message: string };

function syncValueLabel(state: SyncState): string | undefined {
  switch (state.kind) {
    case 'syncing':
      return 'Synchronisation…';
    case 'success':
      return 'À jour';
    case 'error':
      return 'Échec';
    default:
      return undefined;
  }
}

// Écran "Paramètres" (menu ⋯ du Profil). Volontairement limité à ce qui
// existe vraiment : pas de ligne Langue/Import-Export tant que ces écrans
// n'existent pas (voir ARCHITECTURE.md §10) — une ligne qui n'ouvre rien
// serait pire que son absence.
export default function SettingsScreen() {
  const store = useGameStore();
  const auth = useAuth();
  const artwork = store.settings.titleArtwork ?? DEFAULT_TITLE_ARTWORK;
  const [syncState, setSyncState] = useState<SyncState>({ kind: 'idle' });

  const display: SettingsItem[] = [
    {
      kind: 'internal',
      key: 'title-artwork',
      icon: 'images-outline',
      label: 'Affiche de la page titre',
      value: titleArtworkLabel(artwork),
      to: '/profile/settings-artwork',
    },
  ];

  const account: SettingsItem[] = [
    { kind: 'internal', key: 'edit-profile', icon: 'person-outline', label: 'Modifier le profil', to: '/profile/edit' },
  ];

  // Déclencheur MANUEL de la synchro §9.5, en plus de celui automatique à la
  // connexion (voir hooks/use-sign-in-sync.ts) — utile quand l'utilisateur
  // vient de modifier sa bibliothèque sur un autre appareil et ne veut pas
  // attendre sa prochaine connexion sur celui-ci. N'apparaît que
  // status === 'signedIn' : sans compte connecté, il n'y a rien à
  // synchroniser (voir ARCHITECTURE.md §9.4).
  if (auth.status === 'signedIn') {
    const userId = auth.session?.user?.id;
    account.push({
      kind: 'action',
      key: 'sync-now',
      icon: 'sync-outline',
      label: 'Synchroniser maintenant',
      value: syncValueLabel(syncState),
      onPress: async () => {
        if (!userId || syncState.kind === 'syncing') return;
        setSyncState({ kind: 'syncing' });
        // Bibliothèque d'abord : syncLists a besoin des lignes user_games
        // distantes déjà créées pour traduire l'appartenance aux listes
        // (voir sync-service.ts et hooks/use-sign-in-sync.ts, même ordre).
        const libraryResult = await syncLibrary(userId, store.games, store.lists, store.applySyncedGames);
        const listsResult = libraryResult.error
          ? libraryResult
          : await syncLists(userId, store.games, store.lists, store.applySyncedLists);
        setSyncState(listsResult.error ? { kind: 'error', message: listsResult.error } : { kind: 'success' });
      },
    });
  }

  account.push({ kind: 'internal', key: 'help', icon: 'bulb-outline', label: 'Aide et idées', to: '/profile/help' });

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
        <ScrollView contentContainerStyle={styles.content}>
          <SettingsSectionTitle>AFFICHAGE</SettingsSectionTitle>
          <SettingsGroup items={display} />

          <SettingsSectionTitle>PROFIL</SettingsSectionTitle>
          <SettingsGroup items={account} />
          {syncState.kind === 'error' ? (
            <ThemedText type="small" themeColor="danger" style={styles.syncError}>
              {syncState.message}
            </ThemedText>
          ) : null}
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
  syncError: {
    marginTop: Spacing.two,
    marginHorizontal: Spacing.four,
  },
});
