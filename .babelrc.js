module.exports = {
  env: {
    test: {
      plugins: [
        'babel-plugin-istanbul'
      ]
    }
  },
  plugins: [
    '@babel/plugin-proposal-class-properties',
    '@babel/plugin-proposal-object-rest-spread',
    '@babel/plugin-transform-runtime',
    'babel-plugin-transform-inline-environment-variables'
  ],
  presets: [
    ['@babel/preset-env', {
      forceAllTransforms: true,
      modules: 'commonjs'
    }],
    '@babel/preset-typescript'
  ],
  sourceMaps: 'inline'
};
