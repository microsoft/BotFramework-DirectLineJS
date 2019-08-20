const { resolve } = require('path');
const { DefinePlugin } = require('webpack');
const Visualizer = require('webpack-visualizer-plugin');

module.exports = {
  entry: {
    'directLine': './built/directLine.js'
  },
  externals: ['net', 'fs', 'watershed', 'botframework-connector'],
  mode: 'production',
  output: {
    filename: '[name].js',
    library: 'DirectLine',
    libraryTarget: 'umd',
    path: __dirname
  },
  plugins: [
    new DefinePlugin({
      'process.env': {
        'VERSION': JSON.stringify(process.env.npm_package_version)
      }
    }),
    new Visualizer()
  ]
};
