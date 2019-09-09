const webpackConfig = require('./webpack-development.config');

module.exports = {
  ...webpackConfig,
  stats: {
    assets: false,
    builtAt: false,
    chunks: false,
    colors: true,
    hash: false,
    modules: false,
    version: false,
    warnings: false
  }
};
