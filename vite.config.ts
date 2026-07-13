import { defineConfig } from 'vite';

// Honour the runtime-provided $PORT (used by the canonical browser smoke
// check and any static-host preview) so the deliverable is probeable. Falls
// back to Vite defaults when PORT is not set.
const port = process.env.PORT ? Number(process.env.PORT) : undefined;

export default defineConfig({
  base: './',
  server: { host: true, port },
  preview: { host: true, port },
});
