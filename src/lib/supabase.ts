import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

import { getSupabaseConfig } from '@/lib/supabase-config';

// Mémoïsé plutôt que recréé à chaque appel : deux instances de client sur
// la même configuration géreraient chacune leur propre rafraîchissement de
// session en parallèle (deux GoTrueClient distincts lisant/écrivant la même
// clé AsyncStorage), avec un vrai risque de course sur le refresh token.
// `undefined` ("jamais calculé") est distinct de `null` ("calculé, non
// configuré") : sans cette distinction, un environnement non configuré
// relancerait getSupabaseConfig() à chaque appel au lieu de rester figé.
let cachedClient: SupabaseClient | null | undefined;

// AsyncStorage (déjà une dépendance, déjà utilisée pour game-store.tsx) sert
// aussi de stockage de session ici — sous une clé propre à Supabase
// (`sb-<ref>-auth-token`), donc aucune collision avec
// `gamelary/game-store/v5`. Supabase recommande plutôt expo-secure-store
// pour les tokens sensibles ; ajouter cette dépendance native uniquement
// pour ce gain n'a pas semblé justifié pour cette première session — c'est
// le même compromis que fait le guide officiel Supabase + Expo par défaut,
// documenté comme point ouvert (voir ARCHITECTURE.md §9.6).
//
// flowType 'pkce' : nécessaire pour le retour par lien profond (OAuth et
// lien magique renvoient un `?code=`, jamais un fragment `#access_token`
// exposé dans l'URL) — voir src/app/profile/sign-in.tsx pour l'échange du
// code contre une session.
//
// detectSessionInUrl uniquement sur web : c'est le SEUL champ qui diffère
// entre plateformes. Sur web, supabase-js lit et consomme lui-même le
// `?code=` de l'URL courante au chargement ; sur natif, il n'y a pas d'URL
// de page à lire, l'échange est fait à la main (sign-in.tsx) depuis le lien
// profond reçu.
// `web.output: "server"` (app.json) veut dire que CE MODULE s'exécute aussi
// côté serveur Node pour le rendu initial de chaque page — pas seulement
// dans un vrai navigateur. Vérifié en conditions réelles (`expo start
// --web`, pas seulement supposé) : construire un client dans ce contexte
// fait planter tout le processus, pas juste cet écran. GoTrueClient lit une
// session en arrière-plan dès sa construction (_emitInitialSession, jamais
// attendu par l'appelant), ce qui déclenche AsyncStorage → `window
// .localStorage` → `ReferenceError: window is not defined`, non intercepté,
// qui fait tomber le serveur entier — sur N'IMPORTE QUELLE page, puisque
// AuthProvider enveloppe toute l'app (voir app/_layout.tsx). Repli sur
// `null` dans ce cas précis (web, SSR, pas de window) : la page se rend
// sans session, l'hydratation côté navigateur recrée un client normalement
// dans le contexte suivant, qui lui a un vrai `window`. Natif exclu de ce
// garde-fou : il n'a jamais de `window`, mais ce n'est jamais un problème
// là-bas (AsyncStorage y utilise le vrai module natif, pas localStorage).
function isServerSideRenderPass(): boolean {
  return Platform.OS === 'web' && typeof window === 'undefined';
}

export function getSupabaseClient(): SupabaseClient | null {
  if (cachedClient !== undefined) return cachedClient;
  if (isServerSideRenderPass()) return null;

  const config = getSupabaseConfig();
  if (!config) {
    cachedClient = null;
    return null;
  }

  cachedClient = createClient(config.url, config.anonKey, {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: Platform.OS === 'web',
      flowType: 'pkce',
    },
  });
  return cachedClient;
}
