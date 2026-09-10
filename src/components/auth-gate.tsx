import { StyleSheet, View } from 'react-native';

import { SignInScreen } from '@/components/sign-in-screen';
import { useAuth } from '@/lib/auth-store';

// Verrou d'accès aux onglets (Bibliothèque/Explorer/Profil) : la connexion
// est désormais un prérequis, pas une option depuis le Profil (voir
// ARCHITECTURE.md §9.7). Monté en DERNIER parmi les frères de AppTabs
// (`app/_layout.tsx`), donc peint par-dessus (même sans zIndex, l'ordre du
// JSX suffit — le zIndex ci-dessous ne fait que le rendre explicite et
// résistant à un futur réordonnancement).
//
// Recouvre AppTabs plutôt que de le démonter conditionnellement : AppTabs
// (et le routeur qu'il porte) reste ainsi TOUJOURS monté, y compris pendant
// `loading`/`signedOut` — nécessaire pour que le lien profond du lien
// magique (`gamelary://profile/sign-in?code=...`, natif, voir
// app/profile/sign-in.tsx) continue à être résolu par le routeur même à
// froid, avant que l'utilisateur ne soit connecté. Démonter AppTabs à la
// place (ne render que ce composant, sans lui) aurait empêché ce lien
// profond d'atteindre un navigateur monté pour le recevoir.
//
// Statuts : `unconfigured`/`loading`/`signedOut` affichent tous SignInScreen
// (qui gère lui-même la distinction entre les trois, voir son commentaire —
// aucune duplication de cette logique ici) ; seul `signedIn` retire l'écran
// et laisse apparaître AppTabs en dessous. Une déconnexion démontrée depuis
// le Profil (menu "⋯" -> Se déconnecter) fait donc réapparaître cet écran
// immédiatement au prochain rendu, quel que soit l'onglet affiché à ce
// moment-là — pas besoin de forcer un retour à un onglet racine, l'écran de
// connexion recouvre tout indifféremment.
export function AuthGate() {
  const auth = useAuth();

  if (auth.status === 'signedIn') return null;

  return (
    <View style={styles.overlay}>
      <SignInScreen />
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    zIndex: 900,
  },
});
