/**
 * Neon Street Racer — page entry.
 *
 * The single composition entrypoint lives in `./game/main` (startGame +
 * entry bootstrap). index.html loads this module; it forwards the public
 * composition surface so browsers and tooling share one entry path.
 */
export {
  startGame,
  bootNeonRacer,
  steerPlayerTowardTrack,
  type NeonRacerHandle,
  type RacerDiagnostics,
  type WebGLRendererLike,
} from './game/main';