#!/usr/bin/env node
/**
 * Final delivery gate for the Super Mario game.
 *
 * Runs the full Jest unit/integration suite for tests/game and then the
 * Playwright browser E2E suite, exiting non-zero if either stage fails.
 *
 * This script does NOT add or rewrite game logic — it only consolidates the
 * already-completed suites into a single gate command:
 *
 *   npm run game:verify
 *
 * Exit codes:
 *   0  All unit and browser invariants hold.
 *   1  Jest (tests/game) failed.
 *   2  Playwright E2E failed.
 */

import { spawnSync } from 'node:child_process';

const isWindows = process.platform === 'win32';
const npmCmd = isWindows ? 'npm.cmd' : 'npm';

/**
 * Run a stage synchronously and report its outcome.
 * @param {string} label - Human-readable stage name.
 * @param {string[]} args - Arguments for the npm invocation.
 * @returns {boolean} true when the stage exited 0.
 */
function runStage(label, args) {
  console.log(`\n=== ${label} ===`);
  const result = spawnSync(npmCmd, args, { stdio: 'inherit' });
  if (result.status === 0) {
    console.log(`--- ${label}: PASSED`);
    return true;
  }
  console.error(`--- ${label}: FAILED (exit ${result.status})`);
  return false;
}

const jestOk = runStage('Jest unit/integration suite (tests/game)', ['run', 'game:test']);
const e2eOk = runStage('Playwright browser E2E', ['run', 'game:e2e']);

if (jestOk && e2eOk) {
  console.log('\n=== game:verify: ALL CHECKS PASSED ===');
  process.exit(0);
}

console.error('\n=== game:verify: FAILED ===');
process.exit(jestOk ? 2 : 1);