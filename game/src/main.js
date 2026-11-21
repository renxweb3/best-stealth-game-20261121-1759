// Shadow Courier — boot and the one loop. Input is read every frame, the world
// advances in fixed 1/60 s steps, and the renderer paints what is there. The
// game moves between five screens: title, play, level-clear, victory, caught.
//
// ?seed=N fixes the decorative random. ?shot=start|play|win|caught (with
// &seed=N) stages that scene instead of running the loop, paints it twice and
// sets window.__shotReady for a screenshot.
import { STEP } from './config.js';
import { createRandom } from './random.js';
import {
  EVENT_CAUGHT,
  EVENT_CLEAR,
  EVENT_PICKUP,
  EVENT_SPOTTED,
  EVENT_WIN,
  createWorld,
} from './world.js';
import { ACTION_CONFIRM, ACTION_MUTE, ACTION_RESTART, createInput } from './input.js';
import { createAudio } from './audio.js';
import {
  SCREEN_CAUGHT,
  SCREEN_CLEAR,
  SCREEN_PLAY,
  SCREEN_TITLE,
  SCREEN_WIN,
  createRenderer,
} from './render.js';
import { stageShot } from './shots.js';

const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);
const audio = createAudio();

function runShot(name) {
  const staged = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, staged.screen, { result: staged.result, muted: false });
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let result = { score: 0, chips: 0, totalChips: 14, alerts: 0, time: 0, rank: '' };
  let accumulator = 0;
  let last = performance.now();

  function announce(message) {
    status.textContent = message;
  }

  function beginRun() {
    world.resetRun();
    screen = SCREEN_PLAY;
    announce(`Playing ${world.state.level.name}. Collect the chips, reach the exit unseen.`);
  }

  function showClear() {
    screen = SCREEN_CLEAR;
    audio.clear();
    announce(`Level clear. Bonus ${world.state.levelBonus}. Press Enter for the next floor.`);
  }

  function showWin() {
    result = world.state.result;
    screen = SCREEN_WIN;
    audio.win();
    announce(`Clean getaway. Rank ${result.rank}. Final score ${result.score}.`);
  }

  function showCaught() {
    result = {
      score: world.state.score,
      chips: world.state.chipsGot,
      totalChips: world.state.chipsTotal,
      alerts: world.state.alerts,
      time: world.state.totalTime,
      rank: '',
    };
    screen = SCREEN_CAUGHT;
    audio.caught();
    announce('Caught. Press R to retry the floor, Enter for a fresh run.');
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_MUTE) {
      const muted = audio.toggleMute();
      announce(muted ? 'Muted.' : 'Sound on.');
    }
    if (actions & ACTION_RESTART && (screen === SCREEN_PLAY || screen === SCREEN_CAUGHT)) {
      world.loadLevel(world.state.levelIndex);
      screen = SCREEN_PLAY;
      announce(`Floor restarted: ${world.state.level.name}.`);
      return;
    }
    if (actions & ACTION_CONFIRM) {
      audio.resume();
      if (screen === SCREEN_TITLE || screen === SCREEN_WIN) beginRun();
      else if (screen === SCREEN_CLEAR) screen = SCREEN_PLAY;
      else if (screen === SCREEN_CAUGHT) beginRun();
    }
  }

  function stepWorld() {
    const dir = input.direction();
    const events = world.step(STEP, dir);
    if (events & EVENT_PICKUP) audio.pickup();
    if (events & EVENT_SPOTTED) audio.spotted();
    if (events & EVENT_CAUGHT) showCaught();
    else if (events & EVENT_WIN) showWin();
    else if (events & EVENT_CLEAR) showClear();
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (screen === SCREEN_PLAY) {
      while (accumulator >= STEP && screen === SCREEN_PLAY) {
        stepWorld();
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(world.state, screen, { result, muted: audio.isMuted() });
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      announce('Tab hidden — the guards wait for you.');
    }
  });

  announce('Shadow Courier. Press Enter or click to begin.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
