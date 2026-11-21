// Shadow Courier — the three hand-built floors.
// Legend: '#' wall, '.' floor, 'C' crate (blocks sight and movement),
// 'B' bush (hides the courier completely), 'S' start, 'E' exit gate,
// 'D' data chip. Guard patrols are listed per floor as tile waypoints.
import { COLS, ROWS } from './config.js';

export const TILE_WALL = '#';
export const TILE_FLOOR = '.';
export const TILE_CRATE = 'C';
export const TILE_BUSH = 'B';
export const TILE_START = 'S';
export const TILE_EXIT = 'E';
export const TILE_CHIP = 'D';

export const LEVELS = [
  {
    name: 'Warehouse Row',
    par: 80,
    map: [
      '##########################',
      '#S....C.....#......D.....#',
      '#.##..C..B...#..###...##.#',
      '#....##......#......#...D#',
      '#.C......##.....B...#..#.#',
      '#..###.......C....###....#',
      '#......B...#....#....C...#',
      '#.##....C....##....##....#',
      '#.....##.....#..D....#...#',
      '#..C......B......##......#',
      '#....###....#..C....##...#',
      '#.B......#.....#......C..#',
      '#..##...C...B.....##.....#',
      '#....D.....##...#....#..E#',
      '#..C....B......C.....#...#',
      '##########################',
    ],
    guards: [
      { path: [[4, 3], [12, 3], [12, 7], [5, 7]], pause: 0.8 },
      { path: [[14, 10], [22, 10], [22, 4], [15, 4]], pause: 1.0 },
    ],
  },
  {
    name: 'The Courtyard',
    par: 80,
    map: [
      '##########################',
      '#....B.....#......D......#',
      '#.S..##..C....##....#..#.#',
      '#..#....#..B....C....#...#',
      '#....C....##..###..B.....#',
      '#.##..B......#....#..D...#',
      '#.....#..C......##....#..#',
      '#..D....##..#..C....#....#',
      '#....###....#.....##..B..#',
      '#.B......C.....##.....#..#',
      '#...##.....B..#....C.....#',
      '#..#...D....##....#..##..#',
      '#....C..##......B....#...#',
      '#.##......#..C....##..D..#',
      '#......B....#......#...E.#',
      '##########################',
    ],
    guards: [
      { path: [[4, 2], [13, 2], [13, 8], [8, 8]], pause: 0.9 },
      { path: [[18, 3], [22, 3], [20, 11], [17, 11]], pause: 1.0 },
      { path: [[4, 12], [10, 12], [10, 6], [4, 6]], pause: 0.8 },
    ],
  },
  {
    name: 'The Vault',
    par: 80,
    map: [
      '##########################',
      '#..D....#......C....#....#',
      '#.##..B....##....#..D..#.#',
      '#S....#..C....B....##....#',
      '#..C....##..#....C....#..#',
      '#....##....#..B....##....#',
      '#.B......C....#..D....#..#',
      '#..###..#..##....#..C....#',
      '#.....B....#...C....##...#',
      '#.##....C.....##..B......#',
      '#....D....##.....#....#..#',
      '#..#..B......C..##..#....#',
      '#....##..C......#....B...#',
      '#.C......#..##....D..#..E#',
      '#..B...#.....#..C....#...#',
      '##########################',
    ],
    guards: [
      { path: [[8, 2], [14, 2], [13, 9], [9, 9]], pause: 0.9 },
      { path: [[18, 4], [21, 4], [22, 12], [18, 12]], pause: 1.0 },
      { path: [[3, 10], [9, 10], [9, 5], [3, 5]], pause: 0.8 },
    ],
  },
];

export function tileAt(grid, tx, ty) {
  if (tx < 0 || ty < 0 || tx >= COLS || ty >= ROWS) return TILE_WALL;
  return grid[ty][tx];
}

export function blocksMove(tile) {
  return tile === TILE_WALL || tile === TILE_CRATE;
}

export function blocksSight(tile) {
  return tile === TILE_WALL || tile === TILE_CRATE;
}

export function walkable(tile) {
  return !blocksMove(tile);
}

// Turn one raw floor into the parsed form the world runs on.
export function parseLevel(index) {
  const def = LEVELS[index];
  const grid = def.map.map((row) => row.split(''));
  const chips = [];
  let start = null;
  let exit = null;
  for (let ty = 0; ty < ROWS; ty += 1) {
    for (let tx = 0; tx < COLS; tx += 1) {
      const tile = grid[ty][tx];
      if (tile === TILE_START) start = { x: tx, y: ty };
      else if (tile === TILE_EXIT) exit = { x: tx, y: ty };
      else if (tile === TILE_CHIP) chips.push({ x: tx, y: ty, taken: false });
    }
  }
  return { name: def.name, par: def.par, grid, start, exit, chips, guards: def.guards };
}

// Breadth-first shortest path over walkable tiles. Returns a list of tile
// centres to walk through (excluding the start tile), or null when blocked.
export function findPath(grid, fromTx, fromTy, toTx, toTy) {
  if (!walkable(tileAt(grid, toTx, toTy))) return null;
  const prev = new Map();
  const key = (x, y) => y * COLS + x;
  const queue = [[fromTx, fromTy]];
  prev.set(key(fromTx, fromTy), null);
  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  while (queue.length > 0) {
    const [cx, cy] = queue.shift();
    if (cx === toTx && cy === toTy) {
      const out = [];
      let cur = key(toTx, toTy);
      while (cur !== null) {
        out.push([cur % COLS, Math.floor(cur / COLS)]);
        cur = prev.get(cur);
      }
      out.reverse();
      out.shift();
      return out;
    }
    for (const [dx, dy] of dirs) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (!walkable(tileAt(grid, nx, ny))) continue;
      const k = key(nx, ny);
      if (prev.has(k)) continue;
      prev.set(k, key(cx, cy));
      queue.push([nx, ny]);
    }
  }
  return null;
}

// Flood-fill from the start: the exit and every chip must be reachable, and
// every guard waypoint must sit on a walkable tile.
export function validateLevel(index) {
  const parsed = parseLevel(index);
  const problems = [];
  const rawRows = LEVELS[index].map;
  if (rawRows.length !== ROWS) problems.push(`rows ${rawRows.length} != ${ROWS}`);
  for (let ty = 0; ty < rawRows.length; ty += 1) {
    if (rawRows[ty].length !== COLS) problems.push(`row ${ty} length ${rawRows[ty].length} != ${COLS}`);
  }
  if (!parsed.start) problems.push('no start tile');
  if (!parsed.exit) problems.push('no exit tile');
  if (problems.length > 0) return problems;
  const seen = new Set();
  const stack = [[parsed.start.x, parsed.start.y]];
  seen.add(parsed.start.y * COLS + parsed.start.x);
  while (stack.length > 0) {
    const [cx, cy] = stack.pop();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (!walkable(tileAt(parsed.grid, nx, ny))) continue;
      const k = ny * COLS + nx;
      if (seen.has(k)) continue;
      seen.add(k);
      stack.push([nx, ny]);
    }
  }
  const reach = (p) => seen.has(p.y * COLS + p.x);
  if (!reach(parsed.exit)) problems.push('exit unreachable');
  for (const chip of parsed.chips) {
    if (!reach(chip)) problems.push(`chip at ${chip.x},${chip.y} unreachable`);
  }
  for (const guard of parsed.guards) {
    for (const [wx, wy] of guard.path) {
      if (!walkable(tileAt(parsed.grid, wx, wy))) problems.push(`guard waypoint ${wx},${wy} not walkable`);
    }
  }
  return problems;
}

export function validateAllLevels() {
  const all = [];
  for (let i = 0; i < LEVELS.length; i += 1) {
    for (const problem of validateLevel(i)) all.push(`level ${i + 1}: ${problem}`);
  }
  return all;
}
