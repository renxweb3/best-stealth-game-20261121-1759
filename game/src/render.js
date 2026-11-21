// Shadow Courier — everything the eye sees: the floor, the cones, the guards,
// the courier, the HUD and the five screens. Pure canvas, no images, no fonts
// beyond the system stack. It never touches the rules; it only paints state.
import {
  COLS,
  CONE_HALF_DEG,
  CONE_RANGE,
  ORIGIN_X,
  ORIGIN_Y,
  ROWS,
  TILE,
  TOTAL_CHIPS,
  SUSPICIOUS_AT,  VIEW_H,
  VIEW_W,
} from './config.js';
import { TILE_BUSH, TILE_CHIP, TILE_CRATE, TILE_EXIT, TILE_START, TILE_WALL, tileAt } from './levels.js';
import { tileCenterX, tileCenterY } from './world.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_CLEAR = 'clear';
export const SCREEN_WIN = 'win';
export const SCREEN_CAUGHT = 'caught';

function hashDot(tx, ty) {
  let h = (tx * 374761393 + ty * 668265263) | 0;
  h = (h ^ (h >> 13)) | 0;
  return ((h * 1274126177) >> 8) & 255;
}

function conePath(ctx, guard) {
  const half = (CONE_HALF_DEG * Math.PI) / 180;
  ctx.beginPath();
  ctx.moveTo(guard.x, guard.y);
  ctx.arc(guard.x, guard.y, CONE_RANGE, guard.angle - half, guard.angle + half);
  ctx.closePath();
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  canvas.width = VIEW_W;
  canvas.height = VIEW_H;

  function drawFloor(state) {
    const grid = state.level.grid;
    for (let ty = 0; ty < ROWS; ty += 1) {
      for (let tx = 0; tx < COLS; tx += 1) {
        const x = ORIGIN_X + tx * TILE;
        const y = ORIGIN_Y + ty * TILE;
        const tile = grid[ty][tx];
        const shade = (tx + ty) % 2 === 0 ? '#232a33' : '#20262e';
        ctx.fillStyle = tile === TILE_WALL ? '#12161d' : shade;
        ctx.fillRect(x, y, TILE, TILE);
        if (tile === TILE_WALL) {
          ctx.fillStyle = '#2e3742';
          ctx.fillRect(x, y, TILE, 5);
          ctx.fillStyle = '#1a2029';
          ctx.fillRect(x + 6, y + 12, TILE - 12, TILE - 18);
        } else {
          const dot = hashDot(tx, ty);
          ctx.fillStyle = 'rgba(255,255,255,0.045)';
          ctx.fillRect(x + 6 + (dot % 24), y + 8 + ((dot >> 3) % 22), 2, 2);
        }
        if (tile === TILE_CRATE) {
          ctx.fillStyle = '#7a5a33';
          ctx.fillRect(x + 4, y + 4, TILE - 8, TILE - 8);
          ctx.strokeStyle = '#543d20';
          ctx.lineWidth = 2;
          ctx.strokeRect(x + 4, y + 4, TILE - 8, TILE - 8);
          ctx.beginPath();
          ctx.moveTo(x + 4, y + 4);
          ctx.lineTo(x + TILE - 4, y + TILE - 4);
          ctx.moveTo(x + TILE - 4, y + 4);
          ctx.lineTo(x + 4, y + TILE - 4);
          ctx.stroke();
        } else if (tile === TILE_BUSH) {
          ctx.fillStyle = '#2c5a2e';
          ctx.beginPath();
          ctx.arc(x + 12, y + 16, 11, 0, Math.PI * 2);
          ctx.arc(x + 26, y + 12, 12, 0, Math.PI * 2);
          ctx.arc(x + 22, y + 28, 10, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#3f7a42';
          ctx.beginPath();
          ctx.arc(x + 14, y + 14, 5, 0, Math.PI * 2);
          ctx.arc(x + 27, y + 24, 4, 0, Math.PI * 2);
          ctx.fill();
        } else if (tile === TILE_EXIT) {
          const pulse = 0.5 + 0.5 * Math.sin(Date.now() / 280);
          ctx.fillStyle = `rgba(46, 204, 113, ${0.25 + pulse * 0.25})`;
          ctx.fillRect(x + 2, y + 2, TILE - 4, TILE - 4);
          ctx.strokeStyle = '#2ecc71';
          ctx.lineWidth = 2;
          ctx.strokeRect(x + 2, y + 2, TILE - 4, TILE - 4);
          ctx.fillStyle = '#a9f5c9';
          ctx.font = 'bold 11px system-ui, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('EXIT', x + TILE / 2, y + TILE / 2 + 4);
        } else if (tile === TILE_START) {
          ctx.fillStyle = 'rgba(52, 152, 219, 0.25)';
          ctx.fillRect(x + 2, y + 2, TILE - 4, TILE - 4);
        }
      }
    }
    ctx.strokeStyle = '#0c0f13';
    ctx.lineWidth = 3;
    ctx.strokeRect(ORIGIN_X, ORIGIN_Y, COLS * TILE, ROWS * TILE);
  }

  function drawChips(state) {
    const t = Date.now() / 400;
    for (const chip of state.level.chips) {
      if (chip.taken) continue;
      const cx = tileCenterX(chip.x);
      const cy = tileCenterY(chip.y);
      const bob = Math.sin(t + chip.x) * 3;
      ctx.save();
      ctx.translate(cx, cy + bob);
      ctx.rotate(Math.PI / 4);
      ctx.fillStyle = '#19d3e6';
      ctx.shadowColor = '#19d3e6';
      ctx.shadowBlur = 12;
      ctx.fillRect(-7, -7, 14, 14);
      ctx.restore();
      ctx.fillStyle = '#0b3d44';
      ctx.font = 'bold 9px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('DATA', cx, cy + bob + 3);
    }
  }

  function drawGuards(state) {
    for (const guard of state.guards) {
      const colour = guard.state === 'alert' ? 'rgba(231, 76, 60, 0.30)' : guard.state === 'suspicious' ? 'rgba(243, 156, 18, 0.28)' : 'rgba(241, 196, 15, 0.20)';
      ctx.fillStyle = colour;
      conePath(ctx, guard);
      ctx.fill();
      ctx.strokeStyle = colour.replace(/0\.\d+\)/, '0.55)');
      ctx.lineWidth = 1;
      ctx.stroke();
      // Body: a lamplit watchman, dark coat against the floor.
      ctx.fillStyle = '#c0392b';
      ctx.beginPath();
      ctx.arc(guard.x, guard.y, guard.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#f5d76e';
      ctx.beginPath();
      ctx.arc(guard.x, guard.y, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#2c1a12';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(guard.x, guard.y);
      ctx.lineTo(guard.x + Math.cos(guard.angle) * 18, guard.y + Math.sin(guard.angle) * 18);
      ctx.stroke();
      // Alertness ring + the ? / ! that tells the player what the guard knows.
      if (guard.alertness > 0.02) {
        ctx.strokeStyle = guard.alertness >= 1 ? '#e74c3c' : '#f39c12';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(guard.x, guard.y, 19, -Math.PI / 2, -Math.PI / 2 + guard.alertness * Math.PI * 2);
        ctx.stroke();
      }
      if (guard.state === 'suspicious' || guard.state === 'investigate') {
        ctx.fillStyle = '#f39c12';
        ctx.font = 'bold 22px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('?', guard.x, guard.y - 24);
      } else if (guard.state === 'alert') {
        ctx.fillStyle = '#ff5a4d';
        ctx.font = 'bold 24px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('!', guard.x, guard.y - 24);
      }
    }
  }

  function drawPlayer(state) {
    const p = state.player;
    ctx.save();
    if (p.hidden) ctx.globalAlpha = 0.45;
    ctx.fillStyle = '#16a085';
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#0e6655';
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x + Math.cos(p.face + 2.5) * (p.r + 4), p.y + Math.sin(p.face + 2.5) * (p.r + 4));
    ctx.lineTo(p.x + Math.cos(p.face - 2.5) * (p.r + 4), p.y + Math.sin(p.face - 2.5) * (p.r + 4));
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#eafaf1';
    ctx.beginPath();
    ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
    ctx.fill();
    if (p.sneaking) {
      ctx.strokeStyle = '#a9f5c9';
      ctx.setLineDash([3, 4]);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r + 5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.restore();
    if (p.hidden) {
      ctx.fillStyle = '#a9f5c9';
      ctx.font = 'bold 11px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('HIDDEN', p.x, p.y - 20);
    }
  }

  function drawHud(state, screen, extra) {
    ctx.fillStyle = '#10141a';
    ctx.fillRect(0, 0, VIEW_W, 58);
    ctx.fillStyle = '#e8eef4';
    ctx.font = 'bold 17px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`SHADOW COURIER — ${state.level.name}`, 16, 24);
    ctx.font = '15px system-ui, sans-serif';
    ctx.fillStyle = '#9fb3c8';
    ctx.fillText(`CHIPS ${state.chipsGot}/${TOTAL_CHIPS}    SCORE ${state.score}    TIME ${state.levelTime.toFixed(1)}s`, 16, 46);
    // HEAT meter, right aligned inside its own box so the label never clips.
    const hx = VIEW_W - 320;
    ctx.fillStyle = '#1d242e';
    ctx.fillRect(hx, 12, 300, 34);
    ctx.fillStyle = state.heat >= 1 ? '#e74c3c' : state.heat >= SUSPICIOUS_AT ? '#f39c12' : '#2ecc71';
    ctx.fillRect(hx + 4, 16, 200 * Math.min(1, state.heat), 26);
    ctx.strokeStyle = '#3a4656';
    ctx.lineWidth = 1;
    ctx.strokeRect(hx + 4, 16, 200, 26);
    ctx.fillStyle = '#e8eef4';
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.textAlign = 'right';
    const label = state.heat >= 1 ? 'SPOTTED' : state.heat >= 0.4 ? 'SUSPICIOUS' : state.player.hidden ? 'HIDDEN' : 'UNSEEN';
    ctx.fillText(label, hx + 296, 34);
    ctx.textAlign = 'left';
    if (screen === SCREEN_PLAY) {
      ctx.fillStyle = '#7e8fa3';
      ctx.font = '13px system-ui, sans-serif';
      ctx.fillText('WASD / arrows move · SHIFT sneak · R restart level · M mute', 16, VIEW_H - 12);
    }
    if (state.toastT > 0 && state.toast) {
      ctx.fillStyle = 'rgba(16, 20, 26, 0.85)';
      const w = ctx.measureText(state.toast).width + 28;
      ctx.fillRect((VIEW_W - w) / 2, 66, w, 30);
      ctx.fillStyle = '#ffe08a';
      ctx.font = 'bold 15px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(state.toast, VIEW_W / 2, 86);
      ctx.textAlign = 'left';
    }
    if (extra.muted) {
      ctx.fillStyle = '#7e8fa3';
      ctx.font = '13px system-ui, sans-serif';
      ctx.fillText('MUTED', VIEW_W - 70, VIEW_H - 12);
    }
  }

  function redFlash(state) {
    if (state.heat <= 0.4) return;
    const a = Math.min(0.5, (state.heat - 0.4) * 0.7);
    const grad = ctx.createRadialGradient(VIEW_W / 2, VIEW_H / 2, VIEW_H / 3, VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.75);
    grad.addColorStop(0, 'rgba(231, 76, 60, 0)');
    grad.addColorStop(1, `rgba(231, 76, 60, ${a})`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  }

  function panel(lines) {
    ctx.fillStyle = 'rgba(10, 13, 18, 0.82)';
    ctx.fillRect(240, 130, VIEW_W - 480, VIEW_H - 260);
    ctx.strokeStyle = '#3a4656';
    ctx.lineWidth = 2;
    ctx.strokeRect(240, 130, VIEW_W - 480, VIEW_H - 260);
    ctx.textAlign = 'center';
    let y = 190;
    for (const line of lines) {
      ctx.fillStyle = line.colour;
      ctx.font = line.font;
      ctx.fillText(line.text, VIEW_W / 2, y);
      y += line.gap;
    }
    ctx.textAlign = 'left';
  }

  function drawTitle(state) {
    drawFloor(state);
    drawChips(state);
    drawGuards(state);
    ctx.fillStyle = 'rgba(8, 10, 14, 0.72)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    panel([
      { text: 'SHADOW COURIER', colour: '#eafaf1', font: 'bold 54px system-ui, sans-serif', gap: 66 },
      { text: 'A top-down stealth game — steal the data, dodge the cones, vanish.', colour: '#9fb3c8', font: '19px system-ui, sans-serif', gap: 40 },
      { text: `3 floors · ${TOTAL_CHIPS} data chips · guards patrol, suspect, chase`, colour: '#c8d6e2', font: '17px system-ui, sans-serif', gap: 34 },
      { text: 'Bushes hide you. Crates block their sight. Sneak with SHIFT.', colour: '#c8d6e2', font: '17px system-ui, sans-serif', gap: 44 },
      { text: 'WASD / arrows to move · SHIFT sneak · R restart · M mute', colour: '#7e8fa3', font: '15px system-ui, sans-serif', gap: 52 },
      { text: 'Press ENTER or click to begin', colour: '#ffe08a', font: 'bold 21px system-ui, sans-serif', gap: 0 },
    ]);
  }

  function drawClear(state) {
    drawFloor(state);
    drawChips(state);
    drawGuards(state);
    drawPlayer(state);
    ctx.fillStyle = 'rgba(8, 10, 14, 0.66)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    panel([
      { text: 'LEVEL CLEAR', colour: '#2ecc71', font: 'bold 46px system-ui, sans-serif', gap: 60 },
      { text: `${state.level.name} — time bonus +${state.levelBonus}`, colour: '#e8eef4', font: '20px system-ui, sans-serif', gap: 36 },
      { text: `Score ${state.score} · Chips ${state.chipsGot}/${TOTAL_CHIPS}`, colour: '#9fb3c8', font: '18px system-ui, sans-serif', gap: 50 },
      { text: 'Press ENTER for the next floor', colour: '#ffe08a', font: 'bold 20px system-ui, sans-serif', gap: 0 },
    ]);
  }

  function drawWin(state, result) {
    drawFloor(state);
    ctx.fillStyle = 'rgba(8, 10, 14, 0.78)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    panel([
      { text: 'CLEAN GETAWAY!', colour: '#2ecc71', font: 'bold 48px system-ui, sans-serif', gap: 62 },
      { text: `RANK ${result.rank}`, colour: '#ffe08a', font: 'bold 34px system-ui, sans-serif', gap: 52 },
      { text: `Final score ${result.score}  ·  Chips ${result.chips}/${result.totalChips}`, colour: '#e8eef4', font: '20px system-ui, sans-serif', gap: 36 },
      { text: `Times spotted ${result.alerts}  ·  Total time ${result.time.toFixed(1)}s`, colour: '#9fb3c8', font: '19px system-ui, sans-serif', gap: 48 },
      { text: 'Every chip stolen. No guard ever knew your name.', colour: '#c8d6e2', font: '17px system-ui, sans-serif', gap: 52 },
      { text: 'Press ENTER to run it again', colour: '#ffe08a', font: 'bold 19px system-ui, sans-serif', gap: 0 },
    ]);
  }

  function drawCaught(state, result) {
    drawFloor(state);
    drawChips(state);
    drawGuards(state);
    drawPlayer(state);
    ctx.fillStyle = 'rgba(60, 8, 8, 0.55)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    panel([
      { text: 'CAUGHT!', colour: '#ff6b5e', font: 'bold 52px system-ui, sans-serif', gap: 62 },
      { text: 'A guard got a hand on the courier.', colour: '#e8eef4', font: '20px system-ui, sans-serif', gap: 38 },
      { text: `Score ${result.score} · Chips ${result.chips}/${result.totalChips} · Times spotted ${result.alerts}`, colour: '#9fb3c8', font: '18px system-ui, sans-serif', gap: 50 },
      { text: 'R — retry this floor      ENTER — fresh run', colour: '#ffe08a', font: 'bold 20px system-ui, sans-serif', gap: 0 },
    ]);
  }

  function draw(state, screen, extra) {
    ctx.clearRect(0, 0, VIEW_W, VIEW_H);
    ctx.fillStyle = '#0d1117';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    if (screen === SCREEN_TITLE) drawTitle(state);
    else if (screen === SCREEN_CLEAR) drawClear(state);
    else if (screen === SCREEN_WIN) drawWin(state, extra.result);
    else if (screen === SCREEN_CAUGHT) drawCaught(state, extra.result);
    else {
      drawFloor(state);
      drawChips(state);
      drawGuards(state);
      drawPlayer(state);
    }
    drawHud(state, screen, extra);
    if (screen === SCREEN_PLAY || screen === SCREEN_CAUGHT) redFlash(state);
  }

  return { draw };
}
