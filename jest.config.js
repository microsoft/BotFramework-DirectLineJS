module.exports = {
  setupFiles: ['./__tests__/setup/setupCrypto'],
  testEnvironment: './__tests__/setup/jsdomEnvironmentWithProxy',
  testMatch: ['**/__tests__/**/*.[jt]s?(x)', '**/?(*.)(spec|test).[jt]s?(x)'],
  testPathIgnorePatterns: ['<rootDir>/__tests__/setup/', '<rootDir>/__tests__/[\d\w]*/__setup__/'],

  // Some packages enforce ESM but jest@27.0.6 does not fully support ESM yet.
  // We need to transpile these ESM packages back to CommonJS when importing them under Jest:
  // - p-defer
  // Jest default is ["/node_modules/", "\\.pnp\\.[^\\\/]+$"].
  // https://jestjs.io/docs/configuration#transformignorepatterns-arraystring
  transformIgnorePatterns: ['\\/node_modules\\/(?!p-defer\\/)', '\\.pnp\\.[^\\/]+$']
};
