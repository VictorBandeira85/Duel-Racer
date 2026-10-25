// Objetos de cenário desenhados por código (sem arquivos de imagem).
// Cada função desenha dentro de uma caixa: x = centro, y = base, w/h em pixels.

export type SpriteKind = 'palm' | 'bush' | 'rock' | 'cactus' | 'pine' | 'lamp' | 'building' | 'signL' | 'signR' | 'banner';

type Draw = (c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, seed: number) => void;

const tri = (c: CanvasRenderingContext2D, pts: number[], color: string) => {
  c.fillStyle = color;
  c.beginPath();
  c.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]);
  c.closePath();
  c.fill();
};

const palm: Draw = (c, x, y, w, h) => {
  const tw = Math.max(1, w * 0.09);
  const topX = x + w * 0.12, topY = y - h * 0.82;
  tri(c, [x - tw, y, x + tw, y, topX + tw * 0.6, topY, topX - tw * 0.6, topY], '#8a5a2b');
  const leaves: [number, number][] = [[-0.5, 0.05], [-0.42, -0.15], [-0.15, -0.2], [0.18, -0.2], [0.45, -0.12], [0.5, 0.08]];
  for (const [lx, ly] of leaves) {
    tri(c, [topX, topY - h * 0.02, topX + lx * w, topY - ly * h, topX + lx * w * 0.6, topY + h * 0.06], '#2f8a2f');
    tri(c, [topX, topY - h * 0.02, topX + lx * w, topY - ly * h, topX + lx * w * 0.7, topY - ly * h * 0.4 - h * 0.05], '#46b246');
  }
};

const bush: Draw = (c, x, y, w, h) => {
  c.fillStyle = '#2f7a34';
  c.beginPath();
  c.ellipse(x, y - h * 0.45, w / 2, h * 0.5, 0, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = '#44a04a';
  c.beginPath();
  c.ellipse(x - w * 0.1, y - h * 0.6, w * 0.3, h * 0.3, 0, 0, Math.PI * 2);
  c.fill();
};

const rock: Draw = (c, x, y, w, h) => {
  tri(c, [x - w / 2, y, x - w * 0.35, y - h * 0.7, x, y - h, x + w * 0.4, y - h * 0.6, x + w / 2, y], '#7d6a5c');
  tri(c, [x - w * 0.35, y - h * 0.7, x, y - h, x + w * 0.05, y - h * 0.4, x - w * 0.25, y - h * 0.3], '#a08b7a');
};

const cactus: Draw = (c, x, y, w, h) => {
  const t = w * 0.28;
  c.fillStyle = '#2e7d32';
  c.fillRect(x - t / 2, y - h, t, h);
  c.fillRect(x - w / 2, y - h * 0.55, w / 2, t * 0.7);
  c.fillRect(x - w / 2, y - h * 0.8, t * 0.7, h * 0.3);
  c.fillRect(x, y - h * 0.4, w / 2, t * 0.7);
  c.fillRect(x + w / 2 - t * 0.7, y - h * 0.7, t * 0.7, h * 0.32);
  c.fillStyle = '#4caf50';
  c.fillRect(x - t / 2, y - h, t * 0.35, h);
};

const pine: Draw = (c, x, y, w, h) => {
  c.fillStyle = '#5a3d22';
  c.fillRect(x - w * 0.06, y - h * 0.2, w * 0.12, h * 0.2);
  for (let i = 0; i < 3; i++) {
    const by = y - h * (0.15 + i * 0.25);
    const bw = w * (0.5 - i * 0.12);
    tri(c, [x - bw, by, x + bw, by, x, by - h * 0.4], '#1f5a3a');
    tri(c, [x - bw * 0.5, by - h * 0.22, x + bw * 0.5, by - h * 0.22, x, by - h * 0.4], '#f2f6fa');
  }
};

const lamp: Draw = (c, x, y, w, h) => {
  c.fillStyle = '#555';
  c.fillRect(x - w * 0.15, y - h, w * 0.3, h);
  c.fillStyle = 'rgba(0,240,255,0.25)';
  c.beginPath();
  c.ellipse(x, y - h, w * 1.6, w * 1.2, 0, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = '#bfffff';
  c.fillRect(x - w / 2, y - h - w * 0.2, w, w * 0.4);
};

const building: Draw = (c, x, y, w, h, seed) => {
  const hh = h * (0.6 + ((seed % 40) / 100));
  c.fillStyle = seed % 2 ? '#241a3d' : '#1b2238';
  c.fillRect(x - w / 2, y - hh, w, hh);
  if (w < 12) return;
  const cols = 4, rows = 9;
  const cw = w / (cols * 2 + 1), rh = hh / (rows * 2 + 1);
  for (let r = 0; r < rows; r++)
    for (let k = 0; k < cols; k++) {
      const lit = ((seed >> ((r * cols + k) % 20)) ^ (r * 7 + k)) & 1;
      c.fillStyle = lit ? (seed % 3 ? '#ffd86b' : '#ff7be9') : '#2c2c48';
      c.fillRect(x - w / 2 + cw * (k * 2 + 1), y - hh + rh * (r * 2 + 1), cw, rh);
    }
};

const sign = (dir: 1 | -1): Draw => (c, x, y, w, h) => {
  c.fillStyle = '#666';
  c.fillRect(x - w * 0.05, y - h * 0.5, w * 0.1, h * 0.5);
  c.fillStyle = '#ffcc00';
  c.fillRect(x - w / 2, y - h, w, h * 0.55);
  c.fillStyle = '#111';
  const cx = x, cy = y - h * 0.725, s = w * 0.28;
  tri(c, [cx - s * dir, cy - s * 0.8, cx + s * dir, cy, cx - s * dir, cy + s * 0.8, cx - s * 0.4 * dir, cy], '#111');
};

const banner: Draw = (c, x, y, w, h, seed) => {
  const pw = w * 0.025;
  c.fillStyle = '#ddd';
  c.fillRect(x - w / 2, y - h, pw, h);
  c.fillRect(x + w / 2 - pw, y - h, pw, h);
  const bh = h * 0.22;
  const n = 24, sw = (w - pw * 2) / n;
  for (let i = 0; i < n; i++)
    for (let r = 0; r < 2; r++) {
      c.fillStyle = (i + r) % 2 ? '#111' : '#fff';
      c.fillRect(x - w / 2 + pw + i * sw, y - h + (r * bh) / 2, Math.ceil(sw), Math.ceil(bh / 2));
    }
  if (bh > 8) {
    c.fillStyle = '#d22';
    c.fillRect(x - w * 0.18, y - h - bh * 0.1, w * 0.36, bh * 1.2);
    c.fillStyle = '#fff';
    c.font = `bold ${Math.floor(bh * 0.8)}px monospace`;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText(seed ? 'CHEGADA' : 'LARGADA', x, y - h + bh * 0.5);
  }
};

export const SPRITES: Record<SpriteKind, { w: number; h: number; draw: Draw; solid: boolean }> = {
  palm: { w: 1100, h: 2200, draw: palm, solid: true },
  bush: { w: 800, h: 450, draw: bush, solid: false },
  rock: { w: 1000, h: 600, draw: rock, solid: true },
  cactus: { w: 500, h: 1100, draw: cactus, solid: true },
  pine: { w: 1000, h: 2100, draw: pine, solid: true },
  lamp: { w: 250, h: 2200, draw: lamp, solid: true },
  building: { w: 2400, h: 5200, draw: building, solid: true },
  signL: { w: 650, h: 900, draw: sign(-1), solid: true },
  signR: { w: 650, h: 900, draw: sign(1), solid: true },
  banner: { w: 5400, h: 2700, draw: banner, solid: false },
};
