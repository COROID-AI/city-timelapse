/**
 * World 1-1 inspired level layout.
 *
 * Stored as a row-major ASCII grid: each string is one row of tiles, the
 * first string is the top row. The grid is intentionally 1-1-inspired with
 * ground terrain, brick blocks, ? item blocks, pipes and a pit.
 *
 * Tile legend (see game/js/level.js for the canonical TILE identifiers):
 *   .  empty / air
 *   #  ground terrain
 *   B  brick block
 *   ?  question (item) block
 *   U  used (emptied) block
 *   [  pipe top-left segment
 *   ]  pipe top-right segment
 *   {  pipe body-left segment
 *   }  pipe body-right segment
 *
 * Rows are assembled from column segments and right-padded to a uniform width
 * so hand-editing a wide ASCII map stays error-free.
 */

/** Uniform level width in tiles. */
const WIDTH = 100;

/** Build one row from ordered segments, padded to the uniform width. */
function row(...segments) {
  let line = segments.join('');
  if (line.length > WIDTH) {
    throw new Error(`Level row exceeds width ${WIDTH}: ${line.length}`);
  }
  return line.padEnd(WIDTH, '.');
}

// Row 13/14 ground terrain with a pit gap at columns 70-72.
const GROUND_LEFT = '#'.repeat(70);
const GROUND_RIGHT = '#'.repeat(27);

export const LEVEL_1_1 = [
  // Rows 0-6: open air.
  row('.'.repeat(WIDTH)),
  row('.'.repeat(WIDTH)),
  row('.'.repeat(WIDTH)),
  row('.'.repeat(WIDTH)),
  row('.'.repeat(WIDTH)),
  row('.'.repeat(WIDTH)),
  row('.'.repeat(WIDTH)),
  // Row 7: a small brick staircase.
  row('.'.repeat(28), 'BB'),
  // Row 8: floating bricks, ? item blocks and one used block.
  row('.'.repeat(12), 'BBB', '..', '?', '.', '?', '..', 'BB', '..', 'B',
      '.'.repeat(12), 'BBB', '.'.repeat(15), '?', '.', '?', '.', '?', '..',
      'BB', '..', 'U'),
  // Row 9: pipe 2 top, a brick shelf and a ? block.
  row('.'.repeat(46), 'BBB', '[]', '...', 'BBB', '..', '?', '...', 'BBB'),
  // Row 10: pipe 1 top, pipe 2 body, brick shelf.
  row('.'.repeat(30), '[]', '.'.repeat(10), '{}', '...', 'BBB'),
  // Row 11: pipe bodies and brick shelf.
  row('.'.repeat(30), '{}', '.'.repeat(10), '{}', '...', 'BBB'),
  // Row 12: pipe bodies.
  row('.'.repeat(30), '{}', '.'.repeat(10), '{}'),
  // Row 13: ground terrain with a pit.
  row(GROUND_LEFT, '...', GROUND_RIGHT),
  // Row 14: ground terrain with the same pit.
  row(GROUND_LEFT, '...', GROUND_RIGHT),
];