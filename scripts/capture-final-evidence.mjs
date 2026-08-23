/**
 * Final-evidence capture driver for the City Era Timelapse acceptance probe.
 *
 * The final QA acceptance run failed with "only one initial-state screenshot
 * supplied; no post-interaction or era-switch captures". This script makes the
 * canonical final-evidence browser smoke reproducible end-to-end:
 *
 *   1. Start the app exactly like the QA diagnostics' prepare/server command
 *      (`npm run dev`, the Vite dev server).
 *   2. Drive a real headless Chromium through every acceptance-relevant state:
 *        - the settled initial era look (1945),
 *        - camera orbit drag, wheel zoom and right-drag pan frames,
 *        - all four remaining era looks via the timeline chips,
 *        - mid-crossfade transition frames (`data-era-transitioning="true"`),
 *        - rapid back-to-back era switching (non-blocking swap),
 *        - keyboard operation of the WAI-ARIA slider (Home/End).
 *   3. Capture JPEG evidence frames plus an `evidence-manifest.json` that maps
 *      every frame to its state name, purpose and acceptance criteria, and
 *      proves camera responsiveness with per-frame canvas pixel-diff metrics.
 *
 * Every interaction drives the public affordances documented in README.md
 * (`data-testid="era-stop-*"`, `data-testid="city-canvas"`,
 * `[data-testid="era-timeline-thumb"]`, `#app[data-era=…]`,
 * `#app[data-era-transitioning]`) — no scene internals are touched, so this is
 * genuine behavioral evidence, not staged output.
 *
 * Usage: npm run evidence [-- --out evidence --port 5199]
 */

import { spawn } from 'node:child_process';
import { appendFileSync, mkdirSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

import { chromium } from 'playwright-core';
import { PNG } from 'pngjs';

// --------------------------------------------------------------------------
// Configuration
// --------------------------------------------------------------------------

const REPO_ROOT = process.cwd();
const args = process.argv.slice(2);
function argValue(flag, fallback) {
  const index = args.indexOf(flag);
  if (index === -1 || index + 1 >= args.length) return fallback;
  return args[index + 1];
}

const OUT_DIR = path.resolve(REPO_ROOT, argValue('--out', 'evidence'));
const SHOT_DIR = path.join(OUT_DIR, 'screenshots');
const PORT = Number(argValue('--port', '5199'));
const URL = `http://127.0.0.1:${PORT}/`;

/** Durable progress log — survives even if the runner drops stdout. */
const LOG_FILE = path.join(OUT_DIR, 'capture-run.log');
function log(message) {
  const line = `[${new Date().toISOString()}] ${message}`;
  try {
    mkdirSync(OUT_DIR, { recursive: true });
    appendFileSync(LOG_FILE, `${line}\n`);
  } catch {
    // best effort only
  }
  console.log(line);
}

/** Canonical prepare/server command from the QA diagnostics. */
const SERVER_COMMAND = 'npm run dev';
const SERVER_ARGS = ['run', 'dev', '--', '--host', '127.0.0.1', '--strictPort', '--port', String(PORT)];

const VIEWPORT = { width: 1280, height: 720 };
const SETTLE_MS = 400;

/** All five eras in registry order; 1945 is the initial committed era. */
const ERAS = ['1945', '1965', '1985', '2005', '2025'];

// --------------------------------------------------------------------------
// Small helpers
// --------------------------------------------------------------------------

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Mean-abs-diff + changed-pixel ratio between two same-size PNG buffers. */
function diffPngBuffers(aBuf, bBuf) {
  const a = PNG.sync.read(aBuf);
  const b = PNG.sync.read(bBuf);
  if (a.width !== b.width || a.height !== b.height) {
    return { width: a.width, height: b.height ?? a.height, changedPixelRatio: 1, meanAbsDelta: 255 };
  }
  let sum = 0;
  let changed = 0;
  const total = a.width * a.height;
  for (let i = 0; i < total; i += 1) {
    const o = i * 4;
    const d =
      (Math.abs(a.data[o] - b.data[o]) +
        Math.abs(a.data[o + 1] - b.data[o + 1]) +
        Math.abs(a.data[o + 2] - b.data[o + 2])) / 3;
    sum += d;
    if (d > 8) changed += 1;
  }
  return {
    width: a.width,
    height: a.height,
    changedPixelRatio: Number((changed / total).toFixed(6)),
    meanAbsDelta: Number((sum / total).toFixed(4)),
  };
}

// --------------------------------------------------------------------------
// Server lifecycle
// --------------------------------------------------------------------------

async function startServer() {
  const child = spawn('npm', SERVER_ARGS, {
    cwd: REPO_ROOT,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, BROWSER: 'none' },
  });
  let stdout = '';
  let stderr = '';
  child.stdout.on('data', (chunk) => {
    stdout += chunk.toString();
  });
  child.stderr.on('data', (chunk) => {
    stderr += chunk.toString();
  });

  const deadline = Date.now() + 45_000;
  let lastError = null;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(URL);
      if (response.ok) {
        return { child, stdout, stderr };
      }
      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await sleep(250);
  }
  child.kill('SIGTERM');
  throw new Error(
    `Dev server did not become ready at ${URL}: ${lastError?.message}\nstdout:\n${stdout}\nstderr:\n${stderr}`,
  );
}

// --------------------------------------------------------------------------
// Evidence session
// --------------------------------------------------------------------------

async function main() {
  await mkdir(SHOT_DIR, { recursive: true });

  log(`starting canonical server: ${SERVER_COMMAND}`);
  const server = await startServer();
  log(`server ready at ${URL}`);

  const manifest = {
    generatedAt: new Date().toISOString(),
    serverCommand: `${SERVER_COMMAND} --host 127.0.0.1 --strictPort --port ${PORT}`,
    url: URL,
    viewport: VIEWPORT,
    captures: [],
    interactions: [],
    consoleMessages: [],
    pageErrors: [],
    networkFailures: [],
    verdict: 'pending',
  };

  const browser = await chromium.launch({
    executablePath: '/usr/bin/chromium',
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-dev-shm-usage',
      '--use-gl=angle',
      '--use-angle=swiftshader',
      '--enable-unsafe-swiftshader',
      '--hide-scrollbars',
    ],
  });

  let failed = false;
  try {
    const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 1 });
    const page = await context.newPage();

    page.on('console', (message) => {
      // Screenshot capture itself produces benign SwiftShader "GPU stall due
      // to ReadPixels" driver warnings; keep everything else visible.
      if (!/GPU stall due to ReadPixels/.test(message.text())) {
        manifest.consoleMessages.push({ type: message.type(), text: message.text().slice(0, 500) });
      }
    });
    page.on('pageerror', (error) => {
      manifest.pageErrors.push(String(error));
    });
    page.on('requestfailed', (request) => {
      manifest.networkFailures.push(`${request.method()} ${request.url()} :: ${request.failure()?.errorText}`);
    });

    const step = async (name, purpose, criteriaRefs, action) => {
      const entry = { name, purpose, criteriaRefs };
      try {
        await action();
        entry.status = 'passed';
      } catch (error) {
        entry.status = 'failed';
        entry.error = String(error);
        failed = true;
      }
      manifest.interactions.push(entry);
      log(`${entry.status.padEnd(6)} ${name}`);
      return !failed;
    };

    /** Save one JPEG frame + optional PNG pixel-diff vs a previous buffer. */
    const shot = async (fileBase, purpose, criteriaRefs, extra = {}) => {
      const file = `${fileBase}.jpg`;
      const buffer = await page.screenshot({ type: 'jpeg', quality: 88, path: path.join(SHOT_DIR, file) });
      const capture = {
        file: `screenshots/${file}`,
        bytes: buffer.byteLength,
        purpose,
        criteriaRefs,
        ...extra,
      };
      if (extra.diffAgainst) {
        capture.pixelDiff = diffPngBuffers(extra.diffAgainst, await page.screenshot({ type: 'png' }));
        delete capture.diffAgainst;
      }
      manifest.captures.push(capture);
      return capture;
    };

    /** PNG snapshot kept in memory purely as a pixel-diff baseline. */
    const pngSnapshot = () => page.screenshot({ type: 'png' });

    const settledSelector = (era) =>
      `#app[data-era="${era}"][data-era-transitioning="false"]`;
    const waitSettled = (era, timeout = 15_000) =>
      page.waitForFunction(
        (selector) => {
          const el = document.querySelector('#app');
          return Boolean(el && el.matches(selector));
        },
        settledSelector(era),
        { timeout },
      );
    const eraState = () =>
      page.evaluate(() => ({
        era: document.querySelector('#app')?.getAttribute('data-era') ?? null,
        transitioning: document.querySelector('#app')?.getAttribute('data-era-transitioning') ?? null,
      }));

    // ---- Load -------------------------------------------------------------
    await page.goto(URL, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-testid="city-canvas"]', { timeout: 30_000 });
    await page.waitForSelector('#app[data-app-ready="true"]', { timeout: 30_000 });
    await waitSettled(ERAS[0]);

    const graphics = await page.evaluate(() => {
      const canvas = document.querySelector('[data-testid="city-canvas"]');
      const gl = canvas?.getContext('webgl2');
      if (!gl) return { webgl2: false };
      const debug = gl.getExtension('WEBGL_debug_renderer_info');
      return {
        webgl2: true,
        renderer: debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
      };
    });
    manifest.graphics = graphics;

    // ---- AC11/AC25 (initial look): settled 1945 ---------------------------
    await step('initial-era-1945', 'Settled initial era look (1945) over live canvas.', ['AC-11', 'AC-25'], async () => {
      await sleep(SETTLE_MS);
      const state = await eraState();
      if (state.era !== '1945' || state.transitioning !== 'false') {
        throw new Error(`unexpected initial state ${JSON.stringify(state)}`);
      }
      await shot('01-era-1945-initial', 'Initial committed era 1945 — Post-War Rebuild.', ['AC-11', 'AC-13'], {
        eraState: state,
      });
    });

    // ---- AC12: camera orbit / zoom / pan responsiveness --------------------
    await step('camera-orbit-drag', 'Left-drag orbit on the labelled application canvas.', ['AC-12'], async () => {
      const box = await page.locator('[data-testid="city-canvas"]').boundingBox();
      const before = await pngSnapshot();
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      for (let i = 1; i <= 14; i += 1) {
        await page.mouse.move(box.x + box.width / 2 - i * 16, box.y + box.height / 2 + i * 3);
        await sleep(24);
      }
      await page.mouse.up();
      await sleep(900); // damping inertia settles
      await shot('02-camera-orbit-after-drag', 'Viewport after left-drag orbit (damped).', ['AC-12'], {
        diffAgainst: before,
      });
    });

    await step('camera-zoom-wheel', 'Wheel zoom toward street level on the canvas.', ['AC-12'], async () => {
      const box = await page.locator('[data-testid="city-canvas"]').boundingBox();
      const before = await pngSnapshot();
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      for (let i = 0; i < 3; i += 1) {
        await page.mouse.wheel(0, -480);
        await sleep(160);
      }
      await sleep(900);
      await shot('03-camera-zoom-in', 'Viewport after scroll zoom-in.', ['AC-12'], { diffAgainst: before });
    });

    await step('camera-pan-right-drag', 'Right-drag ground-plane pan across the block.', ['AC-12'], async () => {
      const box = await page.locator('[data-testid="city-canvas"]').boundingBox();
      const before = await pngSnapshot();
      await page.mouse.move(box.x + box.width * 0.62, box.y + box.height * 0.6);
      await page.mouse.down({ button: 'right' });
      for (let i = 1; i <= 12; i += 1) {
        await page.mouse.move(box.x + box.width * 0.62 - i * 18, box.y + box.height * 0.6 - i * 8, {
          button: 'right',
        });
        await sleep(24);
      }
      await page.mouse.up({ button: 'right' });
      await sleep(700);
      await shot('04-camera-pan-right-drag', 'Viewport after right-drag pan.', ['AC-12'], {
        diffAgainst: before,
      });
    });

    // ---- AC25/AC11: traverse every remaining era with transition frames ----
    const targets = ERAS.slice(1);
    for (const [offset, target] of targets.entries()) {
      const sequenceBase = 5 + offset * 2; // 05/06, 07/08, 09/10, 11/12
      await step(`era-${target}-transition-and-settled`, `Commit era ${target}; capture mid-crossfade + settled frames.`, ['AC-15', 'AC-16', 'AC-25'], async () => {
        const before = await pngSnapshot();
        await page.click(`[data-testid="era-stop-${target}"]`);
        await page.waitForFunction(
          () => document.querySelector('#app')?.getAttribute('data-era-transitioning') === 'true',
          null,
          { timeout: 5_000 },
        );
        await sleep(700); // mid-fade (~35% through the 2s eased crossfade)
        const midState = await eraState();
        await shot(`${String(sequenceBase).padStart(2, '0')}-era-${target}-transition-mid`, `Mid-crossfade into ${target} (data-era-transitioning=true).`, ['AC-15'], {
          eraState: midState,
          diffAgainst: before,
        });
        await waitSettled(target);
        await sleep(SETTLE_MS);
        const settledState = await eraState();
        if (settledState.transitioning !== 'false') throw new Error('transition never settled');
        await shot(`${String(sequenceBase + 1).padStart(2, '0')}-era-${target}-settled`, `Settled era ${target} look.`, ['AC-11', 'AC-25'], {
          eraState: settledState,
        });
      });
    }

    // ---- AC16: rapid non-blocking switch -----------------------------------
    await step('rapid-switch-nonblocking', 'Back-to-back commits without waiting: 1945 → 1965 → 1985.', ['AC-16'], async () => {
      await page.click('[data-testid="era-stop-1945"]');
      await page.click('[data-testid="era-stop-1965"]');
      await page.click('[data-testid="era-stop-1985"]'); // lands mid-hand-off, must not wedge
      await waitSettled('1985');
      await sleep(SETTLE_MS);
      await shot('10-rapid-switch-settled-1985', 'Final frame after three rapid commits — swap stays animated and non-blocking.', ['AC-16']);
      if (manifest.pageErrors.length > 0) throw new Error('page errors during rapid switching');
    });

    // ---- AC13: keyboard-operable WAI-ARIA slider ----------------------------
    await step('keyboard-slider-home-end', 'Keyboard Home/End on the timeline slider commits first/last era.', ['AC-13'], async () => {
      await page.focus('[data-testid="era-timeline-thumb"]');
      await page.keyboard.press('End');
      await waitSettled(ERAS[ERAS.length - 1]);
      await page.keyboard.press('Home');
      await waitSettled(ERAS[0]);
      await sleep(SETTLE_MS);
      await shot('11-keyboard-slider-back-to-1945', 'After End→2025 and Home→1945 via the ARIA slider thumb.', ['AC-13']);
    });

    // ---- Final verdict ------------------------------------------------------
    const finalState = await eraState();
    manifest.finalEraState = finalState;
    const canvasProbe = await page.evaluate(() => {
      const canvas = document.querySelector('[data-testid="city-canvas"]');
      return {
        width: canvas?.width ?? 0,
        height: canvas?.height ?? 0,
        connected: Boolean(canvas?.isConnected),
      };
    });
    manifest.canvasProbe = canvasProbe;

    const criticalFailures =
      manifest.pageErrors.length +
      manifest.networkFailures.length +
      manifest.interactions.filter((entry) => entry.status !== 'passed').length;
    manifest.verdict = criticalFailures === 0 ? 'pass' : 'fail';
  } finally {
    await browser.close().catch(() => undefined);
    server.child.kill('SIGTERM');
    await sleep(300);
    if (server.child.exitCode === null) server.child.kill('SIGKILL');
  }

  const manifestFile = path.join(OUT_DIR, 'evidence-manifest.json');
  await writeFile(manifestFile, `${JSON.stringify(manifest, null, 2)}\n`);
  log(`verdict=${manifest.verdict} → ${path.relative(REPO_ROOT, manifestFile)}`);

  if (manifest.verdict !== 'pass') {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  try {
    appendFileSync(LOG_FILE, `fatal: ${error && error.stack ? error.stack : String(error)}\n`);
  } catch {
    // ignore
  }
  console.error('[evidence] fatal:', error);
  process.exitCode = 1;
});
