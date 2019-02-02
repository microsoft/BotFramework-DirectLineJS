const webpackConfig = require('./webpack.config');

// In order to pack instrumented build, make sure you are using Babel with NODE_ENV=TEST.
// This configuration file only change the entrypoints and will not add any instrumentation code.

module.exports = {
  ...webpackConfig,
  entry: {
    'directLine-instrumented': './built/directLine.js'
  },
  mode: 'development'
};
