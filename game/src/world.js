// Shadow Courier — the rules, with no drawing and no browser in it: the
// courier, the guards and their senses, chips, the exit gate, score and time.
// step() advances one fixed step and returns what happened as bit flags, so the
// caller can react (and play sounds) without the world knowing about screens.
import {
  ALERT_DECAY,
  ALERT_PENALTY,
  BONUS_PAR_SECS,
  BONUS_PER_SEC,
  CATCH_DIST,
  CHIP_POINTS,
  COLS,
  CONE_HALF_DEG,
  CONE_RANGE,
  DETECT_SNEAK,
  DETECT_WALK,
  GUARD_CHASE_SPEED,
  GUARD_PATROL_SPEED,
  GUARD_RETURN_SPEED,
  GUARD_SEARCH_SPEED,
  INVESTIGATE_SECS,
  LOSE_SIGHT_SECS,
  ORIGIN_X,
  ORIGIN_Y,
  PICKUP_DIST,
  PLAYER_R,
  ROWS,
  SNEAK_SPEED,
  SUSPICIOUS_AT,
  TILE,
  WALK_SPEED,
} from './config.js';
import {
  TILE_BUSH,
  blocksMove,
  blocksSight,
  findPath,
  parseLevel,
  tileAt,
  walkable,
} from './levels.js';

export const EVENT_PICKUP = 1;
export const EVENT_SPOTTED = 2;
export const EVENT_CAUGHT = 4;
export const EVENT_CLEAR = 8;
export const EVENT_WIN = 16;

export function tileCenterX(tx) {
  return ORIGIN_X + tx * TILE + TILE / 2;
}

export function tileCenterY(ty) {
  return ORIGIN_Y + ty * TILE + TILE / 2;
}

export function tileOf(px, py) {
  return {
    x: Math.floor((px - ORIGIN_X) / TILE),
    y: Math.floor((py - ORIGIN_Y) / TILE),
  };
}

function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

function dist(ax, ay, bx, by) {
  return Math.hypot(ax - bx, ay - by);
}

// Does this guard's eye line to (px, py) stay clear of walls and crates?
export function lineClear(grid, ax, ay, bx, by) {
  const steps = Math.ceil(dist(ax, ay, bx, by) / 6);
  for (let i = 1; i < steps; i += 1) {
    const x = ax + ((bx - ax) * i) / steps;
    const y = ay + ((by - ay) * i) / steps;
    const t = tileOf(x, y);
    if (blocksSight(tileAt(grid, t.x, t.y))) return false;
  }
  return true;
}

// Can this guard see the point right now? Bushes hide the courier fully.
export function guardSeesPoint(world, guard, px, py) {
  const grid = world.level.grid;
  const here = tileOf(px, py);
  if (tileAt(grid, here.x, here.y) === TILE_BUSH) return false;
  const d = dist(guard.x, guard.y, px, py);
  if (d > CONE_RANGE) return false;
  const aim = Math.atan2(py - guard.y, px - guard.x);
  const half = (CONE_HALF_DEG * Math.PI) / 180;
  if (Math.abs(angleDiff(aim, guard.angle)) > half) return false;
  return lineClear(grid, guard.x, guard.y, px, py);
}

// Would a guard standing at (gx, gy) facing `angle` see this tile's centre?
// The autopilot uses it to plan routes that stay out of the cones.
export function coneCoversTile(grid, gx, gy, angle, tx, ty) {
  const px = tileCenterX(tx);
  const py = tileCenterY(ty);
  if (dist(gx, gy, px, py) > CONE_RANGE) return false;
  const aim = Math.atan2(py - gy, px - gx);
  const half = (CONE_HALF_DEG * Math.PI) / 180;
  if (Math.abs(angleDiff(aim, angle)) > half) return false;
  return lineClear(grid, gx, gy, px, py);
}

function moveThroughWalls(world, body, dx, dy) {
  const grid = world.level.grid;
  const r = body.r;
  let nx = body.x + dx;
  const top = Math.floor((body.y - r - ORIGIN_Y) / TILE);
  const bottom = Math.floor((body.y + r - ORIGIN_Y) / TILE);
  if (dx > 0) {
    const col = Math.floor((nx + r - ORIGIN_X) / TILE);
    for (let ty = top; ty <= bottom; ty += 1) {
      if (blocksMove(tileAt(grid, col, ty))) {
        nx = ORIGIN_X + col * TILE - r - 0.01;
        break;
      }
    }
  } else if (dx < 0) {
    const col = Math.floor((nx - r - ORIGIN_X) / TILE);
    for (let ty = top; ty <= bottom; ty += 1) {
      if (blocksMove(tileAt(grid, col, ty))) {
        nx = ORIGIN_X + (col + 1) * TILE + r + 0.01;
        break;
      }
    }
  }
  body.x = nx;
  let ny = body.y + dy;
  const left = Math.floor((body.x - r - ORIGIN_X) / TILE);
  const right = Math.floor((body.x + r - ORIGIN_X) / TILE);
  if (dy > 0) {
    const row = Math.floor((ny + r - ORIGIN_Y) / TILE);
    for (let tx = left; tx <= right; tx += 1) {
      if (blocksMove(tileAt(grid, tx, row))) {
        ny = ORIGIN_Y + row * TILE - r - 0.01;
        break;
      }
    }
  } else if (dy < 0) {
    const row = Math.floor((ny - r - ORIGIN_Y) / TILE);
    for (let tx = left; tx <= right; tx += 1) {
      if (blocksMove(tileAt(grid, tx, row))) {
        ny = ORIGIN_Y + (row + 1) * TILE + r + 0.01;
        break;
      }
    }
  }
  body.y = ny;
}

export function createWorld() {
  const state = {
    levelIndex: 0,
    level: null,
    player: { x: 0, y: 0, r: PLAYER_R, sneaking: false, hidden: false, face: 0 },
    guards: [],
    score: 0,
    chipsGot: 0,
    chipsTotal: 0,
    alerts: 0,
    levelTime: 0,
    totalTime: 0,
    heat: 0,
    toast: '',
    toastT: 0,
    levelBonus: 0,
    result: null,
  };

  function loadLevel(index) {
    const level = parseLevel(index);
    state.levelIndex = index;
    state.level = level;
    state.player.x = tileCenterX(level.start.x);
    state.player.y = tileCenterY(level.start.y);
    state.player.face = 0;
    state.player.sneaking = false;
    state.guards = level.guards.map((def) => {
      const first = def.path[0];
      const second = def.path[1] ?? first;
      return {
        x: tileCenterX(first[0]),
        y: tileCenterY(first[1]),
        r: 13,
        angle: Math.atan2(tileCenterY(second[1]) - tileCenterY(first[1]), tileCenterX(second[0]) - tileCenterX(first[0])),
        state: 'patrol',
        alertness: 0,
        path: def.path,
        pathIdx: 1 % def.path.length,
        pauseT: 0,
        pause: def.pause,
        lastSeen: { x: tileCenterX(first[0]), y: tileCenterY(first[1]) },
        loseT: 0,
        lookT: 0,
        route: null,
        repathT: 0,
        scanDir: 1,
      };
    });
    state.levelTime = 0;
    state.levelBonus = 0;
    state.heat = 0;
  }

  function resetRun() {
    state.score = 0;
    state.chipsGot = 0;
    state.alerts = 0;
    state.totalTime = 0;
    state.result = null;
    state.chipsTotal = 0;
    for (let i = 0; i < 3; i += 1) state.chipsTotal += parseLevel(i).chips.length;
    loadLevel(0);
  }

  function setToast(text) {
    state.toast = text;
    state.toastT = 2.2;
  }

  function walkGuard(guard, tx, ty, speed, dt) {
    const cx = tileCenterX(tx);
    const cy = tileCenterY(ty);
    const dx = cx - guard.x;
    const dy = cy - guard.y;
    const d = Math.hypot(dx, dy);
    if (d < 4) return true;
    const stepLen = Math.min(d, speed * dt);
    guard.x += (dx / d) * stepLen;
    guard.y += (dy / d) * stepLen;
    guard.angle = Math.atan2(dy, dx);
    return d - stepLen < 4;
  }

  function followRoute(guard, speed, dt) {
    if (!guard.route || guard.route.length === 0) return true;
    const [tx, ty] = guard.route[0];
    if (walkGuard(guard, tx, ty, speed, dt)) guard.route.shift();
    return guard.route.length === 0;
  }

  function updateGuard(guard, dt, events) {
    const player = state.player;
    const sees = guardSeesPoint({ level: state.level }, guard, player.x, player.y);
    if (sees) {
      const d = dist(guard.x, guard.y, player.x, player.y);
      const closeness = 1.6 - d / CONE_RANGE;
      const rate = (player.sneaking ? DETECT_SNEAK : DETECT_WALK) * Math.max(0.35, closeness);
      guard.alertness = Math.min(1, guard.alertness + rate * dt);
      guard.lastSeen.x = player.x;
      guard.lastSeen.y = player.y;
      guard.loseT = 0;
      if (guard.alertness >= 1 && guard.state !== 'alert') {
        guard.state = 'alert';
        state.alerts += 1;
        state.score = Math.max(0, state.score - ALERT_PENALTY);
        events.value |= EVENT_SPOTTED;
        setToast('SPOTTED! Break line of sight!');
      } else if (guard.alertness >= SUSPICIOUS_AT && guard.state === 'patrol') {
        guard.state = 'suspicious';
      }
    } else {
      guard.alertness = Math.max(0, guard.alertness - ALERT_DECAY * dt);
      if (guard.state === 'alert') {
        guard.loseT += dt;
        if (guard.loseT > LOSE_SIGHT_SECS) {
          guard.state = 'investigate';
          guard.route = null;
          guard.lookT = 0;
        }
      } else if (guard.state === 'suspicious' && guard.alertness < 0.15) {
        guard.state = 'patrol';
      }
    }

    if (guard.state === 'patrol') {
      if (guard.pauseT > 0) {
        guard.pauseT -= dt;
        guard.angle += guard.scanDir * 0.55 * dt;
        if (guard.angle > Math.PI) guard.scanDir = -1;
        if (guard.angle < -Math.PI) guard.scanDir = 1;
      } else {
        const target = guard.path[guard.pathIdx];
        if (walkGuard(guard, target[0], target[1], GUARD_PATROL_SPEED, dt)) {
          guard.pathIdx = (guard.pathIdx + 1) % guard.path.length;
          guard.pauseT = guard.pause;
        }
      }
    } else if (guard.state === 'suspicious') {
      guard.angle = Math.atan2(player.y - guard.y, player.x - guard.x);
    } else if (guard.state === 'alert') {
      guard.repathT -= dt;
      const here = tileOf(guard.x, guard.y);
      const there = tileOf(player.x, player.y);
      const close = dist(guard.x, guard.y, player.x, player.y) < 80;
      if (close) {
        const dx = player.x - guard.x;
        const dy = player.y - guard.y;
        const d = Math.hypot(dx, dy) || 1;
        const stepLen = GUARD_CHASE_SPEED * dt;
        moveThroughWalls({ level: state.level }, guard, (dx / d) * stepLen, (dy / d) * stepLen);
        guard.angle = Math.atan2(dy, dx);
      } else {
        if (guard.repathT <= 0 || !guard.route) {
          guard.route = findPath(state.level.grid, here.x, here.y, there.x, there.y);
          guard.repathT = 0.3;
        }
        followRoute(guard, GUARD_CHASE_SPEED, dt);
      }
      if (dist(guard.x, guard.y, player.x, player.y) < CATCH_DIST) {
        events.value |= EVENT_CAUGHT;
      }
    } else if (guard.state === 'investigate') {
      const here = tileOf(guard.x, guard.y);
      const there = tileOf(guard.lastSeen.x, guard.lastSeen.y);
      if (!guard.route) guard.route = findPath(state.level.grid, here.x, here.y, there.x, there.y);
      if (followRoute(guard, GUARD_SEARCH_SPEED, dt)) {
        guard.lookT += dt;
        guard.angle += 1.6 * dt;
        if (guard.lookT > INVESTIGATE_SECS) {
          guard.state = 'return';
          guard.route = null;
        }
      }
    } else if (guard.state === 'return') {
      if (!guard.route) {
        let best = null;
        let bestD = Infinity;
        const here = tileOf(guard.x, guard.y);
        for (const [wx, wy] of guard.path) {
          const route = findPath(state.level.grid, here.x, here.y, wx, wy);
          if (route && route.length < bestD) {
            bestD = route.length;
            best = route;
            guard.pathIdx = guard.path.findIndex((p) => p[0] === wx && p[1] === wy);
          }
        }
        guard.route = best;
      }
      if (followRoute(guard, GUARD_RETURN_SPEED, dt)) {
        guard.state = 'patrol';
        guard.alertness = 0;
      }
    }
    return events.value;
  }

  // One fixed step. `input` is { mx, my, sneak }. Returns event bit flags.
  function step(dt, input) {
    const events = { value: 0 };
    state.levelTime += dt;
    state.totalTime += dt;
    if (state.toastT > 0) state.toastT -= dt;

    const player = state.player;
    const speed = input.sneak ? SNEAK_SPEED : WALK_SPEED;
    player.sneaking = input.sneak;
    const len = Math.hypot(input.mx, input.my);
    if (len > 0.01) {
      const nx = (input.mx / Math.max(1, len)) * speed * dt;
      const ny = (input.my / Math.max(1, len)) * speed * dt;
      moveThroughWalls(state, player, nx, ny);
      player.face = Math.atan2(input.my, input.mx);
    }
    const pTile = tileOf(player.x, player.y);
    player.hidden = tileAt(state.level.grid, pTile.x, pTile.y) === TILE_BUSH;

    for (const chip of state.level.chips) {
      if (chip.taken) continue;
      if (dist(player.x, player.y, tileCenterX(chip.x), tileCenterY(chip.y)) < PICKUP_DIST) {
        chip.taken = true;
        state.chipsGot += 1;
        state.score += CHIP_POINTS;
        events.value |= EVENT_PICKUP;
        setToast(`Data chip secured (${state.chipsGot}/${state.chipsTotal})`);
      }
    }

    for (const guard of state.guards) updateGuard(guard, dt, events);
    state.heat = state.guards.reduce((m, g) => Math.max(m, g.alertness), 0);
    if (events.value & EVENT_CAUGHT) return events.value;

    const allChips = state.level.chips.every((c) => c.taken);
    const exit = state.level.exit;
    if (
      allChips &&
      Math.abs(player.x - tileCenterX(exit.x)) < TILE / 2 &&
      Math.abs(player.y - tileCenterY(exit.y)) < TILE / 2
    ) {
      const bonus = Math.max(0, Math.round((BONUS_PAR_SECS - state.levelTime) * BONUS_PER_SEC));
      state.levelBonus = bonus;
      state.score += bonus;
      if (state.levelIndex + 1 >= 3) {
        events.value |= EVENT_WIN;
        state.result = finishResult();
      } else {
        events.value |= EVENT_CLEAR;
        loadLevel(state.levelIndex + 1);
        setToast(`${state.level.name} — stay low, courier.`);
      }
    }
    return events.value;
  }

  function rankFor(result) {
    if (result.alerts === 0 && result.chips === result.totalChips) return 'S — GHOST';
    if (result.alerts === 0) return 'A — UNSEEN';
    if (result.alerts <= 2) return 'B — SHADOW';
    return 'C — LOUD';
  }

  function finishResult() {
    const result = {
      score: state.score,
      chips: state.chipsGot,
      totalChips: state.chipsTotal,
      alerts: state.alerts,
      time: state.totalTime,
      rank: '',
    };
    result.rank = rankFor(result);
    return result;
  }

  resetRun();
  return {
    state,
    resetRun,
    loadLevel,
    step,
    tileOf,
    guardSeesPoint: (guard, px, py) => guardSeesPoint({ level: state.level }, guard, px, py),
  };
}

export { COLS, ROWS };
