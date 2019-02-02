const { resolve } = require('path');
const Visualizer = require('webpack-visualizer-plugin');

module.exports = {
  entry: {
    'directLine': './built/directLine.js'
  },
  mode: 'production',
  output: {
    filename: '[name].js',
    libraryTarget: 'umd',
    path: __dirname
  },
  plugins: [new Visualizer()]
};
