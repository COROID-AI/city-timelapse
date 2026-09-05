/**
 * src/assets/index.ts — public asset pipeline surface.
 *
 * Re-exports the CanvasTexture factory so scene modules and era-content tasks
 * import from the single `src/assets` module boundary. `TextureSpec` is defined
 * in src/eras.ts (part of the shared era data model) and re-exported here for
 * convenience.
 */

export {
  createCanvasTexture,
  createCanvasTextureCached,
  createLabelTexture,
  clearCanvasTextureCache,
} from './CanvasTextureFactory';

export type { CanvasTextureResult } from './CanvasTextureFactory';

export type { TextureSpec } from '../eras';