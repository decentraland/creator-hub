const baseConfig = require('./electron-builder.cjs');

const config = {
  ...baseConfig,
  publish: [
    {
      provider: 's3',
      bucket: 'creator-hub',
      endpoint: 'http://127.0.0.1:9000',
      region: 'us-east-1',
      path: '/creator-hub',
    },
  ],
};

module.exports = config;
