// 烟火小馆 · Lunch Rush —— all tuning numbers and colours in one place.
// The playfield is a fixed 1280x720 logical area; the renderer scales it to the
// window, so no rule below depends on the screen size.

export const FIELD = { width: 1280, height: 720 };

// One shift lasts 150 seconds. Orders arrive, wait, and walk out.
export const SHIFT_SECONDS = 150;
export const LIVES = 3;
export const STEP = 1 / 60;

export const CHEF = {
  width: 46,
  height: 54,
  speed: 400,
  // The chef walks on the floor strip; stations sit along its top edge.
  floorTop: 408,
  floorBottom: 668,
  // Close enough to a click target to count as arrived.
  arrive: 6,
};

// One message on the kitchen's notice line stays up this long.
export const MESSAGE_SECONDS = 3;

// The longest frame the loop catches up on; a longer stall (a hidden tab)
// is dropped, not replayed.
export const MAX_FRAME = 0.25;

// Stars for the end-of-shift summary, by takings.
export const STAR_THRESHOLDS = [40, 90, 140];
export function starsFor(money) {
  let stars = 0;
  for (const threshold of STAR_THRESHOLDS) if (money >= threshold) stars += 1;
  return stars;
}

// The ingredient cabinet's 3x3 bins, shared by the renderer (which draws
// them) and the input handler (which works out which bin a click landed in).
export const BINS = { xOff: 8, yOff: 38, colW: 106, rowH: 32, w: 100, h: 28 };

// How many just-served plates the serving window shows.
export const SERVED_PLATES_SHOWN = 2;

// Screenshot staging: how long the title scene idles, and how far along the
// wok's cooking must be when the mid-rush scene freezes.
export const SHOT_TITLE_SECONDS = 8;
export const SHOT_PLAY_COOK_TARGET = 0.55;

// Stations sit in one row along the top of the kitchen. Each one is a zone the
// chef stands in front of (chef.y near floorTop) and presses E to use.
export const STATIONS = {
  cabinet: { x: 36, y: 246, w: 330, h: 138, frontY: 428, label: '食材柜' },
  board: { x: 396, y: 246, w: 186, h: 138, frontY: 428, label: '砧板' },
  wok: { x: 612, y: 246, w: 210, h: 138, frontY: 428, label: '炒锅' },
  pot: { x: 852, y: 246, w: 192, h: 138, frontY: 428, label: '汤锅' },
  serve: { x: 1074, y: 246, w: 170, h: 138, frontY: 428, label: '出菜口' },
};

// The nine ingredients, in key order 1-9. `chop` means it must go through the
// board before it can go in a pan; the rest go in raw.
export const INGREDIENTS = [
  { id: 'tomato', name: '番茄', key: '1', chop: true, color: '#e5533d', dark: '#b03024' },
  { id: 'egg', name: '鸡蛋', key: '2', chop: false, color: '#f6c453', dark: '#c99a2e' },
  { id: 'pork', name: '猪肉', key: '3', chop: true, color: '#f2a0a0', dark: '#c96a6a' },
  { id: 'pepper', name: '青椒', key: '4', chop: true, color: '#58b368', dark: '#2f7d3e' },
  { id: 'chicken', name: '鸡肉', key: '5', chop: true, color: '#e8a04c', dark: '#a86a1e' },
  { id: 'peanut', name: '花生', key: '6', chop: false, color: '#d9a066', dark: '#96683a' },
  { id: 'rice', name: '米饭', key: '7', chop: false, color: '#f5f0e1', dark: '#b8ad8d' },
  { id: 'noodle', name: '面条', key: '8', chop: false, color: '#f2d38a', dark: '#bd9a4a' },
  { id: 'chili', name: '辣椒', key: '9', chop: false, color: '#c22e2e', dark: '#7d1414' },
];

export const ING_BY_ID = Object.fromEntries(INGREDIENTS.map((ing) => [ing.id, ing]));

// Five dishes. `pan` is where it cooks, `needs` is the exact set of ingredients
// (each entry is one unit; chopped ones must be chopped first).
export const RECIPES = [
  { id: 'tomato-egg', name: '番茄炒蛋', pan: 'wok', price: 22, needs: ['tomato', 'egg'] },
  { id: 'pepper-pork', name: '青椒肉丝', pan: 'wok', price: 26, needs: ['pepper', 'pork'] },
  { id: 'kungpao', name: '宫保鸡丁', pan: 'wok', price: 30, needs: ['chicken', 'peanut', 'chili'] },
  { id: 'fried-rice', name: '扬州炒饭', pan: 'wok', price: 24, needs: ['rice', 'egg', 'pork'] },
  { id: 'dandan', name: '担担面', pan: 'pot', price: 28, needs: ['noodle', 'peanut', 'chili'] },
];

export const RECIPE_BY_ID = Object.fromEntries(RECIPES.map((r) => [r.id, r]));

// Orders: first one 3 s in, then a new one every 17 s, at most 3 waiting.
export const ORDERS = { firstAt: 3, every: 17, max: 3, patience: 50 };
export const CHOP_SECONDS = 1.4;
export const COOK_SECONDS = 4;
export const HAND_MAX = 3;

export const PALETTE = {
  backdrop: '#191009',
  wall: '#3d2417',
  wallTrim: '#6b4226',
  floor: '#8a5a33',
  floorDark: '#744a28',
  counter: '#a9713f',
  counterTop: '#c98f52',
  panel: '#fff7e8',
  panelDark: '#2b1a10',
  text: '#2b1a10',
  muted: '#7a5c40',
  lightText: '#fff3dc',
  accent: '#e5533d',
  gold: '#f6c453',
  green: '#58b368',
  red: '#e5533d',
};

export const FONT = '"PingFang SC", "Microsoft YaHei", system-ui, sans-serif';

/** Where the best takings are kept between visits (this browser only). */
export const BEST_KEY = 'wok-rush.best';
