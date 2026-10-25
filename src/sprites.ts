import { dither } from './ui';

// Objetos de cenário desenhados por código. Cada função desenha numa caixa:
// x = centro, y = base, w/h em pixels.

export type SpriteKind =
  | 'tree' | 'pine' | 'snowpine' | 'bush' | 'cactus' | 'rock' | 'palm' | 'post'
  | 'building' | 'house' | 'fence' | 'lamp' | 'signL' | 'signR' | 'gasSign' | 'station';

type Draw = (c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, seed: number) => void;

const poly = (c: CanvasRenderingContext2D, color: string | CanvasPattern, ...pts: number[]) => {
  c.fillStyle = color;
  c.beginPath();
  c.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]);
  c.closePath();
  c.fill();
};
const ell = (c: CanvasRenderingContext2D, color: string | CanvasPattern, x: number, y: number, rx: number, ry: number) => {
  c.fillStyle = color;
  c.beginPath();
  c.ellipse(x, y, Math.max(0.5, rx), Math.max(0.5, ry), 0, 0, Math.PI * 2);
  c.fill();
};

const tree: Draw = (c, x, y, w, h) => {
  c.fillStyle = '#3e2812';
  c.fillRect(x - w * 0.07, y - h * 0.45, w * 0.14, h * 0.45);
  ell(c, dither(c, '#0c4412', '#145a18'), x, y - h * 0.62, w * 0.5, h * 0.36);
  ell(c, dither(c, '#145a18', '#24782a'), x - w * 0.12, y - h * 0.7, w * 0.3, h * 0.22);
};

const pineDraw = (snow: boolean): Draw => (c, x, y, w, h) => {
  c.fillStyle = '#4a3220';
  c.fillRect(x - w * 0.06, y - h * 0.18, w * 0.12, h * 0.18);
  for (let i = 0; i < 3; i++) {
    const by = y - h * (0.12 + i * 0.24);
    const bw = w * (0.5 - i * 0.12);
    poly(c, dither(c, '#0a3a18', '#145026'), x - bw, by, x + bw, by, x, by - h * 0.42);
    if (snow) poly(c, '#f4f8fc', x - bw * 0.45, by - h * 0.24, x + bw * 0.45, by - h * 0.24, x, by - h * 0.42);
  }
};

const bush: Draw = (c, x, y, w, h) => {
  ell(c, dither(c, '#0e4a12', '#18601a'), x, y - h * 0.45, w / 2, h * 0.5);
  ell(c, dither(c, '#18601a', '#287a26'), x - w * 0.12, y - h * 0.6, w * 0.28, h * 0.28);
};

const cactus: Draw = (c, x, y, w, h) => {
  const t = w * 0.3;
  c.fillStyle = '#2e7a32';
  c.fillRect(x - t / 2, y - h, t, h);
  c.fillRect(x - w / 2, y - h * 0.55, w / 2, t * 0.7);
  c.fillRect(x - w / 2, y - h * 0.8, t * 0.7, h * 0.3);
  c.fillRect(x, y - h * 0.42, w / 2, t * 0.7);
  c.fillRect(x + w / 2 - t * 0.7, y - h * 0.7, t * 0.7, h * 0.32);
  c.fillStyle = '#48a04c';
  c.fillRect(x - t / 2, y - h, t * 0.3, h);
};

const rock: Draw = (c, x, y, w, h) => {
  poly(c, '#7a6a5e', x - w / 2, y, x - w * 0.36, y - h * 0.7, x - w * 0.05, y - h, x + w * 0.38, y - h * 0.62, x + w / 2, y);
  poly(c, '#9c8a7a', x - w * 0.36, y - h * 0.7, x - w * 0.05, y - h, x, y - h * 0.4, x - w * 0.25, y - h * 0.3);
};

const palm: Draw = (c, x, y, w, h) => {
  const tw = Math.max(1, w * 0.08);
  const tx = x + w * 0.12, ty = y - h * 0.8;
  poly(c, '#8a5a2b', x - tw, y, x + tw, y, tx + tw * 0.6, ty, tx - tw * 0.6, ty);
  for (const [lx, ly] of [[-0.5, 0.05], [-0.4, -0.16], [-0.12, -0.2], [0.18, -0.19], [0.44, -0.1], [0.5, 0.08]]) {
    poly(c, '#2a7a2a', tx, ty - h * 0.02, tx + lx * w, ty - ly * h, tx + lx * w * 0.6, ty + h * 0.06);
  }
};

const post: Draw = (c, x, y, w, h) => {
  c.fillStyle = '#f0f0f0';
  c.fillRect(x - w / 2, y - h, Math.max(1, w), h);
  c.fillStyle = '#9a9a9a';
  c.fillRect(x + w / 2 - Math.max(0.5, w * 0.3), y - h, Math.max(0.5, w * 0.3), h);
};

const building: Draw = (c, x, y, w, h, seed) => {
  const hh = h * (0.55 + (seed % 45) / 100);
  const colors = ['#8a8aa0', '#a09078', '#707890', '#b0a890', '#7a6a80'];
  c.fillStyle = colors[seed % colors.length];
  c.fillRect(x - w / 2, y - hh, w, hh);
  if (w < 10) return;
  const cols = 4, rows = 8;
  const cw = w / (cols * 2 + 1), rh = hh / (rows * 2 + 1);
  c.fillStyle = '#2a3a5a';
  for (let r = 0; r < rows; r++)
    for (let k = 0; k < cols; k++) c.fillRect(x - w / 2 + cw * (k * 2 + 1), y - hh + rh * (r * 2 + 1), cw, rh);
};

const house: Draw = (c, x, y, w, h, seed) => {
  c.fillStyle = seed % 2 ? '#e8dcc0' : '#f0f0e8';
  c.fillRect(x - w * 0.4, y - h * 0.55, w * 0.8, h * 0.55);
  poly(c, seed % 3 ? '#a03a2a' : '#5a4a3a', x - w / 2, y - h * 0.55, x + w / 2, y - h * 0.55, x, y - h);
  c.fillStyle = '#5a3a20';
  c.fillRect(x - w * 0.06, y - h * 0.3, w * 0.12, h * 0.3);
  c.fillStyle = '#3a5a8a';
  c.fillRect(x - w * 0.3, y - h * 0.45, w * 0.14, h * 0.13);
  c.fillRect(x + w * 0.16, y - h * 0.45, w * 0.14, h * 0.13);
};

const fence: Draw = (c, x, y, w, h) => {
  c.fillStyle = '#c8b090';
  c.fillRect(x - w / 2, y - h * 0.75, w, Math.max(1, h * 0.12));
  c.fillRect(x - w / 2, y - h * 0.4, w, Math.max(1, h * 0.12));
  for (let i = 0; i <= 4; i++) c.fillRect(x - w / 2 + (w * i) / 4 - w * 0.015, y - h, Math.max(1, w * 0.03), h);
};

const lamp: Draw = (c, x, y, w, h) => {
  c.fillStyle = '#707070';
  c.fillRect(x - w * 0.15, y - h, w * 0.3, h);
  c.fillRect(x - w * 1.5, y - h, w * 1.6, w * 0.3);
  c.fillStyle = '#fff4b0';
  c.fillRect(x - w * 1.6, y - h + w * 0.2, w * 0.6, w * 0.25);
};

const sign = (dir: 1 | -1): Draw => (c, x, y, w, h) => {
  c.fillStyle = '#666';
  c.fillRect(x - w * 0.05, y - h * 0.5, w * 0.1, h * 0.5);
  c.fillStyle = '#ffcc00';
  c.fillRect(x - w / 2, y - h, w, h * 0.55);
  const cy = y - h * 0.725, s = w * 0.28;
  poly(c, '#111', x - s * dir, cy - s * 0.8, x + s * dir, cy, x - s * dir, cy + s * 0.8, x - s * 0.4 * dir, cy);
};

const gasSign: Draw = (c, x, y, w, h) => {
  c.fillStyle = '#777';
  c.fillRect(x - w * 0.04, y - h * 0.55, w * 0.08, h * 0.55);
  c.fillStyle = '#1a3aa8';
  c.fillRect(x - w / 2, y - h, w, h * 0.45);
  c.fillStyle = '#fff';
  c.fillRect(x - w / 2 + 1, y - h + 1, w - 2, Math.max(1, h * 0.04));
  if (w > 14) {
    c.font = `${Math.floor(h * 0.22)}px "Press Start 2P", monospace`;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillStyle = '#ffd400';
    c.fillText('GAS', x, y - h * 0.78);
  }
};

const station: Draw = (c, x, y, w, h) => {
  c.fillStyle = '#f2f2f2';
  c.fillRect(x - w * 0.35, y - h * 0.7, w * 0.7, h * 0.7);
  c.fillStyle = '#c82020';
  c.fillRect(x - w / 2, y - h * 0.8, w, h * 0.12);
  c.fillStyle = '#2a4a8a';
  c.fillRect(x - w * 0.28, y - h * 0.55, w * 0.16, h * 0.22);
  c.fillRect(x + w * 0.12, y - h * 0.55, w * 0.16, h * 0.22);
  c.fillStyle = '#d02a2a';
  c.fillRect(x - w * 0.05, y - h * 0.3, w * 0.05, h * 0.3);
  c.fillRect(x + w * 0.04, y - h * 0.3, w * 0.05, h * 0.3);
  c.fillStyle = '#555';
  c.fillRect(x - w * 0.45, y - h * 0.8, w * 0.03, h * 0.8);
  c.fillRect(x + w * 0.42, y - h * 0.8, w * 0.03, h * 0.8);
};

export const SPRITES: Record<SpriteKind, { w: number; h: number; draw: Draw; solid: boolean }> = {
  tree: { w: 1700, h: 2100, draw: tree, solid: true },
  pine: { w: 1300, h: 2700, draw: pineDraw(false), solid: true },
  snowpine: { w: 1300, h: 2700, draw: pineDraw(true), solid: true },
  bush: { w: 1000, h: 550, draw: bush, solid: false },
  cactus: { w: 650, h: 1400, draw: cactus, solid: true },
  rock: { w: 1500, h: 900, draw: rock, solid: true },
  palm: { w: 1400, h: 2800, draw: palm, solid: true },
  post: { w: 90, h: 380, draw: post, solid: false },
  building: { w: 3200, h: 6500, draw: building, solid: true },
  house: { w: 2800, h: 2200, draw: house, solid: true },
  fence: { w: 2200, h: 450, draw: fence, solid: false },
  lamp: { w: 300, h: 2800, draw: lamp, solid: true },
  signL: { w: 650, h: 850, draw: sign(-1), solid: true },
  signR: { w: 650, h: 850, draw: sign(1), solid: true },
  gasSign: { w: 1600, h: 2600, draw: gasSign, solid: true },
  station: { w: 6500, h: 3200, draw: station, solid: true },
};
