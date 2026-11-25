// The screenshot scenes behind ?shot=start|play|end. Each one is built by
// playing the real game with a simple autopilot — walking the chef with the
// same move vectors a player sends, grabbing with world.grab, chopping and
// cooking and serving with world.interact — and freezing the frame where the
// autopilot leaves it. Nothing is posed: the money, the served count, the
// combo, the pan's contents and its cooking progress are all whatever the
// simulation produced, and the same seed always gives the same frame.
import {
  ING_BY_ID, RECIPE_BY_ID, SHOT_PLAY_COOK_TARGET, SHOT_TITLE_SECONDS,
  STATIONS, STEP,
} from './config.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const IDLE = { x: 0, y: 0 };
/** Most dishes the end-scene autopilot tries to serve in one shift. */
const MAX_END_ROUNDS = 40;

/** Front of a station, where the chef stands to use it. */
function frontOf(key) {
  const zone = STATIONS[key];
  return { x: zone.x + zone.w / 2, y: zone.frontY };
}

export function stageShot(name, world) {
  const state = world.state;
  world.reset();

  function idleSteps(count) {
    for (let i = 0; i < count; i += 1) world.step(STEP, IDLE);
  }

  /** Step in place until `cond` holds, or `maxSteps` run out. */
  function waitFor(cond, maxSteps) {
    for (let i = 0; i < maxSteps; i += 1) {
      if (cond()) return true;
      world.step(STEP, IDLE);
    }
    return cond();
  }

  /** Walk the chef to a point with WASD-style moves; true when arrived. */
  function walkTo(x, y) {
    for (let i = 0; i < 900; i += 1) {
      const dx = x - state.chef.x;
      const dy = y - state.chef.y;
      if (Math.hypot(dx, dy) < 12) return true;
      world.step(STEP, { x: dx, y: dy });
      if (state.over) return false;
    }
    return Math.hypot(x - state.chef.x, y - state.chef.y) < 12;
  }

  function walkToStation(key) {
    const front = frontOf(key);
    return walkTo(front.x, front.y);
  }

  /** Cook the named order's dish from the board and serve it; true if served. */
  function cookAndServe(recipeId) {
    const recipe = RECIPE_BY_ID[recipeId];
    const before = state.served;
    // Grab every ingredient, in recipe order.
    for (const ingId of recipe.needs) {
      if (!walkToStation('cabinet')) return false;
      if (!world.grab(ingId)) return false;
    }
    // Chop what needs chopping, one ingredient at a time.
    for (const ingId of recipe.needs) {
      if (!ING_BY_ID[ingId].chop) continue;
      if (!walkToStation('board')) return false;
      world.interact();
      if (!waitFor(() => state.hand.some((item) => item.id === ingId && item.chopped), 300)) return false;
    }
    // Into the pan, wait for it to cook, pick the dish up.
    const pan = recipe.pan;
    if (!walkToStation(pan)) return false;
    world.interact();
    if (!waitFor(() => state[pan].ready === recipeId, 600)) return false;
    world.interact();
    if (!state.hand.some((item) => item.dish === recipeId)) return false;
    // To the serving window.
    if (!walkToStation('serve')) return false;
    world.interact();
    return state.served === before + 1;
  }

  /** The waiting order with the most patience left, or null. */
  function freshestOrder() {
    let bestOrder = null;
    for (const order of state.orders) {
      if (bestOrder === null || order.patience > bestOrder.patience) bestOrder = order;
    }
    return bestOrder;
  }

  if (name !== 'play' && name !== 'end') {
    // Title: let orders arrive on the board behind the panel. Attract mode
    // runs the kitchen without burning the shift.
    for (let i = 0; i < SHOT_TITLE_SECONDS / STEP; i += 1) world.step(STEP, IDLE, true);
    return { screen: SCREEN_TITLE, best: 0 };
  }

  if (name === 'play') {
    // Mid-rush: serve one real order, then start the next dish and freeze
    // it while the wok is half-way through cooking it.
    if (!waitFor(() => state.orders.length > 0, 1200)) return { screen: SCREEN_PLAY, best: 0 };
    const first = freshestOrder();
    if (first) cookAndServe(first.recipeId);
    if (!waitFor(() => state.orders.length > 0, 1200)) return { screen: SCREEN_PLAY, best: state.money };
    const second = freshestOrder();
    if (!second) return { screen: SCREEN_PLAY, best: state.money };
    const recipe = RECIPE_BY_ID[second.recipeId];
    for (const ingId of recipe.needs) {
      if (!walkToStation('cabinet')) break;
      if (!world.grab(ingId)) break;
    }
    for (const ingId of recipe.needs) {
      if (!ING_BY_ID[ingId].chop) continue;
      if (!walkToStation('board')) break;
      world.interact();
      if (!waitFor(() => state.hand.some((item) => item.id === ingId && item.chopped), 300)) break;
    }
    if (walkToStation(recipe.pan)) {
      world.interact();
      waitFor(() => state[recipe.pan].cooking >= SHOT_PLAY_COOK_TARGET, 600);
    }
    return { screen: SCREEN_PLAY, best: state.money };
  }

  // End: play the whole shift with the autopilot until the shift ends, then
  // show the summary of whatever it really earned.
  for (let round = 0; round < MAX_END_ROUNDS && !state.over; round += 1) {
    if (!waitFor(() => state.orders.length > 0, 1200)) break;
    const order = freshestOrder();
    if (!order) break;
    if (order.patience < 20) {
      // Too late to cook this one in time; let the clock run and try the next.
      idleSteps(60);
      continue;
    }
    if (!cookAndServe(order.recipeId)) idleSteps(60);
  }
  while (!state.over) world.step(STEP, IDLE);
  return { screen: SCREEN_OVER, best: state.money };
}
