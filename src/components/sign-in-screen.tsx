import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { useAuth } from '@/lib/auth-store';
import { useTheme } from '@/hooks/use-theme';
import { isValidEmail } from '@/lib/email';
import { isValidPassword, MIN_PASSWORD_LENGTH } from '@/lib/password';

// Contenu de l'écran de connexion, extrait de l'ancienne route
// `app/profile/sign-in.tsx` pour être réutilisable SANS routeur : AuthGate
// (`auth-gate.tsx`) le monte directement en dehors de toute navigation, pour
// bloquer l'accès aux onglets tant que `signedIn` n'est pas atteint (voir
// ARCHITECTURE.md §9.7). Ce composant ne dépend que de `useAuth()`/
// `useTheme()` — aucune des deux choses spécifiques à une VRAIE route
// (`useLocalSearchParams` pour le `?code=` du lien magique,
// `router.replace('/profile')` une fois connecté) n'a de sens ici : AuthGate
// démonte simplement ce composant dès que le statut passe à `signedIn`,
// pas besoin de naviguer nulle part. Ces deux bouts restent donc dans
// `app/profile/sign-in.tsx`, qui reste la vraie route (lien profond du lien
// magique sur natif) et se contente de rendre ce composant.
//
// Trois méthodes, toutes visibles dès le premier affichage — aucune cachée
// derrière le Profil (voir ARCHITECTURE.md §9.1) : Google (bouton plein, un
// tap), e-mail + mot de passe (n'importe quel fournisseur, ouvre un second
// temps — voir `step` ci-dessous), et lien magique par e-mail (inchangé
// depuis la session précédente, juste remonté au même niveau que les deux
// autres plutôt que présenté comme un repli sous Google). Pas de vérification
// par téléphone, cohérent avec ARCHITECTURE.md §9.1.
type Step = 'options' | 'password';
type PasswordMode = 'signup' | 'signin';
type Busy = 'google' | 'magiclink' | 'password' | null;
type StatusMessage = { tone: 'error' | 'info'; text: string };

const LOGO_WIDTH = 56;
const LOGO_HEIGHT = 82; // même ratio que gamelary-mark.png (voir splash-overlay.tsx, 72x105).

// `deepLinkError` : seule concession à un appelant routé. La route
// `app/profile/sign-in.tsx` échange elle-même le `?code=` d'un lien magique
// (natif, hors du contrôle de ce composant — voir son commentaire) et n'a
// nulle part d'autre où afficher un échec de cet échange ; plutôt que de
// dupliquer la zone de statut ci-dessous pour ce seul cas, elle est
// transmise ici et fusionnée avec le statut interne du formulaire. Absent
// dans tous les autres cas (AuthGate ne le passe jamais).
export function SignInScreen({ deepLinkError }: { deepLinkError?: string | null } = {}) {
  const auth = useAuth();
  const theme = useTheme();

  const [step, setStep] = useState<Step>('options');
  const [passwordMode, setPasswordMode] = useState<PasswordMode>('signup');

  const [magicLinkEmail, setMagicLinkEmail] = useState('');
  const [magicLinkSent, setMagicLinkSent] = useState(false);

  const [pwEmail, setPwEmail] = useState('');
  const [pwPassword, setPwPassword] = useState('');

  const [busy, setBusy] = useState<Busy>(null);
  const [status, setStatus] = useState<StatusMessage | null>(null);
  const displayedStatus = status ?? (deepLinkError ? { tone: 'error' as const, text: deepLinkError } : null);

  function openPasswordStep(mode: PasswordMode) {
    setStatus(null);
    setPasswordMode(mode);
    setStep('password');
  }

  function backToOptions() {
    setStatus(null);
    setStep('options');
  }

  async function handleGoogle() {
    setBusy('google');
    setStatus(null);
    const { error } = await auth.signInWithGoogle();
    setBusy(null);
    if (error) setStatus({ tone: 'error', text: error });
  }

  async function handleMagicLink() {
    if (!isValidEmail(magicLinkEmail)) return;
    setBusy('magiclink');
    setStatus(null);
    const { error } = await auth.signInWithEmail(magicLinkEmail.trim());
    setBusy(null);
    if (error) {
      setStatus({ tone: 'error', text: error });
      return;
    }
    setMagicLinkSent(true);
    setStatus({ tone: 'info', text: `Lien de connexion envoyé à ${magicLinkEmail.trim()}. Ouvre-le depuis cet appareil.` });
  }

  const canSubmitPassword = isValidEmail(pwEmail) && isValidPassword(pwPassword) && busy === null;

  // Ni signUpWithPassword ni signInWithPassword ne redirigent nulle part au
  // succès (voir leur commentaire, auth-store.tsx) : onAuthStateChange fait
  // passer `auth.status` à 'signedIn', et AuthGate démonte ce composant tout
  // seul — exactement comme Google et le lien magique, aucune des trois
  // méthodes ne gère elle-même la suite d'une connexion réussie.
  async function handlePasswordSubmit() {
    if (!canSubmitPassword) return;
    setBusy('password');
    setStatus(null);
    const { error } =
      passwordMode === 'signup'
        ? await auth.signUpWithPassword(pwEmail.trim(), pwPassword)
        : await auth.signInWithPassword(pwEmail.trim(), pwPassword);
    setBusy(null);
    if (error) setStatus({ tone: 'error', text: error });
  }

  if (auth.status === 'unconfigured') {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
          <View style={styles.centered}>
            <Ionicons name="cloud-offline-outline" size={32} color={theme.textSecondary} />
            <ThemedText themeColor="textSecondary" style={styles.centeredText}>
              La connexion en ligne n’est pas configurée pour cette build. Impossible d’accéder à
              la bibliothèque tant qu’aucun compte Supabase n’est renseigné.
            </ThemedText>
          </View>
        </SafeAreaView>
      </ThemedView>
    );
  }

  // 'loading' et 'signedIn' (le temps qu'AuthGate démonte ce composant)
  // partagent le même indicateur : aucun des deux n'a de formulaire à
  // montrer.
  if (auth.status === 'loading' || auth.status === 'signedIn') {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
          <View style={styles.centered}>
            <ActivityIndicator color={theme.accent} />
          </View>
        </SafeAreaView>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
        <ScrollView contentContainerStyle={styles.content} automaticallyAdjustKeyboardInsets keyboardShouldPersistTaps="handled">
          <View style={styles.logoRow}>
            {/* Fond accent derrière la marque : gamelary-mark.png a son
                propre fond quasi blanc (voir splash-overlay.tsx, posé sur
                l'accent plein du splash natif) — sans lui, ce fond se
                confond avec le `background` clair du thème et rend le logo
                pratiquement invisible en clair (vérifié à l'écran, pas
                supposé). */}
            <View style={[styles.logoBadge, { backgroundColor: theme.accent }]}>
              <Image style={styles.logo} source={require('@/assets/images/gamelary-mark.png')} />
            </View>
          </View>

          {step === 'options' ? (
            <>
              <ThemedText themeColor="textSecondary" style={styles.intro}>
                Connecte-toi pour sauvegarder ta bibliothèque en ligne et la retrouver sur un autre
                appareil.
              </ThemedText>

              <Pressable
                onPress={handleGoogle}
                disabled={busy !== null}
                accessibilityRole="button"
                accessibilityLabel="Continuer avec Google"
                style={[styles.pillButton, { backgroundColor: theme.accent, opacity: busy && busy !== 'google' ? 0.5 : 1 }]}>
                {busy === 'google' ? (
                  <ActivityIndicator color={theme.accentInk} />
                ) : (
                  <Ionicons name="logo-google" size={18} color={theme.accentInk} />
                )}
                <ThemedText type="smallBold" style={{ color: theme.accentInk }}>
                  Continuer avec Google
                </ThemedText>
              </Pressable>

              <Pressable
                onPress={() => openPasswordStep('signup')}
                disabled={busy !== null}
                accessibilityRole="button"
                accessibilityLabel="Créer un compte avec e-mail et mot de passe"
                style={[styles.pillButtonOutline, { borderColor: theme.accent, opacity: busy !== null ? 0.5 : 1 }]}>
                <Ionicons name="mail-outline" size={18} color={theme.accent} />
                <ThemedText type="smallBold" themeColor="accent">
                  Créer un compte avec e-mail
                </ThemedText>
              </Pressable>

              <View style={styles.magicLinkSection}>
                <ThemedText type="small" themeColor="textSecondary" style={styles.fieldLabel}>
                  LIEN MAGIQUE PAR E-MAIL
                </ThemedText>
                <TextInput
                  value={magicLinkEmail}
                  onChangeText={(value) => {
                    setMagicLinkEmail(value);
                    setMagicLinkSent(false);
                  }}
                  onSubmitEditing={handleMagicLink}
                  placeholder="toi@exemple.com"
                  placeholderTextColor={theme.textSecondary}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  textContentType="emailAddress"
                  editable={busy === null}
                  style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundElement }]}
                />
                <Pressable
                  onPress={handleMagicLink}
                  disabled={!isValidEmail(magicLinkEmail) || busy !== null}
                  accessibilityRole="button"
                  accessibilityLabel="Envoyer le lien de connexion"
                  style={[
                    styles.pillButtonOutline,
                    { borderColor: isValidEmail(magicLinkEmail) && busy === null ? theme.accent : theme.backgroundSelected },
                  ]}>
                  {busy === 'magiclink' ? (
                    <ActivityIndicator color={theme.accent} />
                  ) : (
                    <ThemedText
                      type="smallBold"
                      themeColor={isValidEmail(magicLinkEmail) && busy === null ? 'accent' : 'textSecondary'}>
                      {magicLinkSent ? 'Renvoyer le lien de connexion' : 'Recevoir un lien de connexion par e-mail'}
                    </ThemedText>
                  )}
                </Pressable>
              </View>
            </>
          ) : (
            <>
              <Pressable
                onPress={backToOptions}
                disabled={busy !== null}
                accessibilityRole="button"
                accessibilityLabel="Retour"
                style={[styles.backRow, { opacity: busy !== null ? 0.5 : 1 }]}>
                <Ionicons name="arrow-back" size={18} color={theme.textSecondary} />
                <ThemedText themeColor="textSecondary">Retour</ThemedText>
              </Pressable>

              <ThemedText type="subtitle" style={styles.stepTitle}>
                {passwordMode === 'signup' ? 'Créer un compte' : 'Se connecter'}
              </ThemedText>

              <View style={styles.field}>
                <ThemedText type="small" themeColor="textSecondary" style={styles.fieldLabel}>
                  E-MAIL
                </ThemedText>
                <TextInput
                  value={pwEmail}
                  onChangeText={setPwEmail}
                  placeholder="toi@exemple.com"
                  placeholderTextColor={theme.textSecondary}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  textContentType="emailAddress"
                  editable={busy === null}
                  style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundElement }]}
                />
              </View>

              <View style={styles.field}>
                <ThemedText type="small" themeColor="textSecondary" style={styles.fieldLabel}>
                  MOT DE PASSE
                </ThemedText>
                <TextInput
                  value={pwPassword}
                  onChangeText={setPwPassword}
                  onSubmitEditing={handlePasswordSubmit}
                  placeholder={`${MIN_PASSWORD_LENGTH} caractères minimum`}
                  placeholderTextColor={theme.textSecondary}
                  autoCapitalize="none"
                  autoCorrect={false}
                  secureTextEntry
                  textContentType={passwordMode === 'signup' ? 'newPassword' : 'password'}
                  editable={busy === null}
                  style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundElement }]}
                />
                {/* Toujours affiché (pas seulement en cas d'erreur) : explique
                    pourquoi le bouton reste désactivé plutôt que de laisser
                    deviner, sans attendre un aller-retour réseau pour
                    l'apprendre (voir isValidPassword, password.ts). */}
                <ThemedText type="small" themeColor="textSecondary">
                  Au moins {MIN_PASSWORD_LENGTH} caractères.
                </ThemedText>
              </View>

              <Pressable
                onPress={handlePasswordSubmit}
                disabled={!canSubmitPassword}
                accessibilityRole="button"
                accessibilityLabel={passwordMode === 'signup' ? 'Créer un compte' : 'Se connecter'}
                style={[styles.pillButton, { backgroundColor: canSubmitPassword ? theme.accent : theme.backgroundSelected }]}>
                {busy === 'password' ? (
                  <ActivityIndicator color={theme.accentInk} />
                ) : (
                  <ThemedText type="smallBold" style={{ color: canSubmitPassword ? theme.accentInk : theme.textSecondary }}>
                    {passwordMode === 'signup' ? 'Créer un compte' : 'Se connecter'}
                  </ThemedText>
                )}
              </Pressable>

              <Pressable
                onPress={() => {
                  setStatus(null);
                  setPasswordMode(passwordMode === 'signup' ? 'signin' : 'signup');
                }}
                disabled={busy !== null}
                accessibilityRole="button"
                accessibilityLabel={passwordMode === 'signup' ? 'Déjà un compte ? Se connecter' : 'Pas de compte ? Créer un compte'}
                style={styles.toggleRow}>
                <ThemedText type="small" themeColor="accent">
                  {passwordMode === 'signup' ? 'Déjà un compte ? Se connecter' : 'Pas de compte ? Créer un compte'}
                </ThemedText>
              </Pressable>
            </>
          )}

          {displayedStatus ? (
            <ThemedText
              themeColor={displayedStatus.tone === 'error' ? 'danger' : 'textSecondary'}
              style={styles.statusText}>
              {displayedStatus.text}
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
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.five,
  },
  centeredText: {
    textAlign: 'center',
  },
  content: {
    paddingTop: Spacing.five,
    paddingHorizontal: Spacing.three,
    paddingBottom: BottomTabInset + Spacing.five,
  },
  logoRow: {
    alignItems: 'center',
    marginBottom: Spacing.five,
  },
  logoBadge: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Spacing.four,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
  },
  logo: {
    width: LOGO_WIDTH,
    height: LOGO_HEIGHT,
  },
  intro: {
    marginBottom: Spacing.five,
    textAlign: 'center',
  },
  pillButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.three,
    borderRadius: 999,
    marginBottom: Spacing.three,
  },
  pillButtonOutline: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.three,
    borderRadius: 999,
    borderWidth: 1,
    marginBottom: Spacing.three,
  },
  magicLinkSection: {
    marginTop: Spacing.two,
    gap: Spacing.two,
  },
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    marginBottom: Spacing.four,
  },
  stepTitle: {
    marginBottom: Spacing.four,
    textAlign: 'center',
  },
  field: {
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
  toggleRow: {
    alignItems: 'center',
    marginTop: Spacing.two,
  },
  statusText: {
    marginTop: Spacing.four,
    textAlign: 'center',
  },
});
