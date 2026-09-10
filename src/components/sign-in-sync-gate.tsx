import { useSignInSync } from '@/hooks/use-sign-in-sync';

// Composant sans rendu, seul point de montage de useSignInSync (voir ce
// fichier) : le hook a besoin de useAuth() ET useGameStore(), donc d'être
// monté SOUS les deux providers — alors que TabLayout (_layout.tsx), lui,
// est monté AU-DESSUS des deux (c'est lui qui les ouvre). L'appeler
// directement dans TabLayout lèverait donc l'erreur "doit être utilisé
// sous AuthProvider"/"...sous GameStoreProvider".
export function SignInSyncGate() {
  useSignInSync();
  return null;
}
