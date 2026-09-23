module.exports = {
  preset: 'jest-expo',
  testMatch: ['<rootDir>/src/**/*.test.ts', '<rootDir>/src/**/*.test.tsx'],
  clearMocks: true,
  restoreMocks: true,
  modulePathIgnorePatterns: [
    '<rootDir>/test-results/',
    '<rootDir>/android/',
    '<rootDir>/ios/',
  ],
};
