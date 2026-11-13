// Fundos panorâmicos em pixel art, gerados pixel a pixel (prédios com janelas,
// mata, montanhas rochosas...), no estilo dos jogos de 16 bits. Cada camada é
// gerada uma vez por tema e reaproveitada.
import type { BgLayer } from './themes';
import { rng } from './util';

export const PANO_W = 1024;
export const PANO_H = 64;

type RGB = [number, number, number];
const hex = (h: string): RGB => {
  const n = parseInt(h.slice(1), 16);
  return [n >> 16, (n >> 8) & 255, n & 255];
};
const dim = (c: RGB, k: number): RGB => [c[0] * k, c[1] * k, c[2] * k];

class Img {
  data: ImageData;
  constructor(public w: number, public h: number) {
    this.data = new ImageData(w, h);
  }
  set(x: number, y: number, c: RGB) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = (y * this.w + x) * 4;
    const d = this.data.data;
    d[i] = c[0];
    d[i + 1] = c[1];
    d[i + 2] = c[2];
    d[i + 3] = 255;
  }
  filled(x: number, y: number) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return false;
    return this.data.data[(y * this.w + x) * 4 + 3] > 0;
  }
}


// tom com pontilhado ordenado (Bayer 4x4): v contínuo entre 0 e n-1 escolhe dois tons vizinhos
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
function tone(pal: RGB[], v: number, x: number, y: number): RGB {
  const vv = Math.max(0, Math.min(pal.length - 1, v));
  const i = Math.floor(vv), f = vv - i;
  if (i >= pal.length - 1) return pal[pal.length - 1];
  return f * 16 > BAYER[(y & 3) * 4 + (x & 3)] + 0.5 ? pal[i + 1] : pal[i];
}
// encosta iluminada pela esquerda: subindo para a direita a face olha para a luz
const lightOf = (h: Float32Array, x: number) => {
  const a = h[(x - 2 + PANO_W) % PANO_W], b = h[(x + 2) % PANO_W];
  return Math.max(-1, Math.min(1, (b - a) * 0.35));
};

// alturas suaves e periódicas (o panorama se repete sem emenda)
function wave(x: number, parts: [number, number, number][]) {
  let v = 0;
  for (const [amp, freq, phase] of parts) v += amp * Math.sin((x / PANO_W) * Math.PI * 2 * freq + phase);
  return v;
}

function city(img: Img, rand: () => number, night: boolean) {
  const pal = ['#3a3a6a', '#56568a', '#6a4a7a', '#8a7aa0', '#2a2a4a', '#b0a080', '#7a8ab0', '#c8c8d8'].map(hex);
  let x = 0;
  while (x < PANO_W) {
    // trechos sem prédios, onde a mata de trás aparece (como no original)
    if (rand() < 0.025) {
      x += 30 + Math.floor(rand() * 70);
      continue;
    }
    const bw = 4 + Math.floor(rand() * 10);
    const tall = rand() < 0.12;
    const bh = Math.min(PANO_H - 4, Math.floor(5 + Math.pow(rand(), 1.3) * (tall ? 30 : 20)));
    let col = pal[Math.floor(rand() * pal.length)];
    if (night) col = dim(col, 0.35);
    const top = PANO_H - bh;
    for (let yy = top; yy < PANO_H; yy++) {
      for (let xx = x; xx < x + bw; xx++) {
        let c = col;
        if (xx === x) c = dim(col, 1.15);
        else if (xx === x + bw - 1) c = dim(col, 0.75);
        img.set(xx, yy, c);
      }
    }
    // janelas
    for (let yy = top + 2; yy < PANO_H - 2; yy += 3) {
      for (let xx = x + 1; xx < x + bw - 1; xx += 2) {
        const lit = night ? (rand() < 0.45 ? hex('#ffd86b') : hex('#20203a')) : rand() < 0.8 ? hex('#d4d4ec') : dim(col, 0.6);
        img.set(xx, yy, lit);
      }
    }
    if (tall && rand() < 0.6) for (let k = 1; k < 4 + rand() * 5; k++) img.set(x + (bw >> 1), top - k, dim(col, 0.6));
    // chaminés de fábrica
    if (rand() < 0.05) {
      const ch = 18 + Math.floor(rand() * 22);
      for (let k = 0; k < 3; k++) {
        const cx = x + bw + 2 + k * 5;
        for (let yy = PANO_H - ch; yy < PANO_H; yy++) {
          img.set(cx, yy, night ? hex('#1a2238') : hex('#3a4a7a'));
          img.set(cx + 1, yy, night ? hex('#141a2c') : hex('#2a3a64'));
        }
      }
      x += 16;
    }
    x += bw - (rand() < 0.4 ? 1 : 0);
  }
}

// paletas da mata: [escuro, médio, claro] de dia
const FOREST_PAL: Record<string, [string, string, string]> = {
  forest: ['#0c4a12', '#1a6a1c', '#2e8a2a'],
  jungle: ['#08401a', '#127a2a', '#38a83a'],
  autumn: ['#6a2a10', '#b8521a', '#e89a2a'],
};
function forest(img: Img, rand: () => number, night: boolean, base: number, pal = FOREST_PAL.forest, snowy = false) {
  const nt = (c: string) => (night ? dim(hex(c), 0.42) : hex(c));
  const dark = nt(pal[0]);
  const mid = nt(pal[1]);
  const light = nt(pal[2]);
  const heights = new Float32Array(PANO_W);
  for (let x = 0; x < PANO_W; x++) heights[x] = base + wave(x, [[3, 3, 0.5], [2, 7, 1.3]]);
  // copas redondas e pinheiros pontudos
  for (let x = 0; x < PANO_W; x += 2 + Math.floor(rand() * 4)) {
    const r = 2 + rand() * 4;
    const h = base + 3 + rand() * 9;
    const pine = rand() < 0.35;
    for (let dx = -r * 1.5; dx <= r * 1.5; dx++) {
      const xx = ((Math.round(x + dx) % PANO_W) + PANO_W) % PANO_W;
      const top = pine ? h + 4 - Math.abs(dx) * 1.6 : h - r + Math.sqrt(Math.max(0, r * r - dx * dx));
      heights[xx] = Math.max(heights[xx], top);
    }
  }
  // cada copa com luz à esquerda e sombra à direita, mata mais escura embaixo
  const shadeP = [dim(dark, 0.7), dark, mid, light, dim(light, 1.18)];
  for (let x = 0; x < PANO_W; x++) {
    const top = Math.floor(PANO_H - heights[x]);
    const L = lightOf(heights, x);
    for (let y = Math.max(0, top); y < PANO_H; y++) {
      const depth = y - top;
      let v = depth < 2 ? 2.6 + L * 1.5 : depth < 6 ? 1.6 + L * 1.2 : 1 - depth * 0.02;
      if (rand() < 0.1) v += 0.8;
      let c = tone(shadeP, v, x, y);
      // mata nevada: as copas ficam brancas e a neve salpica o meio
      if (snowy && (depth < 2 || (depth < 6 && rand() < 0.3))) c = hex(night ? '#8a94a8' : (x + y) % 3 ? '#f2f6fa' : '#d0dcea');
      img.set(x, y, c);
    }
  }
}

function rocks(img: Img, rand: () => number, night: boolean, red = false) {
  // mesas e penhascos em camadas (estratos), face iluminada à esquerda e sombra à direita
  const P = red ? ['#4e1c10', '#7a2e1a', '#a8482a', '#c8663a', '#e89a62'] : ['#24343e', '#344e5c', '#4a6878', '#6e8e9e', '#9ab4c0'];
  const pal = P.map((c) => (night ? dim(hex(c), 0.45) : hex(c)));
  const h = new Float32Array(PANO_W);
  for (let x = 0; x < PANO_W; x++) {
    const ridge = 26 + wave(x, [[10, 2, 0.3], [7, 5, 2.1], [4, 11, 0.7], [2, 23, 1.9]]);
    const cliff = Math.abs(wave(x, [[1, 9, 0.4]])) > 0.75 ? 6 : 0;
    h[x] = Math.max(4, Math.min(PANO_H - 2, ridge + cliff));
  }
  const strata = Array.from({ length: 12 }, () => rand());
  for (let x = 0; x < PANO_W; x++) {
    const top = Math.floor(PANO_H - h[x]);
    const L = lightOf(h, x);
    for (let y = top; y < PANO_H; y++) {
      const d = y - top;
      let v = 2 + L * 1.6 - d * 0.035;
      const band = strata[Math.floor((y + Math.sin(x * 0.03) * 2) / 5) % 12];
      if (band > 0.7) v += 0.6; else if (band < 0.25) v -= 0.6;
      if (d < 1) v = Math.max(v, 3.4);
      img.set(x, y, tone(pal, v, x, y));
    }
  }
}

function hills(img: Img, rand: () => number, night: boolean, dry = false) {
  // colinas com luz pela encosta, crista clara e o pé mais escuro (perspectiva aérea)
  const P = dry ? ['#6a5a22', '#8a7a32', '#a8963e', '#c8b45a', '#e4d482'] : ['#0e4a16', '#1a6420', '#2a7e2c', '#46a03e', '#78c25a'];
  const pal = P.map((c) => (night ? dim(hex(c), 0.42) : hex(c)));
  const h = new Float32Array(PANO_W);
  for (let x = 0; x < PANO_W; x++) h[x] = 14 + wave(x, [[7, 2, 1.1], [4, 5, 0.2], [2, 9, 2.5]]);
  for (let x = 0; x < PANO_W; x++) {
    const top = Math.floor(PANO_H - h[x]);
    const L = lightOf(h, x);
    for (let y = top; y < PANO_H; y++) {
      const d = y - top;
      let v = 2.2 + L * 1.8 - d * 0.06;
      if (d < 1) v = 3.6;
      if (rand() < 0.04) v += 1; // moitas e pedras soltas
      img.set(x, y, tone(pal, v, x, y));
    }
  }
}

function snowpeaks(img: Img, rand: () => number, night: boolean, tall = 1, deep = false) {
  // picos com a face esquerda ao sol e a direita na sombra azulada; neve no alto com borda serrilhada
  const R = (night ? ['#1a2030', '#262e3e', '#3a4458', '#4c5870'] : ['#3e4a62', '#5a6680', '#7e8aa2', '#a2aec4']).map(hex);
  const S = (night ? ['#5a6478', '#7a8498', '#9aa4b8', '#b0bacc'] : ['#9aaccc', '#c4d2e6', '#e6eef8', '#ffffff']).map(hex);
  const h = new Float32Array(PANO_W);
  for (let x = 0; x < PANO_W; x++) {
    const p = Math.abs(((x / 64) % 2) - 1);
    const peak = (1 - p) * (24 + 18 * Math.abs(Math.sin(Math.floor(x / 128) * 2.3))) * tall;
    h[x] = Math.min(PANO_H - 1, Math.max(6, 10 + peak + wave(x, [[2, 17, 0.4], [1, 41, 1.2]])));
  }
  const jag = Array.from({ length: PANO_W }, () => (rand() - 0.5) * 0.1);
  for (let x = 0; x < PANO_W; x++) {
    const top = Math.floor(PANO_H - h[x]);
    const L = lightOf(h, x);
    const snowLine = (deep ? 0.75 : 0.3) + jag[x] + Math.sin(x * 0.4) * 0.03;
    for (let y = top; y < PANO_H; y++) {
      const rel = (y - top) / h[x];
      const gully = Math.sin(x * 0.55 + y * 0.9) > 0.85; // sulcos descendo a encosta
      if (rel < snowLine && h[x] > (deep ? 8 : 22) && !gully) img.set(x, y, tone(S, 1.6 + L * 1.5 - rel * 1.2, x, y));
      else img.set(x, y, tone(R, 1.6 + L * 1.4 - rel * 0.6 - (gully ? 0.8 : 0), x, y));
    }
  }
}

function dunes(img: Img, rand: () => number, night: boolean) {
  const pal = (night ? ['#2e2414', '#3e3020', '#4a3a22', '#5a4628', '#6a5432'] : ['#9a7038', '#b48848', '#c49a58', '#d8b070', '#f0cc90']).map(hex);
  const h = new Float32Array(PANO_W);
  for (let x = 0; x < PANO_W; x++) h[x] = 8 + wave(x, [[3, 3, 0.4], [2, 8, 1.7], [1, 19, 0.6]]);
  for (let x = 0; x < PANO_W; x++) {
    const top = Math.floor(PANO_H - h[x]);
    const L = lightOf(h, x) * 2;
    for (let y = top; y < PANO_H; y++) {
      const d = y - top;
      const ripple = Math.sin(x * 0.7 + y * 2.1) > 0.92 ? -0.7 : 0; // marcas do vento
      img.set(x, y, tone(pal, (d < 1 ? 3.5 : 2 + L * 1.5 - d * 0.08) + ripple, x, y));
    }
  }
}

function sea(img: Img, rand: () => number, night: boolean) {
  // mar em faixas: escuro no horizonte, ondas brancas e reflexos cintilando perto da praia
  const pal = (night ? ['#081430', '#0c1c3a', '#14284e', '#1c3058', '#2a4270'] : ['#14468e', '#1f5eb8', '#2e74cc', '#4a92e0', '#9ac8f4']).map(hex);
  for (let x = 0; x < PANO_W; x++) {
    for (let y = PANO_H - 7; y < PANO_H; y++) {
      const d = y - (PANO_H - 7);
      let v = 0.6 + d * 0.35;
      const crest = Math.sin(x * 0.21 + d * 1.7 + Math.sin(x * 0.03) * 3);
      if (crest > 0.93) v = 4;
      else if (crest > 0.8) v += 1;
      if (rand() < 0.02) v = 4;
      img.set(x, y, tone(pal, v, x, y));
    }
  }
}

// savana: colinas secas com acácias de copa achatada em silhueta
function savanna(img: Img, rand: () => number, night: boolean) {
  hills(img, rand, night, true);
  const tree = hex(night ? '#141a0c' : '#3a4a1a');
  for (let x = 10; x < PANO_W; x += 40 + Math.floor(rand() * 70)) {
    const base = Math.floor(PANO_H - (14 + wave(x, [[7, 2, 1.1], [4, 5, 0.2], [2, 9, 2.5]]))) + 1;
    const th = 4 + Math.floor(rand() * 4), cw = 5 + Math.floor(rand() * 5);
    for (let y = base - th; y < base; y++) img.set(x, y, tree);
    for (let dx = -cw; dx <= cw; dx++) {
      img.set(x + dx, base - th, tree);
      if (Math.abs(dx) < cw - 1) img.set(x + dx, base - th - 1, tree);
    }
  }
}

// polo industrial: galpões, tanques e chaminés com fumaça
function factory(img: Img, rand: () => number, night: boolean) {
  const wall = ['#6a6a72', '#7a7466', '#5a6070', '#8a8270'].map(hex);
  const smoke = hex(night ? '#3a3a48' : '#c8c8cc');
  let x = 0;
  while (x < PANO_W) {
    const kind = rand();
    let col = wall[Math.floor(rand() * wall.length)];
    if (night) col = dim(col, 0.4);
    if (kind < 0.45) {
      // galpão com telhado de dente de serra
      const bw = 14 + Math.floor(rand() * 20), bh = 8 + Math.floor(rand() * 8);
      for (let xx = x; xx < x + bw; xx++) {
        const tooth = (xx - x) % 6;
        for (let yy = PANO_H - bh - (tooth < 3 ? tooth : 0); yy < PANO_H; yy++) img.set(xx, yy, xx === x ? dim(col, 1.15) : col);
        if (night && (xx - x) % 3 === 1) img.set(xx, PANO_H - bh + 3, rand() < 0.5 ? hex('#ffd86b') : dim(col, 0.6));
      }
      x += bw + 1;
    } else if (kind < 0.7) {
      // tanque redondo
      const r = 4 + Math.floor(rand() * 4);
      for (let dx = -r; dx <= r; dx++) {
        const top = PANO_H - r * 2 - Math.round(Math.sqrt(r * r - dx * dx) * 0.5);
        for (let yy = top; yy < PANO_H; yy++) img.set(x + r + dx, yy, dx < -r / 2 ? dim(col, 1.2) : dx > r / 2 ? dim(col, 0.75) : col);
      }
      x += r * 2 + 3;
    } else {
      // chaminé alta com faixas e fumaça
      const ch = 24 + Math.floor(rand() * 26);
      for (let yy = PANO_H - ch; yy < PANO_H; yy++) {
        const band = (yy - (PANO_H - ch)) % 8 < 2;
        const c = band ? hex(night ? '#5a1a1a' : '#c83a2a') : dim(col, 0.9);
        img.set(x, yy, c);
        img.set(x + 1, yy, c);
        img.set(x + 2, yy, dim(c, 0.75));
      }
      if (night) img.set(x + 1, PANO_H - ch, hex('#ff3a2a'));
      for (let k = 0; k < 14; k++) {
        const sx = x + 1 + k + Math.floor(rand() * 2), sy = PANO_H - ch - 2 - Math.floor(k * 0.4 + rand() * 2);
        for (let d = 0; d < 2 + (k >> 2); d++) img.set(sx, sy - d, smoke);
      }
      x += 6;
    }
    if (rand() < 0.15) x += 10 + Math.floor(rand() * 20);
  }
}

// praia: mar com ondas e a faixa de areia na frente
function beach(img: Img, rand: () => number, night: boolean) {
  sea(img, rand, night);
  const sand = hex(night ? '#4a4030' : '#e8d49a');
  const foam = hex(night ? '#8a96a8' : '#ffffff');
  for (let x = 0; x < PANO_W; x++) {
    const top = PANO_H - 2 - Math.round(1 + Math.sin(x * 0.05) * 0.8);
    img.set(x, top - 1, foam);
    for (let y = top; y < PANO_H; y++) img.set(x, y, sand);
  }
}

// alpes: picos altos e pontudos, muita neve, um lago azul no pé (congelado no inverno)
function alps(img: Img, rand: () => number, night: boolean, frozen = false) {
  snowpeaks(img, rand, night, 1.35, frozen);
  const lake = hex(night ? (frozen ? '#3a4a66' : '#0c1c3a') : frozen ? '#a8c8e8' : '#3a7ac8');
  const shine = hex(night ? '#2a3a5a' : frozen ? '#eef6ff' : '#9ac8f0');
  for (let x = 0; x < PANO_W; x++)
    if (Math.sin(x * 0.012) > 0.2) for (let y = PANO_H - 3; y < PANO_H; y++) img.set(x, y, rand() < 0.1 ? shine : lake);
}

const cache = new Map<string, HTMLCanvasElement>();
// Fundos desenhados pelo Victor (tools/ref/bg_panorama.py: arte do gerador na grade nativa, 1024 x 64,
// relevo encostado embaixo, céu transparente). Enquanto a imagem carrega vale o fundo gerado (sem guardar
// no cache, para trocar assim que ela chegar); à noite os pixels escurecem como os gerados.
const ART = import.meta.glob('./assets/bg/*.png', { eager: true, import: 'default' }) as Record<string, string>;
const artImgs = new Map<string, HTMLImageElement>();
function artFor(kind: BgLayer): HTMLImageElement | null | undefined {
  const src = ART[`./assets/bg/${kind}.png`];
  if (!src) return undefined; // sem arte: fundo gerado
  let im = artImgs.get(kind);
  if (!im) {
    im = new Image();
    im.src = src;
    artImgs.set(kind, im);
  }
  return im.complete && im.naturalWidth ? im : null; // null: ainda carregando
}
export const preloadBgArt = () => (Object.keys(ART).map((k) => k.slice(12, -4)) as BgLayer[]).forEach((k) => artFor(k));

export function panorama(kind: BgLayer, near: boolean, night: boolean, seed: number): HTMLCanvasElement {
  const key = `${kind}:${near}:${night}:${seed}`;
  let cv = cache.get(key);
  if (cv) return cv;
  const img = new Img(PANO_W, PANO_H);
  const rand = rng(seed * 7919 + (near ? 13 : 3));
  const art = artFor(kind);
  if (art) {
    const g = document.createElement('canvas').getContext('2d', { willReadFrequently: true })!;
    g.canvas.width = PANO_W;
    g.canvas.height = PANO_H;
    g.drawImage(art, 0, 0, PANO_W, PANO_H);
    const d = g.getImageData(0, 0, PANO_W, PANO_H);
    if (night) for (let i = 0; i < d.data.length; i += 4) { d.data[i] *= 0.42; d.data[i + 1] *= 0.42; d.data[i + 2] *= 0.42; }
    img.data = d;
  } else switch (kind) {
    case 'city': city(img, rand, night); break;
    case 'forest': forest(img, rand, night, near ? 7 : 11); break;
    case 'mesa': rocks(img, rand, night); break;
    case 'hills': hills(img, rand, night); break;
    case 'snowpeaks': snowpeaks(img, rand, night); break;
    case 'dunes': dunes(img, rand, night); break;
    case 'sea': sea(img, rand, night); break;
    case 'redmesa': rocks(img, rand, night, true); break;
    case 'jungle': forest(img, rand, night, near ? 10 : 15, FOREST_PAL.jungle); break;
    case 'autumn': forest(img, rand, night, near ? 7 : 11, FOREST_PAL.autumn); break;
    case 'savanna': savanna(img, rand, night); break;
    case 'factory': factory(img, rand, night); break;
    case 'beach': beach(img, rand, night); break;
    case 'alps': alps(img, rand, night); break;
    case 'alpsnow': alps(img, rand, night, true); break;
    case 'snowforest': forest(img, rand, night, near ? 7 : 11, FOREST_PAL.forest, true); break;
  }
  cv = document.createElement('canvas');
  cv.width = PANO_W;
  cv.height = PANO_H;
  cv.getContext('2d')!.putImageData(img.data, 0, 0);
  if (art !== null) cache.set(key, cv); // arte ainda carregando: o gerado vale só por agora
  // linha do topo dos morros/árvores em cada coluna (para o sol nascer/se pôr atrás deles)
  const top = new Int16Array(PANO_W).fill(PANO_H);
  const d = img.data.data;
  for (let x = 0; x < PANO_W; x++) {
    for (let y = 0; y < PANO_H; y++) if (d[(y * PANO_W + x) * 4 + 3]) { top[x] = y; break; }
  }
  skylines.set(cv, top);
  return cv;
}
const skylines = new WeakMap<HTMLCanvasElement, Int16Array>();
export const skyline = (cv: HTMLCanvasElement) => skylines.get(cv);

// Nuvens em pixel art para o céu de dia (camada própria, bem lenta): cúmulos com topo
// claro, miolo e base sombreada puxando para a cor do céu, e pontilhado nas emendas.
const clouds = new Map<string, HTMLCanvasElement>();
export const CLOUD_H = 44;
export function cloudStrip(seed: number, sky: string, amount = 1): HTMLCanvasElement {
  const key = `${seed}:${sky}:${amount}`;
  let cv = clouds.get(key);
  if (cv) return cv;
  const W = PANO_W, H = CLOUD_H;
  const img = new Img(W, H);
  const rand = rng(seed * 104729 + 17);
  const sk = hex(sky);
  const mixc = (a: RGB, b: RGB, k: number): RGB => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
  const white: RGB = [252, 252, 248], mid = mixc(white, sk, 0.28), low = mixc(white, sk, 0.52), deep = mixc(white, sk, 0.68);
  const n = Math.round(9 * amount);
  for (let k = 0; k < n; k++) {
    const cx = (k + rand() * 0.6) * (W / n), cy = 8 + rand() * (H - 22), len = 26 + rand() * 46, ht = 7 + rand() * 7;
    // bolhas do cúmulo
    const puffs: [number, number, number][] = [];
    const m = 4 + Math.floor(rand() * 4);
    for (let i = 0; i < m; i++) {
      const t = i / (m - 1) - 0.5;
      const r = ht * (0.55 + (1 - Math.abs(t) * 1.6) * 0.6) * (0.8 + rand() * 0.4);
      puffs.push([cx + t * len, cy + ht * 0.4 - r * 0.6, Math.max(3, r)]);
    }
    const base = cy + ht * 0.55;
    for (let y = Math.floor(cy - ht * 1.6); y <= base; y++) {
      for (let x = Math.floor(cx - len * 0.75); x <= cx + len * 0.75; x++) {
        let inside = false, top = 1;
        for (const [px, py, r] of puffs) {
          const dx = (x - px) / (r * 1.25), dy = (y - py) / r;
          const d = dx * dx + dy * dy;
          if (d <= 1) {
            inside = true;
            top = Math.min(top, (y - (py - r)) / (2 * r)); // 0 no alto da bolha
          }
        }
        if (!inside) continue;
        const v = (y - (cy - ht)) / (base - (cy - ht)); // 0 em cima, 1 na base
        const s = v * 0.75 + top * 0.35;
        const dith = ((x + y) & 1) === 0;
        const col = s < 0.38 ? white : s < 0.48 ? (dith ? white : mid) : s < 0.66 ? mid : s < 0.74 ? (dith ? mid : low) : s < 0.9 ? low : deep;
        img.set(((x % W) + W) % W, y, col);
      }
    }
  }
  cv = document.createElement('canvas');
  cv.width = W;
  cv.height = H;
  cv.getContext('2d')!.putImageData(img.data, 0, 0);
  clouds.set(key, cv);
  return cv;
}
