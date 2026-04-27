#!/usr/bin/env node
/**
 * Sync FD_Reports static files into public/fd-reports/ before vite build.
 * Overwrites in place; does not delete stale files (mount may forbid unlink).
 *
 * Usage:
 *   FD_REPORTS_SRC="/abs/path/to/FD_Reports" npm run sync:fd-reports
 *   (or just `npm run sync:fd-reports` to auto-discover)
 */
import { mkdir, readdir, copyFile, stat } from 'node:fs/promises';
import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..');
const dest = path.join(repoRoot, 'public', 'fd-reports');

function findSiblingFDReports() {
  const parent = path.resolve(repoRoot, '..');
  if (!existsSync(parent)) return null;
  let siblings;
  try { siblings = readdirSync(parent); } catch { return null; }
  for (const name of siblings) {
    const candidate = path.join(parent, name, 'FD_Reports');
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

const candidates = [
  process.env.FD_REPORTS_SRC,
  findSiblingFDReports(),
].filter(Boolean);

const src = candidates.find((p) => existsSync(p));
if (!src) {
  console.warn('[sync-fd-reports] No FD_Reports source folder found; skipping. Tried:', candidates);
  process.exit(0);
}

console.log('[sync-fd-reports] src=', src);
console.log('[sync-fd-reports] dest=', dest);

await mkdir(dest, { recursive: true });

const allow = (name) =>
  name.endsWith('.html') || name.endsWith('.json') || name.endsWith('.md');

let copied = 0;
for (const entry of await readdir(src)) {
  const full = path.join(src, entry);
  const s = await stat(full);
  if (!s.isFile()) continue;
  if (!allow(entry)) continue;
  await copyFile(full, path.join(dest, entry));
  copied++;
}
console.log(`[sync-fd-reports] copied ${copied} files`);
