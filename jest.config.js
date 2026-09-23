const expoPreset = require('jest-expo/jest-preset');

module.exports = {
  preset: 'jest-expo',
  // Transform the patched ESM decoder while retaining Expo's other exclusions.
  transformIgnorePatterns: expoPreset.transformIgnorePatterns.map((pattern) =>
    pattern.replace(
      '/node_modules/',
      '/node_modules/(?!decode-uri-component-fixed/)',
    ),
  ),
  testMatch: ['<rootDir>/src/**/*.test.ts', '<rootDir>/src/**/*.test.tsx'],
  clearMocks: true,
  restoreMocks: true,
  modulePathIgnorePatterns: [
    '<rootDir>/test-results/',
    '<rootDir>/android/',
    '<rootDir>/ios/',
  ],
};
