// ARRANCADA 402 m (Arcade): um tiro curto só de largada, numa pista de arrancada reta e plana (sem
// trânsito nem polícia), contra um rival ao lado (o mesmo carro ou um escolhido) ou contra o relógio.
// A largada é na árvore de luzes ("christmas tree"): o jogador ALINHA segurando o freio (ou a embreagem,
// no MANUAL + EMBREAGEM), acelera parado (3-step e turbo enchendo, como na contagem normal) e SOLTA no
// verde. Soltar antes do verde = queimou a largada (luz vermelha, perde). Toda a física é a da corrida
// (Race): patinada, embreagem, trocas, turbo, 3-step; aqui só mudam a pista, a largada e o fim.
// Mede: reação (do verde até soltar), 60 pés (18 m), 201 m (1/8 de milha, tempo e km/h) e 402 m (tempo e
// km/h de chegada). Recordes por carro, de fábrica e preparado separados (como records.ts).
import { CAR_W, KMH, LANE_W, SEG_LEN } from './config';
import { G, LAUNCH_BOOST, Powertrain, resistAcc, toGame, type CarSpec } from './cars';
import type { Course } from './courses';
import { Race } from './race';
import { SPRITES, type SpriteKind } from './sprites';
import type { Point, Segment, Track } from './track';
import { brakeAmt, clutchAmt } from './input';
import { beep } from './audio';
import { text } from './ui';
import { clamp, isObj, lerp, rng } from './util';
import { arcadePrepped } from './arcadeprep';

// ---- medidas ----
export const UPM = 3.6 / KMH; // unidades do mundo por metro, no sentido da pista (144)
const SEG_M = SEG_LEN / UPM; // metros por segmento (~1,39)
export const D60 = 18.288, D201 = 201.168, D402 = 402.336; // 60 pés, 1/8 e 1/4 de milha
const START = 40; // segmento da linha de largada (atrás dela: o pátio de alinhamento, visto no retrovisor)
const LINE_Z = START * SEG_LEN;
const segAt = (m: number) => START + m / SEG_M;
// a árvore entre as faixas, à frente da linha (a pista do jogo é encurtada no sentido do movimento: a
// ~28 m "do jogo" ela aparece como a de verdade, a uns metros do carro, à esquerda do capô)
const TREE_SEG = START + 20;

// percurso de mentira (Race precisa de um): um trecho só, deserto (sem virada de tempo), reto e sem nada
export const DRAG_COURSE: Course = {
  id: 'arrancada', name: 'Arrancada 402 m', level: 'Arcade', rivalSkill: 1, seed: 402,
  stages: [{ theme: 'desert', lanes: 2, curviness: 0, hilliness: 0, sections: 0, traffic: 0, police: 0 }],
};

// ---- configuração escolhida na tela da arrancada e o último resultado ----
export type DragFoe = 'same' | 'pick' | 'clock';
export const dragCfg = { foe: 'same' as DragFoe, foeId: '' };
export interface Splits { rt: number; t60: number; t201: number; v201: number; t402: number; v402: number }
export interface DragResult {
  car: CarSpec; rivalCar: CarSpec | null; prepped: boolean;
  me: Splits; rival: Splits | null;
  foul: boolean; won: boolean; best?: DragRec; record: boolean;
}
export let dragLast: DragResult | null = null;
// o jogo (main.ts) liga aqui como começar a corrida; as telas (dragScreens.ts) chamam
export const dragHost = { start: (_car: CarSpec, _rival: CarSpec | null) => {}, again: () => {} };

// ---- recordes: melhor 402 m de cada carro (de fábrica e preparado em chaves separadas) ----
const KEY = 'duel-racer:arrancada';
export interface DragRec extends Splits { at: number }
function readRecs(): Record<string, DragRec> {
  try {
    const v: unknown = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (!isObj(v)) return {};
    const out: Record<string, DragRec> = {};
    for (const [k, r] of Object.entries(v)) if (isObj(r) && typeof r.t402 === 'number' && r.t402 > 0) out[k] = r as unknown as DragRec;
    return out;
  } catch {
    return {};
  }
}
const recKey = (id: string, prepped: boolean) => (prepped ? `${id}+prep` : id);
export const dragRecord = (id: string, prepped: boolean): DragRec | undefined => readRecs()[recKey(id, prepped)];
function saveRec(id: string, prepped: boolean, s: Splits): { prev?: DragRec; record: boolean } {
  const all = readRecs(), k = recKey(id, prepped), prev = all[k];
  const record = !prev || s.t402 < prev.t402;
  if (record) {
    all[k] = { ...s, at: Date.now() };
    try {
      localStorage.setItem(KEY, JSON.stringify(all));
    } catch { /* sem armazenamento: vale só nesta sessão */ }
  }
  return { prev, record };
}

// ---- árvore de luzes: estado de cada faixa ----
interface Lane { pre: boolean; stage: boolean; amber: number; green: boolean; red: boolean }
const OFF: Lane = { pre: false, stage: false, amber: 0, green: false, red: false };
const laneCode = (l: Lane) => `${+l.pre}${+l.stage}${l.amber}${+l.green}${+l.red}`;
const bulb = (c: CanvasRenderingContext2D, x: number, y: number, r: number, on: boolean, lit: string, dark: string) => {
  c.fillStyle = '#050505';
  c.beginPath();
  c.arc(x, y, r + Math.max(0.5, r * 0.25), 0, Math.PI * 2);
  c.fill();
  c.fillStyle = on ? lit : dark;
  c.beginPath();
  c.arc(x, y, r, 0, Math.PI * 2);
  c.fill();
  if (on) {
    c.fillStyle = 'rgba(255,255,240,0.85)';
    c.beginPath();
    c.arc(x - r * 0.3, y - r * 0.3, r * 0.38, 0, Math.PI * 2);
    c.fill();
  }
};
// a árvore em "unidades de árvore" (22 de largura): caixa preta com duas colunas de lâmpadas (faixa da
// esquerda e da direita), alinhamento (pré e alinhado) em cima, três amarelas, a verde e a vermelha
// x, y: canto de cima à esquerda; k: pixels por unidade; pole: com o poste até o chão (o da pista)
function drawTree(c: CanvasRenderingContext2D, x: number, y: number, k: number, L: Lane, R: Lane, pole: boolean) {
  const X = (u: number) => x + u * k, Y = (u: number) => y + u * k;
  if (pole) {
    c.fillStyle = '#2a2a2e';
    c.fillRect(X(9), Y(44), 4 * k, 20 * k);
    c.fillStyle = '#4a4a50';
    c.fillRect(X(9), Y(44), 1.2 * k, 20 * k);
    c.fillStyle = '#1a1a1c';
    c.fillRect(X(5), Y(62), 12 * k, 2 * k);
  }
  c.fillStyle = '#111114';
  c.fillRect(X(0), Y(0), 22 * k, 45 * k);
  c.fillStyle = '#3a3a40';
  c.fillRect(X(0), Y(0), 22 * k, 1 * k);
  c.fillRect(X(10.5), Y(1), 1 * k, 44 * k); // divisória entre as faixas
  ([[6, L], [16, R]] as [number, Lane][]).forEach(([cx, s]) => {
    bulb(c, X(cx - 2.2), Y(3), 1.3 * k, s.pre, '#fff4c0', '#3a3628');
    bulb(c, X(cx + 2.2), Y(3), 1.3 * k, s.pre, '#fff4c0', '#3a3628');
    bulb(c, X(cx - 2.2), Y(7), 1.3 * k, s.stage, '#fff4c0', '#3a3628');
    bulb(c, X(cx + 2.2), Y(7), 1.3 * k, s.stage, '#fff4c0', '#3a3628');
    for (let a = 1; a <= 3; a++) bulb(c, X(cx), Y(7 + a * 6.5), 2.6 * k, s.amber === a, '#ffb21a', '#4a3410');
    bulb(c, X(cx), Y(33.5), 2.6 * k, s.green, '#3cff4a', '#123a16');
    bulb(c, X(cx), Y(40), 2.6 * k, s.red, '#ff2a1a', '#3a1210');
  });
}

// ---- objetos da pista (registrados no catálogo de sprites; sem colisão) ----
type Draw = (c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, seed: number) => void;
const reg = (kind: string, w: number, h: number, draw: Draw) => {
  const m = SPRITES as Record<string, { w: number; h: number; draw: Draw; solid: boolean }>;
  if (!m[kind]) m[kind] = { w, h, draw, solid: false };
  return kind as SpriteKind;
};
const treeKind = (L: Lane, R: Lane) => reg(`dragTree${laneCode(L)}${laneCode(R)}`, 540, 1560, (c, x, y, w, h) => {
  const k = h / 64;
  drawTree(c, x - 11 * k, y - h, k, L, R, true);
});
// placa da distância (1/8 de milha) nos dois lados
const boardKind = reg('dragBoard201', 1500, 1700, (c, x, y, w, h) => {
  const k = h / 34;
  c.fillStyle = '#2a2a2e';
  c.fillRect(x - 11 * k, y - 18 * k, 2 * k, 18 * k);
  c.fillRect(x + 9 * k, y - 18 * k, 2 * k, 18 * k);
  c.fillStyle = '#1a1614';
  c.fillRect(x - 15 * k, y - 34 * k, 30 * k, 17 * k);
  c.fillStyle = '#ffd21a';
  c.fillRect(x - 14 * k, y - 33 * k, 28 * k, 15 * k);
  c.fillStyle = '#1a1614';
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.font = `bold ${Math.max(4, Math.round(7 * k))}px monospace`;
  c.fillText('1/8', x, y - 29 * k);
  c.font = `bold ${Math.max(4, Math.round(5.5 * k))}px monospace`;
  c.fillText('201 M', x, y - 22 * k);
});
// pórtico da chegada, de lado a lado (pilares fora do guard-rail), faixa quadriculada e CHEGADA 402 M
const PORT_W = (LANE_W + 1000) * 2 + 600;
const finishKind = reg('dragFinish', PORT_W, 2900, (c, x, y, w, h) => {
  const k = h / 58, L = x - w / 2, R = x + w / 2;
  for (const px of [L, R - 6 * k]) {
    c.fillStyle = '#5a5a62';
    c.fillRect(px, y - 58 * k, 6 * k, 58 * k);
    c.fillStyle = '#8a8a92';
    c.fillRect(px, y - 58 * k, 1.5 * k, 58 * k);
    c.fillStyle = '#d01f26';
    for (let s = 0; s < 6; s++) c.fillRect(px, y - (8 + s * 8) * k, 6 * k, 3 * k);
  }
  c.fillStyle = '#1a1614';
  c.fillRect(L, y - 58 * k, w, 17 * k);
  // quadriculado em duas fileiras
  const sq = 4 * k, n = Math.ceil(w / sq);
  for (let i = 0; i < n; i++) for (let j = 0; j < 2; j++) {
    c.fillStyle = (i + j) % 2 ? '#f4f0e6' : '#1a1614';
    c.fillRect(L + i * sq, y - (57 - j * 4) * k, Math.min(sq, R - (L + i * sq)), 4 * k);
  }
  c.fillStyle = '#d01f26';
  c.fillRect(L, y - 49 * k, w, 8 * k);
  c.fillStyle = '#ffd21a';
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.font = `bold ${Math.max(4, Math.round(6.5 * k))}px monospace`;
  c.fillText('CHEGADA  402 M', x, y - 45 * k);
});
// arquibancada (atrás do guard-rail da esquerda, perto da largada): cobertura vermelha inclinada sobre
// pilares, o público na sombra, os degraus de concreto e a mureta da frente
const standKind = (v: number) => reg(`dragStand${v}`, 4200, 1300, (c, x, y, w, h) => {
  const rand = rng(77 + v * 131), k = h / 26, L = x - w / 2;
  c.fillStyle = '#4a4640'; // fundo na sombra
  c.fillRect(L, y - 21 * k, w, 21 * k);
  const PEOPLE = ['#d01f26', '#1e4fb8', '#ffd21a', '#f4f0e6', '#2a8a3a', '#e07a20', '#8a3ab8', '#f4f0e6'];
  const SKIN = ['#e8c098', '#c08a5a', '#8a5a34', '#5a3a20'];
  for (let r = 0; r < 4; r++) {
    const ry = y - (5 + r * 4) * k;
    c.fillStyle = r % 2 ? '#8a8478' : '#9a9488';
    c.fillRect(L, ry, w, 1 * k);
    for (let px = L + rand() * 2 * k; px < L + w - 2 * k; px += (1.7 + rand() * 1.2) * k) {
      if (rand() < 0.15) continue;
      c.fillStyle = PEOPLE[Math.floor(rand() * PEOPLE.length)];
      c.fillRect(px, ry - 2 * k, 1.4 * k, 2 * k);
      c.fillStyle = SKIN[Math.floor(rand() * SKIN.length)];
      c.fillRect(px + 0.2 * k, ry - 3.1 * k, 1 * k, 1.1 * k);
    }
  }
  c.fillStyle = '#d6d0c0'; // mureta
  c.fillRect(L, y - 3 * k, w, 3 * k);
  c.fillStyle = '#b8b2a2';
  c.fillRect(L, y - 1 * k, w, 1 * k);
  c.fillStyle = '#6a6a72'; // pilares
  for (let px = L; px <= L + w - 1.2 * k; px += w / 4 - 0.3 * k) c.fillRect(px, y - 23 * k, 1.2 * k, 20 * k);
  c.fillStyle = '#a0181e'; // cobertura
  c.beginPath();
  c.moveTo(L - 1 * k, y - 21 * k);
  c.lineTo(L + w + 1 * k, y - 21 * k);
  c.lineTo(L + w + 1 * k, y - 26 * k);
  c.lineTo(L - 1 * k, y - 24 * k);
  c.closePath();
  c.fill();
  c.fillStyle = '#e8343a';
  c.fillRect(L - 1 * k, y - 22 * k, w + 2 * k, 1 * k);
});
// torre de cronometragem (à direita, na largada): cabine envidraçada no alto
const towerKind = reg('dragTower', 2600, 3600, (c, x, y, w, h) => {
  const k = h / 72, L = x - w / 2;
  c.fillStyle = '#c8c0ae';
  c.fillRect(x - 8 * k, y - 50 * k, 16 * k, 50 * k);
  c.fillStyle = '#a8a08e';
  c.fillRect(x + 4 * k, y - 50 * k, 4 * k, 50 * k);
  c.fillStyle = '#1a1614';
  c.fillRect(L, y - 72 * k, w, 22 * k);
  c.fillStyle = '#7ab0d0';
  c.fillRect(L + 2 * k, y - 66 * k, w - 4 * k, 10 * k);
  c.fillStyle = '#a8d0e8';
  c.fillRect(L + 2 * k, y - 66 * k, w - 4 * k, 2 * k);
  c.fillStyle = '#d01f26';
  c.fillRect(L, y - 72 * k, w, 4 * k);
  c.fillStyle = '#ffd21a';
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.font = `bold ${Math.max(4, Math.round(3.5 * k))}px monospace`;
  c.fillText('DRAGWAY', x, y - 53 * k);
  c.fillStyle = '#5a5448';
  c.fillRect(x - 3 * k, y - 12 * k, 6 * k, 12 * k);
});

// ---- a pista ----
const point = (z: number): Point => ({ world: { y: 0, z }, camera: { x: 0, y: 0, z: 0 }, screen: { x: 0, y: 0, w: 0, scale: 0 } });
// faixa pintada no asfalto: de t0 a t1 do segmento (0 = perto), de a0 a a1 da meia largura (-1..1)
function band(c: CanvasRenderingContext2D, s: Segment, t0: number, t1: number, a0: number, a1: number, color: string) {
  const p1 = s.p1.screen, p2 = s.p2.screen;
  const P = (t: number) => ({ x: lerp(p1.x, p2.x, t), y: lerp(p1.y, p2.y, t), w: lerp(p1.w, p2.w, t) });
  const A = P(t0), B = P(t1);
  if (A.y - B.y < 0.6) B.y = A.y - 0.6; // de longe a linha continua com meio pixel
  c.fillStyle = color;
  c.beginPath();
  c.moveTo(A.x + a0 * A.w, A.y);
  c.lineTo(A.x + a1 * A.w, A.y);
  c.lineTo(B.x + a1 * B.w, B.y);
  c.lineTo(B.x + a0 * B.w, B.y);
  c.closePath();
  c.fill();
}
// linha no z (em metros a partir da largada) de espessura th (m)
function lineAt(c: CanvasRenderingContext2D, s: Segment, m: number, th: number, color: string, a0 = -0.965, a1 = 0.965) {
  const f0 = segAt(m) - s.index, f1 = f0 + th / SEG_M;
  if (f1 <= 0 || f0 >= 1) return;
  band(c, s, clamp(f0, 0, 1), clamp(f1, 0, 1), a0, a1, color);
}
function paintStrip(c: CanvasRenderingContext2D, s: Segment) {
  const m0 = (s.index - START) * SEG_M; // metros do começo do segmento até a linha
  // faixa branca contínua entre as duas pistas (por cima do tracejado amarelo da estrada)
  band(c, s, 0, 1, -0.03, 0.03, '#ecebe2');
  // borracha da largada: o asfalto escurecido e os rastros dos pneus nas duas pistas, sumindo adiante
  if (m0 > -14 && m0 < 120) {
    const k = m0 < 0 ? clamp((m0 + 14) / 14, 0, 1) : clamp(1 - m0 / 120, 0, 1);
    if (m0 < 70) band(c, s, 0, 1, -0.965, 0.965, `rgba(18,16,14,${(0.32 * Math.min(1, k * 1.6)).toFixed(3)})`);
    for (const lane of [-0.5, 0.5]) for (const wh of [-0.21, 0.21]) band(c, s, 0, 1, lane + wh - 0.05, lane + wh + 0.05, `rgba(6,5,4,${(0.55 * k).toFixed(3)})`);
  }
  // linha de largada (branca, larga) e a de alinhamento logo atrás
  lineAt(c, s, -0.45, 0.45, '#f4f2ea');
  lineAt(c, s, -3.2, 0.2, '#e8e4d8');
  // 60 pés: marquinhas brancas nas beiradas
  lineAt(c, s, D60, 0.25, '#e8e4d8', -0.965, -0.86);
  lineAt(c, s, D60, 0.25, '#e8e4d8', 0.86, 0.965);
  // 1/8 de milha: linha fina
  lineAt(c, s, D201, 0.35, '#f4f2ea');
  // chegada: faixa quadriculada
  if (m0 > D402 - 3 && m0 < D402 + 3) {
    const n = 16;
    for (let row = 0; row < 2; row++) {
      for (let i = 0; i < n; i++) {
        const a0 = -0.965 + (1.93 * i) / n, a1 = a0 + 1.93 / n;
        lineAt(c, s, D402 + row * 0.7, 0.7, (i + row) % 2 ? '#f4f2ea' : '#141210', a0, a1);
      }
    }
  }
}

function buildDragTrack(): Track {
  const roadW = LANE_W; // duas pistas
  const N = Math.ceil(segAt(D402 + 1100));
  const segments: Segment[] = [];
  for (let n = 0; n < N; n++) segments.push({ index: n, p1: point(n * SEG_LEN), p2: point((n + 1) * SEG_LEN), curve: 0, sprites: [], cars: [], clip: 0 });
  const put = (i: number, kind: SpriteKind, x: number, seed = 0) => segments[Math.round(i)]?.sprites.push({ kind, x, seed });
  const rand = rng(4021);
  // guard-rail dos dois lados, a pista toda
  for (let i = 0; i < N; i += 2) {
    put(i, 'rail', -(roadW + 700));
    put(i, 'rail', roadW + 700);
  }
  // postes de luz à direita e outdoors atrás dos dois guard-rails
  for (let i = 6; i < N; i += 14) put(i, 'lamp', roadW + 1300);
  for (let i = START + 30; i < segAt(D402 + 200); i += 46) put(i + 7, 'billboard', (i / 46) % 2 ? -(roadW + 3600) : roadW + 3800, Math.floor(rand() * 1e6));
  // arquibancadas à esquerda, da área de alinhamento até uns 100 m
  for (let i = START - 34, v = 0; i < segAt(110); i += 5, v++) put(i, standKind(v % 3), -(roadW + 2700));
  put(START - 6, towerKind, roadW + 3600);
  // árvore de luzes (o sprite muda de tipo conforme as lâmpadas acendem: DragRace.update)
  put(TREE_SEG, treeKind(OFF, OFF), 0);
  // 1/8 de milha e o pórtico da chegada
  put(segAt(D201), boardKind, -(roadW + 1500));
  put(segAt(D201), boardKind, roadW + 1500);
  put(segAt(D402), finishKind, 0);
  // deserto em volta (pouco: pedras e cactos longe da pista)
  for (let i = 10; i < N; i++) {
    if (rand() > 0.06) continue;
    const side = rand() < 0.5 ? -1 : 1;
    put(i, rand() < 0.5 ? 'cactus' : 'rock', side * (roadW + 6000 + rand() * 6000), Math.floor(rand() * 1e6));
  }
  return { segments, roadW, lanes: 2, startZ: LINE_Z, finishZ: segAt(D402) * SEG_LEN, policeSpots: [], paint: paintStrip };
}

// ---- tempos parciais: o instante (interpolado no passo) em que se passa de cada marca ----
const blank = (): Splits => ({ rt: 0, t60: -1, t201: -1, v201: 0, t402: -1, v402: 0 });
function marks(sp: Splits, d0: number, d1: number, t0: number, t1: number, v: number) {
  const at = (m: number) => t0 + ((t1 - t0) * (m - d0)) / Math.max(1e-6, d1 - d0);
  if (sp.t60 < 0 && d1 >= D60) sp.t60 = at(D60);
  if (sp.t201 < 0 && d1 >= D201) { sp.t201 = at(D201); sp.v201 = v * KMH; }
  if (sp.t402 < 0 && d1 >= D402) { sp.t402 = at(D402); sp.v402 = v * KMH; }
}

// rival: o carro de verdade (Powertrain, câmbio automático, pé no fundo), sai do verde com um tempo de reação
interface FoeSim { z: number; speed: number; pt: Powertrain; rt: number; t: number; sp: Splits }
function foeStep(f: FoeSim, car: CarSpec, dt: number) {
  const d0 = (f.z - LINE_Z) / UPM, t0 = f.t;
  f.pt.antiLag = !!car.launchCap && f.t < 2;
  if (f.sp.t402 < 0) {
    const a = f.pt.step(f.speed, true, dt, 1, true, 1);
    f.speed = Math.max(0, f.speed + toGame(a - resistAcc(car, f.speed)) * dt);
  } else f.speed = Math.max(0, f.speed - toGame(G * 0.9) * dt); // passou a chegada: freia
  f.z += f.speed * dt;
  f.t += dt;
  marks(f.sp, d0, (f.z - LINE_Z) / UPM, t0, f.t, f.speed);
}

type Phase = 'stage' | 'tree' | 'run' | 'done';

export class DragRace extends Race {
  phase: Phase = 'stage';
  treeT = 0; // segundos desde que a árvore começou (ou desde que o jogador alinhou)
  greenAt = -1; // instante do verde (no relógio da árvore)
  private amberAt = -1;
  private stagedT = 0;
  foul = false;
  me: Splits = blank();
  private releaseT = -1;
  private lastD = 0;
  private lastT = 0;
  private foe: FoeSim | null = null;
  private doneT = 0;
  private treeSp: { kind: SpriteKind } | null = null;
  private beeped = 0;
  private finished = false;
  result: DragResult | null = null;
  readonly prepped: boolean;

  constructor(car: CarSpec, rival: CarSpec | null, auto: boolean, private onDone: (r: DragResult) => void) {
    super(DRAG_COURSE, 0, car, rival, auto, { rivalAhead: true });
    this.prepped = arcadePrepped(car.id);
    this.pitStop = false; // passa reto pela chegada (sem posto)
    this.track = buildDragTrack();
    this.traffic = [];
    this.police = [];
    this.blitz = null;
    this.obra = null;
    this.wxTurn = null;
    this.position = LINE_Z - 400; // a frente do carro na linha (PLAYER_Z à frente da câmera)
    this.x = LANE_W / 2; // pista da direita
    this.treeSp = this.track.segments[TREE_SEG].sprites.find((sp) => sp.kind.startsWith('dragTree')) ?? null;
    if (this.rival && rival) {
      Object.assign(this.rival, { z: LINE_Z, x: -LANE_W / 2, targetX: -LANE_W / 2, speed: 0 });
      const pt = new Powertrain(rival);
      if (rival.curve === 'turbo' || rival.curve === 'seqturbo') pt.boost = rival.launchCap ? 0.95 : LAUNCH_BOOST;
      // reação do rival: entre 0,14 e 0,38 s (sorteada a cada largada)
      this.foe = { z: LINE_Z, speed: 0, pt, rt: 0.14 + Math.random() * 0.24, t: 0, sp: blank() };
    }
    this.hud = (c, vp) => this.drawHud(c, vp);
  }

  get dist() {
    return (this.playerZ - LINE_Z) / UPM;
  }
  // tecla de alinhar/largar: o freio, ou a embreagem no MANUAL + EMBREAGEM
  private held() {
    return this.clutchMode ? clutchAmt() : brakeAmt() > 0.5;
  }

  // lâmpadas de cada faixa agora
  lanes(): { L: Lane; R: Lane } {
    const t = this.treeT;
    const amber = (on: boolean) => {
      if (!on || this.amberAt < 0 || t < this.amberAt) return 0;
      const k = Math.floor((t - this.amberAt) / 0.5) + 1;
      return k <= 3 ? k : 0;
    };
    const green = this.greenAt >= 0 && t >= this.greenAt;
    const meStaged = this.phase === 'tree' ? this.releaseT < 0 : this.phase === 'stage' && this.held();
    const R: Lane = {
      pre: this.phase === 'stage' ? this.held() : this.releaseT < 0 || this.phase === 'tree',
      stage: meStaged && (this.phase === 'tree' || this.stagedT > 0.35),
      amber: this.foul ? 0 : amber(true),
      green: green && !this.foul,
      red: this.foul,
    };
    const foe = this.foe;
    const foeGone = !!foe && this.greenAt >= 0 && t >= this.greenAt + foe.rt;
    const L: Lane = foe
      ? { pre: !foeGone, stage: !foeGone && (this.phase !== 'stage' || this.treeT > 0.6), amber: amber(true), green, red: false }
      : { pre: false, stage: false, amber: amber(true), green, red: false };
    return { L, R };
  }

  update(dt: number) {
    if (this.phase === 'stage' || this.phase === 'tree') {
      this.treeT += dt;
      this.timer = 99; // sem a contagem 3-2-1 da estrada (a largada é da árvore)
      if (this.phase === 'stage') {
        // alinhando: segurou a tecla por um instante, a árvore começa (amarelas em 1 a 1,6 s)
        if (this.held()) this.stagedT += dt;
        else this.stagedT = 0;
        if (this.stagedT > 0.6 && this.treeT > 0.8) {
          this.phase = 'tree';
          this.treeT = 0;
          this.amberAt = 0.9 + Math.random() * 0.7;
          this.greenAt = this.amberAt + 1.5;
        }
      } else {
        // amarelas (bipe curto) e o verde (bipe mais alto)
        const n = this.amberAt >= 0 && this.treeT >= this.amberAt ? Math.min(4, Math.floor((this.treeT - this.amberAt) / 0.5) + 1) : 0;
        if (n > this.beeped) {
          this.beeped = n;
          if (!this.foul) beep(n >= 4 ? 660 : 330, n >= 4 ? 0.35 : 0.1);
        }
        if (!this.held()) {
          // soltou: antes do verde é largada queimada (o carro sai igual, a vermelha acende)
          this.releaseT = this.treeT;
          this.foul = this.treeT < this.greenAt;
          this.me.rt = this.treeT - this.greenAt;
          this.phase = 'run';
          this.timer = 0; // a corrida de base vira "drive" neste passo e faz a saída (ou a embreagem)
          this.lastD = this.dist;
          this.lastT = 0;
        }
      }
    } else this.treeT += dt;
    super.update(dt);
    // tempos do jogador (o relógio da corrida começa quando ele solta)
    if (this.phase === 'run' || this.phase === 'done') {
      const d = this.dist;
      if (this.me.t402 < 0) marks(this.me, this.lastD, d, this.lastT, this.time, this.speed);
      this.lastD = d;
      this.lastT = this.time;
    }
    this.simFoe(dt);
    // árvore da pista: o tipo do sprite acompanha as lâmpadas
    if (this.treeSp) {
      const { L, R } = this.lanes();
      this.treeSp.kind = treeKind(L, R);
    }
    // passou a chegada (a corrida de base freia sozinha): o resultado sai com o carro já devagar
    if (this.me.t402 >= 0 && this.phase === 'run') this.phase = 'done';
    if (this.phase === 'done' && !this.finished) {
      this.doneT += dt;
      if (!this.result) this.settle();
      if (this.doneT > 3.2 || (this.doneT > 1.6 && this.speed * KMH < 60)) {
        this.finished = true;
        this.onDone(this.result!);
      }
    }
  }

  private simFoe(dt: number) {
    const f = this.foe, r = this.rival, car = this.rivalCar;
    if (!f || !r || !car) return;
    if (this.greenAt >= 0 && this.treeT >= this.greenAt + f.rt) foeStep(f, car, dt);
    r.z = f.z;
    r.x = r.targetX = -LANE_W / 2;
    r.speed = f.speed;
    r.signal = 0;
    r.flash = 0;
    r.pt.gear = f.pt.gear;
    r.pt.boost = f.pt.boost;
    this.rivalTop = Math.max(this.rivalTop, f.speed);
  }

  // fim: o rival que ainda não chegou é simulado até a chegada (o mesmo carro, sem desenhar)
  private settle() {
    const f = this.foe, car = this.rivalCar;
    let rival: Splits | null = null;
    if (f && car) {
      const g: FoeSim = { ...f, sp: { ...f.sp }, pt: f.pt };
      for (let k = 0; k < 60 * 90 && g.sp.t402 < 0; k++) foeStep(g, car, 1 / 60);
      rival = { ...g.sp, rt: f.rt };
    }
    const meTotal = this.me.rt + this.me.t402;
    const won = !this.foul && (!rival || rival.t402 < 0 || meTotal <= rival.rt + rival.t402);
    const sv = this.foul ? { prev: dragRecord(this.car.id, this.prepped), record: false } : saveRec(this.car.id, this.prepped, this.me);
    this.result = { car: this.car, rivalCar: this.rivalCar, prepped: this.prepped, me: { ...this.me }, rival, foul: this.foul, won, best: sv.prev, record: sv.record };
    dragLast = this.result;
  }

  // ---- HUD no para-brisa: árvore de luzes, instruções, tempos e o resultado ----
  private drawHud(c: CanvasRenderingContext2D, vp: { x: number; y: number; w: number; h: number }) {
    const w = vp.w, cx = Math.round(w / 2) + 34; // à direita da árvore da pista (que fica à esquerda do centro)
    const mid = Math.round(w / 2);
    const { R } = this.lanes();
    const showTree = this.phase !== 'done' && (this.phase !== 'run' || this.time < 2.2);
    if (showTree) {
      // barra de luzes da sua pista (a árvore de verdade fica na pista, à esquerda): alinhado, as três
      // amarelas, a verde e a vermelha, no alto do para-brisa (legível também em tela de celular)
      const bw = 68, bx = cx - bw / 2, by = vp.y + 3;
      c.fillStyle = 'rgba(0,0,0,0.62)';
      c.fillRect(bx - 2, by - 2, bw + 4, 15);
      bulb(c, bx + 4, by + 3, 1.6, R.pre, '#fff4c0', '#3a3628');
      bulb(c, bx + 4, by + 8, 1.6, R.stage, '#fff4c0', '#3a3628');
      for (let a = 1; a <= 3; a++) bulb(c, bx + 4 + a * 11, by + 5.5, 4, R.amber === a, '#ffb21a', '#4a3410');
      bulb(c, bx + 48, by + 5.5, 4, R.green, '#3cff4a', '#123a16');
      bulb(c, bx + 60, by + 5.5, 4, R.red, '#ff2a1a', '#3a1210');
    }
    const key = this.clutchMode ? 'A EMBREAGEM' : 'O FREIO';
    const blink = Math.floor(this.treeT * 3) % 2 === 0;
    const y2 = vp.y + 19;
    if (this.phase === 'stage') {
      if (blink || this.held()) text(c, this.held() ? 'ALINHANDO...' : `SEGURE ${key}`, cx, y2, 5, '#ffd21a', 'center');
      text(c, 'ACELERE PARADO E', cx, y2 + 9, 4, '#ffffff', 'center');
      text(c, `SOLTE ${this.clutchMode ? 'A EMBREAGEM' : 'O FREIO'} NO VERDE`, cx, y2 + 16, 4, '#ffffff', 'center');
    } else if (this.phase === 'tree') {
      const green = this.greenAt >= 0 && this.treeT >= this.greenAt;
      text(c, green ? 'VAI! SOLTE!' : 'ESPERE O VERDE...', cx, y2, green ? 8 : 5, green ? '#3cff4a' : '#ffd21a', 'center');
    } else if (this.phase === 'run' && this.time < 2.4) {
      if (this.foul) text(c, 'QUEIMOU!', cx, y2, 8, '#ff3a2a', 'center');
      else text(c, `REAÇÃO ${secs(this.me.rt, 3)}`, cx, y2, 5, this.me.rt < 0.2 ? '#3cff4a' : '#ffffff', 'center');
    }
    // parciais no canto esquerdo do para-brisa (aparecem conforme passa)
    if (this.phase === 'run' || this.phase === 'done') {
      const lines: [string, string][] = [];
      if (this.me.t60 >= 0) lines.push(['18 M', secs(this.me.t60)]);
      if (this.me.t201 >= 0) lines.push(['201 M', `${secs(this.me.t201)} ${Math.round(this.me.v201)}`]);
      if (this.me.t402 >= 0) lines.push(['402 M', `${secs(this.me.t402)} ${Math.round(this.me.v402)}`]);
      const bx = cx - 37, by = vp.y + 3;
      if (lines.length && !showTree) {
        c.fillStyle = 'rgba(10,8,6,0.6)';
        c.fillRect(bx, by, 74, 6 + lines.length * 7);
        lines.forEach(([a, b], i) => {
          text(c, a, bx + 3, by + 3 + i * 7, 4, '#ffd21a', 'left', null);
          text(c, b, bx + 71, by + 3 + i * 7, 4, '#ffffff', 'right', null);
        });
      }
    }
    if (this.phase === 'done' && this.result) {
      const r = this.result;
      const label = r.foul ? 'QUEIMOU!' : !r.rival ? secs(r.me.t402, 3) : r.won ? 'VITÓRIA!' : 'DERROTA';
      const col = r.foul || (r.rival && !r.won) ? '#ff3a2a' : r.won && r.rival ? '#3cff4a' : '#ffd21a';
      text(c, label, mid, vp.y + 26, 16, col, 'center');
      if (r.record) text(c, 'NOVO RECORDE!', mid, vp.y + 48, 5, '#ffd21a', 'center');
    }
  }
}

// segundos com vírgula (12,345)
export const secs = (t: number, d = 3) => (t < 0 ? '-' : '') + Math.abs(t).toFixed(d).replace('.', ',');
// para os testes
export const DRAG_TEST = { LINE_Z, START, CAR_W };
