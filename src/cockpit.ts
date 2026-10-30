import { ghostTimeAt } from './records';
import { DASH_Y, KMH, ROOF_H, view } from './config';
import type { Race } from './race';
import { renderMirror, renderRoad, type Viewport } from './render3d';
import { pix, pix7, pix7Width, pixWidth } from './pixfont';
import { dither, speckle, text } from './ui';
import { clamp, formatTime, lerp, rng, shade } from './util';
import { F40_WHEEL } from './svg/f40';
import { preloadSvg, spriteAspect, svgSprite } from './svgsprites';
import { drawWipers, type DashTop } from './wipers';
import { drawSideMirror, findGlass } from './sidemirror';
import { drawSmoke } from './smoke';
import { blinkOn } from './cars';
// cabines em pixel art (tools/ref/import_cockpit.py)
import dashF40Png from './assets/cockpit/f40-dash.png';
import wheelF40Png from './assets/cockpit/f40-wheel.png';
import dash959Png from './assets/cockpit/959-dash.png';
import top959Png from './assets/cockpit/959-top.png';
import topF40Png from './assets/cockpit/f40-top.png';
import wheel959Png from './assets/cockpit/959-wheel.png';
// cabines desenhadas por código (tools/art/interiors.py)
import INTERIORS from './assets/cockpit/interiors.json';
import { paintHex } from './paint';
import { lowFx } from './perf';

interface CockpitArt {
  dash: string;
  top: string; // coluna da porta prolongada até o teto (76 linhas acima da arte)
  wheel: string;
  dashMask?: string; // partes na cor do carro (capô, porta, colunas), para a repintura
  topMask?: string;
  radar?: [number, number]; // canto do detector de radar no painel (padrão 206, 22)
  // retrovisor desenhado à parte (quando a arte o corta na borda): sprite e posição do canto,
  // x nas coordenadas do painel (pode ser negativo: fica na área esticada de tela larga), y a
  // partir do topo da arte (topo de 76 linhas + painel)
  mirror?: { img: string; x: number; y: number };
  glass?: { at: [number, number]; thr?: number };
  tells?: [number, number] | null; // luzes da seta no quadro (null: a cabine já desenha as dela) // ponto dentro do vidro do retrovisor (teto + painel), ver findGlass
  dy?: number; // desce a cabine inteira (painel alto demais tapando a pista)
  wheelDx?: number; // desloca o volante para a direita (alinha com o quadro de instrumentos)
  wheelTop?: number; // linhas do PNG do volante acima do topo da arte (aro inteiro sobre o para-brisa)
  wheelDy?: number; // desce o volante (posição do banco: o aro não tapa a estrada)
  pivot: [number, number]; // centro do aro (pixels nativos, a partir do topo da arte)
  tach?: Dial;
  speed?: Dial;
  lcd?: boolean; // painel digital (Corvette C4): visores desenhados por lcdPanel
  odo?: Box; // hodômetro (viatura): quilometragem andando de verdade
  prnd?: Box; // indicador da alavanca P R N D 2 1 (viatura)
  speedMax: number;
  needle: string;
  needleW?: number; // espessura do ponteiro (padrão 1 px)
  needleTail?: number; // contrapeso do ponteiro, além do eixo (px)
  hub: string;
  aux: Aux[];
  under?: (c: CanvasRenderingContext2D, ox: number, r: Race) => void; // fundo do quadro, antes dos mostradores
  extra?: (c: CanvasRenderingContext2D, ox: number, r: Race) => void; // detalhes próprios (hodômetros, luzes-espia, submostradores)
}

// Mostrador redesenhado em pixels (os números da arte ficam ilegíveis em 256 px):
// centro inteiro medido na arte, raio horizontal (o vertical é 8/7 maior), rótulos e
// fração da escala onde começa a faixa vermelha
// face: false = o mostrador da arte já é legível, o jogo só desenha o ponteiro;
// a0/sweep: onde começa a escala e quanto ela abre (padrão 135° e 270°)
interface Dial { x: number; y: number; r: number; max: number; labels: number[]; tick: number; red: number; face?: boolean; a0?: number; sweep?: number; labelScale?: number; cut?: number;
  minor?: number[]; // números pequenos entre os principais (Veglia, VDO)
  labelMul?: number; // o número escrito é v × labelMul (conta-giros "× 100" da F40)
  redLabels?: boolean; // false: números da faixa vermelha continuam brancos
  yellow?: number; // começo da faixa amarela (antes da vermelha)
  nudge?: Record<number, [number, number]>; // ajuste fino de números que se encostam (dx, dy)
  ink?: string; // cor dos números e marcações (padrão branco; laranja no VDO do Gol GTI)
  bg?: string; // cor do fundo do mostrador
  redInk?: string; // cor da faixa vermelha
  redW?: number; // largura da faixa vermelha (px)
  redHatch?: boolean; // faixa vermelha listrada (VDO do GTI)
  boldTicks?: boolean; // marcações grossas (traço de 1 px, os principais mais compridos)
}

// Mostradores auxiliares, também redesenhados: 'single' (um ponteiro), 'dual' (dois
// ponteiros no mesmo eixo, em V), 'twin' (dois eixos lado a lado) e 'clock' (relógio)
// oil = pressão do óleo, boost = pressão do turbo, volt = voltímetro
type Gauge = 'oil' | 'water' | 'oiltemp' | 'fuel' | 'boost' | 'volt';
interface Aux { x: number; y: number; r: number; kind: 'single' | 'dual' | 'twin' | 'clock' | 'combo'; show?: Gauge[]; icon?: keyof typeof ICONS; labels?: string[] }

// a arte cobre da linha 100 da tela até o fim (124 linhas); o topo transparente mostra a estrada
let ART_TOP = 100; // linha da tela onde começa a arte do painel (cada cabine pode descer: art.dy)
const DASH_PAD = 102; // colunas extras de cada lado do painel (telas largas), ver import_cockpit.py
const DASH_W = 256 + 2 * DASH_PAD;
const TOP_EXT = 76; // linhas do teto (24) até o topo da arte
const CPNG = import.meta.glob('./assets/cockpit/*.png', { eager: true, import: 'default' }) as Record<string, string>;
function cp(n: string) {
  return CPNG[`./assets/cockpit/${n}.png`];
}
const COCKPIT_ART: Record<string, CockpitArt> = {
  f40: { dash: dashF40Png, top: topF40Png, wheel: wheelF40Png, dashMask: cp('f40-dash-mask'), topMask: cp('f40-top-mask'), pivot: [127.4, 80], tells: [129, 47], 
    // Veglia Borletti: velocímetro à esquerda e conta-giros à direita; conta-giros 0-100 (× 100 rpm), velocímetro 0-360 com os intermediários
    // pequenos, hodômetro e parcial dentro dele; água 60/90/120 e turbo 0/0,8/1,5 bar embaixo
    tach: { x: 149, y: 46, r: 17, max: 10, labels: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10], labelMul: 10, tick: 0.25, red: 7.75, redLabels: false },
    speed: { x: 109, y: 46, r: 17, max: 360, labels: [0, 40, 80, 120, 160, 200, 240, 280, 320, 360], tick: 10, red: 999 },
    speedMax: 360, needle: '#f4f4f0', hub: '#1a1a1a',
    aux: [
      { x: 79, y: 45, r: 6.5, kind: 'single', show: ['oil'], icon: 'oil' },
      { x: 79, y: 65, r: 8, kind: 'single', show: ['water'], icon: 'temp', labels: ['60', '90', '120'] },
      { x: 176, y: 45, r: 6.5, kind: 'single', show: ['fuel'], icon: 'fuel' },
      { x: 176, y: 65, r: 8, kind: 'single', show: ['boost'], icon: 'turbo', labels: ['0', '0,8', '1,5'] },
    ],
    extra: (c, ox, r) => {
      odometer(c, ox, r, { x: 103, y: 40.5, w: 12, h: 3.5 }, 18373, 6, 0.5);
      odometer(c, ox, r, { x: 105, y: 51.5, w: 8, h: 3.5 }, 425.7, 4, 0.5, true);
      // luzes-espia entre os mostradores: "slow down" (pisca no corte de giro) e óleo
      warnLamp(c, ox + 129, ART_TOP + 38, r.rpm > 0.97 && Math.floor(performance.now() / 160) % 2 === 0);
      warnLamp(c, ox + 129, ART_TOP + 56, gauges.oil < 0.36);
    } },
  // 959: interior completo do Victor; os cinco mostradores redesenhados com números maiores
  '959': { dash: dash959Png, top: top959Png, wheel: wheel959Png, pivot: [128.2, 84.3], tells: [129, 37],
    // VDO: conta-giros 1-8 com faixa vermelha a partir de 7,5 e o manômetro do turbo (0-2,5 bar)
    // embaixo; velocímetro 20-340 com hodômetro; à esquerda o combinado de óleo (temperatura,
    // pressão e nível) e o de combustível e água
    tach: { x: 129, y: 49, r: 24, max: 8, labels: [1, 2, 3, 4, 5, 6, 7, 8], tick: 0.25, red: 7.5, a0: 2.53, sweep: 4.45, labelScale: 1, redLabels: false },
    speed: { x: 176, y: 53, r: 19, max: 340, labels: [20, 60, 100, 140, 220, 260, 300, 340], minor: [180], tick: 10, red: 999, a0: 2.46, sweep: 4.4, labelScale: 0.5 },
    speedMax: 340, needle: '#ff6a1a', hub: '#1a1a1a',
    aux: [
      { x: 38, y: 53, r: 16, kind: 'combo', show: ['oiltemp', 'oil'] },
      { x: 83, y: 53, r: 17.5, kind: 'twin', show: ['fuel', 'water'], icon: 'fuel' },
      { x: 223, y: 53, r: 18, kind: 'clock' },
    ],
    extra: (c, ox, r) => {
      boostSubdial(c, ox + 129.5, ART_TOP + 66, 6.5, '#ff6a1a');
      odometer(c, ox, r, { x: 170.5, y: 45, w: 12, h: 3.5 }, 14250, 6, 0.5);
    } },
};

// Viatura: painel de sedã com hodômetro e indicador da alavanca funcionando
COCKPIT_ART.patrol = {
  dash: cp('patrol-dash'), top: cp('patrol-top'), wheel: cp('patrol-wheel'),
  pivot: [128.2, 103.1], wheelTop: 5, speedMax: 240, needle: '#ff2a1a', hub: '#1a1a1c', aux: [],
  // redesenhados nítidos sobre a arte (reduzida, ela borra); escala como na arte: do 0 (≈ 148°)
  // ao fim (≈ 30°), 242° de abertura, números em pixel inteiro
  tach: { x: 87, y: 65, r: 26.5, cut: 20, max: 8, labels: [0, 1, 2, 3, 4, 5, 6, 7, 8], tick: 0.5, red: 6, a0: 2.6, sweep: 4.22, labelScale: 1 },
  speed: { x: 179, y: 65, r: 25.5, cut: 20, max: 240, labels: [0, 40, 80, 120, 160, 200, 240], tick: 10, red: 999, a0: 2.55, sweep: 4.25, labelScale: 1 },
  odo: { x: 118, y: 43, w: 32, h: 11 }, prnd: { x: 118, y: 59, w: 32, h: 8 },
};

// Diablo SV: interior do Victor com o quadro VDO de verdade: velocímetro 0-360 com hodômetro
// de cristal líquido, conta-giros 0-90 (× 100 rpm) com faixa amarela e vermelha, ponteiros
// laranja; à esquerda temperatura e pressão do óleo, no meio a água, à direita combustível e relógio
COCKPIT_ART.diablo = {
  glass: { at: [20, 70] },
  dash: cp('diablo-dash'), top: cp('diablo-top'), wheel: cp('diablo-wheel'),
  pivot: [128, 103], dy: 14, wheelDx: 10, wheelTop: 7, radar: [196, 6], speedMax: 360, needle: '#ff7a1a', hub: '#1a1a1c',
  speed: { x: 103.5, y: 40, r: 23, max: 360, labels: [0, 40, 80, 120, 160, 200, 240, 280, 320, 360], nudge: { 120: [-0.5, 0.5], 160: [-2.5, 0.5], 200: [1.5, 0], 240: [0.5, 0.5] }, tick: 10, red: 999, labelScale: 0.7 },
  tach: { x: 178.5, y: 39.5, r: 23, max: 9, labels: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], labelMul: 10, tick: 0.25, yellow: 6.8, red: 7.2, labelScale: 0.7, redLabels: false },
  aux: [
    { x: 140.5, y: 28, r: 12, kind: 'single', show: ['water'], icon: 'temp', labels: ['40', '80', '120'] },
    { x: 221, y: 30.5, r: 11, kind: 'single', show: ['fuel'], icon: 'fuel', labels: ['0', '1/2', '1'] },
    { x: 238, y: 53, r: 12.5, kind: 'clock' },
    { x: 68, y: 40, r: 9.5, kind: 'single', show: ['oiltemp'], icon: 'temp', labels: ['50', '100', '150'] },
    { x: 52, y: 60.5, r: 8, kind: 'single', show: ['oil'], icon: 'oil', labels: ['0', '5', '10'] },
  ],
  extra: (c, ox, r) => odometer(c, ox, r, { x: 97.5, y: 47.5, w: 12, h: 3.5 }, 30414, 6, 0.5),
};

// Vectra GSi: quadro como o de verdade — conta-giros 0-8 ("ELECTRONIC", faixa vermelha a partir de
// 6,8) e velocímetro 20-240 varrendo 270° (do 0 embaixo à esquerda até embaixo à direita, como
// os números da arte), hodômetro e parcial abaixo do eixo, ponteiros brancos; à direita
// temperatura da água, combustível, pressão do óleo e voltímetro
COCKPIT_ART['br-vectra'] = {
  tells: [115, 44],
  glass: { at: [20, 96], thr: 40 },
  dash: cp('br-vectra-dash'), top: cp('br-vectra-top'), wheel: cp('br-vectra-wheel'),
  pivot: [128, 103.6], speedMax: 240, needle: '#f2f2f2', hub: '#1a1a1c', radar: [206, 4],
  tach: { x: 89.5, y: 65.5, r: 21.5, max: 8, labels: [0, 1, 2, 3, 4, 5, 6, 7, 8], tick: 0.5, red: 6.8, a0: Math.PI * 0.75, sweep: Math.PI * 1.5, labelScale: 0.7, redLabels: false },
  speed: { x: 140, y: 64, r: 23.5, max: 240, labels: [20, 60, 100, 140, 180, 220], minor: [40, 80, 160, 200, 240], nudge: { 100: [-0.5, 0.5], 140: [0.5, 0.5] }, tick: 10, red: 999, a0: Math.PI * 0.75, sweep: Math.PI * 1.5, labelScale: 0.7 },
  aux: [
    { x: 178.5, y: 55.5, r: 5.5, kind: 'single', show: ['water'], icon: 'temp' },
    { x: 196.5, y: 58, r: 6, kind: 'single', show: ['fuel'], icon: 'fuel' },
    { x: 178.5, y: 74.5, r: 6, kind: 'single', show: ['oil'], icon: 'oil' },
    { x: 197, y: 75.5, r: 6, kind: 'single', show: ['volt'], icon: 'volt' },
  ],
  extra: (c, ox, r) => {
    // a marca vermelha do marcador de combustível da arte (fora do lugar do mostrador novo)
    c.fillStyle = '#121214';
    c.fillRect(ox + 192, ART_TOP + 47, 6, 4);
    odometer(c, ox, r, { x: 134, y: 70, w: 12, h: 3.5 }, 157774, 6, 0.5);
    odometer(c, ox, r, { x: 136, y: 75, w: 8, h: 3.5 }, 202.4, 4, 0.5, true);
  },
};

// Gol GTI: quadro VDO como o de verdade — velocímetro 20-240 à esquerda e conta-giros 0-7 à
// direita (faixa vermelha de 6,5 a 7), números e marcações laranja, ponteiros creme; hodômetro
// 020285 e parcial no velocímetro, água e combustível nos cantos de baixo do conta-giros e, no
// meio, o logotipo GTi, as luzes-espia e o relógio de cristal líquido
const GTI_INK = '#ff7a1e';
const GTI_LOGO = [
  ['.111.', '1....', '1.11.', '1..1.', '.111.'], // G
  ['111', '.1.', '.1.', '.1.', '.1.'], // T
];
function golMini(c: CanvasRenderingContext2D, x: number, y: number, R: number, a0: number, a1: number, v: number, art: CockpitArt) {
  // mostrador de canto do conta-giros: marcações grossas laranja, as duas últimas da ponta
  // de alerta (água quente / reserva) vermelhas, ponteiro creme com eixo preto
  const at = (a: number, rr: number): [number, number] => [x + Math.cos(a) * rr, y + Math.sin(a) * rr * PIX_Y];
  for (let i = 0; i <= 4; i++) {
    const a = a0 + ((a1 - a0) * i) / 4, px = -Math.sin(a) * 0.5, py = Math.cos(a) * 0.5;
    c.fillStyle = i >= 3 ? '#ff3a18' : GTI_INK;
    for (const k of i === 0 || i === 4 ? [0, 0.5, 1, 1.5] : [0, 0.5, 1]) {
      const [xx, yy] = at(a, R - k);
      half(c, xx, yy);
      half(c, xx + px, yy + py);
    }
  }
  hand(c, x, y, a1 + (a0 - a1) * clamp(v, 0, 1), R - 2.5, art.needle);
  c.fillStyle = '#060607';
  c.fillRect(Math.round(x * 2) / 2 - 1, Math.round(y * 2) / 2 - 1, 2, 2);
}
// rótulo pequeno (letras em meio pixel), centrado
const tiny = (c: CanvasRenderingContext2D, s: string, x: number, y: number, color = '#c8c8c8') => pix(c, s, x, y, color, 0.5);
// tambores do hodômetro com a moldura prateada
function golDrums(c: CanvasRenderingContext2D, ox: number, r: Race, b: Box, base: number, digits: number, lastRed: boolean) {
  rect(c, ox + b.x - 1, ART_TOP + b.y - 0.5, b.w + 2, b.h + 1, '#5a5a60');
  rect(c, ox + b.x - 0.5, ART_TOP + b.y, b.w + 1, b.h, '#020203');
  odometer(c, ox, r, b, base, digits, 0.5, lastRed);
}
function golCluster(c: CanvasRenderingContext2D, ox: number, r: Race, art: CockpitArt) {
  const T = ART_TOP;
  const sp = art.speed!, t = art.tach!;
  c.save();
  c.beginPath();
  c.rect(ox + 56, T + 18, 158, 60); // borda de baixo do quadro
  c.clip();
  // velocímetro: "vdo km", hodômetro, parcial com o botão de zerar e "km/h"
  tiny(c, 'vdo', ox + sp.x + 1, T + sp.y - 15);
  tiny(c, 'km', ox + sp.x + 1, T + sp.y - 12);
  golDrums(c, ox, r, { x: sp.x - 7.5, y: sp.y - 10, w: 15, h: 4 }, 20285, 6, false);
  golDrums(c, ox, r, { x: sp.x - 8, y: sp.y + 5, w: 10, h: 4 }, 116.0, 4, true);
  tiny(c, 'km/h', ox + sp.x - 4, T + sp.y + 13);
  rect(c, ox + sp.x - 6, T + sp.y + 15.5, 2.5, 2.5, '#2a2a2e');
  rect(c, ox + sp.x - 5.5, T + sp.y + 16, 1, 1, '#6a6a70');
  // conta-giros: "VDO" acima do eixo, "1/min x1000" abaixo, água e combustível nos cantos
  tiny(c, 'VDO', ox + t.x + 1, T + t.y - 8);
  tiny(c, '1/min x1000', ox + t.x + 1, T + t.y + 9);
  golMini(c, ox + t.x - 8, T + t.y + 17, 9, Math.PI * 1.2, Math.PI * 0.74, 1 - gauges.water, art);
  drawIcon(c, 'temp', ox + t.x - 3, T + t.y + 13, GTI_INK);
  golMini(c, ox + t.x + 9, T + t.y + 17, 9, -Math.PI * 0.2, Math.PI * 0.26, gauges.fuel, art);
  drawIcon(c, 'fuel', ox + t.x + 4.5, T + t.y + 13, GTI_INK);
  c.restore();
  // módulo do meio
  const mx = ox + 121, my = T + 24;
  rect(c, mx, my, 28, 52, '#0c0c0e');
  rect(c, mx, my, 28, 0.5, '#2e2e32');
  // logotipo GTi: placa preta com moldura cinza, letras cromadas inclinadas e o i vermelho
  rect(c, mx + 2, my + 1.5, 24, 10, '#3a3a40');
  rect(c, mx + 2.5, my + 2, 23, 9, '#030304');
  let gx = mx + 6.5;
  for (const g of GTI_LOGO) {
    g.forEach((row, j) => [...row].forEach((ch, i) => {
      if (ch !== '1') return;
      c.fillStyle = j < 2 ? '#f4f6f8' : j < 4 ? '#c4c8ce' : '#8e949c';
      c.fillRect(gx + i + (4 - j) * 0.5, my + 4 + j, 1, 1);
    }));
    gx += g[0].length + 1;
  }
  c.fillStyle = '#ff3a1a';
  for (const j of [0, 2, 3, 4]) c.fillRect(gx + (4 - j) * 0.5, my + 4 + j, 1.5, 1);
  // faixa de símbolos de cima: setas, bateria, farol alto
  const strip = (y: number) => {
    rect(c, mx + 2, y, 24, 4, '#232327');
    rect(c, mx + 2, y + 4, 24, 0.5, '#050506');
  };
  strip(my + 13);
  const ink = '#d8d8d8';
  c.fillStyle = ink;
  // setas ⇦⇨
  for (const [x, d] of [[mx + 4, -1], [mx + 8, 1]] as [number, number][]) {
    c.fillRect(x, my + 14.5, 2, 0.5);
    c.fillRect(x + (d > 0 ? 2 : -0.5), my + 14, 0.5, 1.5);
  }
  c.fillRect(mx + 12, my + 14, 3, 2); // bateria
  c.fillStyle = '#232327';
  c.fillRect(mx + 12.5, my + 14.5, 2, 1);
  c.fillStyle = ink;
  c.fillRect(mx + 19, my + 14, 1, 2); // farol alto
  c.fillRect(mx + 20.5, my + 14, 2, 0.5);
  c.fillRect(mx + 20.5, my + 15, 2, 0.5);
  c.fillRect(mx + 20.5, my + 15.75, 2, 0.5);
  // luzes-espia: duas fileiras de cinco lentes coloridas (apagadas ficam escuras na cor)
  const blink = r.signal !== 0 && blinkOn();
  const stop = r.state === 'ticket' || r.state === 'pullover';
  const leds: [string, string, boolean][][] = [
    [['#1e6a24', '#3cf040', blink], ['#6a1c18', '#ff3020', stop], ['#3e1814', '#ff4020', false], ['#6a1c18', '#ff3020', r.damage > 0.6], ['#1e2e78', '#4a7cff', !!r.def?.night]],
    [['#14401a', '#3cf040', false], ['#6a5a16', '#ffd020', gauges.fuel < 0.68], ['#6a1c18', '#ff3020', gauges.water > 0.8], ['#7a4012', '#ffa030', r.speed < 1 && !r.throttle], ['#3e1814', '#ff4020', false]],
  ];
  rect(c, mx + 2, my + 18, 24, 10, '#08080a');
  leds.forEach((row, j) => row.forEach(([off, on, lit], i) => {
    const lx = mx + 3.5 + i * 4.5, ly = my + 19 + j * 4.5;
    rect(c, lx, ly, 3, 3, lit ? on : off);
    rect(c, lx + 0.5, ly + 0.5, 1, 0.5, lit ? '#ffffff' : 'rgba(255,255,255,0.35)');
  }));
  // faixa de símbolos de baixo: óleo, água, freio
  strip(my + 28.5);
  c.fillStyle = ink;
  c.fillRect(mx + 5, my + 30, 3, 1.5); c.fillRect(mx + 8, my + 30, 1, 0.5); // almotolia
  c.fillRect(mx + 13.5, my + 29.5, 0.5, 2); c.fillRect(mx + 12.5, my + 31.5, 2.5, 0.5); // termômetro
  c.fillRect(mx + 19.5, my + 29.5, 2, 0.5); c.fillRect(mx + 19.5, my + 31.5, 2, 0.5); // freio (O)
  c.fillRect(mx + 19, my + 30, 0.5, 1.5); c.fillRect(mx + 21.5, my + 30, 0.5, 1.5);
  c.fillRect(mx + 20.5, my + 30, 0.5, 1);
  // relógio digital: cristal líquido esverdeado numa moldura, hora de verdade
  rect(c, mx + 3, my + 36, 22, 11, '#3a3a40');
  rect(c, mx + 3.5, my + 36.5, 21, 10, '#141416');
  rect(c, mx + 4.5, my + 37.5, 19, 8, '#a8b48a');
  rect(c, mx + 4.5, my + 37.5, 19, 1, '#bcc69e');
  const now = new Date();
  const hh = now.getHours() % 12 || 12;
  pix(c, `${hh}:${String(now.getMinutes()).padStart(2, '0')}`, mx + 14, my + 42, '#1e2616', 1);
  // parafusos do quadro
  rect(c, mx + 1, my + 49, 1.5, 1.5, '#4a4a50');
  rect(c, mx + 25.5, my + 50, 1.5, 1.5, '#4a4a50');
}
COCKPIT_ART['br-golgti'] = {
  tells: null,
  dash: cp('br-golgti-dash'), top: cp('br-golgti-top'), wheel: cp('br-golgti-wheel'),
  pivot: [128, 99.9], wheelTop: 28, wheelDy: 20, speedMax: 240, needle: '#f4eedc', needleW: 1.5, needleTail: 4, hub: '#1a1a1c', radar: [222, 8],
  speed: { x: 89.5, y: 57.5, r: 28, max: 240, labels: [20, 40, 60, 80, 100, 120, 140, 160, 180, 200, 220, 240], tick: 10, red: 999, a0: Math.PI * 0.75, sweep: Math.PI * 1.5, labelScale: 0.7, ink: GTI_INK, bg: '#121214', cut: 20, boldTicks: true },
  tach: { x: 179.5, y: 57.5, r: 28, max: 7, labels: [1, 2, 3, 4, 5, 6, 7], tick: 0.25, red: 6.5, a0: Math.PI * 0.917, sweep: Math.PI * 1.167, labelScale: 0.7, redLabels: false, ink: GTI_INK, bg: '#121214', cut: 20, redInk: '#ff4a18', redW: 2.5, redHatch: true, boldTicks: true },
  aux: [],
  under: (c, ox) => {
    // face do quadro (cinza quase preto) e a borda de cima, sob a viseira
    rect(c, ox + 58, ART_TOP + 22, 154, 56, '#161618');
    rect(c, ox + 58, ART_TOP + 22, 154, 1, '#08080a');
  },
  extra: (c, ox, r) => golCluster(c, ox, r, COCKPIT_ART['br-golgti']),
};

// Onça GTB: mostradores pretos com números âmbar e ponteiros laranja — velocímetro 20-220 com
// hodômetro e parcial, conta-giros 0-7 (faixa vermelha a partir de 5, do seis-cilindros 4.1),
// combustível no pequeno da esquerda (o da direita, atrás do aro, é o da arte) e, no console (tela larga), pressão
// do óleo, temperatura do óleo, voltímetro e relógio
const GTB_INK = '#ffb43a';
COCKPIT_ART['br-pumagtb'] = {
  dash: cp('br-pumagtb-dash'), top: cp('br-pumagtb-top'), wheel: cp('br-pumagtb-wheel'),
  pivot: [127, 128.3], speedMax: 220, needle: '#ff8c1a', needleW: 1.5, needleTail: 3, hub: '#141416', radar: [206, 4],
  speed: { x: 98, y: 65.5, r: 25.5, max: 220, labels: [20, 60, 100, 140, 180, 220], minor: [40, 80, 120, 160, 200], tick: 10, red: 999, labelScale: 0.7, ink: GTB_INK, bg: '#0c0c0e', boldTicks: true },
  tach: { x: 171.5, y: 65.5, r: 27, max: 7, labels: [0, 1, 2, 3, 4, 5, 6, 7], tick: 0.25, red: 5, labelScale: 0.7, redLabels: false, ink: GTB_INK, bg: '#0c0c0e', redInk: '#e8301a', redW: 2, boldTicks: true },
  aux: [
    { x: 52, y: 75.5, r: 10.5, kind: 'single', show: ['fuel'], icon: 'fuel' },
    { x: 272.5, y: 65.5, r: 16.5, kind: 'single', show: ['oil'], icon: 'oil', labels: ['0', '5', '10'] },
    { x: 322.5, y: 65.5, r: 16.5, kind: 'single', show: ['oiltemp'], icon: 'temp', labels: ['50', '100', '150'] },
    { x: 373, y: 65.5, r: 16.5, kind: 'single', show: ['volt'], icon: 'volt', labels: ['8', '12', '16'] },
    { x: 422, y: 65.5, r: 16.5, kind: 'clock' },
  ],
  extra: (c, ox, r) => {
    odometer(c, ox, r, { x: 92, y: 57.5, w: 12, h: 3.5 }, 228, 6, 0.5);
    odometer(c, ox, r, { x: 94, y: 70.5, w: 8, h: 3.5 }, 21.0, 4, 0.5, true);
  },
};

// Onça GTE: quadro como o do carro de verdade (VDO) — conta-giros 0-6 (× 1000 rpm, faixa
// vermelha no fim) e velocímetro 20-200 lado a lado, fundo preto, números e ponteiros brancos,
// aros cromados, hodômetro e parcial; luz do óleo no conta-giros, seta e farol alto no
// velocímetro; no painel, combustível (R-C), pressão do óleo, temperatura do óleo e voltímetro
COCKPIT_ART['br-pumagte'] = {
  tells: null,
  glass: { at: [20, 105] },
  dash: cp('br-pumagte-dash'), top: cp('br-pumagte-top'), wheel: cp('br-pumagte-wheel'),
  dashMask: cp('br-pumagte-dash-mask'), topMask: cp('br-pumagte-top-mask'),
  pivot: [127.9, 113], speedMax: 200, needle: '#f2f2ee', needleW: 1.5, needleTail: 3, hub: '#1a1a1c', radar: [206, 4],
  tach: { x: 95.5, y: 61, r: 26.5, max: 6, labels: [1, 2, 3, 4, 5, 6], tick: 0.25, red: 5.2, a0: Math.PI * 0.833, sweep: Math.PI * 1.5, labelScale: 0.7, redLabels: false, bg: '#0a0a0b', redInk: '#d82418', redW: 1.5, boldTicks: true },
  speed: { x: 171.5, y: 61, r: 26.5, max: 200, labels: [20, 60, 100, 140, 180], minor: [40, 80, 120, 160, 200], tick: 10, red: 999, a0: Math.PI * 0.833, sweep: Math.PI * 1.667, labelScale: 0.7, bg: '#0a0a0b', boldTicks: true },
  aux: [
    { x: 234.5, y: 55, r: 14.5, kind: 'single', show: ['fuel'], icon: 'fuel', labels: ['R', 'C'] },
    { x: 269.5, y: 55, r: 14.5, kind: 'single', show: ['oil'], icon: 'oil', labels: ['0', '5'] },
    { x: 305, y: 55, r: 14.5, kind: 'single', show: ['oiltemp'], icon: 'temp', labels: ['40', '120'] },
    { x: 341, y: 55, r: 14.5, kind: 'single', show: ['volt'], icon: 'volt', labels: ['10', '16'] },
  ],
  under: (c, ox) => {
    // aros cromados dos dois mostradores grandes (por linhas, sem antialias)
    for (const x of [95.5, 171.5]) {
      for (const [rr, col] of [[30, '#3a3c40'], [29, '#c8ccd2'], [28, '#8a8e94']] as [number, string][]) {
        c.fillStyle = col;
        const cx = ox + x, cy = ART_TOP + 61, ry = rr * PIX_Y;
        for (let dy = -Math.floor(ry); dy <= Math.floor(ry); dy++) {
          const hw = Math.round(rr * Math.sqrt(Math.max(0, 1 - (dy / ry) ** 2)));
          c.fillRect(Math.floor(cx) - hw, Math.floor(cy) + dy, hw * 2 + 1, 1);
        }
      }
    }
  },
  extra: (c, ox, r) => {
    const T = ART_TOP;
    // conta-giros: "x1000 RPM", luz do óleo (acende parado, sem acelerar) e da bateria
    pix(c, 'x1000', ox + 95.5, T + 70, '#c8c8c8', 0.5);
    const oilLow = r.speed < 1 && !r.throttle;
    rect(c, ox + 95, T + 76, 2, 2, oilLow ? '#ff3020' : '#4a0e0c');
    rect(c, ox + 83, T + 66, 3, 2, '#3a3a3e');
    // velocímetro: hodômetro, parcial, km/h e as luzes da seta (verde) e do farol alto (azul)
    odometer(c, ox, r, { x: 164.5, y: 51.5, w: 14, h: 3.5 }, 16380, 6, 0.5);
    odometer(c, ox, r, { x: 166.5, y: 66.5, w: 10, h: 3.5 }, 281.7, 4, 0.5, true);
    pix(c, 'km/h', ox + 171.5, T + 73, '#c8c8c8', 0.5);
    const blink = r.signal !== 0 && blinkOn();
    rect(c, ox + 168, T + 77, 2, 2, blink ? '#3cf040' : '#103a14');
    rect(c, ox + 173, T + 77, 2, 2, r.def?.night ? '#4a7cff' : '#0e1a40');
  },
};

// Cadete GSi: quadro digital "LCD Electronics" como o de verdade — à esquerda quatro barras em
// cunha (pressão do óleo, bateria, temperatura da água, combustível) com os ícones vermelhos;
// no meio a velocidade em três dígitos grandes, hodômetro e parcial; à direita o conta-giros
// em arco segmentado (×100 rpm, 5 a 70). No console, a régua de luzes de aviso e o relógio.
const KAD = { on: '#ffb428', off: '#2a1c08', red: '#ff3a20', redOff: '#3a1008', icon: '#e8402a', dim: '#ffcf70' };
function kadettCluster(c: CanvasRenderingContext2D, ox: number, r: Race) {
  const T = ART_TOP;
  const kmh = r.speed * KMH;
  const rpm = clamp(r.rpm, 0, 1);
  // barras em cunha: cada segmento um pouco mais alto que o anterior
  const bars: [number, boolean][] = [[gauges.oil, false], [gauges.volt, false], [gauges.water, gauges.water > 0.8], [gauges.fuel, gauges.fuel < 0.68]];
  bars.forEach(([v, warn], i) => {
    const y = T + 44 + i * 8.5 + (i >= 2 ? 2.5 : 0); // espaço para a escala da bateria
    rect(c, ox + 71, y + 1.5, 2.5, 2.5, warn ? '#ff6040' : KAD.icon);
    const n = 16;
    for (let k = 0; k < n; k++) {
      const h = 1.5 + (k / (n - 1)) * 3.5;
      rect(c, ox + 76 + k * 1.5, y + 5 - h, 1, h, k < Math.round(clamp(v, 0, 1) * n) ? (warn && k < 4 ? KAD.red : KAD.on) : KAD.off);
    }
  });
  pix(c, '9', ox + 82, T + 60, KAD.dim, 0.5); // escala da bateria (9 12 15)
  pix(c, '12', ox + 89, T + 60, KAD.dim, 0.5);
  pix(c, '15', ox + 97, T + 60, KAD.dim, 0.5);
  // velocidade: três dígitos de 7 segmentos
  rect(c, ox + 104, T + 43, 47, 37, '#0d0b08');
  seg7Number(c, ox + 143, T + 47, kmh, 3, KAD.on, KAD.off);
  pix(c, 'km/h', ox + 147, T + 57, KAD.dim, 0.5);
  pix(c, 'LCD', ox + 127, T + 64, '#8a6a2a', 0.5);
  // hodômetro e parcial em dígitos pequenos (o último da parcial gira de verdade)
  const km = Math.max(0, ((r.playerZ - r.track.startZ) * KMH) / 3600);
  pix(c, String(Math.floor(805 + km)).padStart(6, '0'), ox + 116, T + 72, KAD.on, 0.5);
  pix(c, ((14.5 + km) % 1000).toFixed(1), ox + 140, T + 72, KAD.on, 0.5);
  // conta-giros em arco (centro embaixo à direita, do 5 à esquerda ao 70 em cima)
  const arc = { x: 191, y: 80, r0: 22, r1: 28, a0: Math.PI, a1: Math.PI * 1.5, n: 24 };
  drawArc(c, ox, arc, 0.04 + rpm * 0.86, (f) => (f < 0.86 ? [KAD.on, KAD.off] : [KAD.red, KAD.redOff]));
  for (const v of [5, 10, 20, 30, 40, 50, 60, 70]) {
    const a = arc.a0 + ((arc.a1 - arc.a0) * v) / 70;
    pix(c, String(v), ox + arc.x + 0.5 + Math.cos(a) * 32, T + arc.y + Math.sin(a) * 31.5 * PIX_Y, KAD.dim, 0.5);
  }
  pix(c, 'x100', ox + 185, T + 76, KAD.dim, 0.5);
  // régua de luzes do console (tela larga): ícones âmbar apagados; acendem quando faz sentido
  const warn = [r.damage > 0.6, gauges.fuel < 0.68, false, r.speed < 1 && !r.throttle, r.state === 'ticket', gauges.water > 0.8, false];
  warn.forEach((on, i) => {
    const x = ox + 261.5 + i * 6.8;
    rect(c, x, T + 44, 5, 5, on ? (i === 4 || i === 0 ? '#ff3a20' : '#ffb428') : '#4a3410');
    rect(c, x + 1, T + 45, 1, 1, on ? '#fff0c0' : '#5e4618');
  });
  // relógio digital do console
  const now = new Date();
  pix(c, `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`, ox + 285.5, T + 87, '#c8e0a0', 1);
}
COCKPIT_ART['br-kadett'] = {
  tells: [113, 65.5],
  dash: cp('br-kadett-dash'), top: cp('br-kadett-top'), wheel: cp('br-kadett-wheel'),
  pivot: [127.9, 105.7], speedMax: 220, needle: '#ffb428', hub: '#202022', radar: [206, 4], aux: [],
  extra: (c, ox, r) => kadettCluster(c, ox, r),
};

// Unão Turbo: quadro Veglia Borletti como o do carro — velocímetro 0-240 com hodômetro e parcial,
// conta-giros 0-80 (× 100 rpm, "electronic") com faixa amarela e vermelha, manômetro do turbo
// (0-1 bar) em cima no meio, óleo duplo (temperatura e pressão) embaixo, combustível à
// esquerda e água à direita; ponteiros vermelhos
const VEGLIA_INK = '#ececec';
COCKPIT_ART['br-uno'] = {
  dash: cp('br-uno-dash'), top: cp('br-uno-top'), wheel: cp('br-uno-wheel'),
  pivot: [129, 104.2], speedMax: 240, needle: '#ff3a1a', needleW: 1.5, needleTail: 3, hub: '#141416', radar: [206, 4],
  glass: { at: [25, 106] },
  tells: [112, 77.5],
  speed: { x: 101, y: 57, r: 17.5, max: 240, labels: [0, 40, 80, 120, 160, 200, 240], tick: 10, red: 999, a0: Math.PI * 0.75, sweep: Math.PI * 1.5, labelScale: 0.7, ink: VEGLIA_INK, bg: '#121416' },
  tach: { x: 159.5, y: 57, r: 17.5, max: 8, labels: [0, 1, 2, 3, 4, 5, 6, 7, 8], labelMul: 10, tick: 0.25, yellow: 5.8, red: 6.2, a0: Math.PI * 0.75, sweep: Math.PI * 1.5, labelScale: 0.7, redLabels: false, ink: VEGLIA_INK, bg: '#121416' },
  aux: [
    { x: 130.3, y: 44.2, r: 9.5, kind: 'single', show: ['boost'], icon: 'turbo', labels: ['0', '0,5', '1'] },
    { x: 130.3, y: 67.8, r: 8.8, kind: 'twin', show: ['oiltemp', 'oil'], icon: 'oil' },
    { x: 73.5, y: 65.9, r: 8.4, kind: 'single', show: ['fuel'], icon: 'fuel', labels: ['0', '1/2', '1'] },
    { x: 187.9, y: 65.9, r: 8.4, kind: 'single', show: ['water'], icon: 'temp', labels: ['60', '100', '140'] },
  ],
  extra: (c, ox, r) => {
    odometer(c, ox, r, { x: 95, y: 50.5, w: 12, h: 3.5 }, 40230, 6, 0.5);
    odometer(c, ox, r, { x: 97, y: 62, w: 8, h: 3.5 }, 142.5, 4, 0.5, true);
  },
};

// Corsário GSi: conta-giros 0-7 e velocímetro 20-220 grandes, combustível e água pequenos nas
// pontas; no alto do console o visor laranja com a hora, a temperatura e a data de verdade
COCKPIT_ART['br-corsa'] = {
  dash: cp('br-corsa-dash'), top: cp('br-corsa-top'), wheel: cp('br-corsa-wheel'),
  pivot: [127.9, 104.1], speedMax: 220, needle: '#f2f2f2', needleW: 1.5, needleTail: 3, hub: '#161618', radar: [206, 4],
  glass: { at: [20, 106] },
  tach: { x: 113.6, y: 59.9, r: 18.5, max: 7, labels: [0, 1, 2, 3, 4, 5, 6, 7], tick: 0.5, boldTicks: true, red: 6.2, a0: Math.PI * 0.75, sweep: Math.PI * 1.5, labelScale: 0.7, redLabels: false, redW: 1.5, bg: '#0e0f11' },
  speed: { x: 155.5, y: 59.9, r: 18.5, max: 220, labels: [20, 60, 100, 140, 180, 220], tick: 10, boldTicks: true, red: 999, a0: Math.PI * 0.75, sweep: Math.PI * 1.5, labelScale: 0.7, bg: '#0e0f11' },
  aux: [
    { x: 84.2, y: 75.7, r: 9, kind: 'single', show: ['fuel'], icon: 'fuel', labels: ['0', '1/2', '1'] },
    { x: 184, y: 75.7, r: 9, kind: 'single', show: ['water'], icon: 'temp', labels: ['50', '90', '130'] },
  ],
  extra: (c, ox, r) => {
    odometer(c, ox, r, { x: 149.5, y: 64.5, w: 12, h: 3.5 }, 7908, 6, 0.5);
    // visor do console: hora e temperatura em cima, data embaixo (laranja, como o do carro)
    const now = new Date();
    const p2 = (n: number) => String(n).padStart(2, '0');
    const T = ART_TOP;
    pix(c, `${p2(now.getHours())}:${p2(now.getMinutes())} 25°`, ox + 277.8, T + 39, '#ff8a20', 1);
    pix(c, `${p2(now.getDate())}.${p2(now.getMonth() + 1)}.${p2(now.getFullYear() % 100)}`, ox + 277.8, T + 46, '#ff8a20', 1);
    void r;
  },
};

// Corvette C4: arte do Victor com os visores de LCD redesenhados funcionando
COCKPIT_ART.zr1 = {
  tells: null,
  dash: cp('zr1-dash'), top: cp('zr1-top'), wheel: cp('zr1-wheel'),
  pivot: [128, 86], speedMax: 240, needle: '#ff3a1a', hub: '#26262a', aux: [], radar: [206, 4],
  under: (c, ox) => {
    // caixa do quadro: a arte tinha os três visores espalhados (o conta-giros fora do volante);
    // fica a moldura cinza-escura lisa e o jogo desenha o quadro dentro do volante
    rect(c, ox + 63, ART_TOP + 26, 129, 55, '#26282a');
    rect(c, ox + 63, ART_TOP + 26, 129, 1, '#3c3e42');
    rect(c, ox + 63, ART_TOP + 80, 129, 1, '#141516');
  },
  extra: (c, ox, r) => c4Cluster(c, ox, r),
};

// Quadro digital do C4 como o de verdade, todo dentro da abertura do volante: à esquerda o
// velocímetro (barra verde que sobe e curva para a direita, escala âmbar 0-240, velocidade em
// dígitos), no meio o centro de informações (pressão do óleo, barra do combustível,
// temperatura da água, parcial e consumo) com os três botões quadrados embaixo (setas verdes
// acendem com o pisca) e à direita o conta-giros (barra verde que termina em amarelo e
// vermelho, giro ×100 em dígitos e a seta de "troque de marcha")
const C4 = { green: '#44d84c', greenOff: '#0f2a12', yellow: '#e8e030', yellowOff: '#2a2a0c', red: '#ff3a24', redOff: '#2e0e0a', amber: '#ffb020', amberOff: '#3a2608', face: '#0a0c0b', frame: '#4a4c4e' };
const SEG_S: Record<string, [number, number, number, number]> = { // 4,5 x 8 px
  a: [1, 0, 2.5, 1], b: [3.5, 0.5, 1, 3], c: [3.5, 4.5, 1, 3], d: [1, 7, 2.5, 1], e: [0, 4.5, 1, 3], f: [0, 0.5, 1, 3], g: [1, 3.5, 2.5, 1],
};
const SEG_XS: Record<string, [number, number, number, number]> = { // 3,5 x 6,5 px, traços de 1 px (nítidos na grade de meio pixel)
  a: [1, 0, 1.5, 1], b: [2.5, 0.5, 1, 2.5], c: [2.5, 3.5, 1, 2.5], d: [1, 5.5, 1.5, 1], e: [0, 3.5, 1, 2.5], f: [0, 0.5, 1, 2.5], g: [1, 2.75, 1.5, 1],
};
function segSmall(c: CanvasRenderingContext2D, xr: number, y: number, v: number, digits: number, on: string, off: string, xs = false) {
  // dígitos de 7 segmentos menores
  const parts = xs ? SEG_XS : SEG_S;
  const pitch = xs ? 4.5 : 5.5;
  const s = String(Math.max(0, Math.round(v)));
  for (let i = 0; i < digits; i++) {
    const ch = s[s.length - 1 - i];
    const lit = ch === undefined ? '' : SEG7[Number(ch)];
    const x = xr - (i + 1) * pitch + 0.5;
    for (const [k, [dx, dy, w, h]] of Object.entries(parts)) {
      c.fillStyle = lit.includes(k) ? on : off;
      c.fillRect(x + dx, y + dy, w, h);
    }
  }
}
function c4Panel(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  rect(c, x - 1, y - 1, w + 2, h + 2, C4.frame);
  rect(c, x - 1, y - 1, w + 2, 0.5, '#6a6c70');
  rect(c, x, y, w, h, C4.face);
}
function c4Cluster(c: CanvasRenderingContext2D, ox: number, r: Race) {
  const T = ART_TOP;
  const kmh = r.speed * KMH;
  const rpm = clamp(r.rpm, 0, 1);
  // ---- velocímetro ----
  const clip = (x: number, y: number, w: number, h: number, f: () => void) => {
    c.save(); c.beginPath(); c.rect(x, y, w, h); c.clip(); f(); c.restore();
  };
  c4Panel(c, ox + 72, T + 42, 35, 37);
  clip(ox + 72, T + 42, 35, 37, () => {
    const sp = { x: 124, y: 80, r0: 39, r1: 43, a0: Math.PI, a1: Math.PI * 1.25, n: 24 }; // raio grande: a barra sobe quase reta à esquerda e os dígitos ficam livres à direita
    drawArc(c, ox, sp, kmh / 240, () => [C4.green, C4.greenOff]);
    for (let v = 0; v <= 240; v += 40) {
      const a = sp.a0 + ((sp.a1 - sp.a0) * v) / 240;
      pix(c, String(v), ox + sp.x + 0.5 + Math.cos(a) * 46.5 - 2, T + sp.y + Math.sin(a) * 44.5 * PIX_Y + 1, C4.amber, 0.5);
    }
    segSmall(c, ox + 105.5, T + 63, kmh, 3, C4.amber, C4.amberOff);
    pix(c, 'km/h', ox + 99, T + 74.5, C4.amber, 0.5);
  });
  // ---- centro de informações ----
  c4Panel(c, ox + 107, T + 36, 42, 22);
  const oilP = 20 + gauges.oil * 60, coolant = 80 + gauges.water * 40;
  const box = (x: number, y: number) => { // moldura âmbar dos visores do óleo e da água
    rect(c, x, y, 15, 0.5, C4.amber); rect(c, x, y + 8.5, 15, 0.5, C4.amber);
    rect(c, x, y, 0.5, 9, C4.amber); rect(c, x + 14.5, y, 0.5, 9, C4.amber);
  };
  box(ox + 108, T + 37);
  rect(c, ox + 109.5, T + 39, 1.5, 5, gauges.oil < 0.36 ? C4.red : C4.redOff);
  segSmall(c, ox + 122.5, T + 38.5, oilP, 2, C4.amber, C4.amberOff, true);
  box(ox + 133, T + 37);
  rect(c, ox + 134.5, T + 39, 1.5, 5, gauges.water > 0.8 ? C4.red : C4.redOff);
  segSmall(c, ox + 147.5, T + 38.5, coolant, 3, C4.amber, C4.amberOff, true);
  // combustível: barra vertical verde, esvazia de cima para baixo
  rect(c, ox + 124, T + 37, 8, 18, C4.greenOff);
  const fh = 18 * clamp(gauges.fuel, 0, 1);
  rect(c, ox + 124, T + 37 + 18 - fh, 8, fh, gauges.fuel < 0.68 ? C4.yellow : C4.green);
  for (let k = 1; k < 6; k++) rect(c, ox + 132.5, T + 37 + k * 3, 1, 0.5, C4.amber);
  // parcial (km) e consumo
  const km = Math.max(0, ((r.playerZ - r.track.startZ) * KMH) / 3600);
  segSmall(c, ox + 122.5, T + 49, (46.9 + km) * 10 % 1000, 3, C4.amber, C4.amberOff, true);
  rect(c, ox + 118, T + 55, 0.5, 0.5, C4.amber); // vírgula da parcial
  const inst = r.throttle ? 4 + (1 - rpm) * 6 : 19;
  segSmall(c, ox + 147.5, T + 49, inst, 2, C4.amber, C4.amberOff, true);
  // três botões quadrados (as setas do pisca nos dois de fora)
  const blink = r.signal !== 0 && blinkOn();
  [[112, -1], [124, 0], [136, 1]].forEach(([x, dir]) => {
    rect(c, ox + x, T + 61, 8, 7, '#18191a');
    rect(c, ox + x, T + 61, 8, 0.5, '#5a5c60');
    if (dir) {
      const lit = blink && Math.sign(r.signal) === dir;
      c.fillStyle = lit ? C4.green : '#1c3a1e';
      for (let k = 0; k < 3; k++) c.fillRect(ox + x + (dir < 0 ? 2 + k : 5 - k), T + 63.5 - k * 0.5, 1, 1 + k);
    }
  });
  // ---- conta-giros ----
  c4Panel(c, ox + 150, T + 42, 35, 37);
  clip(ox + 150, T + 42, 35, 37, () => {
    const tc = { x: 186, y: 79, r0: 23, r1: 28, a0: Math.PI, a1: Math.PI * 1.46, n: 24 };
    drawArc(c, ox, tc, 0.04 + rpm * 0.9, (f) => (f < 0.78 ? [C4.green, C4.greenOff] : f < 0.88 ? [C4.yellow, C4.yellowOff] : [C4.red, C4.redOff]));
    for (const v of [0, 10, 20, 30, 40, 50, 60]) {
      const a = tc.a0 + ((tc.a1 - tc.a0) * v) / 60;
      pix(c, String(v), ox + tc.x + 0.5 + Math.cos(a) * 32, T + tc.y + Math.sin(a) * 31 * PIX_Y, C4.amber, 0.5);
    }
    segSmall(c, ox + 183.5, T + 63, rpm * 60, 2, C4.amber, C4.amberOff);
    pix(c, 'x100', ox + 177, T + 74.5, C4.amber, 0.5);
  });
  // seta de troca de marcha (acende perto do corte)
  const up = rpm > 0.9 && r.throttle;
  c.fillStyle = up ? C4.amber : C4.amberOff;
  for (let k = 0; k < 4; k++) c.fillRect(ox + 179 - k * 0.5, T + 45 + k, 1 + k, 1);
  c.fillRect(ox + 178.5, T + 49, 2, 3);
}

for (const [k, v] of Object.entries(INTERIORS)) {
  const dials = v.dials as Dial[];
  COCKPIT_ART[k] = {
    dash: cp(`${k}-dash`), top: cp(`${k}-top`), wheel: cp(`${k}-wheel`),
    dashMask: cp(`${k}-dash-mask`), topMask: cp(`${k}-top-mask`),
    pivot: v.pivot as [number, number],
    tach: dials.find((d) => d.max <= 10)!, speed: dials.find((d) => d.max > 10)!,
    speedMax: v.speedMax, needle: '#ff3a1a', hub: '#26262a', aux: v.aux as Aux[],
    tells: k === 'testarossa' ? [128, 43] : undefined, // entre os dois auxiliares do meio
  };
}

// Imagens das cabines: decodificadas só quando o carro é escolhido (não todas na abertura)
const artImages = (a: CockpitArt) => [a.dash, a.top, a.wheel, a.dashMask, a.topMask, a.mirror?.img].filter((s): s is string => !!s);
export const hasCockpitArt = (dash: string) => !!COCKPIT_ART[dash];
export function preloadCockpit(dash: string) {
  const a = COCKPIT_ART[dash];
  if (a) preloadSvg(...artImages(a));
}

// "Foto" do interior para a revista: teto, painel e volante da arte, com uma estrada clara no
// para-brisa (guardada por carro e cor)
const interiorCache = new Map<string, HTMLCanvasElement>();
export function interiorPhoto(carId: string, dash: string): HTMLCanvasElement | null {
  const art = COCKPIT_ART[dash];
  if (!art) return null;
  const color = paintHex(carId);
  const key = `${carId}:${color ?? ''}`;
  const hit = interiorCache.get(key);
  if (hit) return hit;
  const tint = (mask?: string) => (color && mask ? { mask, color } : undefined);
  const d = svgSprite(art.dash, DASH_W, 124, tint(art.dashMask));
  const t = svgSprite(art.top, DASH_W, TOP_EXT, tint(art.topMask));
  const wh = Math.round(CORE_W * (spriteAspect(art.wheel) ?? 124 / CORE_W));
  const w = svgSprite(art.wheel, CORE_W, wh);
  if (!d || !t || !w) return null;
  const cv = document.createElement('canvas');
  cv.width = DASH_W;
  cv.height = TOP_EXT + 124;
  const g = cv.getContext('2d')!;
  g.imageSmoothingEnabled = false;
  const sky = g.createLinearGradient(0, 0, 0, TOP_EXT + 30);
  sky.addColorStop(0, '#5a9ae8');
  sky.addColorStop(1, '#d8e8f6');
  g.fillStyle = sky;
  g.fillRect(0, 0, DASH_W, TOP_EXT + 40);
  g.fillStyle = '#2e8a2a';
  g.fillRect(0, TOP_EXT + 20, DASH_W, 104);
  g.fillStyle = '#3a3a3e';
  g.beginPath();
  g.moveTo(DASH_W / 2 - 6, TOP_EXT + 20);
  g.lineTo(DASH_W / 2 + 6, TOP_EXT + 20);
  g.lineTo(DASH_W / 2 + 220, TOP_EXT + 124);
  g.lineTo(DASH_W / 2 - 220, TOP_EXT + 124);
  g.fill();
  g.drawImage(t, 0, 0);
  g.drawImage(d, 0, TOP_EXT);
  // instrumentos acesos como num passeio a 110 km/h: ponteiros, auxiliares e os visores
  // digitais (Vortex), que na arte são só o fundo apagado
  const fake = { speed: 110 / KMH, rpm: 0.42, time: 30, state: 'drive', playerZ: 0, track: { startZ: 0 }, auto: true, gear: 4, radar: 0, signal: 0, car: { id: carId } } as unknown as Race;
  const saved = ART_TOP;
  ART_TOP = TOP_EXT;
  try {
    const ox = DASH_PAD;
    if (art.lcd) lcdPanel(g, ox, fake, art);
    if (art.odo) odometer(g, ox, fake, art.odo);
    if (art.prnd) leverIndicator(g, ox, fake, art.prnd);
    art.under?.(g, ox, fake);
    if (art.tach) artDial(g, art.tach, ox, 0.06 + 0.42 * 0.82, art);
    if (art.speed) artDial(g, art.speed, ox, 110 / art.speedMax, art);
    for (const a of art.aux) auxDial(g, a, ox, art);
    if (art.extra) {
      art.extra(g, ox, fake);
      if (art.tach) dialNeedle(g, art.tach, ox, 0.06 + 0.42 * 0.82, art);
      if (art.speed) dialNeedle(g, art.speed, ox, 110 / art.speedMax, art);
    }
  } finally {
    ART_TOP = saved;
  }
  g.drawImage(w, DASH_PAD + (art.wheelDx ?? 0), TOP_EXT - (art.wheelTop ?? 0) + (art.wheelDy ?? 0));
  interiorCache.set(key, cv);
  return cv;
}

// Cabine a partir da arte: painel, ponteiros dinâmicos, radar e volante girando.
function drawCockpitArt(c: CanvasRenderingContext2D, r: Race, dt: number, art: CockpitArt): boolean {
  const { w } = view;
  const ox = coreX();
  const color = paintHex(r.car.id);
  const tint = (mask?: string) => (color && mask ? { mask, color } : undefined);
  const dash = svgSprite(art.dash, DASH_W, 124, tint(art.dashMask));
  // o volante pode ter mais linhas que o painel (inteiro, para girar sem mostrar corte)
  const wheelH = Math.round(CORE_W * (spriteAspect(art.wheel) ?? 124 / CORE_W));
  const wheelImg = svgSprite(art.wheel, CORE_W, wheelH);
  if (!dash || !wheelImg) return false;
  // o painel tem DASH_PAD colunas a mais de cada lado; só além disso a borda é esticada
  const dx = ox - DASH_PAD;
  if (dx > 0) {
    c.drawImage(dash, 0, 0, 2, 124, 0, ART_TOP, dx, 124);
    c.drawImage(dash, DASH_W - 2, 0, 2, 124, dx + DASH_W, ART_TOP, w - dx - DASH_W, 124);
  }
  c.drawImage(dash, dx, ART_TOP);
  const top = svgSprite(art.top, DASH_W, TOP_EXT, tint(art.topMask));
  if (top) {
    if (dx > 0) c.drawImage(top, 0, 0, 2, TOP_EXT, 0, ART_TOP - TOP_EXT, dx, TOP_EXT);
    c.drawImage(top, dx, ART_TOP - TOP_EXT);
    // cabine rebaixada: a primeira linha do topo (colunas) sobe até o teto, sem vão
    const gap = ART_TOP - TOP_EXT - ROOF_H;
    if (gap > 0) c.drawImage(top, 0, 0, DASH_W, 1, dx, ROOF_H, DASH_W, gap + 1);
  }
  // retrovisor externo esquerdo funcionando (onde a arte mostra o vidro dele)
  if (art.mirror) {
    const m = art.mirror;
    const mw = 37; // largura do sprite (pixels nativos)
    const spr = svgSprite(m.img, mw, Math.round(mw * (spriteAspect(m.img) ?? 1)));
    if (spr) {
      const mx = dx + m.x, my = ART_TOP - TOP_EXT + m.y;
      c.drawImage(spr, mx, my);
      const mg = findGlass(m.img, null, spr, spr.width);
      if (mg) drawSideMirror(c, r, mg, mx, my, color ?? r.car.color);
    }
  } else {
    const glass = findGlass(art.dash, svgSprite(art.top, DASH_W, TOP_EXT), svgSprite(art.dash, DASH_W, 124) ?? dash, DASH_PAD + 90, art.glass);
    if (glass) drawSideMirror(c, r, glass, dx, ART_TOP, color ?? r.car.color);
  }
  if (art.lcd) lcdPanel(c, ox, r, art);
  if (art.odo) odometer(c, ox, r, art.odo);
  if (art.prnd) leverIndicator(c, ox, r, art.prnd);
  art.under?.(c, ox, r);
  if (art.tach) artDial(c, art.tach, ox, 0.06 + Math.min(1, r.rpm) * 0.82, art);
  if (art.speed) artDial(c, art.speed, ox, (r.speed * KMH) / art.speedMax, art);
  updateGauges(r, dt);
  for (const g of art.aux) auxDial(c, g, ox, art);
  if (art.extra) {
    art.extra(c, ox, r);
    // hodômetros e submostradores ficam no fundo do mostrador: o ponteiro passa por cima
    if (art.tach) dialNeedle(c, art.tach, ox, 0.06 + Math.min(1, r.rpm) * 0.82, art);
    if (art.speed) dialNeedle(c, art.speed, ox, (r.speed * KMH) / art.speedMax, art);
  }
  // detector de radar (com as luzes do pisca dos lados); cada cabine pode pô-lo num lugar livre
  const [rx, ry] = art.radar ?? [206, 22];
  rect(c, ox + rx, ART_TOP + ry, 30, 6, '#0c0c0e');
  radarLeds(c, ox + rx + 2, ART_TOP + ry + 1, 26, r.radar);
  // luz verde da seta no quadro (as cabines com luz-espia própria desenham a delas)
  if (art.tells !== null) {
    const t = art.tells ?? defaultTells(art);
    if (t) turnTells(c, ox + t[0], ART_TOP + t[1], r.signal);
  }
  const wdx = art.wheelDx ?? 0;
  const wdy = art.wheelDy ?? 0;
  const px = ox + wdx + art.pivot[0], py = ART_TOP + art.pivot[1] + wdy;
  withRotation(c, px, py, steerAngle(r, dt), () => c.drawImage(wheelImg, ox + wdx, ART_TOP - (art.wheelTop ?? 0) + wdy));
  return true;
}

interface Box { x: number; y: number; w: number; h: number }

// hodômetro: quilometragem do carro + o que já andou neste trecho
const ODO_BASE = 62487;
function odometer(c: CanvasRenderingContext2D, ox: number, r: Race, b: Box, base = ODO_BASE, digits = 6, scale = 1, lastRed = false) {
  const km = Math.max(0, ((r.playerZ - r.track.startZ) * KMH) / 3600);
  // parcial (trip) com décimos: o último tambor gira de verdade
  const n = digits === 6 ? Math.floor(base + km) : Math.floor((base + km) * 10);
  const v = String(n % 10 ** digits).padStart(digits, '0');
  // cada dígito numa janelinha, como os tambores de um hodômetro mecânico
  const cw = b.w / digits;
  const pad = scale < 1 ? 0.5 : 2;
  for (let i = 0; i < digits; i++) {
    const x = ox + b.x + i * cw;
    const red = lastRed && i === digits - 1;
    rect(c, x + (scale < 1 ? 0 : 0.5), ART_TOP + b.y + pad, cw - (scale < 1 ? 0 : 0.5), b.h - pad * 2, red ? '#7a1010' : '#0c0c0e');
    pix(c, v[i], x + cw / 2 + (scale < 1 ? 0 : 0.25), ART_TOP + b.y + b.h / 2, '#d8dcd8', scale);
  }
}

// alavanca no volante: D no automático; no manual, 1 e 2 nas marchas baixas; P parado na multa
function leverIndicator(c: CanvasRenderingContext2D, ox: number, r: Race, b: Box) {
  const sel = r.state === 'ticket' || r.state === 'pullover' && r.speed < 1 ? 'P' : !r.auto && r.gear < 2 ? String(r.gear + 1) : 'D';
  const keys = ['P', 'R', 'N', 'D', '2', '1'];
  const cw = b.w / keys.length;
  keys.forEach((k, i) => {
    const x = ox + b.x + i * cw, y = ART_TOP + b.y + 0.5;
    if (k === sel) rect(c, x, y, cw, b.h - 1, '#d81818');
    pix(c, k, x + cw / 2, y + (b.h - 1) / 2, k === sel ? '#fff' : '#8a8a90', 1);
  });
}

// pixel nítido em (x, y) arredondado
const PIX_Y = 8 / 7; // o pixel é mais largo que alto: no eixo vertical tudo é 8/7 maior

function artDial(c: CanvasRenderingContext2D, d: Dial, ox: number, frac: number, art: CockpitArt) {
  const cx = ox + d.x, cy = ART_TOP + d.y, r = d.r, ry = r * PIX_Y;
  const a0 = d.a0 ?? Math.PI * 0.75, sweep = d.sweep ?? Math.PI * 1.5;
  if (d.face === false) return needle(c, cx, cy, r, a0 + sweep * Math.max(0, Math.min(1.02, frac)), art);
  // fundo preto (por linhas, sem antialias), por cima do mostrador da arte; cut: o mostrador
  // da arte é cortado embaixo pela borda do painel, o fundo para ali
  // linhas com meio pixel de sobra para cima e para baixo: com o centro entre dois pixels, as
  // bordas das linhas saem meio transparentes e a arte de baixo aparecia em riscos finos
  c.fillStyle = d.bg ?? '#050506';
  for (let dy = -Math.floor(ry); dy <= Math.min(Math.floor(ry), d.cut ?? 99); dy++) {
    const hw = Math.round(r * Math.sqrt(Math.max(0, 1 - (dy / ry) ** 2)));
    c.fillRect(cx - hw, cy + dy - 0.5, hw * 2 + 1, 2);
  }
  // cut: marcações e números também param na borda do painel
  c.save();
  if (d.cut !== undefined) {
    c.beginPath();
    c.rect(cx - r - 8, cy - ry - 8, r * 2 + 17, ry + 8 + d.cut + 1);
    c.clip();
  }
  const at = (a: number, rr: number): [number, number] => [cx + 0.5 + Math.cos(a) * rr, cy + 0.5 + Math.sin(a) * rr * PIX_Y];
  const fr = (v: number) => a0 + (sweep * v) / d.max;
  const half = (x: number, y: number) => c.fillRect(Math.round(x * 2) / 2, Math.round(y * 2) / 2, 0.5, 0.5);
  // faixa amarela (aviso) e vermelha
  if (d.yellow !== undefined) {
    c.fillStyle = '#f0c818';
    for (let a = fr(d.yellow); a <= fr(d.red) + 0.001; a += 0.02)
      for (const k of [0.75, 1.25, 1.75, 2.25]) half(...at(a, r - k));
  }
  if (d.red < d.max) {
    c.fillStyle = d.redInk ?? '#d81818';
    const ks = [];
    for (let k = 0.75; k <= (d.redW ?? 2) + 0.25 + 1e-6; k += 0.5) ks.push(k);
    for (let a = fr(d.red), i = 0; a <= a0 + sweep + 0.001; a += 0.02, i++)
      if (!d.redHatch || Math.floor((a - fr(d.red)) * r / 1.1) % 2 === 0) for (const k of ks) half(...at(a, r - k));
  }
  // marcações: traço de 1,5 px nos números, meio pixel no meio (resolução interna 2x)
  for (let v = 0; v <= d.max + 1e-6; v += d.tick) {
    const major = d.labels.some((l) => Math.abs(l - v) < 1e-6);
    c.fillStyle = d.ink ?? (v >= d.red ? '#ffd0d0' : '#ececec');
    if (d.boldTicks) {
      // traço de 1 px: a linha do raio e outra meio pixel ao lado (na perpendicular)
      const a = fr(v), px = -Math.sin(a) * 0.5, py = Math.cos(a) * 0.5;
      const len = major ? [0.75, 1.25, 1.75, 2.25, 2.75] : [0.75, 1.25];
      for (const k of len) {
        const [x, y] = at(a, r - k);
        half(x, y);
        half(x + px, y + py);
      }
      continue;
    }
    half(...at(fr(v), r - 0.75));
    if (major) for (const k of [1.25, 1.75]) half(...at(fr(v), r - k));
  }
  for (const v of d.minor ?? []) {
    const l = String(v), a = fr(v);
    const [lx, ly] = at(a, r - 2.6 - Math.abs(Math.cos(a)) * pixWidth(l, 0.5) * 0.5 - Math.abs(Math.sin(a)) * 1.3);
    pix(c, l, lx, ly, d.ink ?? '#b8b8b8', 0.5);
  }
  for (const v of d.labels) {
    const l = String(Math.round(v * (d.labelMul ?? 1)));
    // recua do aro só o quanto o número ocupa na direção do centro (largura nas laterais,
    // altura no alto), para os de cima não se encostarem
    const a = fr(v);
    const ls = d.labelScale ?? 0.5;
    const col = v >= d.red && d.redLabels !== false ? '#ff5a4a' : d.ink ?? '#f2f2f2';
    if (ls === 0.7) {  // fonte 5x7 em meio pixel (tamanho intermediário)
      const [lx, ly] = at(a, r - 2.8 - Math.abs(Math.cos(a)) * pix7Width(l, true) * 0.55 - Math.abs(Math.sin(a)) * 1.9);
      const [nx, ny] = d.nudge?.[v] ?? [0, 0];
      pix7(c, l, lx + nx, ly + ny, col, true);
      continue;
    }
    const [lx, ly] = at(a, r - (ls > 0.5 ? 3.2 : 2.7) - (Math.abs(Math.cos(a)) * pixWidth(l, ls) * 0.5 + Math.abs(Math.sin(a)) * 2.5 * ls) * (ls > 0.5 ? 1.3 : 1) - (ls > 0.5 ? 0.6 : 0));
    pix(c, l, lx, ly, col, ls);
  }
  c.restore();
  needle(c, cx, cy, r, a0 + sweep * Math.max(0, Math.min(1.02, frac)), art);
}

function dialNeedle(c: CanvasRenderingContext2D, d: Dial, ox: number, frac: number, art: CockpitArt) {
  const a0 = d.a0 ?? Math.PI * 0.75, sweep = d.sweep ?? Math.PI * 1.5;
  needle(c, ox + d.x, ART_TOP + d.y, d.r, a0 + sweep * Math.max(0, Math.min(1.02, frac)), art);
}

// ponteiro: do centro exato, traçado em meio pixel (1 px de espessura)
function needle(c: CanvasRenderingContext2D, cx: number, cy: number, r: number, a: number, art: CockpitArt) {
  const len = r - 2.5;
  const ca = Math.cos(a), sa = Math.sin(a) * PIX_Y;
  const w = art.needleW ?? 1;
  c.fillStyle = art.needle;
  for (let t = -(art.needleTail ?? 0); t <= len; t += 0.25) {
    const x = Math.round((cx + 0.5 + ca * t) * 2) / 2, y = Math.round((cy + 0.5 + sa * t) * 2) / 2;
    const ww = t > len - 3 ? Math.min(w, 1) : w; // ponta mais fina
    c.fillRect(x - ww / 2, y - ww / 2, ww, ww);
  }
  c.fillStyle = art.hub;
  if (w > 1) c.fillRect(cx - 1.5, cy - 1.5, 4, 4);
  c.fillRect(cx - 1, cy - 1, 3, 3);
  c.fillStyle = '#000';
  c.fillRect(cx, cy, 1, 1);
}

// ícones de 13x9 em meio pixel (a tela tem 2 pixels por pixel do jogo): o dobro de detalhe
// no mesmo espaço, como os símbolos de verdade: almotolia, termômetro na água, bomba de
// combustível, caracol do turbo e bateria com + e -
const ICONS = {
  oil: ['.............', '.111.........', '.111......11.', '1111111..11..', '11111111111..', '.111111111...', '.11111111....', '..........1..', '..........1..'],
  temp: ['.....11......', '.....1111....', '.....11......', '.....1111....', '.....11......', '....1111.....', '....1111.....', '1.1.1.1.1.1.1', '.1.1.1.1.1.1.'],
  fuel: ['1111111......', '1.....1.1....', '1.....1..1...', '1111111..1...', '1111111..1...', '1111111.11...', '1111111......', '1111111......', '111111111....'],
  turbo: ['...11111.....', '..1.....1111.', '.1..111......', '1..1...1.....', '1..1.1.1.111.', '1..1...1.1...', '.1..111..1...', '..1.....1....', '...11111.....'],
  volt: ['..11....11...', '1111111111111', '1...........1', '1..1........1', '1.111...111.1', '1..1........1', '1...........1', '1111111111111', '.............'],
};
function drawIcon(c: CanvasRenderingContext2D, name: keyof typeof ICONS, cx: number, top: number, color = '#f4f4f4') {
  const ic = ICONS[name];
  const x0 = Math.round((cx - 3.25) * 2) / 2, y0 = Math.round(top * 2) / 2;
  c.fillStyle = color;
  ic.forEach((row, j) => [...row].forEach((ch, i) => ch === '1' && c.fillRect(x0 + i * 0.5, y0 + j * 0.5, 0.5, 0.5)));
}

// fundo preto do mostrador, por linhas (centro no meio do pixel cx, cy)
function face(c: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  const ry = r * PIX_Y;
  c.fillStyle = '#050506';
  for (let dy = -Math.floor(ry); dy <= Math.floor(ry); dy++) {
    const hw = Math.round(r * Math.sqrt(Math.max(0, 1 - (dy / ry) ** 2)));
    c.fillRect(cx - hw, cy + dy - 0.5, hw * 2 + 1, 2); // sem emendas (ver artDial)
  }
}
const half = (c: CanvasRenderingContext2D, x: number, y: number) => c.fillRect(Math.round(x * 2) / 2, Math.round(y * 2) / 2, 0.5, 0.5);
// ponteiro em meio pixel a partir de (x0, y0), ângulo a, comprimento len (horizontal)
function hand(c: CanvasRenderingContext2D, x0: number, y0: number, a: number, len: number, color: string, w = 1) {
  const ca = Math.cos(a), sa = Math.sin(a) * PIX_Y;
  c.fillStyle = color;
  for (let t = 0; t <= len; t += 0.25) {
    const x = Math.round((x0 + ca * t) * 2) / 2, y = Math.round((y0 + sa * t) * 2) / 2;
    c.fillRect(x - w / 2, y - w / 2, w, w);
  }
}

// Leitura dos mostradores auxiliares (0..1 da escala), cada um com sua função:
// pressão do óleo sobe na partida e estabiliza; água e óleo esquentam aos poucos;
// o combustível baixa ao longo do trecho; o turbo só enche acelerando; a bateria fica parada.
const gauges: Record<Gauge, number> = { oil: 0.3, water: 0.3, oiltemp: 0.25, fuel: 0.92, boost: 0, volt: 0.62 };
let gaugeRace: Race | null = null;
function updateGauges(r: Race, dt: number) {
  if (gaugeRace !== r) {
    gaugeRace = r;
    Object.assign(gauges, { oil: 0.3, boost: 0 });
  }
  const k = Math.min(1, dt * 1.5);
  const rpm = Math.min(1, r.rpm);
  gauges.oil += (0.3 + 0.35 * clamp(rpm / 0.3, 0, 1) - gauges.oil) * k;
  // motor batido: a água sobe até perto da faixa vermelha
  const hot = 0.3 + 0.25 * Math.min(1, r.time / 40) + Math.max(0, r.damage - 0.3) * 0.6;
  gauges.water += (hot - gauges.water) * Math.min(1, dt * 0.6);
  gauges.oiltemp = 0.25 + 0.35 * Math.min(1, r.time / 80);
  gauges.fuel = 0.92 - 0.3 * clamp(r.playerZ / r.track.finishZ, 0, 1);
  const boost = r.throttle && r.car.curve.includes('turbo') ? r.pt.boost * clamp((rpm - 0.2) / 0.4, 0, 1) : 0;
  gauges.boost += (boost - gauges.boost) * Math.min(1, dt * 6);
  gauges.volt = r.speed > 0 || r.throttle ? 0.62 : 0.55;
}

function auxDial(c: CanvasRenderingContext2D, g: Aux, ox: number, art: CockpitArt) {
  const cx = ox + g.x, cy = ART_TOP + g.y, R = g.r;
  const mx = cx + 0.5, my = cy + 0.5; // centro real
  face(c, cx, cy, R);
  const at = (x: number, y: number, a: number, rr: number): [number, number] => [x + Math.cos(a) * rr, y + Math.sin(a) * rr * PIX_Y];
  const ticks = (x: number, y: number, rr: number, a0: number, a1: number, n: number) => {
    c.fillStyle = '#e8e8e8';
    for (let i = 0; i <= n; i++) {
      const a = a0 + ((a1 - a0) * i) / n;
      half(c, ...at(x, y, a, rr));
      half(c, ...at(x, y, a, rr - 0.5));
      if (i === 0 || i === n || i * 2 === n) half(c, ...at(x, y, a, rr - 1));
    }
  };
  const val = (k: Gauge) => gauges[k];
  const PI = Math.PI;
  if (g.kind === 'clock') {
    ticks(mx, my, R - 0.75, -PI / 2, PI * 1.5, 12);
    for (const [l, a] of [['12', -PI / 2], ['3', 0], ['6', PI / 2], ['9', PI]] as [string, number][])
      pix(c, l, ...at(mx, my, a, R - (R >= 18 ? 5.2 : 3.6)), '#f2f2f2', R >= 18 ? 1 : 0.5);
    const now = new Date();
    const m = now.getMinutes() + now.getSeconds() / 60, h = (now.getHours() % 12) + m / 60;
    hand(c, mx, my, -PI / 2 + (h / 12) * PI * 2, R * 0.5, art.needle);
    hand(c, mx, my, -PI / 2 + (m / 60) * PI * 2, R * 0.78, art.needle);
    c.fillStyle = art.needle;
    c.fillRect(cx - 0.5, cy - 0.5, 2, 2);
    return;
  }
  const [k1, k2] = g.show ?? ['oil'];
  if (g.kind === 'single') {
    // arco de cima, da esquerda (frio/baixo) para a direita; nos pequenos (até 6 px) o arco é
    // mais fechado, para o ponteiro nunca deitar por cima do ícone da metade de baixo
    const small = R <= 6;
    const a0 = small ? PI * 1.12 : PI * 0.95, a1 = small ? PI * 1.88 : PI * 2.05;
    // combustível: reserva em vermelho no começo da escala
    if (k1 === 'fuel' && small) {
      c.fillStyle = '#d81818';
      for (let a = a0; a <= a0 + (a1 - a0) * 0.18; a += 0.05) half(c, ...at(mx, my, a, R - 0.75));
    }
    ticks(mx, my, R - 0.75, a0, a1, 4);
    // números nas pontas e no meio (água 60/90/120, turbo 0/0,8/1,5 da F40)
    g.labels?.forEach((l, i) => {
      const a = a0 + ((a1 - a0) * i) / (g.labels!.length - 1);
      pix(c, l, ...at(mx, my, a, R - 2.6 - Math.abs(Math.cos(a)) * pixWidth(l, 0.5) * 0.45), '#f2f2f2', 0.5);
    });
    hand(c, mx, my, a0 + (a1 - a0) * val(k1), small ? R - 1.25 : R - 1.5, art.needle);
  } else if (g.kind === 'dual') {
    // dois ponteiros no mesmo eixo: o da esquerda sobe pela esquerda, o da direita pela direita
    ticks(mx, my, R - 0.75, PI * 0.8, PI * 1.4, 3);
    ticks(mx, my, R - 0.75, PI * 1.6, PI * 2.2, 3);
    hand(c, mx, my, PI * 0.8 + PI * 0.6 * val(k1), R - 1.5, art.needle);
    hand(c, mx, my, PI * 2.2 - PI * 0.6 * val(k2), R - 1.5, art.needle);
  } else if (g.kind === 'combo') {
    // combinado VDO do 959: temperatura do óleo na esquerda (faixa vermelha no alto), pressão
    // na direita, ponteiros saindo das bordas; no meio a luz-espia do nível do óleo
    const lx = mx - R * 0.95, rx = mx + R * 0.95;
    c.fillStyle = '#d81818';
    for (let a = -0.62; a <= -0.42; a += 0.04) half(c, ...at(lx, my, a, R * 0.8));
    ticks(lx, my, R * 0.86, -0.62, 0.62, 6);
    ticks(rx, my, R * 0.86, PI - 0.62, PI + 0.62, 5);
    pix(c, '170', ...at(lx, my, -0.62, R * 0.58), '#f2f2f2', 0.5);
    pix(c, '60', ...at(lx, my, 0.62, R * 0.62), '#f2f2f2', 0.5);
    pix(c, '5', ...at(rx, my, PI + 0.62, R * 0.66), '#f2f2f2', 0.5);
    pix(c, '0', ...at(rx, my, PI - 0.62, R * 0.66), '#f2f2f2', 0.5);
    hand(c, lx + 1, my, 0.62 - 1.24 * val(k1), R * 0.55, art.needle);
    hand(c, rx - 1, my, PI - 0.62 + 1.24 * val(k2), R * 0.55, art.needle);
    const lowOil = gauges.oil < 0.36; // acende na partida, até a pressão subir
    c.fillStyle = lowOil ? '#ff3020' : '#3a0c0c';
    c.fillRect(cx - 1, cy - 1, 3, 2.5);
    drawIcon(c, 'oil', mx, my - R * 0.75);
    c.fillStyle = '#5a1010'; // triângulo de alerta e bateria, apagados
    c.fillRect(cx - 0.5, cy + R * 0.45, 2, 1.5);
    return;
  } else {
    // dois eixos lado a lado, cada um com sua escala do lado de fora
    const d = R * 0.3;
    const lx = mx - d, rx = mx + d;
    ticks(lx, my, R * 0.64, PI * 0.7, PI * 1.3, 4);
    ticks(rx, my, R * 0.64, PI * -0.3, PI * 0.3, 4);
    hand(c, lx, my, PI * 0.7 + PI * 0.6 * val(k1), R * 0.58, art.needle);
    hand(c, rx, my, PI * 0.3 - PI * 0.6 * val(k2), R * 0.58, art.needle);
    c.fillStyle = '#2a2a2e';
    c.fillRect(Math.round(lx) - 1, cy - 0.5, 2, 2);
    c.fillRect(Math.round(rx) - 1, cy - 0.5, 2, 2);
  }
  if (g.kind !== 'twin') {
    c.fillStyle = art.needle;
    c.fillRect(cx - 0.5, cy - 0.5, 2, 2);
  }
  // ícone na metade de baixo (o ponteiro só varre a de cima), em pixel inteiro
  const iy = g.kind === 'twin' ? my + R * PIX_Y * 0.42 : my + Math.max(1.5, Math.min(R * PIX_Y * 0.3, R * PIX_Y - 5.5));
  drawIcon(c, g.icon ?? 'oil', mx, iy);
}

// ---------- painel digital (LCD) do Corvette C4 ----------
// Posições em pixels nativos da área central (medidas na arte, ver import_cockpit.py)
const LCD = {
  bg: '#262826',
  green: '#3ae432', greenOff: '#203c20', yellow: '#f6d42a', yellowOff: '#3a3620', red: '#ff3a24', redOff: '#3c2020',
};

// arco de segmentos: pixels de meio pixel de cada segmento, calculados uma vez
const arcCache = new Map<string, [number, number][][]>();
function arcSegments(cx: number, cy: number, r0: number, r1: number, a0: number, a1: number, n: number) {
  const key = [cx, cy, r0, r1, a0, a1, n].join();
  let segs = arcCache.get(key);
  if (segs) return segs;
  segs = [];
  const span = (a1 - a0) / n;
  for (let i = 0; i < n; i++) {
    const set = new Set<string>();
    const pts: [number, number][] = [];
    // segmento ocupa 70% do passo (o resto é o vão escuro entre eles)
    for (let a = a0 + span * i + span * 0.15; a <= a0 + span * (i + 0.85); a += span / 8)
      for (let rr = r0; rr <= r1; rr += 0.4) {
        const x = Math.round((cx + Math.cos(a) * rr) * 2) / 2, y = Math.round((cy + Math.sin(a) * rr * PIX_Y) * 2) / 2;
        const k = x + ',' + y;
        if (!set.has(k)) { set.add(k); pts.push([x, y]); }
      }
    segs.push(pts);
  }
  arcCache.set(key, segs);
  return segs;
}

function drawArc(c: CanvasRenderingContext2D, ox: number, g: { x: number; y: number; r0: number; r1: number; a0: number; a1: number; n: number },
  frac: number, color: (f: number) => [string, string]) {
  const segs = arcSegments(ox + g.x, ART_TOP + g.y, g.r0, g.r1, g.a0, g.a1, g.n);
  const lit = Math.round(Math.max(0, Math.min(1, frac)) * g.n);
  segs.forEach((pts, i) => {
    const [on, off] = color(i / g.n);
    c.fillStyle = i < lit ? on : off;
    for (const [x, y] of pts) c.fillRect(x, y, 0.5, 0.5);
  });
}

// dígito de 7 segmentos (7 x 12 px, traços de 2 px); os segmentos apagados ficam levemente
// visíveis, como no LCD
const SEG7 = ['abcdef', 'bc', 'abdeg', 'abcdg', 'bcfg', 'acdfg', 'acdefg', 'abc', 'abcdefg', 'abcdfg'];
const SEG_PARTS: Record<string, [number, number, number, number]> = {
  a: [1.5, 0, 4, 1.5], b: [5.5, 1, 1.5, 4.5], c: [5.5, 6.5, 1.5, 4.5], d: [1.5, 10.5, 4, 1.5],
  e: [0, 6.5, 1.5, 4.5], f: [0, 1, 1.5, 4.5], g: [1.5, 5.25, 4, 1.5],
};
function seg7(c: CanvasRenderingContext2D, x: number, y: number, digit: number | null, on: string, off: string) {
  const lit = digit === null ? '' : SEG7[digit];
  for (const [k, [dx, dy, w, h]] of Object.entries(SEG_PARTS)) {
    c.fillStyle = lit.includes(k) ? on : off;
    c.fillRect(x + dx, y + dy, w, h);
  }
}

function seg7Number(c: CanvasRenderingContext2D, xr: number, y: number, v: number, digits: number, on: string, off: string) {
  const s = String(Math.max(0, Math.round(v)));
  for (let i = 0; i < digits; i++) {
    const ch = s[s.length - 1 - i];
    seg7(c, xr - (i + 1) * 8.5 + 1.5, y, ch === undefined ? null : Number(ch), on, off);
  }
}

// barra vertical segmentada dentro de moldura amarela (pressão, temperatura etc.)
function lcdBars(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, n: number, frac: number, on: string) {
  c.fillStyle = LCD.yellow;
  c.fillRect(x, y, w, 0.5);
  c.fillRect(x, y + h - 0.5, w, 0.5);
  c.fillRect(x, y, 0.5, h);
  c.fillRect(x + w - 0.5, y, 0.5, h);
  const bw = (w - 1.5) / n;
  for (let i = 0; i < n; i++) {
    const bh = ((h - 2) * (i + 1)) / n;
    c.fillStyle = i < Math.round(frac * n) ? on : LCD.greenOff;
    c.fillRect(x + 1 + i * bw, y + h - 1 - bh, Math.max(0.5, bw - 0.5), bh);
  }
}

function lcdPanel(c: CanvasRenderingContext2D, ox: number, r: Race, art: CockpitArt) {
  const kmh = r.speed * KMH;
  const rpm = Math.min(1, Math.max(0, r.rpm));
  // velocímetro: arco verde e número de 3 dígitos
  const speedArc = { x: 116, y: 80, r0: 32, r1: 38, a0: Math.PI * 1.06, a1: Math.PI * 1.46, n: 22 };
  drawArc(c, ox, speedArc, kmh / art.speedMax, () => [LCD.green, LCD.greenOff]);
  for (let v = 0; v <= 300; v += 50) {
    const a = speedArc.a0 + ((speedArc.a1 - speedArc.a0) * v) / 300;
    const rl = 41 + pixWidth(String(v), 0.5) * 0.5 * Math.abs(Math.cos(a));
    pix(c, String(v), ox + 116 + 0.5 + Math.cos(a) * rl, ART_TOP + 80 + Math.sin(a) * rl * PIX_Y, LCD.yellow, 0.5);
  }
  seg7Number(c, ox + 114, ART_TOP + 59, kmh, 3, LCD.yellow, LCD.yellowOff); // à direita do arco (os três dígitos não encostam nas barras)
  // conta-giros: arco verde/amarelo/vermelho e giro em centenas (46 = 4.600 rpm)
  const tachArc = { x: 226, y: 86, r0: 31, r1: 37, a0: Math.PI * 1.2, a1: Math.PI * 1.49, n: 18 };
  drawArc(c, ox, tachArc, rpm, (f) => (f < 0.7 ? [LCD.green, LCD.greenOff] : f < 0.85 ? [LCD.yellow, LCD.yellowOff] : [LCD.red, LCD.redOff]));
  seg7Number(c, ox + 224, ART_TOP + 59, rpm * 70, 2, LCD.yellow, LCD.yellowOff);
  // centro: pressão do óleo, combustível, temperatura, voltímetro e luzes
  const oil = 0.35 + 0.5 * rpm, temp = 0.45 + 0.15 * Math.min(1, r.time / 90), fuel = 0.8 - 0.3 * Math.min(1, r.time / 600);
  lcdBars(c, ox + 116, ART_TOP + 30, 24, 10, 8, oil, LCD.green);
  // combustível: bloco vertical que esvazia de cima para baixo
  c.fillStyle = LCD.greenOff;
  c.fillRect(ox + 143, ART_TOP + 29, 12, 13);
  const fh = 13 * fuel;
  c.fillStyle = fuel > 0.25 ? LCD.green : LCD.yellow;
  c.fillRect(ox + 143, ART_TOP + 29 + 13 - fh, 12, fh);
  c.fillStyle = LCD.yellow;
  c.fillRect(ox + 143, ART_TOP + 38, 12, 4);
  lcdBars(c, ox + 158, ART_TOP + 30, 18, 10, 6, temp, temp > 0.85 ? LCD.red : LCD.green);
  lcdBars(c, ox + 116, ART_TOP + 44, 16, 6, 6, 0.6 + 0.05 * Math.sin(r.time), LCD.yellow);
  lcdBars(c, ox + 160, ART_TOP + 44, 16, 6, 6, 0.5, LCD.yellow);
  // luzes de aviso (acesas quando faz sentido)
  const lights: [number, boolean, string][] = [[136, r.state === 'crash', LCD.red], [142, rpm > 0.9, LCD.yellow], [148, false, LCD.green], [154, r.speed < 100, LCD.green]];
  for (const [x, on, col] of lights) {
    c.fillStyle = on ? col : LCD.greenOff;
    c.fillRect(ox + x, ART_TOP + 45, 4, 3);
  }
}

// Cabine desenhada em pixels nativos do Super Nintendo (256x224), com as posições
// medidas nas capturas de referência (tools/ref/measure.py). Em telas largas, a área
// de 256 px fica no centro e teto/painel se estendem para os lados.
export const CORE_W = 256;
const HORIZON_Y = 65;

let wheelAngle = 0;
let crackKey = -1;
let cracks: number[][] = [];
const drops: { x: number; y: number; v: number }[] = [];

const coreX = () => Math.floor((view.w - CORE_W) / 2);

export function windshield(): Viewport {
  return { x: 0, y: ROOF_H, w: view.w, h: DASH_Y - ROOF_H, horizon: HORIZON_Y, K: 190 };
}

const disc = (c: CanvasRenderingContext2D, x: number, y: number, r: number, color: string | CanvasPattern | CanvasGradient) => {
  c.fillStyle = color;
  c.beginPath();
  c.arc(x, y, r, 0, Math.PI * 2);
  c.fill();
};

// Mostrador no estilo do original: aro cinza, fundo preto, dígitos de pixel
function gauge(
  c: CanvasRenderingContext2D, cx: number, cy: number, r: number,
  labels: string[], frac: number, redFrom: number, extra: { gear?: string; digital?: string; ring?: string } = {},
) {
  disc(c, cx, cy, r + 1, extra.ring ?? '#9a9aa2');
  disc(c, cx, cy, r, '#060606');
  const a0 = Math.PI * 0.75, sweep = Math.PI * 1.5;
  const ticks = (labels.length - 1) * 2;
  for (let i = 0; i <= ticks; i++) {
    const f = i / ticks;
    const a = a0 + sweep * f;
    c.fillStyle = f >= redFrom ? '#ff3030' : '#e8e8e8';
    const rr = r - (i % 2 ? 2 : 3);
    c.fillRect(Math.round(cx + Math.cos(a) * rr), Math.round(cy + Math.sin(a) * rr), 1, 1);
    if (i % 2 === 0) c.fillRect(Math.round(cx + Math.cos(a) * (rr + 1)), Math.round(cy + Math.sin(a) * (rr + 1)), 1, 1);
  }
  labels.forEach((l, i) => {
    if (!l) return;
    const f = i / (labels.length - 1);
    const a = a0 + sweep * f;
    pix(c, l, cx + Math.cos(a) * (r - 9), cy + Math.sin(a) * (r - 9), f >= redFrom ? '#ff4040' : '#f0f0f0');
  });
  if (extra.digital) pix(c, extra.digital, cx, cy + r - 6, '#ff4a2a');
  if (extra.gear) pix(c, extra.gear, cx + r * 0.45, cy + r * 0.38, '#ff2a2a', 2);
  const a = a0 + sweep * Math.max(0, Math.min(1.02, frac));
  c.strokeStyle = '#ff3a1a';
  c.lineWidth = 1.5;
  c.beginPath();
  c.moveTo(cx, cy);
  c.lineTo(cx + Math.cos(a) * (r - 3), cy + Math.sin(a) * (r - 3));
  c.stroke();
  disc(c, cx, cy, 1.5, '#b02a1a');
}

function smallGauge(c: CanvasRenderingContext2D, cx: number, cy: number, r: number, frac: number) {
  disc(c, cx, cy, r + 1, '#7a7a80');
  disc(c, cx, cy, r, '#0a0a0a');
  c.fillStyle = '#d8d8d8';
  for (let i = 0; i <= 6; i++) {
    const a = Math.PI * (0.8 + i * 0.233);
    c.fillRect(Math.round(cx + Math.cos(a) * (r - 2)), Math.round(cy + Math.sin(a) * (r - 2)), 1, 1);
  }
  const a = Math.PI * (0.8 + frac * 1.4);
  c.strokeStyle = '#ff3a1a';
  c.lineWidth = 1;
  c.beginPath();
  c.moveTo(cx, cy);
  c.lineTo(cx + Math.cos(a) * (r - 2), cy + Math.sin(a) * (r - 2));
  c.stroke();
}

// luz-espia vermelha redonda (apagada: vermelho escuro)
function warnLamp(c: CanvasRenderingContext2D, x: number, y: number, on: boolean) {
  c.fillStyle = '#0a0a0c';
  c.fillRect(x - 1.5, y - 1.5, 4, 4);
  c.fillStyle = on ? '#ff3020' : '#4a1010';
  c.fillRect(x - 1, y - 1, 3, 3);
  c.fillStyle = on ? '#ffb0a0' : '#6a2020';
  c.fillRect(x - 0.5, y - 0.5, 1, 0.5);
}

// manômetro do turbo dentro do conta-giros do 959: arco de cima, 0 / 0,5 / 1,5 / 2,5 bar
function boostSubdial(c: CanvasRenderingContext2D, x: number, y: number, R: number, color: string) {
  const a0 = Math.PI * 1.2, a1 = Math.PI * 1.8;
  const at = (a: number, rr: number): [number, number] => [x + Math.cos(a) * rr, y + Math.sin(a) * rr * PIX_Y];
  c.fillStyle = '#e8e8e8';
  for (let i = 0; i <= 5; i++) {
    const a = a0 + ((a1 - a0) * i) / 5;
    half(c, ...at(a, R));
    half(c, ...at(a, R - 0.5));
  }
  for (const [l, v] of [['0', 0], ['1,5', 0.6], ['2,5', 1]] as [string, number][])
    pix(c, l, ...at(a0 + (a1 - a0) * v, R + 1.8), '#f2f2f2', 0.5);
  hand(c, x, y, a0 + (a1 - a0) * clamp(gauges.boost / 1.25, 0, 1), R - 0.5, color);
}

// luzes-espia da seta no quadro: duas setinhas verdes (esquerda e direita), centradas em (x, y);
// a do lado ligado pisca junto com o relé
function turnTells(c: CanvasRenderingContext2D, x: number, y: number, signal: number) {
  const lit = signal !== 0 && blinkOn();
  for (const side of [-1, 1]) {
    const on = lit && side === signal;
    const ax = x + side * 4.5; // centro de cada seta
    c.fillStyle = on ? '#3cf048' : '#0f2e14';
    for (let i = 0; i < 3; i++) {
      const hh = 1 + i; // meia altura da coluna (triângulo apontando para fora)
      c.fillRect(ax + side * (1.5 - i), y - hh + 0.5, 1, hh * 2 - 1);
    }
    c.fillRect(side < 0 ? ax + 1.5 : ax - 3.5, y - 0.5, 2, 1); // haste
  }
}
// posição padrão: entre os dois mostradores grandes, embaixo
function defaultTells(art: CockpitArt): [number, number] | null {
  const a = art.tach, b = art.speed;
  if (!a || !b) return null;
  return [(a.x + b.x) / 2, Math.max(a.y, b.y) + Math.max(a.r, b.r) * 0.55];
}

function radarLeds(c: CanvasRenderingContext2D, x: number, y: number, w: number, level: number) {
  const blink = level >= 1 && Math.floor(performance.now() / 150) % 2;
  const lw = Math.floor(w / 5);
  for (let i = 0; i < 5; i++) {
    const col = i < 2 ? '#30e060' : i < 4 ? '#ffcc00' : '#ff3030';
    c.fillStyle = level > i / 5 && !blink ? col : shade(col, -0.6);
    c.fillRect(x + i * lw, y, lw - 1, 3);
  }
}

function drawCracks(c: CanvasRenderingContext2D, r: Race, vp: Viewport, alpha: number) {
  if (crackKey !== r.crashes) {
    crackKey = r.crashes;
    const rand = rng(r.crashes * 77 + 3);
    cracks = [];
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2 + rand() * 0.3;
      const line = [0, 0];
      let px = 0, py = 0;
      const len = 40 + rand() * 120;
      for (let d = 0; d < len; d += 8 + rand() * 10) {
        px += Math.cos(a + (rand() - 0.5) * 0.6) * 12;
        py += Math.sin(a + (rand() - 0.5) * 0.6) * 9;
        line.push(px, py);
      }
      cracks.push(line);
    }
  }
  const ox = vp.x + vp.w * r.crashPoint.x, oy = vp.y + vp.h * r.crashPoint.y;
  c.save();
  c.globalAlpha = alpha;
  c.fillStyle = 'rgba(220,230,240,0.25)';
  c.fillRect(vp.x, vp.y, vp.w, vp.h);
  c.strokeStyle = '#ffffff';
  c.lineWidth = 1;
  for (const l of cracks) {
    c.beginPath();
    for (let i = 0; i < l.length; i += 2) c.lineTo(ox + l[i], oy + l[i + 1]);
    c.stroke();
  }
  for (const rr of [10, 22, 38]) {
    c.beginPath();
    c.ellipse(ox, oy, rr * 1.3, rr, 0, 0, Math.PI * 2);
    c.stroke();
  }
  c.restore();
}

// marcas que ficam no para-brisa: estrelinha de pedra (pontinho com raios curtos e um
// halo leitoso) e trinca de batida (raios longos e tortos, com um anel em volta); cada traço
// tem a sombra escura embaixo para aparecer contra o céu claro
function drawGlassMarks(c: CanvasRenderingContext2D, r: Race, vp: Viewport) {
  if (!r.glass.length) return;
  for (const g of r.glass) {
    const rand = rng(g.seed);
    const ox = Math.round(vp.x + vp.w * g.x), oy = Math.round(vp.y + vp.h * g.y);
    const n = g.star ? 5 + Math.floor(rand() * 3) : 7 + Math.floor(rand() * 5);
    const lines: number[][] = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + rand() * 0.5;
      const len = (g.star ? 3 + rand() * 4 : 12 + rand() * 40) * (0.5 + g.size);
      const pts = [0, 0];
      let px = 0, py = 0;
      for (let d = 0; d < len; d += g.star ? 2 : 5 + rand() * 5) {
        const aa = a + (rand() - 0.5) * (g.star ? 0.3 : 0.7);
        px += Math.cos(aa) * (g.star ? 2 : 6);
        py += Math.sin(aa) * (g.star ? 1.6 : 4.5);
        pts.push(px, py);
      }
      lines.push(pts);
    }
    c.save();
    c.lineWidth = 1;
    for (const [col, off] of [['rgba(20,24,30,0.35)', 1], ['rgba(240,246,252,0.8)', 0]] as [string, number][]) {
      c.strokeStyle = col;
      for (const l of lines) {
        c.beginPath();
        for (let i = 0; i < l.length; i += 2) c.lineTo(ox + Math.round(l[i]) + 0.5, oy + Math.round(l[i + 1]) + 0.5 + off);
        c.stroke();
      }
    }
    if (!g.star) {
      c.strokeStyle = 'rgba(240,246,252,0.55)';
      for (const rr of [5, 11].map((v) => v * (0.5 + g.size))) {
        c.beginPath();
        c.ellipse(ox + 0.5, oy + 0.5, rr * 1.3, rr, 0, rand() * 6, rand() * 6 + 3.5);
        c.stroke();
      }
    }
    // miolo esbranquiçado (o vidro moído no ponto do impacto)
    c.fillStyle = 'rgba(235,240,245,0.7)';
    c.fillRect(ox - 1, oy - 1, 3, 2);
    c.restore();
  }
}

function weather(c: CanvasRenderingContext2D, r: Race, vp: Viewport, dt: number) {
  const w = r.def.weather;
  if (!w || w === 'fog') return;
  const n = (w === 'rain' ? 70 : 60) >> (lowFx() ? 1 : 0);
  if (drops.length > n) drops.length = n;
  while (drops.length < n) drops.push({ x: Math.random() * vp.w, y: Math.random() * vp.h, v: 0.6 + Math.random() * 0.6 });
  const sp = r.speed / r.car.maxSpeed;
  c.save();
  c.beginPath();
  c.rect(vp.x, vp.y, vp.w, vp.h);
  c.clip();
  if (w === 'rain') {
    c.strokeStyle = 'rgba(200,215,235,0.55)';
    c.lineWidth = 1;
    for (const d of drops) {
      d.y += dt * 260 * d.v;
      d.x -= dt * (40 + sp * 120) * d.v;
      if (d.y > vp.h || d.x < 0) { d.y = -5; d.x = Math.random() * (vp.w + 60); }
      c.beginPath();
      c.moveTo(vp.x + d.x, vp.y + d.y);
      c.lineTo(vp.x + d.x - 3, vp.y + d.y + 7);
      c.stroke();
    }
  } else {
    c.fillStyle = 'rgba(255,255,255,0.9)';
    const cx = vp.w / 2, cy = vp.horizon - vp.y;
    for (const d of drops) {
      d.y += dt * (25 + sp * 60) * d.v + (d.y - cy) * dt * sp * 1.5;
      d.x += (d.x - cx) * dt * sp * 1.5;
      if (d.y > vp.h || d.x < 0 || d.x > vp.w) { d.x = cx + (Math.random() - 0.5) * vp.w * 0.8; d.y = cy + (Math.random() - 0.7) * 40; }
      const s = d.v > 1 ? 2 : 1;
      c.fillRect(vp.x + d.x, vp.y + d.y, s, s);
    }
  }
  c.restore();
}

// topo do painel em cada coluna da tela (primeira linha opaca da arte do painel)
const dashTops = new Map<string, Int16Array>();
function dashTopFn(art: CockpitArt | undefined): DashTop {
  if (!art) return () => DASH_Y;
  let col = dashTops.get(art.dash);
  if (!col) {
    const spr = svgSprite(art.dash, DASH_W, 124);
    if (spr) {
      const d = spr.getContext('2d')!.getImageData(0, 0, spr.width, spr.height).data;
      col = new Int16Array(spr.width);
      for (let x = 0; x < spr.width; x++) {
        let y = 0;
        while (y < spr.height - 1 && d[(y * spr.width + x) * 4 + 3] === 0) y++;
        col[x] = y;
      }
      // a arte de cima (teto, colunas e a borda do painel) pode cobrir as primeiras linhas: a
      // borda visível é onde ela fica transparente, subindo a partir da base (colunas inteiras,
      // como a coluna A, não contam)
      const tp = svgSprite(art.top, DASH_W, TOP_EXT);
      if (tp) {
        const t = tp.getContext('2d')!.getImageData(0, 0, tp.width, tp.height).data;
        for (let x = 0; x < Math.min(tp.width, col.length); x++) {
          let y = tp.height - 1;
          if (t[(y * tp.width + x) * 4 + 3] === 0) continue;
          while (y > 0 && t[(y * tp.width + x) * 4 + 3] !== 0) y--;
          if (y > tp.height - 30) col[x] = Math.min(col[x], y + 1 - tp.height);
        }
      }
      dashTops.set(art.dash, col);
    }
  }
  const dx = coreX() - DASH_PAD;
  return (x) => (col ? ART_TOP + col[Math.max(0, Math.min(col.length - 1, x - dx))] : DASH_Y);
}

// batida: a cabine inteira sacode com o tranco
export function renderCockpit(c: CanvasRenderingContext2D, r: Race, lives: number, stageLabel: string, totalTime: number, dt: number) {
  c.save();
  if (r.jolt > 0.02) c.translate(Math.round((Math.random() - 0.5) * r.jolt * 8), Math.round((Math.random() - 0.5) * r.jolt * 6));
  renderCockpitInner(c, r, lives, stageLabel, totalTime, dt);
  c.restore();
}

// capô amassado subindo à frente do para-brisa e fumaça/vapor saindo do motor
function drawDamage(c: CanvasRenderingContext2D, r: Race, vp: Viewport, art: CockpitArt | undefined) {
  const top = dashTopFn(art);
  const cx = coreX() + 128;
  const grow = r.state === 'crash' ? Math.min(1, r.impactT / 0.12) : r.damage > 0.25 ? r.damage * 0.65 : 0;
  if (grow > 0) {
    const half = Math.round(vp.w * 0.27);
    const rand = rng(r.crashes * 53 + 11);
    const peaks: number[] = [];
    for (let i = 0; i <= 12; i++) peaks.push(4 + rand() * 10 + (i % 3 === 1 ? 5 : 0));
    const color = paintHex(r.car.id) ?? r.car.color;
    for (let x = cx - half; x <= cx + half; x++) {
      const u = (x - (cx - half)) / (2 * half); // 0..1 ao longo do capô
      const k = u * 12, i0 = Math.floor(k), f = k - i0;
      const edge = Math.sin(u * Math.PI) ** 0.6; // mais alto no meio, some nas pontas
      const h = Math.round((peaks[i0] * (1 - f) + peaks[Math.min(12, i0 + 1)] * f) * edge * grow);
      if (h <= 0) continue;
      const y0 = top(x) + 1;
      // dobras: a luz varia suave ao longo da lata vincada (sem faixas claras e escuras
      // alternadas, que em carro claro viravam xadrez), base na sombra do para-brisa, borda
      // escura em cima e um fio de reflexo logo abaixo dela
      const lum = 0.05 * Math.sin(k * Math.PI * 0.85) - 0.07;
      c.fillStyle = shade(color, lum);
      c.fillRect(x, y0 - h, 1, h);
      if (h > 2) {
        c.fillStyle = shade(color, lum - 0.12);
        c.fillRect(x, y0 - Math.max(1, Math.round(h * 0.35)), 1, Math.max(1, Math.round(h * 0.35)));
        c.fillStyle = shade(color, lum + 0.06);
        c.fillRect(x, y0 - h + 1, 1, 1);
      }
      c.fillStyle = shade(color, -0.42);
      c.fillRect(x, y0 - h, 1, 1);
    }
  }
  if (r.smoke > 0.02) drawSmoke(c, cx, top(cx) + 2, vp.w * 0.5, r.smoke, r.crashes + 1);
}

// estilhaços (vidro e lata) voando do ponto do impacto
function drawDebris(c: CanvasRenderingContext2D, r: Race, vp: Viewport) {
  const t = r.impactT;
  if (t > 1.1) return;
  const rand = rng(r.crashes * 31 + 5);
  const ox = vp.x + vp.w * r.crashPoint.x, oy = vp.y + vp.h * r.crashPoint.y;
  const body = paintHex(r.car.id) ?? r.car.color;
  for (let i = 0; i < 28; i++) {
    const a = rand() * Math.PI * 2, sp = 50 + rand() * 150;
    const x = ox + Math.cos(a) * sp * t, y = oy + Math.sin(a) * sp * t * 0.8 + 160 * t * t;
    const glass = rand() < 0.6;
    c.fillStyle = glass ? `rgba(225,238,248,${(1 - t / 1.1).toFixed(2)})` : body;
    const s = rand() < 0.3 ? 2 : 1;
    c.fillRect(Math.round(x), Math.round(y), s, s);
  }
}

function renderCockpitInner(c: CanvasRenderingContext2D, r: Race, lives: number, stageLabel: string, totalTime: number, dt: number) {
  const { w } = view;
  const vp = windshield();
  const art = COCKPIT_ART[r.car.dash];
  ART_TOP = 100 + (art?.dy ?? 0);
  // nas cabines desenhadas, os vidros laterais vão abaixo do painel: a estrada desce até o fim
  renderRoad(c, r, art ? { ...vp, h: view.h - vp.y, dash: ART_TOP } : vp);
  weather(c, r, vp, dt);
  drawWipers(c, r, vp, dt, dashTopFn(art), coreX());
  drawGlassMarks(c, r, vp);
  drawDamage(c, r, vp, art);
  if (r.state === 'crash') {
    const t = 3.4 - r.timer;
    drawCracks(c, r, vp, 1);
    drawDebris(c, r, vp);
    if (t > 1.9) {
      c.fillStyle = `rgba(0,0,0,${Math.min(0.75, (t - 1.9) * 0.8)})`;
      c.fillRect(vp.x, vp.y, vp.w, vp.h);
      text(c, 'BATIDA!', w / 2, vp.y + 26, 16, '#ff4040', 'center');
      text(c, `Carros restantes: ${Math.max(0, lives - 1)}`, w / 2, vp.y + 54, 8, '#fff', 'center');
    }
  }
  drawRoof(c, r, stageLabel, totalTime);
  const dash = r.car.dash;
  if (art && drawCockpitArt(c, r, dt, art)) {
    // cabine desenhada a partir da arte
  } else if (art) {
    // a arte desta cabine ainda está carregando (só no primeiro quadro): painel escuro
    c.fillStyle = '#0c0c0e';
    c.fillRect(0, ART_TOP, w, view.h - ART_TOP);
  } else if (dash === 'f40') drawDashF40(c, r, dt);
  else if (dash === '959') drawDash959(c, r, dt);
  else if (dash === 'A') drawDashTD2Black(c, r, dt);
  else drawDashTD2Grey(c, r, dt);

  if (r.state === 'countdown') {
    const n = Math.ceil(r.timer);
    text(c, n > 3 ? 'PRONTO?' : String(n), w / 2, vp.y + 28, 16, '#ffd400', 'center');
    // os desafios deste trecho, para o jogador saber o que buscar
    if (r.challenges.length) {
      text(c, 'DESAFIOS', w / 2, vp.y + 52, 5, '#ffd400', 'center');
      r.challenges.forEach((ch, i) => text(c, ch.label, w / 2, vp.y + 61 + i * 8, 5, '#ffffff', 'center'));
    }
  } else if (r.state === 'drive' && r.time < 1 && r.crashes === 0) {
    text(c, 'VAI!', w / 2, vp.y + 28, 16, '#30e060', 'center');
  }
  if (r.messageT > 0) text(c, r.message, w / 2, vp.y + 10, 8, '#ffd400', 'center');
  if (r.officer?.phase === 'show' && r.fine) drawFine(c, r, vp);
}

// Teto: tecido escuro, alça do quebra-sol, faixa inferior com os marcadores de
// progresso (como no original) e retrovisor de cantos arredondados.
function drawRoof(c: CanvasRenderingContext2D, r: Race, stageLabel: string, totalTime: number) {
  const { w } = view;
  const ox = coreX();
  c.fillStyle = dither(c, '#2a2a2c', '#343437');
  c.fillRect(0, 0, w, 18);
  c.fillStyle = '#141415';
  c.fillRect(0, 18, w, ROOF_H - 18);
  c.fillStyle = '#4a4a4e';
  c.fillRect(0, 17, w, 1);
  // alça
  c.fillStyle = '#d0d0d4';
  c.beginPath();
  c.roundRect(ox + 10, 7, 27, 11, 3);
  c.fill();
  c.fillStyle = '#16161a';
  c.beginPath();
  c.roundRect(ox + 12, 9, 23, 7, 2);
  c.fill();
  // tempo (o original não mostra; fica discreto na área vazia do teto)
  const clock = `${stageLabel}  ${formatTime(totalTime + r.time)}`;
  pix(c, clock, ox + 46 + pixWidth(clock) / 2, 9, '#8a8a90');
  // diferença para o fantasma no mesmo ponto da pista: verde na frente, vermelho atrás
  const gt = r.ghostRun && r.time > 1 ? ghostTimeAt(r.ghostRun, r.playerZ) : null;
  if (gt !== null) {
    const d = r.time - gt;
    const l = `${d >= 0 ? '+' : '-'}${Math.abs(d).toFixed(1)}`;
    pix(c, l, ox + 46 + pixWidth(clock) + 4 + pixWidth(l) / 2, 9, d >= 0 ? '#ff7060' : '#50e070');
    // fantasma de amigo (código colado no Ranking): avisa contra quem é a disputa
    if ((r.ghostRun as { friend?: boolean } | null)?.friend) pix(c, 'AMIGO', ox + 46 + pixWidth(clock) + 8 + pixWidth(l) + pixWidth('AMIGO') / 2, 9, '#ffd21a');
  }
  // marcadores de progresso na faixa inferior
  const px = ox + 44, pw = 126;
  const mark = (z: number, color: string) => {
    const p = Math.max(0, Math.min(1, (z - r.track.startZ) / (r.track.finishZ - r.track.startZ)));
    c.fillStyle = color;
    c.fillRect(Math.round(px + pw * p) - 2, 19, 5, 3);
  };
  c.fillStyle = '#e8e8e8';
  c.fillRect(px + pw + 2, 18, 2, 5);
  if (r.ghostPos) mark(r.ghostPos.z, '#b8b8c4'); // fantasma
  if (r.rival) mark(r.rival.z, r.rivalCar!.color);
  mark(r.playerZ, r.car.color);
  // retrovisor
  c.fillStyle = '#5a5a62';
  c.beginPath();
  c.roundRect(ox + 175, 3, 66, 20, 5);
  c.fill();
  c.fillStyle = '#a8a8b0';
  c.beginPath();
  c.roundRect(ox + 176, 4, 64, 18, 4);
  c.fill();
  renderMirror(c, r, ox + 178, 6, 60, 14);
}

// ---------- utilidades de desenho do interior ----------
const rect = (c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string | CanvasPattern) => {
  c.fillStyle = color;
  c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
};

// Sombra suave (projetada pelo volante, sob a capota dos instrumentos etc.)
function shadow(c: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, alpha: number) {
  const g = c.createRadialGradient(x, y, 0, x, y, Math.max(rx, ry));
  g.addColorStop(0, `rgba(0,0,0,${alpha})`);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  c.save();
  c.translate(x, y);
  c.scale(1, ry / rx);
  c.translate(-x, -y);
  c.fillStyle = g;
  c.beginPath();
  c.arc(x, y, rx, 0, Math.PI * 2);
  c.fill();
  c.restore();
}

// Escurece a parte de baixo do painel (luz vem do para-brisa)
function vignette(c: CanvasRenderingContext2D, y0: number) {
  const { w, h } = view;
  const g = c.createLinearGradient(0, y0, 0, h);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(0,0,0,0.55)');
  c.fillStyle = g;
  c.fillRect(0, y0, w, h - y0);
}

// Reflexo no vidro do mostrador
function glint(c: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  c.strokeStyle = 'rgba(255,255,255,0.35)';
  c.lineWidth = 1;
  c.beginPath();
  c.arc(cx, cy, r - 2, Math.PI * 1.1, Math.PI * 1.45);
  c.stroke();
}

// Mostrador realista: aro cromado, mostrador colorido, ponteiro, reflexo
function dial(
  c: CanvasRenderingContext2D, cx: number, cy: number, r: number, labels: string[], frac: number,
  o: { face: string; ink: string; needle: string; red?: number; gear?: string; digital?: string; bezel?: string },
) {
  disc(c, cx, cy, r + 2, '#0a0a0c');
  disc(c, cx, cy, r + 1, o.bezel ?? '#8c8e94');
  disc(c, cx, cy, r, o.face);
  shadow(c, cx, cy - r * 0.6, r, r * 0.5, 0.35); // sombra da borda superior
  const a0 = Math.PI * 0.75, sweep = Math.PI * 1.5;
  const ticks = (labels.length - 1) * 2;
  for (let i = 0; i <= ticks; i++) {
    const f = i / ticks;
    const a = a0 + sweep * f;
    c.fillStyle = o.red !== undefined && f >= o.red ? '#ff3020' : o.ink;
    const rr = r - 2;
    c.fillRect(Math.round(cx + Math.cos(a) * rr), Math.round(cy + Math.sin(a) * rr), 1, 1);
  }
  labels.forEach((l, i) => {
    if (!l) return;
    const f = i / (labels.length - 1);
    const a = a0 + sweep * f;
    pix(c, l, cx + Math.cos(a) * (r - 7), cy + Math.sin(a) * (r - 7), o.red !== undefined && f >= o.red ? '#ff3020' : o.ink);
  });
  if (o.digital) pix(c, o.digital, cx, cy + r - 5, '#ff5a2a');
  if (o.gear) pix(c, o.gear, cx + r * 0.42, cy + r * 0.4, '#ff2a1a', 2);
  const a = a0 + sweep * Math.max(0, Math.min(1.02, frac));
  c.strokeStyle = o.needle;
  c.lineWidth = 1.5;
  c.beginPath();
  c.moveTo(cx, cy);
  c.lineTo(cx + Math.cos(a) * (r - 2), cy + Math.sin(a) * (r - 2));
  c.stroke();
  disc(c, cx, cy, 1.5, '#1a1a1a');
  glint(c, cx, cy, r);
}

// Raio de volante afunilado (do cubo ao aro)
function spoke(c: CanvasRenderingContext2D, cx: number, cy: number, ang: number, r0: number, r1: number, w0: number, w1: number, fill: string, edge: string) {
  const ca = Math.cos(ang), sa = Math.sin(ang), px = -sa, py = ca;
  const pts = [
    cx + ca * r0 + px * w0, cy + sa * r0 + py * w0,
    cx + ca * r1 + px * w1, cy + sa * r1 + py * w1,
    cx + ca * r1 - px * w1, cy + sa * r1 - py * w1,
    cx + ca * r0 - px * w0, cy + sa * r0 - py * w0,
  ];
  c.fillStyle = fill;
  c.beginPath();
  for (let i = 0; i < 8; i += 2) c.lineTo(pts[i], pts[i + 1]);
  c.closePath();
  c.fill();
  c.strokeStyle = edge;
  c.lineWidth = 1;
  c.beginPath();
  c.moveTo(pts[0], pts[1]);
  c.lineTo(pts[2], pts[3]);
  c.stroke();
}

// Aro redondo de couro com reflexo da luz do para-brisa
function leatherRim(c: CanvasRenderingContext2D, cx: number, cy: number, R: number, th: number) {
  const mid = R - th / 2;
  c.strokeStyle = dither(c, '#141416', '#1c1c20');
  c.lineWidth = th;
  c.beginPath();
  c.arc(cx, cy, mid, 0, Math.PI * 2);
  c.stroke();
  c.strokeStyle = 'rgba(160,165,180,0.55)';
  c.lineWidth = Math.max(1, th * 0.28);
  c.beginPath();
  c.arc(cx, cy, mid + th * 0.18, Math.PI * 1.08, Math.PI * 1.6);
  c.stroke();
  c.strokeStyle = 'rgba(230,232,240,0.7)';
  c.lineWidth = 1;
  c.beginPath();
  c.arc(cx, cy, mid + th * 0.22, Math.PI * 1.22, Math.PI * 1.4);
  c.stroke();
  c.strokeStyle = 'rgba(120,125,140,0.35)';
  c.lineWidth = 1;
  c.beginPath();
  c.arc(cx, cy, mid - th * 0.3, Math.PI * 0.15, Math.PI * 0.55);
  c.stroke();
}

function steerAngle(r: Race, dt: number) {
  // com a traseira escapando o volante vai para o lado contrário (contraesterço)
  // como no Test Drive II, o volante gira bem (até ~50°) e com o peso de um volante de verdade
  wheelAngle = lerp(wheelAngle, clamp(r.steer * 0.85 - r.yaw * 1.2, -1.1, 1.1), Math.min(1, dt * 6)); // volante segue o piloto (contraesterço é dele)
  return wheelAngle;
}

// gira como na tela: o pixel é 8/7 mais largo, então o giro é feito em coordenadas de tela
// (sem isso um aro redondo vira elipse girando e deixa aparecer o que está atrás dele)
function withRotation(c: CanvasRenderingContext2D, cx: number, cy: number, ang: number, draw: () => void) {
  const k = view.aspect;
  c.save();
  c.translate(cx, cy);
  c.scale(1 / k, 1);
  c.rotate(ang);
  c.scale(k, 1);
  c.translate(-cx, -cy);
  draw();
  c.restore();
}

// ---------- F40 (fotos do carro real) ----------
// Painel de feltro azul-acinzentado, capota dos instrumentos à esquerda,
// velocímetro claro e conta-giros avermelhado, volante Momo de 3 raios,
// saída de ar redonda, 3 relógios no centro, chave vermelha, porta-luvas,
// câmbio de bola preta e assoalho de kevlar.
function drawDashF40(c: CanvasRenderingContext2D, r: Race, dt: number) {
  const { w, h } = view;
  const ox = coreX();
  // bico vermelho visto pelo para-brisa
  rect(c, 0, 120, w, 1, '#e04030');
  rect(c, 0, 121, w, 3, dither(c, '#b01818', '#c02020'));
  rect(c, 0, 124, w, 1, '#600808');
  // feltro: face superior iluminada → frente mais escura
  const felt = [['#5e6270', '#666a78'], ['#525664', '#5a5e6c'], ['#464a58', '#4e5260'], ['#3c404c', '#424654']];
  felt.forEach(([a, b], i) => rect(c, 0, 125 + i * 4, w, 4, dither(c, a, b)));
  rect(c, 0, 141, w, h - 141, speckle(c, '#3a3d48', [['#43465a', 0.3], ['#32353f', 0.25]], 21));
  rect(c, 0, 140, w, 1, '#2a2c34');
  // assoalho de kevlar e túnel (canto inferior direito)
  rect(c, ox + 170, 196, w - ox - 170, h - 196, dither(c, '#2a2a22', '#36362c'));
  for (let x = ox + 170; x < w; x += 4) for (let y = 196; y < h; y += 4) rect(c, x + ((y / 4) % 2) * 2, y, 2, 2, '#40402f');
  rect(c, ox + 170, 194, w - ox - 170, 2, '#1c1d22');
  shadow(c, ox + 210, 196, 60, 10, 0.6);
  // porta-luvas
  c.fillStyle = dither(c, '#454956', '#4c505e');
  c.beginPath();
  c.roundRect(ox + 194, 144, 58, 34, 3);
  c.fill();
  rect(c, ox + 194, 144, 58, 1, '#646878');
  rect(c, ox + 194, 177, 58, 1, '#24262c');
  for (const [sx, sy] of [[197, 147], [248, 147], [197, 174], [248, 174]]) rect(c, ox + sx, sy, 1, 1, '#9a9ca6');
  // saída de ar redonda no alto do painel
  disc(c, ox + 168, 130, 7, '#24262e');
  disc(c, ox + 168, 130, 6, '#101116');
  for (const dy of [-3, -1, 1, 3]) rect(c, ox + 163, 130 + dy, 10, 1, '#3e4250');
  rect(c, ox + 162, 125, 12, 1, '#7a7e8e');
  // três relógios pequenos no centro
  [0.5, 0.62, 0.4].forEach((f, i) => dial(c, ox + 148 + i * 15, 156, 6, ['', '', ''], f, { face: '#16161a', ink: '#e8e8e8', needle: '#ff4020', bezel: '#a8aab2' }));
  // chave de ignição vermelha
  disc(c, ox + 140, 178, 3, '#8a8c94');
  disc(c, ox + 140, 178, 2, '#3a3a40');
  c.strokeStyle = '#e02818';
  c.lineWidth = 3;
  c.beginPath();
  c.moveTo(ox + 141, 178);
  c.lineTo(ox + 150, 182);
  c.stroke();
  rect(c, ox + 146, 180, 4, 1, '#ff7a60');
  // alavanca de luzes à esquerda
  rect(c, ox + 2, 184, 18, 6, '#1a1b20');
  rect(c, ox + 4, 186, 3, 2, '#c8c8c8');
  rect(c, ox + 10, 186, 7, 2, '#5a5c64');
  // capota dos instrumentos (feltro) com nicho escuro
  c.fillStyle = dither(c, '#4a4e5c', '#525664');
  c.beginPath();
  c.roundRect(ox + 22, 126, 108, 50, [14, 14, 4, 4]);
  c.fill();
  rect(c, ox + 30, 126, 92, 1, '#6e7282');
  c.fillStyle = '#0c0d10';
  c.beginPath();
  c.roundRect(ox + 28, 134, 96, 40, [10, 10, 3, 3]);
  c.fill();
  shadow(c, ox + 76, 136, 50, 8, 0.8);
  // instrumentos
  const kmh = Math.round(r.speed * KMH);
  dial(c, ox + 54, 154, 15, ['', '', '120', '', '240', '', ''], kmh / 360, { face: '#dcd6c2', ink: '#1a1a1a', needle: '#e03010', digital: String(kmh) });
  dial(c, ox + 94, 152, 15, ['0', '', '40', '', '80', '', ''], 0.08 + Math.min(1, r.rpm) * 0.8, { face: '#a8301c', ink: '#f4dcb4', needle: '#f0f0f0', red: 0.75, gear: String(r.gear + 1) });
  dial(c, ox + 36, 168, 7, ['', '', ''], 0.55, { face: '#101012', ink: '#e8e8e8', needle: '#ff4020' });
  dial(c, ox + 116, 166, 6, ['', '', ''], 0.3 + r.rpm * 0.3, { face: '#101012', ink: '#e8e8e8', needle: '#ff4020' });
  // detector de radar preso no painel
  rect(c, ox + 200, 132, 30, 7, '#0c0c0e');
  radarLeds(c, ox + 202, 134, 26, r.radar);
  // câmbio: haste cromada e bola preta
  c.strokeStyle = '#c8ccd4';
  c.lineWidth = 2;
  c.beginPath();
  c.moveTo(ox + 214, h);
  c.lineTo(ox + 210, 194);
  c.stroke();
  rect(c, ox + 211, 196, 1, 28, '#ffffff');
  disc(c, ox + 210, 191, 6, '#0e0e10');
  disc(c, ox + 208, 189, 2, '#6a6a72');
  rect(c, ox + 207, 188, 1, 1, '#ffffff');
  // volante Momo: sombra no painel, 3 raios, cubo com emblema amarelo
  const cx = ox + 78, cy = 200, R = 60;
  shadow(c, cx + 8, cy - 6, R, R * 0.8, 0.35);
  vignette(c, 176);
  const wheelSpr = svgSprite(F40_WHEEL, R * 2, R * 2);
  if (wheelSpr) {
    withRotation(c, cx, cy, steerAngle(r, dt), () => c.drawImage(wheelSpr, cx - R, cy - R, R * 2, R * 2));
    return;
  }
  withRotation(c, cx, cy, steerAngle(r, dt), () => {
    for (const ang of [Math.PI * 1.03, -Math.PI * 0.04, Math.PI * 0.46]) spoke(c, cx, cy, ang, 10, R - 4, 5, 3.5, '#4a4b52', '#8a8c96');
    disc(c, cx, cy, 13, '#121216');
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2 + 0.5;
      rect(c, cx + Math.cos(a) * 10, cy + Math.sin(a) * 10, 1, 1, '#7a7c86');
    }
    disc(c, cx, cy, 8, '#8a6c08');
    disc(c, cx, cy, 7, '#f0c814');
    rect(c, cx - 1, cy - 3, 2, 6, '#1a1a1a');
    rect(c, cx - 4, cy - 5, 3, 1, '#fff6a8');
    leatherRim(c, cx, cy, R, 7);
  });
}

// ---------- 959 (fotos do carro real) ----------
// Painel de couro escuro, capota sobre 5 mostradores redondos (conta-giros no
// centro), ponteiros laranja, volante de aro grosso com almofada retangular,
// difusor horizontal, botões, rádio e coifa do câmbio.
// Painel do 959 a partir da foto convertida em pixel art: fundo (sem volante e sem
// ponteiros), ponteiros laranja dinâmicos nos mostradores da foto e volante da foto.
const P959 = {
  wheel: { sx: 60.5, sy: 69.2, x: 69.1, y: 52.6 }, // centro no sprite e no painel
  tach: [82, 25.4, 12.7], speed: [112.1, 27.2, 11.9], // x, y, raio (pixels nativos)
};

function photoNeedle(c: CanvasRenderingContext2D, cx: number, cy: number, r: number, frac: number) {
  const a = Math.PI * 0.75 + Math.PI * 1.5 * Math.max(0, Math.min(1.02, frac));
  c.strokeStyle = '#ff7a1a';
  c.lineWidth = 1.5;
  c.beginPath();
  c.moveTo(cx, cy);
  c.lineTo(cx + Math.cos(a) * (r - 2), cy + Math.sin(a) * (r - 2) * (8 / 7));
  c.stroke();
  disc(c, cx, cy, 1.5, '#202020');
}

function drawDash959Photo(c: CanvasRenderingContext2D, r: Race, dt: number): boolean {
  const { w } = view;
  const ox = coreX();
  const dash = svgSprite(dash959Png, CORE_W, 104);
  const wheelImg = svgSprite(wheel959Png, 121, 138);
  if (!dash || !wheelImg) return false;
  // laterais em telas largas: estica as bordas do painel
  if (ox > 0) {
    c.drawImage(dash, 0, 0, 12, 104, 0, 120, ox, 104);
    c.drawImage(dash, CORE_W - 12, 0, 12, 104, ox + CORE_W, 120, w - ox - CORE_W, 104);
  }
  c.drawImage(dash, ox, 120);
  const kmh = r.speed * KMH;
  const [tx, ty, tr] = P959.tach, [vx, vy, vr] = P959.speed;
  photoNeedle(c, ox + tx, 120 + ty, tr, 0.08 + Math.min(1, r.rpm) * 0.8);
  photoNeedle(c, ox + vx, 120 + vy, vr, kmh / 340);
  pix(c, String(r.gear + 1), ox + tx + 5, 120 + ty + 8, '#ff2a1a');
  rect(c, ox + 160, 121, 30, 6, '#0c0c0e');
  radarLeds(c, ox + 162, 122, 26, r.radar);
  const cx = ox + P959.wheel.x, cy = 120 + P959.wheel.y;
  withRotation(c, cx, cy, steerAngle(r, dt), () => c.drawImage(wheelImg, Math.round(cx - P959.wheel.sx), Math.round(cy - P959.wheel.sy)));
  return true;
}

function drawDash959(c: CanvasRenderingContext2D, r: Race, dt: number) {
  if (drawDash959Photo(c, r, dt)) return;
  const { w, h } = view;
  const ox = coreX();
  // capô prateado
  rect(c, 0, 120, w, 1, '#e8ecf0');
  rect(c, 0, 121, w, 2, '#a8acb4');
  // face superior do painel refletindo o céu → couro escuro
  const top = [['#6a6e78', '#727680'], ['#5a5e68', '#62666e'], ['#4a4d56', '#52555e'], ['#3c3f46', '#43464e']];
  top.forEach(([a, b], i) => rect(c, 0, 123 + i * 3, w, 3, dither(c, a, b)));
  rect(c, 0, 135, w, h - 135, speckle(c, '#2e3036', [['#34363d', 0.3], ['#26282d', 0.25]], 22));
  rect(c, 0, 135, w, 1, '#1a1b1f');
  // console central: difusor, botões e rádio
  rect(c, ox + 172, 138, 56, 16, '#16171b');
  for (let i = 0; i < 4; i++) rect(c, ox + 174, 140 + i * 3, 52, 1, '#5a5d66');
  rect(c, ox + 198, 138, 2, 16, '#26272c');
  rect(c, ox + 172, 138, 56, 1, '#7a7d86');
  for (let i = 0; i < 5; i++) {
    disc(c, ox + 176 + i * 11, 162, 3, '#202126');
    disc(c, ox + 176 + i * 11, 162, 2, i === 3 ? '#40c050' : '#4a4c54');
  }
  rect(c, ox + 172, 169, 52, 14, '#141518');
  rect(c, ox + 172, 169, 52, 1, '#8a8d96');
  rect(c, ox + 176, 172, 18, 4, '#3a2a10');
  rect(c, ox + 177, 173, 10, 2, '#e09030');
  for (let i = 0; i < 5; i++) rect(c, ox + 198 + i * 5, 173, 3, 6, '#3c3e46');
  rect(c, ox + 228, 135, w - ox - 228, 48, dither(c, '#34363c', '#3a3c42'));
  // coifa do câmbio
  c.fillStyle = '#1a1b1e';
  c.beginPath();
  c.moveTo(ox + 196, h);
  c.lineTo(ox + 202, 202);
  c.lineTo(ox + 218, 202);
  c.lineTo(ox + 224, h);
  c.closePath();
  c.fill();
  for (const fy of [208, 214, 220]) rect(c, ox + 200, fy, 22, 1, '#2c2d32');
  disc(c, ox + 210, 199, 5, '#101012');
  rect(c, ox + 208, 197, 2, 1, '#8a8a92');
  // capota sobre os mostradores
  c.fillStyle = dither(c, '#2a2c32', '#30323a');
  c.beginPath();
  c.roundRect(ox + 8, 128, 154, 42, [18, 18, 4, 4]);
  c.fill();
  rect(c, ox + 18, 128, 134, 1, '#5e616c');
  c.fillStyle = '#0b0b0e';
  c.beginPath();
  c.roundRect(ox + 12, 136, 146, 32, [12, 12, 3, 3]);
  c.fill();
  shadow(c, ox + 85, 138, 76, 7, 0.85);
  // 5 mostradores (estilo 911): conta-giros grande no centro
  const kmh = Math.round(r.speed * KMH);
  const o = { face: '#0e0e10', ink: '#ececec', needle: '#ff7a1a', bezel: '#5a5c62' };
  dial(c, ox + 28, 154, 11, ['', '', '', ''], 0.5, o);
  dial(c, ox + 55, 153, 12, ['', '', '', ''], 0.35 + r.rpm * 0.2, o);
  dial(c, ox + 85, 152, 15, ['', '', '2', '', '4', '', '6', '', '8'], 0.08 + Math.min(1, r.rpm) * 0.8, { ...o, red: 0.85, gear: String(r.gear + 1) });
  dial(c, ox + 116, 153, 13, ['', '', '100', '', '200', '', '300', ''], kmh / 340, { ...o, digital: String(kmh) });
  dial(c, ox + 144, 154, 11, ['', '', '', ''], 0.6, o);
  // detector de radar sobre o painel
  rect(c, ox + 172, 128, 30, 7, '#0c0c0e');
  radarLeds(c, ox + 174, 130, 26, r.radar);
  // volante: aro grosso, almofada retangular e braços laterais
  const cx = ox + 85, cy = 202, R = 66;
  shadow(c, cx + 8, cy - 8, R, R * 0.8, 0.4);
  vignette(c, 172);
  withRotation(c, cx, cy, steerAngle(r, dt), () => {
    // braços que ligam a almofada ao aro
    c.fillStyle = dither(c, '#202126', '#26272c');
    c.fillRect(cx - R + 4, cy - 14, 20, 14);
    c.fillRect(cx + R - 24, cy - 14, 20, 14);
    rect(c, cx - R + 4, cy - 14, 20, 1, '#5a5c66');
    rect(c, cx + R - 24, cy - 14, 20, 1, '#5a5c66');
    rect(c, cx + R - 22, cy - 11, 6, 4, '#0c0c0e');
    rect(c, cx + R - 21, cy - 10, 2, 1, '#d8d8d8');
    // almofada central
    c.fillStyle = '#16171a';
    c.beginPath();
    c.roundRect(cx - 42, cy - 22, 84, 30, 5);
    c.fill();
    c.fillStyle = dither(c, '#50535a', '#585b62');
    c.beginPath();
    c.roundRect(cx - 40, cy - 21, 80, 27, 4);
    c.fill();
    rect(c, cx - 36, cy - 21, 72, 1, '#8a8d96');
    rect(c, cx - 38, cy + 4, 76, 1, '#2a2b30');
    for (let i = 0; i < 7; i++) rect(c, cx - 21 + i * 6, cy - 9, 4, 3, '#5e6168');
    leatherRim(c, cx, cy, R, 10);
  });
}

// ---------- outros carros: painéis no estilo do jogo original ----------
// Preto com o alto cintilante (carros 'A') e cinza com faixa colorida (carros 'B').
function drawDashTD2Black(c: CanvasRenderingContext2D, r: Race, dt: number) {
  const { w, h } = view;
  const ox = coreX();
  rect(c, 0, 120, w, 5, '#b4b4c4');
  rect(c, 0, 125, w, 1, '#9595a4');
  rect(c, 0, 126, w, 1, '#7b7b8b');
  rect(c, 0, 127, w, h - 127, dither(c, '#121118', '#18171f'));
  c.fillStyle = speckle(c, '#16151c', [['#30303c', 0.22], ['#55556a', 0.08], ['#9a9aae', 0.015]], 14);
  c.beginPath();
  c.moveTo(0, 127);
  c.lineTo(w, 127);
  c.lineTo(w, 138);
  c.quadraticCurveTo(w / 2, 156, 0, 146);
  c.closePath();
  c.fill();
  rect(c, 0, 179, w, 2, '#0c0b10');
  rect(c, 0, 181, w, h - 181, dither(c, '#1a1a28', '#20202e'));
  const kmh = Math.round(r.speed * KMH);
  smallGauge(c, ox + 16, 166, 18, 0.55);
  smallGauge(c, ox + 52, 165, 16, 0.4 + r.rpm * 0.2);
  smallGauge(c, ox + 171, 163, 15, 0.6);
  c.fillStyle = '#c8c8d2';
  c.beginPath();
  c.roundRect(ox + 187, 131, 52, 51, 5);
  c.fill();
  c.fillStyle = speckle(c, '#18181e', [['#4a4a56', 0.22], ['#8a8a96', 0.1], ['#d0d0dc', 0.04]], 15);
  c.beginPath();
  c.roundRect(ox + 190, 134, 46, 45, 3);
  c.fill();
  text(c, 'RADAR', ox + 213, 137, 5, '#8a8a96', 'center', null);
  radarLeds(c, ox + 193, 172, 40, r.radar);
  const cx = ox + 100, cy = 203, R = 78;
  // nicho preto e mostradores fixos (só o volante gira)
  c.save();
  c.beginPath();
  c.rect(cx - R, 120, R * 2, 61);
  c.clip();
  disc(c, cx, cy, R - 12, '#07070b');
  c.restore();
  gauge(c, cx - 11, 162, 19, ['', '1', '2', '3', '4', '5', '6', '7', '8'], 0.1 + Math.min(1, r.rpm) * 0.8, 0.88, { gear: String(r.gear + 1) });
  gauge(c, cx + 26, 163, 19, ['0', '60', '120', '180', '240', '300', '360'], kmh / 360, 2, { digital: String(kmh) });
  turnTells(c, cx + 7.5, 176, r.signal);
  withRotation(c, cx, cy, steerAngle(r, dt), () => {
    c.fillStyle = speckle(c, '#1c1c26', [['#34344a', 0.25], ['#5a5a70', 0.06]], 16);
    c.beginPath();
    c.roundRect(cx - 43, 205, 91, 24, 6);
    c.fill();
    rect(c, cx - 40, 208, 85, 9, '#0e0e16');
    rim(c, cx, cy, R, 13, ['#24242e', '#2e2e3a'], '#8a8a9c');
  });
}

function drawDashTD2Grey(c: CanvasRenderingContext2D, r: Race, dt: number) {
  const { w, h } = view;
  const ox = coreX();
  const band = shade(r.car.hood, -0.35);
  rect(c, 0, 120, w, 1, shade(band, 0.35));
  rect(c, 0, 121, w, 9, dither(c, band, shade(band, 0.08)));
  rect(c, 0, 130, w, 2, shade(band, -0.2));
  rect(c, 0, 132, w, 5, '#141210');
  const greys = ['#b4b4b4', '#a6a6a6', '#989898', '#8a8a8a', '#7c7c7c', '#6e6e6e', '#606060'];
  for (let i = 0; i < greys.length - 1; i++) {
    const y0 = 137 + i * 13;
    rect(c, 0, y0, w, i === greys.length - 2 ? h - y0 : 13, dither(c, greys[i], greys[i + 1]));
  }
  for (const vx of [178, 245]) {
    c.fillStyle = '#5a5a5a';
    c.beginPath();
    c.ellipse(ox + vx, 146, 13, 4, 0, 0, Math.PI * 2);
    c.fill();
    rect(c, ox + vx - 9, 142, 18, 1, '#c8c8c8');
  }
  rect(c, ox + 200, 131, 32, 7, '#0c0c0c');
  radarLeds(c, ox + 202, 133, 28, r.radar);
  smallGauge(c, ox + 190, 198, 11, 0.5);
  smallGauge(c, ox + 250, 198, 11, 0.62);
  rect(c, ox + 206, 173, 32, 42, '#1e1e1e');
  rect(c, ox + 209, 176, 26, 36, dither(c, '#c4c4c4', '#d2d2d2'));
  for (const gx of [214, 221, 228]) rect(c, ox + gx, 184, 2, 24, '#3a3a3a');
  rect(c, ox + 214, 195, 16, 2, '#3a3a3a');
  const pos = [[215, 186], [215, 206], [222, 186], [222, 206], [229, 186]][r.gear];
  disc(c, ox + pos[0], pos[1] - 3, 6, '#9a9aa2');
  disc(c, ox + pos[0] - 2, pos[1] - 5, 2, '#ffffff');
  // nicho preto e mostradores fixos
  const wx = ox + 10, wy = 121, ww = 150, wh = 140, wr = 60, th = 15;
  c.fillStyle = '#080808';
  c.beginPath();
  c.roundRect(wx + th, wy + th, ww - th * 2, wh - th * 2, wr - th);
  c.fill();
  const cx = ox + 85;
  const kmh = Math.round(r.speed * KMH);
  gauge(c, cx - 21, 160, 22, ['0', '80', '160', '240', '320'], kmh / 360, 2, { digital: String(kmh), ring: '#3a3a3a' });
  gauge(c, cx + 23, 160, 22, ['0', '20', '40', '60', '80', '100'], 0.1 + Math.min(1, r.rpm) * 0.8, 0.78, { gear: String(r.gear + 1), ring: '#3a3a3a' });
  turnTells(c, cx + 1, 178, r.signal);
  withRotation(c, cx, 198, steerAngle(r, dt), () => {
    // aro em "D" (anel: contorno externo menos o interno)
    c.fillStyle = dither(c, '#2a2a2a', '#343434');
    c.beginPath();
    c.roundRect(wx, wy, ww, wh, wr);
    c.roundRect(wx + th, wy + th, ww - th * 2, wh - th * 2, wr - th);
    c.fill('evenodd');
    rect(c, wx + wr - 8, wy, ww - 2 * (wr - 8), 1, '#8e8e8e');
    c.strokeStyle = dither(c, '#202020', '#2c2c2c');
    c.lineWidth = 7;
    c.beginPath();
    c.moveTo(cx - 67, 192);
    c.quadraticCurveTo(cx, 180, cx + 67, 192);
    c.stroke();
    c.fillStyle = '#121212';
    c.beginPath();
    c.ellipse(cx, 207, 17, 14, 0, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#f0d018';
    c.beginPath();
    c.ellipse(cx, 207, 9, 7, 0, 0, Math.PI * 2);
    c.fill();
    disc(c, cx, wy + 6, 3, '#f0d020');
  });
}

// Aro com textura no estilo do jogo original
function rim(c: CanvasRenderingContext2D, cx: number, cy: number, R: number, thick: number, base: [string, string], hi: string) {
  const mid = R - thick / 2;
  c.strokeStyle = dither(c, base[0], base[1]);
  c.lineWidth = thick;
  c.beginPath();
  c.arc(cx, cy, mid, 0, Math.PI * 2);
  c.stroke();
  c.strokeStyle = hi;
  c.lineWidth = 1;
  c.beginPath();
  c.arc(cx, cy, R - 0.5, Math.PI * 1.12, Math.PI * 1.68);
  c.stroke();
  disc(c, cx, cy - R + thick * 0.4, 3, '#f0d020');
}

// Papel da multa mostrado pelo policial
function drawFine(c: CanvasRenderingContext2D, r: Race, vp: Viewport) {
  const f = r.fine!;
  const t = r.officer!.t;
  const pw = 150, ph = 86;
  const px = vp.x + vp.w / 2 - pw / 2 - 16;
  const py = vp.y + 5 + (1 - Math.min(1, t * 3)) * 80;
  c.save();
  c.translate(px + pw / 2, py + ph / 2);
  c.rotate(-0.04);
  c.translate(-pw / 2, -ph / 2);
  c.fillStyle = 'rgba(0,0,0,0.35)';
  c.fillRect(3, 3, pw, ph);
  c.fillStyle = '#f6f2e6';
  c.fillRect(0, 0, pw, ph);
  c.fillStyle = '#1c2a6a';
  c.fillRect(0, 0, pw, 14);
  text(c, 'POLÍCIA RODOVIÁRIA', pw / 2, 4, 5, '#fff', 'center', null);
  text(c, 'AUTO DE INFRAÇÃO', pw / 2, 20, 8, '#1c1c1c', 'center', null);
  c.fillStyle = '#c8c0a8';
  c.fillRect(8, 31, pw - 16, 1);
  text(c, `VELOCIDADE: ${f.kmh} KM/H`, 10, 36, 5, '#1c1c1c', 'left', null);
  text(c, `LIMITE DA VIA: ${f.limit} KM/H`, 10, 45, 5, '#1c1c1c', 'left', null);
  text(c, 'MULTA', 10, 58, 8, '#1c1c1c', 'left', null);
  text(c, `$ ${f.value}`, pw - 10, 58, 8, '#c01818', 'right', null);
  c.strokeStyle = '#1c2a6a';
  c.lineWidth = 1;
  c.beginPath();
  for (let i = 0; i <= 20; i++) c.lineTo(pw - 70 + i * 3, 74 + Math.sin(i * 1.3) * 3);
  c.stroke();
  c.fillStyle = '#c8c0a8';
  c.fillRect(pw - 72, 79, 62, 1);
  // mão do policial
  c.fillStyle = '#e0b088';
  c.fillRect(-10, ph - 34, 18, 22);
  c.fillStyle = '#5a7ac8';
  c.fillRect(-26, ph - 30, 18, 30);
  c.restore();
  if (t > 1.2 && Math.floor(t * 2) % 2) text(c, 'ACELERE PARA SEGUIR', vp.x + vp.w * 0.8, vp.y + vp.h / 2, 5, '#ffd400', 'center');
}
