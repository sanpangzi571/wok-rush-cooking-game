// Keyboard and pointer input for the kitchen. Held keys steer the chef;
// one-shot presses (interact, pause, grab a numbered ingredient) are queued
// as flags and taken once by the loop, so a press between two frames is never
// lost and never counted twice. Clicking a station walks the chef to its
// front; clicking an ingredient bin walks him to the cabinet and grabs it
// when he arrives.
import { BINS, CHEF, INGREDIENTS, STATIONS } from './config.js';

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_INTERACT = 4;

const UP = new Set(['ArrowUp', 'KeyW']);
const DOWN = new Set(['ArrowDown', 'KeyS']);
const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const CONFIRM = new Set(['Space', 'Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);
const INTERACT = new Set(['KeyE']);

export function createInput(canvas, world) {
  let up = false;
  let down = false;
  let left = false;
  let right = false;
  let actions = 0;
  const grabQueue = [];

  function canvasPoint(event) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = 1280 / rect.width;
    const scaleY = 720 / rect.height;
    return {
      x: (event.clientX - rect.left) * scaleX,
      y: (event.clientY - rect.top) * scaleY,
    };
  }

  window.addEventListener('keydown', (event) => {
    if (UP.has(event.code)) up = true;
    else if (DOWN.has(event.code)) down = true;
    else if (LEFT.has(event.code)) left = true;
    else if (RIGHT.has(event.code)) right = true;
    else if (CONFIRM.has(event.code)) {
      if (!event.repeat) actions |= ACTION_CONFIRM;
    } else if (PAUSE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_PAUSE;
    } else if (INTERACT.has(event.code)) {
      if (!event.repeat) actions |= ACTION_INTERACT;
    } else if (/^Digit[1-9]$/.test(event.code)) {
      if (!event.repeat) grabQueue.push(INGREDIENTS[Number(event.code.slice(5)) - 1].id);
    } else return;
    event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    if (UP.has(event.code)) up = false;
    else if (DOWN.has(event.code)) down = false;
    else if (LEFT.has(event.code)) left = false;
    else if (RIGHT.has(event.code)) right = false;
  });
  window.addEventListener('blur', () => {
    up = false;
    down = false;
    left = false;
    right = false;
  });

  canvas.addEventListener('pointerdown', (event) => {
    const point = canvasPoint(event);
    const chef = world.state.chef;
    // An ingredient bin: walk to the cabinet, then grab that ingredient.
    // Only a click inside a bin's own rectangle counts — clicking the
    // cabinet's label or its gaps just walks the chef to the cabinet front.
    const cabinet = STATIONS.cabinet;
    for (let row = 0; row < 3; row += 1) {
      for (let col = 0; col < 3; col += 1) {
        const bx = cabinet.x + BINS.xOff + col * BINS.colW;
        const by = cabinet.y + BINS.yOff + row * BINS.rowH;
        if (point.x >= bx && point.x <= bx + BINS.w && point.y >= by && point.y <= by + BINS.h) {
          const ing = INGREDIENTS[row * 3 + col];
          chef.tx = cabinet.x + cabinet.w / 2;
          chef.ty = CHEF.floorTop + 20;
          chef.moving = true;
          chef.queuedGrab = ing.id;
          return;
        }
      }
    }
    // A station: walk to its front.
    for (const zone of Object.values(STATIONS)) {
      if (point.x >= zone.x && point.x <= zone.x + zone.w
        && point.y >= zone.y && point.y <= zone.y + zone.h) {
        chef.tx = zone.x + zone.w / 2;
        chef.ty = zone.frontY;
        chef.moving = true;
        chef.queuedGrab = null;
        return;
      }
    }
    // Anywhere else on the floor: just walk there.
    chef.tx = Math.min(1250, Math.max(30, point.x));
    chef.ty = Math.min(CHEF.floorBottom, Math.max(CHEF.floorTop, point.y));
    chef.moving = true;
    chef.queuedGrab = null;
    // A click on the title / game-over panel counts as confirm.
    actions |= ACTION_CONFIRM;
  });

  return {
    /** -1..1 steering for this frame. */
    move() {
      return {
        x: (right ? 1 : 0) - (left ? 1 : 0),
        y: (down ? 1 : 0) - (up ? 1 : 0),
      };
    },
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
    /** Ingredient ids queued by the 1-9 keys since the last call. */
    takeGrabs() {
      return grabQueue.splice(0, grabQueue.length);
    },
  };
}
