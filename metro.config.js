const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

config.resolver.blockList = [
  /\.claude\/.*/,
];

config.watchFolders = config.watchFolders || [];

module.exports = config;
