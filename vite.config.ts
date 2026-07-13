import { defineConfig } from 'vite';

const configuredPort = Number.parseInt(process.env.PORT ?? '', 10);
const port = Number.isFinite(configuredPort) && configuredPort > 0 ? configuredPort : 4173;

export default defineConfig({
  server: { host: true, port },
  preview: { host: true, port },
});
