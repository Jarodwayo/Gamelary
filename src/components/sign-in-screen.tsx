import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { useAuth } from '@/lib/auth-store';
import { useTheme } from '@/hooks/use-theme';
import { isValidEmail } from '@/lib/email';

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
// Google OAuth (un tap, pas d'aller-retour e-mail) mis en avant en bouton
// plein, lien magique par e-mail en repli — même hiérarchie que la plupart
// des apps (le SSO d'abord, l'e-mail pour qui n'a pas de compte Google ou
// préfère l'éviter). Pas de mot de passe : ni Google ni le lien magique n'en
// demandent, cohérent avec la décision prise en ARCHITECTURE.md §9.1 (pas de
// vérification par téléphone non plus).
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

  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState<'google' | 'email' | null>(null);
  const [status, setStatus] = useState<{ tone: 'error' | 'info'; text: string } | null>(null);
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const displayedStatus = status ?? (deepLinkError ? { tone: 'error' as const, text: deepLinkError } : null);

  async function handleGoogle() {
    setBusy('google');
    setStatus(null);
    const { error } = await auth.signInWithGoogle();
    setBusy(null);
    if (error) setStatus({ tone: 'error', text: error });
  }

  async function handleEmail() {
    if (!isValidEmail(email)) return;
    setBusy('email');
    setStatus(null);
    const { error } = await auth.signInWithEmail(email.trim());
    setBusy(null);
    if (error) {
      setStatus({ tone: 'error', text: error });
      return;
    }
    setMagicLinkSent(true);
    setStatus({ tone: 'info', text: `Lien de connexion envoyé à ${email.trim()}. Ouvre-le depuis cet appareil.` });
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

  const canSendMagicLink = isValidEmail(email) && busy === null;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
        <ScrollView contentContainerStyle={styles.content} automaticallyAdjustKeyboardInsets keyboardShouldPersistTaps="handled">
          <ThemedText themeColor="textSecondary" style={styles.intro}>
            Connecte-toi pour sauvegarder ta bibliothèque en ligne et la retrouver sur un autre
            appareil.
          </ThemedText>

          <Pressable
            onPress={handleGoogle}
            disabled={busy !== null}
            accessibilityRole="button"
            accessibilityLabel="Continuer avec Google"
            style={[styles.googleButton, { backgroundColor: theme.accent, opacity: busy && busy !== 'google' ? 0.5 : 1 }]}>
            {busy === 'google' ? (
              <ActivityIndicator color={theme.accentInk} />
            ) : (
              <Ionicons name="logo-google" size={18} color={theme.accentInk} />
            )}
            <ThemedText type="smallBold" style={{ color: theme.accentInk }}>
              Continuer avec Google
            </ThemedText>
          </Pressable>

          <View style={styles.dividerRow}>
            <View style={[styles.dividerLine, { backgroundColor: theme.backgroundSelected }]} />
            <ThemedText type="small" themeColor="textSecondary">
              ou
            </ThemedText>
            <View style={[styles.dividerLine, { backgroundColor: theme.backgroundSelected }]} />
          </View>

          <View style={styles.field}>
            <ThemedText type="small" themeColor="textSecondary" style={styles.fieldLabel}>
              E-MAIL
            </ThemedText>
            <TextInput
              value={email}
              onChangeText={(value) => {
                setEmail(value);
                setMagicLinkSent(false);
              }}
              onSubmitEditing={handleEmail}
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

          <Pressable
            onPress={handleEmail}
            disabled={!canSendMagicLink}
            accessibilityRole="button"
            accessibilityLabel="Envoyer le lien de connexion"
            style={[
              styles.emailButton,
              { borderColor: canSendMagicLink ? theme.accent : theme.backgroundSelected },
            ]}>
            {busy === 'email' ? (
              <ActivityIndicator color={theme.accent} />
            ) : (
              <ThemedText type="smallBold" themeColor={canSendMagicLink ? 'accent' : 'textSecondary'}>
                {magicLinkSent ? 'Renvoyer le lien de connexion' : 'Envoyer le lien de connexion'}
              </ThemedText>
            )}
          </Pressable>

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
  intro: {
    marginBottom: Spacing.five,
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.three,
    borderRadius: 999,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    marginVertical: Spacing.five,
  },
  dividerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
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
  emailButton: {
    borderWidth: 1,
    paddingVertical: Spacing.three,
    borderRadius: 999,
    alignItems: 'center',
  },
  statusText: {
    marginTop: Spacing.four,
    textAlign: 'center',
  },
});
