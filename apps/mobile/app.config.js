// Extends app.json with values that must not be committed.
// GOOGLE_MAPS_API_KEY: Android Google Maps key (react-native-maps). Set it as an EAS environment variable
// for builds; without it a standalone Android build crashes when the map tab opens. Expo Go doesn't need it.
module.exports = ({ config }) => ({
  ...config,
  android: {
    ...config.android,
    config: {
      ...(config.android?.config ?? {}),
      googleMaps: { apiKey: process.env.GOOGLE_MAPS_API_KEY },
    },
  },
});
