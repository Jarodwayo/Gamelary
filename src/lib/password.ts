// Supabase impose un minimum de 6 caractères par défaut (Authentication >
// Providers > Email > "Minimum password length") — repris ici pour un
// retour immédiat plutôt que d'attendre une erreur réseau pour l'apprendre,
// même raisonnement que isValidEmail (email.ts). Si ce minimum est changé
// côté dashboard Supabase, ce n'est qu'un garde-fou côté client : Supabase
// reste le seul juge final, son message d'erreur remonte tel quel si ce
// garde-fou est plus permissif que le réglage réel.
export const MIN_PASSWORD_LENGTH = 6;

export function isValidPassword(password: string): boolean {
  return password.length >= MIN_PASSWORD_LENGTH;
}
