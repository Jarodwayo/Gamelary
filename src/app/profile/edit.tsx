import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ProfileAvatarLarge } from '@/components/profile-avatar';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useGameStore } from '@/lib/game-store';
import {
  BIO_MAX_LENGTH,
  DISPLAY_NAME_MAX_LENGTH,
  USERNAME_MAX_LENGTH,
  displayNameOf,
  isValidUsername,
  normalizeUsername,
  usernameOf,
} from '@/lib/profile';
import { pickProfileImage, type ProfileImageKind } from '@/lib/profile-image';

// Libellé de section en capitales au-dessus de chaque champ (même motif que
// les écrans de réglages de l'app de référence) : plus lisible qu'un
// placeholder seul, qui disparaît dès que l'utilisateur tape.
function FieldLabel({ children }: { children: string }) {
  return (
    <ThemedText type="small" themeColor="textSecondary" style={styles.fieldLabel}>
      {children}
    </ThemedText>
  );
}

export default function EditProfileScreen() {
  const store = useGameStore();
  const theme = useTheme();
  const router = useRouter();
  const profile = store.settings.profile;

  // Brouillon local : rien n'est écrit dans le store tant que l'utilisateur
  // n'enregistre pas, pour qu'un retour en arrière laisse le profil intact.
  // Les images font exception (voir chooseImage) — elles sont appliquées
  // dès le choix, faute de quoi il faudrait garder un aperçu séparé du
  // store pour chacune.
  const [displayName, setDisplayName] = useState(displayNameOf(profile));
  const [username, setUsername] = useState(usernameOf(profile));
  const [bio, setBio] = useState(profile?.bio ?? '');
  const [usernameError, setUsernameError] = useState<string | null>(null);

  async function chooseImage(kind: ProfileImageKind) {
    const uri = await pickProfileImage(kind);
    if (!uri) return;
    store.updateProfile(kind === 'avatar' ? { avatarUri: uri } : { backgroundUri: uri });
  }

  function removeImage(kind: ProfileImageKind) {
    store.updateProfile(kind === 'avatar' ? { avatarUri: undefined } : { backgroundUri: undefined });
  }

  function save() {
    const normalized = normalizeUsername(username);
    if (!isValidUsername(normalized)) {
      setUsernameError(
        `L'identifiant doit faire au moins 3 caractères, en lettres, chiffres ou "_" (max ${USERNAME_MAX_LENGTH}).`
      );
      return;
    }
    store.updateProfile({
      displayName: displayName.trim() || undefined,
      username: normalized,
      bio: bio.trim() || undefined,
    });
    router.back();
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
        <ScrollView contentContainerStyle={styles.content} automaticallyAdjustKeyboardInsets keyboardShouldPersistTaps="handled">
          {/* Les deux images se choisissent séparément : l'arrière-plan
              s'édite depuis la bannière elle-même, la photo depuis l'avatar
              posé dessus — comme elles apparaissent sur le profil (voir
              profile/index.tsx), plutôt que via deux lignes de formulaire
              qui ne montreraient pas le résultat. */}
          <Pressable onPress={() => chooseImage('background')} style={styles.banner}>
            {profile?.backgroundUri ? (
              <Image source={{ uri: profile.backgroundUri }} style={StyleSheet.absoluteFill} contentFit="cover" />
            ) : (
              <View style={[StyleSheet.absoluteFill, { backgroundColor: theme.backgroundElement }]} />
            )}
            <View style={styles.bannerAction}>
              <Ionicons name="image-outline" size={18} color="#F5F1EC" />
              <ThemedText type="small" style={styles.bannerActionText}>
                {profile?.backgroundUri ? "Changer l'arrière-plan" : 'Ajouter un arrière-plan'}
              </ThemedText>
            </View>
          </Pressable>

          <View style={styles.avatarRow}>
            <Pressable onPress={() => chooseImage('avatar')} accessibilityLabel="Changer la photo de profil">
              <ProfileAvatarLarge uri={profile?.avatarUri} name={displayNameOf(profile)} />
              <View style={[styles.avatarBadge, { backgroundColor: theme.accent, borderColor: theme.background }]}>
                <Ionicons name="camera-outline" size={16} color={theme.accentInk} />
              </View>
            </Pressable>
          </View>

          <View style={styles.imageActions}>
            {profile?.avatarUri ? (
              <Pressable onPress={() => removeImage('avatar')} hitSlop={8}>
                <ThemedText type="small" themeColor="textSecondary">
                  Retirer la photo
                </ThemedText>
              </Pressable>
            ) : null}
            {profile?.backgroundUri ? (
              <Pressable onPress={() => removeImage('background')} hitSlop={8}>
                <ThemedText type="small" themeColor="textSecondary">
                  Retirer l’arrière-plan
                </ThemedText>
              </Pressable>
            ) : null}
          </View>

          <View style={styles.field}>
            <FieldLabel>NOM</FieldLabel>
            <TextInput
              value={displayName}
              onChangeText={setDisplayName}
              placeholder="Ton nom"
              placeholderTextColor={theme.textSecondary}
              maxLength={DISPLAY_NAME_MAX_LENGTH}
              style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundElement }]}
            />
          </View>

          <View style={styles.field}>
            <FieldLabel>IDENTIFIANT</FieldLabel>
            <View style={[styles.usernameRow, { backgroundColor: theme.backgroundElement }]}>
              <ThemedText themeColor="textSecondary">@</ThemedText>
              <TextInput
                value={username}
                // Normalisé à la frappe plutôt qu'au seul enregistrement :
                // l'utilisateur voit tout de suite ce que devient sa saisie
                // (minuscules, sans espace ni accent) au lieu de découvrir
                // une correction après coup.
                onChangeText={(text) => {
                  setUsername(normalizeUsername(text));
                  setUsernameError(null);
                }}
                placeholder="identifiant"
                placeholderTextColor={theme.textSecondary}
                autoCapitalize="none"
                autoCorrect={false}
                maxLength={USERNAME_MAX_LENGTH}
                style={[styles.usernameInput, { color: theme.text }]}
              />
            </View>
            {usernameError ? (
              <ThemedText type="small" themeColor="danger">
                {usernameError}
              </ThemedText>
            ) : (
              <ThemedText type="small" themeColor="textSecondary">
                Utilisé dans le lien de ton profil.
              </ThemedText>
            )}
          </View>

          <View style={styles.field}>
            <FieldLabel>BIO</FieldLabel>
            <TextInput
              value={bio}
              onChangeText={setBio}
              placeholder="(facultatif)"
              placeholderTextColor={theme.textSecondary}
              multiline
              maxLength={BIO_MAX_LENGTH}
              style={[styles.input, styles.bioInput, { color: theme.text, backgroundColor: theme.backgroundElement }]}
            />
            <ThemedText type="small" themeColor="textSecondary" style={styles.counter}>
              {bio.length}/{BIO_MAX_LENGTH}
            </ThemedText>
          </View>

          <Pressable onPress={save} style={[styles.saveButton, { backgroundColor: theme.accent }]}>
            <ThemedText type="smallBold" style={{ color: theme.accentInk }}>
              Enregistrer
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
    paddingBottom: Spacing.five,
  },
  banner: {
    height: 130,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: 999,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
  // Texte clair fixe : posé sur la pastille sombre, donc sur une photo
  // arbitraire — même raisonnement que HEADER_CHIP_ICON côté profil.
  bannerActionText: {
    color: '#F5F1EC',
  },
  avatarRow: {
    alignItems: 'center',
    marginTop: -Spacing.five,
  },
  avatarBadge: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 30,
    height: 30,
    borderRadius: 999,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.four,
    marginTop: Spacing.two,
  },
  field: {
    paddingHorizontal: Spacing.three,
    marginTop: Spacing.four,
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
  bioInput: {
    minHeight: 96,
    textAlignVertical: 'top',
  },
  usernameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.three,
  },
  usernameInput: {
    flex: 1,
    paddingVertical: Spacing.three,
    fontSize: 16,
  },
  counter: {
    textAlign: 'right',
  },
  saveButton: {
    marginTop: Spacing.five,
    marginHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    borderRadius: 999,
    alignItems: 'center',
  },
});
