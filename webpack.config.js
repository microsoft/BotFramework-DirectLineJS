const { StatsWriterPlugin } = require('webpack-stats-plugin');

module.exports = {
  entry: {
    directline: './lib/directLine.js'
  },
  externals: ['net'],
  mode: 'production',
  output: {
    library: 'DirectLine',
    libraryTarget: 'umd'
  },
  plugins: [
    new StatsWriterPlugin({
      filename: 'stats.json',
      transform: (_, opts) => JSON.stringify(opts.compiler.getStats().toJson({ chunkModules: true }), null, 2)
    })
  ]
};
