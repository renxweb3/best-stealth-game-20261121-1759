// Shadow Courier — keyboard and mouse. Held keys steer; the actions are edge
// triggered, so one press is one confirm, one restart, one mute toggle.
export const ACTION_CONFIRM = 1;
export const ACTION_RESTART = 2;
export const ACTION_MUTE = 4;

const MOVE_KEYS = {
  KeyW: [0, -1],
  ArrowUp: [0, -1],
  KeyS: [0, 1],
  ArrowDown: [0, 1],
  KeyA: [-1, 0],
  ArrowLeft: [-1, 0],
  KeyD: [1, 0],
  ArrowRight: [1, 0],
};

export function createInput(canvas) {
  const held = new Set();
  const edges = new Set();
  let clicked = false;

  function onKeyDown(event) {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) event.preventDefault();
    if (!event.repeat) {
      if (event.code === 'Enter' || event.code === 'Space') edges.add(ACTION_CONFIRM);
      else if (event.code === 'KeyR') edges.add(ACTION_RESTART);
      else if (event.code === 'KeyM') edges.add(ACTION_MUTE);
    }
    held.add(event.code);
  }

  function onKeyUp(event) {
    held.delete(event.code);
  }

  function onClick() {
    clicked = true;
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  canvas.addEventListener('pointerdown', onClick);

  function direction() {
    let mx = 0;
    let my = 0;
    for (const code of held) {
      const d = MOVE_KEYS[code];
      if (d) {
        mx += d[0];
        my += d[1];
      }
    }
    return { mx, my, sneak: held.has('ShiftLeft') || held.has('ShiftRight') };
  }

  function takeActions() {
    let out = 0;
    for (const edge of edges) out |= edge;
    edges.clear();
    if (clicked) {
      out |= ACTION_CONFIRM;
      clicked = false;
    }
    return out;
  }

  return { direction, takeActions };
}
