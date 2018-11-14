const path = require('path');
const webpack = require('webpack');
const webpackConfig = require('../webpack.config.js');
const NLE = process.env.npm_lifecycle_event;
const mode = NLE.includes('prod') ? 'production' : 'development';
const target = NLE.includes('node') ? 'node' : 'web';
const output = path.join('./lib', target);

webpackConfig.target = target;
webpackConfig.output.path = path.resolve(output);
webpackConfig.mode = mode;
webpackConfig.plugins.push(new webpack.DefinePlugin({
  __NODE__: target === 'node'
}));
if (mode === 'development') {
  webpackConfig.devtool = 'source-maps';
}

const bundle = () => {
  return new Promise((resolve, reject) => {
    webpack(webpackConfig, (err, stats) => {
      err ? reject(err) : resolve(stats);
    })
  });
};

bundle()
  .then(stats => process.stdout.write(`${stats.toString.call(stats, {colors: true})}\n`))
  .catch(err => process.stderr.write(JSON.stringify(err)));