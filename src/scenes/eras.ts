/**
 * Backward-compatible re-export of the era domain.
 *
 * Consumers that previously imported from `./eras` (the module root) keep
 * working: they receive the same typed registry, dataset, and interpolation
 * engine exposed by `./eras/index.ts`.
 */
export * from './eras/index';
