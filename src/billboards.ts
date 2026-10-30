// Outdoors: 100 anúncios fictícios no estilo dos anos 90 (capas de revista, carros, peças,
// postos, polícia, celulares, rádios, lugares, comidas e eletrônicos). Cada um é desenhado uma
// vez em pixels nativos (AW x AH) com fonte de 3x5 e ícones feitos à mão, e depois ampliado sem
// suavizar no painel do outdoor. Todas as marcas são inventadas.
import { CARS, drawCar, drawCarSide, type CarSpec } from './cars';
import { KMH } from './config';
import { spriteAspect } from './svgsprites';
import { FONT, fixGlyphs, text } from './ui';

export const AW = 128, AH = 41; // proporção do painel do outdoor (unidades; 2 px cada)

type Icon = (g: Pen, x: number, y: number, a: Ad) => void; // caixa de 24x24
interface Ad { l: 'L' | 'R' | 'C' | 'S' | 'M' | 'K'; t: string; s: string; bg: string; fg: string; ac: string; i?: string; b?: string }

// ---------- fonte 3x5 ----------
const F: Record<string, string> = {
  A: '010101111101101', B: '110101110101110', C: '011100100100011', D: '110101101101110', E: '111100110100111',
  F: '111100110100100', G: '011100101101011', H: '101101111101101', I: '111010010010111', J: '001001001101010',
  K: '101101110101101', L: '100100100100111', M: '101111111101101', N: '111101101101101', O: '010101101101010',
  P: '110101110100100', Q: '010101101110011', R: '110101110101101', S: '011100010001110', T: '111010010010010',
  U: '101101101101111', V: '101101101101010', W: '101101111111101', X: '101101010101101', Y: '101101010010010',
  Z: '111001010100111', 0: '111101101101111', 1: '010110010010111', 2: '111001111100111', 3: '111001111001111',
  4: '101101111001001', 5: '111100111001111', 6: '111100111101111', 7: '111001001010010', 8: '111101111101111',
  9: '111101111001111', '-': '000000111000000', '.': '000000000000010', ',': '000000000010100', '!': '010010010000010',
  '?': '111001010000010', ':': '000010000010000', '/': '001001010100100', '%': '101001010100101', $: '011110010011110',
  '+': '000010111010000', "'": '010010000000000', '*': '101010111010101', '&': '010101010101011', '=': '000111000111000',
};
const plain = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();
const textW = (s: string, k: number) => (plain(s).length * 4 - 1) * k;

class Pen {
  constructor(public c: CanvasRenderingContext2D) {}
  r(x: number, y: number, w: number, h: number, col: string) {
    this.c.fillStyle = col;
    this.c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  }
  p(x: number, y: number, col: string) {
    this.r(x, y, 1, 1, col);
  }
  // disco cheio (pixels inteiros)
  disc(cx: number, cy: number, rad: number, col: string) {
    this.c.fillStyle = col;
    for (let y = -rad; y <= rad; y++) {
      const hw = Math.floor(Math.sqrt(rad * rad - y * y + rad * 0.6));
      this.c.fillRect(Math.round(cx - hw), Math.round(cy + y), hw * 2 + 1, 1);
    }
  }
  // texto: (x, y) canto de cima à esquerda; sombra opcional 1 px abaixo à direita
  // ky > k: letras altas e estreitas (condensadas, como nos letreiros de outdoor)
  text(s: string, x: number, y: number, col: string, k = 1, shadow?: string, ky = k) {
    const t = plain(s);
    if (shadow) this.text(t, x + Math.max(1, k / 2), y + Math.max(1, ky / 2), shadow, k, undefined, ky);
    this.c.fillStyle = col;
    let px = Math.round(x);
    for (const ch of t) {
      const g = F[ch];
      if (g) for (let i = 0; i < 15; i++) if (g[i] === '1') this.c.fillRect(px + (i % 3) * k, Math.round(y) + Math.floor(i / 3) * ky, k, ky);
      px += 4 * k;
    }
  }
  // título centrado em cx, no maior tamanho que cabe na largura w: 3x, 2x, condensado alto (a
  // mesma altura do 2x) e por fim 1x; devolve a altura usada
  fit(s: string, cx: number, y: number, w: number, col: string, kMax = 3, shadow?: string) {
    let k = kMax;
    while (k > 1 && textW(s, k) > w) k--;
    const ky = k === 1 && kMax >= 2 ? 2 : k;
    this.text(s, cx - textW(s, k) / 2, y, col, k, shadow, ky);
    return 5 * ky;
  }
}

// ---------- carro de perfil (anúncios e capas) ----------
function car(g: Pen, x: number, y: number, w: number, col: string, kind = 'sport') {
  // (x, y) = canto de baixo à esquerda; altura proporcional
  const dark = shade(col, 0.55), light = shade(col, 1.35), glass = '#9cc8e8';
  const h = Math.round(w * 0.32);
  const top = y - h;
  if (kind === 'pickup') {
    g.r(x, top + h * 0.45, w, h * 0.35, col);
    g.r(x + w * 0.42, top + h * 0.1, w * 0.26, h * 0.4, col);
    g.r(x + w * 0.47, top + h * 0.17, w * 0.17, h * 0.26, glass);
    g.r(x, top + h * 0.45, w, 1, light);
  } else if (kind === 'sedan') {
    g.r(x, top + h * 0.42, w, h * 0.38, col);
    g.r(x + w * 0.22, top + h * 0.08, w * 0.5, h * 0.36, col);
    g.r(x + w * 0.27, top + h * 0.15, w * 0.19, h * 0.25, glass);
    g.r(x + w * 0.49, top + h * 0.15, w * 0.19, h * 0.25, glass);
    g.r(x, top + h * 0.42, w, 1, light);
  } else if (kind === 'hatch') {
    g.r(x, top + h * 0.42, w, h * 0.38, col);
    g.r(x + w * 0.3, top + h * 0.06, w * 0.6, h * 0.38, col);
    g.r(x + w * 0.35, top + h * 0.13, w * 0.24, h * 0.26, glass);
    g.r(x + w * 0.62, top + h * 0.13, w * 0.24, h * 0.26, glass);
    g.r(x, top + h * 0.42, w, 1, light);
  } else if (kind === 'jeep') {
    g.r(x, top + h * 0.35, w, h * 0.45, col);
    g.r(x + w * 0.35, top, w * 0.55, h * 0.37, col);
    g.r(x + w * 0.4, top + h * 0.08, w * 0.2, h * 0.24, glass);
    g.r(x + w * 0.64, top + h * 0.08, w * 0.2, h * 0.24, glass);
    g.r(x + w - 2, top + h * 0.38, 2, h * 0.3, '#2a2a2a');
  } else {
    // esportivo em cunha
    for (let i = 0; i < w; i++) {
      const f = i / w;
      const hh = f < 0.3 ? h * (0.32 + f * 0.4) : f < 0.75 ? h * (0.44 + Math.sin((f - 0.3) / 0.45 * Math.PI) * 0.32) : h * 0.5;
      g.r(x + i, y - h * 0.2 - hh, 1, hh, col);
    }
    g.r(x + w * 0.36, top + h * 0.26, w * 0.32, h * 0.18, glass);
    g.r(x, y - h * 0.55, w, 1, light);
  }
  g.r(x, y - h * 0.24, w, Math.max(1, h * 0.06), dark);
  for (const f of [0.2, 0.8]) {
    g.disc(x + w * f, y - h * 0.18, Math.max(1, Math.round(h * 0.2)), '#151515');
    g.disc(x + w * f, y - h * 0.18, Math.max(0, Math.round(h * 0.1)), '#b8b8c0');
  }
  g.r(x + w - 2, y - h * 0.48, 2, Math.max(1, h * 0.1), '#ffe890');
  g.r(x, y - h * 0.48, 1, Math.max(1, h * 0.1), '#e02020');
}
function shade(hex: string, k: number) {
  const n = parseInt(hex.slice(1), 16);
  const f = (v: number) => Math.max(0, Math.min(255, Math.round(v * k)));
  return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
}

// ---------- ícones 24x24 ----------
const ICONS: Record<string, Icon> = {
  piston: (g, x, y, a) => {
    g.r(x + 6, y + 3, 12, 9, '#c8c8d0'); g.r(x + 6, y + 3, 12, 2, '#f0f0f4');
    for (const yy of [6, 8]) g.r(x + 6, y + yy, 12, 1, '#6a6a72');
    g.r(x + 10, y + 12, 4, 8, '#9a9aa4'); g.disc(x + 12, y + 20, 3, '#9a9aa4'); g.disc(x + 12, y + 20, 1, a.bg);
  },
  plug: (g, x, y) => {
    g.r(x + 10, y + 1, 4, 3, '#9a9aa4'); g.r(x + 9, y + 4, 6, 8, '#f4f4f0'); for (const yy of [5, 7, 9]) g.r(x + 9, y + yy, 6, 1, '#c8c8c0');
    g.r(x + 8, y + 12, 8, 4, '#b8b8c0'); g.r(x + 10, y + 16, 4, 4, '#8a8a92'); g.r(x + 11, y + 20, 2, 2, '#5a5a62'); g.p(x + 14, y + 21, '#ffe040');
    g.r(x + 15, y + 22, 3, 1, '#ffe040'); g.r(x + 5, y + 21, 3, 1, '#ffe040');
  },
  tire: (g, x, y) => {
    g.disc(x + 12, y + 12, 11, '#1a1a1a'); for (let k = 0; k < 12; k++) { const t = (k / 12) * Math.PI * 2; g.r(x + 12 + Math.cos(t) * 10, y + 12 + Math.sin(t) * 10, 1, 1, '#3a3a3a'); }
    g.disc(x + 12, y + 12, 6, '#b8b8c0'); g.disc(x + 12, y + 12, 2, '#5a5a62');
  },
  rim: (g, x, y, a) => {
    g.disc(x + 12, y + 12, 11, '#202020'); g.disc(x + 12, y + 12, 8, '#d8d8e0');
    for (let k = 0; k < 5; k++) { const t = (k / 5) * Math.PI * 2 - Math.PI / 2; for (let d = 2; d < 8; d++) g.r(x + 12 + Math.cos(t) * d, y + 12 + Math.sin(t) * d, 2, 2, '#8a8a94'); }
    g.disc(x + 12, y + 12, 2, a.ac);
  },
  shock: (g, x, y, a) => {
    g.r(x + 10, y + 1, 4, 3, '#5a5a62'); g.r(x + 11, y + 4, 2, 6, '#d8d8e0'); g.r(x + 9, y + 10, 6, 12, a.ac);
    for (let yy = 3; yy < 20; yy += 2) g.r(x + 6, y + yy, 12, 1, '#e8e8ec');
    g.r(x + 10, y + 21, 4, 2, '#5a5a62');
  },
  exhaust: (g, x, y) => {
    g.r(x + 1, y + 10, 14, 5, '#9a9aa4'); g.r(x + 1, y + 10, 14, 1, '#d8d8e0'); g.r(x + 15, y + 8, 6, 9, '#c8c8d0'); g.disc(x + 21, y + 12, 3, '#2a2a2a');
    for (const [dx, dy] of [[2, -4], [4, -7], [1, -9]]) g.disc(x + 21 + dx, y + 12 + dy, 1, '#c8c8c8');
  },
  battery: (g, x, y, a) => {
    g.r(x + 3, y + 7, 18, 13, '#2a2a30'); g.r(x + 3, y + 7, 18, 3, a.ac); g.r(x + 6, y + 4, 3, 3, '#c8c8c8'); g.r(x + 15, y + 4, 3, 3, '#c8c8c8');
    g.text('+', x + 6, y + 12, '#ffffff'); g.text('-', x + 15, y + 12, '#ffffff');
  },
  oil: (g, x, y, a) => {
    g.r(x + 5, y + 6, 13, 16, a.ac); g.r(x + 8, y + 3, 5, 3, a.ac); g.r(x + 9, y + 1, 3, 2, '#202020'); g.r(x + 7, y + 11, 9, 6, '#f4f4f0');
    g.text('20', x + 8, y + 12, '#202020'); g.r(x + 18, y + 9, 2, 5, a.ac);
  },
  turbo: (g, x, y, a) => {
    g.disc(x + 11, y + 13, 9, '#9a9aa4'); g.disc(x + 11, y + 13, 6, '#5a5a62');
    for (let k = 0; k < 6; k++) { const t = (k / 6) * Math.PI * 2; g.r(x + 11 + Math.cos(t) * 4, y + 13 + Math.sin(t) * 4, 2, 2, '#d8d8e0'); }
    g.r(x + 18, y + 5, 6, 5, '#9a9aa4'); g.disc(x + 11, y + 13, 1, a.ac);
  },
  speaker: (g, x, y, a) => {
    g.r(x + 3, y + 1, 18, 22, '#202024'); g.disc(x + 12, y + 7, 3, '#5a5a62'); g.disc(x + 12, y + 16, 6, '#5a5a62'); g.disc(x + 12, y + 16, 2, a.ac);
  },
  alarm: (g, x, y, a) => {
    g.disc(x + 12, y + 14, 8, '#d02020'); g.r(x + 4, y + 14, 17, 7, a.bg); g.r(x + 3, y + 20, 18, 3, '#3a3a40'); g.disc(x + 12, y + 12, 2, '#ffc0c0');
    for (const [dx, dy] of [[-9, -6], [9, -6], [0, -10]]) g.r(x + 12 + dx, y + 12 + dy, 1, 2, '#ffe040');
  },
  lamp: (g, x, y) => {
    g.disc(x + 9, y + 12, 7, '#d8d8e0'); g.disc(x + 9, y + 12, 5, '#fff4b0');
    for (let k = 0; k < 4; k++) g.r(x + 17, y + 6 + k * 4, 6, 1, '#ffe040');
  },
  wrench: (g, x, y) => {
    for (let k = 0; k < 14; k++) g.r(x + 5 + k, y + 18 - k, 3, 3, '#b8b8c4');
    g.disc(x + 19, y + 5, 4, '#b8b8c4'); g.disc(x + 5, y + 19, 3, '#b8b8c4');
  },
  pump: (g, x, y, a) => {
    g.r(x + 4, y + 3, 11, 19, a.ac); g.r(x + 6, y + 5, 7, 5, '#e8f0e0'); g.r(x + 2, y + 21, 15, 2, '#3a3a40');
    g.r(x + 15, y + 6, 2, 2, '#202020'); g.r(x + 17, y + 7, 2, 10, '#202020'); g.r(x + 19, y + 15, 2, 4, '#202020');
  },
  drop: (g, x, y, a) => {
    for (let k = 0; k < 10; k++) g.r(x + 12 - k * 0.6, y + 2 + k, 1 + k * 1.2, 1, a.ac);
    g.disc(x + 12, y + 15, 7, a.ac); g.r(x + 9, y + 12, 2, 4, '#ffffff');
  },
  radar: (g, x, y) => {
    g.r(x + 11, y + 10, 2, 13, '#5a5a62'); g.r(x + 5, y + 3, 14, 8, '#e8e8ec'); g.disc(x + 9, y + 7, 2, '#202020'); g.r(x + 14, y + 5, 3, 1, '#d02020');
    for (const [dx, dy] of [[19, 4], [21, 7], [19, 10]]) g.r(x + dx, y + dy, 2, 1, '#ffe040');
  },
  limit: (g, x, y) => {
    g.disc(x + 12, y + 12, 11, '#d02020'); g.disc(x + 12, y + 12, 8, '#ffffff'); g.text('80', x + 8, y + 10, '#202020');
  },
  belt: (g, x, y) => {
    g.disc(x + 12, y + 5, 4, '#f0d0a0'); g.r(x + 6, y + 10, 12, 13, '#2a5aa8');
    for (let k = 0; k < 12; k++) g.r(x + 6 + k, y + 10 + k, 2, 2, '#e8e020');
  },
  badge: (g, x, y, a) => {
    for (let k = 0; k < 6; k++) { const t = (k / 6) * Math.PI * 2 - Math.PI / 2; g.disc(x + 12 + Math.cos(t) * 8, y + 12 + Math.sin(t) * 8, 3, '#e8c020'); }
    g.disc(x + 12, y + 12, 8, '#e8c020'); g.disc(x + 12, y + 12, 5, a.bg); g.r(x + 11, y + 9, 2, 6, '#e8c020'); g.r(x + 9, y + 11, 6, 2, '#e8c020');
  },
  cone: (g, x, y) => {
    for (let k = 0; k < 18; k++) g.r(x + 12 - k * 0.4, y + 3 + k, 1 + k * 0.8, 1, k % 6 < 3 ? '#ff7a10' : '#ffffff');
    g.r(x + 3, y + 21, 18, 2, '#ff7a10');
  },
  cell: (g, x, y, a) => {
    g.r(x + 8, y + 1, 2, 5, '#202020'); g.r(x + 7, y + 5, 10, 18, '#2a2a30'); g.r(x + 8, y + 7, 8, 4, '#a8d890');
    for (let r = 0; r < 3; r++) for (let k = 0; k < 3; k++) g.r(x + 8 + k * 3, y + 13 + r * 3, 2, 2, '#c8c8d0');
    for (const [dx, dy] of [[12, -3], [14, -5]]) g.r(x + 8 + dx, y + 6 + dy, 1, 3, a.ac);
  },
  pager: (g, x, y) => {
    g.r(x + 3, y + 7, 18, 11, '#2a2a30'); g.r(x + 5, y + 9, 14, 5, '#a8d890'); g.text('BIP', x + 6, y + 9, '#203018'); g.r(x + 6, y + 15, 3, 1, '#8a8a92');
  },
  payphone: (g, x, y) => {
    g.disc(x + 12, y + 9, 9, '#f0a020'); g.r(x + 3, y + 9, 19, 2, '#f0a020'); g.r(x + 8, y + 9, 8, 9, '#2a5aa8'); g.r(x + 9, y + 10, 3, 5, '#202020'); g.r(x + 11, y + 18, 2, 5, '#5a5a62');
  },
  radio: (g, x, y, a) => {
    g.r(x + 1, y + 8, 22, 13, '#2a2a30'); g.r(x + 3, y + 10, 9, 4, '#f0a030'); g.disc(x + 17, y + 15, 3, '#5a5a62'); g.disc(x + 6, y + 18, 1, '#8a8a92');
    for (let k = 0; k < 7; k++) g.p(x + 6 + k, y + 7 - k, '#9a9aa4');
  },
  waves: (g, x, y, a) => {
    g.r(x + 11, y + 10, 2, 13, '#c8c8d0'); g.disc(x + 12, y + 9, 2, a.ac);
    for (const rad of [5, 8, 11]) for (let t = -0.8; t <= 0.8; t += 0.12) for (const sgn of [-1, 1]) g.p(x + 12 + sgn * Math.cos(t) * rad, y + 9 + Math.sin(t) * rad, a.fg);
  },
  sun: (g, x, y) => {
    g.disc(x + 12, y + 12, 6, '#ffd020');
    for (let k = 0; k < 8; k++) { const t = (k / 8) * Math.PI * 2; for (let d = 8; d < 11; d++) g.p(x + 12 + Math.cos(t) * d, y + 12 + Math.sin(t) * d, '#ffb020'); }
  },
  palm: (g, x, y) => {
    for (let k = 0; k < 16; k++) g.r(x + 12 + Math.sin(k / 6) * 2, y + 7 + k, 2, 1, '#7a4a20');
    for (const [dx, dy] of [[-8, 2], [8, 2], [-6, -2], [6, -2], [0, -4]]) for (let k = 0; k <= 8; k++) g.p(x + 13 + (dx * k) / 8, y + 7 + (dy * k) / 8 + (k * k) / 16, '#2a8a3a');
  },
  mountain: (g, x, y) => {
    for (let k = 0; k < 12; k++) g.r(x + 12 - k, y + 8 + k, k * 2 + 1, 1, '#5a6a8a');
    for (let k = 0; k < 4; k++) g.r(x + 12 - k, y + 8 + k, k * 2 + 1, 1, '#ffffff');
    for (let k = 0; k < 8; k++) g.r(x + 19 - k, y + 14 + k, k * 2 + 1, 1, '#3a4a6a');
  },
  canyon: (g, x, y) => {
    g.r(x + 1, y + 10, 7, 13, '#b84a2a'); g.r(x + 1, y + 10, 7, 2, '#e07a4a'); g.r(x + 15, y + 6, 8, 17, '#a8402a'); g.r(x + 15, y + 6, 8, 2, '#e07a4a'); g.r(x + 8, y + 20, 7, 3, '#d8a060');
  },
  city: (g, x, y, a) => {
    for (const [bx, bh, bw] of [[1, 12, 5], [6, 18, 6], [12, 9, 4], [16, 15, 7]]) {
      g.r(x + bx, y + 23 - bh, bw, bh, '#2a2a4a');
      for (let wy = 23 - bh + 2; wy < 21; wy += 3) for (let wx = bx + 1; wx < bx + bw - 1; wx += 2) g.p(x + wx, y + wy, (wx + wy) % 3 ? '#ffe070' : a.ac);
    }
  },
  pool: (g, x, y) => {
    g.r(x + 1, y + 12, 22, 11, '#2a8ae0'); for (let k = 0; k < 22; k += 4) { g.r(x + 1 + k, y + 14, 2, 1, '#a8e0ff'); g.r(x + 3 + k, y + 18, 2, 1, '#a8e0ff'); }
    g.r(x + 4, y + 3, 2, 10, '#d8d8e0'); g.r(x + 10, y + 3, 2, 10, '#d8d8e0'); for (const yy of [5, 8, 11]) g.r(x + 4, y + yy, 8, 1, '#d8d8e0');
  },
  house: (g, x, y, a) => {
    for (let k = 0; k < 9; k++) g.r(x + 12 - k * 1.2, y + 3 + k, k * 2.4 + 1, 1, '#b83a2a');
    g.r(x + 4, y + 12, 16, 11, '#f0e0c0'); g.r(x + 10, y + 16, 4, 7, '#7a4a20'); g.r(x + 5, y + 14, 3, 3, '#9cc8e8'); g.r(x + 16, y + 14, 3, 3, '#9cc8e8');
  },
  fork: (g, x, y) => {
    for (const fx of [4, 6, 8]) g.r(x + fx, y + 2, 1, 7, '#d8d8e0'); g.r(x + 4, y + 8, 5, 2, '#d8d8e0'); g.r(x + 5, y + 10, 3, 12, '#d8d8e0');
    g.r(x + 15, y + 2, 4, 10, '#d8d8e0'); g.r(x + 15, y + 2, 2, 20, '#d8d8e0');
  },
  heart: (g, x, y) => {
    g.disc(x + 8, y + 9, 5, '#ff3a6a'); g.disc(x + 16, y + 9, 5, '#ff3a6a'); for (let k = 0; k < 10; k++) g.r(x + 3 + k, y + 11 + k, 19 - k * 2, 1, '#ff3a6a');
    g.r(x + 6, y + 7, 2, 2, '#ffc0d0');
  },
  bottle: (g, x, y, a) => {
    g.r(x + 10, y + 1, 4, 2, '#d02020'); g.r(x + 10, y + 3, 4, 5, '#3a1a10'); g.r(x + 8, y + 8, 8, 15, '#3a1a10'); g.r(x + 8, y + 12, 8, 5, a.ac); g.r(x + 9, y + 9, 1, 12, '#7a4a30');
  },
  can: (g, x, y, a) => {
    g.r(x + 7, y + 3, 10, 19, a.ac); g.r(x + 7, y + 3, 10, 2, '#d8d8e0'); g.r(x + 7, y + 20, 10, 2, '#d8d8e0'); g.r(x + 9, y + 6, 2, 13, '#ffffff'); g.r(x + 12, y + 10, 4, 4, '#ffffff');
  },
  icecream: (g, x, y) => {
    g.disc(x + 12, y + 7, 5, '#ff9ac0'); g.disc(x + 12, y + 3, 3, '#fff4e0');
    for (let k = 0; k < 11; k++) g.r(x + 12 - (10 - k) * 0.5, y + 12 + k, (10 - k) + 1, 1, k % 2 ? '#c88a40' : '#e8b060');
  },
  cup: (g, x, y) => {
    g.r(x + 4, y + 9, 13, 12, '#f4f4f0'); g.r(x + 17, y + 11, 3, 6, '#f4f4f0'); g.r(x + 5, y + 10, 11, 2, '#6a3a1a'); g.r(x + 2, y + 21, 18, 2, '#c8c8c0');
    for (const sx of [7, 11]) for (let k = 0; k < 5; k++) g.p(x + sx + (k % 2), y + 7 - k, '#d8d8d8');
  },
  burger: (g, x, y) => {
    g.disc(x + 12, y + 9, 8, '#e0a040'); g.r(x + 4, y + 10, 17, 3, '#e0a040'); g.r(x + 3, y + 13, 19, 2, '#40a030'); g.r(x + 3, y + 15, 19, 3, '#6a3a1a'); g.r(x + 3, y + 18, 19, 1, '#ffd020'); g.r(x + 4, y + 19, 17, 3, '#e0a040');
    for (const sx of [8, 12, 16]) g.p(x + sx, y + 5, '#fff4d0');
  },
  pizza: (g, x, y) => {
    for (let k = 0; k < 18; k++) g.r(x + 3 + k * 0.5, y + 3 + k, 18 - k, 1, k < 2 ? '#c88a40' : '#ffd040');
    for (const [dx, dy] of [[8, 6], [13, 7], [10, 11]]) g.disc(x + dx, y + dy, 1, '#c02020');
  },
  bubble: (g, x, y) => {
    g.disc(x + 12, y + 11, 9, '#ff8ac8'); g.disc(x + 9, y + 8, 2, '#ffd0ea'); g.r(x + 10, y + 20, 4, 3, '#f0c0a0');
  },
  orange: (g, x, y) => {
    g.disc(x + 12, y + 13, 9, '#ff9020'); g.r(x + 11, y + 2, 2, 3, '#6a4a20'); g.r(x + 13, y + 2, 5, 2, '#3a9a30'); g.disc(x + 9, y + 10, 1, '#ffd0a0');
  },
  vhs: (g, x, y) => {
    g.r(x + 1, y + 6, 22, 13, '#202024'); g.r(x + 4, y + 8, 16, 5, '#f4f4f0'); g.disc(x + 7, y + 15, 2, '#5a5a62'); g.disc(x + 17, y + 15, 2, '#5a5a62'); g.r(x + 9, y + 14, 6, 3, '#3a3a40');
  },
  tape: (g, x, y, a) => {
    g.r(x + 2, y + 6, 20, 13, a.ac); g.r(x + 4, y + 8, 16, 6, '#f4f4f0'); g.disc(x + 8, y + 11, 2, '#202020'); g.disc(x + 16, y + 11, 2, '#202020'); g.r(x + 7, y + 15, 10, 3, '#202024');
  },
  tv: (g, x, y, a) => {
    g.r(x + 1, y + 4, 22, 17, '#3a3a40'); g.r(x + 3, y + 6, 15, 12, '#4a8ad0'); g.r(x + 5, y + 8, 6, 3, '#a8d8ff'); g.disc(x + 20, y + 9, 1, '#c8c8c8'); g.disc(x + 20, y + 14, 1, '#c8c8c8');
    g.r(x + 8, y + 1, 1, 3, '#9a9aa4'); g.r(x + 14, y + 1, 1, 3, '#9a9aa4'); g.r(x + 5, y + 21, 3, 2, '#3a3a40'); g.r(x + 16, y + 21, 3, 2, '#3a3a40');
  },
  pad: (g, x, y, a) => {
    g.r(x + 2, y + 8, 20, 10, '#9a9aa4'); g.disc(x + 4, y + 13, 5, '#9a9aa4'); g.disc(x + 20, y + 13, 5, '#9a9aa4');
    g.r(x + 4, y + 12, 5, 2, '#2a2a30'); g.r(x + 5, y + 10, 2, 6, '#2a2a30'); g.disc(x + 17, y + 14, 1, '#d02020'); g.disc(x + 20, y + 11, 1, a.ac);
  },
  camera: (g, x, y) => {
    g.r(x + 1, y + 7, 22, 14, '#202024'); g.r(x + 4, y + 4, 6, 3, '#202024'); g.disc(x + 12, y + 14, 5, '#5a5a62'); g.disc(x + 12, y + 14, 3, '#2a4a8a'); g.r(x + 18, y + 9, 3, 2, '#f0f0f0');
  },
  glasses: (g, x, y, a) => {
    g.r(x + 1, y + 9, 22, 2, '#202020'); g.r(x + 2, y + 10, 8, 6, a.ac); g.r(x + 14, y + 10, 8, 6, a.ac); g.r(x + 3, y + 11, 3, 1, '#ffffff'); g.r(x + 15, y + 11, 3, 1, '#ffffff');
  },
  jeans: (g, x, y) => {
    g.r(x + 5, y + 2, 14, 4, '#2a4a8a'); g.r(x + 5, y + 6, 6, 17, '#3a5aa8'); g.r(x + 13, y + 6, 6, 17, '#3a5aa8'); g.r(x + 5, y + 2, 14, 1, '#e8a030'); g.p(x + 12, y + 4, '#e8c060');
  },
  shoe: (g, x, y, a) => {
    g.r(x + 3, y + 10, 10, 8, '#f4f4f0'); g.r(x + 3, y + 14, 19, 5, '#f4f4f0'); g.r(x + 2, y + 19, 21, 3, a.ac); for (const sx of [6, 9]) g.r(x + sx, y + 11, 3, 1, '#9a9aa4');
  },
  watch: (g, x, y) => {
    g.r(x + 8, y + 1, 8, 22, '#2a2a30'); g.r(x + 5, y + 7, 14, 10, '#9a9aa4'); g.r(x + 6, y + 8, 12, 8, '#a8d890'); g.text('12', x + 8, y + 10, '#203018');
  },
  pc: (g, x, y) => {
    g.r(x + 3, y + 2, 18, 14, '#e0dcc8'); g.r(x + 5, y + 4, 14, 10, '#1a3a7a'); g.r(x + 6, y + 5, 6, 1, '#80ff80'); g.r(x + 6, y + 7, 9, 1, '#80ff80');
    g.r(x + 1, y + 17, 22, 5, '#e0dcc8'); for (let k = 0; k < 9; k++) g.r(x + 3 + k * 2, y + 18, 1, 1, '#8a8a80');
  },
  bag: (g, x, y, a) => {
    g.r(x + 4, y + 8, 16, 15, a.ac); g.r(x + 8, y + 3, 1, 6, '#3a3a40'); g.r(x + 15, y + 3, 1, 6, '#3a3a40'); g.r(x + 8, y + 3, 8, 1, '#3a3a40'); g.text('$', x + 10, y + 13, '#ffffff');
  },
  trophy: (g, x, y) => {
    g.r(x + 6, y + 2, 12, 9, '#ffd020'); g.disc(x + 12, y + 10, 5, '#ffd020'); g.r(x + 3, y + 3, 3, 5, '#ffd020'); g.r(x + 18, y + 3, 3, 5, '#ffd020'); g.r(x + 11, y + 15, 2, 4, '#e0b010'); g.r(x + 7, y + 19, 10, 3, '#7a4a20');
  },
  flag: (g, x, y) => {
    g.r(x + 3, y + 1, 1, 22, '#c8c8c8'); for (let r = 0; r < 4; r++) for (let k = 0; k < 6; k++) g.r(x + 4 + k * 3, y + 2 + r * 3, 3, 3, (r + k) % 2 ? '#202020' : '#ffffff');
  },
  plane: (g, x, y) => {
    g.r(x + 2, y + 11, 20, 3, '#e8e8ec'); g.r(x + 9, y + 4, 4, 16, '#e8e8ec'); g.r(x + 3, y + 7, 2, 7, '#e8e8ec'); g.r(x + 20, y + 11, 3, 2, '#9cc8e8');
  },
  key: (g, x, y, a) => {
    g.disc(x + 7, y + 12, 5, '#e8c020'); g.disc(x + 7, y + 12, 2, a.bg); g.r(x + 11, y + 11, 11, 3, '#e8c020'); g.r(x + 17, y + 14, 2, 3, '#e8c020'); g.r(x + 20, y + 14, 2, 4, '#e8c020');
  },
  star: (g, x, y, a) => {
    for (let k = 0; k < 10; k++) { const t = (k / 10) * Math.PI * 2 - Math.PI / 2, rad = k % 2 ? 4 : 11; g.disc(x + 12 + Math.cos(t) * rad * 0.7, y + 13 + Math.sin(t) * rad * 0.7, 3, a.ac); }
    g.disc(x + 12, y + 13, 5, a.ac);
  },
  mag: (g, x, y, a) => {
    g.r(x + 4, y + 1, 16, 22, '#f4f4f0'); g.r(x + 4, y + 1, 16, 5, a.ac); car(g, x + 5, y + 18, 14, '#d02020'); g.r(x + 6, y + 19, 10, 1, '#202020'); g.r(x + 6, y + 21, 7, 1, '#202020');
  },
  car: (g, x, y, a) => car(g, x, y + 20, 24, a.ac, 'sport'),
  bus: (g, x, y, a) => {
    g.r(x + 1, y + 6, 22, 13, a.ac); for (let k = 0; k < 5; k++) g.r(x + 2 + k * 4, y + 8, 3, 4, '#9cc8e8'); g.disc(x + 6, y + 19, 2, '#151515'); g.disc(x + 18, y + 19, 2, '#151515');
  },
  helmet: (g, x, y, a) => {
    g.disc(x + 12, y + 12, 10, a.ac); g.r(x + 2, y + 15, 21, 8, a.bg); g.r(x + 9, y + 9, 13, 5, '#202838'); g.r(x + 3, y + 13, 19, 2, a.ac); g.r(x + 5, y + 6, 6, 1, '#ffffff');
  },
};

// ---------- os 100 anúncios ----------
// l: layout (L/R ícone à esquerda/direita, C texto central com faixas, S pôr do sol, M capa de
// revista, K anúncio de carro); t: título; s: frase; bg/fg/ac: fundo, texto, destaque; i: ícone ou
// tipo do carro; b: segunda cor do fundo
const A = (l: Ad['l'], t: string, s: string, bg: string, fg: string, ac: string, i?: string, b?: string): Ad => ({ l, t, s, bg, fg, ac, i, b });
export const ADS: Ad[] = [
  // capas da revista DUEL RACER com os carros do jogo (i: foto de lado, de frente, de trás ou comparativo)
  A('M', 'TESTE EXCLUSIVO', 'NAS BANCAS', '#efe6d2', '#1a1614', '#d01f26', 'test'),
  A('M', 'POR TODOS OS ANGULOS', 'NAS BANCAS', '#efe6d2', '#1a1614', '#1e4fb8', 'front'),
  A('M', 'FLAGRA NA ESTRADA', 'NAS BANCAS', '#efe6d2', '#1a1614', '#1a1614', 'rear'),
  A('M', 'COMPARATIVO', 'NAS BANCAS', '#efe6d2', '#1a1614', '#1f7a3a', 'compare'),
  A('M', 'ESPECIAL NACIONAIS', 'NAS BANCAS', '#efe6d2', '#1a1614', '#d01f26', 'test'),
  A('M', 'O MAIS RAPIDO DO ANO', 'NAS BANCAS', '#efe6d2', '#1a1614', '#d01f26', 'test'),
  A('M', 'NA CONTRAMAO', 'NAS BANCAS', '#efe6d2', '#1a1614', '#1e4fb8', 'front'),
  A('M', 'TESTE DE ESTRADA', 'NAS BANCAS', '#efe6d2', '#1a1614', '#1a1614', 'rear'),
  A('M', 'DUELO DO MES', 'NAS BANCAS', '#efe6d2', '#1a1614', '#1f7a3a', 'compare'),
  A('M', 'EDICAO DE COLECIONADOR', 'NAS BANCAS', '#efe6d2', '#1a1614', '#d01f26', 'test'),
  A('M', 'OS CAMPEOES DA SERRA', 'NAS BANCAS', '#efe6d2', '#1a1614', '#d01f26', 'front'),
  A('M', 'ACELERAMOS', 'NAS BANCAS', '#efe6d2', '#1a1614', '#1e4fb8', 'test'),
  A('M', '0 A 100: QUEM VENCE?', 'NAS BANCAS', '#efe6d2', '#1a1614', '#1a1614', 'compare'),
  A('M', 'TESTE NA CHUVA', 'NAS BANCAS', '#efe6d2', '#1a1614', '#1f7a3a', 'rear'),
  A('M', 'CARRO DO ANO 1994', 'NAS BANCAS', '#efe6d2', '#1a1614', '#d01f26', 'test'),
  A('M', 'FLAGRA NO LITORAL', 'NAS BANCAS', '#efe6d2', '#1a1614', '#d01f26', 'front'),
  A('M', 'TESTE COMPLETO', 'NAS BANCAS', '#efe6d2', '#1a1614', '#1e4fb8', 'test'),
  A('M', 'DE OLHO NO RADAR', 'NAS BANCAS', '#efe6d2', '#1a1614', '#1a1614', 'rear'),
  A('M', 'FICHA TECNICA', 'NAS BANCAS', '#efe6d2', '#1a1614', '#1f7a3a', 'test'),
  A('M', 'NAS BANCAS!', 'NAS BANCAS', '#efe6d2', '#1a1614', '#d01f26', 'front'),
  // concessionárias com os carros do jogo
  A('K', 'AUTO VALE VEICULOS', '0KM - TAXA ZERO', '#1e4fb8', '#ffffff', '#ffd21a', undefined, '#0a1a5a'),
  A('K', 'GARAGEM CENTRAL', 'SEMINOVOS COM GARANTIA', '#1a1614', '#ffd21a', '#d01f26', undefined, '#000000'),
  A('K', 'MOTORSUL', 'CONSORCIO EM 50 MESES', '#e8e8e0', '#1a1614', '#1f7a3a', undefined, '#b8b8b0'),
  A('K', 'RODOCAR', 'TROCA NA HORA', '#d01f26', '#ffffff', '#ffd21a', undefined, '#7a0a10'),
  A('K', 'SERRA VEICULOS', 'FINANCIAMENTO EM 24X', '#2a2a3a', '#e8c060', '#e8c060', undefined, '#0a0a14'),
  A('K', 'LITORAL MOTORS', 'ACEITAMOS SEU USADO', '#2a7ad0', '#ffffff', '#ffd21a', undefined, '#0a3a7a'),
  A('K', 'CARRO NOVO JA', 'SAIA DIRIGINDO HOJE', '#ffd21a', '#1a1614', '#d01f26', undefined, '#c89a10'),
  A('K', 'IMPORTADOS PRIME', 'OS MAIS DESEJADOS', '#101018', '#ffffff', '#d01f26', undefined, '#000000'),
  A('K', 'FEIRAO DO USADO', 'SABADO E DOMINGO', '#ff8a20', '#ffffff', '#1a1614', undefined, '#c04a10'),
  A('K', 'AUTO PECA VEICULOS', 'REVISAO GRATIS', '#1f7a3a', '#ffffff', '#ffd21a', undefined, '#0a3a1a'),
  A('K', 'CENTRO AUTOMOTIVO', 'SEU CARRO NOVO AQUI', '#efe6d2', '#1a1614', '#1e4fb8', undefined, '#c8bca0'),
  A('K', 'METROPOLE MOTORS', 'PRIMEIRA PARCELA EM 95', '#5a1a8a', '#ffffff', '#ff60c0', undefined, '#20083a'),
  // peças e serviços
  A('L', 'PISTAO FORTE', 'PECAS DE MOTOR', '#202024', '#ffd020', '#ffd020', 'piston'),
  A('R', 'VELAS FAISCA', 'PARTIDA NA HORA', '#1a3aa8', '#ffffff', '#ffe040', 'plug'),
  A('L', 'PNEUS RODAGEM', 'ADERENCIA TOTAL', '#ffd020', '#202020', '#202020', 'tire'),
  A('R', 'RODAS ESTRELA', 'ARO 15 EM 10X', '#202024', '#ffffff', '#d02020', 'rim'),
  A('L', 'MOLAFORTE', 'AMORTECEDORES', '#e05a10', '#ffffff', '#ffd020', 'shock'),
  A('R', 'RONCO BRAVO', 'ESCAPAMENTO ESPORTIVO', '#3a3a40', '#ff7a20', '#ff7a20', 'exhaust'),
  A('L', 'BATERIAS VOLTA', '18 MESES DE GARANTIA', '#1a6a3a', '#ffffff', '#d02020', 'battery'),
  A('R', 'VISCO 20W50', 'OLEO PARA MOTOR', '#ffd020', '#202020', '#1a3aa8', 'oil'),
  A('L', 'TURBO KIT', 'MAIS 40% DE POTENCIA', '#101018', '#40ff60', '#40ff60', 'turbo'),
  A('R', 'SOM PESADO', 'AUTO SOM 200W', '#2a0a3a', '#ff40c0', '#ff40c0', 'speaker'),
  A('L', 'ALARME TRAVA', 'PROTEJA SEU CARRO', '#202024', '#ffffff', '#d02020', 'alarm'),
  A('R', 'FAROL DE MILHA', 'ENXERGUE MAIS LONGE', '#101830', '#fff4b0', '#ffe040', 'lamp'),
  A('L', 'AUTO CENTER', 'MECANICA E FUNILARIA', '#d02020', '#ffffff', '#ffffff', 'wrench'),
  A('R', 'CAPACETES ZOOM', 'SEGURANCA NA PISTA', '#f4f4f0', '#202020', '#d02020', 'helmet'),
  // combustível
  A('L', 'POSTO ESTRELA', 'GASOLINA ADITIVADA', '#d02020', '#ffffff', '#ffe040', 'pump'),
  A('R', 'AZUL', 'COMBUSTIVEL DE RAIZ', '#1a3aa8', '#ffffff', '#40a0ff', 'drop'),
  A('L', 'ALCOOL TERRA', 'DIRETO DA USINA', '#2a8a3a', '#ffffff', '#a0e040', 'drop'),
  A('C', 'POSTO 24H', 'A 2 KM - LOJA E CAFE', '#ffd020', '#202020', '#d02020'),
  A('R', 'SOLARIS', 'ABASTECEU, GANHOU!', '#ff8a20', '#ffffff', '#ffe040', 'pump'),
  A('L', 'RODOPOSTO', 'DUCHA GRATIS', '#202024', '#40e0ff', '#40e0ff', 'pump'),
  A('C', 'GASOLINA', 'COMPLETE ATE O FIM', '#2a2a6a', '#ffffff', '#ff4040'),
  // polícia e segurança no trânsito
  A('L', 'RADAR A 500M', 'FISCALIZACAO NA PISTA', '#ffd020', '#202020', '#202020', 'radar'),
  A('C', 'SE BEBER', 'NAO DIRIJA', '#202024', '#ffffff', '#d02020'),
  A('R', 'USE O CINTO', 'SALVA VIDAS', '#1a3aa8', '#ffffff', '#ffe040', 'belt'),
  A('L', 'MAXIMA 80', 'RESPEITE O LIMITE', '#f4f4f0', '#202020', '#d02020', 'limit'),
  A('R', 'POLICIA', 'RODOVIARIA - 190', '#1a2a5a', '#ffffff', '#e8c020', 'badge'),
  A('L', 'OBRAS', 'REDUZA A VELOCIDADE', '#ff7a10', '#202020', '#202020', 'cone'),
  A('C', 'PARE NO PEDAGIO', 'A 3 KM', '#2a8a3a', '#ffffff', '#ffffff'),
  A('R', 'BLITZ', 'DOCUMENTOS EM DIA', '#202024', '#ffd020', '#ffd020', 'badge'),
  // telefonia
  A('R', 'TELENOVA', 'CELULAR PARA TODOS', '#7a2ac8', '#ffffff', '#ffe040', 'cell'),
  A('L', 'FALA MAIS', 'MINUTOS EM DOBRO', '#e02060', '#ffffff', '#ffffff', 'cell'),
  A('R', 'ONDA TEL', 'COBERTURA NA ESTRADA', '#1a8ab0', '#ffffff', '#ffe040', 'cell'),
  A('L', 'BIP BIP', 'SEU PAGER CHAMA', '#202024', '#a8ff90', '#a8ff90', 'pager'),
  A('R', 'ORELHAO', 'CARTAO 50 UNIDADES', '#f0a020', '#202020', '#1a3aa8', 'payphone'),
  A('C', 'DISK PIZZA', '555-0190', '#d02020', '#ffffff', '#ffe040'),
  // rádio
  A('L', 'RODOVIA FM', '98.7 - SEU PARCEIRO', '#202024', '#ffb020', '#ffb020', 'radio'),
  A('R', 'TURBO FM', '101.5 SO SUCESSO', '#1a3aa8', '#ffffff', '#ff40c0', 'waves'),
  A('L', 'ROCK 87', 'FM - ALTO VOLUME', '#101010', '#ff3020', '#ff3020', 'waves'),
  A('R', 'AM 640', 'NOTICIAS 24 HORAS', '#f4f4f0', '#1a3aa8', '#d02020', 'radio'),
  A('S', 'NOITE FM', 'FM 92.1', '#1a0a3a', '#ff60e0', '#ffd020', 'city', '#ff4a8a'),
  // lugares
  A('S', 'PRAIA DO SOL', 'A 12 KM', '#2a6ad8', '#ffffff', '#ffd020', 'palm', '#ff8a40'),
  A('S', 'SERRA AZUL', 'MIRANTE A 3 KM', '#1a2a6a', '#ffffff', '#ffd020', 'mountain', '#6a8ad8'),
  A('S', 'CANYON VERMELHO', 'PARQUE NACIONAL', '#3a1a3a', '#ffe0a0', '#ff7a20', 'canyon', '#ff6a2a'),
  A('S', 'CIDADE NEON', 'NOITE SEM FIM', '#0a0a2a', '#40ffff', '#ff40c0', 'city', '#5a1a8a'),
  A('R', 'AQUA PARQUE', 'TOBOGA E PISCINAS', '#40b0ff', '#ffffff', '#ffe040', 'pool'),
  A('L', 'HOTEL FAZENDA', 'CAVALOS E PESCARIA', '#3a7a2a', '#ffffff', '#ffe8a0', 'house'),
  A('L', 'AUTODROMO', 'CORRIDA DOMINGO 14H', '#202024', '#ffffff', '#d02020', 'flag'),
  A('R', 'CHURRASCARIA', 'RODIZIO - PROX. SAIDA', '#6a2a10', '#ffe0a0', '#ffe0a0', 'fork'),
  A('L', 'MOTEL ESTRELA', 'SUITES COM HIDRO', '#3a0a2a', '#ff80c0', '#ff80c0', 'heart'),
  A('C', 'BEM-VINDO', 'VOLTE SEMPRE!', '#2a8a3a', '#ffffff', '#ffe040'),
  A('L', 'RODOVIARIA', 'ONIBUS PARA O LITORAL', '#1a3aa8', '#ffffff', '#ffe040', 'bus'),
  // comidas e bebidas
  A('R', 'COLA GELADA', 'O SABOR DA ESTRADA', '#d02020', '#ffffff', '#ffffff', 'bottle'),
  A('L', 'GUARAMAX', 'REFRIGERANTE EM LATA', '#2a8a3a', '#ffffff', '#d02020', 'can'),
  A('R', 'SORVETE POLAR', 'REFRESCA O CALOR', '#40b0ff', '#ffffff', '#ff9ac0', 'icecream'),
  A('L', 'CAFE DA SERRA', 'PARADA OBRIGATORIA', '#4a2a10', '#ffe0a0', '#ffe0a0', 'cup'),
  A('R', 'BURGER 90', 'LANCHE EM 5 MINUTOS', '#ffd020', '#d02020', '#d02020', 'burger'),
  A('L', 'PIZZA EXPRESSA', 'ENTREGA NA RODOVIA', '#202024', '#ffd040', '#ff4020', 'pizza'),
  A('L', 'SUCO TROPICAL', '100% DA FRUTA', '#ff9020', '#ffffff', '#2a8a3a', 'orange'),
  // eletrônicos, moda e outros
  A('L', 'VIDEO CLUBE', 'LANCAMENTOS EM VHS', '#1a1a4a', '#ffd020', '#ffd020', 'vhs'),
  A('R', 'FITA K7', 'GRAVE SUAS MUSICAS', '#e02060', '#ffffff', '#ffe040', 'tape'),
  A('L', 'TV TELA 29', 'CONTROLE REMOTO!', '#202024', '#ffffff', '#40a0ff', 'tv'),
  A('R', 'TURBO 16 BITS', 'O VIDEOGAME DO ANO', '#101010', '#ff4040', '#40a0ff', 'pad'),
  A('L', 'FOTO RAPIDA', 'REVELE EM 1 HORA', '#ffd020', '#d02020', '#d02020', 'camera'),
  A('R', 'MICRO 486', 'COM KIT MULTIMIDIA', '#e0dcc8', '#1a3aa8', '#1a3aa8', 'pc'),
  A('L', 'SHOPPING SUL', 'LIQUIDACAO DE VERAO', '#ff8a20', '#ffffff', '#d02020', 'bag'),
  A('S', 'DUEL RACER', 'O DESAFIO', '#1a0a3a', '#ffd020', '#ff40c0', 'car', '#ff4a8a'),
  A('R', 'CAMPEONATO', 'INSCRICOES ABERTAS', '#202024', '#ffd020', '#ffd020', 'trophy'),
  A('C', 'ANUNCIE AQUI', 'TEL 555-0123', '#f4f4f0', '#202020', '#d02020'),
];

// ---------- desenho de cada layout ----------
// Tudo no visual das telas do jogo: a fonte e a tipografia da revista (logotipo com contorno,
// chapéu, retícula de impressão) e, nas capas e concessionárias, os sprites dos carros do jogo.
// A arte é feita em AW x AH unidades com 2 pixels por unidade (a fonte fica nítida em 8 e 16 px).
const SC = 2;
const fontOk = () => document.fonts?.check?.('16px "Press Start 2P"') ?? true;
const coverCars = () => CARS.filter((c) => c.imgSide && c.rear.img && c.rear.frontImg && !c.arcadeOnly);
// carro de cada capa/concessionária (em sequência pela lista de carros com arte)
function adCar(a: Ad) {
  const list = coverCars();
  const k = a.l === 'M' ? ADS.filter((x) => x.l === 'M').indexOf(a) : ADS.filter((x) => x.l === 'K').indexOf(a) * 2 + 1;
  return list.length ? list[k % list.length] : undefined;
}
const carReady = (car?: CarSpec) => !!car && !!spriteAspect(car.imgSide!) && !!spriteAspect(car.rear.img!) && !!spriteAspect(car.rear.frontImg!);

function tw(c: CanvasRenderingContext2D, s: string, size: number) {
  c.font = `${size}px ${FONT}`;
  return c.measureText(fixGlyphs(s)).width;
}
// título com contorno (logotipo da revista): 8 unidades se couber na largura (em até `lines`
// linhas), senão 4; o contorno contrasta com a cor do texto
function title(c: CanvasRenderingContext2D, s: string, x: number, y: number, w: number, fill: string, _out: string, align: CanvasTextAlign = 'left', lines = 1) {
  const out = luma(fill) > 120 ? '#1a1614' : 'rgba(255,255,255,0.7)';
  let rows = [s];
  let size = tw(c, s, 8) <= w ? 8 : 0;
  if (!size && lines > 1) {
    // duas linhas, quebrando no espaço que deixa as duas mais parecidas
    const words = s.split(' ');
    let best: string[] | null = null;
    for (let k = 1; k < words.length; k++) {
      const r = [words.slice(0, k).join(' '), words.slice(k).join(' ')];
      if (Math.max(tw(c, r[0], 8), tw(c, r[1], 8)) <= w && (!best || Math.abs(r[0].length - r[1].length) < Math.abs(best[0].length - best[1].length))) best = r;
    }
    if (best) {
      rows = best;
      size = 8;
    }
  }
  if (!size) size = 4;
  const ax = align === 'center' ? x + w / 2 : align === 'right' ? x + w : x;
  rows.forEach((row, k) => {
    const yy = y + k * 9 + (size === 4 ? 2 : 0);
    if (size === 8) for (const [dx, dy] of [[-0.5, 0], [0.5, 0], [0, -0.5], [0, 0.5], [1, 1]]) text(c, row, ax + dx, yy + dy, size, out, align, null);
    else text(c, row, ax + 0.5, yy + 0.5, size, out, align, null);
    text(c, row, ax, yy, size, fill, align, null);
  });
  return size;
}
// faixa com texto pequeno (chapéu de revista)
function ribbon(c: CanvasRenderingContext2D, s: string, x: number, y: number, bg: string, fg: string, w?: number) {
  const ww = w ?? tw(c, s, 4) + 4;
  c.fillStyle = bg;
  c.fillRect(x, y, ww, 7);
  text(c, s, w ? x + ww / 2 : x + 2, y + 1.5, 4, fg, w ? 'center' : 'left', null);
}
function dots(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, col: string) {
  c.fillStyle = col;
  for (let yy = y; yy < y + h; yy += 2) for (let xx = x + ((yy - y) / 2) % 2; xx < x + w; xx += 2) c.fillRect(xx, yy, 0.5, 0.5);
}
const ink2 = (bg: string) => (luma(bg) > 140 ? '#1a1614' : '#ffffff');

function drawAd(c: CanvasRenderingContext2D, a: Ad) {
  const g = new Pen(c);
  const icon = a.i ? ICONS[a.i] : undefined;
  g.r(0, 0, AW, AH, a.bg);
  if (a.l === 'M') {
    // capa da revista DUEL RACER: faixa vermelha com o logotipo, foto de estúdio com o carro
    const car = adCar(a);
    c.fillStyle = '#efe6d2';
    c.fillRect(0, 0, AW, AH);
    dots(c, 0, 0, AW, AH, 'rgba(120,96,60,0.18)');
    c.fillStyle = '#d01f26';
    c.fillRect(0, 0, AW, 11);
    title(c, 'DUEL RACER', 3, 1.5, 90, '#ffd21a', '#1a1614');
    text(c, 'Nº' + String((ADS.indexOf(a) % 12) + 1).padStart(2, '0'), AW - 3, 1, 4, '#ffe0a0', 'right', null);
    text(c, '1994', AW - 3, 6, 4, '#ffe0a0', 'right', null);
    // foto: fundo infinito de estúdio
    const py = 12, ph = AH - py - 1;
    for (let y = 0; y < ph; y++) {
      const f = y / ph;
      c.fillStyle = f < 0.66 ? mix('#5e6670', '#c8cdd2', f / 0.66) : mix('#aeb3b8', '#d2d6da', (f - 0.66) / 0.34);
      c.fillRect(1, py + y, AW - 2, 1);
    }
    if (car) {
      c.save();
      c.beginPath();
      c.rect(1, py, AW - 2, ph);
      c.clip();
      const look = { color: car.color, rear: car.rear };
      if (a.i === 'front') drawCar(c, AW - 34, AH - 3, 40, { ...look, front: true });
      else if (a.i === 'rear') drawCar(c, AW - 34, AH - 3, 40, look);
      else if (a.i === 'compare') {
        const other = coverCars()[(coverCars().indexOf(car) + 5) % coverCars().length];
        c.save();
        c.translate(2 * (AW - 88) + 44, 0);
        c.scale(-1, 1);
        drawCarSide(c, AW - 88, AH - 3, 44, car);
        c.restore();
        drawCarSide(c, AW - 46, AH - 3, 44, other);
        text(c, 'X', AW - 46, py + 10, 8, '#ffd21a', 'center', '#1a1614');
      } else drawCarSide(c, AW - 70, AH - 3, 68, car);
      c.restore();
      ribbon(c, a.t, 3, py + 2, a.ac, a.ac === '#1a1614' ? '#ffd21a' : '#ffffff');
      title(c, car.name.toUpperCase(), 3, py + 11, a.i === 'compare' ? 40 : 56, '#ffffff', '#1a1614');
      ribbon(c, `${car.power} • ${Math.round(car.maxSpeed * KMH)} KM/H`, 3, AH - 9, 'rgba(26,22,20,0.82)', '#ffffff');
    }
  } else if (a.l === 'K') {
    // concessionária: salão de vendas com o carro do jogo, nome da loja e a oferta
    const car = adCar(a);
    const b = a.b ?? shade(a.bg, 0.6);
    for (let y = 0; y < AH; y++) {
      c.fillStyle = mix(a.bg, b, y / AH);
      c.fillRect(0, y, AW, 1);
    }
    dots(c, 0, 24, AW, 9, 'rgba(255,255,255,0.12)');
    c.fillStyle = 'rgba(0,0,0,0.18)';
    c.fillRect(0, 31, AW, 2);
    title(c, a.t, 3, 2, AW - 6, a.fg, '#1a1614', 'left');
    if (car) {
      drawCarSide(c, 4, 33, 62, car);
      ribbon(c, car.name.toUpperCase(), 70, 16, a.ac, ink2(a.ac));
      text(c, '0KM', 72, 24, 4, a.fg, 'left', '#1a1614');
    }
    c.fillStyle = a.ac;
    c.fillRect(0, AH - 8, AW, 8);
    text(c, a.s, AW / 2, AH - 6.5, 4, ink2(a.ac), 'center', null);
  } else if (a.l === 'L' || a.l === 'R') {
    // anúncio de produto: retícula de impressão, ícone grande, título com contorno e a faixa
    const left = a.l === 'L';
    dots(c, 0, 0, AW, AH, 'rgba(0,0,0,0.16)');
    c.fillStyle = shade(a.bg, 0.8);
    c.beginPath();
    if (left) { c.moveTo(0, 0); c.lineTo(40, 0); c.lineTo(30, AH); c.lineTo(0, AH); }
    else { c.moveTo(AW, 0); c.lineTo(AW - 40, 0); c.lineTo(AW - 30, AH); c.lineTo(AW, AH); }
    c.fill();
    c.save();
    c.translate(left ? 3 : AW - 33, 1);
    c.scale(1.25, 1.25);
    icon?.(g, 0, 0, a);
    c.restore();
    const x0 = left ? 36 : 3, w = AW - 39;
    title(c, a.t, x0, tw(c, a.t, 8) <= w ? 8 : 4, w, a.fg, '#1a1614', 'center', 2);
    const sub = a.ac === a.bg ? a.fg : a.ac;
    c.fillStyle = sub;
    c.fillRect(x0 - 1, 25, w + 2, 9);
    text(c, a.s, x0 + w / 2, 27.5, 4, ink2(sub), 'center', null);
  } else if (a.l === 'C') {
    dots(c, 0, 0, AW, AH, 'rgba(0,0,0,0.14)');
    for (let x = 0; x < AW; x += 8) {
      c.fillStyle = a.ac;
      c.fillRect(x, 0, 4, 3);
      c.fillRect(x + 4, AH - 3, 4, 3);
    }
    title(c, a.t, 3, tw(c, a.t, 8) <= AW - 6 ? 9 : 5, AW - 6, a.fg, '#1a1614', 'center', 2);
    text(c, a.s, AW / 2, 26, 4, a.fg, 'center', '#1a1614');
  } else {
    // pôr do sol synthwave (rádios e lugares)
    const b = a.b ?? a.ac;
    for (let y = 0; y < AH; y++) {
      c.fillStyle = mix(a.bg, b, Math.min(1, y / (AH - 8)));
      c.fillRect(0, y, AW, 1);
    }
    g.disc(AW - 28, AH - 8, 14, a.ac);
    for (let y = AH - 18; y < AH; y += 3) {
      c.fillStyle = mix(a.bg, b, 0.85);
      c.fillRect(AW - 44, y, 32, 1);
    }
    c.fillStyle = '#120a20';
    c.fillRect(0, AH - 7, AW, 7);
    c.fillStyle = b;
    c.fillRect(0, AH - 7, AW, 1);
    for (let x = 0; x < AW; x += 10) c.fillRect(x, AH - 6, 1, 6);
    c.save();
    c.translate(AW - 42, AH - 37);
    c.scale(1.2, 1.2);
    icon?.(g, 0, 0, a);
    c.restore();
    title(c, a.t, 3, 4, 76, a.fg, '#1a1614', 'left', 2);
    text(c, a.s, 3, 23, 4, '#ffffff', 'left', '#1a1614');
  }
}
function luma(c: string) {
  const m = c.match(/\d+/g);
  const [r, g, b] = c.startsWith('#') ? [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)] : (m ?? ['0', '0', '0']).map(Number);
  return 0.3 * r + 0.59 * g + 0.11 * b;
}
function mix(a: string, b: string, t: number) {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const ch = (s: number) => Math.round(((pa >> s) & 255) * (1 - t) + ((pb >> s) & 255) * t);
  return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
}

// anúncios prontos (fonte e sprites carregados): enquanto não, o outdoor mostra a versão
// provisória e não guarda em cache
const cache = new Map<number, HTMLCanvasElement>();
export function adsReady(n: number) {
  const a = ADS[((n % ADS.length) + ADS.length) % ADS.length];
  return fontOk() && (a.l !== 'M' && a.l !== 'K' ? true : carReady(adCar(a)));
}
// arte do anúncio n (0..99): AW x AH unidades, 2 pixels por unidade
export function adCanvas(n: number) {
  const i = ((n % ADS.length) + ADS.length) % ADS.length;
  let cv = cache.get(i);
  if (cv) return cv;
  cv = document.createElement('canvas');
  cv.width = AW * SC;
  cv.height = AH * SC;
  const c = cv.getContext('2d')!;
  c.imageSmoothingEnabled = false;
  c.scale(SC, SC);
  drawAd(c, ADS[i]);
  if (adsReady(i)) cache.set(i, cv);
  return cv;
}

// desenha antes os anúncios da pista, um por quadro, para não travar quando o outdoor aparece
export function prewarmAds(ids: number[]) {
  const todo = [...new Set(ids)];
  let tries = 0;
  const step = () => {
    const i = todo.shift();
    if (i === undefined) return;
    adCanvas(i);
    if (!cache.has(i) && tries++ < 200) todo.push(i); // fonte ou sprites ainda carregando: tenta depois
    setTimeout(step, 30);
  };
  setTimeout(step, 30);
}
