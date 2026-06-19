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
  target: ['web', 'es2019']
};
