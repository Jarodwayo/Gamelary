import Ionicons from '@expo/vector-icons/Ionicons';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GamePickerSheet } from '@/components/game-picker-sheet';
import { GameGrid, type GridItem } from '@/components/game-grid';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, ScreenTitleGap, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useGameStore, type StoredGame } from '@/lib/game-store';
import { hoursInPeriod } from '@/lib/hours';

// list/[id].tsx : écran dédié d'une liste personnalisée (favoris/wishlist
// n'en ont pas besoin, déjà leurs propres entrées — "Jeux préférés" du
// Profil, l'onglet Wishlist de Bibliothèque). Jusqu'ici, une liste créée
// (profile/create-list.tsx) n'était affichée que comme une rangée en
// lecture seule du Profil (voir profile/index.tsx, GameShelf) — aucun
// moyen d'y ajouter un jeu une fois créée, seulement depuis le sélecteur de
// listes de CHAQUE fiche jeu individuellement (list-picker-sheet.tsx).
export default function ListDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const store = useGameStore();
  const theme = useTheme();
  const [pickerOpen, setPickerOpen] = useState(false);

  const list = store.lists[id];

  // Id invalide (lien cassé) ou liste supprimée depuis un autre appareil
  // entre la navigation et ce rendu : même traitement explicite que "Jeu
  // introuvable" (library/[id].tsx), plutôt qu'un plantage sur `list.name`.
  if (!list) {
    return (
      <ThemedView style={styles.container}>
        <ThemedText type="subtitle">Liste introuvable</ThemedText>
      </ThemedView>
    );
  }

  const items: GridItem[] = list.gameIds
    .map((gameId) => store.games[gameId])
    .filter((game): game is StoredGame => Boolean(game))
    .map((game) => ({
      id: game.id,
      title: game.title,
      steamAppId: game.steamAppId,
      hours: hoursInPeriod(game.playSessions, 'all'),
    }));

  return (
    <>
      {/* Titre dynamique (nom de la liste), même motif que library/[id].tsx :
          défini ici plutôt que dans _layout.tsx, qui ne connaît pas encore
          la liste au moment de déclarer l'écran. */}
      <Stack.Screen
        options={{
          title: list.name,
          headerRight: () => (
            <Pressable onPress={() => setPickerOpen(true)} hitSlop={8} accessibilityLabel="Ajouter un jeu">
              <Ionicons name="add" size={26} color={theme.text} />
            </Pressable>
          ),
        }}
      />
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea} edges={['left', 'right']}>
          <ScrollView contentContainerStyle={styles.content}>
            <View style={styles.header}>
              {list.description ? (
                <ThemedText themeColor="textSecondary">{list.description}</ThemedText>
              ) : null}
              <ThemedText type="small" themeColor="textSecondary">
                {items.length} {items.length > 1 ? 'jeux' : 'jeu'}
              </ThemedText>
            </View>

            {items.length === 0 ? (
              <View style={styles.emptyWrap}>
                <ThemedText themeColor="textSecondary">Aucun jeu dans cette liste pour le moment.</ThemedText>
                <Pressable onPress={() => setPickerOpen(true)} style={styles.emptyAction}>
                  <ThemedText type="linkPrimary">+ Ajouter un jeu</ThemedText>
                </Pressable>
              </View>
            ) : (
              <GameGrid items={items} />
            )}
          </ScrollView>
        </SafeAreaView>
      </ThemedView>

      <GamePickerSheet visible={pickerOpen} listId={list.id} onClose={() => setPickerOpen(false)} />
    </>
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
    paddingTop: ScreenTitleGap,
    paddingBottom: BottomTabInset + Spacing.four,
    gap: Spacing.three,
  },
  header: {
    paddingHorizontal: Spacing.three,
    gap: Spacing.one,
  },
  emptyWrap: {
    paddingHorizontal: Spacing.three,
    gap: Spacing.two,
  },
  emptyAction: {
    alignSelf: 'flex-start',
  },
});
