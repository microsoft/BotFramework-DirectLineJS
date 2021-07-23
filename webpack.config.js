const { join } = require('path');

module.exports = {
  entry: {
    directline: './lib/directLine.js'
  },
  externals: ['net'],
  mode: 'production',
  output: {
    filename: '[name].js',
    library: 'DirectLine',
    libraryTarget: 'umd',
    path: join(__dirname, 'dist')
  },
  resolve: {
    fallback: {
      buffer: require.resolve('buffer'),
      stream: require.resolve('stream-browserify')
    }
  }
};
