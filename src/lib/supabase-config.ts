// Validation pure de la configuration Supabase, séparée du wrapper client
// (supabase.ts) qui, lui, importe @supabase/supabase-js — cette séparation
// permet de tester la logique "est-ce configuré, et correctement ?" sans
// jamais charger le SDK, même raisonnement que profile.ts/profile-link.ts.
//
// EXPO_PUBLIC_SUPABASE_ANON_KEY n'est PAS un secret malgré son préfixe
// EXPO_PUBLIC_ inhabituel pour une "clé" (comparer IGDB_CLIENT_ID, jamais
// public) : c'est le principe même de Supabase — cette clé n'autorise que
// ce que les policies Row Level Security autorisent (voir ARCHITECTURE.md
// §9.4), elle est conçue pour finir dans un bundle client. La vraie
// protection est RLS, pas le secret de cette clé.
export type SupabaseConfig = {
  url: string;
  anonKey: string;
};

// Une URL de projet Supabase a toujours la forme
// https://<ref>.supabase.co (ou un domaine personnalisé, plus rare) —
// vérifié ici pour échouer clairement à la configuration plutôt que de
// laisser createClient() accepter une chaîne quelconque et échouer bien
// plus tard, au premier appel réseau, avec une erreur qui ne pointe plus
// vers la cause.
function isValidSupabaseUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:' && parsed.hostname.length > 0;
  } catch {
    return false;
  }
}

// Repli explicite sur `null` plutôt qu'une exception : comme
// steamApiUrl()/apiUrl(), l'app doit rester utilisable (mode hors-ligne,
// bibliothèque locale) sans qu'un compte Supabase soit configuré — jamais
// un écran de connexion qui plante faute de variables d'environnement.
export function getSupabaseConfig(): SupabaseConfig | null {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !anonKey) return null;
  if (!isValidSupabaseUrl(url)) return null;
  return { url, anonKey };
}
