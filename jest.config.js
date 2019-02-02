module.exports = {
  "testMatch": [
    "**/__tests__/**/*.[jt]s?(x)",
    "**/?(*.)(spec|test).[jt]s?(x)"
  ],
  "transform": {
    "^.+\\.[jt]sx?$": "babel-jest"
  }
};
