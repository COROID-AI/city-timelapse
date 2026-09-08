/**
 * Shared era domain: single-owner registry, dataset, and interpolation engine.
 *
 * This is the canonical entry point for the era module. All parallel scene
 * subsystems consume era data through this surface — no other source file
 * should define its own era-year list or era data.
 */
export * from './types';
export * from './data';
export * from './interpolate';
