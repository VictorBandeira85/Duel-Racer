// MINHA GARAGEM visitável: os carros do leitor parados lado a lado num galpão de oficina em pixel art
// (telhado de treliça, parede de zinco, painel de ferramentas, luminária pendurada em cada vaga e piso de
// cimento com as faixas amarelas). Cada carro na lateral com a cor, as rodas, a altura e as peças.
// Rolagem lateral (setas, toque nas pontas, ◀ ▶ do teclado/controle, LB/RB); tocar num carro mostra a
// ficha embaixo, com OFICINA e CORRER. Na carreira: os carros comprados; no Arcade: os preparados.
import { CARS, accelCurve, drawCarSide, type CarSpec } from './cars';
import { KMH, SAFE_W, view } from './config';
import { buildOf, saveCareer, setupOf, tunedCar, wearOf, type CareerSave } from './career';
import { arcadeBuildOf, arcadePrepped, arcadeTuned } from './arcadeprep';
import { buildKey } from './tuning';
import { paintHex } from './paint';
import { classBadge } from './classui';
import { drawUsedSide } from './usedcars';
import { GREY, INK, RED, YELLOW, arrow, ink, kicker, masthead, paper, tag } from './mag';
import { inside, type Focusable, type FocusSet, type Rect } from './ui';
import { openArcadePrep, openCareer, ui as careerUi } from './careerScreens';
import { openIssues, partsLine } from './edicoes';
import type { Actions, AppState, MenuKey } from './screens';
import { ox } from './screens';

export const shed = { mode: 'career' as 'career' | 'arcade', sel: 0, cam: NaN, lastT: 0 };
const BW = 150; // largura de cada vaga
const END = 76; // ponta do galpão antes da primeira e depois da última vaga
const CAR_LEN = 128;
const FLOOR_Y = 152; // chão das rodas
const WALL_Y = 26, WAINS_Y = 98, FLOOR_TOP = 122, SCENE_B = 168;

// botão do menu do Arcade (careerScreens.ts desenha e chama)
export const arcShedRect = (): Rect => ({ x: ox() + 216, y: 211, w: 100, h: 15 });

function shedCars(s: AppState): CarSpec[] {
  if (shed.mode === 'career') {
    const cs = s.career;
    return cs ? CARS.filter((c) => cs.owned.includes(c.id)) : [];
  }
  const prepped = CARS.filter((c) => arcadePrepped(c.id));
  return prepped.length ? prepped : [CARS[s.carIdx] ?? CARS[0]];
}
const activeId = (s: AppState) => (shed.mode === 'career' ? s.career?.car ?? '' : (CARS[s.carIdx] ?? CARS[0]).id);
// carro como ele está: peças, rodas e ajustes (carreira) ou as peças da oficina do Arcade
const tunedCache = new Map<string, CarSpec>();
function look(s: AppState, car: CarSpec): CarSpec {
  if (shed.mode === 'arcade') return arcadeTuned(car);
  const cs = s.career as CareerSave;
  const st = setupOf(cs, car.id), b = buildOf(cs, car.id), w = wearOf(cs, car.id);
  const key = `${car.id}|${st.ratio}${st.susp}${st.rims}|${buildKey(b)}|${w.join()}`;
  let t = tunedCache.get(key);
  if (!t) tunedCache.set(key, (t = tunedCar(car, undefined, st, b, w)));
  return t;
}

export function openShed(s: AppState, a: Actions, mode: 'career' | 'arcade') {
  shed.mode = mode;
  a.go('shed');
  const cars = shedCars(s);
  shed.sel = Math.max(0, cars.findIndex((c) => c.id === activeId(s)));
  shed.cam = NaN; // primeiro quadro: já centrado no carro, sem deslizar
}

const totalW = (n: number) => END * 2 + n * BW;
const bayX = (i: number) => END + i * BW - (Number.isFinite(shed.cam) ? shed.cam : 0);
// (poucos carros: o galpão fica centrado na tela)
const camTarget = (n: number) => (totalW(n) <= view.w ? (totalW(n) - view.w) / 2 : Math.max(0, Math.min(totalW(n) - view.w, END + shed.sel * BW + BW / 2 - view.w / 2)));
const carRect = (i: number): Rect => ({ x: bayX(i) + 8, y: 92, w: BW - 16, h: 64 });
const canScroll = (n: number) => totalW(n) > view.w;
const scrollR = () => ({ prev: { x: 2, y: 66, w: 14, h: 34 } as Rect, next: { x: view.w - 16, y: 66, w: 14, h: 34 } as Rect });
const btns = () => {
  const x = ox();
  return { back: { x: x + 4, y: 211, w: 74, h: 15 } as Rect, mag: { x: x + 82, y: 211, w: 74, h: 15 } as Rect, shop: { x: x + 160, y: 211, w: 76, h: 15 } as Rect, run: { x: x + 240, y: 211, w: 76, h: 15 } as Rect };
};

// ---------- cenário ----------
function shedBackground(c: CanvasRenderingContext2D, n: number, sel: number, t: number) {
  const W = view.w, cam = Number.isFinite(shed.cam) ? shed.cam : 0;
  // telhado: tesouras de ferro sobre o forro escuro
  c.fillStyle = '#231e1a';
  c.fillRect(0, 17, W, WALL_Y - 17);
  c.fillStyle = '#4a3e34';
  c.fillRect(0, WALL_Y - 2, W, 2);
  c.fillRect(0, 18, W, 1);
  for (let x = -((cam) % 20) - 20; x < W + 20; x += 20) {
    const X = Math.round(x);
    for (let k = 0; k < 6; k++) {
      c.fillRect(X + k * 2, 19 + k, 1, 1);
      c.fillRect(X + 20 - k * 2, 19 + k, 1, 1);
    }
  }
  // parede de zinco ondulado
  for (let x = -(cam % 6) - 6; x < W; x += 6) {
    const X = Math.round(x);
    c.fillStyle = '#8c8a80';
    c.fillRect(X, WALL_Y, 3, WAINS_Y - WALL_Y);
    c.fillStyle = '#7a786f';
    c.fillRect(X + 3, WALL_Y, 2, WAINS_Y - WALL_Y);
    c.fillStyle = '#6a685f';
    c.fillRect(X + 5, WALL_Y, 1, WAINS_Y - WALL_Y);
  }
  // emendas das chapas e mancha de umidade embaixo
  c.fillStyle = 'rgba(40,36,30,0.35)';
  c.fillRect(0, 62, W, 1);
  c.fillStyle = 'rgba(60,50,30,0.12)';
  c.fillRect(0, WAINS_Y - 6, W, 6);
  // barrado de blocos de cimento
  c.fillStyle = '#9a9286';
  c.fillRect(0, WAINS_Y, W, FLOOR_TOP - WAINS_Y);
  c.fillStyle = '#7e776c';
  for (let r = 0; r < 4; r++) {
    const y = WAINS_Y + r * 6;
    c.fillRect(0, y, W, 1);
    for (let x = -(cam % 16) - 16 + (r % 2) * 8; x < W; x += 16) c.fillRect(Math.round(x), y, 1, 6);
  }
  c.fillStyle = '#5a554c';
  c.fillRect(0, FLOOR_TOP - 2, W, 2);
  // piso de cimento queimado: mais escuro para perto, juntas e manchas de óleo
  const g = c.createLinearGradient(0, FLOOR_TOP, 0, SCENE_B);
  g.addColorStop(0, '#8a847a');
  g.addColorStop(1, '#5e5950');
  c.fillStyle = g;
  c.fillRect(0, FLOOR_TOP, W, SCENE_B - FLOOR_TOP);
  c.fillStyle = 'rgba(40,36,30,0.3)';
  for (const y of [128, 138, 154]) c.fillRect(0, y, W, 1);
  // ponta esquerda: pilha de pneus e a placa da oficina; ponta direita: armário de ferramentas e macaco
  const lx = END - 66 - cam;
  if (lx > -80) {
    for (let k = 0; k < 4; k++) {
      const X = Math.round(lx + 8 + (k % 2)), Y = FLOOR_Y - 9 - k * 9;
      c.fillStyle = '#1c1c1e';
      c.fillRect(X + 2, Y, 30, 8);
      c.fillRect(X, Y + 1, 34, 6);
      c.fillStyle = '#4a4a50';
      for (let q = 0; q < 6; q++) c.fillRect(X + 4 + q * 5, Y + 1, 2, 1);
      c.fillStyle = '#2e2e32';
      c.fillRect(X + 2, Y + 3, 30, 1);
    }
    sign(c, Math.round(lx + 2), 34);
  }
  const rx = END + n * BW + 10 - cam;
  if (rx < W + 10) {
    const X = Math.round(rx);
    c.fillStyle = '#1a1614';
    c.fillRect(X, FLOOR_Y - 44, 38, 42);
    c.fillStyle = '#b8241e';
    c.fillRect(X + 1, FLOOR_Y - 43, 36, 40);
    c.fillStyle = '#e8463a';
    c.fillRect(X + 1, FLOOR_Y - 43, 36, 1);
    for (let k = 0; k < 5; k++) {
      c.fillStyle = '#7a1612';
      c.fillRect(X + 2, FLOOR_Y - 34 + k * 7, 34, 1);
      c.fillStyle = '#d8d0c0';
      c.fillRect(X + 14, FLOOR_Y - 39 + k * 7, 10, 1);
    }
    c.fillStyle = '#1a1614';
    c.fillRect(X + 3, FLOOR_Y - 2, 4, 2);
    c.fillRect(X + 31, FLOOR_Y - 2, 4, 2);
    // macaco jacaré
    c.fillStyle = '#c8a020';
    c.fillRect(X + 46, FLOOR_Y - 5, 24, 3);
    c.fillRect(X + 48, FLOOR_Y - 9, 3, 4);
    c.fillStyle = '#1a1614';
    c.fillRect(X + 46, FLOOR_Y - 2, 3, 2);
    c.fillRect(X + 66, FLOOR_Y - 2, 3, 2);
    c.fillStyle = '#5a5a60';
    c.fillRect(X + 68, FLOOR_Y - 18, 2, 14);
  }
  // vagas: painel de ferramentas entre elas, faixas amarelas no chão, número pintado
  for (let i = 0; i <= n; i++) {
    const X = Math.round(bayX(i));
    if (X < -60 || X > W + 60) continue;
    if (i > 0 && i < n) pegboard(c, X - 22, 40, i);
    else if (n > 0) pegboard(c, X - 22 + (i === 0 ? 30 : -30), 40, i + 3);
    // faixa amarela em perspectiva (larga perto, estreita no fundo)
    c.fillStyle = '#d8b020';
    for (let y = FLOOR_TOP + 2; y < SCENE_B; y++) {
      const k = (y - FLOOR_TOP) / (SCENE_B - FLOOR_TOP);
      c.fillRect(Math.round(X - k * 10), y, k > 0.5 ? 2 : 1, 1);
    }
  }
  void sel;
  void t;
}
// placa pintada da oficina
function sign(c: CanvasRenderingContext2D, x: number, y: number) {
  c.fillStyle = INK;
  c.fillRect(x - 1, y - 1, 58, 22);
  c.fillStyle = YELLOW;
  c.fillRect(x, y, 56, 20);
  c.fillStyle = RED;
  c.fillRect(x, y, 56, 3);
  ink(c, 'OFICINA', x + 28, y + 5, 5, INK, 'center');
  ink(c, 'DO LEITOR', x + 28, y + 12, 4, INK, 'center');
}
// painel de eucatex furado com ferramentas penduradas (variando por vaga)
function pegboard(c: CanvasRenderingContext2D, x: number, y: number, seed: number) {
  const w = 44, h = 42;
  c.fillStyle = '#5a4026';
  c.fillRect(x - 1, y - 1, w + 2, h + 2);
  c.fillStyle = '#b48a56';
  c.fillRect(x, y, w, h);
  c.fillStyle = '#8a6438';
  for (let yy = y + 3; yy < y + h; yy += 4) for (let xx = x + 3; xx < x + w; xx += 4) c.fillRect(xx, yy, 1, 1);
  const steel = '#c8ccd2', dark = '#3a3a40';
  const tools = [
    () => { // chave de boca
      c.fillStyle = steel; c.fillRect(x + 5, y + 6, 2, 22); c.fillRect(x + 3, y + 4, 6, 3); c.fillRect(x + 3, y + 28, 6, 3);
      c.fillStyle = '#b48a56'; c.fillRect(x + 5, y + 4, 2, 1);
    },
    () => { // martelo
      c.fillStyle = '#8a4a1e'; c.fillRect(x + 13, y + 10, 2, 22);
      c.fillStyle = dark; c.fillRect(x + 10, y + 6, 9, 4);
    },
    () => { // chave de fenda
      c.fillStyle = RED; c.fillRect(x + 21, y + 6, 3, 9);
      c.fillStyle = steel; c.fillRect(x + 22, y + 15, 1, 14);
    },
    () => { // alicate
      c.fillStyle = '#2050a0'; c.fillRect(x + 28, y + 16, 2, 14); c.fillRect(x + 32, y + 16, 2, 14);
      c.fillStyle = steel; c.fillRect(x + 29, y + 8, 4, 8);
    },
    () => { // arco de serra
      c.fillStyle = dark; c.fillRect(x + 4, y + 33, 26, 1); c.fillRect(x + 4, y + 33, 1, 6); c.fillRect(x + 29, y + 33, 1, 6);
      c.fillStyle = steel; c.fillRect(x + 4, y + 38, 26, 1);
      c.fillStyle = '#1a1614'; c.fillRect(x + 30, y + 35, 4, 5);
    },
    () => { // jogo de chaves (fileira)
      for (let k = 0; k < 4; k++) { c.fillStyle = steel; c.fillRect(x + 36 + (k % 2) * 3, y + 6 + k * 2, 1, 10 + k * 3); }
    },
  ];
  tools.forEach((f, i) => (i + seed) % 5 !== 0 && f());
}
// luminária de oficina (cúpula de esmalte verde) e o facho de luz no carro e no chão
function lamp(c: CanvasRenderingContext2D, cx: number, on: boolean, t: number) {
  const X = Math.round(cx);
  c.fillStyle = 'rgba(255,232,170,0.07)';
  c.beginPath();
  c.moveTo(X - 7, 44);
  c.lineTo(X + 7, 44);
  c.lineTo(X + 66, SCENE_B);
  c.lineTo(X - 66, SCENE_B);
  c.closePath();
  c.fill();
  if (on) {
    c.fillStyle = `rgba(255,232,170,${0.1 + Math.sin(t * 3) * 0.01})`;
    c.fill();
  }
  c.fillStyle = on ? 'rgba(255,232,170,0.22)' : 'rgba(255,232,170,0.1)';
  c.beginPath();
  c.ellipse(X, FLOOR_Y + 2, 62, 7, 0, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = '#1a1614';
  c.fillRect(X, 17, 1, 20);
  c.fillStyle = '#2a5236';
  c.fillRect(X - 3, 37, 7, 2);
  c.fillRect(X - 5, 39, 11, 2);
  c.fillRect(X - 8, 41, 17, 2);
  c.fillStyle = '#3e7450';
  c.fillRect(X - 3, 37, 2, 1);
  c.fillStyle = on ? '#fff6d0' : '#e8d8a0';
  c.fillRect(X - 3, 43, 7, 2);
}

// ---------- tela ----------
export function drawShed(c: CanvasRenderingContext2D, s: AppState) {
  const x = ox();
  paper(c);
  const cars = shedCars(s);
  const n = cars.length;
  shed.sel = Math.max(0, Math.min(shed.sel, n - 1));
  // câmera desliza até a vaga escolhida
  const dt = Math.max(0, Math.min(0.1, s.t - shed.lastT));
  shed.lastT = s.t;
  const tgt = camTarget(n);
  shed.cam = Number.isFinite(shed.cam) ? shed.cam + (tgt - shed.cam) * Math.min(1, dt * 9) : tgt;
  if (Math.abs(shed.cam - tgt) < 0.3) shed.cam = tgt;
  c.save();
  c.beginPath();
  c.rect(0, 17, view.w, SCENE_B - 17);
  c.clip();
  shedBackground(c, n, shed.sel, s.t);
  const act = activeId(s);
  cars.forEach((car, i) => {
    const bx = bayX(i);
    if (bx < -BW || bx > view.w + BW) return;
    const cx = bx + BW / 2;
    lamp(c, cx, i === shed.sel, s.t);
    const tuned = look(s, car);
    const paint = paintHex(car.id);
    const wear = shed.mode === 'career' ? wearOf(s.career, car.id) : [];
    if (wear.length) drawUsedSide(c, cx - CAR_LEN / 2, FLOOR_Y, CAR_LEN, tuned, paint, wear, s.t);
    else drawCarSide(c, cx - CAR_LEN / 2, FLOOR_Y, CAR_LEN, tuned, paint);
    // número da vaga pintado no chão (e o carro em uso)
    const lab = `VAGA ${i + 1}${car.id === act ? ' • EM USO' : ''}`;
    c.font = '4px "Press Start 2P", monospace';
    const lw = Math.ceil(c.measureText(lab).width) + 6;
    c.fillStyle = 'rgba(26,22,20,0.85)';
    c.fillRect(Math.round(cx - lw / 2), 158, lw, 8);
    ink(c, lab, Math.round(cx), 160, 4, car.id === act ? YELLOW : '#fff', 'center');
    if (i === shed.sel) {
      // seta amarela pulando em cima do carro escolhido
      const by = 84 + Math.round(Math.abs(Math.sin(s.t * 4)) * -3);
      c.fillStyle = INK;
      c.beginPath();
      c.moveTo(cx - 6, by - 1);
      c.lineTo(cx + 6, by - 1);
      c.lineTo(cx, by + 7);
      c.fill();
      c.fillStyle = YELLOW;
      c.beginPath();
      c.moveTo(cx - 4, by);
      c.lineTo(cx + 4, by);
      c.lineTo(cx, by + 5);
      c.fill();
    }
  });
  c.restore();
  c.fillStyle = INK;
  c.fillRect(0, SCENE_B, view.w, 2);
  masthead(c, 'MINHA GARAGEM');
  kicker(c, shed.mode === 'career' ? 'CARREIRA' : 'ARCADE · PREPARADOS', 4, 20, shed.mode === 'career' ? RED : INK, shed.mode === 'career' ? '#fff' : YELLOW);
  const sr = scrollR();
  if (canScroll(n) && shed.cam > 0.5) arrow(c, sr.prev, 'left');
  if (canScroll(n) && shed.cam < totalW(n) - view.w - 0.5) arrow(c, sr.next, 'right');
  const b = btns();
  tag(c, b.back, '◀ VOLTAR');
  tag(c, b.mag, 'EDIÇÕES');
  tag(c, b.shop, 'OFICINA ▶');
  tag(c, b.run, 'CORRER ▶');
  const car = cars[shed.sel];
  if (!car) {
    ink(c, 'GARAGEM VAZIA: COMPRE UM CARRO NO SHOWROOM', x + SAFE_W / 2, 186, 5, GREY, 'center');
    return;
  }
  // ficha do carro escolhido
  const tuned = look(s, car);
  classBadge(c, x + 4, 173, tuned, false, 9);
  ink(c, car.name.toUpperCase(), x + 17, 174, 8, INK);
  ink(c, `${shed.sel + 1} DE ${n}`, x + SAFE_W - 4, 175, 5, GREY, 'right');
  const cv = Math.round((parseInt(car.power) || 0) * (tuned.accel / car.accel));
  const t100 = accelCurve(tuned, 30).t100 || tuned.zeroTo100;
  ink(c, `${cv} cv  •  ${Math.round(tuned.maxSpeed * KMH)} km/h  •  0-100 em ${t100.toFixed(1).replace('.', ',')} s`, x + 4, 186, 5, INK);
  const b0 = shed.mode === 'career' ? buildOf(s.career as CareerSave, car.id) : arcadeBuildOf(car.id);
  let parts = partsLine(car, b0) || 'de fábrica';
  c.font = '4px "Press Start 2P", monospace';
  const maxW = SAFE_W - 8 - 26;
  if (c.measureText(parts).width > maxW) {
    while (parts.length > 4 && c.measureText(`${parts}…`).width > maxW) parts = parts.slice(0, -1);
    parts = `${parts.trimEnd()}…`;
  }
  ink(c, 'PEÇAS', x + 4, 197, 4, RED);
  ink(c, parts, x + 30, 197, 4, GREY);
  if (shed.mode === 'arcade' && !arcadePrepped(car.id)) ink(c, 'Nenhum carro preparado: monte o seu na OFICINA', x + SAFE_W / 2, 204, 4, GREY, 'center');
}

function step(s: AppState, d: number) {
  const n = shedCars(s).length;
  if (n) shed.sel = (shed.sel + d + n) % n;
}
function goShop(s: AppState, a: Actions) {
  const car = shedCars(s)[shed.sel];
  if (!car) return;
  if (shed.mode === 'arcade') return openArcadePrep(s, a, car.id);
  careerUi.garage = Math.max(0, CARS.filter((c) => s.career!.owned.includes(c.id)).findIndex((c) => c.id === car.id));
  careerUi.prep = false;
  careerUi.rimPick = false;
  a.go('garage');
}
function goRun(s: AppState, a: Actions) {
  const car = shedCars(s)[shed.sel];
  if (!car) return;
  if (shed.mode === 'arcade') {
    s.carIdx = Math.max(0, CARS.indexOf(car));
    s.mode = 'arcade';
    return a.go('opponent');
  }
  const cs = s.career!;
  if (cs.car !== car.id) {
    cs.car = car.id;
    saveCareer(cs);
  }
  openCareer(s, a);
}
const goBack = (s: AppState, a: Actions) => a.go(shed.mode === 'career' && s.career ? 'careerMenu' : 'arcadeMenu');

export function tapShed(s: AppState, a: Actions, x: number, y: number) {
  const b = btns(), sr = scrollR(), n = shedCars(s).length;
  if (inside(x, y, b.back)) return goBack(s, a);
  if (inside(x, y, b.mag)) return openIssues(s, a, 'shed');
  if (inside(x, y, b.shop)) return goShop(s, a);
  if (inside(x, y, b.run)) return goRun(s, a);
  if (canScroll(n) && inside(x, y, sr.prev) && shed.cam > 0.5) return step(s, -1);
  if (canScroll(n) && inside(x, y, sr.next) && shed.cam < totalW(n) - view.w - 0.5) return step(s, 1);
  for (let i = 0; i < n; i++) if (inside(x, y, carRect(i))) {
    shed.sel = i;
    return;
  }
}
export function keyShed(s: AppState, a: Actions, k: MenuKey) {
  if (k === 'back') return goBack(s, a);
  if (k === 'prevTab' || k === 'nextTab') step(s, k === 'nextTab' ? 1 : -1);
}
export function shedFocusables(s: AppState, a: Actions): FocusSet {
  const b = btns();
  const items: Focusable[] = [
    { r: { x: 18, y: 80, w: view.w - 36, h: 78 }, is: () => true, lr: (d) => step(s, d), act: () => goShop(s, a) }, // (a seta amarela já marca o carro)
    { r: b.back, act: () => goBack(s, a) },
    { r: b.mag, act: () => openIssues(s, a, 'shed') },
    { r: b.shop, act: () => goShop(s, a) },
    { r: b.run, act: () => goRun(s, a) },
  ];
  return { key: 'shed', items, def: 0 };
}
