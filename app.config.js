const { expo } = require('./app.json');

module.exports = {
  ...expo,
  android: {
    ...expo.android,
    config: {
      ...expo.android.config,
      googleMaps: {
        apiKey: process.env.GOOGLE_MAPS_KEY ?? '',
      },
    },
  },
};
