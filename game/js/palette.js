/**
 * Named color palette for pixel-art sprites.
 *
 * Every sprite map in sprites.js is a 2D grid of single-character color keys.
 * Each key resolves to exactly one entry in this palette. Keeping the palette
 * separate from the grids keeps the art pure data: no images and no hex
 * literals scattered through sprite definitions — just keys that the renderer
 * maps to Canvas fill colors.
 */

export const palette = {
  // --- Mario (the mushroom cap reuses the red) ---
  R: '#e63946', // red — cap, shirt, mushroom cap
  S: '#f4c28d', // skin — face
  B: '#2a4bd7', // blue — overalls
  H: '#5b3a1e', // brown — hair, moustache, shoes, goomba feet
  K: '#1d1d1d', // dark — eyes, buttons, outlines, ? mark

  // --- Goomba ---
  G: '#a0522d', // brown — goomba body
  C: '#7a3b1e', // darker brown — goomba cap
  W: '#ffffff', // white — goomba eyes, mushroom spots

  // --- Coin & ? block ---
  O: '#f7c948', // gold — coin face, ? block face
  D: '#c98a1b', // dark gold — coin edge, block borders, pipe shadow

  // --- Mushroom ---
  M: '#fdf6e3', // cream — mushroom face

  // --- Tiles ---
  g: '#b4552d', // brick brown
  t: '#8a3d1e', // used-block brown
  e: '#a05a2c', // ground brown
  f: '#7a3d1e', // ground dark speckle
  l: '#c97a3f', // ground light speckle / pipe highlight
  p: '#2f9e44', // pipe green
};