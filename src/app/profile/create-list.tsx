import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useGameStore } from '@/lib/game-store';

export const LIST_NAME_MAX_LENGTH = 60;
export const LIST_DESCRIPTION_MAX_LENGTH = 200;

// Création de liste "complète", depuis le menu ⋯ du Profil : nom,
// description et visibilité. Distincte (et volontairement plus riche) que
// la création à la volée du sélecteur de listes de la fiche jeu
// (list-picker-sheet.tsx), qui ne demande qu'un nom parce qu'elle sert à
// ranger un jeu précis sans quitter sa fiche.
export default function CreateListScreen() {
  const store = useGameStore();
  const theme = useTheme();
  const router = useRouter();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [hidden, setHidden] = useState(false);

  // Le nom est la seule donnée obligatoire (une liste sans nom n'est pas
  // identifiable dans le sélecteur de listes) : le bouton reste inactif
  // tant qu'il est vide, plutôt que d'accepter puis d'afficher une erreur.
  const canCreate = name.trim().length > 0;

  function createList() {
    if (!canCreate) return;
    store.createList(name.trim(), {
      description: description.trim() || undefined,
      hidden: hidden || undefined,
    });
    router.back();
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
        <ScrollView contentContainerStyle={styles.content} automaticallyAdjustKeyboardInsets keyboardShouldPersistTaps="handled">
          <View style={styles.field}>
            <ThemedText type="small" themeColor="textSecondary" style={styles.fieldLabel}>
              NOM
            </ThemedText>
            <TextInput
              value={name}
              onChangeText={setName}
              onSubmitEditing={createList}
              placeholder="Nouvelle liste"
              placeholderTextColor={theme.textSecondary}
              maxLength={LIST_NAME_MAX_LENGTH}
              autoFocus
              style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundElement }]}
            />
          </View>

          <View style={styles.field}>
            <ThemedText type="small" themeColor="textSecondary" style={styles.fieldLabel}>
              DESCRIPTION
            </ThemedText>
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="(facultatif)"
              placeholderTextColor={theme.textSecondary}
              multiline
              maxLength={LIST_DESCRIPTION_MAX_LENGTH}
              style={[
                styles.input,
                styles.descriptionInput,
                { color: theme.text, backgroundColor: theme.backgroundElement },
              ]}
            />
          </View>

          <ThemedView type="backgroundElement" style={styles.privacyRow}>
            <Ionicons name="lock-closed-outline" size={18} color={theme.textSecondary} />
            <ThemedText style={styles.privacyLabel}>Ne pas afficher sur le profil</ThemedText>
            <Switch
              value={hidden}
              onValueChange={setHidden}
              trackColor={{ true: theme.accent, false: theme.backgroundSelected }}
              accessibilityLabel="Ne pas afficher sur le profil"
            />
          </ThemedView>
          <ThemedText type="small" themeColor="textSecondary" style={styles.privacyHint}>
            La liste reste utilisable depuis la fiche d’un jeu ; elle n’apparaît simplement pas dans
            les rangées de ton profil.
          </ThemedText>

          <Pressable
            onPress={createList}
            disabled={!canCreate}
            accessibilityRole="button"
            // Étiquette explicite : le titre de l'écran porte déjà le même
            // texte, c'est ce qui permet de désigner le bouton sans
            // ambiguïté (lecteur d'écran comme test E2E).
            accessibilityLabel="Créer la liste"
            style={[
              styles.createButton,
              { backgroundColor: canCreate ? theme.accent : theme.backgroundSelected },
            ]}>
            <ThemedText
              type="smallBold"
              style={{ color: canCreate ? theme.accentInk : theme.textSecondary }}>
              Créer une liste
            </ThemedText>
          </Pressable>
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
    paddingTop: Spacing.four,
    // BottomTabInset : la barre d'onglets est en position absolue au-dessus
    // du contenu sur le web, et le bouton de création est tout en bas.
    paddingBottom: BottomTabInset + Spacing.five,
  },
  field: {
    paddingHorizontal: Spacing.three,
    marginBottom: Spacing.four,
    gap: Spacing.two,
  },
  fieldLabel: {
    letterSpacing: 1,
  },
  input: {
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    fontSize: 16,
  },
  descriptionInput: {
    minHeight: 96,
    textAlignVertical: 'top',
  },
  privacyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    marginHorizontal: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.three,
  },
  // flex: 1 sur le libellé pousse l'interrupteur contre le bord droit, sans
  // justifyContent qui écarterait aussi l'icône du texte.
  privacyLabel: {
    flex: 1,
  },
  privacyHint: {
    paddingHorizontal: Spacing.four,
    marginTop: Spacing.two,
  },
  createButton: {
    marginTop: Spacing.five,
    marginHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    borderRadius: 999,
    alignItems: 'center',
  },
});
