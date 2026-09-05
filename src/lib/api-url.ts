import Constants from 'expo-constants';
import { Platform } from 'react-native';

// Sur web, fetch('/api/...') se résout naturellement contre window.location :
// pas besoin d'URL absolue. Sur natif, il n'y a pas de "page courante" donc
// il faut construire l'URL nous-mêmes :
// - en dev, hostUri donne l'adresse du serveur Metro (celui qui sert aussi
//   nos routes API) ;
// - en production, il n'y a plus de serveur Metro : il faudra pointer vers
//   l'API réellement déployée via EXPO_PUBLIC_API_URL (EXPO_PUBLIC_* est le
//   seul type de variable sûr à embarquer côté client — ce n'est que l'URL
//   du serveur, pas un secret).
function resolveApiBaseUrl(): string {
  if (Platform.OS === 'web') return '';

  const hostUri = Constants.expoConfig?.hostUri;
  if (hostUri) return `http://${hostUri}`;

  const deployedApiUrl = process.env.EXPO_PUBLIC_API_URL;
  if (deployedApiUrl) return deployedApiUrl;

  throw new Error(
    'Impossible de déterminer l\'URL de l\'API (ni hostUri de dev, ni EXPO_PUBLIC_API_URL en prod).'
  );
}

export function apiUrl(path: string): string {
  return `${resolveApiBaseUrl()}${path}`;
}
