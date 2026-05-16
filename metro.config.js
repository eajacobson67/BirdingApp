const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// @expo/vector-icons@15.1.x: build/IconsLazy.js (CJS) tries to require() ESM files.
// Redirect to build/Icons.js (pure ESM barrel) so Metro sees a consistent ESM chain
// that Babel transforms correctly, avoiding CJS->ESM interop failure.
const vectorIconsDir = path.dirname(
  require.resolve('@expo/vector-icons/package.json')
);

config.resolver = {
  ...config.resolver,
  resolveRequest: (context, moduleName, platform) => {
    if (moduleName === '@expo/vector-icons') {
      return { type: 'sourceFile', filePath: path.join(vectorIconsDir, 'build/Icons.js') };
    }
    return context.resolveRequest(context, moduleName, platform);
  },
};

module.exports = config;
