import { RIVAL_STYLE } from './race';
import type { CareerSave, EventResult } from './career';
import { drawCareerScreen, keyCareerScreen, openCareer, tapCareerScreen } from './careerScreens';
import { PAINTS, nearestPaint, paintHex, paintIdx, setPaint } from './paint';
import { KMH, SAFE_W, view } from './config';
import { CARS, accelCurve, drawCar, drawCarSide, layout, type CarSpec } from './cars';
import { COURSES, type Course } from './courses';
import { THEMES } from './themes';
import { dither, inside, panel, text, type Rect } from './ui';
import { formatTime, shade } from './util';

export type ScreenId = 'title' | 'options' | 'car' | 'opponent' | 'course' | 'race' | 'gas' | 'end' | 'scores'
  | 'career' | 'event' | 'garage' | 'dealer' | 'careerEnd';
export type MenuKey = 'left' | 'right' | 'up' | 'down' | 'ok' | 'back';

export interface StageResult { time: number; rival: number; clean: boolean; crashes: number; tickets: number; fines?: number }

export interface AppState {
  screen: ScreenId;
  t: number;
  sel: number;
  auto: boolean;
  sound: boolean;
  music: boolean;
  carIdx: number;
  oppIdx: number; // 0..2 = carro rival, 3 = contra o relógio
  courseIdx: number;
  scoreCourse: number;
  lives: number;
  results: StageResult[];
  gameOver: boolean;
  mode: 'arcade' | 'career';
  career: CareerSave | null;
  careerResult: EventResult | null;
}

export interface Actions {
  go: (s: ScreenId) => void;
  startCourse: () => void;
  nextStage: () => void;
  toggleSound: () => void;
  toggleMusic: () => void;
  startEvent: (region: number, event: number) => void;
}

export const ox = () => Math.floor((view.w - SAFE_W) / 2);

export interface ScoreEntry { time: number; car: string; won: boolean }
export function loadScores(course: Course): ScoreEntry[] {
  try {
    return JSON.parse(localStorage.getItem(`duel-racer:scores:${course.id}`) || '[]');
  } catch {
    return [];
  }
}
export function saveScore(course: Course, e: ScoreEntry) {
  const list = [...loadScores(course), e].sort((a, b) => a.time - b.time).slice(0, 5);
  try {
    localStorage.setItem(`duel-racer:scores:${course.id}`, JSON.stringify(list));
  } catch {
    /* sem armazenamento */
  }
  return list;
}

// ---------- tela título: placas de rodovia ----------
const titleSigns = () => {
  const x = ox();
  return [0, 1, 2, 3].map((i): Rect => ({ x: x + 6 + i * 78, y: 104, w: 74, h: 52 }));
};

function sky(c: CanvasRenderingContext2D, top: string, bottom: string, y1: number) {
  const g = c.createLinearGradient(0, 0, 0, y1);
  g.addColorStop(0, top);
  g.addColorStop(1, bottom);
  c.fillStyle = g;
  c.fillRect(0, 0, view.w, y1);
}

function cloud(c: CanvasRenderingContext2D, x: number, y: number, s: number) {
  c.fillStyle = '#f4f8ff';
  for (const [dx, dy, r] of [[0, 0, 10], [12, -4, 12], [26, 0, 9], [14, 4, 10], [-10, 3, 7]]) {
    c.beginPath();
    c.ellipse(x + dx * s, y + dy * s, r * s * 1.6, r * s * 0.7, 0, 0, Math.PI * 2);
    c.fill();
  }
}

export function drawRoadScene(c: CanvasRenderingContext2D, t: number) {
  const { w, h } = view;
  const hz = 158;
  sky(c, '#5a9ae8', '#dce8f6', hz);
  cloud(c, w * 0.25 - ((t * 4) % 60), 30, 1.2);
  cloud(c, w * 0.7 - ((t * 3) % 60), 22, 1.6);
  cloud(c, w * 0.5 - ((t * 5) % 60), 70, 0.9);
  // montanhas nevadas
  for (let i = -1; i < w / 34 + 1; i++) {
    const mx = i * 34 + 10, mh = 18 + ((i * 37) % 13);
    c.fillStyle = '#8a8e98';
    c.beginPath();
    c.moveTo(mx - 24, hz);
    c.lineTo(mx, hz - mh);
    c.lineTo(mx + 24, hz);
    c.fill();
    c.fillStyle = '#e8ecf2';
    c.beginPath();
    c.moveTo(mx - 7, hz - mh + 6);
    c.lineTo(mx, hz - mh);
    c.lineTo(mx + 7, hz - mh + 6);
    c.fill();
  }
  c.fillStyle = dither(c, '#1e6a1e', '#2e8a2a');
  c.fillRect(0, hz, w, h - hz);
  c.fillStyle = '#1e1e22';
  c.beginPath();
  c.moveTo(w / 2 - 4, hz);
  c.lineTo(w / 2 + 4, hz);
  c.lineTo(w / 2 + w * 0.62, h);
  c.lineTo(w / 2 - w * 0.62, h);
  c.fill();
  c.strokeStyle = '#8a8a8a';
  c.lineWidth = 2;
  for (const s of [-1, 1]) {
    c.beginPath();
    c.moveTo(w / 2 + s * 3, hz);
    c.lineTo(w / 2 + s * w * 0.5, h);
    c.stroke();
  }
  // faixa central animada
  c.fillStyle = '#e8b818';
  for (let i = 0; i < 12; i++) {
    const f = ((i + t * 2) % 12) / 12;
    const f2 = Math.min(1, f + 0.04);
    const y1 = hz + (h - hz) * f * f, y2 = hz + (h - hz) * f2 * f2;
    const w1 = 0.5 + f * 4, w2 = 0.5 + f2 * 4;
    c.beginPath();
    c.moveTo(w / 2 - w1, y1);
    c.lineTo(w / 2 + w1, y1);
    c.lineTo(w / 2 + w2, y2);
    c.lineTo(w / 2 - w2, y2);
    c.fill();
  }
}

function sign(c: CanvasRenderingContext2D, r: Rect, lines: string[], hot: boolean) {
  panel(c, r, '#3c2f7a', hot ? '#ffd400' : '#1c1440', 'rgba(255,255,255,0.3)');
  c.strokeStyle = '#c8c0f0';
  c.lineWidth = 1;
  c.strokeRect(r.x + 3.5, r.y + 3.5, r.w - 7, r.h - 7);
  lines.forEach((l, i) => text(c, l, r.x + r.w / 2, r.y + r.h / 2 - lines.length * 6 + i * 13 + 2, 8, '#e8e4ff', 'center', null));
}

function drawTitle(c: CanvasRenderingContext2D, s: AppState) {
  const { w } = view;
  drawRoadScene(c, s.t);
  // pórtico
  c.fillStyle = '#b8b8c0';
  c.fillRect(0, 118, w, 4);
  c.fillRect(0, 138, w, 4);
  for (let x = 0; x < w; x += 16) {
    c.fillRect(x, 118, 2, 24);
    c.beginPath();
    c.moveTo(x, 122);
    c.lineTo(x + 16, 138);
    c.lineTo(x + 16, 140);
    c.lineTo(x, 124);
    c.fill();
  }
  const labels = [['OPÇÕES'], ['ARCADE'], ['CARREIRA'], ['RECORDES']];
  titleSigns().forEach((r, i) => sign(c, r, labels[i], s.sel === i && Math.floor(s.t * 3) % 2 === 0));
  text(c, 'DUEL RACER', w / 2, 44, 24, '#ffd400', 'center', '#7a1010');
  text(c, 'O DUELO NA ESTRADA', w / 2, 76, 8, '#fff', 'center', '#203060');
}

function tapTitle(s: AppState, a: Actions, x: number, y: number) {
  titleSigns().forEach((r, i) => {
    if (inside(x, y, r)) activateTitle(s, i, a);
  });
}
function activateTitle(s: AppState, i: number, a: Actions) {
  if (i === 2) return openCareer(s, a);
  if (i === 1) s.mode = 'arcade';
  a.go((['options', 'car', 'career', 'scores'] as ScreenId[])[i]);
}

// ---------- opções ----------
const optionRects = () => [0, 1, 2, 3].map((i): Rect => ({ x: ox() + 40, y: 58 + i * 42, w: 240, h: 34 }));
function drawOptions(c: CanvasRenderingContext2D, s: AppState) {
  drawRoadScene(c, s.t);
  text(c, 'OPÇÕES', view.w / 2, 30, 16, '#ffd400', 'center', '#3a1060');
  const labels = [`CÂMBIO: ${s.auto ? 'AUTOMÁTICO' : 'MANUAL'}`, `SOM: ${s.sound ? 'LIGADO' : 'DESLIGADO'}`, `MÚSICA: ${s.music ? 'LIGADA' : 'DESLIGADA'}`, 'VOLTAR'];
  optionRects().forEach((r, i) => sign(c, r, [labels[i]], s.sel === i));
}
function activateOption(s: AppState, a: Actions, i: number) {
  if (i === 0) s.auto = !s.auto;
  else if (i === 1) a.toggleSound();
  else if (i === 2) a.toggleMusic();
  else a.go('title');
}

// ---------- escolha do carro ----------
const carButtons = () => {
  const x = ox();
  return {
    prev: { x: x + 2, y: 50, w: 26, h: 40 },
    next: { x: x + SAFE_W - 28, y: 50, w: 26, h: 40 },
    ok: { x: x + SAFE_W - 78, y: 4, w: 74, h: 18 },
    back: { x: x + 4, y: 4, w: 74, h: 18 },
  };
};

// marca d'água em pixels duros (texto do canvas sai com antialias, que parece borrado)
const marks = new Map<string, HTMLCanvasElement>();
function watermark(label: string): HTMLCanvasElement {
  let cv = marks.get(label);
  if (cv) return cv;
  cv = document.createElement('canvas');
  cv.width = 80;
  cv.height = 16;
  const m = cv.getContext('2d')!;
  m.font = 'italic 12px Georgia, serif';
  m.fillStyle = '#6a5eb0';
  m.fillText(label, 1, 12);
  const img = m.getImageData(0, 0, cv.width, cv.height);
  for (let i = 3; i < img.data.length; i += 4) img.data[i] = img.data[i] >= 100 ? 255 : 0;
  m.putImageData(img, 0, 0);
  marks.set(label, cv);
  return cv;
}

export function purpleBg(c: CanvasRenderingContext2D, label: string) {
  const { w, h } = view;
  c.fillStyle = '#4e4290';
  c.fillRect(0, 0, w, h);
  const mark = watermark(label);
  for (let row = 0; row < 12; row++) for (let col = -1; col < w / 86 + 1; col++) c.drawImage(mark, col * 86 + (row % 2) * 43 - 1, 2 + row * 15);
}

export function smallButton(c: CanvasRenderingContext2D, r: Rect, label: string, hot = false) {
  panel(c, r, hot ? '#ffd400' : '#2a2060', '#120c30');
  text(c, label, r.x + r.w / 2, r.y + r.h / 2 - 4, 8, hot ? '#200' : '#fff', 'center', null);
}

// quadradinhos de cor, à direita do nome do carro
const swatches = (): Rect[] => PAINTS.map((_, i) => ({ x: ox() + 4 + 180 + i * 12, y: 116 + 8, w: 9, h: 11 }));

function drawCarSelect(c: CanvasRenderingContext2D, s: AppState) {
  const car = CARS[s.carIdx];
  const x = ox();
  purpleBg(c, 'Duel Racer');
  drawCarSide(c, x + 30, 108, 260, car, paintHex(car.id));
  const b = carButtons();
  smallButton(c, b.prev, '◀');
  smallButton(c, b.next, '▶');
  smallButton(c, b.ok, 'OK ▶', Math.floor(s.t * 2) % 2 === 0);
  smallButton(c, b.back, '◀ VOLTAR');

  const p: Rect = { x: x + 4, y: 116, w: SAFE_W - 8, h: 120 };
  panel(c, p, '#8c84c8', '#2a2060');
  panel(c, { x: p.x + 8, y: p.y + 6, w: 130, h: 16 }, '#a8a0e0', '#2a2060');
  text(c, car.name, p.x + 73, p.y + 10, 8, '#1a1040', 'center', null);
  text(c, `${s.carIdx + 1}/${CARS.length}`, p.x + 150, p.y + 10, 8, '#2a2060', 'left', null);
  // cores da carroceria (sem escolha, fica marcada a mais parecida com a original)
  const cur = paintIdx(car.id) ?? nearestPaint(car.color);
  swatches().forEach((r, i) => {
    c.fillStyle = i === cur ? '#ffffff' : '#1a1040';
    c.fillRect(r.x - 1, r.y - 1, r.w + 2, r.h + 2);
    c.fillStyle = PAINTS[i].hex;
    c.fillRect(r.x, r.y, r.w, r.h);
    if (i === cur) {
      c.fillStyle = '#1a1040';
      c.fillRect(r.x - 1, r.y + r.h + 2, r.w + 2, 1);
    }
  });
  const { pts } = accelCurve(car);
  const rows: [string, string][] = [
    ['Preço', car.price], ['Motor', car.engine], ['Layout', layout(car)], ['Potência', car.power],
    ['Peso', `${car.mass.toLocaleString('pt-BR')} kg`], ['Câmbio', `${car.gears.length} marchas`],
    ['0-100', `${car.zeroTo100.toFixed(1).replace('.', ',')} s`], ['Máxima', `${Math.round(car.maxSpeed * KMH)} km/h`],
  ];
  rows.forEach(([k, v], i) => {
    const yy = p.y + 28 + i * 11;
    text(c, k + ':', p.x + 84, yy, 8, '#2a2060', 'right', null);
    text(c, v, p.x + 90, yy, 8, '#100830', 'left', null);
  });
  // gráfico de aceleração
  const g: Rect = { x: p.x + p.w - 86, y: p.y + 28, w: 78, h: 84 };
  panel(c, g, '#6e66b0', '#2a2060');
  c.strokeStyle = '#8a82c8';
  c.lineWidth = 1;
  for (let i = 1; i < 4; i++) {
    c.beginPath();
    c.moveTo(g.x, g.y + (g.h * i) / 4 + 0.5);
    c.lineTo(g.x + g.w, g.y + (g.h * i) / 4 + 0.5);
    c.stroke();
  }
  c.strokeStyle = '#fff';
  c.beginPath();
  pts.forEach((v, i) => c.lineTo(g.x + (i / (pts.length - 1)) * g.w, g.y + g.h - (v / 340) * g.h));
  c.stroke();
  text(c, 'km/h x s', g.x + g.w / 2, g.y + g.h - 9, 5, '#e0dcff', 'center', null);
}

// ---------- escolha do adversário ----------
const OPP_N = CARS.length + 1; // carros + relógio
const oppCells = () => {
  const x = ox() + 26, y = 40;
  return Array.from({ length: OPP_N }, (_, i): Rect => ({ x: x + (i % 3) * 90, y: y + Math.floor(i / 3) * 64, w: 88, h: 62 }));
};

function stopwatch(c: CanvasRenderingContext2D, x: number, y: number, r: number) {
  c.strokeStyle = '#9a9aa0';
  c.lineWidth = 3;
  c.beginPath();
  c.moveTo(x - r * 1.6, y - r * 0.4);
  c.bezierCurveTo(x - r * 2.2, y - r * 2, x - r * 0.4, y - r * 2.2, x, y - r);
  c.stroke();
  c.fillStyle = '#e8c018';
  c.beginPath();
  c.arc(x, y, r, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = '#7a7a80';
  c.fillRect(x - r * 0.6, y - r * 0.35, r * 1.2, r * 0.6);
  c.fillStyle = '#c8d0c0';
  c.fillRect(x - r * 0.5, y - r * 0.27, r, r * 0.44);
  c.fillStyle = '#9a9aa0';
  for (const dx of [-0.6, 0, 0.6]) c.fillRect(x + dx * r - 3, y + r * 0.6, 6, 5);
}

function drawOpponent(c: CanvasRenderingContext2D, s: AppState) {
  const { w, h } = view;
  c.fillStyle = '#000';
  c.fillRect(0, 0, w, h);
  c.strokeStyle = '#d8b018';
  c.lineWidth = 10;
  c.beginPath();
  c.moveTo(w * 0.6, 0);
  c.bezierCurveTo(w * 0.1, 30, -20, 120, w * 0.45, h + 20);
  c.stroke();
  c.lineWidth = 4;
  c.beginPath();
  c.moveTo(w, 20);
  c.bezierCurveTo(w * 0.3, 40, 0, 140, w * 0.62, h + 10);
  c.stroke();
  const x = ox();
  panel(c, { x: x + 20, y: 22, w: 280, h: 212 }, '#4e4290', '#201850');
  text(c, 'ESCOLHA O ADVERSÁRIO', x + 160, 28, 8, '#d8d0ff', 'center', null);
  oppCells().forEach((r, i) => {
    const hot = s.sel === i;
    c.fillStyle = hot ? '#6a5ec0' : '#4e4290';
    c.fillRect(r.x, r.y, r.w, r.h);
    c.strokeStyle = hot ? '#fff' : '#2a2060';
    c.lineWidth = hot ? 2 : 1;
    c.strokeRect(r.x + 1, r.y + 1, r.w - 2, r.h - 2);
    if (i < CARS.length) {
      const car = CARS[i];
      drawCar(c, r.x + r.w / 2, r.y + 44, 58, { color: car.color, rear: car.rear });
      text(c, car.name, r.x + r.w / 2, r.y + 48, 5, '#fff', 'center', '#1a1040');
      const st = RIVAL_STYLE[car.id] ?? 'cauteloso';
      const [label, col] = st === 'agressivo' ? ['AGRESSIVO', '#ff7a6a'] : st === 'cauteloso' ? ['CAUTELOSO', '#8aff8a'] : ['IMPREVISÍVEL', '#ffe060'];
      text(c, label, r.x + r.w / 2, r.y + 55, 5, col, 'center', '#1a1040');
    } else {
      stopwatch(c, r.x + r.w / 2 + 8, r.y + 26, 13);
      text(c, 'RELÓGIO', r.x + r.w / 2, r.y + 50, 5, '#fff', 'center', '#1a1040');
    }
  });
}

// ---------- escolha do percurso ----------
const courseRects = () => [0, 1, 2, 3].map((i): Rect => ({ x: ox() + 8, y: 26 + i * 52, w: SAFE_W - 16, h: 46 }));

function drawCourseStrip(c: CanvasRenderingContext2D, r: Rect, course: Course, t: number) {
  c.save();
  c.beginPath();
  c.roundRect(r.x, r.y, r.w, r.h, 8);
  c.clip();
  const n = course.stages.length;
  const sw = r.w / n;
  course.stages.forEach((st, i) => {
    const th = THEMES[st.theme];
    c.fillStyle = st.night ? shade(th.mapColor, -0.5) : th.mapColor;
    c.fillRect(r.x + i * sw, r.y, sw + 1, r.h);
    c.fillStyle = dither(c, 'rgba(0,0,0,0.12)', 'rgba(0,0,0,0)');
    c.fillRect(r.x + i * sw, r.y, sw + 1, r.h);
    const cx = r.x + i * sw + sw / 2;
    if (st.night) {
      c.fillStyle = '#ffe680';
      c.beginPath();
      c.arc(cx + 14, r.y + 10, 5, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = shade(th.mapColor, -0.5);
      c.beginPath();
      c.arc(cx + 16, r.y + 8, 5, 0, Math.PI * 2);
      c.fill();
    }
    if (st.weather) {
      c.fillStyle = '#6a6a78';
      c.beginPath();
      c.ellipse(cx - 12, r.y + 10, 10, 5, 0, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = st.weather === 'snow' ? '#fff' : '#9ac0ff';
      for (let k = 0; k < 4; k++) c.fillRect(cx - 18 + k * 4, r.y + 17 + (k % 2) * 3, 1, 3);
    }
    if (st.theme === 'city') {
      c.fillStyle = st.night ? '#ffd86b' : '#d8d0e8';
      for (let k = 0; k < 4; k++) c.fillRect(cx - 20 + k * 9, r.y + r.h - 18 - (k % 3) * 4, 6, 12 + (k % 3) * 4);
    }
  });
  // estrada
  const wave = (x: number) => r.y + r.h / 2 + Math.sin((x - r.x) * 0.045 * (1 + course.stages[0].curviness * 0.3)) * 8 * (0.6 + course.rivalSkill - 0.9);
  c.strokeStyle = '#3a3a3a';
  c.lineWidth = 6;
  c.beginPath();
  for (let x = r.x; x <= r.x + r.w; x += 2) c.lineTo(x, wave(x));
  c.stroke();
  c.strokeStyle = '#e8c018';
  c.lineWidth = 1;
  c.beginPath();
  for (let x = r.x; x <= r.x + r.w; x += 2) c.lineTo(x, wave(x));
  c.stroke();
  for (let i = 1; i <= n; i++) {
    const gx = r.x + i * sw - 26;
    c.fillStyle = '#1a3aa8';
    c.fillRect(gx - 1, wave(gx) - 15, 22, 9);
    text(c, 'GAS', gx + 10, wave(gx) - 14, 5, '#ffd400', 'center', null);
  }
  c.restore();
  void t;
}

function drawCourse(c: CanvasRenderingContext2D, s: AppState) {
  const { w, h } = view;
  c.fillStyle = '#2a2050';
  c.fillRect(0, 0, w, h);
  text(c, 'ESCOLHA O PERCURSO', w / 2, 8, 8, '#a8a0d8', 'center', null);
  courseRects().forEach((r, i) => {
    const hot = s.sel === i;
    drawCourseStrip(c, r, COURSES[i], s.t);
    c.strokeStyle = hot ? '#ffd400' : '#120c30';
    c.lineWidth = 2;
    c.beginPath();
    c.roundRect(r.x, r.y, r.w, r.h, 8);
    c.stroke();
    text(c, `${COURSES[i].name} - ${COURSES[i].level}`, r.x + r.w / 2, r.y + r.h / 2 - 4, 8, '#fff', 'center', '#000');
  });
}

// ---------- posto de gasolina ----------
function drawGas(c: CanvasRenderingContext2D, s: AppState, car: CarSpec) {
  const { w, h } = view;
  const x = ox();
  c.fillStyle = '#2a5ae0';
  c.fillRect(0, 0, w, 150);
  c.fillStyle = '#3a7a3a';
  c.beginPath();
  c.moveTo(0, 110);
  for (let i = 0; i <= w; i += 10) c.lineTo(i, 104 + Math.sin(i * 0.03) * 6);
  c.lineTo(w, 150);
  c.lineTo(0, 150);
  c.fill();
  c.fillStyle = dither(c, '#2a8a2a', '#38a034');
  c.fillRect(0, 140, w, 60);
  // placa
  panel(c, { x: x + 104, y: 6, w: 112, h: 38 }, '#f0f4ff', '#6a8ac0');
  text(c, 'POSTO', x + 160, 12, 8, '#c02020', 'center', null);
  text(c, 'DUELO', x + 160, 24, 16, '#1a3aa8', 'center', null);
  // prédio
  c.fillStyle = '#ececec';
  c.fillRect(x + 48, 66, 224, 96);
  c.fillStyle = '#c82020';
  c.fillRect(x + 36, 56, 248, 12);
  c.fillStyle = '#e04040';
  c.fillRect(x + 36, 56, 248, 3);
  c.fillStyle = '#202020';
  c.fillRect(x + 54, 68, 6, 94);
  c.fillRect(x + 260, 68, 6, 94);
  c.fillStyle = '#2a4a9a';
  c.fillRect(x + 72, 84, 40, 30);
  c.fillRect(x + 168, 84, 40, 30);
  c.fillStyle = '#3a3a48';
  c.fillRect(x + 124, 82, 32, 60);
  text(c, 'ABERTO', x + 140, 92, 5, '#ffd400', 'center', null);
  // gelo
  c.fillStyle = '#f8f8ff';
  c.fillRect(x + 66, 122, 46, 40);
  text(c, 'GELO', x + 89, 136, 8, '#3a6ad0', 'center', null);
  // bombas
  for (const bx of [x + 160, x + 196]) {
    c.fillStyle = '#c82020';
    c.fillRect(bx, 110, 22, 50);
    c.fillStyle = '#f0f0f0';
    c.fillRect(bx + 4, 116, 14, 10);
    c.fillStyle = '#e8e8e8';
    c.beginPath();
    c.arc(bx + 11, 104, 8, 0, Math.PI * 2);
    c.fill();
    text(c, 'GAS', bx + 11, 102, 5, '#555', 'center', null);
  }
  // frentista
  c.fillStyle = '#2a4aa0';
  c.fillRect(x + 222, 118, 16, 30);
  c.fillStyle = '#e8b890';
  c.fillRect(x + 225, 108, 10, 10);
  c.fillStyle = '#1a3a8a';
  c.fillRect(x + 223, 104, 14, 5);
  // refrigerante
  c.fillStyle = '#c81e1e';
  c.fillRect(x + 268, 96, 22, 66);
  c.save();
  c.translate(x + 279, 100);
  c.font = `8px "Press Start 2P", monospace`;
  c.fillStyle = '#fff';
  c.textAlign = 'center';
  c.textBaseline = 'top';
  'REFRI'.split('').forEach((ch, i) => c.fillText(ch, 0, i * 11));
  c.restore();
  drawCarSide(c, x + 80, 176, 170, car, paintHex(car.id));

  c.fillStyle = '#3a3a3e';
  c.fillRect(0, 186, w, h - 186);
  const r = s.results[s.results.length - 1];
  const lines = [
    r.clean ? 'Trecho limpo! Carro bônus.' : `Batidas: ${r.crashes}   Multas: ${r.tickets}`,
    `Carros restantes: ${s.lives}`,
    r.rival >= 0 ? `Você ${formatTime(r.time)}  Rival ${formatTime(r.rival)}` : `Tempo ${formatTime(r.time)}`,
  ];
  lines.forEach((l, i) => text(c, l, x + 12, 192 + i * 12, 8, '#f0f0f0', 'left', null));
  if (Math.floor(s.t * 2) % 2) text(c, 'TOQUE PARA SEGUIR', w / 2, 230, 5, '#ffd400', 'center', null);
}

// ---------- fim do percurso ----------
function drawEnd(c: CanvasRenderingContext2D, s: AppState) {
  const { w, h } = view;
  purpleBg(c, 'Duel Racer');
  const course = COURSES[s.courseIdx];
  const total = s.results.reduce((a, r) => a + r.time, 0);
  const rival = s.results.every((r) => r.rival >= 0) ? s.results.reduce((a, r) => a + r.rival, 0) : -1;
  const won = rival < 0 ? true : total <= rival;
  const x = ox();
  panel(c, { x: x + 20, y: 30, w: SAFE_W - 40, h: 180 }, '#2a2060', '#100830');
  text(c, s.gameOver ? 'FIM DE JOGO' : 'PERCURSO COMPLETO!', w / 2, 44, 8, s.gameOver ? '#ff5050' : '#30e060', 'center');
  text(c, course.name, w / 2, 62, 8, '#a8a0e0', 'center', null);
  if (!s.gameOver) {
    text(c, `Seu tempo: ${formatTime(total)}`, w / 2, 90, 8, '#fff', 'center', null);
    if (rival >= 0) {
      text(c, `Rival: ${formatTime(rival)}`, w / 2, 106, 8, '#fff', 'center', null);
      text(c, won ? 'VOCÊ VENCEU O DUELO!' : 'O RIVAL VENCEU...', w / 2, 134, 8, won ? '#ffd400' : '#ff7070', 'center');
    }
  } else {
    text(c, `Trechos concluídos: ${s.results.length}/${course.stages.length}`, w / 2, 100, 8, '#fff', 'center', null);
    text(c, 'Seus carros acabaram.', w / 2, 120, 8, '#fff', 'center', null);
  }
  if (Math.floor(s.t * 2) % 2) text(c, 'TOQUE PARA CONTINUAR', w / 2, 190, 8, '#ffd400', 'center', null);
  void h;
}

// ---------- recordes ----------
function drawScores(c: CanvasRenderingContext2D, s: AppState) {
  const { w } = view;
  drawRoadScene(c, s.t);
  const x = ox();
  panel(c, { x: x + 20, y: 16, w: SAFE_W - 40, h: 150 }, '#3c2f7a', '#1c1440');
  text(c, 'RECORDES', w / 2, 24, 8, '#ffd400', 'center', null);
  const course = COURSES[s.scoreCourse];
  text(c, `◀ ${course.name} ▶`, w / 2, 40, 8, '#d8d0ff', 'center', null);
  const list = loadScores(course);
  if (!list.length) text(c, 'Nenhum recorde ainda', w / 2, 90, 8, '#a8a0d8', 'center', null);
  list.forEach((e, i) => {
    const y = 60 + i * 18;
    text(c, `${i + 1}. ${formatTime(e.time)}`, x + 36, y, 8, e.won ? '#fff' : '#a8a0d8', 'left', null);
    text(c, e.car, x + SAFE_W - 36, y, 8, '#d8d0ff', 'right', null);
  });
}

// ---------- roteamento ----------
export function drawScreen(c: CanvasRenderingContext2D, s: AppState) {
  switch (s.screen) {
    case 'title': return drawTitle(c, s);
    case 'options': return drawOptions(c, s);
    case 'car': return drawCarSelect(c, s);
    case 'opponent': return drawOpponent(c, s);
    case 'course': return drawCourse(c, s);
    case 'gas': return drawGas(c, s, CARS[s.carIdx]);
    case 'end': return drawEnd(c, s);
    case 'scores': return drawScores(c, s);
    default: return drawCareerScreen(c, s);
  }
}

export function tapScreen(s: AppState, a: Actions, x: number, y: number) {
  if (['career', 'event', 'garage', 'dealer', 'careerEnd'].includes(s.screen)) return tapCareerScreen(s, a, x, y);
  switch (s.screen) {
    case 'title': return tapTitle(s, a, x, y);
    case 'options':
      optionRects().forEach((r, i) => inside(x, y, r) && activateOption(s, a, i));
      return;
    case 'car': {
      const b = carButtons();
      if (inside(x, y, b.prev)) s.carIdx = (s.carIdx + CARS.length - 1) % CARS.length;
      else if (inside(x, y, b.next)) s.carIdx = (s.carIdx + 1) % CARS.length;
      else if (inside(x, y, b.ok)) a.go('opponent');
      else if (inside(x, y, b.back)) a.go('title');
      else {
        // toque com folga em volta de cada cor (dedos maiores que os quadradinhos)
        swatches().forEach((r, i) => {
          if (inside(x, y, { x: r.x - 1.5, y: r.y - 8, w: r.w + 3, h: r.h + 16 })) setPaint(CARS[s.carIdx].id, i);
        });
      }
      return;
    }
    case 'opponent':
      oppCells().forEach((r, i) => {
        if (inside(x, y, r)) {
          s.oppIdx = i;
          a.go('course');
        }
      });
      return;
    case 'course':
      courseRects().forEach((r, i) => {
        if (inside(x, y, r)) {
          s.courseIdx = i;
          a.startCourse();
        }
      });
      return;
    case 'gas': return a.nextStage();
    case 'end':
      s.scoreCourse = s.courseIdx;
      return a.go('scores');
    case 'scores':
      if (y < 60 && x < view.w / 2) s.scoreCourse = (s.scoreCourse + COURSES.length - 1) % COURSES.length;
      else if (y < 60) s.scoreCourse = (s.scoreCourse + 1) % COURSES.length;
      else a.go('title');
      return;
  }
}

export function keyScreen(s: AppState, a: Actions, k: MenuKey) {
  if (['career', 'event', 'garage', 'dealer', 'careerEnd'].includes(s.screen)) return keyCareerScreen(s, a, k);
  const counts: Partial<Record<ScreenId, number>> = { title: 4, options: 4, opponent: OPP_N, course: 4 };
  const n = counts[s.screen];
  if (s.screen === 'car') {
    if (k === 'left') s.carIdx = (s.carIdx + CARS.length - 1) % CARS.length;
    if (k === 'right') s.carIdx = (s.carIdx + 1) % CARS.length;
    if (k === 'ok') a.go('opponent');
    if (k === 'back') a.go('title');
    return;
  }
  if (s.screen === 'gas') return k === 'ok' && a.nextStage();
  if (s.screen === 'end') return k === 'ok' && tapScreen(s, a, 0, 100);
  if (s.screen === 'scores') {
    if (k === 'left') s.scoreCourse = (s.scoreCourse + COURSES.length - 1) % COURSES.length;
    if (k === 'right') s.scoreCourse = (s.scoreCourse + 1) % COURSES.length;
    if (k === 'ok' || k === 'back') a.go('title');
    return;
  }
  if (!n) return;
  const grid = s.screen === 'opponent';
  if (k === 'left' || (k === 'up' && !grid)) s.sel = (s.sel + n - 1) % n;
  if (k === 'right' || (k === 'down' && !grid)) s.sel = (s.sel + 1) % n;
  if (grid && k === 'up') s.sel = (s.sel + n - 3) % n;
  if (grid && k === 'down') s.sel = (s.sel + 3) % n;
  if (k === 'back') a.go(s.screen === 'course' ? 'opponent' : s.screen === 'opponent' ? 'car' : 'title');
  if (k === 'ok') {
    if (s.screen === 'title') activateTitle(s, s.sel, a);
    else if (s.screen === 'options') activateOption(s, a, s.sel);
    else if (s.screen === 'opponent') {
      s.oppIdx = s.sel;
      a.go('course');
    } else if (s.screen === 'course') {
      s.courseIdx = s.sel;
      a.startCourse();
    }
  }
}
