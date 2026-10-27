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
function forest(img: Img, rand: () => number, night: boolean, base: number, pal = FOREST_PAL.forest) {
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
  for (let x = 0; x < PANO_W; x++) {
    const top = Math.floor(PANO_H - heights[x]);
    for (let y = Math.max(0, top); y < PANO_H; y++) {
      const depth = y - top;
      let c = dark;
      if (depth < 2) c = (x + y) % 2 ? light : mid;
      else if (depth < 5) c = rand() < 0.35 ? mid : dark;
      else if (rand() < 0.12) c = mid;
      img.set(x, y, c);
    }
  }
}

function rocks(img: Img, rand: () => number, night: boolean, red = false) {
  const pal = red ? ['#a8482a', '#d47a4a', '#6a2a1a'] : ['#4a6878', '#6e8e9e', '#344e5c'];
  const nt = (c: string) => (night ? dim(hex(c), 0.5) : hex(c));
  const base = nt(pal[0]);
  const light = nt(pal[1]);
  const dark = nt(pal[2]);
  const colNoise = Array.from({ length: PANO_W }, () => rand());
  for (let x = 0; x < PANO_W; x++) {
    const ridge = 26 + wave(x, [[10, 2, 0.3], [7, 5, 2.1], [4, 11, 0.7], [2, 23, 1.9]]);
    const cliff = Math.abs(wave(x, [[1, 9, 0.4]])) > 0.75 ? 6 : 0;
    const h = Math.max(4, Math.min(PANO_H - 2, ridge + cliff + (colNoise[x] - 0.5) * 3));
    const top = Math.floor(PANO_H - h);
    for (let y = top; y < PANO_H; y++) {
      const n = rand();
      const streak = colNoise[x];
      let c = base;
      if (y - top < 2) c = light;
      else if (n < 0.08 + streak * 0.14) c = light;
      else if (n > 0.86 - streak * 0.12) c = dark;
      img.set(x, y, c);
    }
  }
}

function hills(img: Img, rand: () => number, night: boolean, dry = false) {
  const pal = dry ? ['#9a8a3a', '#b8a24a', '#d8c26a'] : ['#1d6a22', '#2c8430', '#46a03e'];
  const nt = (c: string) => (night ? dim(hex(c), 0.42) : hex(c));
  const a = nt(pal[0]);
  const b = nt(pal[1]);
  const hi = nt(pal[2]);
  for (let x = 0; x < PANO_W; x++) {
    const h = 14 + wave(x, [[7, 2, 1.1], [4, 5, 0.2], [2, 9, 2.5]]);
    const top = Math.floor(PANO_H - h);
    for (let y = top; y < PANO_H; y++) {
      let c = (x + y) % 2 ? a : b;
      if (y - top < 1) c = hi;
      else if (rand() < 0.08) c = hi;
      img.set(x, y, c);
    }
  }
}

function snowpeaks(img: Img, rand: () => number, night: boolean, tall = 1) {
  const rock = hex(night ? '#3a4458' : '#7e8aa2');
  const rockDark = hex(night ? '#262e3e' : '#5a6680');
  const snow = hex(night ? '#9aa4b8' : '#f2f6fa');
  for (let x = 0; x < PANO_W; x++) {
    const p = Math.abs(((x / 64) % 2) - 1);
    const peak = (1 - p) * (24 + 18 * Math.abs(Math.sin(Math.floor(x / 128) * 2.3))) * tall;
    const h = Math.min(PANO_H - 1, Math.max(6, 10 + peak + wave(x, [[2, 17, 0.4]])));
    const top = Math.floor(PANO_H - h);
    for (let y = top; y < PANO_H; y++) {
      const rel = (y - top) / h;
      let c = rand() < 0.3 ? rockDark : rock;
      if (rel < 0.28 + (rand() - 0.5) * 0.08 && h > 22) c = rand() < 0.85 ? snow : rock;
      img.set(x, y, c);
    }
  }
}

function dunes(img: Img, rand: () => number, night: boolean) {
  const a = hex(night ? '#4a3a22' : '#c49a58');
  const b = hex(night ? '#5a4628' : '#d4aa66');
  for (let x = 0; x < PANO_W; x++) {
    const h = 8 + wave(x, [[3, 3, 0.4], [2, 8, 1.7]]);
    const top = Math.floor(PANO_H - h);
    for (let y = top; y < PANO_H; y++) img.set(x, y, (x + y) % 2 || rand() < 0.1 ? a : b);
  }
}

function sea(img: Img, rand: () => number, night: boolean) {
  const a = hex(night ? '#0c1c3a' : '#1f5eb8');
  const wv = hex(night ? '#1c3058' : '#6aa8e8');
  for (let x = 0; x < PANO_W; x++) {
    for (let y = PANO_H - 6; y < PANO_H; y++) img.set(x, y, rand() < 0.12 ? wv : a);
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

// alpes: picos altos e pontudos, muita neve, um lago azul no pé
function alps(img: Img, rand: () => number, night: boolean) {
  snowpeaks(img, rand, night, 1.35);
  const lake = hex(night ? '#0c1c3a' : '#3a7ac8');
  const shine = hex(night ? '#2a3a5a' : '#9ac8f0');
  for (let x = 0; x < PANO_W; x++)
    if (Math.sin(x * 0.012) > 0.2) for (let y = PANO_H - 3; y < PANO_H; y++) img.set(x, y, rand() < 0.1 ? shine : lake);
}

const cache = new Map<string, HTMLCanvasElement>();

export function panorama(kind: BgLayer, near: boolean, night: boolean, seed: number): HTMLCanvasElement {
  const key = `${kind}:${near}:${night}:${seed}`;
  let cv = cache.get(key);
  if (cv) return cv;
  const img = new Img(PANO_W, PANO_H);
  const rand = rng(seed * 7919 + (near ? 13 : 3));
  switch (kind) {
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
  }
  cv = document.createElement('canvas');
  cv.width = PANO_W;
  cv.height = PANO_H;
  cv.getContext('2d')!.putImageData(img.data, 0, 0);
  cache.set(key, cv);
  return cv;
}
