// Polyfill crypto for React Native Hermes environment
if (typeof global.crypto !== 'object') {
  // @ts-expect-error polyfill
  global.crypto = {};
}
if (typeof global.crypto.getRandomValues !== 'function') {
  global.crypto.getRandomValues = function (byteArray) {
    for (let i = 0; i < byteArray.length; i++) {
      byteArray[i] = Math.floor(Math.random() * 256);
    }
    return byteArray;
  };
}
if (typeof global.crypto.randomUUID !== 'function') {
  global.crypto.randomUUID = function () {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
    });
  };
}

import { AppRegistry } from 'react-native';
import App from './src/App';

AppRegistry.registerComponent('main', () => App);

