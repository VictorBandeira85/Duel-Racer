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
  const pal = ['#8c8ca4', '#a4a4bc', '#c8b8a0', '#b48c96', '#7c7c94', '#d0c8b4', '#94a0b4', '#a89070'].map(hex);
  let x = 0;
  while (x < PANO_W) {
    if (rand() < 0.08) {
      x += 3 + Math.floor(rand() * 8);
      continue;
    }
    const bw = 5 + Math.floor(rand() * 13);
    const tall = rand() < 0.15;
    const bh = Math.min(PANO_H - 4, Math.floor(6 + Math.pow(rand(), 1.4) * (tall ? 52 : 34)));
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
        const lit = night ? (rand() < 0.45 ? hex('#ffd86b') : hex('#20203a')) : dim(col, 0.45);
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
    x += bw + (rand() < 0.3 ? 1 : 0);
  }
}

function forest(img: Img, rand: () => number, night: boolean, base: number) {
  const dark = hex(night ? '#06240a' : '#0c4a12');
  const mid = hex(night ? '#0c3412' : '#1a6a1c');
  const light = hex(night ? '#164a18' : '#2e8a2a');
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

function rocks(img: Img, rand: () => number, night: boolean) {
  const base = hex(night ? '#22343e' : '#4a6878');
  const light = hex(night ? '#34505e' : '#6e8e9e');
  const dark = hex(night ? '#141f26' : '#344e5c');
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

function hills(img: Img, rand: () => number, night: boolean) {
  const a = hex(night ? '#0c2e10' : '#1d6a22');
  const b = hex(night ? '#123a16' : '#2c8430');
  const hi = hex(night ? '#1a4a1c' : '#46a03e');
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

function snowpeaks(img: Img, rand: () => number, night: boolean) {
  const rock = hex(night ? '#3a4458' : '#7e8aa2');
  const rockDark = hex(night ? '#262e3e' : '#5a6680');
  const snow = hex(night ? '#9aa4b8' : '#f2f6fa');
  for (let x = 0; x < PANO_W; x++) {
    const p = Math.abs(((x / 64) % 2) - 1);
    const peak = (1 - p) * (24 + 18 * Math.abs(Math.sin(Math.floor(x / 128) * 2.3)));
    const h = Math.max(6, 10 + peak + wave(x, [[2, 17, 0.4]]));
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
  }
  cv = document.createElement('canvas');
  cv.width = PANO_W;
  cv.height = PANO_H;
  cv.getContext('2d')!.putImageData(img.data, 0, 0);
  cache.set(key, cv);
  return cv;
}
