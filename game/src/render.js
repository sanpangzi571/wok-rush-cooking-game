// Drawing only: the world's state and the current screen in, pixels out. The
// 1280x720 playfield is scaled to fit the window and centred, the margin
// filled with the backdrop colour. Everything is flat vector drawing and
// canvas text — no images, no fonts to fetch, nothing leaves game/.
import {
  BINS, FIELD, FONT, INGREDIENTS, ING_BY_ID, LIVES, ORDERS, PALETTE,
  RECIPE_BY_ID, SERVED_PLATES_SHOWN, SHIFT_SECONDS, STAR_THRESHOLDS,
  STATIONS, starsFor,
} from './config.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';

function fmtTime(seconds) {
  const s = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    view.scale = Math.min(width / FIELD.width, height / FIELD.height);
    view.x = (width - FIELD.width * view.scale) / 2;
    view.y = (height - FIELD.height * view.scale) / 2;
  }

  const fonts = new Map();
  function text(value, x, y, size, color, align = 'left', weight = '') {
    const key = `${weight}${size}`;
    if (!fonts.has(key)) fonts.set(key, `${weight ? `${weight} ` : ''}${size}px ${FONT}`);
    context.font = fonts.get(key);
    context.fillStyle = color;
    context.textAlign = align;
    context.textBaseline = 'alphabetic';
    context.fillText(value, x, y);
  }

  function roundRect(x, y, w, h, r) {
    context.beginPath();
    context.moveTo(x + r, y);
    context.arcTo(x + w, y, x + w, y + h, r);
    context.arcTo(x + w, y + h, x, y + h, r);
    context.arcTo(x, y + h, x, y, r);
    context.arcTo(x, y, x + w, y, r);
    context.closePath();
  }

  function heart(x, y, size, filled) {
    context.fillStyle = filled ? PALETTE.red : '#5a3a28';
    context.beginPath();
    context.arc(x - size * 0.35, y - size * 0.2, size * 0.38, 0, Math.PI * 2);
    context.arc(x + size * 0.35, y - size * 0.2, size * 0.38, 0, Math.PI * 2);
    context.fill();
    context.beginPath();
    context.moveTo(x - size * 0.68, y - size * 0.05);
    context.lineTo(x + size * 0.68, y - size * 0.05);
    context.lineTo(x, y + size * 0.75);
    context.closePath();
    context.fill();
  }

  function drawWallAndFloor() {
    context.fillStyle = PALETTE.wall;
    context.fillRect(0, 0, FIELD.width, 240);
    context.fillStyle = PALETTE.wallTrim;
    context.fillRect(0, 232, FIELD.width, 8);
    // Two red lanterns flanking the wall sign, all below the HUD bar.
    for (const lx of [520, 760]) {
      context.fillStyle = '#c22e2e';
      context.beginPath();
      context.ellipse(lx, 150, 26, 32, 0, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = PALETTE.gold;
      context.fillRect(lx - 3, 114, 6, 12);
      context.fillRect(lx - 3, 180, 6, 10);
      text('福', lx, 162, 26, PALETTE.gold, 'center', 'bold');
    }
    text('烟火小馆', 640, 168, 44, PALETTE.lightText, 'center', 'bold');
    text('小火慢炖 · 现炒现卖', 640, 196, 16, '#d8a878', 'center');
    context.fillStyle = PALETTE.floor;
    context.fillRect(0, 240, FIELD.width, FIELD.height - 240);
    context.fillStyle = PALETTE.floorDark;
    for (let gx = 0; gx < FIELD.width; gx += 80) context.fillRect(gx, 400, 2, FIELD.height - 400);
    for (let gy = 420; gy < FIELD.height; gy += 60) context.fillRect(0, gy, FIELD.width, 2);
  }

  function drawCounter(zone, label, active) {
    context.fillStyle = PALETTE.counter;
    roundRect(zone.x, zone.y, zone.w, zone.h, 10);
    context.fill();
    context.fillStyle = PALETTE.counterTop;
    roundRect(zone.x, zone.y, zone.w, 30, 10);
    context.fill();
    context.fillRect(zone.x, zone.y + 20, zone.w, 10);
    text(label, zone.x + zone.w / 2, zone.y + 21, 16, '#fff3dc', 'center', 'bold');
    if (active) {
      context.strokeStyle = PALETTE.gold;
      context.lineWidth = 4;
      roundRect(zone.x - 3, zone.y - 3, zone.w + 6, zone.h + 6, 12);
      context.stroke();
      context.lineWidth = 1;
    }
  }

  function drawCabinet(state, active) {
    const zone = STATIONS.cabinet;
    drawCounter(zone, '食材柜 · 按 1–9 拿', active);
    INGREDIENTS.forEach((ing, i) => {
      const col = i % 3;
      const row = Math.floor(i / 3);
      const bx = zone.x + BINS.xOff + col * BINS.colW;
      const by = zone.y + BINS.yOff + row * BINS.rowH;
      const inHand = state.hand.some((item) => item.id === ing.id);
      context.fillStyle = inHand ? '#e8d9b0' : '#fff7e8';
      roundRect(bx, by, BINS.w, BINS.h, 6);
      context.fill();
      context.fillStyle = ing.color;
      context.beginPath();
      context.arc(bx + 14, by + 14, 8, 0, Math.PI * 2);
      context.fill();
      text(`${ing.key} ${ing.name}${ing.chop ? '·切' : ''}`, bx + 26, by + 19, 13, PALETTE.text, 'left');
    });
  }

  function drawBoard(state, active) {
    const zone = STATIONS.board;
    drawCounter(zone, '砧板 · 按 E 切菜', active);
    context.fillStyle = '#e8c98f';
    roundRect(zone.x + 18, zone.y + 52, zone.w - 36, 58, 8);
    context.fill();
    if (state.board.ing) {
      const ing = ING_BY_ID[state.board.ing];
      context.fillStyle = ing.color;
      context.beginPath();
      context.arc(zone.x + zone.w / 2 - 20, zone.y + 82, 16, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#3a2a1a';
      context.fillRect(zone.x + zone.w / 2 + 8, zone.y + 58, 34, 8);
      context.fillRect(zone.x + zone.w / 2 + 34, zone.y + 66, 8, 26);
      context.fillStyle = '#8a5a33';
      context.fillRect(zone.x + 18, zone.y + 118, (zone.w - 36) * state.board.progress, 6);
      text('切菜中…', zone.x + zone.w / 2, zone.y + 132, 13, PALETTE.lightText, 'center');
    } else {
      text('把要切的菜拿到手里', zone.x + zone.w / 2, zone.y + 84, 13, '#5a3a28', 'center');
      text('番茄 / 猪肉 / 青椒 / 鸡肉', zone.x + zone.w / 2, zone.y + 104, 12, '#5a3a28', 'center');
    }
  }

  function drawFlame(x, y, t, big) {
    const flick = Math.sin(t * 9 + x) * 3;
    context.fillStyle = '#f2822a';
    context.beginPath();
    context.moveTo(x - 22, y);
    context.quadraticCurveTo(x - 26, y - 26 - flick, x, y - 34 - flick);
    context.quadraticCurveTo(x + 26, y - 26 - flick, x + 22, y);
    context.closePath();
    context.fill();
    context.fillStyle = '#f6c453';
    context.beginPath();
    context.moveTo(x - 12, y);
    context.quadraticCurveTo(x - 13, y - 16, x, y - 22);
    context.quadraticCurveTo(x + 13, y - 16, x + 12, y);
    context.closePath();
    context.fill();
    if (big) {
      context.fillStyle = '#e5533d';
      context.beginPath();
      context.arc(x, y - 40, 5, 0, Math.PI * 2);
      context.fill();
    }
  }

  function drawPan(state, key, active) {
    const zone = STATIONS[key];
    const pan = state[key];
    const label = key === 'wok' ? '炒锅 · 按 E 下料/起锅' : '汤锅 · 按 E 下料/起锅';
    drawCounter(zone, label, active);
    const cx = zone.x + zone.w / 2;
    const cy = zone.y + 84;
    const cooking = pan.items.length > 0 && !pan.ready;
    drawFlame(cx, zone.y + 116, state.elapsed, cooking);
    context.fillStyle = '#2b2b2e';
    context.beginPath();
    context.ellipse(cx, cy, 62, 26, 0, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = cooking ? '#7a4a21' : '#3d3d40';
    context.beginPath();
    context.ellipse(cx, cy - 4, 54, 20, 0, 0, Math.PI * 2);
    context.fill();
    if (pan.ready) {
      const dish = RECIPE_BY_ID[pan.ready];
      context.fillStyle = '#f6c453';
      context.beginPath();
      context.arc(cx, cy - 8, 20, 0, Math.PI * 2);
      context.fill();
      text('✓', cx, cy, 20, '#7d1414', 'center', 'bold');
      text(`${dish.name}好了！`, cx, zone.y + 132, 14, PALETTE.gold, 'center', 'bold');
    } else if (pan.items.length > 0) {
      pan.items.forEach((id, i) => {
        context.fillStyle = ING_BY_ID[id].color;
        context.beginPath();
        context.arc(cx - 28 + i * 28, cy - 6, 10, 0, Math.PI * 2);
        context.fill();
      });
      // 火候条
      context.fillStyle = '#5a3a28';
      context.fillRect(zone.x + 18, zone.y + 122, zone.w - 36, 8);
      context.fillStyle = '#f2822a';
      context.fillRect(zone.x + 18, zone.y + 122, (zone.w - 36) * pan.cooking, 8);
      text('火候', zone.x + 18, zone.y + 120, 11, PALETTE.lightText, 'left');
    } else {
      text(key === 'wok' ? '面条别进炒锅' : '只做担担面', cx, cy - 2, 13, '#cbb59a', 'center');
    }
  }

  function drawServe(state, active) {
    const zone = STATIONS.serve;
    drawCounter(zone, '出菜口 · 按 E 上菜', active);
    context.fillStyle = '#fff7e8';
    roundRect(zone.x + 14, zone.y + 44, zone.w - 28, 52, 8);
    context.fill();
    if (state.servedPlates.length === 0) {
      text('等你上菜', zone.x + zone.w / 2, zone.y + 76, 14, PALETTE.muted, 'center');
    } else {
      state.servedPlates.slice(0, SERVED_PLATES_SHOWN).forEach((name, i) => {
        context.fillStyle = '#f6c453';
        context.beginPath();
        context.arc(zone.x + 36 + i * 62, zone.y + 62, 18, 0, Math.PI * 2);
        context.fill();
        text(name, zone.x + 36 + i * 62, zone.y + 90, 12, PALETTE.text, 'center');
      });
    }
    text(`已上 ${state.served} 道`, zone.x + zone.w / 2, zone.y + 126, 13, PALETTE.lightText, 'center');
  }

  function drawOrders(state) {
    context.fillStyle = PALETTE.panel;
    roundRect(12, 68, 300, 168, 10);
    context.fill();
    context.fillStyle = PALETTE.panelDark;
    text('点菜单', 26, 94, 20, PALETTE.panelDark, 'left', 'bold');
    text(`${state.orders.length}/${ORDERS.max} 桌在等`, 298, 94, 13, PALETTE.muted, 'right');
    if (state.orders.length === 0) {
      text('暂无订单，客人马上到…', 26, 130, 14, PALETTE.muted, 'left');
    }
    state.orders.forEach((order, i) => {
      const y = 108 + i * 42;
      const recipe = RECIPE_BY_ID[order.recipeId];
      context.fillStyle = i % 2 === 0 ? '#f3e6c8' : '#fff7e8';
      roundRect(22, y, 280, 38, 6);
      context.fill();
      text(recipe.name, 32, y + 19, 16, PALETTE.text, 'left', 'bold');
      text(`¥${recipe.price}`, 292, y + 19, 15, PALETTE.accent, 'right', 'bold');
      const needs = recipe.needs.map((id) => ING_BY_ID[id].name).join('+');
      text(`${needs} · ${recipe.pan === 'pot' ? '汤锅' : '炒锅'}`, 32, y + 34, 11, PALETTE.muted, 'left');
      const ratio = Math.max(0, order.patience / order.max);
      context.fillStyle = '#d8c9a8';
      context.fillRect(202, y + 26, 80, 4);
      context.fillStyle = ratio > 0.5 ? PALETTE.green : ratio > 0.25 ? '#e8a04c' : PALETTE.red;
      context.fillRect(202, y + 26, 80 * ratio, 4);
    });
  }

  function drawChef(state) {
    const chef = state.chef;
    const bob = chef.moving ? Math.sin(state.elapsed * 14) * 2 : 0;
    const x = chef.x;
    const y = chef.y + bob;
    // Shadow
    context.fillStyle = 'rgba(0,0,0,0.25)';
    context.beginPath();
    context.ellipse(x, chef.y + 28, 26, 7, 0, 0, Math.PI * 2);
    context.fill();
    // Body / apron
    context.fillStyle = '#fff7e8';
    roundRect(x - 20, y - 12, 40, 34, 10);
    context.fill();
    context.fillStyle = '#3f7d4e';
    context.fillRect(x - 20, y + 6, 40, 16);
    // Head + hat
    context.fillStyle = '#f2c9a0';
    context.beginPath();
    context.arc(x, y - 24, 15, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = '#fff7e8';
    roundRect(x - 18, y - 46, 36, 14, 7);
    context.fill();
    context.fillStyle = '#fff7e8';
    context.beginPath();
    context.arc(x, y - 44, 12, Math.PI, 0);
    context.fill();
    // Eyes look where he faces
    context.fillStyle = '#2b1a10';
    context.beginPath();
    context.arc(x + chef.face * 5, y - 26, 2, 0, Math.PI * 2);
    context.fill();
    // Hand tray: what he carries, drawn above his head
    if (state.hand.length > 0) {
      context.fillStyle = 'rgba(43,26,16,0.85)';
      roundRect(x - 34, y - 78, 68, 20, 8);
      context.fill();
      const dish = state.hand.find((item) => item.dish);
      if (dish) text(RECIPE_BY_ID[dish.dish].name, x, y - 64, 13, PALETTE.gold, 'center', 'bold');
      else {
        const names = state.hand.map((item) => ING_BY_ID[item.id].name + (item.chopped ? '✓' : '')).join(' ');
        text(names, x, y - 64, 12, '#fff3dc', 'center');
      }
    }
  }

  function drawHud(state, best) {
    context.fillStyle = 'rgba(25,16,9,0.92)';
    context.fillRect(0, 0, FIELD.width, 56);
    text('烟火小馆 · Lunch Rush', 16, 36, 22, PALETTE.lightText, 'left', 'bold');
    text(`⏱ ${fmtTime(state.timeLeft)}`, 640, 36, 24, state.timeLeft <= 20 ? '#ff8a7a' : PALETTE.lightText, 'center', 'bold');
    context.fillStyle = '#5a3a28';
    context.fillRect(560, 46, 160, 5);
    context.fillStyle = PALETTE.gold;
    context.fillRect(560, 46, 160 * (state.timeLeft / SHIFT_SECONDS), 5);
    text(`¥${state.money}`, 900, 36, 24, PALETTE.gold, 'left', 'bold');
    text(`连击 x${state.combo}`, 1010, 36, 18, '#ffd9a0', 'left');
    for (let i = 0; i < LIVES; i += 1) heart(1160 + i * 34, 28, 13, i < state.hearts);
    text(`最佳 ¥${best}`, 1240, 54, 11, '#d8a878', 'right');
    // Hand tray strip at the bottom
    context.fillStyle = 'rgba(25,16,9,0.85)';
    context.fillRect(0, 684, FIELD.width, 36);
    const handText = state.hand.length === 0
      ? '手里是空的：去食材柜按 1–9 拿食材'
      : `手里：${state.hand.map((item) => (item.dish ? RECIPE_BY_ID[item.dish].name : ING_BY_ID[item.id].name + (item.chopped ? '(已切)' : '(待切)'))).join(' · ')}`;
    text(handText, 16, 708, 15, '#fff3dc', 'left');
    text('WASD/方向键走 · 点灶台走过去 · E 操作 · P 暂停', 1264, 708, 14, '#d8a878', 'right');
    if (state.messageT > 0 && state.message) {
      context.fillStyle = 'rgba(43,26,16,0.9)';
      const w = Math.min(560, 24 + state.message.length * 15);
      roundRect(640 - w / 2, 66, w, 30, 8);
      context.fill();
      text(state.message, 640, 87, 15, '#fff3dc', 'center');
    }
  }

  function drawPanel(title, lines, prompt, extra) {
    context.fillStyle = 'rgba(20,10,4,0.55)';
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    context.fillStyle = PALETTE.panel;
    roundRect(340, 150, 600, 380, 16);
    context.fill();
    text(title, 640, 220, 46, PALETTE.panelDark, 'center', 'bold');
    lines.forEach((line, i) => text(line, 640, 280 + i * 34, 20, PALETTE.muted, 'center'));
    if (extra) extra();
    text(prompt, 640, 490, 22, PALETTE.accent, 'center', 'bold');
  }

  function draw(state, screen, best) {
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = PALETTE.backdrop;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    drawWallAndFloor();
    const active = state.nearestStation ? state.nearestStation() : null;
    drawCabinet(state, active === 'cabinet');
    drawBoard(state, active === 'board');
    drawPan(state, 'wok', active === 'wok');
    drawPan(state, 'pot', active === 'pot');
    drawServe(state, active === 'serve');
    drawOrders(state);
    drawChef(state);
    drawHud(state, best);
    if (screen === SCREEN_TITLE) {
      drawPanel('烟火小馆 · Lunch Rush', [
        '午市 150 秒：接单、拿料、切菜、下锅、上菜',
        'WASD 走路，点灶台走过去，1–9 拿食材，E 操作',
        '别让客人等太久，等走了要扣一颗心',
      ], '按空格或点一下开火', null);
    } else if (screen === SCREEN_PAUSED) {
      drawPanel('歇口气', ['灶上的火还给你留着呢'], '按 P 继续', null);
    } else if (screen === SCREEN_OVER) {
      const starCount = starsFor(state.money);
      const stars = '★'.repeat(starCount) + '☆'.repeat(STAR_THRESHOLDS.length - starCount);
      drawPanel('打烊了', [
        `今晚营业额 ¥${state.money} · 上了 ${state.served} 道菜`,
        `最高连击 x${state.maxCombo} · ${state.overReason}`,
        stars,
      ], '按空格再干一班', null);
    }
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw };
}
