import { dither } from './ui';

// Objetos de cenário desenhados por código. Cada função desenha numa caixa:
// x = centro, y = base, w/h em pixels. O desenho passa pelo crisp.ts (pixel art nítida,
// com contorno escuro), então as formas usam cores chapadas, luz à esquerda e sombra à direita.

export type SpriteKind =
  | 'tree' | 'pine' | 'snowpine' | 'bush' | 'cactus' | 'rock' | 'palm' | 'post'
  | 'building' | 'house' | 'fence' | 'lamp' | 'signL' | 'signR' | 'gasSign' | 'station'
  | 'rail' | 'billboard' | 'bridge' | 'barn' | 'stop';

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

// copa de árvore: base escura, tufos médios e brilho em cima à esquerda
function canopy(c: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, dark: string, mid: string, light: string) {
  ell(c, dark, x, y, rx, ry);
  ell(c, dither(c, dark, mid), x - rx * 0.1, y - ry * 0.12, rx * 0.86, ry * 0.8);
  for (const [dx, dy, s] of [[-0.42, -0.1, 0.5], [0.38, -0.05, 0.48], [0, -0.45, 0.55], [-0.2, 0.3, 0.45], [0.3, 0.32, 0.4]]) {
    ell(c, mid, x + dx * rx, y + dy * ry, rx * s, ry * s * 0.9);
  }
  for (const [dx, dy, s] of [[-0.45, -0.25, 0.28], [-0.1, -0.58, 0.3], [0.25, -0.35, 0.2]]) {
    ell(c, light, x + dx * rx, y + dy * ry, rx * s, ry * s * 0.8);
  }
  ell(c, dither(c, dark, mid), x + rx * 0.45, y + ry * 0.35, rx * 0.3, ry * 0.25);
}

const tree: Draw = (c, x, y, w, h) => {
  rect(c, '#3a2410', x - w * 0.08, y - h * 0.46, w * 0.16, h * 0.46);
  rect(c, '#5a3a1c', x - w * 0.08, y - h * 0.46, w * 0.06, h * 0.46);
  poly(c, '#3a2410', x - w * 0.16, y, x + w * 0.16, y, x + w * 0.06, y - h * 0.08, x - w * 0.06, y - h * 0.08);
  canopy(c, x, y - h * 0.62, w * 0.5, h * 0.36, '#0a3c10', '#1a6a1e', '#3a9a32');
};

const pineDraw = (snow: boolean): Draw => (c, x, y, w, h) => {
  rect(c, '#40281a', x - w * 0.07, y - h * 0.2, w * 0.14, h * 0.2);
  rect(c, '#5c3c24', x - w * 0.07, y - h * 0.2, w * 0.05, h * 0.2);
  for (let i = 0; i < 4; i++) {
    const by = y - h * (0.12 + i * 0.2);
    const bw = w * (0.52 - i * 0.1);
    const ty = by - h * 0.34;
    poly(c, '#0a3418', x - bw, by, x + bw, by, x, ty);
    poly(c, '#16502a', x - bw, by, x, by, x, ty);                 // metade iluminada
    poly(c, '#24683a', x - bw, by, x - bw * 0.45, by, x, ty);
    poly(c, '#0a3418', x - bw * 0.7, by, x - bw * 0.5, by - h * 0.05, x - bw * 0.3, by);
    if (snow) {
      poly(c, '#f4f8fc', x - bw * 0.5, by - h * 0.17, x, ty, x + bw * 0.25, by - h * 0.2, x, by - h * 0.14);
      poly(c, '#f4f8fc', x - bw, by, x - bw * 0.6, by - h * 0.05, x - bw * 0.2, by);
      poly(c, '#c8d6e6', x, ty, x + bw * 0.25, by - h * 0.2, x + bw * 0.1, by - h * 0.18);
    }
  }
};

const bush: Draw = (c, x, y, w, h) => {
  for (const [dx, dy, s] of [[-0.25, -0.4, 0.32], [0.22, -0.4, 0.3], [0, -0.55, 0.36]]) ell(c, '#0c4410', x + dx * w, y + dy * h, w * s, h * s * 1.4);
  for (const [dx, dy, s] of [[-0.28, -0.48, 0.2], [0.18, -0.48, 0.18], [-0.02, -0.66, 0.22]]) ell(c, '#1e6e1e', x + dx * w, y + dy * h, w * s, h * s * 1.3);
  for (const [dx, dy] of [[-0.32, -0.58], [-0.06, -0.78]]) ell(c, '#3a9634', x + dx * w, y + dy * h, w * 0.08, h * 0.12);
  rect(c, '#0a3a0e', x - w * 0.45, y - h * 0.08, w * 0.9, h * 0.08);
};

const cactus: Draw = (c, x, y, w, h) => {
  const t = w * 0.28;
  const col = (cx: number, top: number, bot: number, tw: number) => {
    rect(c, '#256a2a', cx - tw / 2, top + tw / 2, tw, bot - top - tw / 2);
    ell(c, '#256a2a', cx, top + tw / 2, tw / 2, tw / 2);
    rect(c, '#3e9442', cx - tw / 2, top + tw / 2, tw * 0.3, bot - top - tw / 2);
    rect(c, '#1a5420', cx + tw * 0.15, top + tw / 2, tw * 0.12, bot - top - tw / 2);
  };
  col(x, y - h, y, t);
  // braços em L
  rect(c, '#256a2a', x - w * 0.42, y - h * 0.5, w * 0.3, t * 0.7);
  col(x - w * 0.36, y - h * 0.78, y - h * 0.44, t * 0.7);
  rect(c, '#256a2a', x + w * 0.1, y - h * 0.38, w * 0.3, t * 0.7);
  col(x + w * 0.36, y - h * 0.66, y - h * 0.32, t * 0.7);
};

const rock: Draw = (c, x, y, w, h) => {
  poly(c, '#6a5a50', x - w / 2, y, x - w * 0.38, y - h * 0.62, x - w * 0.08, y - h, x + w * 0.3, y - h * 0.78, x + w / 2, y - h * 0.2, x + w * 0.46, y);
  poly(c, '#9a887a', x - w * 0.38, y - h * 0.62, x - w * 0.08, y - h, x + w * 0.06, y - h * 0.5, x - w * 0.24, y - h * 0.34);
  poly(c, '#4c3e36', x + w * 0.06, y - h * 0.5, x + w * 0.3, y - h * 0.78, x + w / 2, y - h * 0.2, x + w * 0.46, y, x + w * 0.1, y);
  poly(c, '#b8a696', x - w * 0.3, y - h * 0.6, x - w * 0.1, y - h * 0.9, x - w * 0.12, y - h * 0.62);
  c.fillStyle = '#3a2e28';
  c.fillRect(x - w * 0.2, y - h * 0.3, w * 0.18, Math.max(0.5, h * 0.03));
};

const palm: Draw = (c, x, y, w, h) => {
  const tw = Math.max(1, w * 0.07);
  const tx = x + w * 0.14, ty = y - h * 0.78;
  // tronco curvo em gomos
  for (let i = 0; i < 10; i++) {
    const f0 = i / 10, f1 = (i + 1) / 10;
    const x0 = x + (tx - x) * f0 ** 1.6, x1 = x + (tx - x) * f1 ** 1.6;
    const y0 = y + (ty - y) * f0, y1 = y + (ty - y) * f1;
    poly(c, i % 2 ? '#7a5028' : '#9a6a38', x0 - tw, y0, x0 + tw, y0, x1 + tw * 0.8, y1, x1 - tw * 0.8, y1);
  }
  // folhas caídas
  const leaf = (dx: number, dy: number, col: string) => {
    poly(c, col, tx, ty - h * 0.02, tx + dx * w * 0.55, ty - dy * h * 0.12, tx + dx * w, ty + h * (0.1 - dy * 0.05),
      tx + dx * w * 0.5, ty + h * 0.02);
  };
  for (const [dx, dy] of [[-1, 0.4], [1, 0.4], [-0.7, 1], [0.7, 1]]) leaf(dx * 0.5, dy, '#1a6a22');
  for (const [dx, dy] of [[-0.8, 0.9], [0.85, 0.7], [-0.3, 1.4], [0.35, 1.3]]) leaf(dx * 0.5, dy, '#2e8a30');
  leaf(-0.25, 1.5, '#4aa840');
  ell(c, '#5a3a16', tx - w * 0.03, ty + h * 0.02, w * 0.04, h * 0.02);
  ell(c, '#5a3a16', tx + w * 0.04, ty + h * 0.03, w * 0.04, h * 0.02);
};

const post: Draw = (c, x, y, w, h) => {
  c.fillStyle = '#f0f0f0';
  c.fillRect(x - w / 2, y - h, Math.max(1, w), h);
  c.fillStyle = '#9a9a9a';
  c.fillRect(x + w / 2 - Math.max(0.5, w * 0.3), y - h, Math.max(0.5, w * 0.3), h);
  c.fillStyle = '#ff8a1a';
  c.fillRect(x - w / 2, y - h * 0.86, Math.max(1, w), Math.max(0.5, h * 0.1));
};

const WINDOW = ['#2a3a5a', '#2a3a5a', '#33476a', '#f0d070'];
const building: Draw = (c, x, y, w, h, seed) => {
  const hh = h * (0.55 + (seed % 45) / 100);
  const colors = ['#8a8aa0', '#a09078', '#707890', '#b0a890', '#7a6a80'];
  const base = colors[seed % colors.length];
  const L = x - w / 2, side = w * 0.16;
  rect(c, base, L, y - hh, w - side, hh);
  rect(c, '#3c3c48', L + w - side, y - hh + side * 0.4, side, hh - side * 0.4);      // lateral na sombra
  poly(c, '#5a5a68', L, y - hh, L + w - side, y - hh, L + w, y - hh + side * 0.4, L + side, y - hh + side * 0.4);
  rect(c, '#d8d8e0', L, y - hh, w - side, Math.max(0.5, hh * 0.02));
  if (w < 10) return;
  const cols = 4, rows = Math.max(4, Math.round(hh / (w * 0.22)));
  const cw = (w - side) / (cols * 2 + 1), rh = hh / (rows * 2 + 1.5);
  for (let r = 0; r < rows; r++)
    for (let k = 0; k < cols; k++) {
      c.fillStyle = WINDOW[(seed * 7 + r * 13 + k * 5) % WINDOW.length];
      c.fillRect(L + cw * (k * 2 + 1), y - hh + rh * (r * 2 + 1.2), cw, rh);
    }
  rect(c, '#2a2a30', x - side - w * 0.08, y - h * 0.08, w * 0.16, h * 0.08);
};

const house: Draw = (c, x, y, w, h, seed) => {
  const wall = seed % 2 ? '#e8dcc0' : '#f0f0e8';
  const roof = seed % 3 ? '#a03a2a' : '#5a4a3a';
  rect(c, wall, x - w * 0.4, y - h * 0.55, w * 0.8, h * 0.55);
  rect(c, seed % 2 ? '#c8b896' : '#c8c8be', x + w * 0.22, y - h * 0.55, w * 0.18, h * 0.55);
  rect(c, '#8a8a80', x - w * 0.4, y - h * 0.06, w * 0.8, h * 0.06);
  rect(c, '#6a4a3a', x + w * 0.16, y - h * 0.96, w * 0.08, h * 0.2);                // chaminé
  poly(c, roof, x - w / 2, y - h * 0.55, x + w / 2, y - h * 0.55, x, y - h);
  poly(c, '#3a2018', x, y - h, x + w / 2, y - h * 0.55, x + w * 0.38, y - h * 0.55, x, y - h * 0.9);
  for (let i = 1; i < 4; i++) {
    c.fillStyle = '#5a2418';
    c.fillRect(x - w * (0.5 - i * 0.04), y - h * (0.55 + i * 0.1), w * (1 - i * 0.24) * 0.6, Math.max(0.5, h * 0.015));
  }
  rect(c, '#4a2a14', x - w * 0.07, y - h * 0.32, w * 0.14, h * 0.32);
  rect(c, '#e0c060', x + w * 0.03, y - h * 0.17, w * 0.02, h * 0.03);
  for (const wx of [-0.32, 0.12]) {
    rect(c, '#ffffff', x + w * wx - w * 0.01, y - h * 0.47, w * 0.16, h * 0.15);
    rect(c, '#3a5a8a', x + w * wx, y - h * 0.46, w * 0.14, h * 0.13);
    rect(c, '#8ab0d8', x + w * wx, y - h * 0.46, w * 0.05, h * 0.05);
  }
};

const barn: Draw = (c, x, y, w, h) => {
  rect(c, '#a82a1e', x - w * 0.42, y - h * 0.6, w * 0.84, h * 0.6);
  rect(c, '#7a1e16', x + w * 0.2, y - h * 0.6, w * 0.22, h * 0.6);
  poly(c, '#5a3a2a', x - w / 2, y - h * 0.58, x - w * 0.3, y - h * 0.9, x + w * 0.3, y - h * 0.9, x + w / 2, y - h * 0.58);
  poly(c, '#3a2418', x, y - h * 0.9, x + w * 0.3, y - h * 0.9, x + w / 2, y - h * 0.58, x + w * 0.1, y - h * 0.58);
  rect(c, '#f0f0e8', x - w * 0.16, y - h * 0.42, w * 0.32, h * 0.42);
  rect(c, '#7a1e16', x - w * 0.14, y - h * 0.4, w * 0.28, h * 0.4);
  poly(c, '#f0f0e8', x - w * 0.14, y - h * 0.4, x - w * 0.11, y - h * 0.4, x + w * 0.14, y - h * 0.02, x + w * 0.11, y);
  poly(c, '#f0f0e8', x + w * 0.14, y - h * 0.4, x + w * 0.11, y - h * 0.4, x - w * 0.14, y - h * 0.02, x - w * 0.11, y);
  rect(c, '#f0f0e8', x - w * 0.07, y - h * 0.76, w * 0.14, h * 0.1);
};

const fence: Draw = (c, x, y, w, h) => {
  for (const ry of [0.75, 0.42]) {
    rect(c, '#b89a78', x - w / 2, y - h * ry, w, Math.max(1, h * 0.12));
    rect(c, '#e0c8a0', x - w / 2, y - h * ry, w, Math.max(0.5, h * 0.04));
  }
  for (let i = 0; i <= 4; i++) {
    const px = x - w / 2 + (w * i) / 4 - w * 0.02;
    rect(c, '#8a6a48', px, y - h, Math.max(1, w * 0.04), h);
    rect(c, '#c8a882', px, y - h, Math.max(0.5, w * 0.015), h);
  }
};

const lamp: Draw = (c, x, y, w, h) => {
  rect(c, '#5a5a62', x - w * 0.15, y - h, w * 0.3, h);
  rect(c, '#9a9aa4', x - w * 0.15, y - h, w * 0.1, h);
  rect(c, '#4a4a52', x - w * 0.3, y - h * 0.08, w * 0.6, h * 0.08);
  poly(c, '#5a5a62', x + w * 0.15, y - h, x - w * 1.3, y - h + w * 0.1, x - w * 1.3, y - h + w * 0.35, x + w * 0.15, y - h + w * 0.35);
  poly(c, '#3a3a40', x - w * 1.65, y - h + w * 0.05, x - w * 0.95, y - h + w * 0.05, x - w * 1.05, y - h + w * 0.42, x - w * 1.55, y - h + w * 0.42);
  rect(c, '#fff4b0', x - w * 1.5, y - h + w * 0.42, w * 0.4, w * 0.18);
};

const sign = (dir: 1 | -1): Draw => (c, x, y, w, h) => {
  for (const px of [-0.3, 0.3]) {
    rect(c, '#6a6a6a', x + w * px - w * 0.04, y - h * 0.5, w * 0.08, h * 0.5);
    rect(c, '#9a9a9a', x + w * px - w * 0.04, y - h * 0.5, w * 0.03, h * 0.5);
  }
  rect(c, '#ffcc00', x - w / 2, y - h, w, h * 0.55);
  rect(c, '#c89a00', x - w / 2, y - h * 0.5, w, h * 0.05);
  // duas setas (chevrons)
  for (const off of [-0.18, 0.18]) {
    const cx = x + w * off * dir, cy = y - h * 0.725, s = w * 0.16;
    poly(c, '#111', cx - s * dir, cy - s * 1.2, cx + s * 0.4 * dir, cy, cx - s * dir, cy + s * 1.2, cx - s * 0.4 * dir, cy);
  }
};

const gasSign: Draw = (c, x, y, w, h) => {
  rect(c, '#6a6a70', x - w * 0.04, y - h * 0.55, w * 0.08, h * 0.55);
  rect(c, '#9a9aa0', x - w * 0.04, y - h * 0.55, w * 0.03, h * 0.55);
  rect(c, '#1a3aa8', x - w / 2, y - h, w, h * 0.45);
  rect(c, '#2a52d0', x - w / 2, y - h, w, h * 0.06);
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

// placa de PARE da chegada (octógono vermelho com borda branca)
const stop: Draw = (c, x, y, w, h) => {
  rect(c, '#6a6a70', x - w * 0.05, y - h * 0.62, w * 0.1, h * 0.62);
  rect(c, '#9a9aa0', x - w * 0.05, y - h * 0.62, w * 0.04, h * 0.62);
  const oct = (r: number, color: string) => {
    const cy = y - h * 0.78, k = Math.tan(Math.PI / 8);
    const ry = r * (h / w) * 0.55;
    poly(c, color, x - r * k, cy - ry, x + r * k, cy - ry, x + r, cy - ry * k, x + r, cy + ry * k, x + r * k, cy + ry, x - r * k, cy + ry, x - r, cy + ry * k, x - r, cy - ry * k);
  };
  oct(w / 2, '#f4f4f4');
  oct(w * 0.44, '#d01818');
  if (w > 14) {
    c.font = `bold ${Math.floor(w * 0.26)}px monospace`;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillStyle = '#fff';
    c.fillText('PARE', x, y - h * 0.78);
  }
};

const station: Draw = (c, x, y, w, h) => {
  // loja ao fundo
  rect(c, '#e8e8e0', x + w * 0.1, y - h * 0.5, w * 0.38, h * 0.5);
  rect(c, '#b8b8b0', x + w * 0.38, y - h * 0.5, w * 0.1, h * 0.5);
  rect(c, '#2a4a8a', x + w * 0.14, y - h * 0.38, w * 0.2, h * 0.2);
  rect(c, '#8ab0d8', x + w * 0.14, y - h * 0.38, w * 0.06, h * 0.06);
  // cobertura das bombas
  for (const px of [-0.4, -0.06]) {
    rect(c, '#9a9aa0', x + w * px, y - h * 0.8, w * 0.03, h * 0.8);
    rect(c, '#d8d8de', x + w * px, y - h * 0.8, w * 0.01, h * 0.8);
  }
  rect(c, '#f2f2f2', x - w / 2, y - h * 0.92, w * 0.56, h * 0.14);
  rect(c, '#c82020', x - w / 2, y - h * 0.83, w * 0.56, h * 0.05);
  rect(c, '#b0b0b0', x - w / 2, y - h * 0.78, w * 0.56, h * 0.02);
  for (const px of [-0.32, -0.18]) {
    rect(c, '#d02a2a', x + w * px, y - h * 0.32, w * 0.07, h * 0.32);
    rect(c, '#f0f0f0', x + w * px + w * 0.01, y - h * 0.28, w * 0.05, h * 0.08);
    rect(c, '#202020', x + w * px + w * 0.07, y - h * 0.24, w * 0.01, h * 0.14);
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

// outdoor com anúncios fictícios
const ADS: [string, string, string][] = [
  ['DUEL', '#d02020', '#ffd400'], ['TURBO', '#1a3aa8', '#ffffff'], ['COLA', '#c81828', '#ffffff'],
  ['MOTEL', '#2a8a3a', '#fff4b0'], ['PNEUS', '#202024', '#ffcc00'], ['RADIO', '#7a2ac8', '#ffffff'],
];
const billboard: Draw = (c, x, y, w, h, seed) => {
  for (const px of [-0.3, 0.3]) {
    rect(c, '#5a5a60', x + w * px - w * 0.025, y - h * 0.5, w * 0.05, h * 0.5);
    rect(c, '#8a8a90', x + w * px - w * 0.025, y - h * 0.5, w * 0.018, h * 0.5);
  }
  rect(c, '#3a3a40', x - w * 0.36, y - h * 0.5, w * 0.72, h * 0.04);
  const [text, bg, fg] = ADS[seed % ADS.length];
  rect(c, '#e8e8e8', x - w / 2, y - h, w, h * 0.52);
  rect(c, bg, x - w / 2 + w * 0.03, y - h + h * 0.05, w * 0.94, h * 0.42);
  rect(c, fg, x - w / 2 + w * 0.03, y - h * 0.58, w * 0.94, h * 0.04);
  if (w > 16) {
    c.font = `bold ${Math.floor(h * 0.22)}px monospace`;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillStyle = fg;
    c.fillText(text, x, y - h * 0.76);
  }
  for (const px of [-0.3, 0, 0.3]) rect(c, '#2a2a30', x + w * px - w * 0.02, y - h * 1.04, w * 0.04, h * 0.05);
};

// viaduto sobre a pista: tabuleiro com mureta e dois pilares (o vão no meio é transparente)
const bridge: Draw = (c, x, y, w, h) => {
  const deck = h * 0.22;
  rect(c, '#8a8a8e', x - w / 2, y - h, w, deck);
  rect(c, '#b4b4b8', x - w / 2, y - h, w, deck * 0.25);
  rect(c, '#5e5e64', x - w / 2, y - h + deck * 0.75, w, deck * 0.25);
  for (let i = 0; i < 24; i++) rect(c, '#6a6a70', x - w / 2 + (w * i) / 24, y - h - deck * 0.3, w * 0.008, deck * 0.3);
  rect(c, '#6a6a70', x - w / 2, y - h - deck * 0.34, w, deck * 0.08);
  for (const px of [-0.5, 0.43]) {
    rect(c, '#7a7a80', x + w * px, y - h + deck, w * 0.07, h - deck);
    rect(c, '#a0a0a6', x + w * px, y - h + deck, w * 0.02, h - deck);
    rect(c, '#55555a', x + w * px + w * 0.05, y - h + deck, w * 0.02, h - deck);
    rect(c, dither(c, '#7a7a80', '#6a6a70'), x + w * (px + 0.02), y - h + deck, w * 0.03, h - deck);
  }
  // faixa amarela e preta embaixo do tabuleiro (altura livre)
  for (let i = 0; i < 16; i++) rect(c, i % 2 ? '#202020' : '#e8c020', x - w * 0.42 + (w * 0.84 * i) / 16, y - h + deck * 0.8, (w * 0.84) / 16, deck * 0.2);
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
  gasSign: { w: 1600, h: 2600, draw: gasSign, solid: true },
  station: { w: 6500, h: 3200, draw: station, solid: true },
  stop: { w: 900, h: 1900, draw: stop, solid: false },
  rail: { w: 700, h: 420, draw: rail, solid: false },
  billboard: { w: 3600, h: 2600, draw: billboard, solid: true },
  bridge: { w: 12000, h: 2200, draw: bridge, solid: false },
};
