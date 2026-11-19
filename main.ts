// Sunset Bay v6 — build the submission dossier into /output (or
// MAKEFUN_OUTPUT_DIR).
//
// The output directory itself is never removed: in the grading sandbox it
// is a filesystem mount point, and deleting it fails with "Device or
// resource busy". Only its children are cleared before copying — that is
// the one rule this file must never break.
import { buildDossier } from "./vendor/makefun-game.ts";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.dirname(fileURLToPath(import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR || "/output";
const DOSSIER_LIMIT = 1572864; // 1.5 MiB

// Remove everything inside a directory, leaving the directory itself alone.
function emptyDir(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    fs.rmSync(path.join(dir, entry.name), { recursive: true, force: true });
  }
}

// Recursive copy, files and subdirectories alike.
function copyAll(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) copyAll(from, to);
    else if (entry.isFile()) fs.copyFileSync(from, to);
  }
}

function build() {
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  emptyDir(outDir);
  copyAll(path.join(repoRoot, "game"), path.join(outDir, "game"));
  copyAll(path.join(repoRoot, "screenshots"), path.join(outDir, "screenshots"));
  const dossier = buildDossier(outDir, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
  });
  if (dossier.length > DOSSIER_LIMIT) {
    throw new Error(`dossier too large: ${dossier.length} bytes (limit 1.5 MiB)`);
  }
  const target = path.join(outDir, "dossier.json");
  fs.writeFileSync(target, dossier);
  console.log(`wrote ${target} (${dossier.length} bytes)`);
}

build();

// Note: `out/` is git-ignored, as in v5 — the dossier is rebuilt from the
// repo on every run, never committed.
