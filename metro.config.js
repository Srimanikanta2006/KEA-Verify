const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// react-native-fast-tflite: ship .tflite models as bundled assets
config.resolver.assetExts.push('tflite');

const originalResolveRequest = config.resolver.resolveRequest;

const NATIVE_ONLY_PACKAGES = new Set([
  'react-native-fast-tflite',
  'react-native-nitro-modules',
  '@react-native-google-signin/google-signin',
  'expo-face-detector',
]);

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === 'web' && NATIVE_ONLY_PACKAGES.has(moduleName)) {
    return {
      type: 'sourceFile',
      filePath: path.resolve(__dirname, 'src/shims/emptyMock.js'),
    };
  }
  if (originalResolveRequest) {
    return originalResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
