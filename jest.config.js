module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/tests/**/*.test.js', '**/tests/**/*.spec.js'],
  transform: {
    '^.+\\.(js|ts)$': 'babel-jest',
  },
};