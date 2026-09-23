const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
const defaults = config.resolver.blockList;

// Local native probes and downloaded tools must never enter the app file map.
config.resolver.blockList = [
  ...(Array.isArray(defaults) ? defaults : defaults ? [defaults] : []),
  /[/\\]test-results[/\\].*/,
];

module.exports = config;
