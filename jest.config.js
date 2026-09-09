/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.ts'],
  transform: {
    // Character-class dot keeps the pattern free of escape backslashes so
    // ts-jest reliably transforms every .ts/.tsx file under the test root.
    '^.+[.]tsx?$': ['ts-jest', { tsconfig: 'tsconfig.test.json' }],
  },
  moduleNameMapper: {
    // Vite asset imports (e.g. src/game/hud.css) are a no-op under Jest.
    '[.]css$': '<rootDir>/tests/__mocks__/styleMock.js',
  },
};