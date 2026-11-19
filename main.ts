// Sunset Bay v6 — build the submission dossier into /output (or
// MAKEFUN_OUTPUT_DIR). The output directory itself is never removed: in the
// grading sandbox it is a filesystem mount point, and deleting it fails with
// "Device or resource busy". Only its children are cleared before copying.
import { buildDossier } from "./vendor/makefun-game.ts";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.dirname(fileURLToPath(import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR || "/output";

function copyTree(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) copyTree(from, to);
    else if (entry.isFile()) fs.copyFileSync(from, to);
  }
}

function clearChildren(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    fs.rmSync(path.join(dir, entry.name), { recursive: true, force: true });
  }
}

function main() {
  // Create the output directory only when it does not exist yet.
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  // Clean out stale contents, but never the directory itself.
  clearChildren(outDir);
  copyTree(path.join(repoRoot, "game"), path.join(outDir, "game"));
  copyTree(path.join(repoRoot, "screenshots"), path.join(outDir, "screenshots"));
  const dossier = buildDossier(outDir, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
  });
  if (dossier.length > 1572864) {
    throw new Error(`dossier too large: ${dossier.length} bytes (limit 1.5 MiB)`);
  }
  fs.writeFileSync(path.join(outDir, "dossier.json"), dossier);
  console.log(`wrote ${path.join(outDir, "dossier.json")} (${dossier.length} bytes)`);
}

main();
