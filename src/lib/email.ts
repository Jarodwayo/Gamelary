// Validation d'e-mail volontairement permissive (voir isValidUsername,
// profile.ts, pour le même niveau de rigueur appliqué ailleurs) : le vrai
// juge de ce qui constitue un e-mail valide est Supabase Auth au moment de
// l'envoi du lien magique, pas ce regex. Il ne sert qu'à activer/désactiver
// le bouton "Envoyer le lien de connexion" (voir profile/sign-in.tsx) sans
// laisser l'utilisateur taper "azerty" et attendre une réponse réseau pour
// apprendre que ce n'est pas une adresse.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(value: string): boolean {
  return EMAIL_PATTERN.test(value.trim());
}
