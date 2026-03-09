const { withAndroidManifest } = require('@expo/config-plugins');

module.exports = function withMWA(config) {
  return withAndroidManifest(config, async (config) => {
    const androidManifest = config.modResults.manifest;
    
    // Add existing queries or create new array
    if (!androidManifest.queries) {
      androidManifest.queries = [];
    }
    
    // We need to add an intent filter to queries to support Android 11+ package visibility
    const mwaIntent = {
      intent: [
        {
          action: [{ $: { 'android:name': 'solana.wallet.port.action.MWA_PROVIDER' } }],
          data: [{ $: { 'android:scheme': 'solana-wallet' } }]
        }
      ]
    };

    androidManifest.queries.push(mwaIntent);

    return config;
  });
};
