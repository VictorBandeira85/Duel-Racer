import { CAM_DEPTH, CAM_H, CAR_W, DRAW_DIST, KMH, METERS, PLAYER_Z, ROAD_W, SEG_LEN, TRUCK_W, view } from './config';
import { RIVAL, drawCar } from './cars';
import type { Game, TrafficCar } from './game';
import type { Palette } from './stages';
import { SPRITES } from './sprites';
import type { Point, Segment } from './track';
import { formatTime, lerp } from './util';

function project(p: Point, camX: number, camY: number, camZ: number) {
  const { w, h } = view;
  p.camera.x = -camX;
  p.camera.y = p.world.y - camY;
  p.camera.z = p.world.z - camZ;
  const s = CAM_DEPTH / p.camera.z;
  p.screen.scale = s;
  p.screen.x = Math.round(w / 2 + (s * p.camera.x * w) / 2);
  p.screen.y = Math.round(h / 2 - (s * p.camera.y * h) / 2);
  p.screen.w = Math.round((s * ROAD_W * w) / 2);
}

function quad(c: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, x3: number, y3: number, x4: number, y4: number, color: string) {
  c.fillStyle = color;
  c.beginPath();
  c.moveTo(x1, y1);
  c.lineTo(x2, y2);
  c.lineTo(x3, y3);
  c.lineTo(x4, y4);
  c.closePath();
  c.fill();
}

function drawSegment(c: CanvasRenderingContext2D, s: Segment, pal: Palette) {
  const { x: x1, y: y1, w: w1 } = s.p1.screen;
  const { x: x2, y: y2, w: w2 } = s.p2.screen;
  const r1 = w1 / 6, r2 = w2 / 6;
  c.fillStyle = s.dark ? pal.grassDark : pal.grassLight;
  c.fillRect(0, y2, view.w, y1 - y2 + 1);
  const rumble = s.dark ? pal.rumbleDark : pal.rumbleLight;
  quad(c, x1 - w1 - r1, y1, x1 - w1, y1, x2 - w2, y2, x2 - w2 - r2, y2, rumble);
  quad(c, x1 + w1 + r1, y1, x1 + w1, y1, x2 + w2, y2, x2 + w2 + r2, y2, rumble);
  quad(c, x1 - w1, y1, x1 + w1, y1, x2 + w2, y2, x2 - w2, y2, s.dark ? pal.roadDark : pal.roadLight);
  if (s.checker) {
    const n = 12;
    for (let i = 0; i < n; i++) {
      if (i % 2) continue;
      const a = i / n, b = (i + 1) / n;
      quad(c, x1 - w1 + 2 * w1 * a, y1, x1 - w1 + 2 * w1 * b, y1, x2 - w2 + 2 * w2 * b, y2, x2 - w2 + 2 * w2 * a, y2, '#fff');
    }
  } else if (!s.dark) {
    const l1 = w1 / 40, l2 = w2 / 40;
    quad(c, x1 - l1, y1, x1 + l1, y1, x2 + l2, y2, x2 - l2, y2, pal.lane);
  }
}

function drawBackground(c: CanvasRenderingContext2D, g: Game) {
  const { w, h } = view;
  const pal = g.stage.palette;
  const horizon = h / 2 + 8;
  const grad = c.createLinearGradient(0, 0, 0, horizon);
  grad.addColorStop(0, pal.skyTop);
  grad.addColorStop(1, pal.skyBottom);
  c.fillStyle = grad;
  c.fillRect(0, 0, w, h);

  if (pal.sun) {
    const sx = ((w * 0.7 - g.bgOffset * 0.3) % (w * 2) + w * 2) % (w * 2) - w * 0.5;
    c.fillStyle = pal.sun;
    c.beginPath();
    c.arc(sx, h * 0.16, h * 0.07, 0, Math.PI * 2);
    c.fill();
  }

  const layer = (speed: number, base: number, amp: number, color: string, city: boolean, seed: number) => {
    c.fillStyle = color;
    const off = g.bgOffset * speed;
    const step = 2;
    for (let x = 0; x < w; x += step) {
      const wx = x + off;
      let top: number;
      if (city) {
        const col = Math.floor(wx / 18);
        const hash = Math.abs(Math.sin(col * 12.9898 + seed) * 43758.5453) % 1;
        top = base - amp * (0.3 + hash);
      } else {
        top = base - amp * (0.55 + 0.25 * Math.sin(wx * 0.011 + seed) + 0.15 * Math.sin(wx * 0.037 + seed * 2) + 0.05 * Math.sin(wx * 0.11));
      }
      c.fillRect(x, top, step, horizon - top + 2);
    }
  };
  const city = g.stage.background === 'city';
  layer(0.25, horizon, h * 0.22, pal.far, city, 1);
  layer(0.6, horizon, h * 0.12, pal.near, city, 4);
}

export function render(c: CanvasRenderingContext2D, g: Game) {
  const { w, h } = view;
  const segs = g.track.segments;
  const pal = g.stage.palette;
  c.save();
  if (g.shake) c.translate(Math.round((Math.random() - 0.5) * 3), Math.round((Math.random() - 0.5) * 2));

  drawBackground(c, g);

  const base = g.findSegment(g.position);
  const basePct = (g.position % SEG_LEN) / SEG_LEN;
  const pSeg = g.findSegment(g.playerZ);
  const pPct = (g.playerZ % SEG_LEN) / SEG_LEN;
  const playerY = lerp(pSeg.p1.world.y, pSeg.p2.world.y, pPct);
  const end = Math.min(segs.length, base.index + DRAW_DIST);

  // distribui os carros pelos segmentos visíveis
  for (let i = base.index; i < end; i++) segs[i].cars.length = 0;
  const all: { z: number }[] = [...g.traffic];
  if (g.mode !== 'menu') all.push(g.rival);
  for (const car of all) {
    const idx = Math.floor(car.z / SEG_LEN);
    if (idx >= base.index && idx < end) segs[idx].cars.push(car);
  }

  let maxy = h;
  let x = 0;
  let dx = -(base.curve * basePct);
  for (let i = base.index; i < end; i++) {
    const s = segs[i];
    s.clip = maxy;
    project(s.p1, g.playerX * ROAD_W - x, playerY + CAM_H, g.position);
    project(s.p2, g.playerX * ROAD_W - x - dx, playerY + CAM_H, g.position);
    x += dx;
    dx += s.curve;
    if (s.p1.camera.z <= CAM_DEPTH || s.p2.screen.y >= s.p1.screen.y || s.p2.screen.y >= maxy) continue;
    drawSegment(c, s, pal);
    maxy = s.p1.screen.y;
  }

  // objetos e carros, do fundo para a frente; o carro do jogador entra na profundidade certa
  let playerDrawn = false;
  for (let i = end - 1; i > base.index; i--) {
    const s = segs[i];
    if (!playerDrawn && i <= pSeg.index) {
      drawPlayer(c, g);
      playerDrawn = true;
    }
    if (s.p1.camera.z <= CAM_DEPTH * 2) continue;
    c.save();
    c.beginPath();
    c.rect(0, 0, w, s.clip);
    c.clip();
    for (const sp of s.sprites) {
      const def = SPRITES[sp.kind];
      const sc = s.p1.screen.scale;
      const sw = (def.w * sc * w) / 2;
      const sh = (def.h * sc * w) / 2;
      const sx = s.p1.screen.x + (sc * sp.offset * ROAD_W * w) / 2;
      if (sx + sw / 2 < 0 || sx - sw / 2 > w || sw < 1) continue;
      def.draw(c, sx, s.p1.screen.y, sw, sh, sp.seed);
    }
    for (const car of s.cars) {
      const pct = (car.z % SEG_LEN) / SEG_LEN;
      const sc = lerp(s.p1.screen.scale, s.p2.screen.scale, pct);
      const isRival = car === g.rival;
      const t = car as TrafficCar;
      const cw = (((isRival || !t.truck) ? CAR_W : TRUCK_W) * sc * w) / 2;
      const cx = lerp(s.p1.screen.x, s.p2.screen.x, pct) + (sc * (isRival ? g.rival.offset : t.offset) * ROAD_W * w) / 2;
      const cy = lerp(s.p1.screen.y, s.p2.screen.y, pct);
      if (isRival) drawCar(c, cx, cy, cw, { color: RIVAL.color, accent: RIVAL.accent, lean: (g.rival.target - g.rival.offset) * 2, brake: g.rival.recover > 0 });
      else drawCar(c, cx, cy, cw, { color: t.color, front: t.speed < 0, truck: t.truck });
    }
    c.restore();
  }

  if (!playerDrawn) drawPlayer(c, g);
  c.restore();

  if (g.mode !== 'menu') drawHud(c, g);
}

function drawPlayer(c: CanvasRenderingContext2D, g: Game) {
  const { w, h } = view;
  const pw = (CAR_W * (CAM_DEPTH / PLAYER_Z) * w) / 2;
  let px = w / 2;
  const bounce = g.speed > 200 && Math.random() < 0.3 ? 1 : 0;
  if (g.crash > 0) px += Math.sin(g.crash * 28) * pw * 0.12;
  if ((g.crash > 0 || g.ghost > 0) && Math.floor((g.crash + g.ghost) * 10) % 2) c.globalAlpha = 0.5;
  drawCar(c, px, h - 6 - bounce, pw, { color: g.car.color, accent: g.car.accent, lean: g.steer, brake: g.braking });
  c.globalAlpha = 1;
}

function text(c: CanvasRenderingContext2D, s: string, x: number, y: number, size: number, color = '#fff', align: CanvasTextAlign = 'left') {
  c.font = `bold ${size}px monospace`;
  c.textAlign = align;
  c.textBaseline = 'top';
  c.lineWidth = Math.max(2, size / 5);
  c.strokeStyle = '#000';
  c.strokeText(s, x, y);
  c.fillStyle = color;
  c.fillText(s, x, y);
}

function drawHud(c: CanvasRenderingContext2D, g: Game) {
  const { w, h } = view;
  const L = 10;
  text(c, `${g.place}º`, L, 6, 26, g.place === 1 ? '#ffd400' : '#ff5a5a');
  text(c, formatTime(g.finishTime >= 0 ? g.finishTime : g.time), L + 44, 8, 12);
  const gap = Math.round((g.playerZ - g.rival.z) * METERS);
  text(c, `RIVAL ${gap >= 0 ? '+' : ''}${gap}m`, L + 44, 22, 10, gap >= 0 ? '#9fff9f' : '#ff9f9f');

  // velocímetro e marcha
  const kmh = Math.round(g.speed * KMH);
  text(c, `${kmh}`, w - 50, 4, 24, '#fff', 'right');
  text(c, 'KM/H', w - 46, 14, 9);
  text(c, `${g.auto ? 'A' : 'M'}${g.gear + 1}`, w - 10, 30, 14, '#ffd400', 'right');
  const blocks = 12;
  const lit = Math.round(Math.min(1, g.rpm) * blocks);
  for (let i = 0; i < blocks; i++) {
    c.fillStyle = i < lit ? (i > 9 ? '#ff3030' : i > 7 ? '#ffcc00' : '#30e060') : 'rgba(0,0,0,0.45)';
    c.fillRect(w - 110 + i * 7, 32, 5, 9);
  }

  // progresso da corrida
  const bx = w / 2 - 70, bw = 140, by = 8;
  c.fillStyle = 'rgba(0,0,0,0.5)';
  c.fillRect(bx - 1, by - 1, bw + 2, 6);
  const prog = (z: number) => bx + bw * Math.max(0, Math.min(1, (z - g.track.startZ) / (g.track.finishZ - g.track.startZ)));
  c.fillStyle = RIVAL.accent;
  c.fillRect(prog(g.rival.z) - 2, by - 2, 4, 8);
  c.fillStyle = g.car.color;
  c.fillRect(prog(g.playerZ) - 2, by - 2, 4, 8);
  c.fillStyle = '#fff';
  c.fillRect(bx + bw, by - 3, 2, 10);

  if (g.mode === 'countdown') {
    const n = Math.ceil(g.countdown);
    text(c, n > 3 ? 'PRONTO?' : `${n}`, w / 2, h * 0.3, n > 3 ? 24 : 48, '#ffd400', 'center');
  } else if (g.mode === 'race' && g.time < 1) {
    text(c, 'VAI!', w / 2, h * 0.3, 48, '#30e060', 'center');
  } else if (g.mode === 'finish') {
    text(c, g.won ? 'VITÓRIA!' : 'DERROTA', w / 2, h * 0.3, 36, g.won ? '#ffd400' : '#ff5a5a', 'center');
  }
  if (g.crash > 0) text(c, 'BATIDA!', w / 2, h * 0.45, 20, '#ff5a5a', 'center');
}
