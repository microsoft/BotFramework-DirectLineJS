const { StatsWriterPlugin } = require('webpack-stats-plugin');

module.exports = {
  entry: {
    directline: './lib/directLine.js'
  },
  externals: ['net'],
  mode: 'production',
  module: {
    rules: [
      {
        // To speed up bundling, we are limiting Babel to a number of packages which does not publish ES5 bits.
        test: /\/node_modules\/(botframework-streaming|buffer)\//iu,
        use: {
          loader: 'babel-loader',
          options: {
            presets: [
              [
                '@babel/preset-env',
                {
                  modules: 'commonjs'
                }
              ]
            ]
          }
        }
      }
    ]
  },
  output: {
    library: 'DirectLine',
    libraryTarget: 'umd'
  },
  plugins: [
    new StatsWriterPlugin({
      filename: 'stats.json',
      transform: (_, opts) => JSON.stringify(opts.compiler.getStats().toJson({ chunkModules: true }), null, 2)
    })
  ],
  target: ['web', 'es2019']
};
