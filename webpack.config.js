const { DefinePlugin } = require('webpack');
const { join } = require('path');
const Visualizer = require('webpack-visualizer-plugin');

module.exports = {
  entry: {
    directline: './lib/directLine.js'
  },
  mode: 'production',
  output: {
    filename: '[name].js',
    library: 'DirectLine',
    libraryTarget: 'umd',
    path: join(__dirname, 'dist')
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
