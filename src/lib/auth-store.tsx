import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Platform } from 'react-native';
import type { Session } from '@supabase/supabase-js';

import { authRedirectUrl } from '@/lib/auth-redirect';
import { getSupabaseClient } from '@/lib/supabase';

// 'unconfigured' est distinct de 'signedOut' : le premier veut dire "cette
// build n'a pas de clés Supabase" (voir supabase-config.ts) — rien à
// proposer, pas même un bouton "Se connecter" qui ne mènerait nulle part.
// Le second veut dire "configuré, mais personne n'est connecté" — c'est là
// qu'un bouton a du sens. Les confondre afficherait un flux de connexion
// cassé sur une build de développement sans clés, ou masquerait un vrai
// problème de configuration derrière un innocent "pas connecté".
export type AuthStatus = 'unconfigured' | 'loading' | 'signedOut' | 'signedIn';

type AuthContextValue = {
  status: AuthStatus;
  session: Session | null;
  signInWithGoogle: () => Promise<{ error: string | null }>;
  signInWithEmail: (email: string) => Promise<{ error: string | null }>;
  // Appelé par l'écran de connexion quand il atterrit avec un `?code=` dans
  // ses paramètres (retour d'un lien magique cliqué depuis l'app Mail,
  // jamais ouvert par notre propre code — donc jamais vu par
  // signInWithGoogle, qui gère lui-même son propre retour de navigateur).
  completeSignInFromCode: (code: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

// Message générique volontairement identique dans les trois actions : la
// seule cause possible d'un client absent est une build sans clés
// EXPO_PUBLIC_SUPABASE_*, jamais une erreur réseau (voir supabase.ts) — pas
// besoin de trois messages différents pour la même situation.
const NOT_CONFIGURED_ERROR = 'La connexion en ligne n’est pas configurée pour cette build.';

// Séparé de game-store.tsx à dessein plutôt qu'ajouté à ses réglages :
// l'identité Supabase (session, tokens) est déjà gérée et persistée par
// supabase-js lui-même (voir supabase.ts) — la dupliquer dans le blob
// AsyncStorage du store créerait deux sources de vérité pour la même
// donnée, avec le risque de désynchronisation que ça implique. Le store
// local reste focalisé sur la bibliothèque de jeux, comme avant cette
// session ; ce Provider est un frère de GameStoreProvider, pas un ajout à
// l'intérieur (voir app/_layout.tsx).
export function AuthProvider({ children }: { children: ReactNode }) {
  const client = useMemo(() => getSupabaseClient(), []);
  const [status, setStatus] = useState<AuthStatus>(client ? 'loading' : 'unconfigured');
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    if (!client) return;
    let cancelled = false;

    client.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      setSession(data.session);
      setStatus(data.session ? 'signedIn' : 'signedOut');
    });

    // Couvre aussi bien le rafraîchissement automatique de token que
    // l'échange de code déclenché plus bas (signInWithGoogle,
    // completeSignInFromCode) : un seul endroit qui fait passer
    // status/session à jour, plutôt que de dupliquer cette mise à jour à
    // chaque endroit qui peut faire varier la session.
    const { data: subscription } = client.auth.onAuthStateChange((_event, newSession) => {
      if (cancelled) return;
      setSession(newSession);
      setStatus(newSession ? 'signedIn' : 'signedOut');
    });

    return () => {
      cancelled = true;
      subscription.subscription.unsubscribe();
    };
  }, [client]);

  async function signInWithGoogle(): Promise<{ error: string | null }> {
    if (!client) return { error: NOT_CONFIGURED_ERROR };
    const redirectTo = authRedirectUrl();

    // Web : signInWithOAuth fait naviguer la page elle-même vers Google
    // (détecté en interne par supabase-js via la présence de `window`) —
    // rien d'autre à faire ici, la session s'établira au retour via
    // detectSessionInUrl (voir supabase.ts).
    if (Platform.OS === 'web') {
      const { error } = await client.auth.signInWithOAuth({ provider: 'google', options: { redirectTo } });
      return { error: error?.message ?? null };
    }

    // Natif : pas de fenêtre à rediriger, on ouvre nous-mêmes un navigateur
    // in-app (skipBrowserRedirect) et on attend qu'il revienne sur notre
    // lien profond — openAuthSessionAsync gère l'ouverture ET la détection
    // du retour en un seul appel, pas besoin d'écouteur Linking séparé pour
    // CE flux (à la différence du lien magique par e-mail, voir
    // completeSignInFromCode : celui-là est ouvert depuis l'app Mail, hors
    // de notre contrôle, donc pas capturable par openAuthSessionAsync).
    const { data, error } = await client.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo, skipBrowserRedirect: true },
    });
    if (error || !data.url) return { error: error?.message ?? 'Impossible de démarrer la connexion Google.' };

    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
    // 'cancel'/'dismiss' : l'utilisateur a fermé le navigateur de lui-même —
    // pas une erreur à afficher, juste rien de plus à faire.
    if (result.type !== 'success' || !result.url) return { error: null };

    const code = Linking.parse(result.url).queryParams?.code;
    if (typeof code !== 'string') {
      return { error: 'Connexion Google interrompue : code manquant dans la réponse.' };
    }
    const { error: exchangeError } = await client.auth.exchangeCodeForSession(code);
    return { error: exchangeError?.message ?? null };
  }

  async function signInWithEmail(email: string): Promise<{ error: string | null }> {
    if (!client) return { error: NOT_CONFIGURED_ERROR };
    const { error } = await client.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: authRedirectUrl() },
    });
    return { error: error?.message ?? null };
  }

  async function completeSignInFromCode(code: string): Promise<{ error: string | null }> {
    if (!client) return { error: null };
    const { error } = await client.auth.exchangeCodeForSession(code);
    return { error: error?.message ?? null };
  }

  async function signOut(): Promise<void> {
    if (!client) return;
    await client.auth.signOut();
  }

  const value: AuthContextValue = {
    status,
    session,
    signInWithGoogle,
    signInWithEmail,
    completeSignInFromCode,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth doit être utilisé sous AuthProvider');
  return ctx;
}
