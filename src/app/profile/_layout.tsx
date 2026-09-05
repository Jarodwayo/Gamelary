import { Stack } from 'expo-router';

// Même pattern que library/_layout.tsx : un Stack propre à l'onglet Profil
// pour pouvoir pousser Statistiques par-dessus, tout en gardant la barre
// d'onglets visible.
export default function ProfileLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="stats" options={{ title: 'Statistiques', headerBackTitle: 'Profil' }} />
    </Stack>
  );
}
