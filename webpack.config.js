const path = require('path');
const {DefinePlugin} = require('webpack');

module.exports = {
  entry: {
    directLine: path.resolve('./src/directLine.ts')
  },
  module: {
    rules: [
      {
        test: /\.(ts)$/,
        exclude: [ /node_modules/ ],
        use: {
          loader: 'babel-loader',
          'options': {
            'ignore': [ '**/*.spec.ts' ]
          }
        }
      },
    ],
  },

  resolve: {
    extensions: [ '.ts' ]
  },

  output: {
    libraryTarget: 'umd',
    library: 'DirectLine',
    filename: './index.js',
  },

  stats: {
    warnings: false,
    colors: true
  },

  externals: {},
  plugins: []
};
