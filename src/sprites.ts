import { adCanvas } from './billboards';
import { dither } from './ui';

// Objetos de cenário desenhados por código. Cada função desenha numa caixa:
// x = centro, y = base, w/h em pixels. O desenho passa pelo crisp.ts (pixel art nítida,
// com contorno escuro), então as formas usam cores chapadas, luz à esquerda e sombra à direita.

export type SpriteKind =
  | 'tree' | 'pine' | 'snowpine' | 'bush' | 'cactus' | 'rock' | 'palm' | 'post'
  | 'building' | 'house' | 'fence' | 'lamp' | 'signL' | 'signR' | 'gasSign' | 'station'
  | 'rail' | 'billboard' | 'bridge' | 'barn' | 'stop'
  | 'autumn' | 'acacia' | 'umbrella' | 'kiosk' | 'factory' | 'silo' | 'banana' | 'spire' | 'lighthouse' | 'chalet'
  | 'snowrock' | 'snowchalet' | 'snowman'
  | 'warnL' | 'warnR' | 'sharpL' | 'sharpR' | 'gasKm';

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
const rect = (c: CanvasRenderingContext2D, color: string | CanvasPattern, x: number, y: number, w: number, h: number) => {
  c.fillStyle = color;
  c.fillRect(x, y, w, h);
};

// Folhagem 16 bits: dezenas de tufos (cada um com sombra embaixo à direita e luz em cima à
// esquerda) em 5 tons, pontilhado nas transições e brilhos soltos; a forma fica recortada e viva.
const seeded = (seed: number) => {
  let v = (seed * 9301 + 49297) % 233280 || 1;
  return () => ((v = (v * 16807) % 2147483647) / 2147483647);
};
type Pal5 = [string, string, string, string, string]; // contorno interno, sombra, médio, claro, brilho
function foliage(c: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, pal: Pal5, seed: number, n = 30) {
  const rnd = seeded(seed + 11);
  const tufts: [number, number, number][] = [];
  for (let i = 0; i < n; i++) {
    const a = rnd() * Math.PI * 2, d = Math.sqrt(rnd()) * 0.82;
    tufts.push([x + Math.cos(a) * rx * d, y + Math.sin(a) * ry * d, (0.2 + rnd() * 0.16) * Math.min(rx, ry * 1.2)]);
  }
  tufts.sort((p, q) => p[1] - q[1]);
  ell(c, pal[0], x, y + ry * 0.05, rx * 0.92, ry * 0.88);
  for (const [tx, ty, r] of tufts) ell(c, pal[0], tx + r * 0.25, ty + r * 0.3, r * 1.15, r);
  for (const [tx, ty, r] of tufts) ell(c, pal[1], tx + r * 0.1, ty + r * 0.15, r, r * 0.88);
  for (const [tx, ty, r] of tufts) {
    const lit = (x - tx) / rx * 0.6 + (y - ty) / ry * 0.8; // quanto mais em cima à esquerda, mais luz
    ell(c, lit > -0.5 ? pal[2] : dither(c, pal[1], pal[2]), tx - r * 0.12, ty - r * 0.14, r * 0.8, r * 0.7);
    if (lit > 0.15) ell(c, lit > 0.45 ? pal[3] : dither(c, pal[2], pal[3]), tx - r * 0.3, ty - r * 0.32, r * 0.48, r * 0.4);
    if (lit > 0.6) ell(c, pal[4], tx - r * 0.42, ty - r * 0.45, r * 0.18, r * 0.15);
  }
  // furinhos de céu/sombra na copa
  for (let i = 0; i < 4; i++) ell(c, pal[0], x + (rnd() - 0.2) * rx * 0.9, y + (rnd() - 0.1) * ry * 0.7, rx * 0.05, ry * 0.04);
}
function trunk(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, dark = '#2e1c0c', mid = '#5a3a1c', light = '#8a5e32') {
  poly(c, dark, x - w * 0.5, y, x + w * 0.5, y, x + w * 0.36, y - h, x - w * 0.36, y - h);
  poly(c, mid, x - w * 0.5, y, x + w * 0.1, y, x, y - h, x - w * 0.36, y - h);
  poly(c, light, x - w * 0.42, y - h * 0.05, x - w * 0.2, y - h * 0.05, x - w * 0.22, y - h, x - w * 0.32, y - h);
  for (let i = 1; i < 5; i++) rect(c, dark, x - w * 0.3 + (i % 2) * w * 0.25, y - h * i * 0.2, w * 0.1, h * 0.08);
  // raízes
  poly(c, dark, x - w * 1.1, y, x - w * 0.4, y - h * 0.16, x - w * 0.2, y);
  poly(c, dark, x + w * 1.0, y, x + w * 0.4, y - h * 0.14, x + w * 0.25, y);
  poly(c, mid, x - w * 1.0, y, x - w * 0.42, y - h * 0.12, x - w * 0.36, y);
}
const GREEN: Pal5 = ['#062a0c', '#0e4a16', '#1e7022', '#3c9a30', '#8cd050'];

const tree: Draw = (c, x, y, w, h, seed) => {
  trunk(c, x, y, w * 0.15, h * 0.5);
  // galhos saindo para a copa
  poly(c, '#2e1c0c', x - w * 0.04, y - h * 0.42, x - w * 0.24, y - h * 0.62, x - w * 0.2, y - h * 0.64, x, y - h * 0.48);
  poly(c, '#2e1c0c', x + w * 0.03, y - h * 0.4, x + w * 0.22, y - h * 0.58, x + w * 0.25, y - h * 0.56, x + w * 0.05, y - h * 0.46);
  foliage(c, x, y - h * 0.64, w * 0.5, h * 0.35, GREEN, seed, 34);
};

const pineDraw = (snow: boolean): Draw => (c, x, y, w, h, seed) => {
  trunk(c, x, y, w * 0.12, h * 0.2, '#2a1a0e', '#4a2e1a', '#6e4a2c');
  const rnd = seeded(seed + 3);
  const tiers = 6;
  for (let i = 0; i < tiers; i++) {
    const by = y - h * (0.1 + i * 0.135);
    const bw = w * (0.52 - i * 0.075);
    const ty = by - h * 0.26;
    // galhos em serrilha: dentes na borda de baixo de cada andar
    const teeth = 5 + (tiers - i);
    const pts: number[] = [x, ty];
    for (let k = 0; k <= teeth; k++) {
      const fx = -1 + (2 * k) / teeth;
      pts.push(x + fx * bw, by - (k % 2 ? h * 0.035 : 0) - rnd() * h * 0.01);
    }
    poly(c, '#041e0e', ...pts);
    const left: number[] = [x, ty];
    for (let k = 0; k <= teeth / 2; k++) {
      const fx = -1 + (2 * k) / teeth;
      left.push(x + fx * bw * 0.96, by - h * 0.012 - (k % 2 ? h * 0.035 : 0));
    }
    left.push(x, by - h * 0.03);
    poly(c, '#0e4020', ...left);
    poly(c, '#1c5e30', x, ty + h * 0.02, x - bw * 0.62, by - h * 0.05, x - bw * 0.3, by - h * 0.06, x - bw * 0.05, ty + h * 0.08);
    poly(c, '#348040', x - bw * 0.05, ty + h * 0.04, x - bw * 0.42, by - h * 0.09, x - bw * 0.28, by - h * 0.1);
    poly(c, dither(c, '#041e0e', '#0e4020'), x + bw * 0.1, by - h * 0.05, x + bw * 0.7, by - h * 0.02, x + bw * 0.3, ty + h * 0.12);
    if (snow) {
      poly(c, '#f4f8fc', x - bw * 0.85, by - h * 0.03, x - bw * 0.2, ty + h * 0.12, x + bw * 0.1, ty + h * 0.1, x - bw * 0.1, by - h * 0.07);
      poly(c, '#c8d6e6', x + bw * 0.1, ty + h * 0.1, x + bw * 0.5, by - h * 0.06, x + bw * 0.1, by - h * 0.08);
      poly(c, '#ffffff', x - bw * 0.6, by - h * 0.06, x - bw * 0.3, ty + h * 0.15, x - bw * 0.25, by - h * 0.08);
    }
  }
  poly(c, snow ? '#f4f8fc' : '#348040', x, y - h, x - w * 0.04, y - h * 0.9, x + w * 0.03, y - h * 0.9);
};

const bush: Draw = (c, x, y, w, h, seed) => {
  foliage(c, x - w * 0.18, y - h * 0.45, w * 0.3, h * 0.42, GREEN, seed, 14);
  foliage(c, x + w * 0.2, y - h * 0.42, w * 0.28, h * 0.4, GREEN, seed + 5, 12);
  foliage(c, x, y - h * 0.6, w * 0.32, h * 0.42, GREEN, seed + 9, 16);
  rect(c, '#06240a', x - w * 0.46, y - h * 0.07, w * 0.92, h * 0.07);
};

const cactus: Draw = (c, x, y, w, h) => {
  const t = w * 0.28;
  // coluna com gomos verticais (luz à esquerda), espinhos e flor no topo
  const col = (cx: number, top: number, bot: number, tw: number) => {
    rect(c, '#1a5420', cx - tw / 2, top + tw / 2, tw, bot - top - tw / 2);
    ell(c, '#1a5420', cx, top + tw / 2, tw / 2, tw / 2);
    rect(c, '#2e7a32', cx - tw / 2, top + tw / 2, tw * 0.7, bot - top - tw / 2);
    ell(c, '#2e7a32', cx - tw * 0.15, top + tw / 2, tw * 0.35, tw * 0.45);
    rect(c, '#4aa04a', cx - tw * 0.38, top + tw * 0.6, tw * 0.18, bot - top - tw * 0.6);
    rect(c, '#123c16', cx + tw * 0.08, top + tw * 0.6, Math.max(0.5, tw * 0.08), bot - top - tw * 0.6);
    for (let yy = top + tw; yy < bot; yy += tw * 0.7) { rect(c, '#e8e0b0', cx - tw * 0.55, yy, Math.max(0.5, tw * 0.1), Math.max(0.5, tw * 0.06)); rect(c, '#e8e0b0', cx + tw * 0.45, yy + tw * 0.3, Math.max(0.5, tw * 0.1), Math.max(0.5, tw * 0.06)); }
  };
  col(x, y - h, y, t);
  rect(c, '#2e7a32', x - w * 0.42, y - h * 0.5, w * 0.3, t * 0.7);
  rect(c, '#1a5420', x - w * 0.42, y - h * 0.5 + t * 0.5, w * 0.3, t * 0.2);
  col(x - w * 0.36, y - h * 0.78, y - h * 0.44, t * 0.7);
  rect(c, '#2e7a32', x + w * 0.1, y - h * 0.38, w * 0.3, t * 0.7);
  rect(c, '#1a5420', x + w * 0.1, y - h * 0.38 + t * 0.5, w * 0.3, t * 0.2);
  col(x + w * 0.36, y - h * 0.66, y - h * 0.32, t * 0.7);
  ell(c, '#e83a6a', x, y - h + t * 0.15, t * 0.25, t * 0.15);
  ell(c, '#ffd040', x, y - h + t * 0.12, t * 0.08, t * 0.06);
};

const rock: Draw = (c, x, y, w, h, seed) => {
  const rnd = seeded(seed + 7);
  const j = () => (rnd() - 0.5) * 0.08;
  // bloco em facetas: frente iluminada (esquerda), topo claro, lado direito na sombra
  poly(c, '#2e2620', x - w / 2, y, x - w * (0.42 + j()), y - h * 0.6, x - w * 0.1, y - h, x + w * 0.3, y - h * 0.82, x + w / 2, y - h * 0.25, x + w * 0.47, y);
  poly(c, '#6e6054', x - w * 0.46, y - h * 0.02, x - w * (0.4 + j()), y - h * 0.58, x - w * 0.08, y - h * 0.92, x + w * 0.04, y - h * 0.5, x - w * 0.02, y - h * 0.02);
  poly(c, '#9a8a7a', x - w * 0.4, y - h * 0.58, x - w * 0.08, y - h * 0.94, x + w * 0.28, y - h * 0.78, x + w * 0.05, y - h * 0.55);
  poly(c, '#c4b4a2', x - w * 0.3, y - h * 0.62, x - w * 0.08, y - h * 0.88, x + w * 0.12, y - h * 0.74, x - w * 0.04, y - h * 0.62);
  poly(c, '#4a3e34', x + w * 0.05, y - h * 0.55, x + w * 0.28, y - h * 0.78, x + w * 0.46, y - h * 0.24, x + w * 0.44, y - h * 0.02, x + w * 0.02, y - h * 0.02);
  poly(c, dither(c, '#4a3e34', '#6e6054'), x + w * 0.04, y - h * 0.5, x + w * 0.14, y - h * 0.52, x + w * 0.1, y - h * 0.04, x + w * 0.0, y - h * 0.04);
  // rachaduras e líquen
  poly(c, '#2e2620', x - w * 0.22, y - h * 0.5, x - w * 0.12, y - h * 0.3, x - w * 0.14, y - h * 0.1, x - w * 0.18, y - h * 0.3);
  rect(c, '#2e2620', x + w * 0.2, y - h * 0.5, w * 0.12, h * 0.03);
  for (let i = 0; i < 6; i++) rect(c, rnd() < 0.5 ? '#6a7a3a' : '#8a9a4a', x + (rnd() - 0.6) * w * 0.6, y - h * (0.05 + rnd() * 0.3), w * 0.04, h * 0.04);
  rect(c, dither(c, '#2e2620', 'rgba(0,0,0,0)'), x - w * 0.5, y - h * 0.04, w, h * 0.04);
};

const palm: Draw = (c, x, y, w, h, seed) => {
  const tw = Math.max(1, w * 0.075);
  const tx = x + w * 0.14, ty = y - h * 0.78;
  // tronco curvo em gomos, com sombra à direita
  for (let i = 0; i < 12; i++) {
    const f0 = i / 12, f1 = (i + 1) / 12;
    const x0 = x + (tx - x) * f0 ** 1.6, x1 = x + (tx - x) * f1 ** 1.6;
    const y0 = y + (ty - y) * f0, y1 = y + (ty - y) * f1;
    const k = 1 - f0 * 0.3;
    poly(c, '#5a3a1a', x0 - tw * k, y0, x0 + tw * k, y0, x1 + tw * k * 0.9, y1, x1 - tw * k * 0.9, y1);
    poly(c, i % 2 ? '#8a5e30' : '#a87440', x0 - tw * k, y0, x0 + tw * k * 0.2, y0, x1 + tw * k * 0.1, y1, x1 - tw * k * 0.9, y1);
    rect(c, '#3a2410', x1 - tw * k, y1, tw * k * 2, Math.max(0.5, h * 0.006));
  }
  // folhas: nervura e folíolos em serrilha, 3 tons
  const leaf = (dx: number, dy: number, cols: [string, string, string]) => {
    const ex = tx + dx * w, ey = ty + h * (0.12 - dy * 0.06), mx = tx + dx * w * 0.5, my = ty - dy * h * 0.12;
    poly(c, cols[0], tx, ty, mx, my - h * 0.035, ex, ey, mx, my + h * 0.06);
    for (let k = 1; k < 7; k++) {
      const f = k / 7, px = tx + (mx - tx) * f * 2 * (f < 0.5 ? 1 : 0) + (f >= 0.5 ? mx + (ex - mx) * (f - 0.5) * 2 - tx : 0) + (f >= 0.5 ? tx : 0);
      const py = f < 0.5 ? ty + (my - ty) * f * 2 : my + (ey - my) * (f - 0.5) * 2;
      poly(c, cols[1], px, py - h * 0.01, px + dx * w * 0.12, py + h * 0.07, px - dx * w * 0.03, py + h * 0.035);
    }
    poly(c, cols[2], tx, ty - h * 0.005, mx, my - h * 0.02, mx, my - h * 0.005);
  };
  const D: [string, string, string] = ['#0e4a16', '#1a6a22', '#3a8a30'], M: [string, string, string] = ['#1a6a22', '#2e8a30', '#5aaa40'], L: [string, string, string] = ['#2e8a30', '#4aa840', '#8ad060'];
  for (const [dx, dy] of [[-1, 0.4], [1, 0.4], [-0.7, 1], [0.7, 1]]) leaf(dx * 0.5, dy, D);
  for (const [dx, dy] of [[-0.8, 0.9], [0.85, 0.7], [-0.3, 1.4], [0.35, 1.3]]) leaf(dx * 0.5, dy, M);
  leaf(-0.25, 1.5, L);
  leaf(-0.55, 1.1, L);
  for (const [cx2, cy2] of [[-0.03, 0.02], [0.04, 0.03], [0.0, 0.045]]) { ell(c, '#4a2e10', tx + w * cx2, ty + h * cy2, w * 0.045, h * 0.022); ell(c, '#7a5020', tx + w * cx2 - w * 0.01, ty + h * cy2 - h * 0.006, w * 0.015, h * 0.008); }
  void seed;
};

const post: Draw = (c, x, y, w, h) => {
  c.fillStyle = '#f0f0f0';
  c.fillRect(x - w / 2, y - h, Math.max(1, w), h);
  c.fillStyle = '#9a9a9a';
  c.fillRect(x + w / 2 - Math.max(0.5, w * 0.3), y - h, Math.max(0.5, w * 0.3), h);
  c.fillStyle = '#ff8a1a';
  c.fillRect(x - w / 2, y - h * 0.86, Math.max(1, w), Math.max(0.5, h * 0.1));
};


// ---- construções 16 bits: tábuas, telhas, janelas com reflexo ----
function clipPoly(c: CanvasRenderingContext2D, pts: number[], body: () => void) {
  c.save();
  c.beginPath();
  c.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]);
  c.closePath();
  c.clip();
  body();
  c.restore();
}
// parede de tábuas (horizontais) ou tijolos, com luz à esquerda e a quina direita na sombra
function siding(c: CanvasRenderingContext2D, x0: number, y0: number, w: number, h: number, base: string, dark: string, light: string, step: number, brick = false) {
  rect(c, base, x0, y0, w, h);
  const n = Math.max(2, Math.round(h / step));
  for (let i = 0; i < n; i++) {
    const yy = y0 + (h * i) / n;
    rect(c, dark, x0, yy + h / n - Math.max(0.5, step * 0.18), w, Math.max(0.5, step * 0.18));
    rect(c, light, x0, yy, w, Math.max(0.5, step * 0.12));
    if (brick) for (let k = (i % 2) * 0.5; k < w / (step * 2.2); k++) rect(c, dark, x0 + k * step * 2.2, yy, Math.max(0.5, step * 0.15), h / n);
  }
  rect(c, dither(c, base, dark), x0 + w * 0.82, y0, w * 0.18, h);
  rect(c, dark, x0 + w - Math.max(0.5, w * 0.03), y0, Math.max(0.5, w * 0.03), h);
}
// telhado de duas águas com fileiras de telhas e a água direita na sombra
function roof(c: CanvasRenderingContext2D, x: number, yb: number, w: number, yt: number, base: string, dark: string, light: string) {
  const pts = [x - w / 2, yb, x + w / 2, yb, x, yt];
  poly(c, base, ...pts);
  clipPoly(c, pts, () => {
    const rows = 7;
    for (let i = 0; i < rows; i++) {
      const yy = yt + ((yb - yt) * i) / rows;
      rect(c, dark, x - w / 2, yy + (yb - yt) / rows * 0.75, w, (yb - yt) / rows * 0.25);
      for (let k = 0; k < 14; k++) rect(c, dark, x - w / 2 + (k + (i % 2) * 0.5) * (w / 14), yy, Math.max(0.5, w * 0.008), (yb - yt) / rows);
    }
    poly(c, dither(c, dark, 'rgba(0,0,0,0)'), x, yt, x + w / 2, yb, x + w * 0.04, yb);
    poly(c, light, x - w / 2, yb, x - w * 0.42, yb, x - w * 0.02, yt + (yb - yt) * 0.06, x, yt);
  });
  rect(c, dark, x - w / 2, yb - Math.max(0.5, (yb - yt) * 0.05), w, Math.max(0.5, (yb - yt) * 0.07)); // beiral
}
function windowPane(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, frame: string, glass = '#3a5a8a') {
  rect(c, frame, x - w * 0.12, y - h * 0.1, w * 1.24, h * 1.22);
  rect(c, glass, x, y, w, h);
  poly(c, '#7aa4d8', x, y + h * 0.55, x + w * 0.55, y, x + w * 0.8, y, x, y + h * 0.85); // reflexo do céu
  poly(c, '#c8e0f8', x, y + h * 0.3, x + w * 0.3, y, x + w * 0.4, y, x, y + h * 0.42);
  rect(c, frame, x + w * 0.46, y, Math.max(0.5, w * 0.08), h);
  rect(c, frame, x, y + h * 0.46, w, Math.max(0.5, h * 0.08));
  rect(c, '#e8e4d8', x - w * 0.16, y + h * 1.06, w * 1.32, Math.max(0.5, h * 0.1)); // peitoril
}


// cilindro iluminado pela esquerda: faixas verticais em 5 tons com pontilhado nas emendas
function cylinder(c: CanvasRenderingContext2D, x0: number, y0: number, w: number, h: number, pal: Pal5) {
  const order = [3, 4, 3, 2, 2, 1, 1, 0];
  const n = order.length;
  for (let i = 0; i < n; i++) {
    const col = pal[order[i]];
    rect(c, col, x0 + (w * i) / n, y0, w / n + 0.3, h);
    if (i > 0 && order[i] !== order[i - 1]) rect(c, dither(c, pal[order[i - 1]], col), x0 + (w * i) / n - w / (n * 3), y0, w / (n * 3), h);
  }
}

// poste metálico de placa: luz à esquerda, sombra à direita, abraçadeiras e base
function pole(c: CanvasRenderingContext2D, cx: number, y0: number, w: number, h: number) {
  rect(c, '#5a5a62', cx - w / 2, y0, w, h);
  rect(c, '#a8a8b0', cx - w / 2, y0, w * 0.35, h);
  rect(c, '#d8d8e0', cx - w / 2 + w * 0.1, y0, Math.max(0.5, w * 0.12), h);
  rect(c, '#3a3a40', cx + w * 0.25, y0, w * 0.25, h);
  rect(c, '#2a2a30', cx - w * 0.7, y0 + h - Math.max(0.5, h * 0.03), w * 1.4, Math.max(0.5, h * 0.03));
}
// moldura de chapa: filete claro em cima/à esquerda, escuro embaixo/à direita, rebites
function plate(c: CanvasRenderingContext2D, x0: number, y0: number, w: number, h: number, light: string, dark: string, bolts = true) {
  const t = Math.max(0.5, Math.min(w, h) * 0.04);
  rect(c, light, x0, y0, w, t);
  rect(c, light, x0, y0, t, h);
  rect(c, dark, x0, y0 + h - t, w, t);
  rect(c, dark, x0 + w - t, y0, t, h);
  if (bolts) for (const [bx, by] of [[0.08, 0.15], [0.92, 0.15], [0.08, 0.85], [0.92, 0.85]]) rect(c, '#8a8a90', x0 + w * bx - t / 2, y0 + h * by - t / 2, t, t);
}
const WINDOW = ['#2a3a5a', '#2a3a5a', '#33476a', '#f0d070'];
const building: Draw = (c, x, y, w, h, seed) => {
  const hh = h * (0.55 + (seed % 45) / 100);
  const pals: Pal5[] = [['#3e3e50', '#5e5e74', '#8a8aa0', '#a8a8bc', '#d0d0dc'], ['#4e4234', '#706048', '#a09078', '#bcae94', '#e0d4bc'],
    ['#30364a', '#4a5268', '#707890', '#8e96ac', '#b8c0d0'], ['#5a5444', '#807a64', '#b0a890', '#c8c2aa', '#e8e2cc'], ['#3a3040', '#564a5e', '#7a6a80', '#988aa0', '#c0b4c8']];
  const P = pals[seed % pals.length];
  const L = x - w / 2, side = w * 0.16, fw = w - side;
  // fachada com faixas de laje, lateral na sombra e cobertura vista de cima
  rect(c, P[2], L, y - hh, fw, hh);
  rect(c, P[3], L, y - hh, fw * 0.08, hh);
  rect(c, P[1], L + fw, y - hh + side * 0.4, side, hh - side * 0.4);
  rect(c, dither(c, P[1], P[0]), L + fw + side * 0.6, y - hh + side * 0.4, side * 0.4, hh - side * 0.4);
  poly(c, P[1], L, y - hh, L + fw, y - hh, L + w, y - hh + side * 0.4, L + side, y - hh + side * 0.4);
  rect(c, P[4], L, y - hh, fw, Math.max(0.5, hh * 0.015));
  // caixa d'água e antena no topo
  rect(c, P[1], L + fw * 0.6, y - hh - hh * 0.06, fw * 0.2, hh * 0.06);
  rect(c, P[3], L + fw * 0.6, y - hh - hh * 0.06, fw * 0.06, hh * 0.06);
  rect(c, '#2a2a30', L + fw * 0.25, y - hh - hh * 0.12, Math.max(0.5, w * 0.012), hh * 0.12);
  rect(c, '#e82a2a', L + fw * 0.25 - w * 0.01, y - hh - hh * 0.125, w * 0.03, Math.max(0.5, hh * 0.008));
  if (w < 10) return;
  const cols = 4, rows = Math.max(4, Math.round(hh / (w * 0.22)));
  const cw = fw / (cols * 2 + 1), rh = hh / (rows * 2 + 1.5);
  for (let r = 0; r < rows; r++) {
    rect(c, P[1], L, y - hh + rh * (r * 2 + 2.3), fw, Math.max(0.5, rh * 0.25)); // laje
    for (let k = 0; k < cols; k++) {
      const wx = L + cw * (k * 2 + 1), wy = y - hh + rh * (r * 2 + 1.2);
      const lit = WINDOW[(seed * 7 + r * 13 + k * 5) % WINDOW.length] === '#f0d070';
      rect(c, P[0], wx - cw * 0.12, wy - rh * 0.1, cw * 1.24, rh * 1.2);
      rect(c, lit ? '#f0d070' : '#2e4468', wx, wy, cw, rh);
      if (!lit) { poly(c, '#5a7aa8', wx, wy + rh * 0.7, wx + cw * 0.6, wy, wx + cw * 0.85, wy, wx, wy + rh); rect(c, '#9ab8e0', wx, wy, cw * 0.25, Math.max(0.5, rh * 0.15)); }
      else rect(c, '#fff0b0', wx, wy, cw * 0.3, rh * 0.3);
    }
  }
  // térreo: marquise e porta de vidro
  rect(c, P[0], L, y - h * 0.1, fw, h * 0.02);
  rect(c, '#24324a', x - side - w * 0.1, y - h * 0.08, w * 0.2, h * 0.08);
  rect(c, '#6a8ab8', x - side - w * 0.1, y - h * 0.08, w * 0.05, h * 0.08);
  rect(c, P[0], x - side - w * 0.005, y - h * 0.08, Math.max(0.5, w * 0.01), h * 0.08);
};

const house: Draw = (c, x, y, w, h, seed) => {
  const cream = seed % 2;
  const wall = cream ? ['#e8dcc0', '#b8a888', '#fff4dc'] : ['#eeeee6', '#b8b8ae', '#ffffff'];
  const rf = seed % 3 ? ['#a03a2a', '#6a2018', '#d06048'] : ['#5a4a3a', '#3a2e24', '#806a54'];
  siding(c, x - w * 0.4, y - h * 0.55, w * 0.8, h * 0.55, wall[0], wall[1], wall[2], h * 0.05);
  rect(c, '#8a8a80', x - w * 0.42, y - h * 0.07, w * 0.84, h * 0.07); // alicerce
  rect(c, '#6a6a62', x - w * 0.42, y - h * 0.02, w * 0.84, h * 0.02);
  rect(c, '#6a4a3a', x + w * 0.16, y - h * 0.98, w * 0.08, h * 0.24); // chaminé
  rect(c, '#8a6a52', x + w * 0.16, y - h * 0.98, w * 0.025, h * 0.24);
  rect(c, '#3a2a20', x + w * 0.15, y - h * 1.0, w * 0.1, h * 0.03);
  roof(c, x, y - h * 0.53, w * 1.04, y - h, rf[0], rf[1], rf[2]);
  // porta com batente e maçaneta
  rect(c, '#e8e4d8', x - w * 0.09, y - h * 0.36, w * 0.18, h * 0.3);
  rect(c, '#5a3418', x - w * 0.07, y - h * 0.34, w * 0.14, h * 0.28);
  rect(c, '#7a4a24', x - w * 0.07, y - h * 0.34, w * 0.04, h * 0.28);
  rect(c, '#e0c060', x + w * 0.03, y - h * 0.2, w * 0.02, h * 0.025);
  windowPane(c, x - w * 0.32, y - h * 0.4, w * 0.14, h * 0.14, '#f4f0e4');
  windowPane(c, x + w * 0.18, y - h * 0.4, w * 0.14, h * 0.14, '#f4f0e4');
  // degrau e floreira
  rect(c, '#9a9a90', x - w * 0.11, y - h * 0.07, w * 0.22, h * 0.03);
  for (const fx of [-0.36, 0.16]) { rect(c, '#6a3a1a', x + w * fx, y - h * 0.19, w * 0.18, h * 0.04); ell(c, '#2a7a2a', x + w * (fx + 0.09), y - h * 0.21, w * 0.08, h * 0.02); ell(c, '#e83a5a', x + w * (fx + 0.06), y - h * 0.22, w * 0.015, h * 0.012); }
};

const barn: Draw = (c, x, y, w, h) => {
  siding(c, x - w * 0.42, y - h * 0.6, w * 0.84, h * 0.6, '#a82a1e', '#6a1610', '#d04a34', h * 0.035);
  // telhado em mansarda com telhas de zinco
  const pts = [x - w / 2, y - h * 0.58, x - w * 0.3, y - h * 0.9, x + w * 0.3, y - h * 0.9, x + w / 2, y - h * 0.58];
  poly(c, '#5a4a40', ...pts);
  clipPoly(c, pts, () => {
    for (let k = 0; k < 22; k++) rect(c, k % 2 ? '#3a2e28' : '#7a6a5e', x - w / 2 + k * (w / 22), y - h * 0.9, w / 44, h * 0.32);
    poly(c, dither(c, '#2a201a', 'rgba(0,0,0,0)'), x + w * 0.05, y - h * 0.9, x + w * 0.3, y - h * 0.9, x + w / 2, y - h * 0.58, x + w * 0.12, y - h * 0.58);
  });
  rect(c, '#2a201a', x - w / 2, y - h * 0.6, w, h * 0.025);
  // portão de celeiro em X
  rect(c, '#f0f0e8', x - w * 0.16, y - h * 0.42, w * 0.32, h * 0.42);
  rect(c, '#7a1e16', x - w * 0.14, y - h * 0.4, w * 0.28, h * 0.4);
  rect(c, '#5a140e', x - w * 0.005, y - h * 0.4, w * 0.01, h * 0.4);
  poly(c, '#f0f0e8', x - w * 0.14, y - h * 0.4, x - w * 0.11, y - h * 0.4, x + w * 0.14, y - h * 0.02, x + w * 0.11, y);
  poly(c, '#f0f0e8', x + w * 0.14, y - h * 0.4, x + w * 0.11, y - h * 0.4, x - w * 0.14, y - h * 0.02, x - w * 0.11, y);
  // janela do feno
  rect(c, '#f0f0e8', x - w * 0.08, y - h * 0.78, w * 0.16, h * 0.12);
  rect(c, '#2a1a12', x - w * 0.06, y - h * 0.76, w * 0.12, h * 0.08);
  rect(c, '#d8b040', x - w * 0.06, y - h * 0.7, w * 0.12, h * 0.02);
  // feno no chão
  ell(c, '#c8a040', x + w * 0.32, y - h * 0.05, w * 0.07, h * 0.05);
  ell(c, '#e8c860', x + w * 0.31, y - h * 0.07, w * 0.04, h * 0.025);
};

const fence: Draw = (c, x, y, w, h) => {
  // cerca de madeira: tábuas com veios, pregos e sombra no chão
  rect(c, dither(c, 'rgba(0,0,0,0.35)', 'rgba(0,0,0,0)'), x - w / 2, y - h * 0.05, w, h * 0.05);
  for (const ry of [0.75, 0.42]) {
    rect(c, '#a8865e', x - w / 2, y - h * ry, w, Math.max(1, h * 0.13));
    rect(c, '#e0c8a0', x - w / 2, y - h * ry, w, Math.max(0.5, h * 0.035));
    rect(c, '#6e5236', x - w / 2, y - h * ry + h * 0.1, w, Math.max(0.5, h * 0.03));
    for (let k = 0; k < 6; k++) rect(c, '#8a6a46', x - w / 2 + w * (0.05 + k * 0.17), y - h * ry + h * 0.055, w * 0.08, Math.max(0.5, h * 0.015));
  }
  for (let i = 0; i <= 4; i++) {
    const px = x - w / 2 + (w * i) / 4 - w * 0.02;
    rect(c, '#7a5a3a', px, y - h, Math.max(1, w * 0.045), h);
    rect(c, '#c8a882', px, y - h, Math.max(0.5, w * 0.015), h);
    rect(c, '#4e3622', px + w * 0.03, y - h, Math.max(0.5, w * 0.015), h);
    poly(c, '#7a5a3a', px, y - h, px + w * 0.045, y - h, px + w * 0.0225, y - h * 1.08);
    for (const ry of [0.7, 0.37]) rect(c, '#3a3a3a', px + w * 0.015, y - h * ry, Math.max(0.5, w * 0.012), Math.max(0.5, h * 0.03));
  }
};

const lamp: Draw = (c, x, y, w, h) => {
  // poste de iluminação: coluna cilíndrica, braço curvo e luminária com lente
  rect(c, '#3a3a42', x - w * 0.15, y - h, w * 0.3, h);
  rect(c, '#7a7a84', x - w * 0.15, y - h, w * 0.14, h);
  rect(c, '#b8b8c2', x - w * 0.12, y - h, Math.max(0.5, w * 0.05), h);
  rect(c, '#4a4a52', x - w * 0.3, y - h * 0.08, w * 0.6, h * 0.08);
  rect(c, '#8a8a94', x - w * 0.3, y - h * 0.08, w * 0.6, h * 0.015);
  poly(c, '#4a4a52', x + w * 0.15, y - h, x - w * 1.3, y - h + w * 0.1, x - w * 1.3, y - h + w * 0.32, x + w * 0.15, y - h + w * 0.32);
  poly(c, '#8a8a94', x + w * 0.15, y - h, x - w * 1.3, y - h + w * 0.1, x - w * 1.3, y - h + w * 0.17, x + w * 0.15, y - h + w * 0.07);
  poly(c, '#2e2e34', x - w * 1.65, y - h + w * 0.05, x - w * 0.95, y - h + w * 0.05, x - w * 1.05, y - h + w * 0.42, x - w * 1.55, y - h + w * 0.42);
  poly(c, '#5a5a62', x - w * 1.65, y - h + w * 0.05, x - w * 0.95, y - h + w * 0.05, x - w * 1.0, y - h + w * 0.15, x - w * 1.6, y - h + w * 0.15);
  rect(c, '#fff4b0', x - w * 1.5, y - h + w * 0.42, w * 0.4, w * 0.18);
  rect(c, '#ffffff', x - w * 1.45, y - h + w * 0.43, w * 0.12, w * 0.08);
};

const sign = (dir: 1 | -1): Draw => (c, x, y, w, h) => {
  for (const px of [-0.3, 0.3]) pole(c, x + w * px, y - h * 0.5, w * 0.08, h * 0.5);
  rect(c, '#ffcc00', x - w / 2, y - h, w, h * 0.55);
  rect(c, dither(c, '#ffcc00', '#e8b000'), x - w / 2, y - h * 0.62, w, h * 0.17);
  plate(c, x - w / 2, y - h, w, h * 0.55, '#fff0a0', '#a87a00');
  // duas setas (chevrons)
  for (const off of [-0.18, 0.18]) {
    const cx = x + w * off * dir, cy = y - h * 0.725, s = w * 0.16;
    poly(c, '#111', cx - s * dir, cy - s * 1.2, cx + s * 0.4 * dir, cy, cx - s * dir, cy + s * 1.2, cx - s * 0.4 * dir, cy);
  }
};

// placa de advertência de curva (losango amarelo com borda preta, como as do Brasil):
// curva suave = seta encurvada; curva acentuada = seta que dobra em ângulo reto
const warn = (dir: 1 | -1, sharp: boolean): Draw => (c, x, y, w, h) => {
  pole(c, x, y - h * 0.6, w * 0.1, h * 0.6);
  const cy = y - h * 0.78, r = w * 0.5;
  poly(c, '#111', x, cy - r, x + r, cy, x, cy + r, x - r, cy);
  const k = 0.84;
  poly(c, '#ffcc00', x, cy - r * k, x + r * k, cy, x, cy + r * k, x - r * k, cy);
  poly(c, '#fff0a0', x, cy - r * k, x - r * k, cy, x - r * k * 0.86, cy, x, cy - r * k * 0.86); // filete de luz
  poly(c, dither(c, '#ffcc00', '#d8a000'), x + r * k * 0.2, cy + r * k * 0.8, x + r * k, cy, x + r * k * 0.7, cy, x, cy + r * k * 0.7);
  // seta (traço grosso) e ponta
  const lw = Math.max(1, w * 0.1);
  c.strokeStyle = '#111';
  c.lineWidth = lw;
  c.lineCap = 'butt';
  c.beginPath();
  const bx = x - dir * r * 0.12, by = cy + r * 0.5;
  c.moveTo(bx, by);
  let tipX: number, tipY: number, ang: number;
  if (sharp) {
    const ty = cy - r * 0.08;
    c.lineTo(bx, ty);
    tipX = bx + dir * r * 0.42;
    tipY = ty;
    c.lineTo(tipX, tipY);
    ang = dir > 0 ? 0 : Math.PI;
  } else {
    tipX = bx + dir * r * 0.32;
    tipY = cy - r * 0.42;
    c.quadraticCurveTo(bx, cy - r * 0.15, tipX, tipY);
    ang = Math.atan2(tipY - (cy - r * 0.15), tipX - bx);
  }
  c.stroke();
  const hs = r * 0.28;
  poly(c, '#111',
    tipX + Math.cos(ang) * hs, tipY + Math.sin(ang) * hs,
    tipX + Math.cos(ang + 2.2) * hs, tipY + Math.sin(ang + 2.2) * hs,
    tipX + Math.cos(ang - 2.2) * hs, tipY + Math.sin(ang - 2.2) * hs);
};

const gasSign: Draw = (c, x, y, w, h) => {
  pole(c, x, y - h * 0.55, w * 0.08, h * 0.55);
  rect(c, '#1a3aa8', x - w / 2, y - h, w, h * 0.45);
  rect(c, '#2a52d0', x - w / 2, y - h, w, h * 0.06);
  rect(c, dither(c, '#1a3aa8', '#12287a'), x - w / 2, y - h * 0.62, w, h * 0.07);
  plate(c, x - w / 2, y - h, w, h * 0.45, '#5a82f0', '#0c1c5a', false);
  rect(c, '#fff', x - w / 2 + w * 0.04, y - h * 0.68, w * 0.92, h * 0.1);
  rect(c, '#d02020', x - w / 2 + w * 0.06, y - h * 0.665, w * 0.4, h * 0.07);
  if (w > 14) {
    c.font = `bold ${Math.floor(h * 0.2)}px monospace`;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillStyle = '#ffd400';
    c.fillText('GAS', x, y - h * 0.84);
  }
};

// placa azul de serviço avisando o posto: bomba de combustível e a distância (seed = metros)
const gasKm: Draw = (c, x, y, w, h, seed) => {
  for (const px of [-0.3, 0.3]) pole(c, x + w * px, y - h * 0.45, w * 0.06, h * 0.45);
  rect(c, '#f2f2f2', x - w / 2, y - h, w, h * 0.57);
  plate(c, x - w / 2, y - h, w, h * 0.57, '#ffffff', '#9a9aa0');
  rect(c, '#1a4ab8', x - w / 2 + w * 0.03, y - h + h * 0.03, w * 0.94, h * 0.51);
  // bomba (ícone branco)
  const bx = x - w * 0.3, by = y - h * 0.82;
  rect(c, '#ffffff', bx - w * 0.07, by - h * 0.11, w * 0.14, h * 0.22);
  rect(c, '#1a4ab8', bx - w * 0.045, by - h * 0.08, w * 0.09, h * 0.06);
  rect(c, '#ffffff', bx + w * 0.07, by - h * 0.06, w * 0.03, h * 0.02);
  rect(c, '#ffffff', bx + w * 0.09, by - h * 0.06, w * 0.02, h * 0.12);
  // distância
  if (w > 10) {
    const label = seed >= 1000 ? `${seed / 1000} km` : `${seed} m`;
    c.font = `bold ${Math.floor(h * 0.17)}px monospace`;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillStyle = '#ffffff';
    c.fillText(label, x + w * 0.14, y - h * 0.86);
    c.font = `bold ${Math.floor(h * 0.1)}px monospace`;
    c.fillText('POSTO', x + w * 0.14, y - h * 0.66);
  }
};

// placa de PARE da chegada (octógono vermelho com borda branca)
const stop: Draw = (c, x, y, w, h) => {
  pole(c, x, y - h * 0.62, w * 0.1, h * 0.62);
  const oct = (r: number, color: string | CanvasPattern) => {
    const cy = y - h * 0.78, k = Math.tan(Math.PI / 8);
    const ry = r * (h / w) * 0.55;
    poly(c, color, x - r * k, cy - ry, x + r * k, cy - ry, x + r, cy - ry * k, x + r, cy + ry * k, x + r * k, cy + ry, x - r * k, cy + ry, x - r, cy + ry * k, x - r, cy - ry * k);
  };
  oct(w / 2, '#f4f4f4');
  oct(w * 0.44, '#d01818');
  oct(w * 0.36, dither(c, '#d01818', '#e83a2a'));
  if (w > 14) {
    c.font = `bold ${Math.floor(w * 0.26)}px monospace`;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillStyle = '#fff';
    c.fillText('PARE', x, y - h * 0.78);
  }
};

const station: Draw = (c, x, y, w, h) => {
  // loja de conveniência com vitrine, porta de vidro e letreiro
  siding(c, x + w * 0.08, y - h * 0.52, w * 0.4, h * 0.52, '#ecece4', '#b8b8b0', '#ffffff', h * 0.06, true);
  rect(c, '#c82020', x + w * 0.08, y - h * 0.56, w * 0.4, h * 0.06);
  rect(c, '#f4f4f0', x + w * 0.12, y - h * 0.55, w * 0.32, h * 0.025);
  windowPane(c, x + w * 0.12, y - h * 0.4, w * 0.16, h * 0.2, '#5a5a62', '#2e4a7a');
  rect(c, '#2a3a5a', x + w * 0.32, y - h * 0.36, w * 0.1, h * 0.36);
  rect(c, '#7aa4d8', x + w * 0.32, y - h * 0.36, w * 0.03, h * 0.36);
  rect(c, '#5a5a62', x + w * 0.365, y - h * 0.36, Math.max(0.5, w * 0.006), h * 0.36);
  // pilares e cobertura das bombas com faixa da bandeira (fictícia) e luzes embaixo
  for (const px of [-0.4, -0.06]) {
    rect(c, '#8a8a92', x + w * px, y - h * 0.8, w * 0.03, h * 0.8);
    rect(c, '#d8d8de', x + w * px, y - h * 0.8, w * 0.01, h * 0.8);
    rect(c, '#5a5a62', x + w * px + w * 0.024, y - h * 0.8, w * 0.006, h * 0.8);
    rect(c, '#e8c020', x + w * px - w * 0.004, y - h * 0.08, w * 0.038, h * 0.03);
  }
  rect(c, '#f4f4f2', x - w / 2, y - h * 0.94, w * 0.56, h * 0.16);
  rect(c, '#ffffff', x - w / 2, y - h * 0.94, w * 0.56, h * 0.02);
  rect(c, '#c82020', x - w / 2, y - h * 0.86, w * 0.56, h * 0.05);
  rect(c, '#e8c020', x - w / 2, y - h * 0.81, w * 0.56, h * 0.012);
  rect(c, '#9a9aa0', x - w / 2, y - h * 0.78, w * 0.56, h * 0.02);
  for (let i = 0; i < 6; i++) rect(c, '#fff8d0', x - w * 0.47 + i * w * 0.09, y - h * 0.765, w * 0.05, h * 0.01);
  // ilha e bombas com visor, bico e mangueira
  rect(c, '#9a9a96', x - w * 0.38, y - h * 0.04, w * 0.3, h * 0.04);
  rect(c, '#c8c8c0', x - w * 0.38, y - h * 0.04, w * 0.3, h * 0.012);
  for (const px of [-0.32, -0.18]) {
    rect(c, '#d02a2a', x + w * px, y - h * 0.34, w * 0.07, h * 0.3);
    rect(c, '#f05040', x + w * px, y - h * 0.34, w * 0.02, h * 0.3);
    rect(c, '#8a1810', x + w * px + w * 0.055, y - h * 0.34, w * 0.015, h * 0.3);
    rect(c, '#f0f0f0', x + w * px + w * 0.01, y - h * 0.3, w * 0.05, h * 0.07);
    rect(c, '#1a2a1a', x + w * px + w * 0.015, y - h * 0.29, w * 0.04, h * 0.025);
    rect(c, '#7aff7a', x + w * px + w * 0.02, y - h * 0.285, w * 0.025, h * 0.012);
    rect(c, '#202020', x + w * px + w * 0.07, y - h * 0.26, w * 0.012, h * 0.14);
    rect(c, '#3a3a3a', x + w * px + w * 0.06, y - h * 0.27, w * 0.025, h * 0.02);
  }
};

// guarda-corpo das curvas: viga ondulada com postes
const rail: Draw = (c, x, y, w, h) => {
  for (const px of [-0.42, 0.38]) rect(c, '#4a4a50', x + w * px, y - h * 0.8, w * 0.06, h * 0.8);
  rect(c, '#9a9ca4', x - w / 2, y - h * 0.86, w, h * 0.34);
  rect(c, '#d8dae0', x - w / 2, y - h * 0.86, w, h * 0.08);
  rect(c, '#6a6c74', x - w / 2, y - h * 0.62, w, h * 0.08);
  rect(c, '#ffffff', x - w * 0.42, y - h * 0.78, w * 0.06, h * 0.1);
};

// outdoor com anúncios fictícios dos anos 90 (billboards.ts): a arte em pixels nativos vai
// ampliada, sem suavizar, no painel
const billboard: Draw = (c, x, y, w, h, seed) => {
  for (const px of [-0.3, 0.3]) {
    pole(c, x + w * px, y - h * 0.5, w * 0.05, h * 0.5);
  }
  rect(c, '#3a3a40', x - w * 0.36, y - h * 0.5, w * 0.72, h * 0.04);
  // passarela de manutenção com grade
  rect(c, '#4a4a50', x - w * 0.46, y - h * 0.47, w * 0.92, h * 0.025);
  for (let i = 0; i < 18; i++) rect(c, '#4a4a50', x - w * 0.46 + i * w * 0.054, y - h * 0.5, Math.max(0.5, w * 0.006), h * 0.03);
  rect(c, '#e8e8e8', x - w / 2, y - h, w, h * 0.52);
  plate(c, x - w / 2, y - h, w, h * 0.52, '#ffffff', '#8a8a90', false);
  const prev = c.imageSmoothingEnabled;
  c.imageSmoothingEnabled = false;
  c.drawImage(adCanvas(seed), x - w / 2 + w * 0.03, y - h + h * 0.05, w * 0.94, h * 0.42);
  c.imageSmoothingEnabled = prev;
  for (const px of [-0.3, 0, 0.3]) {
    rect(c, '#2a2a30', x + w * px - w * 0.005, y - h * 1.06, Math.max(0.5, w * 0.01), h * 0.06);
    poly(c, '#3a3a40', x + w * px - w * 0.03, y - h * 1.06, x + w * px + w * 0.03, y - h * 1.06, x + w * px + w * 0.02, y - h * 1.03, x + w * px - w * 0.02, y - h * 1.03);
    rect(c, '#fff4c0', x + w * px - w * 0.018, y - h * 1.03, w * 0.036, Math.max(0.5, h * 0.008));
  }
};

// viaduto sobre a pista: tabuleiro com mureta e dois pilares (o vão no meio é transparente)
const bridge: Draw = (c, x, y, w, h) => {
  // viaduto de concreto: tabuleiro com juntas e manchas, mureta com pingadeira, pilares em 3 tons
  const deck = h * 0.22;
  rect(c, '#8a8a8e', x - w / 2, y - h, w, deck);
  for (let i = 0; i < 40; i++) rect(c, i % 3 ? '#7e7e84' : '#96969a', x - w / 2 + (w * i) / 40, y - h + deck * 0.3, w / 80, deck * 0.4);
  for (let i = 1; i < 6; i++) rect(c, '#5e5e64', x - w / 2 + (w * i) / 6, y - h, Math.max(0.5, w * 0.003), deck);
  rect(c, '#b4b4b8', x - w / 2, y - h, w, deck * 0.22);
  rect(c, '#5e5e64', x - w / 2, y - h + deck * 0.75, w, deck * 0.25);
  rect(c, dither(c, '#5e5e64', 'rgba(0,0,0,0)'), x - w / 2, y - h + deck, w, deck * 0.12);
  for (let i = 0; i < 24; i++) rect(c, '#6a6a70', x - w / 2 + (w * i) / 24, y - h - deck * 0.3, w * 0.008, deck * 0.3);
  rect(c, '#6a6a70', x - w / 2, y - h - deck * 0.34, w, deck * 0.08);
  rect(c, '#9a9aa0', x - w / 2, y - h - deck * 0.34, w, deck * 0.025);
  for (const px of [-0.5, 0.43]) {
    rect(c, '#7a7a80', x + w * px, y - h + deck, w * 0.07, h - deck);
    rect(c, '#a8a8ae', x + w * px, y - h + deck, w * 0.02, h - deck);
    rect(c, '#4e4e54', x + w * px + w * 0.05, y - h + deck, w * 0.02, h - deck);
    rect(c, dither(c, '#7a7a80', '#6a6a70'), x + w * (px + 0.02), y - h + deck, w * 0.03, h - deck);
    for (let k = 1; k < 4; k++) rect(c, '#5e5e64', x + w * px, y - h + deck + (h - deck) * k / 4, w * 0.07, Math.max(0.5, h * 0.006));
  }
  for (let i = 0; i < 16; i++) rect(c, i % 2 ? '#202020' : '#e8c020', x - w * 0.42 + (w * 0.84 * i) / 16, y - h + deck * 0.8, (w * 0.84) / 16, deck * 0.2);
};

// ---------- objetos dos biomas novos ----------
// árvore de outono: copa laranja e vermelha, algumas folhas no chão
const autumn: Draw = (c, x, y, w, h, seed) => {
  trunk(c, x, y, w * 0.14, h * 0.5, '#2e1c0c', '#5a3a1c', '#8a5e32');
  const red = seed % 3 === 0;
  const pal: Pal5 = red ? ['#3a0806', '#6a1410', '#b02a18', '#e05a30', '#ffb070'] : ['#4a1c06', '#7a3a10', '#c8661a', '#f0a830', '#ffe080'];
  foliage(c, x, y - h * 0.64, w * 0.5, h * 0.35, pal, seed, 34);
  // folhas caídas no chão
  const rnd = seeded(seed + 21);
  for (let i = 0; i < 10; i++) rect(c, rnd() < 0.5 ? pal[2] : pal[3], x + (rnd() - 0.5) * w * 0.8, y - rnd() * h * 0.02, w * 0.03, h * 0.012);
};

// acácia da savana: tronco fino e torto em forquilha, copa achatada larga em camadas
const acacia: Draw = (c, x, y, w, h, seed) => {
  poly(c, '#3a2616', x - w * 0.04, y, x + w * 0.04, y, x + w * 0.02, y - h * 0.55, x + w * 0.2, y - h * 0.74, x + w * 0.15, y - h * 0.76, x - w * 0.02, y - h * 0.6, x - w * 0.18, y - h * 0.76, x - w * 0.23, y - h * 0.74, x - w * 0.05, y - h * 0.55);
  rect(c, '#6a4a30', x - w * 0.035, y - h * 0.55, w * 0.02, h * 0.55);
  const pal: Pal5 = ['#1a2e0a', '#2e4c14', '#4a7020', '#6e9a2c', '#b0d060'];
  foliage(c, x - w * 0.16, y - h * 0.82, w * 0.3, h * 0.1, pal, seed, 14);
  foliage(c, x + w * 0.18, y - h * 0.81, w * 0.28, h * 0.1, pal, seed + 4, 14);
  foliage(c, x, y - h * 0.86, w * 0.36, h * 0.11, pal, seed + 8, 18);
};

// guarda-sol de praia listrado com cadeira
const umbrella: Draw = (c, x, y, w, h, seed) => {
  rect(c, '#e8e8e8', x - w * 0.02, y - h * 0.75, w * 0.04, h * 0.75);
  const cols = [['#e82a2a', '#ffffff'], ['#1a6ae8', '#ffe040'], ['#2aa84a', '#ffffff']][seed % 3];
  for (let i = 0; i < 6; i++) {
    const a0 = Math.PI + (Math.PI * i) / 6, a1 = Math.PI + (Math.PI * (i + 1)) / 6;
    poly(c, cols[i % 2], x, y - h * 0.95, x + Math.cos(a0) * w * 0.5, y - h * 0.72 + Math.sin(a0 + Math.PI) * h * 0.02, x + Math.cos(a1) * w * 0.5, y - h * 0.72 + Math.sin(a1 + Math.PI) * h * 0.02);
  }
  rect(c, 'rgba(0,0,0,0.25)', x - w * 0.5, y - h * 0.72, w, h * 0.03);
  // espreguiçadeira
  poly(c, '#d8b070', x + w * 0.08, y, x + w * 0.42, y, x + w * 0.42, y - h * 0.12, x + w * 0.3, y - h * 0.3, x + w * 0.26, y - h * 0.28, x + w * 0.34, y - h * 0.12, x + w * 0.08, y - h * 0.12);
  ell(c, 'rgba(0,0,0,0.2)', x, y, w * 0.5, h * 0.03);
};

// quiosque de praia com teto de palha
const kiosk: Draw = (c, x, y, w, h) => {
  siding(c, x - w * 0.36, y - h * 0.5, w * 0.72, h * 0.5, '#8a5a2a', '#5a3a1a', '#b07a40', h * 0.05);
  rect(c, '#2a1a0a', x - w * 0.3, y - h * 0.44, w * 0.42, h * 0.18);
  for (let i = 0; i < 4; i++) ell(c, i % 2 ? '#6a4a1a' : '#8a6a2a', x - w * 0.24 + i * w * 0.1, y - h * 0.3, w * 0.035, h * 0.03); // cocos no balcão
  rect(c, '#e8e0c0', x - w * 0.4, y - h * 0.28, w * 0.8, h * 0.05);
  rect(c, '#b8b090', x - w * 0.4, y - h * 0.24, w * 0.8, h * 0.012);
  for (const px of [-0.42, 0.38]) { rect(c, '#6a4a2a', x + w * px, y - h * 0.62, w * 0.04, h * 0.62); rect(c, '#8a6a3a', x + w * px, y - h * 0.62, w * 0.012, h * 0.62); }
  // telhado de palha em camadas, com fios soltos na borda
  const pts = [x - w / 2, y - h * 0.58, x + w / 2, y - h * 0.58, x, y - h];
  poly(c, '#c8a250', ...pts);
  clipPoly(c, pts, () => {
    for (let r = 0; r < 6; r++) {
      const yy = y - h + (h * 0.42 * r) / 6;
      rect(c, '#9a7a30', x - w / 2, yy + h * 0.055, w, h * 0.015);
      for (let k = 0; k < 30; k++) rect(c, k % 3 ? '#e0c070' : '#a8862e', x - w / 2 + k * w / 30 + (r % 2) * w / 60, yy, Math.max(0.5, w * 0.006), h * 0.06);
    }
    poly(c, dither(c, '#7a5a20', 'rgba(0,0,0,0)'), x, y - h, x + w / 2, y - h * 0.58, x + w * 0.18, y - h * 0.58);
  });
  for (let i = 0; i < 12; i++) rect(c, i % 2 ? '#e0c070' : '#b0903a', x - w * 0.49 + i * w * 0.083, y - h * 0.6, Math.max(0.5, w * 0.012), h * (0.05 + (i % 3) * 0.015));
  if (w > 14) {
    c.font = `bold ${Math.floor(h * 0.1)}px monospace`;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillStyle = '#d02020';
    c.fillText('COCO', x - w * 0.06, y - h * 0.25);
  }
};

// fábrica: galpão com telhado em serra e chaminé listrada
const factory: Draw = (c, x, y, w, h) => {
  // galpão de chapa ondulada com telhado em serra envidraçado e chaminé listrada fumegando
  rect(c, '#7a7466', x - w / 2, y - h * 0.45, w * 0.8, h * 0.45);
  for (let i = 0; i < 40; i++) rect(c, i % 2 ? '#8e887a' : '#666054', x - w / 2 + i * w * 0.02, y - h * 0.45, w * 0.01, h * 0.45);
  rect(c, '#4a463e', x + w * 0.3, y - h * 0.45, w * 0.2, h * 0.45);
  for (let i = 0; i < 10; i++) rect(c, '#3a362e', x + w * 0.3 + i * w * 0.02, y - h * 0.45, w * 0.006, h * 0.45);
  for (let i = 0; i < 4; i++) {
    const tx = x - w / 2 + i * w * 0.2;
    poly(c, '#8a8478', tx, y - h * 0.45, tx + w * 0.2, y - h * 0.45, tx + w * 0.2, y - h * 0.6);
    poly(c, '#a8a296', tx, y - h * 0.45, tx + w * 0.05, y - h * 0.45, tx + w * 0.2, y - h * 0.59, tx + w * 0.2, y - h * 0.6);
    rect(c, '#6a8aa8', tx + w * 0.165, y - h * 0.58, w * 0.03, h * 0.12);
    rect(c, '#b8d0e8', tx + w * 0.165, y - h * 0.58, w * 0.01, h * 0.12);
  }
  for (let i = 0; i < 5; i++) windowPane(c, x - w * 0.44 + i * w * 0.15, y - h * 0.34, w * 0.09, h * 0.09, '#4a4a50', '#2e3e52');
  rect(c, '#4a4a50', x - w * 0.1, y - h * 0.18, w * 0.18, h * 0.18);
  for (let i = 0; i < 6; i++) rect(c, '#5e5e64', x - w * 0.1, y - h * (0.17 - i * 0.03), w * 0.18, h * 0.006);
  for (let i = 0; i < 8; i++) {
    const col = i % 2 ? ['#a02a1e', '#c83a2a', '#e86050'] : ['#b8b8b8', '#e8e8e8', '#ffffff'];
    rect(c, col[1], x + w * 0.34, y - h * (0.45 + (i + 1) * 0.07), w * 0.1, h * 0.07);
    rect(c, col[2], x + w * 0.34, y - h * (0.45 + (i + 1) * 0.07), w * 0.025, h * 0.07);
    rect(c, col[0], x + w * 0.42, y - h * (0.45 + (i + 1) * 0.07), w * 0.02, h * 0.07);
  }
  rect(c, '#6a6a70', x + w * 0.33, y - h * 1.01, w * 0.12, h * 0.02);
  for (const [dx, dy, r] of [[0.42, 1.04, 0.07], [0.48, 1.08, 0.09], [0.56, 1.1, 0.08]]) {
    ell(c, '#a8a8b0', x + w * dx, y - h * dy, w * r, h * r * 0.5);
    ell(c, '#e4e4ea', x + w * (dx - 0.02), y - h * (dy + 0.01), w * r * 0.6, h * r * 0.3);
  }
};

// silo / tanque industrial
const silo: Draw = (c, x, y, w, h) => {
  const P: Pal5 = ['#6a6a72', '#8a8a92', '#b0b0b8', '#d4d4dc', '#f0f0f6'];
  cylinder(c, x - w * 0.4, y - h * 0.85, w * 0.8, h * 0.85, P);
  ell(c, P[1], x, y - h * 0.85, w * 0.4, h * 0.07);
  ell(c, P[3], x - w * 0.08, y - h * 0.87, w * 0.22, h * 0.035);
  for (let i = 1; i < 6; i++) { rect(c, P[0], x - w * 0.4, y - h * (0.85 - i * 0.14), w * 0.8, Math.max(0.5, h * 0.008)); rect(c, P[4], x - w * 0.4, y - h * (0.85 - i * 0.14) + h * 0.008, w * 0.3, Math.max(0.5, h * 0.004)); }
  // escada com gaiola
  rect(c, '#4a4a52', x + w * 0.42, y - h * 0.85, w * 0.012, h * 0.85);
  rect(c, '#4a4a52', x + w * 0.5, y - h * 0.85, w * 0.012, h * 0.7);
  for (let i = 0; i < 14; i++) rect(c, '#4a4a52', x + w * 0.42, y - h * (0.08 + i * 0.055), w * 0.09, Math.max(0.5, h * 0.006));
  rect(c, '#7a7a82', x - w * 0.42, y - h * 0.03, w * 0.84, h * 0.03);
};

// bananeira da selva: folhas grandes e caídas
const banana: Draw = (c, x, y, w, h) => {
  // pseudocaule com bainhas, folhas largas com nervura e rasgos, cacho e coração roxo
  rect(c, '#3a5a1e', x - w * 0.06, y - h * 0.56, w * 0.12, h * 0.56);
  rect(c, '#6a8a3a', x - w * 0.06, y - h * 0.56, w * 0.04, h * 0.56);
  for (let i = 1; i < 5; i++) poly(c, '#4e6e28', x - w * 0.06, y - h * i * 0.12, x + w * 0.06, y - h * (i * 0.12 + 0.05), x + w * 0.06, y - h * (i * 0.12 + 0.02));
  const leaf = (dx: number, up: number, cols: [string, string, string]) => {
    const bx = x, by = y - h * 0.58, tx = x + dx * w * 0.55, ty = y - h * (0.45 + up * 0.2), mx = x + dx * w * 0.3, my = y - h * (0.6 + up * 0.35);
    poly(c, cols[0], bx, by, mx - dx * w * 0.04, my - h * 0.03, tx, ty, mx + dx * w * 0.06, my + h * 0.08, x + dx * w * 0.22, y - h * 0.48);
    poly(c, cols[1], bx, by, mx - dx * w * 0.03, my - h * 0.02, tx, ty, mx, my + h * 0.02);
    poly(c, cols[2], bx, by - h * 0.005, mx, my - h * 0.005, tx, ty, mx, my + h * 0.004); // nervura
    for (let k = 1; k < 4; k++) { const f = k / 4; rect(c, cols[0], bx + (tx - bx) * f, by + (ty - by) * f + h * 0.01, Math.max(0.5, w * 0.012), h * 0.05); } // rasgos
  };
  const D: [string, string, string] = ['#0e4a12', '#1a6a1a', '#4a9a3a'], M: [string, string, string] = ['#1a6a1a', '#2e9a2a', '#7ac85a'];
  for (const [dx, up] of [[-1, 0.6], [1, 0.5], [-0.8, 1.1], [0.9, 1]]) leaf(dx, up, D);
  for (const [dx, up] of [[-0.5, 1.2], [0.4, 1.25], [0.1, 1.3]]) leaf(dx, up, M);
  for (let i = 0; i < 5; i++) ell(c, i % 2 ? '#c8b020' : '#a8a018', x + w * 0.08 + (i % 2) * w * 0.03, y - h * (0.52 - i * 0.025), w * 0.04, h * 0.018);
  ell(c, '#7a2a5a', x + w * 0.1, y - h * 0.4, w * 0.03, h * 0.035);
};

// torre de pedra vermelha do cânion
const spire: Draw = (c, x, y, w, h) => {
  // torre de arenito em estratos: face esquerda ao sol, direita na sombra, fendas e cascalho no pé
  const out = [x - w / 2, y, x - w * 0.32, y - h * 0.5, x - w * 0.26, y - h * 0.92, x + w * 0.1, y - h, x + w * 0.3, y - h * 0.6, x + w / 2, y];
  poly(c, '#a8482a', ...out);
  clipPoly(c, out, () => {
    for (let i = 0; i < 12; i++) {
      const yy = y - h * (i + 1) / 12;
      rect(c, i % 3 === 0 ? '#c0603a' : i % 3 === 1 ? '#a8482a' : '#94402a', x - w / 2, yy, w, h / 12);
      rect(c, '#7a3018', x - w / 2, yy + h / 12 - Math.max(0.5, h * 0.006), w, Math.max(0.5, h * 0.006));
    }
    poly(c, '#e0905a', x - w * 0.34, y, x - w * 0.32, y - h * 0.5, x - w * 0.26, y - h * 0.92, x - w * 0.12, y - h * 0.95, x - w * 0.18, y - h * 0.4, x - w * 0.24, y);
    poly(c, dither(c, '#e0905a', '#c0603a'), x - w * 0.24, y, x - w * 0.18, y - h * 0.4, x - w * 0.1, y - h * 0.4, x - w * 0.14, y);
    poly(c, '#5a2214', x + w * 0.1, y - h, x + w * 0.3, y - h * 0.6, x + w / 2, y, x + w * 0.16, y);
    poly(c, dither(c, '#5a2214', '#94402a'), x + w * 0.02, y - h * 0.9, x + w * 0.1, y - h, x + w * 0.16, y, x + w * 0.06, y);
    rect(c, '#4a1a10', x - w * 0.04, y - h * 0.7, Math.max(0.5, w * 0.02), h * 0.3);
    rect(c, '#4a1a10', x + w * 0.22, y - h * 0.4, Math.max(0.5, w * 0.02), h * 0.2);
  });
  for (let i = 0; i < 7; i++) ell(c, i % 2 ? '#8a3a20' : '#c06a40', x - w * 0.45 + i * w * 0.15, y - h * 0.01, w * 0.05, h * 0.015);
};

// farol listrado (praia)
const lighthouse: Draw = (c, x, y, w, h) => {
  rect(c, '#8a8a88', x - w * 0.4, y - h * 0.08, w * 0.8, h * 0.08);
  rect(c, '#b8b8b4', x - w * 0.4, y - h * 0.08, w * 0.8, h * 0.015);
  for (let i = 0; i < 6; i++) {
    const t0 = i / 6, t1 = (i + 1) / 6;
    const w0 = w * (0.3 - t0 * 0.12), w1 = w * (0.3 - t1 * 0.12);
    const red = i % 2 === 1;
    const y0 = y - h * 0.08 - h * 0.7 * t0, y1 = y - h * 0.08 - h * 0.7 * t1;
    poly(c, red ? '#c01c1c' : '#e8e8e4', x - w0, y0, x + w0, y0, x + w1, y1, x - w1, y1);
    poly(c, red ? '#e84a3a' : '#ffffff', x - w0, y0, x - w0 * 0.5, y0, x - w1 * 0.5, y1, x - w1, y1);
    poly(c, red ? '#7a1010' : '#a8a8a4', x + w0 * 0.55, y0, x + w0, y0, x + w1, y1, x + w1 * 0.55, y1);
  }
  rect(c, '#2a2a30', x - w * 0.24, y - h * 0.8, w * 0.48, h * 0.025);
  for (let i = 0; i < 7; i++) rect(c, '#2a2a30', x - w * 0.22 + i * w * 0.07, y - h * 0.835, Math.max(0.5, w * 0.012), h * 0.035);
  rect(c, '#2a2a30', x - w * 0.24, y - h * 0.84, w * 0.48, h * 0.008);
  rect(c, '#fff4b0', x - w * 0.14, y - h * 0.92, w * 0.28, h * 0.1);
  rect(c, '#ffffe8', x - w * 0.12, y - h * 0.91, w * 0.08, h * 0.08);
  rect(c, '#2a2a30', x - w * 0.02, y - h * 0.92, w * 0.04, h * 0.1);
  poly(c, '#a01818', x - w * 0.18, y - h * 0.92, x + w * 0.18, y - h * 0.92, x, y - h);
  poly(c, '#d83a2a', x - w * 0.18, y - h * 0.92, x - w * 0.04, y - h * 0.92, x, y - h);
};

// chalé dos alpes: madeira escura, telhado de duas águas com neve
const chalet: Draw = (c, x, y, w, h) => {
  // toras de madeira escura, base de pedra, varanda e telhado com beiral largo
  siding(c, x - w * 0.4, y - h * 0.55, w * 0.8, h * 0.55, '#6a4024', '#3e2412', '#8e5a34', h * 0.06);
  for (let i = 0; i < 10; i++) ell(c, i % 2 ? '#8a8a84' : '#a8a8a0', x - w * 0.38 + i * w * 0.084, y - h * 0.04, w * 0.045, h * 0.035);
  for (const wx of [-0.3, 0.12]) {
    windowPane(c, x + w * wx, y - h * 0.44, w * 0.14, h * 0.13, '#3a2010', '#2e3e5a');
    rect(c, '#8a2a1a', x + w * wx - w * 0.05, y - h * 0.45, w * 0.04, h * 0.15);
    rect(c, '#8a2a1a', x + w * wx + w * 0.15, y - h * 0.45, w * 0.04, h * 0.15);
  }
  rect(c, '#3a2010', x - w * 0.06, y - h * 0.3, w * 0.12, h * 0.26);
  rect(c, '#5a3418', x - w * 0.06, y - h * 0.3, w * 0.03, h * 0.26);
  // varanda
  rect(c, '#4a2a14', x - w * 0.42, y - h * 0.58, w * 0.84, h * 0.03);
  for (let i = 0; i < 9; i++) rect(c, '#5a3418', x - w * 0.4 + i * w * 0.1, y - h * 0.66, w * 0.02, h * 0.08);
  rect(c, '#4a2a14', x - w * 0.42, y - h * 0.67, w * 0.84, h * 0.015);
  roof(c, x, y - h * 0.62, w * 1.12, y - h * 0.98, '#4a2a18', '#2a160c', '#6e4428');
  rect(c, '#5a3a24', x + w * 0.18, y - h * 1.0, w * 0.08, h * 0.16);
  rect(c, '#2a1a10', x + w * 0.17, y - h * 1.01, w * 0.1, h * 0.03);
};

// pedra com neve por cima
const snowrock: Draw = (c, x, y, w, h, seed) => {
  rock(c, x, y, w, h, seed);
  poly(c, '#f4f8fc', x - w * 0.38, y - h * 0.62, x - w * 0.08, y - h, x + w * 0.3, y - h * 0.78, x + w * 0.42, y - h * 0.5, x + w * 0.2, y - h * 0.6, x - w * 0.05, y - h * 0.72, x - w * 0.3, y - h * 0.5);
  poly(c, '#c8d6e6', x + w * 0.06, y - h * 0.82, x + w * 0.3, y - h * 0.78, x + w * 0.42, y - h * 0.5, x + w * 0.2, y - h * 0.6);
  ell(c, '#eef2f8', x, y, w * 0.55, h * 0.06);
};

// chalé no inverno: neve acumulada no chão, na janela e fumaça na chaminé
const snowchalet: Draw = (c, x, y, w, h, seed) => {
  chalet(c, x, y, w, h, seed);
  ell(c, '#f4f8fc', x, y - h * 0.01, w * 0.55, h * 0.05);
  for (const wx of [-0.3, 0.1]) rect(c, '#f4f8fc', x + w * wx - w * 0.03, y - h * 0.29, w * 0.22, h * 0.025);
  ell(c, 'rgba(225,230,238,0.85)', x + w * 0.24, y - h * 1.04, w * 0.06, h * 0.035);
  ell(c, 'rgba(225,230,238,0.65)', x + w * 0.3, y - h * 1.1, w * 0.08, h * 0.04);
};

// boneco de neve com cachecol vermelho
const snowman: Draw = (c, x, y, w, h) => {
  ell(c, '#dfe6f0', x, y - h * 0.24, w * 0.46, h * 0.24);
  ell(c, '#f6f9fc', x - w * 0.06, y - h * 0.27, w * 0.36, h * 0.19);
  ell(c, '#dfe6f0', x, y - h * 0.6, w * 0.34, h * 0.17);
  ell(c, '#f6f9fc', x - w * 0.05, y - h * 0.62, w * 0.26, h * 0.13);
  ell(c, '#dfe6f0', x, y - h * 0.84, w * 0.24, h * 0.12);
  ell(c, '#f6f9fc', x - w * 0.04, y - h * 0.86, w * 0.18, h * 0.09);
  rect(c, '#c82020', x - w * 0.26, y - h * 0.74, w * 0.52, h * 0.05);
  rect(c, '#a01818', x + w * 0.1, y - h * 0.74, w * 0.1, h * 0.16);
  rect(c, '#202024', x - w * 0.2, y - h * 0.98, w * 0.4, h * 0.03);
  rect(c, '#202024', x - w * 0.13, y - h * 1.08, w * 0.26, h * 0.1);
  rect(c, '#f08a1a', x, y - h * 0.85, w * 0.14, h * 0.025);
  for (const ex of [-0.08, 0.06]) rect(c, '#202024', x + w * ex, y - h * 0.89, w * 0.04, h * 0.02);
  for (const by of [0.55, 0.62]) rect(c, '#202024', x - w * 0.02, y - h * by, w * 0.04, h * 0.02);
  poly(c, '#5a3a20', x - w * 0.3, y - h * 0.6, x - w * 0.62, y - h * 0.78, x - w * 0.6, y - h * 0.8, x - w * 0.28, y - h * 0.62);
  poly(c, '#5a3a20', x + w * 0.3, y - h * 0.6, x + w * 0.6, y - h * 0.74, x + w * 0.62, y - h * 0.72, x + w * 0.32, y - h * 0.58);
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
  barn: { w: 3400, h: 2800, draw: barn, solid: true },
  fence: { w: 2200, h: 450, draw: fence, solid: false },
  lamp: { w: 300, h: 2800, draw: lamp, solid: true },
  signL: { w: 650, h: 850, draw: sign(-1), solid: true },
  signR: { w: 650, h: 850, draw: sign(1), solid: true },
  warnL: { w: 760, h: 1500, draw: warn(-1, false), solid: true },
  warnR: { w: 760, h: 1500, draw: warn(1, false), solid: true },
  sharpL: { w: 760, h: 1500, draw: warn(-1, true), solid: true },
  sharpR: { w: 760, h: 1500, draw: warn(1, true), solid: true },
  gasSign: { w: 1600, h: 2600, draw: gasSign, solid: true },
  gasKm: { w: 1500, h: 1500, draw: gasKm, solid: true },
  station: { w: 6500, h: 3200, draw: station, solid: true },
  stop: { w: 900, h: 1900, draw: stop, solid: false },
  rail: { w: 700, h: 420, draw: rail, solid: false },
  billboard: { w: 3600, h: 2600, draw: billboard, solid: true },
  bridge: { w: 12000, h: 2200, draw: bridge, solid: false },
  autumn: { w: 1700, h: 2100, draw: autumn, solid: true },
  acacia: { w: 2600, h: 2000, draw: acacia, solid: true },
  umbrella: { w: 900, h: 1100, draw: umbrella, solid: false },
  kiosk: { w: 2400, h: 1900, draw: kiosk, solid: true },
  factory: { w: 5200, h: 3600, draw: factory, solid: true },
  silo: { w: 1600, h: 3000, draw: silo, solid: true },
  banana: { w: 1600, h: 2300, draw: banana, solid: true },
  spire: { w: 2200, h: 4200, draw: spire, solid: true },
  lighthouse: { w: 1400, h: 4600, draw: lighthouse, solid: true },
  chalet: { w: 2800, h: 2600, draw: chalet, solid: true },
  snowrock: { w: 1500, h: 900, draw: snowrock, solid: true },
  snowchalet: { w: 2800, h: 2600, draw: snowchalet, solid: true },
  snowman: { w: 700, h: 1000, draw: snowman, solid: true },
};

// Objetos desenhados pelo Victor (tools/ref/scenery_sprite.py: arte do gerador na grade nativa, recortada):
// quando a imagem do tipo existe, ela substitui o desenho vetorial, na mesma base e altura; a largura segue
// a proporção da arte (SCENERY_SIZE, em pixels do sprite). Enquanto carrega, vale o desenho vetorial.
const SCENERY_ART = import.meta.glob('./assets/scenery/*.png', { eager: true, import: 'default' }) as Record<string, string>;
const SCENERY_SIZE: Partial<Record<SpriteKind, [number, number]>> = {
  tree: [66, 64], pine: [47, 70], snowpine: [53, 74], bush: [59, 25],
  cactus: [47, 89], rock: [74, 47], snowrock: [62, 40], palm: [71, 99], autumn: [62, 67],
  acacia: [110, 66], banana: [96, 102], spire: [82, 86], snowman: [62, 75],
  house: [166, 95], barn: [100, 75], building: [90, 155], factory: [142, 95], silo: [94, 76], chalet: [142, 101],
  snowchalet: [168, 123], kiosk: [138, 65], umbrella: [74, 71], lighthouse: [74, 126], station: [145, 64],
};
const sceneryImgs = new Map<string, HTMLImageElement>();
// arte por nome de arquivo ('<tipo>', '<tipo>-2' = segundo modelo, '<tipo>-night' = luzes acesas)
function artImg(name: string): HTMLImageElement | null {
  const src = SCENERY_ART[`./assets/scenery/${name}.png`];
  if (!src) return null;
  let im = sceneryImgs.get(name);
  if (!im) {
    im = new Image();
    im.src = src;
    sceneryImgs.set(name, im);
  }
  return im.complete && im.naturalWidth ? im : null;
}
const hasArt = (name: string) => !!SCENERY_ART[`./assets/scenery/${name}.png`];
// à noite (e no lusco-fusco/túnel) as construções usam a arte com as luzes acesas
let sceneryNight = false;
export const setSceneryNight = (v: boolean) => { sceneryNight = v; };
const artName = (kind: SpriteKind, seed: number) => {
  const base = seed % 2 && hasArt(`${kind}-2`) ? `${kind}-2` : kind;
  return sceneryNight && hasArt(`${base}-night`) ? `${base}-night` : base;
};
const sceneryImg = (kind: SpriteKind, seed = 0) => artImg(artName(kind, seed));
// parte da chave do cache do sprite: muda quando a arte termina de carregar (troca o desenho vetorial)
// e quando acende (noite)
export const sceneryKey = (kind: SpriteKind) => (sceneryImg(kind) ? (sceneryNight && hasArt(`${kind}-night`) ? 'an' : 'a') : '');
export const preloadScenery = () => Object.keys(SCENERY_ART).forEach((p) => artImg(p.slice(17, -4)));
for (const [kind, size] of Object.entries(SCENERY_SIZE) as [SpriteKind, [number, number]][]) {
  if (!SCENERY_ART[`./assets/scenery/${kind}.png`]) continue;
  const def = SPRITES[kind], vector = def.draw;
  def.w = Math.round((def.h * size[0]) / size[1]);
  def.draw = (c, x, y, w, h, seed) => {
    const im = sceneryImg(kind, seed);
    if (!im) return vector(c, x, y, w, h, seed);
    const sm = c.imageSmoothingEnabled;
    c.imageSmoothingEnabled = false;
    // cada arte na própria proporção (a de dia e a acesa podem ter larguras diferentes), na mesma altura
    const dw = (h * im.naturalWidth) / im.naturalHeight;
    c.drawImage(im, x - dw / 2, y - h, dw, h);
    c.imageSmoothingEnabled = sm;
  };
}
