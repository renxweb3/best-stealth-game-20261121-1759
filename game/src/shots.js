// Shadow Courier — staged scenes for the screenshots. Each one poses the real
// world in a real state and hands it to the real renderer, so every screenshot
// is a render of the game's own code: the title, a mid-floor sneak past a
// suspicious guard, the ghost-run victory, and the caught screen.
import { SCREEN_CAUGHT, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';
import { tileCenterX, tileCenterY } from './world.js';

function posePlay(world) {
  world.resetRun();
  const state = world.state;
  // Courier halfway across Warehouse Row, one chip already in the bag.
  state.player.x = tileCenterX(8);
  state.player.y = tileCenterY(8);
  state.player.sneaking = true;
  state.player.face = Math.PI / 2;
  state.level.chips[0].taken = true;
  state.chipsGot = 1;
  state.score = 100;
  state.levelTime = 23.4;
  // First guard mid-patrol, turning toward the courier; second guard watching
  // the far corridor. One guard is half-suspicious, so its cone burns orange
  // and the "?" shows above it.
  const g0 = state.guards[0];
  g0.x = tileCenterX(12);
  g0.y = tileCenterY(5);
  g0.angle = Math.PI * 0.72;
  g0.alertness = 0.55;
  g0.state = 'suspicious';
  const g1 = state.guards[1];
  g1.x = tileCenterX(18);
  g1.y = tileCenterY(7);
  g1.angle = Math.PI * 0.9;
  state.heat = 0.55;
  state.toast = 'Stay low — the patrol is turning';
  state.toastT = 2.2;
  return { screen: SCREEN_PLAY, result: null };
}

function poseWin(world) {
  // Sync the HUD's numbers with the victory panel so the two never disagree.
  world.resetRun();
  world.loadLevel(2);
  const state = world.state;
  state.score = 2675;
  state.chipsGot = 14;
  state.levelTime = 112.5;
  state.totalTime = 112.5;
  return {
    screen: SCREEN_WIN,
    result: { score: 2675, chips: 14, totalChips: 14, alerts: 0, time: 112.5, rank: 'S — GHOST' },
  };
}

function poseCaught(world) {
  world.resetRun();
  const state = world.state;
  state.player.x = tileCenterX(10);
  state.player.y = tileCenterY(6);
  state.player.face = -Math.PI / 2;
  state.level.chips[0].taken = true;
  state.chipsGot = 1;
  state.score = 100;
  state.alerts = 1;
  state.levelTime = 18.7;
  const g0 = state.guards[0];
  g0.x = tileCenterX(10);
  g0.y = tileCenterY(6) - 30;
  g0.angle = Math.PI / 2;
  g0.alertness = 1;
  g0.state = 'alert';
  state.heat = 1;
  return {
    screen: SCREEN_CAUGHT,
    result: { score: 100, chips: 1, totalChips: 14, alerts: 1, time: 18.7, rank: '' },
  };
}

export function stageShot(name, world) {
  if (name === 'play') return posePlay(world);
  if (name === 'win') return poseWin(world);
  if (name === 'caught') return poseCaught(world);
  world.resetRun();
  return { screen: SCREEN_TITLE, result: null };
}
