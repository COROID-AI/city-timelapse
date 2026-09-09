/**
 * Babel is Jest-only plumbing for this project.
 *
 * Game code is plain browser ES modules; nothing at runtime goes through
 * Babel. babel-jest uses this preset to transform ESM imports into CJS so
 * that tests can import game modules in Node.
 */
module.exports = {
  presets: [
    [
      '@babel/preset-env',
      {
        targets: { node: 'current' },
      },
    ],
  ],
};
