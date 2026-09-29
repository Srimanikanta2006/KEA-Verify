// Empty mock proxy for native-only libraries when bundling for web
const noop = () => ({});
const emptyMock = new Proxy(
  {},
  {
    get: (_target, prop) => {
      if (prop === '__esModule') return true;
      if (prop === 'default') return emptyMock;
      return noop;
    },
  }
);

module.exports = emptyMock;
module.exports.default = emptyMock;
