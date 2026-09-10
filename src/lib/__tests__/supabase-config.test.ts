import { getSupabaseConfig } from '../supabase-config';

const ENV_KEYS = ['EXPO_PUBLIC_SUPABASE_URL', 'EXPO_PUBLIC_SUPABASE_ANON_KEY'] as const;
const original: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const key of ENV_KEYS) {
    original[key] = process.env[key];
    delete process.env[key];
  }
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (original[key] === undefined) delete process.env[key];
    else process.env[key] = original[key];
  }
});

test("absence des deux variables : repli sur null, jamais une exception", () => {
  expect(getSupabaseConfig()).toBeNull();
});

test("une seule des deux variables présente : toujours null", () => {
  process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://abcdefgh.supabase.co';
  expect(getSupabaseConfig()).toBeNull();

  delete process.env.EXPO_PUBLIC_SUPABASE_URL;
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';
  expect(getSupabaseConfig()).toBeNull();
});

test('les deux variables présentes et valides : configuration renvoyée', () => {
  process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://abcdefgh.supabase.co';
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'anon-key-value';

  expect(getSupabaseConfig()).toEqual({
    url: 'https://abcdefgh.supabase.co',
    anonKey: 'anon-key-value',
  });
});

test('espaces superflus recopiés depuis .env.example : nettoyés avant usage', () => {
  process.env.EXPO_PUBLIC_SUPABASE_URL = '  https://abcdefgh.supabase.co  ';
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = '  anon-key-value  ';

  expect(getSupabaseConfig()).toEqual({
    url: 'https://abcdefgh.supabase.co',
    anonKey: 'anon-key-value',
  });
});

test("une URL mal formée (pas d'URL, ou http:// au lieu de https://) : null plutôt qu'un createClient() qui échouerait plus tard", () => {
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'anon-key-value';

  process.env.EXPO_PUBLIC_SUPABASE_URL = 'pas-une-url';
  expect(getSupabaseConfig()).toBeNull();

  process.env.EXPO_PUBLIC_SUPABASE_URL = 'http://abcdefgh.supabase.co';
  expect(getSupabaseConfig()).toBeNull();
});

test('chaînes vides après trim (copié-collé de .env.example tel quel) : traitées comme absentes', () => {
  process.env.EXPO_PUBLIC_SUPABASE_URL = '   ';
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = '   ';
  expect(getSupabaseConfig()).toBeNull();
});
