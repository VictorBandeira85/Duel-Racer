import { DASH_Y, KMH, ROOF_H, view } from './config';
import type { Race } from './race';
import { renderMirror, renderRoad, type Viewport } from './render3d';
import { pix, pix7, pix7Width, pixWidth } from './pixfont';
import { dither, speckle, text } from './ui';
import { clamp, formatTime, lerp, rng, shade } from './util';
import { F40_WHEEL } from './svg/f40';
import { spriteAspect, svgSprite } from './svgsprites';
import { drawWipers, type DashTop } from './wipers';
import { drawSideMirror, findGlass } from './sidemirror';
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

interface CockpitArt {
  dash: string;
  top: string; // coluna da porta prolongada até o teto (76 linhas acima da arte)
  wheel: string;
  dashMask?: string; // partes na cor do carro (capô, porta, colunas), para a repintura
  topMask?: string;
  radar?: [number, number]; // canto do detector de radar no painel (padrão 206, 22)
  wheelDx?: number; // desloca o volante para a direita (alinha com o quadro de instrumentos)
  pivot: [number, number]; // centro do aro (pixels nativos, a partir do topo da arte)
  tach?: Dial;
  speed?: Dial;
  lcd?: boolean; // painel digital (Corvette C4): visores desenhados por lcdPanel
  odo?: Box; // hodômetro (viatura): quilometragem andando de verdade
  prnd?: Box; // indicador da alavanca P R N D 2 1 (viatura)
  speedMax: number;
  needle: string;
  hub: string;
  aux: Aux[];
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
}

// Mostradores auxiliares, também redesenhados: 'single' (um ponteiro), 'dual' (dois
// ponteiros no mesmo eixo, em V), 'twin' (dois eixos lado a lado) e 'clock' (relógio)
// oil = pressão do óleo, boost = pressão do turbo, volt = voltímetro
type Gauge = 'oil' | 'water' | 'oiltemp' | 'fuel' | 'boost' | 'volt';
interface Aux { x: number; y: number; r: number; kind: 'single' | 'dual' | 'twin' | 'clock' | 'combo'; show?: Gauge[]; icon?: keyof typeof ICONS; labels?: string[] }

// a arte cobre da linha 100 da tela até o fim (124 linhas); o topo transparente mostra a estrada
const ART_TOP = 100;
const DASH_PAD = 102; // colunas extras de cada lado do painel (telas largas), ver import_cockpit.py
const DASH_W = 256 + 2 * DASH_PAD;
const TOP_EXT = 76; // linhas do teto (24) até o topo da arte
const CPNG = import.meta.glob('./assets/cockpit/*.png', { eager: true, import: 'default' }) as Record<string, string>;
function cp(n: string) {
  return CPNG[`./assets/cockpit/${n}.png`];
}
const COCKPIT_ART: Record<string, CockpitArt> = {
  f40: { dash: dashF40Png, top: topF40Png, wheel: wheelF40Png, dashMask: cp('f40-dash-mask'), topMask: cp('f40-top-mask'), pivot: [127.4, 80], 
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
  '959': { dash: dash959Png, top: top959Png, wheel: wheel959Png, pivot: [128.2, 84.3],
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
  pivot: [128.2, 103.1], speedMax: 240, needle: '#ff2a1a', hub: '#1a1a1c', aux: [],
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
  dash: cp('diablo-dash'), top: cp('diablo-top'), wheel: cp('diablo-wheel'),
  pivot: [128, 103], wheelDx: 10, radar: [196, 6], speedMax: 360, needle: '#ff7a1a', hub: '#1a1a1c',
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

// Corvette C4: arte do Victor com os visores de LCD redesenhados funcionando
COCKPIT_ART.zr1 = {
  dash: cp('zr1-dash'), top: cp('zr1-top'), wheel: cp('zr1-wheel'),
  pivot: [128, 86], lcd: true, speedMax: 300, needle: '#ff3a1a', hub: '#26262a', aux: [],
};

for (const [k, v] of Object.entries(INTERIORS)) {
  const dials = v.dials as Dial[];
  COCKPIT_ART[k] = {
    dash: cp(`${k}-dash`), top: cp(`${k}-top`), wheel: cp(`${k}-wheel`),
    dashMask: cp(`${k}-dash-mask`), topMask: cp(`${k}-top-mask`),
    pivot: v.pivot as [number, number],
    tach: dials.find((d) => d.max <= 10)!, speed: dials.find((d) => d.max > 10)!,
    speedMax: v.speedMax, needle: '#ff3a1a', hub: '#26262a', aux: v.aux as Aux[],
  };
}

export const COCKPIT_IMAGES = Object.values(COCKPIT_ART).flatMap((a) => [a.dash, a.top, a.wheel, a.dashMask, a.topMask]).filter((s): s is string => !!s);

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
  }
  // retrovisor externo esquerdo funcionando (onde a arte mostra o vidro dele)
  const glass = findGlass(art.dash, svgSprite(art.top, DASH_W, TOP_EXT), svgSprite(art.dash, DASH_W, 124) ?? dash, DASH_PAD + 90);
  if (glass) drawSideMirror(c, r, glass, dx, ART_TOP, color ?? r.car.color);
  if (art.lcd) lcdPanel(c, ox, r, art);
  if (art.odo) odometer(c, ox, r, art.odo);
  if (art.prnd) leverIndicator(c, ox, r, art.prnd);
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
  signalArrows(c, ox + rx, ART_TOP + ry, 30, r.signal);
  const wdx = art.wheelDx ?? 0;
  const px = ox + wdx + art.pivot[0], py = ART_TOP + art.pivot[1];
  withRotation(c, px, py, steerAngle(r, dt), () => c.drawImage(wheelImg, ox + wdx, ART_TOP));
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
  c.fillStyle = '#050506';
  for (let dy = -Math.floor(ry); dy <= Math.min(Math.floor(ry), d.cut ?? 99); dy++) {
    const hw = Math.round(r * Math.sqrt(Math.max(0, 1 - (dy / ry) ** 2)));
    c.fillRect(cx - hw, cy + dy, hw * 2 + 1, 1);
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
    c.fillStyle = '#d81818';
    for (let a = fr(d.red); a <= a0 + sweep + 0.001; a += 0.02)
      for (const k of [0.75, 1.25, 1.75, 2.25]) half(...at(a, r - k));
  }
  // marcações: traço de 1,5 px nos números, meio pixel no meio (resolução interna 2x)
  for (let v = 0; v <= d.max + 1e-6; v += d.tick) {
    const major = d.labels.some((l) => Math.abs(l - v) < 1e-6);
    c.fillStyle = v >= d.red ? '#ffd0d0' : '#ececec';
    half(...at(fr(v), r - 0.75));
    if (major) for (const k of [1.25, 1.75]) half(...at(fr(v), r - k));
  }
  for (const v of d.minor ?? []) {
    const l = String(v), a = fr(v);
    const [lx, ly] = at(a, r - 2.6 - Math.abs(Math.cos(a)) * pixWidth(l, 0.5) * 0.5 - Math.abs(Math.sin(a)) * 1.3);
    pix(c, l, lx, ly, '#b8b8b8', 0.5);
  }
  for (const v of d.labels) {
    const l = String(Math.round(v * (d.labelMul ?? 1)));
    // recua do aro só o quanto o número ocupa na direção do centro (largura nas laterais,
    // altura no alto), para os de cima não se encostarem
    const a = fr(v);
    const ls = d.labelScale ?? 0.5;
    const col = v >= d.red && d.redLabels !== false ? '#ff5a4a' : '#f2f2f2';
    if (ls === 0.7) {  // fonte 5x7 em meio pixel (tamanho intermediário)
      const [lx, ly] = at(a, r - 2.8 - Math.abs(Math.cos(a)) * pix7Width(l, true) * 0.55 - Math.abs(Math.sin(a)) * 1.9);
      const [nx, ny] = d.nudge?.[v] ?? [0, 0];
      pix7(c, l, lx + nx, ly + ny, col, true);
      continue;
    }
    const [lx, ly] = at(a, r - (ls > 0.5 ? 3.2 : 2.7) - (Math.abs(Math.cos(a)) * pixWidth(l, ls) * 0.5 + Math.abs(Math.sin(a)) * 2.5 * ls) * (ls > 0.5 ? 1.3 : 1) - (ls > 0.5 ? 0.6 : 0));
    pix(c, l, lx, ly, col, ls);
  }
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
  c.fillStyle = art.needle;
  for (let t = 0; t <= len; t += 0.25) {
    const x = Math.round((cx + 0.5 + ca * t) * 2) / 2, y = Math.round((cy + 0.5 + sa * t) * 2) / 2;
    c.fillRect(x - 0.5, y - 0.5, 1, 1);
  }
  c.fillStyle = art.hub;
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
function drawIcon(c: CanvasRenderingContext2D, name: keyof typeof ICONS, cx: number, top: number) {
  const ic = ICONS[name];
  const x0 = Math.round((cx - 3.25) * 2) / 2, y0 = Math.round(top * 2) / 2;
  c.fillStyle = '#f4f4f4';
  ic.forEach((row, j) => [...row].forEach((ch, i) => ch === '1' && c.fillRect(x0 + i * 0.5, y0 + j * 0.5, 0.5, 0.5)));
}

// fundo preto do mostrador, por linhas (centro no meio do pixel cx, cy)
function face(c: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  const ry = r * PIX_Y;
  c.fillStyle = '#050506';
  for (let dy = -Math.floor(ry); dy <= Math.floor(ry); dy++) {
    const hw = Math.round(r * Math.sqrt(Math.max(0, 1 - (dy / ry) ** 2)));
    c.fillRect(cx - hw, cy + dy, hw * 2 + 1, 1);
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
  gauges.water = 0.3 + 0.25 * Math.min(1, r.time / 40);
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
    // arco de cima, da esquerda (frio/baixo) para a direita
    const a0 = PI * 0.95, a1 = PI * 2.05;
    ticks(mx, my, R - 0.75, a0, a1, 4);
    // números nas pontas e no meio (água 60/90/120, turbo 0/0,8/1,5 da F40)
    g.labels?.forEach((l, i) => {
      const a = a0 + ((a1 - a0) * i) / (g.labels!.length - 1);
      pix(c, l, ...at(mx, my, a, R - 2.6 - Math.abs(Math.cos(a)) * pixWidth(l, 0.5) * 0.45), '#f2f2f2', 0.5);
    });
    hand(c, mx, my, a0 + (a1 - a0) * val(k1), R - 1.5, art.needle);
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
  seg7Number(c, ox + 110, ART_TOP + 59, kmh, 3, LCD.yellow, LCD.yellowOff);
  // conta-giros: arco verde/amarelo/vermelho e giro em centenas (46 = 4.600 rpm)
  const tachArc = { x: 226, y: 86, r0: 31, r1: 37, a0: Math.PI * 1.2, a1: Math.PI * 1.49, n: 18 };
  drawArc(c, ox, tachArc, rpm, (f) => (f < 0.7 ? [LCD.green, LCD.greenOff] : f < 0.85 ? [LCD.yellow, LCD.yellowOff] : [LCD.red, LCD.redOff]));
  seg7Number(c, ox + 218, ART_TOP + 59, rpm * 70, 2, LCD.yellow, LCD.yellowOff);
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

// luzes-espia do pisca, verdes, dos dois lados do radar
function signalArrows(c: CanvasRenderingContext2D, x: number, y: number, w: number, signal: number) {
  const lit = signal !== 0 && blinkOn();
  for (const side of [-1, 1]) {
    const on = lit && side === signal;
    const ax = side < 0 ? x - 6 : x + w + 1.5; // ponta da seta para fora
    c.fillStyle = '#0c0c0e';
    c.fillRect(ax - 0.5, y - 0.5, 5.5, 7);
    c.fillStyle = on ? '#38f048' : '#123a18';
    for (let i = 0; i < 3; i++) {
      const hw = 1 + i; // largura da coluna (triângulo)
      const cx = side < 0 ? ax + 0.5 + i * 1.5 : ax + 3.5 - i * 1.5;
      c.fillRect(cx, y + 3 - hw + 0.5, 1.5, hw * 2 - 1);
    }
  }
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

function weather(c: CanvasRenderingContext2D, r: Race, vp: Viewport, dt: number) {
  const w = r.def.weather;
  if (!w) return;
  const n = w === 'rain' ? 70 : 60;
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
      dashTops.set(art.dash, col);
    }
  }
  const dx = coreX() - DASH_PAD;
  return (x) => (col ? ART_TOP + col[Math.max(0, Math.min(col.length - 1, x - dx))] : DASH_Y);
}

export function renderCockpit(c: CanvasRenderingContext2D, r: Race, lives: number, stageLabel: string, totalTime: number, dt: number) {
  const { w } = view;
  const vp = windshield();
  const art = COCKPIT_ART[r.car.dash];
  // nas cabines desenhadas, os vidros laterais vão abaixo do painel: a estrada desce até o fim
  renderRoad(c, r, art ? { ...vp, h: view.h - vp.y } : vp);
  weather(c, r, vp, dt);
  drawWipers(c, r, vp, dt, dashTopFn(art), coreX());
  if (r.state === 'crash') {
    const t = 2.6 - r.timer;
    drawCracks(c, r, vp, 1);
    if (t > 1.3) {
      c.fillStyle = `rgba(0,0,0,${Math.min(0.75, (t - 1.3) * 0.8)})`;
      c.fillRect(vp.x, vp.y, vp.w, vp.h);
      text(c, 'BATIDA!', w / 2, vp.y + 26, 16, '#ff4040', 'center');
      text(c, `Carros restantes: ${Math.max(0, lives - 1)}`, w / 2, vp.y + 54, 8, '#fff', 'center');
    }
  }
  drawRoof(c, r, stageLabel, totalTime);
  const dash = r.car.dash;
  if (art && drawCockpitArt(c, r, dt, art)) {
    // cabine desenhada a partir da arte
  } else if (dash === 'f40') drawDashF40(c, r, dt);
  else if (dash === '959') drawDash959(c, r, dt);
  else if (dash === 'A') drawDashTD2Black(c, r, dt);
  else drawDashTD2Grey(c, r, dt);

  if (r.state === 'countdown') {
    const n = Math.ceil(r.timer);
    text(c, n > 3 ? 'PRONTO?' : String(n), w / 2, vp.y + 28, 16, '#ffd400', 'center');
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
  // marcadores de progresso na faixa inferior
  const px = ox + 44, pw = 126;
  const mark = (z: number, color: string) => {
    const p = Math.max(0, Math.min(1, (z - r.track.startZ) / (r.track.finishZ - r.track.startZ)));
    c.fillStyle = color;
    c.fillRect(Math.round(px + pw * p) - 2, 19, 5, 3);
  };
  c.fillStyle = '#e8e8e8';
  c.fillRect(px + pw + 2, 18, 2, 5);
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
