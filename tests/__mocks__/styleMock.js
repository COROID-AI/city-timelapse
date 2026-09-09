/**
 * Jest stylesheet stub. The HUD imports its owned CSS (src/game/hud.css)
 * so the module compiles through the Vite asset pipeline; Jest maps that
 * import to this empty module (see the `moduleNameMapper` in jest.config.js)
 * because jsdom has no CSS engine of its own.
 */
module.exports = {};