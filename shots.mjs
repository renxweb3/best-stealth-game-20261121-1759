// Shadow Courier — screenshot driver + interactive smoke test (Node 22).
// Serves game/ with serve.ts, opens it in the cached headless Chromium shell,
// stages the four scenes (?shot=), screenshots each at 1280x720, then plays
// the live game for a few seconds (Enter, walk, sneak, restart) and reports
// any JavaScript error it saw.
import { spawn } from 'node:child_process';
import { statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const { chromium } = await import('/home/hatch/workspace/makefun-workspace/micro-20261121/best-stealth-game-20261121-1759/node_modules/playwright-core/index.mjs');

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = here;
const shotsDir = join(repoRoot, 'screenshots');
const PORT = 37175;
const SHELL = '/home/hatch/.cache/ms-playwright/chromium_headless_shell-1255/chrome-headless-shell-linux64/chrome-headless-shell';

const server = spawn('node', ['serve.ts', '--port', String(PORT)], { cwd: repoRoot, stdio: ['ignore', 'pipe', 'pipe'] });
await new Promise((resolve) => {
  server.stdout.on('data', () => resolve());
  setTimeout(resolve, 5000);
});
console.log(`serving on ${PORT}`);

const errors = [];
const browser = await chromium.launch({ executablePath: SHELL, args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('console', (msg) => {
  if (msg.type() === 'error') errors.push(`console: ${msg.text()}`);
});
page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));

const shots = [
  ['start', '1-start.jpg'],
  ['play', '2-play.jpg'],
  ['win', '3-win.jpg'],
  ['caught', '4-caught.jpg'],
];
for (const [name, file] of shots) {
  await page.goto(`http://localhost:${PORT}/?shot=${name}&seed=7`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__shotReady === true, null, { timeout: 15000 });
  await page.waitForTimeout(150);
  await page.screenshot({ path: join(shotsDir, file), type: 'jpeg', quality: 80 });
  const bytes = statSync(join(shotsDir, file)).size;
  console.log(`${file} ${bytes} bytes`);
}

// Interactive smoke test on the live game.
await page.goto(`http://localhost:${PORT}/?seed=7`, { waitUntil: 'load' });
await page.waitForTimeout(400);
await page.keyboard.press('Enter');
await page.waitForTimeout(300);
await page.keyboard.down('KeyD');
await page.waitForTimeout(700);
await page.keyboard.up('KeyD');
await page.keyboard.down('Shift');
await page.keyboard.down('KeyW');
await page.waitForTimeout(600);
await page.keyboard.up('KeyW');
await page.keyboard.up('Shift');
await page.keyboard.press('KeyR');
await page.waitForTimeout(400);
const ready = await page.evaluate(() => window.__shotReady);
console.log('interactive test done, shotReady flag (should be undefined in live mode):', ready);
await browser.close();
server.kill();
console.log(errors.length === 0 ? 'NO JS ERRORS' : `JS ERRORS:\n${errors.join('\n')}`);
process.exit(errors.length === 0 ? 0 : 1);
