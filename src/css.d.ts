/**
 * Ambient module declarations for CSS side-effect imports.
 *
 * The timeline HUD imports `src/ui/hud.css` as a plain side-effect so Vite
 * bundles it while Vitest stubs it in jsdom tests. TypeScript has no built-in
 * knowledge of `*.css` modules; this declaration keeps `tsc --noEmit` green.
 */
declare module '*.css';
