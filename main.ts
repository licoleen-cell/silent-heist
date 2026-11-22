// Silent Heist, handed in (Node 22, standard library only).
//
// The game is this repository's game/ folder: plain static files a desktop browser loads
// offline (game/index.html and its ES modules, no library, no build step, no network request).
// This program copies game/ and screenshots/ from beside this file to the output directory and
// writes dossier.json there with the vendored make.fun library, which is what the scorer reads.
//
// Serve it locally with `node serve.ts`, then open http://localhost:8080.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

/** The scorer's own caps (the kit's gate.json). Only text_max_bytes shapes the dossier's bytes;
 * the rest make this program refuse an entry the scorer would refuse rather than hand one in. */
const CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};

const screenshots = join(here, 'screenshots');
const game = join(here, 'game');

if (!existsSync(join(game, 'index.html'))) {
  console.error('main.ts: game/index.html is missing: game/ is what gets handed in');
  process.exit(1);
}
if (!existsSync(screenshots)) {
  console.error('main.ts: screenshots/ is missing: the judge sees the game through them');
  process.exit(1);
}

const shots = readdirSync(screenshots).filter((name) => !name.startsWith('.'));
if (shots.length < 3 || shots.length > CAPS.screenshots.max) {
  console.error(`main.ts: screenshots/ holds ${shots.length} files, and the entry needs 3 or 4`);
  process.exit(1);
}

mkdirSync(out, { recursive: true });
cpSync(game, join(out, 'game'), { recursive: true });
cpSync(screenshots, join(out, 'screenshots'), { recursive: true });

const dossier = buildDossier(out, CAPS);
writeFileSync(join(out, 'dossier.json'), dossier);

console.log(`Silent Heist: game/ and ${shots.length} screenshots handed in to ${out}`);
console.log(`dossier.json: ${dossier.length} bytes (cap ${CAPS.text_max_bytes} of source text)`);
