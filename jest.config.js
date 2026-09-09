const RN_TRANSFORM_IGNORE = [
  'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@sentry/react-native|native-base|react-native-svg|firebase|@firebase)',
];

const BABEL = { presets: ['babel-preset-expo'] };

module.exports = {
  projects: [
    {
      displayName: 'unit',
      preset: 'jest-expo',
      testMatch: ['<rootDir>/__tests__/unit/**/*.test.ts?(x)'],
      transformIgnorePatterns: RN_TRANSFORM_IGNORE,
    },
    {
      displayName: 'api',
      preset: 'jest-expo',
      testMatch: ['<rootDir>/__tests__/api/**/*.test.ts?(x)'],
      transformIgnorePatterns: RN_TRANSFORM_IGNORE,
    },
    {
      displayName: 'config',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/__tests__/config/**/*.test.ts'],
      setupFiles: ['<rootDir>/__tests__/setup/loadEnv.js'],
      transform: { '^.+\\.[jt]sx?$': ['babel-jest', BABEL] },
    },
    {
      displayName: 'rules',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/__tests__/rules/**/*.test.ts'],
      transform: { '^.+\\.[jt]sx?$': ['babel-jest', BABEL] },
      transformIgnorePatterns: ['node_modules/(?!(firebase|@firebase))'],
      testTimeout: 30000,
    },
  ],
};
