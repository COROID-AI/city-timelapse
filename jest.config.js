/**
 * Jest configuration for the browser game foundation.
 *
 * Game code is plain browser ES modules, loaded in the page via
 * <script type="module">. Jest is Babel-transformed to CommonJS so the same
 * ESM sources can be imported headlessly under Node (no DOM) for unit tests.
 *
 * @type {import('jest').Config}
 */
module.exports = {
  testEnvironment: 'node',
  transform: {
    '^.+\\.js$': ['babel-jest', { configFile: './babel.config.js' }],
  },
  transformIgnorePatterns: ['/node_modules/'],
  testMatch: ['**/tests/**/*.test.js'],
};
