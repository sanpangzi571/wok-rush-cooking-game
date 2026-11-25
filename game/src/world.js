// 烟火小馆 · Lunch Rush rules, with no drawing and no browser in it: the chef,
// the nine ingredient bins, the board, the wok and the soup pot, the order
// board, money, combo, hearts and the 150-second shift. step() advances one
// fixed step and returns what happened as bit flags, so the caller can react
// without the world knowing about screens. Nothing here allocates after
// createWorld returns, except the small arrays the game itself owns.
import {
  CHEF, CHOP_SECONDS, COOK_SECONDS, FIELD, HAND_MAX, INGREDIENTS, ING_BY_ID,
  LIVES, MESSAGE_SECONDS, ORDERS, RECIPES, RECIPE_BY_ID, SERVED_PLATES_SHOWN,
  SHIFT_SECONDS, STATIONS, starsFor,
} from './config.js';
import { pick } from './random.js';

export const EVENT_SERVED = 1;
export const EVENT_EXPIRE = 2;
export const EVENT_OVER = 4;
export const EVENT_WRONG = 8;
export const EVENT_COOKED = 16;
export const EVENT_CHOPPED = 32;

function sameSet(a, b) {
  if (a.length !== b.length) return false;
  const sortedA = [...a].sort();
  const sortedB = [...b].sort();
  return sortedA.every((v, i) => v === sortedB[i]);
}

function isSubset(items, needs) {
  const rest = [...needs];
  for (const id of items) {
    const at = rest.indexOf(id);
    if (at === -1) return false;
    rest.splice(at, 1);
  }
  return true;
}

function recipeFor(pan, items) {
  for (const recipe of RECIPES) {
    if (recipe.pan === pan && sameSet(items, recipe.needs)) return recipe;
  }
  return null;
}

export function createWorld(random) {
  const chef = { x: 640, y: 560, tx: 640, ty: 560, moving: false, face: 1 };
  const state = {
    chef,
    hand: [],
    board: { ing: null, progress: 0 },
    wok: { items: [], cooking: 0, ready: null },
    pot: { items: [], cooking: 0, ready: null },
    orders: [],
    money: 0,
    served: 0,
    combo: 0,
    maxCombo: 0,
    hearts: LIVES,
    timeLeft: SHIFT_SECONDS,
    elapsed: 0,
    nextOrderAt: ORDERS.firstAt,
    servedPlates: [],
    message: '',
    messageT: 0,
    over: false,
    overReason: '',
    muted: false,
  };

  function say(text) {
    state.message = text;
    state.messageT = MESSAGE_SECONDS;
  }

  function reset() {
    chef.x = 640;
    chef.y = 560;
    chef.tx = 640;
    chef.ty = 560;
    chef.moving = false;
    chef.face = 1;
    state.hand.length = 0;
    state.board.ing = null;
    state.board.progress = 0;
    state.wok.items.length = 0;
    state.wok.cooking = 0;
    state.wok.ready = null;
    state.pot.items.length = 0;
    state.pot.cooking = 0;
    state.pot.ready = null;
    state.orders.length = 0;
    state.money = 0;
    state.served = 0;
    state.combo = 0;
    state.maxCombo = 0;
    state.hearts = LIVES;
    state.timeLeft = SHIFT_SECONDS;
    state.elapsed = 0;
    state.nextOrderAt = ORDERS.firstAt;
    state.servedPlates.length = 0;
    state.message = '';
    state.messageT = 0;
    state.over = false;
    state.overReason = '';
  }

  /** Which station the chef is standing in front of, or null. */
  function nearestStation() {
    if (chef.y > 520) return null;
    const cx = chef.x;
    for (const [key, zone] of Object.entries(STATIONS)) {
      if (cx >= zone.x - 10 && cx <= zone.x + zone.w + 10) return key;
    }
    return null;
  }

  function carryingDish() {
    return state.hand.find((item) => item.dish) ?? null;
  }

  function grab(ingId) {
    const ing = ING_BY_ID[ingId];
    if (!ing) return false;
    if (nearestStation() !== 'cabinet') {
      say('先走到食材柜前再拿食材');
      return false;
    }
    if (carryingDish()) {
      say('手里端着菜呢，先送出去');
      return false;
    }
    if (state.hand.length >= HAND_MAX) {
      say('手拿不下了，先去切菜或下锅');
      return false;
    }
    if (state.hand.some((item) => item.id === ingId)) {
      say(`已经拿了${ing.name}，别重复拿`);
      return false;
    }
    state.hand.push({ id: ingId, chopped: false });
    return true;
  }

  function addToPan(panKey) {
    const pan = panKey === 'wok' ? state.wok : state.pot;
    if (pan.ready) {
      const dish = RECIPE_BY_ID[pan.ready];
      if (carryingDish()) {
        say('手里已经有菜了');
        return false;
      }
      state.hand.push({ dish: pan.ready });
      pan.ready = null;
      pan.cooking = 0;
      say(`${dish.name}出锅！快送到出菜口`);
      return true;
    }
    if (state.hand.length === 0) {
      say(pan.items.length === 0 ? '手里没东西，先去食材柜拿' : '锅里还差料，继续加');
      return false;
    }
    if (carryingDish()) {
      say('端着菜不能往锅里加');
      return false;
    }
    // Move every usable hand item into the pan, one at a time, in hand order.
    let moved = 0;
    for (const item of [...state.hand]) {
      const ing = ING_BY_ID[item.id];
      if (ing.chop && !item.chopped) {
        say(`${ing.name}还没切，先去砧板`);
        continue;
      }
      if (panKey === 'wok' && item.id === 'noodle') {
        say('面条要下汤锅，不能进炒锅');
        continue;
      }
      if (panKey === 'pot' && item.id !== 'noodle' && item.id !== 'peanut' && item.id !== 'chili') {
        say('汤锅只做担担面，这料不进锅');
        continue;
      }
      const next = [...pan.items, item.id];
      const fits = RECIPES.some((r) => r.pan === panKey && isSubset(next, r.needs));
      if (!fits) {
        say(`${ing.name}跟锅里的料搭不上`);
        continue;
      }
      pan.items.push(item.id);
      state.hand.splice(state.hand.indexOf(item), 1);
      moved += 1;
    }
    if (moved === 0) return false;
    const done = recipeFor(panKey, pan.items);
    if (done) say(`${done.name}料齐了，正在${panKey === 'wok' ? '爆炒' : '煮面'}…`);
    return true;
  }

  function serve() {
    const dishItem = carryingDish();
    if (!dishItem) {
      say('手里没菜，炒好一道再来');
      return false;
    }
    const dish = RECIPE_BY_ID[dishItem.dish];
    const orderIndex = state.orders.findIndex((o) => o.recipeId === dish.id);
    state.hand.splice(state.hand.indexOf(dishItem), 1);
    if (orderIndex === -1) {
      state.hearts -= 1;
      state.combo = 0;
      say(`没人点${dish.name}！客人摇头，扣一颗心`);
      if (state.hearts <= 0) {
        state.over = true;
        state.overReason = '客人都走光了';
      }
      return 'wrong';
    }
    const bonus = state.combo * 2;
    state.money += dish.price + bonus;
    state.served += 1;
    state.combo += 1;
    state.maxCombo = Math.max(state.maxCombo, state.combo);
    state.orders.splice(orderIndex, 1);
    state.servedPlates.unshift(dish.name);
    if (state.servedPlates.length > SERVED_PLATES_SHOWN) state.servedPlates.pop();
    say(bonus > 0 ? `${dish.name}上菜！+¥${dish.price}，连击奖励 +¥${bonus}` : `${dish.name}上菜！+¥${dish.price}`);
    return 'served';
  }

  function interact() {
    const station = nearestStation();
    if (!station) {
      say('走到灶台前再按 E');
      return null;
    }
    if (station === 'cabinet') {
      say('按 1–9 拿食材，或点一下食材格');
      return null;
    }
    if (station === 'board') {
      if (state.board.ing) {
        say('正在切菜，稍等一下');
        return null;
      }
      const raw = state.hand.find((item) => !item.dish && ING_BY_ID[item.id].chop && !item.chopped);
      if (!raw) {
        say('手里没有要切的菜');
        return null;
      }
      state.hand.splice(state.hand.indexOf(raw), 1);
      state.board.ing = raw.id;
      state.board.progress = 0;
      say(`正在切${ING_BY_ID[raw.id].name}…`);
      return 'chop-start';
    }
    if (station === 'wok') return addToPan('wok') ? 'pan' : null;
    if (station === 'pot') return addToPan('pot') ? 'pan' : null;
    if (station === 'serve') {
      const result = serve();
      return result === 'served' ? 'served' : result === 'wrong' ? 'wrong' : null;
    }
    return null;
  }

  function spawnOrder() {
    const busy = new Set(state.orders.map((o) => o.recipeId));
    const free = RECIPES.filter((r) => !busy.has(r.id));
    if (free.length === 0) return;
    const recipe = pick(random, free);
    state.orders.push({ recipeId: recipe.id, patience: ORDERS.patience, max: ORDERS.patience });
  }

  function endShift(reason) {
    state.over = true;
    state.overReason = reason;
  }

  /**
   * One fixed step. `move` is {x, y} in -1..1 (WASD/arrows); when the chef has
   * a click target and no key is held, he walks to it instead. With `attract`
   * set (the title screen's backdrop) orders still arrive and the kitchen
   * animates, but the clock, the customers' patience and hearts do not run:
   * the shift must not burn down before the player presses start.
   */
  function step(dt, move, attract = false) {
    let events = 0;
    if (state.over) return events;
    state.elapsed += dt;
    if (!attract) state.timeLeft = Math.max(0, SHIFT_SECONDS - state.elapsed);
    if (state.messageT > 0) state.messageT -= dt;

    // Movement: keys win over a click target.
    const keyHeld = move.x !== 0 || move.y !== 0;
    if (keyHeld) {
      chef.moving = false;
      const len = Math.hypot(move.x, move.y) || 1;
      chef.x += (move.x / len) * CHEF.speed * dt;
      chef.y += (move.y / len) * CHEF.speed * dt;
      if (move.x !== 0) chef.face = move.x > 0 ? 1 : -1;
    } else if (chef.moving) {
      const dx = chef.tx - chef.x;
      const dy = chef.ty - chef.y;
      const dist = Math.hypot(dx, dy);
      if (dist < CHEF.arrive) {
        chef.moving = false;
        if (chef.queuedGrab) {
          const queued = chef.queuedGrab;
          chef.queuedGrab = null;
          grab(queued);
        }
      } else {
        const stepLen = Math.min(dist, CHEF.speed * dt);
        chef.x += (dx / dist) * stepLen;
        chef.y += (dy / dist) * stepLen;
        if (dx !== 0) chef.face = dx > 0 ? 1 : -1;
      }
    }
    chef.x = Math.min(FIELD.width - 30, Math.max(30, chef.x));
    chef.y = Math.min(CHEF.floorBottom, Math.max(CHEF.floorTop, chef.y));

    // Chopping finishes on the board.
    if (state.board.ing) {
      state.board.progress += dt / CHOP_SECONDS;
      if (state.board.progress >= 1) {
        const done = state.board.ing;
        state.board.ing = null;
        state.board.progress = 0;
        state.hand.push({ id: done, chopped: true });
        events |= EVENT_CHOPPED;
        say(`${ING_BY_ID[done].name}切好了`);
      }
    }

    // Cooking: a pan whose contents exactly match a recipe cooks to done.
    for (const [key, pan] of [['wok', state.wok], ['pot', state.pot]]) {
      if (!pan.ready && pan.items.length > 0 && recipeFor(key, pan.items)) {
        pan.cooking += dt / COOK_SECONDS;
        if (pan.cooking >= 1) {
          const dish = recipeFor(key, pan.items);
          pan.items.length = 0;
          pan.cooking = 0;
          pan.ready = dish.id;
          events |= EVENT_COOKED;
          say(`${dish.name}好了，按 E 起锅`);
        }
      }
    }

    // New orders on schedule.
    if (state.elapsed >= state.nextOrderAt && state.orders.length < ORDERS.max) {
      spawnOrder();
      state.nextOrderAt = state.elapsed + ORDERS.every;
    }

    // Patience runs out: the customer walks, a heart is lost.
    // (Not on the title screen: attract mode freezes patience.)
    for (let i = state.orders.length - 1; i >= 0; i -= 1) {
      if (attract) break;
      state.orders[i].patience -= dt;
      if (state.orders[i].patience <= 0) {
        const lost = RECIPE_BY_ID[state.orders[i].recipeId];
        state.orders.splice(i, 1);
        state.hearts -= 1;
        state.combo = 0;
        events |= EVENT_EXPIRE;
        say(`${lost.name}等太久，客人走了，扣一颗心`);
        if (state.hearts <= 0) {
          endShift('客人都走光了');
          events |= EVENT_OVER;
          return events;
        }
      }
    }

    if (!attract && state.timeLeft <= 0) {
      endShift('打烊了');
      events |= EVENT_OVER;
    }
    return events;
  }

  reset();
  return {
    state, reset, step, interact, grab, nearestStation, carryingDish,
    stars: () => starsFor(state.money),
  };
}
