const path = require('path');

module.exports = {
  entry: {
    "zigbee2mqtt": './src/zigbee2mqtt.ts'
  },
  mode: 'production',
  target: 'node',
  node: {
    __dirname: true,
  },
  optimization:{
    minimize: false, // <---- disables uglify.
  },
  externals: [
    function ({context, request}, callback) {
      if (["zigbee-herdsman-converters", "svg2img", "viz.js"
      ].indexOf(request) !== -1) {
        return callback(null, `require('${request}')`);
      }
      callback();
    }
  ],
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: [/templates/, /node_modules/]
      }
    ]
  },
  resolve: {
    extensions: [".tsx", ".ts", ".js"]
  },
  output: {
    filename: 'dist/[name].js',
    path: path.resolve(__dirname, './')
  }
};
