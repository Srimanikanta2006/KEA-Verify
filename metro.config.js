const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

const defaultConfig = getDefaultConfig(__dirname);

// react-native-fast-tflite: ship .tflite models as bundled assets
defaultConfig.resolver.assetExts.push('tflite');

const config = {
  resolver: {
    assetExts: defaultConfig.resolver.assetExts,
  },
};

module.exports = mergeConfig(defaultConfig, config);
