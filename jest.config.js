module.exports = {
  setupFiles: ['./__tests__/setup/setupCrypto'],
  testEnvironment: './__tests__/setup/jsdomEnvironmentWithProxy',
  testMatch: ['**/__tests__/**/*.[jt]s?(x)', '**/?(*.)(spec|test).[jt]s?(x)'],
  testPathIgnorePatterns: ['<rootDir>/__tests__/setup/'],

  // We need to transpile /node_modules/ because Jest does not fully support ESM yet.
  transformIgnorePatterns: []
};
