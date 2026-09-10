import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

import { SignInScreen } from '@/components/sign-in-screen';
import { useAuth } from '@/lib/auth-store';

// Route encore utile pour deux choses spécifiques au routeur, gardées ici
// plutôt que dans SignInScreen (voir son commentaire) : consommer le
// `?code=` d'un lien magique ouvert depuis l'app Mail (un vrai lien profond
// natif, hors du contrôle d'AuthGate), et rediriger vers le Profil une fois
// connecté si cette route est atteinte directement (lien profond tapé pour
// la seconde fois, session déjà valide). Le formulaire lui-même est rendu
// par SignInScreen, partagé avec AuthGate (`components/auth-gate.tsx`) qui
// bloque désormais l'accès aux onglets tant que `signedIn` n'est pas
// atteint (voir ARCHITECTURE.md §9.7) — cette route reste donc surtout un
// point d'entrée pour le lien profond, plus la seule façon d'atteindre
// l'écran de connexion comme avant.
export default function SignInRoute() {
  const auth = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams<{ code?: string }>();
  const [deepLinkError, setDeepLinkError] = useState<string | null>(null);

  // Retour d'un lien magique cliqué depuis l'app Mail (un deep link ouvert
  // par l'OS, jamais par notre propre code — donc jamais vu par
  // signInWithGoogle, qui gère lui-même son propre retour de navigateur).
  // Web exclu : detectSessionInUrl (voir supabase.ts) y a déjà consommé ce
  // `code` avant que cet effet ne s'exécute ; retenter l'échange d'un code
  // à usage unique produirait une erreur sans rapport avec un vrai problème.
  useEffect(() => {
    if (Platform.OS === 'web') return;
    if (typeof params.code !== 'string') return;
    auth.completeSignInFromCode(params.code).then(({ error }) => {
      if (error) setDeepLinkError(error);
    });
    // N'écoute que params.code : auth.completeSignInFromCode est stable
    // (définie une fois par rendu du Provider, jamais recréée pour changer
    // de comportement) — la lister forcerait un rejeu inutile de cet effet
    // à chaque re-rendu du Provider.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.code]);

  // Une fois connecté (Google terminé, ou lien magique échangé ci-dessus),
  // rien à faire ici : retour direct au Profil plutôt que de laisser cette
  // route affichée à quelqu'un déjà connecté.
  useEffect(() => {
    if (auth.status === 'signedIn') router.replace('/profile');
  }, [auth.status, router]);

  return <SignInScreen deepLinkError={deepLinkError} />;
}
