module.exports = {
  preset: 'jest-expo',
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
