import { gasQuip } from './score';
import { ghostOn, setGhostOn } from './records';
import { ACHIEVEMENTS, MEDAL_COLOR, loadStats, medalName, medals, takeToast, unlockedAchievements } from './challenges';
import { RIVAL_STYLE } from './race';
import type { CareerSave, EventResult } from './career';
import { drawCareerScreen, keyCareerScreen, openCareer, tapCareerScreen } from './careerScreens';
import { PAINTS, nearestPaint, paintHex, paintIdx, setPaint } from './paint';
import { KMH, SAFE_W, view } from './config';
import { CARS, CLASS_COLOR, accelCurve, drawCar, drawCarDiagonal, drawCarSide, gearbox, layout, perfClass, perfIndex, type CarSpec } from './cars';
import { COURSES, unlockedCourses, withTimeOfDay, type Course } from './courses';
import { classBadge, drawFilter, filterAt, filterRects, filtered, nextFilter, stepCar, type ClassFilter } from './classui';
import { THEMES } from './themes';
import { dither, inside, panel, text, type Rect } from './ui';
import { interiorPhoto } from './cockpit';
import { BLUE, GREY, INK, RED, YELLOW, barcode, box, burst, halftone, headline, ink, kicker, logo, masthead, paper, photo, rule, specRows, stars, tag } from './mag';
import { formatTime, shade } from './util';
import { setEngine, setTires, shiftSound } from './audio';

export type ScreenId = 'title' | 'options' | 'car' | 'opponent' | 'course' | 'race' | 'gas' | 'end' | 'scores' | 'achievements'
  | 'career' | 'event' | 'garage' | 'dealer' | 'careerEnd';
export type MenuKey = 'left' | 'right' | 'up' | 'down' | 'ok' | 'back';

export interface StageResult {
  time: number; rival: number; clean: boolean; crashes: number; tickets: number; fines?: number;
  km: number; top: number; avg: number; score: number; // km/h e pontos do jogador
  rivalTop: number; rivalAvg: number; rivalScore: number;
  best?: number; record?: boolean; // recorde anterior deste trecho com este carro; se bateu
  challenges?: { label: string; done: boolean }[]; medal?: number; medalNew?: boolean; prize?: number; // desafios
}

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
  gasPage: number; // posto: 0 = chegada com o frentista, 1 = resultado do trecho
  arcadeNight: boolean; // Arcade: corrida de dia ou de noite
  carFilter: ClassFilter; // escolha de carro: só uma classe de desempenho (null = todas)
  oppFilter: ClassFilter; // escolha de adversário, idem
  courseTop: number; // primeiro percurso visível na lista
  newMap: string | null; // Arcade: mapa liberado ao concluir o percurso (aviso no fim)
  lockedT: number; // aviso de mapa bloqueado (s restantes)
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

export interface ScoreEntry { time: number; car: string; won: boolean; score?: number }
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

// ---------- tela título: capa da revista ----------
// chamadas da capa (o índice segue a ordem antiga: 0 opções, 1 arcade, 2 carreira, 3 recordes)
const titleSigns = () => {
  const x = ox();
  return [
    { x: x + 166, y: 204, w: 150, h: 30 }, // opções
    { x: x + 4, y: 172, w: 158, h: 30 }, // arcade
    { x: x + 4, y: 204, w: 158, h: 30 }, // carreira
    { x: x + 166, y: 172, w: 150, h: 30 }, // recordes
  ] as Rect[];
};

// carros da capa: os que têm arte (e as vistas de frente e de trás)
const coverCars = () => CARS.filter((c) => c.imgSide && c.rear.img && c.rear.frontImg && !c.arcadeOnly);
const SLIDE_T = 7; // s por edição da capa
const SLIDES = ['test', 'compare', 'angles', 'interior', 'news', 'road'] as const;

// manchetes da página de notícias (algumas com os números do próprio jogador)
function newsLines(slot: number): string[] {
  const st = loadStats();
  const got = Object.keys(unlockedAchievements()).length;
  const pool = [
    'Radares novos na Serra: atenção!',
    'Postos da rodovia abrem 24 horas',
    'Neblina fecha o Vale de madrugada',
    `Leitores já ultrapassaram ${st.passes}`,
    'Chefão do Litoral chama novatos',
    `${unlockedCourses()} roteiros liberados no Arcade`,
    'Túneis da Serra ganham luzes novas',
    `${got} de ${ACHIEVEMENTS.length} conquistas desbloqueadas`,
    'Vetor GSi: o sedã mais veloz?',
    'Pneus de inverno valem na neve?',
    'Polícia agora tem Diablo na pista',
    'Pôr do sol no Cânion vira atração',
  ];
  return [0, 1, 2, 3].map((k) => pool[(slot * 3 + k) % pool.length]);
}

// fundo de estúdio com luz atrás do carro
function studioLight(c: CanvasRenderingContext2D, ph: Rect) {
  const g = c.createRadialGradient(ph.x + ph.w / 2, ph.y + 50, 10, ph.x + ph.w / 2, ph.y + 50, 150);
  g.addColorStop(0, 'rgba(255,255,255,0.35)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = g;
  c.fillRect(ph.x, ph.y, ph.w, ph.h);
}

function drawCoverSlide(c: CanvasRenderingContext2D, s: AppState, ph: Rect, slot: number, u: number) {
  const list = coverCars();
  if (!list.length) return;
  const kind = SLIDES[slot % SLIDES.length];
  const car = list[slot % list.length];
  const other = list[(slot + 3) % list.length] === car ? list[(slot + 1) % list.length] : list[(slot + 3) % list.length];
  const enter = Math.min(1, u * SLIDE_T / 0.5); // entra deslizando no começo de cada edição
  const ease = 1 - (1 - enter) ** 3;
  const p = paintHex(car.id);
  const kmh = (cc: CarSpec) => Math.round(cc.maxSpeed * KMH);
  const mirror = (fn: () => void, cx: number) => {
    c.save();
    c.translate(cx * 2, 0);
    c.scale(-1, 1);
    fn();
    c.restore();
  };
  if (kind === 'test') {
    photo(c, ph, () => {
      studioLight(c, ph);
      drawCarSide(c, ph.x + 32 + (1 - ease) * 260, ph.y + 98, 248, car, p);
    });
    kicker(c, 'TESTE EXCLUSIVO', ph.x + 6, ph.y + 6, RED, '#fff');
    logo(c, car.name.toUpperCase(), ph.x + 6, ph.y + 18, 8, '#fff', INK);
    ink(c, `${car.power} • ${kmh(car)} km/h • 0-100 em ${car.zeroTo100.toFixed(1).replace('.', ',')}s`, ph.x + 6, ph.y + 30, 5, '#fff');
    burst(c, ph.x + ph.w - 30, ph.y + 26, 25, ['20', 'MAPAS', 'NOVOS!'], YELLOW, RED, s.t);
  } else if (kind === 'compare') {
    photo(c, ph, () => {
      studioLight(c, ph);
      const off = (1 - ease) * 160;
      // os dois frente a frente: o da esquerda espelhado
      mirror(() => drawCarSide(c, ph.x + 6 - off, ph.y + 100, 148, car, p), ph.x + 80 - off);
      drawCarSide(c, ph.x + ph.w - 154 + off, ph.y + 100, 148, other, paintHex(other.id));
    });
    kicker(c, 'COMPARATIVO', ph.x + 6, ph.y + 6, BLUE, '#fff');
    logo(c, `${car.name.toUpperCase()} x ${other.name.toUpperCase()}`, ph.x + 6, ph.y + 18, 8, '#fff', INK);
    ink(c, `${car.power} contra ${other.power}: quem leva?`, ph.x + 6, ph.y + 30, 5, '#fff');
    burst(c, ph.x + ph.w / 2, ph.y + 70, 14, ['X'], YELLOW, RED, s.t);
  } else if (kind === 'angles') {
    photo(c, ph, () => {
      studioLight(c, ph);
      drawCarDiagonal(c, ph.x + 14 + (1 - ease) * 200, ph.y + 100, 176, car, p);
    }, ['#6a5a4a', '#d8c8b0']);
    // quadros menores: traseira de face e diagonal de trás
    const a: Rect = { x: ph.x + ph.w - 92, y: ph.y + 8, w: 84, h: 44 };
    const b: Rect = { x: ph.x + ph.w - 92, y: ph.y + 58, w: 84, h: 26 };
    photo(c, a, () => drawCar(c, a.x + a.w / 2, a.y + a.h - 3, 52, { color: car.color, rear: car.rear, paint: p }));
    photo(c, b, () => drawCarDiagonal(c, b.x + 8, b.y + b.h - 2, 62, car, p, true));
    kicker(c, 'POR TODOS OS ÂNGULOS', ph.x + 6, ph.y + 6, RED, '#fff');
    logo(c, car.name.toUpperCase(), ph.x + 6, ph.y + 18, 8, '#fff', INK);
  } else if (kind === 'interior') {
    const img = interiorPhoto(car.id, car.dash);
    photo(c, ph, () => {
      if (img) {
        // enquadra o painel inteiro e aproxima devagar (como câmera em movimento)
        const z = 1 + u * 0.12;
        const w = ph.w * z, h = (w * img.height) / img.width;
        c.drawImage(img, ph.x + (ph.w - w) / 2, ph.y + ph.h - h + 6 * u, w, h);
      } else drawCarSide(c, ph.x + 32, ph.y + 98, 248, car, p);
    }, ['#2a2a30', '#5a5a64']);
    kicker(c, 'POR DENTRO', ph.x + 6, ph.y + 6, INK, YELLOW);
    logo(c, `O PAINEL DO ${car.name.toUpperCase()}`, ph.x + 6, ph.y + 18, 8, '#fff', INK);
  } else if (kind === 'news') {
    photo(c, ph, () => {
      c.fillStyle = '#f8f2e4';
      c.fillRect(ph.x, ph.y, ph.w, ph.h);
    }, ['#f8f2e4', '#f8f2e4']);
    kicker(c, 'NOTÍCIAS DA ESTRADA', ph.x + 6, ph.y + 6, RED, '#fff');
    newsLines(slot).forEach((l, i) => {
      const y = ph.y + 22 + i * 19;
      c.fillStyle = RED;
      c.fillRect(ph.x + 6, y + 1, 3, 3);
      ink(c, l, ph.x + 14, y, 5, INK);
      rule(c, ph.x + 6, y + 11, 178, 'rgba(26,22,20,0.15)');
    });
    const q: Rect = { x: ph.x + ph.w - 112, y: ph.y + 24, w: 104, h: 56 };
    photo(c, q, () => drawCarDiagonal(c, q.x + 6, q.y + q.h - 6, 92, car, p));
    ink(c, `Flagra: ${car.name}`, q.x, q.y - 12, 5, GREY);
  } else {
    // flagra na estrada: o carro de trás, numa reta, com o asfalto passando
    photo(c, ph, () => {
      const hz = ph.y + 40;
      const g = c.createLinearGradient(0, ph.y, 0, hz);
      g.addColorStop(0, '#5a9ae8');
      g.addColorStop(1, '#d8e8f6');
      c.fillStyle = g;
      c.fillRect(ph.x, ph.y, ph.w, hz - ph.y);
      c.fillStyle = '#2e8a2a';
      c.fillRect(ph.x, hz, ph.w, ph.h);
      const cx = ph.x + ph.w / 2;
      c.fillStyle = '#3a3a3e';
      c.beginPath();
      c.moveTo(cx - 4, hz);
      c.lineTo(cx + 4, hz);
      c.lineTo(cx + 190, ph.y + ph.h);
      c.lineTo(cx - 190, ph.y + ph.h);
      c.fill();
      c.fillStyle = YELLOW;
      for (let k = 0; k < 8; k++) {
        const f = ((k + s.t * 3) % 8) / 8, f2 = Math.min(1, f + 0.05);
        const y1 = hz + (ph.h - 40) * f * f, y2 = hz + (ph.h - 40) * f2 * f2;
        c.fillRect(cx - 1 - f * 2, y1, 2 + f * 4, Math.max(1, y2 - y1));
      }
      const bob = Math.round(Math.sin(s.t * 9) * 0.6);
      drawCar(c, cx + Math.sin(s.t * 0.7) * 20, ph.y + 96 + bob, 96, { color: car.color, rear: car.rear, paint: p, brake: Math.floor(s.t) % 4 === 0 });
    });
    kicker(c, 'FLAGRA NA ESTRADA', ph.x + 6, ph.y + 6, INK, YELLOW);
    logo(c, `${car.name.toUpperCase()} A ${kmh(car)}!`, ph.x + 6, ph.y + 18, 8, '#fff', INK);
  }
  // pontinhos das edições
  SLIDES.forEach((_, i) => {
    c.fillStyle = i === slot % SLIDES.length ? RED : 'rgba(26,22,20,0.3)';
    c.fillRect(ph.x + ph.w / 2 - SLIDES.length * 4 + i * 8, ph.y + ph.h + 4, 5, 2);
  });
}
function drawTitle(c: CanvasRenderingContext2D, s: AppState) {
  const { w } = view;
  const x = ox();
  paper(c);
  // topo da capa: faixa vermelha com o logotipo
  c.fillStyle = RED;
  c.fillRect(0, 0, w, 50);
  halftone(c, { x: 0, y: 0, w, h: 50 }, 'rgba(120,0,0,0.35)');
  ink(c, 'Nº 01  •  ANO I  •  OUTUBRO DE 1994', x + 6, 4, 5, '#ffe0a0');
  ink(c, 'Cr$ 2.500,00', x + SAFE_W - 6, 4, 5, '#ffe0a0', 'right');
  logo(c, 'DUEL RACER', w / 2, 14, 24, YELLOW, INK, 'center');
  c.fillStyle = INK;
  c.fillRect(0, 42, w, 9);
  ink(c, 'A REVISTA DO DUELO NA ESTRADA', w / 2, 44, 5, '#fff', 'center');
  // foto da capa: uma "edição" diferente a cada 7 s (teste, comparativo, ângulos, interior,
  // notícias, flagra na estrada), com o carro trocando a cada volta
  const ph: Rect = { x: x + 4, y: 56, w: SAFE_W - 8, h: 108 };
  const t = s.t || 0;
  const slot = Math.floor(t / SLIDE_T);
  drawCoverSlide(c, s, ph, slot, (t % SLIDE_T) / SLIDE_T);
  barcode(c, ph.x + ph.w - 40, ph.y + ph.h - 22);
  // chamadas = menu (o subtítulo muda a cada edição da foto)
  const alt = [
    ['Câmbio, som e controles', 'Ligue o fantasma', 'Botões do seu tamanho'],
    ['20 roteiros para acelerar', 'Túneis, neblina e pôr do sol', 'Libere mapa por mapa'],
    ['Do bairro ao chefão final', 'Os rivais falam tudo', 'Oficina e classificados'],
    ['Os mais rápidos do país', '18 conquistas para caçar', 'Medalhas de ouro em jogo'],
  ];
  const calls: [string, string][] = ['OPÇÕES', 'ARCADE', 'CARREIRA', 'RECORDES'].map((k, i) => [k, alt[i][slot % alt[i].length]]);
  titleSigns().forEach((r, i) => {
    const hot = s.sel === i;
    if (hot) {
      c.fillStyle = 'rgba(208,31,38,0.12)';
      c.fillRect(r.x, r.y, r.w, r.h);
      c.fillStyle = RED;
      c.fillRect(r.x, r.y, 3, r.h);
    }
    kicker(c, calls[i][0], r.x + 7, r.y + 4, hot ? RED : INK, hot ? YELLOW : '#fff');
    ink(c, calls[i][1], r.x + 7, r.y + 17, 5, hot ? RED : INK);
    if (hot && Math.floor(s.t * 3) % 2 === 0) ink(c, '▶', r.x + r.w - 10, r.y + 4, 8, RED);
  });
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
const optionRects = () => [0, 1, 2, 3, 4, 5].map((i): Rect => ({ x: ox() + 40, y: 44 + i * 31, w: 240, h: 27 }));
// tamanho dos botões de toque (direção, acelerador, freio, marchas), salvo no aparelho
const BTN_SIZES = [{ label: 'PEQUENOS', k: 0.8 }, { label: 'MÉDIOS', k: 1 }, { label: 'GRANDES', k: 1.22 }, { label: 'ENORMES', k: 1.45 }];
const BTN_KEY = 'duel-racer:botoes';
function btnSizeIdx() {
  try {
    const raw = localStorage.getItem(BTN_KEY);
    const v = raw === null ? 1 : Number(raw);
    return Number.isInteger(v) && v >= 0 && v < BTN_SIZES.length ? v : 1;
  } catch {
    return 1;
  }
}
export function applyBtnSize() {
  document.documentElement.style.setProperty('--btn', String(BTN_SIZES[btnSizeIdx()].k));
}
function setBtnSize(i: number) {
  try {
    localStorage.setItem(BTN_KEY, String(i));
  } catch { /* sem armazenamento: vale só nesta sessão */ }
  document.documentElement.style.setProperty('--btn', String(BTN_SIZES[i].k));
}

function drawOptions(c: CanvasRenderingContext2D, s: AppState) {
  const x = ox();
  paper(c);
  masthead(c, 'AJUSTES DO LEITOR');
  kicker(c, 'EXPEDIENTE', x + 4, 22, RED, '#fff');
  ink(c, 'Toque num item para mudar', x + 70, 24, 5, GREY);
  const items: [string, string][] = [
    ['CÂMBIO', s.auto ? 'AUTOMÁTICO' : 'MANUAL'], ['SOM', s.sound ? 'LIGADO' : 'DESLIGADO'], ['MÚSICA', s.music ? 'LIGADA' : 'DESLIGADA'],
    ['BOTÕES', BTN_SIZES[btnSizeIdx()].label], ['FANTASMA', ghostOn() ? 'LIGADO' : 'DESLIGADO'], ['', ''],
  ];
  optionRects().forEach((r, i) => {
    const hot = s.sel === i;
    if (i === 5) return tag(c, { x: r.x + 60, y: r.y + 6, w: r.w - 120, h: 16 }, '◀ VOLTAR À CAPA', hot, 5);
    c.fillStyle = hot ? '#fff8e4' : '#f6efdd';
    c.fillRect(r.x, r.y, r.w, r.h);
    c.strokeStyle = hot ? RED : 'rgba(26,22,20,0.35)';
    c.lineWidth = hot ? 2 : 1;
    c.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1);
    ink(c, items[i][0], r.x + 10, r.y + 10, 8, INK);
    ink(c, items[i][1], r.x + r.w - 10, r.y + 11, 5, hot ? RED : BLUE, 'right');
  });
}
function activateOption(s: AppState, a: Actions, i: number) {
  if (i === 0) s.auto = !s.auto;
  else if (i === 1) a.toggleSound();
  else if (i === 2) a.toggleMusic();
  else if (i === 3) setBtnSize((btnSizeIdx() + 1) % BTN_SIZES.length);
  else if (i === 4) setGhostOn(!ghostOn());
  else a.go('title');
}

// ---------- escolha do carro ----------
const carFilterRects = () => filterRects(ox() + 68, 21, SAFE_W - 144, 11);
// troca o filtro e, se o carro atual não for da classe, vai para o primeiro que for
function setCarFilter(s: AppState, f: ClassFilter) {
  s.carFilter = f;
  if (!filtered(CARS, f).includes(s.carIdx)) s.carIdx = filtered(CARS, f)[0] ?? s.carIdx;
}

const carButtons = () => {
  const x = ox();
  return {
    prev: { x: x + 4, y: 92, w: 16, h: 34 },
    next: { x: x + 192, y: 92, w: 16, h: 34 },
    ok: { x: x + SAFE_W - 70, y: 20, w: 66, h: 13 },
    back: { x: x + 4, y: 20, w: 58, h: 13 },
  };
};

// as 15 cores, numa fileira embaixo da foto
const swatches = (): Rect[] => PAINTS.map((_, i) => ({ x: ox() + 30 + i * 12, y: 159, w: 10, h: 7 }));

// ---- página de teste (ficha técnica, gráfico e o veredito), usada também na carreira ----
export function carRows(car: CarSpec): [string, string][] {
  return [
    ['Preço', car.price], ['Motor', car.engine], ['Potência', car.power], ['Layout', layout(car).replace(/ /g, '')],
    ['Peso', `${car.mass.toLocaleString('pt-BR')} kg`], ['Câmbio', gearbox(car)],
    ['0-100', `${car.zeroTo100.toFixed(1).replace('.', ',')} s`], ['Máxima', `${Math.round(car.maxSpeed * KMH)} km/h`],
  ];
}
// gráfico de aceleração como nas revistas: papel quadriculado, curva vermelha, escala anotada
export function accelChart(c: CanvasRenderingContext2D, r: Rect, car: CarSpec, rival?: CarSpec) {
  box(c, r, 'ACELERAÇÃO (km/h x s)');
  const g: Rect = { x: r.x + 14, y: r.y + 14, w: r.w - 18, h: r.h - 24 };
  c.fillStyle = 'rgba(30,79,184,0.12)';
  for (let i = 0; i <= 4; i++) c.fillRect(g.x, Math.round(g.y + (g.h * i) / 4), g.w, 1);
  for (let i = 0; i <= 7; i++) c.fillRect(Math.round(g.x + (g.w * i) / 7), g.y, 1, g.h);
  ink(c, '300', r.x + 2, g.y - 2, 5, GREY);
  ink(c, '0', r.x + 8, g.y + g.h - 4, 5, GREY);
  ink(c, '14s', g.x + g.w, g.y + g.h + 2, 5, GREY, 'right');
  const line = (cc: CarSpec, color: string) => {
    const { pts } = accelCurve(cc);
    c.strokeStyle = color;
    c.lineWidth = 1.5;
    c.beginPath();
    pts.forEach((v, i) => c.lineTo(g.x + (i / (pts.length - 1)) * g.w, g.y + g.h - Math.min(1, v / 300) * g.h));
    c.stroke();
  };
  if (rival) line(rival, BLUE);
  line(car, RED);
}
// o que achamos: pontos fortes e fracos tirados da ficha
export function verdict(car: CarSpec): { pros: string[]; cons: string[] } {
  const v = Math.round(car.maxSpeed * KMH), z = car.zeroTo100, kg = car.mass;
  const pros: string[] = [], cons: string[] = [];
  if (z <= 4.5) pros.push('Arrancada brutal');
  else if (z <= 6.5) pros.push('Arrancada forte');
  if (v >= 300) pros.push('Passa dos 300 km/h');
  else if (v >= 250) pros.push('Fôlego de sobra');
  if (car.lateralG >= 1) pros.push('Gruda nas curvas');
  if (kg <= 1150) pros.push('Leve e esperto');
  if (car.brakeG >= 1.05) pros.push('Freios fortes');
  if (perfClass(car) === 'D' || perfClass(car) === 'C') pros.push('Barato de manter');
  if (z >= 9) cons.push('Arrancada lenta');
  if (v < 220) cons.push('Máxima modesta');
  if (kg >= 1500) cons.push('Pesado');
  if (car.lateralG < 0.9) cons.push('Sai de frente');
  if (perfClass(car) === 'S') cons.push('Preço de mansão');
  if (car.curve === 'turbo') cons.push('Turbo demora a encher');
  return { pros: pros.slice(0, 3), cons: cons.slice(0, 2).length ? cons.slice(0, 2) : ['Nada a reclamar'] };
}
export function verdictBox(c: CanvasRenderingContext2D, r: Rect, car: CarSpec) {
  box(c, r, 'O QUE ACHAMOS', RED);
  const { pros, cons } = verdict(car);
  pros.forEach((t, i) => ink(c, `+ ${t}`, r.x + 4, r.y + 14 + i * 9, 5, '#1a6a2a'));
  cons.forEach((t, i) => ink(c, `- ${t}`, r.x + 4, r.y + 14 + (pros.length + i) * 9, 5, RED));
}
// nota em estrelas pelo índice de desempenho
export const carStars = (car: CarSpec) => Math.max(1, Math.min(5, Math.round(perfIndex(car) / 160)));

function drawCarSelect(c: CanvasRenderingContext2D, s: AppState) {
  const car = CARS[s.carIdx];
  const x = ox();
  paper(c);
  masthead(c, 'TESTE COMPLETO');
  const b = carButtons();
  tag(c, b.back, '◀ VOLTAR');
  tag(c, b.ok, 'ESCOLHER ▶', Math.floor(s.t * 2) % 2 === 0);
  drawFilter(c, carFilterRects(), s.carFilter, (k) => filtered(CARS, k).length);
  // manchete: o nome do carro, a classe e a nota
  const k = perfClass(car);
  const kw = kicker(c, `CLASSE ${k}`, x + 4, 38, CLASS_COLOR[k], '#fff');
  kicker(c, `PI ${perfIndex(car)}`, x + 6 + kw, 38);
  headline(c, car.name.toUpperCase(), x + 4, 50, 16, INK);
  ink(c, 'NOTA', x + 214, 40, 5, GREY);
  stars(c, x + 236, 39, carStars(car), 6);
  const ids = filtered(CARS, s.carFilter);
  ink(c, `${ids.indexOf(s.carIdx) + 1} de ${ids.length}`, x + SAFE_W - 4, 54, 5, GREY, 'right');
  // foto de estúdio
  const ph: Rect = { x: x + 4, y: 70, w: 204, h: 82 };
  photo(c, ph, () => drawCarSide(c, x + 14, ph.y + 74, 184, car, paintHex(car.id)));
  tag(c, b.prev, '◀');
  tag(c, b.next, '▶');
  // cores
  ink(c, 'CORES', x + 4, 160, 5, GREY);
  const cur = paintIdx(car.id) ?? nearestPaint(car.color);
  if (car.sideMask) swatches().forEach((r, i) => {
    c.fillStyle = i === cur ? RED : INK;
    c.fillRect(r.x - 1, r.y - 1, r.w + 2, r.h + 2);
    c.fillStyle = PAINTS[i].hex;
    c.fillRect(r.x, r.y, r.w, r.h);
    if (i === cur) {
      c.fillStyle = RED;
      c.fillRect(r.x - 1, r.y + r.h + 2, r.w + 2, 2);
    }
  });
  else ink(c, 'Pintura de fábrica', x + 30, 160, 5, INK);
  // ficha técnica, gráfico e veredito
  const fr: Rect = { x: x + 214, y: 67, w: 102, h: 88 };
  box(c, fr, 'FICHA TÉCNICA');
  specRows(c, fr, carRows(car), 9.4);
  accelChart(c, { x: x + 4, y: 174, w: 150, h: 60 }, car);
  verdictBox(c, { x: x + 160, y: 174, w: 156, h: 60 }, car);
}

// ---------- escolha do adversário ----------
// adversários: carros do filtro de classe + relógio, em páginas de 3 linhas de 4
const OPP_COLS = 6;
const OPP_PAGE = 12;
const oppList = (s: AppState) => [...filtered(CARS, s.oppFilter), CARS.length]; // CARS.length = relógio
const oppCells = () => {
  const x = ox() + 4, y = 150;
  return Array.from({ length: OPP_PAGE }, (_, i): Rect => ({ x: x + (i % OPP_COLS) * 52, y: y + Math.floor(i / OPP_COLS) * 40, w: 50, h: 38 }));
};
const oppFilterRects = () => filterRects(ox() + 68, 21, SAFE_W - 144, 11);
const oppPageButtons = () => ({ prev: { x: ox() + 268, y: 136, w: 18, h: 11 } as Rect, next: { x: ox() + 298, y: 136, w: 18, h: 11 } as Rect });
const oppButtons = () => ({ back: { x: ox() + 4, y: 20, w: 58, h: 13 } as Rect, ok: { x: ox() + SAFE_W - 70, y: 20, w: 66, h: 13 } as Rect });
const oppPage = (s: AppState) => Math.floor(s.sel / OPP_PAGE);

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

const STYLE_LABEL: Record<string, [string, string]> = { agressivo: ['AGRESSIVO', RED], cauteloso: ['CAUTELOSO', '#1a6a2a'], imprevisivel: ['IMPREVISÍVEL', '#b07000'] };

function drawOpponent(c: CanvasRenderingContext2D, s: AppState) {
  const x = ox();
  paper(c);
  masthead(c, 'COMPARATIVO');
  const list = oppList(s);
  s.sel = Math.min(s.sel, list.length - 1);
  const b = oppButtons();
  tag(c, b.back, '◀ VOLTAR');
  tag(c, b.ok, 'DUELAR ▶', Math.floor(s.t * 2) % 2 === 0);
  drawFilter(c, oppFilterRects(), s.oppFilter, (k) => filtered(CARS, k).length);
  const me = CARS[s.carIdx];
  const oi = list[s.sel];
  const rival = oi < CARS.length ? CARS[oi] : null;
  // as duas fotos lado a lado, com o X no meio
  const left: Rect = { x: x + 4, y: 50, w: 146, h: 52 }, right: Rect = { x: x + 170, y: 50, w: 146, h: 52 };
  kicker(c, 'VOCÊ', left.x, 38, RED, '#fff');
  ink(c, me.name.toUpperCase(), left.x + 30, 40, 5, INK);
  photo(c, left, () => drawCarSide(c, left.x + 8, left.y + 47, 130, me, paintHex(me.id)));
  kicker(c, rival ? 'ADVERSÁRIO' : 'DESAFIO', right.x, 38, BLUE, '#fff');
  ink(c, rival ? rival.name.toUpperCase() : 'CONTRA O RELÓGIO', right.x + (rival ? 58 : 46), 40, 5, INK);
  photo(c, right, () => {
    if (rival) drawCarSide(c, right.x + 8, right.y + 47, 130, rival);
    else stopwatch(c, right.x + right.w / 2 + 10, right.y + 30, 15);
  }, rival ? ['#5e6670', '#c8cdd2'] : ['#3a4a6a', '#9aaac8']);
  burst(c, x + 160, 76, 14, ['X'], YELLOW, RED, s.t);
  // tira-teima: barras de cada item, vermelho você, azul ele
  if (rival) {
    const rows: [string, number, number, (v: number) => string, boolean][] = [
      ['POTÊNCIA', parseInt(me.power), parseInt(rival.power), (v) => `${v} cv`, true],
      ['0-100', me.zeroTo100, rival.zeroTo100, (v) => `${v.toFixed(1).replace('.', ',')}s`, false],
      ['MÁXIMA', Math.round(me.maxSpeed * KMH), Math.round(rival.maxSpeed * KMH), (v) => `${v}`, true],
      ['PESO', me.mass, rival.mass, (v) => `${v}kg`, false],
    ];
    rows.forEach(([label, a, bb, fmt, higher], i) => {
      const y = 106 + i * 8;
      const max = Math.max(a, bb) * 1.05;
      const win = higher ? a > bb : a < bb, lose = higher ? a < bb : a > bb;
      ink(c, label, x + 160, y, 5, GREY, 'center');
      const wa = Math.round((a / max) * 70), wb = Math.round((bb / max) * 70);
      c.fillStyle = win ? RED : 'rgba(208,31,38,0.45)';
      c.fillRect(x + 130 - wa, y, wa, 5);
      c.fillStyle = lose ? BLUE : 'rgba(30,79,184,0.45)';
      c.fillRect(x + 190, y, wb, 5);
      ink(c, fmt(a), x + 128 - wa - 2, y, 5, win ? RED : INK, 'right');
      ink(c, fmt(bb), x + 192 + wb + 2, y, 5, lose ? BLUE : INK);
    });
    const [lab, col] = STYLE_LABEL[RIVAL_STYLE[rival.id] ?? 'cauteloso'];
    ink(c, 'PILOTO:', x + 4, 139, 5, GREY);
    ink(c, lab, x + 42, 139, 5, col);
  } else {
    ink(c, 'Sem rival: corra contra o seu', x + 160, 112, 5, INK, 'center');
    ink(c, 'próprio tempo e o fantasma.', x + 160, 122, 5, INK, 'center');
  }
  // escolha do adversário: miniaturas de traseira
  const pages = Math.ceil(list.length / OPP_PAGE), pg = oppPage(s);
  rule(c, x + 4, 147, SAFE_W - 8);
  if (pages > 1) {
    const pb = oppPageButtons();
    tag(c, pb.prev, '◀');
    tag(c, pb.next, '▶');
    ink(c, `${pg + 1}/${pages}`, x + 292, 139, 5, GREY, 'center');
  }
  oppCells().forEach((r, slot) => {
    const li = pg * OPP_PAGE + slot;
    if (li >= list.length) return;
    const i = list[li];
    const hot = s.sel === li;
    c.fillStyle = hot ? '#fff6dc' : '#f6efdd';
    c.fillRect(r.x, r.y, r.w, r.h);
    c.strokeStyle = hot ? RED : 'rgba(26,22,20,0.4)';
    c.lineWidth = hot ? 2 : 1;
    c.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1);
    if (i < CARS.length) {
      const car = CARS[i];
      drawCar(c, r.x + r.w / 2, r.y + 29, 36, { color: car.color, rear: car.rear });
      classBadge(c, r.x + 2, r.y + 2, car, false, 8);
      ink(c, car.name.length > 10 ? car.name.slice(0, 9) + '.' : car.name, r.x + r.w / 2, r.y + 31, 5, hot ? RED : INK, 'center');
    } else {
      stopwatch(c, r.x + r.w / 2 + 5, r.y + 17, 8);
      ink(c, 'RELÓGIO', r.x + r.w / 2, r.y + 31, 5, hot ? RED : INK, 'center');
    }
  });
}

// ---------- escolha do percurso ----------
// lista com 4 percursos visíveis (rola com as setas); botão de dia/noite no alto
const COURSE_ROWS = 4;
const courseRects = () => Array.from({ length: COURSE_ROWS }, (_, i): Rect => ({ x: ox() + 4, y: 38 + i * 48, w: SAFE_W - 30, h: 45 }));
const courseButtons = () => ({
  time: { x: ox() + SAFE_W - 70, y: 20, w: 66, h: 13 } as Rect,
  back: { x: ox() + 4, y: 20, w: 58, h: 13 } as Rect,
  up: { x: ox() + SAFE_W - 22, y: 38, w: 18, h: 92 } as Rect,
  down: { x: ox() + SAFE_W - 22, y: 135, w: 18, h: 92 } as Rect,
});
function scrollCourses(s: AppState) {
  if (s.sel < s.courseTop) s.courseTop = s.sel;
  if (s.sel >= s.courseTop + COURSE_ROWS) s.courseTop = s.sel - COURSE_ROWS + 1;
  s.courseTop = Math.max(0, Math.min(COURSES.length - COURSE_ROWS, s.courseTop));
}

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
      if (st.weather === 'fog') { // neblina: faixas cinzentas no lugar das gotas
        c.fillStyle = '#c8ccd2';
        for (let k = 0; k < 3; k++) c.fillRect(cx - 22 + k * 3, r.y + 17 + k * 3, 16, 1);
      } else for (let k = 0; k < 4; k++) c.fillRect(cx - 18 + k * 4, r.y + 17 + (k % 2) * 3, 1, 3);
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

// cadeado de pixel (aro e corpo com o buraco da chave)
export function padlock(c: CanvasRenderingContext2D, cx: number, cy: number) {
  c.strokeStyle = INK;
  c.lineWidth = 2;
  c.beginPath();
  c.arc(cx, cy - 3, 5, Math.PI, 0);
  c.stroke();
  c.fillStyle = YELLOW;
  c.fillRect(cx - 7, cy - 3, 14, 11);
  c.strokeRect(cx - 7, cy - 3, 14, 11);
  c.fillStyle = INK;
  c.fillRect(cx - 1, cy, 2, 5);
}

const LEVEL_STARS: Record<string, number> = { Fácil: 1, Médio: 2, Difícil: 3, Expert: 4, Lenda: 5 };
// um trecho do roteiro: quadradinho com a cor do bioma, lua (noite), nuvem (chuva/neve/neblina) e sol (pôr do sol)
const PLACE: Record<string, string> = {
  forest: 'Floresta', farm: 'Fazenda', desert: 'Deserto', city: 'Cidade', mountain: 'Serra', snow: 'Neve', coast: 'Litoral',
  canyon: 'Cânion', jungle: 'Selva', autumn: 'Outono', beach: 'Praia', savanna: 'Savana', industrial: 'Indústria', alpine: 'Alpes', alpinesnow: 'Alpes',
};
// um trecho do roteiro: etiqueta com a cor do bioma e o nome; lua (noite), gotas/flocos/neblina e o sol se pondo
export function stageChip(c: CanvasRenderingContext2D, x: number, y: number, st: Course['stages'][number]) {
  const th = THEMES[st.theme];
  const W = 38, H = 14;
  c.fillStyle = INK;
  c.fillRect(x - 1, y - 1, W + 2, H + 2);
  c.fillStyle = st.night ? shade(th.mapColor, -0.45) : th.mapColor;
  c.fillRect(x, y, W, H);
  if (st.dusk) {
    c.fillStyle = '#ff8a3a';
    c.fillRect(x, y + H - 4, W, 2);
  }
  text(c, (PLACE[st.theme] ?? st.theme).slice(0, 7), x + 2, y + 2, 5, '#fff', 'left', INK);
  // ícones na linha de baixo
  let ix = x + 2;
  const iy = y + 9;
  if (st.night) {
    c.fillStyle = '#ffe680';
    c.fillRect(ix, iy, 3, 3);
    ix += 5;
  }
  if (st.weather) {
    c.fillStyle = st.weather === 'snow' ? '#fff' : st.weather === 'fog' ? '#d8dce2' : '#8ab4ff';
    if (st.weather === 'fog') c.fillRect(ix, iy + 1, 8, 1);
    else for (let k = 0; k < 3; k++) c.fillRect(ix + k * 2, iy + (k % 2), 1, 2);
    ix += 9;
  }
  if (st.dusk) {
    c.fillStyle = '#ffd040';
    c.fillRect(ix, iy, 4, 2);
  }
}

function drawCourse(c: CanvasRenderingContext2D, s: AppState) {
  const x = ox();
  const unlocked = unlockedCourses();
  paper(c);
  masthead(c, 'GUIA DE ROTEIROS');
  scrollCourses(s);
  const b = courseButtons();
  tag(c, b.back, '◀ VOLTAR');
  tag(c, b.time, s.arcadeNight ? 'NOITE' : 'DIA', false);
  ink(c, `${unlocked} de ${COURSES.length} roteiros liberados`, x + 160, 24, 5, GREY, 'center');
  courseRects().forEach((r, row) => {
    const i = s.courseTop + row;
    if (i >= COURSES.length) return;
    const co = COURSES[i];
    const hot = s.sel === i;
    const locked = i >= unlocked;
    c.fillStyle = hot ? '#fff8e4' : '#f6efdd';
    c.fillRect(r.x, r.y, r.w, r.h);
    c.strokeStyle = hot ? RED : 'rgba(26,22,20,0.35)';
    c.lineWidth = hot ? 2 : 1;
    c.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1);
    const num = String(i + 1).padStart(2, '0');
    text(c, num, r.x + 6, r.y + 8, 16, locked ? 'rgba(26,22,20,0.25)' : RED, 'left', null);
    ink(c, co.name.toUpperCase(), r.x + 44, r.y + 6, 8, locked ? GREY : INK);
    ink(c, co.level.toUpperCase(), r.x + 44, r.y + 18, 5, GREY);
    stars(c, r.x + 44 + co.level.length * 5 + 6, r.y + 17, LEVEL_STARS[co.level] ?? 1, 5);
    const day = withTimeOfDay(co, s.arcadeNight);
    day.stages.forEach((st, k) => stageChip(c, r.x + 44 + k * 40, r.y + 27, st));
    if (locked) {
      c.fillStyle = 'rgba(239,230,210,0.6)';
      c.fillRect(r.x + 40, r.y + 25, r.w - 42, 18);
      padlock(c, r.x + r.w - 14, r.y + 12);
      ink(c, 'BLOQUEADO', r.x + r.w - 26, r.y + 18, 5, RED, 'right');
    } else if (hot) ink(c, 'CORRER ▶', r.x + r.w - 6, r.y + 6, 5, RED, 'right');
  });
  tag(c, b.up, '▲');
  tag(c, b.down, '▼');
  if (s.lockedT > 0) {
    s.lockedT -= 1 / 60;
    burst(c, x + 160, 130, 34, ['BLOQUEADO!', 'conclua o', 'anterior'], YELLOW, RED, s.t);
  }
}

// ---------- posto de gasolina ----------
// chegada ao posto: posição (0 fora da tela .. 1 na bomba), mergulho da frente ao parar e o som
let gasKey = -1, gasT0 = 0, gasOff = false;
const GAS_STOP = 2.6; // s até parar na bomba
const GAS_IDLE = 1.4; // s em marcha lenta antes de desligar
function gasArrival(s: AppState) {
  if (gasKey !== s.results.length) {
    gasKey = s.results.length;
    gasT0 = s.t;
    gasOff = false;
  }
  const t = s.t - gasT0;
  const u = Math.min(1, t / GAS_STOP);
  const pos = 1 - (1 - u) ** 2.4; // freando: cada vez mais devagar
  const vel = (1 - u) ** 1.4;
  const st = t - GAS_STOP;
  const dip = st > 0 ? Math.round(Math.sin(st * 16) * Math.exp(-st * 6) * 2) : 0; // balanço ao parar
  if (t < GAS_STOP) {
    // reduzindo: o giro cai com a velocidade e sobe num "punta-tacco" a cada marcha
    let rpm = 0.06 + 0.42 * vel;
    let blip = false;
    for (const tb of [0.55, 1.25, 1.85]) if (t > tb && t < tb + 0.22) {
      rpm += 0.22 * (1 - (t - tb) / 0.22);
      blip = t < tb + 0.08;
    }
    setEngine(rpm, blip, true);
    // pneu chiando de leve nos últimos metros
    setTires(t > GAS_STOP - 0.45 ? 0.16 : 0, 0);
  } else if (st < GAS_IDLE) {
    setEngine(0.02, false, true);
    setTires(0, 0);
  } else if (!gasOff) {
    gasOff = true;
    setEngine(0, false, false);
    shiftSound(); // chave virando: um "clunk" ao desligar
  }
  return { pos, dip };
}

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
  // o carro chega freando até a bomba, reduz as marchas, fica em marcha lenta e desliga
  const arr = gasArrival(s);
  // rodas girando conforme o carro anda (para a esquerda: giro anti-horário), paradas na bomba
  const wr = (car.wheels?.[0]?.[2] ?? 0.07) * 170;
  drawCarSide(c, Math.round(x + 80 + 320 * (1 - arr.pos)), 176 + arr.dip, 170, car, paintHex(car.id), (-320 * arr.pos) / wr);

  // fala do frentista, como no Test Drive II
  c.fillStyle = '#3a3a3e';
  c.fillRect(0, 186, w, h - 186);
  const r = s.results[s.results.length - 1];
  const lines = wrap(`"${gasQuip(r, s.results.length - 1)}"`, 36);
  if (r.clean) lines.push('Trecho limpo! Ganhou um carro.');
  lines.slice(0, 3).forEach((l, i) => text(c, l, x + 12, 192 + i * 12, 8, i < lines.length - (r.clean ? 1 : 0) ? '#f0f0f0' : '#30e060', 'left', null));
  if (Math.floor(s.t * 2) % 2) text(c, 'TOQUE PARA VER O RESULTADO', w / 2, 230, 5, '#ffd400', 'center', null);
}

// quebra uma frase em linhas de até n caracteres
function wrap(s: string, n: number) {
  const out: string[] = [];
  let line = '';
  for (const word of s.split(' ')) {
    if (line && (line + ' ' + word).length > n) {
      out.push(line);
      line = word;
    } else line = line ? `${line} ${word}` : word;
  }
  if (line) out.push(line);
  return out;
}

const pts = (n: number) => Math.round(n).toLocaleString('pt-BR');

// ---------- resultado do trecho (você x rival, como no Test Drive II) ----------
function drawStageResult(c: CanvasRenderingContext2D, s: AppState) {
  const x = ox();
  paper(c);
  masthead(c, 'RESULTADO DO TRECHO');
  const r = s.results[s.results.length - 1];
  const n = s.results.length;
  const hasRival = r.rival >= 0;
  const sum = (f: (r: StageResult) => number) => s.results.reduce((a, q) => a + f(q), 0);
  const myTotal = sum((q) => q.time), rivalTotal = sum((q) => Math.max(0, q.rival));
  kicker(c, s.mode === 'career' ? `TRECHO ${n}` : `TRECHO ${n}/${COURSES[s.courseIdx].stages.length}`, x + 4, 22, INK);
  ink(c, `${r.km.toFixed(1).replace('.', ',')} km`, x + SAFE_W - 4, 24, 5, GREY, 'right');
  const ahead = myTotal <= rivalTotal;
  headline(c, !hasRival ? 'CONTRA O RELÓGIO' : ahead ? 'VOCÊ NA FRENTE!' : 'O RIVAL LIDERA...', x + 4, 36, 8, !hasRival ? INK : ahead ? '#1a6a2a' : RED);
  // tabela do teste
  const t: Rect = { x: x + 4, y: 50, w: SAFE_W - 8, h: 132 };
  box(c, t, 'MEDIÇÕES');
  const colYou = t.x + 200, colRival = t.x + t.w - 6;
  ink(c, 'VOCÊ', colYou, t.y + 14, 5, RED, 'right');
  if (hasRival) ink(c, 'RIVAL', colRival, t.y + 14, 5, BLUE, 'right');
  const kmh = (v: number) => `${Math.round(v)} km/h`;
  const rows: [string, string, string][] = [
    ['Tempo', formatTime(r.time), hasRival ? formatTime(r.rival) : ''],
    ['Batidas', `${r.crashes}`, hasRival ? '0' : ''],
    ['Multas', `${r.tickets}`, hasRival ? '0' : ''],
    ['Vel. máxima', kmh(r.top), hasRival ? kmh(r.rivalTop) : ''],
    ['Vel. média', kmh(r.avg), hasRival ? kmh(r.rivalAvg) : ''],
    ['Pontos', pts(r.score), hasRival ? pts(r.rivalScore) : ''],
  ];
  rows.forEach(([k, a, b], i) => {
    const y = t.y + 26 + i * 11;
    if (i % 2 === 0) {
      c.fillStyle = 'rgba(26,22,20,0.05)';
      c.fillRect(t.x + 1, y - 2, t.w - 2, 10);
    }
    ink(c, k, t.x + 6, y, 5, GREY);
    ink(c, a, colYou, y, 5, INK, 'right');
    if (b) ink(c, b, colRival, y, 5, INK, 'right');
  });
  rule(c, t.x + 4, t.y + 94, t.w - 8, RED);
  [['Tempo total', formatTime(myTotal), hasRival ? formatTime(rivalTotal) : ''], ['Pontuação', pts(sum((q) => q.score)), hasRival ? pts(sum((q) => q.rivalScore)) : '']].forEach(([k, a, b], i) => {
    const y = t.y + 100 + i * 11;
    ink(c, k, t.x + 6, y, 5, RED);
    ink(c, a, colYou, y, 5, INK, 'right');
    if (b) ink(c, b, colRival, y, 5, INK, 'right');
  });
  ink(c, `Carros restantes: ${s.lives}`, x + 4, 188, 5, INK);
  if (r.record) {
    const lines = r.best === undefined ? ['PRIMEIRO', 'RECORDE!'] : ['NOVO', 'RECORDE!', `-${(r.best - r.time).toFixed(2).replace('.', ',')}s`];
    burst(c, x + SAFE_W - 40, 196, 30, lines, YELLOW, RED, s.t);
  } else if (r.best !== undefined) ink(c, `Recorde: ${formatTime(r.best)}`, x + 4, 198, 5, GREY);
  if (Math.floor(s.t * 2) % 2) ink(c, 'TOQUE PARA SEGUIR ▶', x + 160, 222, 5, RED, 'center');
}

// posto: chegada -> resultado -> desafios -> próximo trecho
function gasNext(s: AppState, a: Actions) {
  if (!s.gasPage) s.gasPage = 1;
  else if (s.gasPage === 1 && s.results[s.results.length - 1]?.challenges) s.gasPage = 2;
  else a.nextStage();
}

// medalha: fita e disco com brilho
function medal(c: CanvasRenderingContext2D, cx: number, cy: number, n: number, r = 9) {
  c.fillStyle = RED;
  c.fillRect(cx - 5, cy - r - 9, 4, 10);
  c.fillStyle = BLUE;
  c.fillRect(cx + 1, cy - r - 9, 4, 10);
  c.fillStyle = INK;
  c.beginPath();
  c.arc(cx, cy, r + 1, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = MEDAL_COLOR[n];
  c.beginPath();
  c.arc(cx, cy, r, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = 'rgba(255,255,255,0.45)';
  c.fillRect(cx - r * 0.5, cy - r * 0.6, 2, 2);
  c.fillStyle = n ? shade(MEDAL_COLOR[n], -0.35) : '#333';
  c.beginPath();
  c.arc(cx, cy, r * 0.55, 0, Math.PI * 2);
  c.fill();
}

function drawChallenges(c: CanvasRenderingContext2D, s: AppState) {
  const x = ox();
  paper(c);
  masthead(c, 'DESAFIOS DO TRECHO');
  const r = s.results[s.results.length - 1];
  const list = r.challenges ?? [];
  const n = r.medal ?? 0;
  kicker(c, 'NOSSA AVALIAÇÃO', x + 4, 22, RED, '#fff');
  const t: Rect = { x: x + 4, y: 36, w: SAFE_W - 8, h: 82 };
  box(c, t, 'METAS');
  list.forEach((ch, i) => {
    const y = t.y + 16 + i * 22;
    c.fillStyle = INK;
    c.fillRect(t.x + 8, y - 1, 12, 12);
    c.fillStyle = ch.done ? '#2a9a3a' : '#f8f2e4';
    c.fillRect(t.x + 9, y, 10, 10);
    if (ch.done) {
      c.fillStyle = '#fff';
      c.fillRect(t.x + 11, y + 5, 2, 2);
      c.fillRect(t.x + 13, y + 6, 2, 2);
      c.fillRect(t.x + 15, y + 2, 2, 4);
    }
    ink(c, ch.label, t.x + 26, y + 2, 5, ch.done ? INK : GREY);
    ink(c, ch.done ? 'CUMPRIDO' : 'NÃO FOI DESTA VEZ', t.x + t.w - 6, y + 2, 5, ch.done ? '#1a6a2a' : RED, 'right');
  });
  medal(c, x + 160, 150, n, 14);
  headline(c, n ? `MEDALHA DE ${medalName(n)}` : 'SEM MEDALHA', x + 160, 172, 8, n ? INK : GREY, 'center');
  if (r.medalNew && n) ink(c, 'Sua melhor medalha neste trecho!', x + 160, 184, 5, GREY, 'center');
  if (r.prize) ink(c, `Prêmio dos desafios: $${pts(r.prize)}`, x + 160, 196, 5, '#1a6a2a', 'center');
  if (Math.floor(s.t * 2) % 2) ink(c, 'TOQUE PARA SEGUIR ▶', x + 160, 222, 5, RED, 'center');
}

// aviso no alto da tela (conquista ou desafio cumprido), em qualquer tela
export function drawToast(c: CanvasRenderingContext2D, dt: number) {
  const t = takeToast(dt);
  if (!t) return;
  const { w } = view;
  const k = Math.min(1, (3.2 - t.t) / 0.25, t.t / 0.3); // entra e sai deslizando
  const y = Math.round(-30 + 34 * k);
  const bw = Math.min(w - 16, 260);
  panel(c, { x: (w - bw) / 2, y, w: bw, h: 26 }, '#1a1040', t.color);
  text(c, t.text, w / 2, y + 4, 8, t.color, 'center', null);
  if (t.sub) text(c, t.sub, w / 2, y + 16, 5, '#e8e0ff', 'center', null);
}

// ---------- fim do percurso ----------
function drawEnd(c: CanvasRenderingContext2D, s: AppState) {
  const x = ox();
  const course = COURSES[s.courseIdx];
  const total = s.results.reduce((a, r) => a + r.time, 0);
  const rival = s.results.every((r) => r.rival >= 0) ? s.results.reduce((a, r) => a + r.rival, 0) : -1;
  const won = rival < 0 ? true : total <= rival;
  paper(c);
  masthead(c, s.gameOver ? 'FIM DE JOGO' : 'REPORTAGEM DE CAPA');
  kicker(c, course.name.toUpperCase(), x + 4, 22, INK);
  if (!s.gameOver) {
    headline(c, rival < 0 ? 'ROTEIRO CONCLUÍDO!' : won ? 'VITÓRIA NO DUELO!' : 'O RIVAL VENCEU...', x + 4, 36, 8, won ? '#1a6a2a' : RED);
    const t: Rect = { x: x + 4, y: 52, w: 200, h: 70 };
    box(c, t, 'PLACAR FINAL');
    specRows(c, t, [['Seu tempo', formatTime(total)], ...(rival >= 0 ? [['Rival', formatTime(rival)] as [string, string]] : []), ['Pontuação', pts(s.results.reduce((a, r) => a + r.score, 0))], ['Trechos', `${s.results.length}`]], 11, 16);
    const car = CARS[s.carIdx];
    photo(c, { x: x + 214, y: 56, w: 102, h: 62 }, () => drawCarSide(c, x + 218, 112, 94, car, paintHex(car.id)));
    if (s.newMap) {
      burst(c, x + 270, 160, 32, ['NOVO', 'ROTEIRO', 'LIBERADO!'], YELLOW, RED, s.t);
      ink(c, s.newMap, x + 4, 134, 8, RED);
      ink(c, 'já está no Guia de Roteiros.', x + 4, 148, 5, INK);
    }
  } else {
    headline(c, 'SEUS CARROS ACABARAM', x + 4, 36, 8, RED);
    ink(c, `Trechos concluídos: ${s.results.length} de ${course.stages.length}`, x + 4, 56, 5, INK);
    ink(c, 'Volte mais forte na próxima edição.', x + 4, 68, 5, GREY);
  }
  if (Math.floor(s.t * 2) % 2) ink(c, 'TOQUE PARA CONTINUAR ▶', x + 160, 222, 5, RED, 'center');
}

// ---------- conquistas e medalhas ----------
const achButton = (): Rect => ({ x: ox() + 210, y: 212, w: 106, h: 15 });
function drawAchievements(c: CanvasRenderingContext2D, s: AppState) {
  const x = ox();
  paper(c);
  masthead(c, 'GALERIA DE CONQUISTAS');
  const got = unlockedAchievements();
  const n = ACHIEVEMENTS.filter((q) => got[q.id]).length;
  kicker(c, `${n} DE ${ACHIEVEMENTS.length} CONQUISTAS`, x + 4, 21, RED, '#fff');
  // medalhas ganhas nos desafios
  const m = Object.values(medals());
  [3, 2, 1].forEach((k, i) => {
    const cx = x + SAFE_W - 74 + i * 26;
    c.fillStyle = INK;
    c.beginPath();
    c.arc(cx, 25, 5, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = MEDAL_COLOR[k];
    c.beginPath();
    c.arc(cx, 25, 4, 0, Math.PI * 2);
    c.fill();
    ink(c, String(m.filter((v) => v === k).length), cx + 7, 23, 5, INK);
  });
  ACHIEVEMENTS.forEach((ach, i) => {
    const ax = x + 6, ay = 34 + i * 10.5;
    const ok = !!got[ach.id];
    if (i % 2 === 0) {
      c.fillStyle = 'rgba(26,22,20,0.05)';
      c.fillRect(x + 4, Math.round(ay) - 1, SAFE_W - 8, 10);
    }
    // troféu (dourado se conquistado)
    c.fillStyle = ok ? '#e0a800' : 'rgba(26,22,20,0.2)';
    c.fillRect(ax, ay, 7, 4);
    c.fillRect(ax + 2, ay + 4, 3, 2);
    c.fillRect(ax + 1, ay + 6, 5, 2);
    ink(c, ach.name, ax + 11, ay + 1, 5, ok ? INK : GREY);
    ink(c, ach.desc, ax + 96, ay + 1, 5, ok ? BLUE : 'rgba(26,22,20,0.4)');
  });
  const st = loadStats();
  ink(c, `${st.stages} trechos • ${st.passes} ultrapassagens • ${st.tunnels} túneis`, x + 160, 226, 5, GREY, 'center');
}

// ---------- recordes ----------
function drawScores(c: CanvasRenderingContext2D, s: AppState) {
  const x = ox();
  paper(c);
  masthead(c, 'RANKING DOS LEITORES');
  const course = COURSES[s.scoreCourse];
  kicker(c, `ROTEIRO ${String(s.scoreCourse + 1).padStart(2, '0')}`, x + 4, 22, RED, '#fff');
  headline(c, `◀ ${course.name.toUpperCase()} ▶`, x + 160, 36, 8, INK, 'center');
  const t: Rect = { x: x + 4, y: 50, w: SAFE_W - 8, h: 156 };
  box(c, t, 'OS MAIS RÁPIDOS');
  const list = loadScores(course);
  if (!list.length) ink(c, 'Ninguém completou este roteiro ainda.', x + 160, 110, 5, GREY, 'center');
  list.forEach((e, i) => {
    const y = t.y + 18 + i * 27;
    text(c, `${i + 1}º`, t.x + 8, y, 16, i === 0 ? RED : GREY, 'left', null);
    ink(c, formatTime(e.time), t.x + 56, y + 1, 8, INK);
    ink(c, e.car, t.x + 56, y + 13, 5, BLUE);
    if (e.score) ink(c, `${pts(e.score)} pts`, t.x + t.w - 8, y + 1, 5, INK, 'right');
    ink(c, e.won ? 'VENCEU O DUELO' : 'PERDEU O DUELO', t.x + t.w - 8, y + 13, 5, e.won ? '#1a6a2a' : RED, 'right');
    if (i < list.length - 1) rule(c, t.x + 6, y + 23, t.w - 12, 'rgba(26,22,20,0.15)');
  });
  ink(c, 'Toque fora para voltar à capa', x + 4, 216, 5, GREY);
  tag(c, achButton(), 'CONQUISTAS ▶', false);
}

// ---------- roteamento ----------
export function drawScreen(c: CanvasRenderingContext2D, s: AppState) {
  switch (s.screen) {
    case 'title': return drawTitle(c, s);
    case 'options': return drawOptions(c, s);
    case 'car': return drawCarSelect(c, s);
    case 'opponent': return drawOpponent(c, s);
    case 'course': return drawCourse(c, s);
    case 'gas':
      if (s.gasPage && !gasOff) { // pulou a chegada: desliga o motor
        gasOff = true;
        setEngine(0, false, false);
        setTires(0, 0);
      }
      return s.gasPage === 2 ? drawChallenges(c, s) : s.gasPage ? drawStageResult(c, s) : drawGas(c, s, CARS[s.carIdx]);
    case 'end': return drawEnd(c, s);
    case 'scores': return drawScores(c, s);
    case 'achievements': return drawAchievements(c, s);
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
      const f = filterAt(carFilterRects(), x, y);
      if (f !== undefined) {
        if (f === null || filtered(CARS, f).length) setCarFilter(s, f);
      } else if (inside(x, y, b.prev)) s.carIdx = stepCar(CARS, s.carFilter, s.carIdx, -1);
      else if (inside(x, y, b.next)) s.carIdx = stepCar(CARS, s.carFilter, s.carIdx, 1);
      else if (inside(x, y, b.ok)) a.go('opponent');
      else if (inside(x, y, b.back)) a.go('title');
      else {
        // toque com folga em volta de cada cor (dedos maiores que os quadradinhos)
        swatches().forEach((r, i) => {
          if (inside(x, y, { x: r.x - 1.5, y: r.y - 8, w: r.w + 3, h: r.h + 16 }) && CARS[s.carIdx].sideMask) setPaint(CARS[s.carIdx].id, i);
        });
      }
      return;
    }
    case 'opponent': {
      const list = oppList(s);
      const f = filterAt(oppFilterRects(), x, y);
      const pb = oppPageButtons();
      if (f !== undefined) {
        if (f === null || filtered(CARS, f).length) {
          s.oppFilter = f;
          s.sel = 0;
        }
      } else if (inside(x, y, pb.prev)) s.sel = Math.max(0, (oppPage(s) - 1) * OPP_PAGE);
      else if (inside(x, y, pb.next)) s.sel = Math.min(list.length - 1, (oppPage(s) + 1) * OPP_PAGE);
      else if (inside(x, y, oppButtons().back)) a.go('car');
      else if (inside(x, y, oppButtons().ok)) {
        s.oppIdx = list[s.sel];
        a.go('course');
      } else
        // primeiro toque escolhe (o comparativo mostra), o segundo confirma
        oppCells().forEach((r, slot) => {
          const li = oppPage(s) * OPP_PAGE + slot;
          if (inside(x, y, r) && li < list.length) {
            if (s.sel === li) {
              s.oppIdx = list[li];
              a.go('course');
            } else s.sel = li;
          }
        });
      return;
    }
    case 'course': {
      const b = courseButtons();
      if (inside(x, y, b.time)) s.arcadeNight = !s.arcadeNight;
      else if (inside(x, y, b.back)) a.go('opponent');
      else if (inside(x, y, b.up)) s.sel = Math.max(0, Math.min(s.sel, s.courseTop + COURSE_ROWS - 1) - COURSE_ROWS);
      else if (inside(x, y, b.down)) s.sel = Math.min(COURSES.length - 1, Math.max(s.sel, s.courseTop) + COURSE_ROWS);
      else
        courseRects().forEach((r, row) => {
          const i = s.courseTop + row;
          if (inside(x, y, r) && i < COURSES.length) {
            if (i >= unlockedCourses()) {
              s.sel = i;
              s.lockedT = 1.6;
              return;
            }
            s.courseIdx = i;
            a.startCourse();
          }
        });
      scrollCourses(s);
      return;
    }
    case 'gas':
      gasNext(s, a);
      return;
    case 'end':
      s.scoreCourse = s.courseIdx;
      return a.go('scores');
    case 'scores':
      if (y < 60 && x < view.w / 2) s.scoreCourse = (s.scoreCourse + COURSES.length - 1) % COURSES.length;
      else if (y < 60) s.scoreCourse = (s.scoreCourse + 1) % COURSES.length;
      else if (inside(x, y, achButton())) a.go('achievements');
      else a.go('title');
      return;
    case 'achievements':
      a.go('scores');
      return;
  }
}

export function keyScreen(s: AppState, a: Actions, k: MenuKey) {
  if (['career', 'event', 'garage', 'dealer', 'careerEnd'].includes(s.screen)) return keyCareerScreen(s, a, k);
  const counts: Partial<Record<ScreenId, number>> = { title: 4, options: 6, opponent: oppList(s).length, course: COURSES.length };
  // percursos: cima/baixo escolhem, esquerda/direita trocam dia e noite
  if (s.screen === 'course' && (k === 'left' || k === 'right')) {
    s.arcadeNight = !s.arcadeNight;
    return;
  }
  const n = counts[s.screen];
  if (s.screen === 'car') {
    if (k === 'left') s.carIdx = stepCar(CARS, s.carFilter, s.carIdx, -1);
    if (k === 'right') s.carIdx = stepCar(CARS, s.carFilter, s.carIdx, 1);
    // cima/baixo trocam o filtro de classe
    if (k === 'up' || k === 'down') setCarFilter(s, nextFilter(s.carFilter, k === 'down' ? 1 : -1, (c2) => filtered(CARS, c2).length > 0));
    if (k === 'ok') a.go('opponent');
    if (k === 'back') a.go('title');
    return;
  }
  if (s.screen === 'gas') {
    if (k !== 'ok') return;
    gasNext(s, a);
    return;
  }
  if (s.screen === 'end') return k === 'ok' && tapScreen(s, a, 0, 100);
  if (s.screen === 'achievements') {
    if (k === 'ok' || k === 'back' || k === 'up') a.go('scores');
    return;
  }
  if (s.screen === 'scores') {
    if (k === 'left') s.scoreCourse = (s.scoreCourse + COURSES.length - 1) % COURSES.length;
    if (k === 'right') s.scoreCourse = (s.scoreCourse + 1) % COURSES.length;
    if (k === 'down') return a.go('achievements');
    if (k === 'ok' || k === 'back') a.go('title');
    return;
  }
  if (!n) return;
  const grid = s.screen === 'opponent';
  if (k === 'left' || (k === 'up' && !grid)) s.sel = (s.sel + n - 1) % n;
  if (k === 'right' || (k === 'down' && !grid)) s.sel = (s.sel + 1) % n;
  if (grid && k === 'up') s.sel = (s.sel + n - OPP_COLS) % n;
  if (grid && k === 'down') s.sel = (s.sel + OPP_COLS) % n;
  if (k === 'back') a.go(s.screen === 'course' ? 'opponent' : s.screen === 'opponent' ? 'car' : 'title');
  if (k === 'ok') {
    if (s.screen === 'title') activateTitle(s, s.sel, a);
    else if (s.screen === 'options') activateOption(s, a, s.sel);
    else if (s.screen === 'opponent') {
      s.oppIdx = oppList(s)[s.sel];
      a.go('course');
    } else if (s.screen === 'course') {
      if (s.sel >= unlockedCourses()) s.lockedT = 1.6;
      else {
        s.courseIdx = s.sel;
        a.startCourse();
      }
    }
  }
}
