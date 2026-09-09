#!/usr/bin/env node
/**
 * Zero-image-assets & zero-runtime-dependencies audit (scripts/audit-no-image-assets.js).
 *
 * Part of the end-to-end verification checkpoint. Enforces two hard invariants
 * of the delivered product, repeatably and CI-friendly:
 *
 *  1. Every piece of pixel art is drawn directly with the Canvas API — the repo
 *     must contain ZERO image files (png / jpg / jpeg / gif / webp / bmp / ico).
 *  2. The game is engine-free and dependency-free at runtime — package.json's
 *     `dependencies` object must be empty (no Phaser, no game engine, nothing).
 *
 * The scan covers the whole repository tree except `.git` (VCS metadata) and
 * `node_modules` (the npm-installed dev toolchain, which is generated, untracked
 * and not part of the product). Everything else is scanned recursively,
 * including dotfiles.
 *
 * Exit codes:
 *  0  audit passed — no image files, empty runtime `dependencies`
 *  1  audit failed — at least one violation found (details printed to stderr)
 *
 * Usage: node scripts/audit-no-image-assets.js
 */

'use strict';

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..');

/** Image extensions the product must never ship as files. */
const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.ico']);

/** Directories that are not product content and must not be scanned. */
const SKIP_DIRS = new Set(['.git', 'node_modules']);

/** Image files discovered by the scan (repo-relative paths). */
const foundImages = [];

/** Non-fatal I/O errors encountered during the scan (become failures). */
const scanErrors = [];

/**
 * Recursively walk a directory tree, collecting every image file found.
 * Directories inside SKIP_DIRS are not entered; symlink loops are avoided by
 * never following directory symlinks.
 *
 * @param {string} dir Absolute directory to scan.
 */
function walk(dir) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (err) {
    scanErrors.push(`cannot read directory ${path.relative(REPO_ROOT, dir)}: ${err.message}`);
    return;
  }

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory() && !entry.isSymbolicLink()) {
      if (!SKIP_DIRS.has(entry.name)) {
        walk(fullPath);
      }
      continue;
    }

    const ext = path.extname(entry.name).toLowerCase();
    if (IMAGE_EXTENSIONS.has(ext)) {
      foundImages.push(path.relative(REPO_ROOT, fullPath));
    }
  }
}

/**
 * Read package.json and return its runtime `dependencies` object.
 * Any parse error is recorded as a scan error and {} is returned.
 *
 * @returns {object} Runtime dependency map (name -> version spec).
 */
function readRuntimeDependencies() {
  const pkgPath = path.join(REPO_ROOT, 'package.json');
  let pkg;
  try {
    pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  } catch (err) {
    scanErrors.push(`cannot parse ${path.relative(REPO_ROOT, pkgPath)}: ${err.message}`);
    return {};
  }

  return pkg.dependencies && typeof pkg.dependencies === 'object' ? pkg.dependencies : {};
}

/** Count every non-directory entry under REPO_ROOT (excluding .git / node_modules). */
function countScannedFiles() {
  let count = 0;
  const queue = [REPO_ROOT];
  while (queue.length > 0) {
    const dir = queue.pop();
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (entry.isDirectory() && !entry.isSymbolicLink()) {
        if (!SKIP_DIRS.has(entry.name)) {
          queue.push(path.join(dir, entry.name));
        }
      } else {
        count += 1;
      }
    }
  }
  return count;
}

function main() {
  walk(REPO_ROOT);

  const dependencies = readRuntimeDependencies();
  const declaredDeps = Object.keys(dependencies).sort();
  const failures = [];

  if (foundImages.length > 0) {
    failures.push(
      `found ${foundImages.length} image file(s) in the repository:\n  - ${foundImages.join('\n  - ')}`,
    );
  }

  if (declaredDeps.length > 0) {
    failures.push(
      `package.json declares runtime dependencies (game must be engine-free): ${declaredDeps.join(', ')}`,
    );
  }

  scanErrors.forEach((err) => failures.push(err));

  if (failures.length > 0) {
    console.error('AUDIT FAILED:');
    for (const failure of failures) {
      console.error(`  • ${failure}`);
    }
    console.error('\nThe game must be zero-image (Canvas-drawn pixel art only) and zero-dependency.');
    process.exit(1);
  }

  const scanned = countScannedFiles();
  console.log(
    `[audit-no-image-assets] PASS — ${scanned} files scanned, 0 image assets, ` +
      `0 runtime dependencies in package.json`,
  );
}

main();