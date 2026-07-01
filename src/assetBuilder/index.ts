/**
 * Procedural geometry & texture authoring utilities.
 *
 * Every export here is a pure function of an {@link Era} argument — no
 * module-level mutable state, no external image/model fetches — so the city
 * block can be assembled and transformed between eras without hand-modelling
 * each asset. See `eras.ts` for the era data model.
 */
export * from './eras';
export * from './textures';
export * from './vehicle';
export * from './pedestrian';
