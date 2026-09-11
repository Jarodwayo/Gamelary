import Ionicons from '@expo/vector-icons/Ionicons';
import { Link, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GameCoverGrid } from '@/components/game-cover';
import { GamePickerSheet } from '@/components/game-picker-sheet';
import { useGridItemWidth, type GridItem } from '@/components/game-grid';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, ScreenTitleGap, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useGameStore, type StoredGame } from '@/lib/game-store';
import { formatGameTitle } from '@/lib/game-title';
import { formatHours, hoursInPeriod } from '@/lib/hours';

// Carte de grille avec un bouton de retrait, contrairement à GameGrid
// (game-grid.tsx, réutilisée par Bibliothèque/Explorer/Profil) : retirer un
// jeu n'a de sens QUE dans le contexte d'une liste précise, jamais pour ces
// autres écrans — pas de prop optionnelle ajoutée à un composant partagé
// pour un unique appelant. Bouton en overlay plutôt qu'une seconde ligne
// sous la jaquette : découvrable sans agrandir chaque carte de la grille.
function ListGameCard({
  item,
  itemWidth,
  onRemove,
}: {
  item: GridItem;
  itemWidth: number;
  onRemove: () => void;
}) {
  const theme = useTheme();
  return (
    <View style={{ width: itemWidth, gap: Spacing.one }}>
      <View style={styles.coverWrap}>
        <Link href={{ pathname: '/library/[id]', params: { id: item.id } }} asChild>
          <Pressable>
            <GameCoverGrid title={item.title} steamAppId={item.steamAppId} />
          </Pressable>
        </Link>
        {/* Couleur neutre, PAS theme.danger (voir constants/theme.ts —
            réservée aux actions destructives/irréversibles) : retirer un jeu
            d'une liste ne l'est pas, le jeu reste connu et peut être
            rajouté à tout moment. */}
        <Pressable
          onPress={onRemove}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={`Retirer ${item.title} de la liste`}
          style={[styles.removeBadge, { backgroundColor: theme.backgroundSelected }]}>
          <Ionicons name="close" size={14} color={theme.text} />
        </Pressable>
      </View>
      <ThemedText type="small" style={styles.cardTitle}>
        {formatGameTitle(item.title)}
      </ThemedText>
      {item.hours ? (
        <ThemedText type="small" themeColor="textSecondary">
          {formatHours(item.hours)}
        </ThemedText>
      ) : null}
    </View>
  );
}

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
  const itemWidth = useGridItemWidth();
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
              <View style={styles.grid}>
                {items.map((item) => (
                  <ListGameCard
                    key={item.id}
                    item={item}
                    itemWidth={itemWidth}
                    onRemove={() => store.toggleListMembership(list.id, item.id)}
                  />
                ))}
              </View>
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
  // Même mise en page que GameGrid (game-grid.tsx), dupliquée ici plutôt que
  // réutilisée : voir le commentaire de ListGameCard plus haut.
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: Spacing.three,
    gap: Spacing.three,
  },
  cardTitle: {
    fontWeight: '600',
  },
  coverWrap: {
    position: 'relative',
  },
  removeBadge: {
    position: 'absolute',
    top: Spacing.one,
    right: Spacing.one,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
