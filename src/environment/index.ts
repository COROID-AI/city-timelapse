/**
 * Environment module.
 *
 * Owns sky, fog, sun/moon, star field, ground, roads, sidewalks, streetlight
 * rig, color grading, and ambient weather particles per era. The subsystem
 * implements the `EraScopedSubsystem` contract and registers itself through
 * the SceneRegistry so the TransformationEngine can blend it between eras.
 */
export { EnvironmentSubsystem, createEnvironmentSubsystem, getEnvironmentSubsystem, resetEnvironmentSubsystem } from './EnvironmentSubsystem';
export type { EraSkyState } from './sky';
export type { EraLightState, StreetlightStyle } from './streetlights';
export type { EraParticleState } from './particles';
export type { ColorGradeState } from './grading';
export { buildColorGrade, lerpColorGrade, applyColorGrade, getGradeUniforms } from './grading';
export { getEnvironmentForEra } from './eraEnvironment';
export { paintLaneMarkings, generateAsphaltTexture, generateConcreteTexture } from './textures';
export { getLampPositions } from './layout';