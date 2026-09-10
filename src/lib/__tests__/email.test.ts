import { isValidEmail } from '../email';

test.each([
  'jarod@example.com',
  '  jarod@example.com  ',
  'a.b+c@sub.example.co',
])('%s est valide', (value) => {
  expect(isValidEmail(value)).toBe(true);
});

test.each([
  '',
  '   ',
  'azerty',
  'jarod@',
  '@example.com',
  'jarod@example',
  'jarod example.com',
  'jarod@ example.com',
])('%s est invalide', (value) => {
  expect(isValidEmail(value)).toBe(false);
});
