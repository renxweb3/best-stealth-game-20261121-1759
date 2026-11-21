// Shadow Courier — the hand-in program (Node 22, standard library only).
// It copies the playable game and its screenshots from beside this file into
// /output (or MAKEFUN_OUTPUT_DIR outside the grader) and writes the dossier
// the judge reads, with the vendored make.fun library.
//
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

function fail(message) {
  throw new Error(`Shadow Courier hand-in refused: ${message}`);
}

function handIn() {
  const gameDir = join(repoRoot, 'game');
  const shotsDir = join(repoRoot, 'screenshots');
  if (!existsSync(join(gameDir, 'index.html'))) fail('game/index.html is missing');
  if (!existsSync(shotsDir)) fail('screenshots/ is missing');
  const shots = readdirSync(shotsDir).filter((name) => !name.startsWith('.'));
  if (shots.length < 3 || shots.length > 4) fail(`expected 3 or 4 screenshots, found ${shots.length}`);
  for (const name of shots) {
    const bytes = statSync(join(shotsDir, name)).size;
    if (bytes > 262144) fail(`screenshot ${name} is ${bytes} bytes (cap 256 KiB)`);
  }

  mkdirSync(outputDir, { recursive: true });
  cpSync(gameDir, join(outputDir, 'game'), { recursive: true });
  mkdirSync(join(outputDir, 'screenshots'), { recursive: true });
  cpSync(shotsDir, join(outputDir, 'screenshots'), { recursive: true });

  // The scorer's own caps: only text_max_bytes shapes the bytes; the others
  // refuse an entry the scorer would refuse.
  writeFileSync(
    join(outputDir, 'dossier.json'),
    buildDossier(outputDir, {
      text_max_bytes: 163840,
      screenshots: { max: 4, max_bytes: 262144 },
      game_max_files: 993,
      game_max_bytes: 50331648,
      game_path_max_bytes: 1000,
    }),
  );
}

handIn();
