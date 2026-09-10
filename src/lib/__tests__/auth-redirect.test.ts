import { webAuthRedirectUrl } from '../auth-redirect';

test('origine connue : construit /profile/sign-in dessus', () => {
  expect(webAuthRedirectUrl('https://gamelary.example.com')).toBe(
    'https://gamelary.example.com/profile/sign-in'
  );
});

test('origine absente (rendu serveur, pas de window) : chaîne vide plutôt que "undefined/profile/sign-in"', () => {
  expect(webAuthRedirectUrl(undefined)).toBe('');
});
