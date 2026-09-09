module.exports = {
  preset: 'jest-expo',
  // e2e/ contient les specs Playwright (test/expect avec la fixture `page`,
  // pas l'API Jest) : le testMatch par défaut de jest-expo capterait aussi
  // *.spec.ts n'importe où dans le repo sans cette exclusion explicite.
  testPathIgnorePatterns: ['<rootDir>/node_modules/', '<rootDir>/e2e/'],
  moduleNameMapper: {
    // Doit précéder le mapping @/* générique ci-dessous, sinon
    // `import '@/global.css'` (theme.ts) résoudrait vers le vrai fichier
    // CSS, que Jest ne sait pas parser (effet de bord uniquement, aucun
    // export utilisé côté JS/TS).
    '\\.css$': '<rootDir>/jest.css-mock.js',
    '^@/assets/(.*)$': '<rootDir>/assets/$1',
    '^@/(.*)$': '<rootDir>/src/$1',
  },
};
