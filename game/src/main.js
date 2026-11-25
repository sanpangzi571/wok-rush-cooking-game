// Boot and the one loop: input is read every frame, the world advances in
// fixed 1/60 s steps (several in a slow frame, none in a fast one), and the
// renderer paints what is there. The game moves between four screens:
// title, play, paused and game over.
//
// ?seed=N fixes the order pattern. ?shot=start|play|end (with &seed=N)
// stages that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.
import { BEST_KEY, LIVES, MAX_FRAME, SHIFT_SECONDS, STEP } from './config.js';
import { createRandom } from './random.js';
import { createWorld, EVENT_EXPIRE, EVENT_OVER, EVENT_WRONG } from './world.js';
import { ACTION_CONFIRM, ACTION_INTERACT, ACTION_PAUSE, createInput } from './input.js';
import { createRenderer, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { stageShot } from './shots.js';

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);

// A small handle for automated playtests (and nothing else): the live world.
window.__wok = world;

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best then lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, scene.best);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas, world);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();

  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    world.reset();
    accumulator = 0;
    screen = SCREEN_PLAY;
    announce(`开火！${LIVES} 颗心，${SHIFT_SECONDS} 秒午市。`);
  }

  function endGame() {
    screen = SCREEN_OVER;
    if (world.state.money > best) {
      best = world.state.money;
      saveBest(best);
    }
    announce(`打烊。营业额 ${world.state.money}，上了 ${world.state.served} 道菜。`);
  }

  function handleActions() {
    const actions = input.takeActions();
    for (const ingId of input.takeGrabs()) world.grab(ingId);
    if (actions & ACTION_CONFIRM && (screen === SCREEN_TITLE || screen === SCREEN_OVER)) startGame();
    else if (actions & ACTION_PAUSE && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('歇口气。');
    } else if (actions & (ACTION_PAUSE | ACTION_CONFIRM) && screen === SCREEN_PAUSED) {
      screen = SCREEN_PLAY;
      announce('继续开火。');
    } else if (actions & ACTION_INTERACT && screen === SCREEN_PLAY) {
      world.interact();
    }
  }

  function step() {
    if (screen === SCREEN_TITLE) {
      world.step(STEP, { x: 0, y: 0 }, true);
      return;
    }
    const events = world.step(STEP, input.move());
    if (events & EVENT_OVER) endGame();
    else if (events & EVENT_EXPIRE) announce(world.state.hearts === 1 ? '客人走了，1 颗心了。' : `客人走了，${world.state.hearts} 颗心。`);
    else if (events & EVENT_WRONG) announce('上错菜了！');
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        step();
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(world.state, screen, best);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('歇口气。');
    }
  });

  announce('烟火小馆。按空格或点一下开火。');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
