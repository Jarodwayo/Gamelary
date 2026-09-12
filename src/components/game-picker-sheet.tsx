import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { GameCover } from '@/components/game-cover';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { resolveCatalogId } from '@/data/tracked-games';
import { useTheme } from '@/hooks/use-theme';
import { apiUrl } from '@/lib/api-url';
import { useGameStore } from '@/lib/game-store';

type GamePickerSheetProps = {
  visible: boolean;
  listId: string;
  onClose: () => void;
};

type SearchStatus = 'idle' | 'loading' | 'not-found' | 'error';

// Modale "Ajouter un jeu" (écran d'une liste, voir app/profile/list/[id].tsx)
// — symétrique de list-picker-sheet.tsx (qui choisit des LISTES pour un jeu
// donné) : ici on choisit des JEUX pour une liste donnée. Deux sources,
// jamais confondues avec un ajout à la bibliothèque (toggleListMembership
// ne touche jamais `inLibrary`, voir game-store.tsx) :
// - déjà connus localement (`store.games` — bibliothèque ou simplement déjà
//   croisés via Explorer/une fiche jeu, peu importe `inLibrary`) : filtrés
//   au fil de la frappe, aucun aller-retour réseau ;
// - sinon, recherche IGDB à la demande (même route que library/search.tsx)
//   pour un jeu jamais croisé du tout, ajouté à la liste dès trouvé.
export function GamePickerSheet({ visible, listId, onClose }: GamePickerSheetProps) {
  const store = useGameStore();
  const theme = useTheme();
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<SearchStatus>('idle');

  const list = store.lists[listId];
  const trimmed = query.trim();
  const matches = trimmed
    ? Object.values(store.games)
        .filter((game) => game.title.toLowerCase().includes(trimmed.toLowerCase()))
        .sort((a, b) => a.title.localeCompare(b.title))
    : [];

  function reset() {
    setQuery('');
    setStatus('idle');
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function searchIgdb() {
    if (!trimmed) return;
    setStatus('loading');
    try {
      const response = await fetch(apiUrl(`/api/games?title=${encodeURIComponent(trimmed)}`));
      const data: {
        title: string | null;
        platform: string | null;
        steamAppId?: number | null;
        igdbId?: number | null;
        summary?: string | null;
      } = await response.json();
      if (!data.title) {
        setStatus('not-found');
        return;
      }
      const found = {
        id: resolveCatalogId(data.title),
        title: data.title,
        platform: data.platform ?? 'Plateforme inconnue',
        steamAppId: data.steamAppId ?? undefined,
        igdbId: data.igdbId ?? undefined,
        summary: data.summary ?? undefined,
      };
      // registerCatalogGame avant toggleListMembership : un jeu doit déjà
      // avoir sa ligne dans store.games pour que la liste puisse ensuite
      // résoudre son gameId en jeu affichable (voir list/[id].tsx et
      // profile/index.tsx, qui filtrent silencieusement tout id inconnu).
      store.registerCatalogGame(found);
      if (!store.lists[listId]?.gameIds.includes(found.id)) {
        store.toggleListMembership(listId, found.id);
      }
      reset();
    } catch {
      setStatus('error');
    }
  }

  // Ne devrait jamais arriver (l'écran appelant garde déjà contre une liste
  // introuvable/supprimée), mais le composant ne suppose pas la liste
  // vivante pour autant — une liste supprimée depuis un autre appareil
  // pendant que cette modale reste montée ici ne doit pas planter, ni
  // continuer à proposer d'y ajouter un jeu.
  if (!list || list.deletedAt != null) return null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      {/* Même classe de bug que le champ SteamID64 (profile/index.tsx) : le
          clavier recouvre une partie du contenu affiché sous le champ actif.
          Là-bas, un simple ScrollView plein écran suffisait
          (automaticallyAdjustKeyboardInsets délègue tout à RN). Ici, la
          feuille est une Modal positionnée en bas de l'écran et sa
          ScrollView interne des résultats a une hauteur fixe (voir
          styles.results) — elle ne couvre pas le reste de la feuille (champ,
          statut, bouton Terminé), donc rien à qui déléguer un ajustement
          automatique. D'où le remède "manuel" que ce prop évitait déjà
          là-bas : KeyboardAvoidingView. 'padding' sur iOS, 'height' sur
          Android — 'padding' y est peu fiable (retours connus de
          l'écosystème RN), 'height' y donne un résultat plus stable. */}
      <KeyboardAvoidingView style={styles.backdrop} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <Pressable style={styles.backdropPress} onPress={handleClose} accessibilityLabel="Fermer">
          <Pressable onPress={(event) => event.stopPropagation()}>
            <ThemedView type="backgroundElement" style={styles.sheet}>
              <ThemedText type="smallBold" style={styles.title}>
                Ajouter un jeu à {list.name}
              </ThemedText>

              <TextInput
                value={query}
                onChangeText={(text) => {
                  setQuery(text);
                  setStatus('idle');
                }}
                onSubmitEditing={searchIgdb}
                returnKeyType="search"
                placeholder="Titre d'un jeu"
                placeholderTextColor={theme.textSecondary}
                autoFocus
                style={[styles.input, { color: theme.text, borderColor: theme.textSecondary }]}
              />

              {trimmed ? (
                <>
                  {/* ScrollView monté seulement s'il y a quelque chose à
                      défiler : un ScrollView RN Web dont le SEUL enfant
                      apparaît après coup (ex. un unique bouton "Chercher sur
                      IGDB" ajouté suite à une frappe, sans être passé par
                      .map()) peut voir son conteneur de défilement rester
                      mesuré à 0px — jamais reproduit quand matches.length > 0
                      dès le premier rendu (voir le test e2e de ce fichier,
                      qui a servi à isoler précisément ce cas). Le repli IGDB
                      et les messages de statut vivent donc TOUJOURS en dehors
                      du ScrollView, jamais soumis à ce risque. */}
                  {matches.length > 0 && (
                    <ScrollView style={styles.results} keyboardShouldPersistTaps="handled">
                      {matches.map((game) => {
                        const checked = list.gameIds.includes(game.id);
                        return (
                          <Pressable
                            key={game.id}
                            onPress={() => store.toggleListMembership(listId, game.id)}
                            style={styles.row}>
                            <GameCover title={game.title} steamAppId={game.steamAppId} />
                            <View style={styles.rowText}>
                              <ThemedText numberOfLines={1}>{game.title}</ThemedText>
                              <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                                {game.platform}
                              </ThemedText>
                            </View>
                            <View
                              style={[
                                styles.checkbox,
                                { borderColor: theme.textSecondary },
                                checked && { backgroundColor: theme.accent, borderColor: theme.accent },
                              ]}
                            />
                          </Pressable>
                        );
                      })}
                    </ScrollView>
                  )}

                  {status === 'loading' ? (
                    <ActivityIndicator style={styles.spinner} color={theme.accent} />
                  ) : status === 'not-found' ? (
                    <ThemedText themeColor="textSecondary" style={styles.message}>
                      Aucun jeu trouvé pour « {trimmed} ».
                    </ThemedText>
                  ) : status === 'error' ? (
                    <ThemedText themeColor="danger" style={styles.message}>
                      Erreur de recherche, réessaie.
                    </ThemedText>
                  ) : (
                    // Toujours proposée quand la frappe ne matche rien de déjà
                    // connu, même si un jeu identique existe peut-être déjà
                    // sur IGDB sous une orthographe légèrement différente :
                    // mieux vaut laisser l'utilisateur retenter une recherche
                    // exacte que deviner à sa place.
                    matches.length === 0 && (
                      <Pressable onPress={searchIgdb} style={styles.row}>
                        <ThemedText themeColor="accent">Chercher « {trimmed} » sur IGDB</ThemedText>
                      </Pressable>
                    )
                  )}
                </>
              ) : (
                <ThemedText type="small" themeColor="textSecondary" style={styles.hint}>
                  Tape le nom d’un jeu déjà croisé (bibliothèque ou Explorer), ou d’un nouveau à chercher
                  sur IGDB.
                </ThemedText>
              )}

              <Pressable
                onPress={handleClose}
                style={[styles.doneButton, { backgroundColor: theme.accent }]}>
                <ThemedText style={{ color: theme.accentInk }}>Terminé</ThemedText>
              </Pressable>
            </ThemedView>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
  },
  backdropPress: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheet: {
    borderTopLeftRadius: Spacing.four,
    borderTopRightRadius: Spacing.four,
    padding: Spacing.four,
    gap: Spacing.two,
    maxHeight: '80%',
  },
  title: {
    marginBottom: Spacing.one,
  },
  input: {
    borderWidth: 1,
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    fontSize: 16,
  },
  hint: {
    paddingVertical: Spacing.three,
  },
  results: {
    // maxHeight fixe plutôt que flexShrink seul : un ScrollView RN Web sans
    // hauteur/flexGrow explicite peut voir son conteneur de défilement
    // s'effondrer à 0px dès que son contenu est court (ex. un seul
    // résultat) — repéré en mesurant les styles calculés directement dans
    // Chromium (voir le test e2e de ce fichier), pas juste au rendu visuel.
    // Borne la liste plutôt que de laisser la feuille grandir sans limite :
    // une bibliothèque de plusieurs dizaines de jeux peut matcher un terme
    // de recherche très court (ex. "a") — reste scrollable au-delà.
    maxHeight: 320,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.two,
  },
  rowText: {
    flex: 1,
    gap: Spacing.half,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: Spacing.one,
    borderWidth: 1,
  },
  spinner: {
    marginVertical: Spacing.three,
  },
  message: {
    paddingVertical: Spacing.three,
  },
  doneButton: {
    marginTop: Spacing.two,
    borderRadius: 999,
    paddingVertical: Spacing.two,
    alignItems: 'center',
  },
});
