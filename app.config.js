// Load environment variables from .env file
require('dotenv').config();

module.exports = {
  expo: {
    name: "FinGrow",
    slug: "fingrow",
    scheme: "fingrow",
    version: "1.0.0",
    orientation: "portrait",
    assetBundlePatterns: [
      "**/*"
    ],
    ios: {
      supportsTablet: true
    },
    jsEngine: "hermes",
    sdkVersion: "54.0.0",
    plugins: [
      "expo-font"
    ],
    // Pass environment variables to the app via Constants.expoConfig.extra
    extra: {
      FMP_API_KEY: process.env.FMP_API_KEY,
      CLAUDE_API_KEY: process.env.CLAUDE_API_KEY,
    }
  }
};
