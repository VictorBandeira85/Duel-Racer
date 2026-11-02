// Ilustrações da tela de carregamento (pixel art desenhada por código, como fotos da revista):
// motor na oficina, bancada de peças e o posto da estrada.
import { SPRITES } from './sprites';
import { drawCarSide, type CarSpec } from './cars';
import { paintHex } from './paint';
import { dither, type Rect } from './ui';

const px = (c: CanvasRenderingContext2D, col: string, x: number, y: number, w: number, h: number) => {
  c.fillStyle = col;
  c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
};
function disc(c: CanvasRenderingContext2D, cx: number, cy: number, r: number, col: string, ry = r) {
  c.fillStyle = col;
  c.beginPath();
  c.ellipse(cx, cy, r, ry, 0, 0, Math.PI * 2);
  c.fill();
}
function ring(c: CanvasRenderingContext2D, cx: number, cy: number, r: number, col: string, w = 1, ry = r) {
  c.strokeStyle = col;
  c.lineWidth = w;
  c.beginPath();
  c.ellipse(cx, cy, r, ry, 0, 0, Math.PI * 2);
  c.stroke();
}

// parede da oficina com azulejo e piso, comum às fotos de oficina
function garage(c: CanvasRenderingContext2D, r: Rect) {
  px(c, '#4a4e56', r.x, r.y, r.w, r.h);
  c.fillStyle = dither(c, '#545862', '#4c5058');
  c.fillRect(r.x, r.y, r.w, r.h * 0.62);
  c.fillStyle = 'rgba(0,0,0,0.18)';
  for (let x = r.x; x < r.x + r.w; x += 16) c.fillRect(x, r.y, 1, r.h * 0.62);
  for (let y = r.y + 12; y < r.y + r.h * 0.62; y += 12) c.fillRect(r.x, y, r.w, 1);
  px(c, '#2a2c32', r.x, r.y + r.h * 0.62, r.w, r.h * 0.38);
  c.fillStyle = dither(c, '#30323a', '#2a2c32');
  c.fillRect(r.x, r.y + r.h * 0.62 + 2, r.w, r.h * 0.38);
  px(c, '#e8c020', r.x, r.y + r.h * 0.62, r.w, 2); // faixa amarela do piso
}

// V8 de frente, sobre o cavalete: bloco, cabeçotes vermelhos, coletor, filtro de ar cromado,
// polias e correia na frente, coletores de escape saindo dos lados
export function drawEngine(c: CanvasRenderingContext2D, r: Rect, t: number) {
  garage(c, r);
  const cx = r.x + r.w / 2, base = r.y + r.h - 10;
  // cavalete
  px(c, '#c8c020', cx - 50, base - 6, 100, 4);
  px(c, '#8a8418', cx - 46, base - 2, 6, 10);
  px(c, '#8a8418', cx + 40, base - 2, 6, 10);
  // cárter e bloco
  px(c, '#2a2a2e', cx - 30, base - 22, 60, 16);
  px(c, '#4a4c52', cx - 34, base - 52, 68, 32);
  px(c, '#5c5e66', cx - 34, base - 52, 68, 3);
  px(c, '#36383e', cx - 34, base - 24, 68, 3);
  // cabeçotes inclinados (V) com tampas de válvula vermelhas
  for (const s of [-1, 1]) {
    c.save();
    c.translate(cx + s * 30, base - 60);
    c.rotate(s * 0.5);
    px(c, '#3e4046', -14, -8, 28, 18);
    px(c, '#b8141a', -15, -14, 30, 9);
    px(c, '#e83a3a', -15, -14, 30, 2);
    for (let k = 0; k < 4; k++) px(c, '#d8d8dc', -11 + k * 7, -11, 2, 2); // parafusos
    c.restore();
    // escape: tubos descendo para fora
    c.strokeStyle = '#a06030';
    c.lineWidth = 3;
    c.beginPath();
    c.moveTo(cx + s * 40, base - 48);
    c.quadraticCurveTo(cx + s * 62, base - 40, cx + s * 58, base - 12);
    c.stroke();
    c.strokeStyle = '#c88850';
    c.lineWidth = 1;
    c.stroke();
  }
  // coletor de admissão e filtro de ar
  px(c, '#9aa0a8', cx - 16, base - 72, 32, 14);
  px(c, '#c8ccd2', cx - 16, base - 72, 32, 2);
  disc(c, cx, base - 78, 24, '#c8ccd4', 6);
  disc(c, cx, base - 80, 24, '#eef0f4', 6);
  disc(c, cx, base - 80, 9, '#2a2a2e', 2.5);
  px(c, '#b8141a', cx - 12, base - 78, 24, 1);
  // frente: polias e correia
  disc(c, cx, base - 30, 9, '#1c1c20');
  disc(c, cx, base - 30, 6, '#8a8e96');
  disc(c, cx - 18, base - 46, 5, '#1c1c20');
  disc(c, cx - 18, base - 46, 3, '#8a8e96');
  disc(c, cx + 18, base - 46, 5, '#1c1c20');
  disc(c, cx + 18, base - 46, 3, '#8a8e96');
  // ventoinha girando
  const a = t * 14;
  c.fillStyle = 'rgba(30,30,34,0.85)';
  for (let k = 0; k < 4; k++) {
    const aa = a + (k * Math.PI) / 2;
    c.beginPath();
    c.moveTo(cx, base - 30);
    c.lineTo(cx + Math.cos(aa) * 12, base - 30 + Math.sin(aa) * 12);
    c.lineTo(cx + Math.cos(aa + 0.5) * 12, base - 30 + Math.sin(aa + 0.5) * 12);
    c.fill();
  }
  disc(c, cx, base - 30, 2, '#d8d8dc');
  // brilho de oficina
  const g = c.createRadialGradient(cx, r.y + 10, 4, cx, r.y + 10, r.w * 0.6);
  g.addColorStop(0, 'rgba(255,240,200,0.22)');
  g.addColorStop(1, 'rgba(255,240,200,0)');
  c.fillStyle = g;
  c.fillRect(r.x, r.y, r.w, r.h);
}

// bancada com peças: roda, turbina, pistão com biela, vela e disco de freio com pinça
export function drawParts(c: CanvasRenderingContext2D, r: Rect, t: number) {
  // painel perfurado (pegboard) e bancada de madeira
  px(c, '#b89a6a', r.x, r.y, r.w, r.h);
  c.fillStyle = '#8a7048';
  for (let y = r.y + 4; y < r.y + r.h - 30; y += 7) for (let x = r.x + 4; x < r.x + r.w; x += 7) c.fillRect(x, y, 1, 1);
  px(c, '#6a4a2a', r.x, r.y + r.h - 28, r.w, 28);
  px(c, '#8a6238', r.x, r.y + r.h - 28, r.w, 3);
  const floor = r.y + r.h - 24;
  const n = 5, step = r.w / n;
  // 1) roda com pneu
  {
    const x = r.x + step * 0.5, y = floor - 24;
    disc(c, x, y, 22, '#1a1a1c');
    ring(c, x, y, 20, '#2c2c30', 2);
    disc(c, x, y, 13, '#c8ccd2');
    disc(c, x, y, 11, '#9aa0a8');
    for (let k = 0; k < 5; k++) {
      const a = (k * Math.PI * 2) / 5 + t * 0.6;
      c.strokeStyle = '#e4e6ea';
      c.lineWidth = 3;
      c.beginPath();
      c.moveTo(x, y);
      c.lineTo(x + Math.cos(a) * 11, y + Math.sin(a) * 11);
      c.stroke();
    }
    disc(c, x, y, 3, '#5a5e66');
  }
  // 2) turbina (caracol) com a saída
  {
    const x = r.x + step * 1.5, y = floor - 20;
    disc(c, x, y, 15, '#7a7e86');
    disc(c, x, y, 15, '#9aa0a8', 13);
    disc(c, x, y, 7, '#3a3c42');
    ring(c, x, y, 5, '#c8ccd2');
    px(c, '#9aa0a8', x + 8, y - 22, 9, 12);
    px(c, '#c8ccd2', x + 8, y - 22, 9, 2);
    disc(c, x - 2, y + 2, 14, 'rgba(255,255,255,0.08)');
    px(c, '#c86020', x - 18, y + 8, 10, 6); // flange
  }
  // 3) pistão com biela
  {
    const x = r.x + step * 2.5, y = floor - 44;
    px(c, '#c8ccd2', x - 10, y, 20, 18);
    px(c, '#eef0f4', x - 10, y, 20, 3);
    for (let k = 0; k < 3; k++) px(c, '#6a6e76', x - 10, y + 5 + k * 3, 20, 1);
    disc(c, x, y + 12, 3, '#6a6e76');
    px(c, '#8a8e96', x - 3, y + 14, 6, 22);
    disc(c, x, y + 38, 7, '#8a8e96');
    disc(c, x, y + 38, 4, '#4a4c52');
  }
  // 4) vela de ignição
  {
    const x = r.x + step * 3.5, y = floor - 40;
    px(c, '#f0ece0', x - 3, y, 6, 18);
    for (let k = 0; k < 4; k++) px(c, '#d8d2c0', x - 3, y + 3 + k * 4, 6, 1);
    px(c, '#9aa0a8', x - 5, y + 18, 10, 6);
    px(c, '#c8ccd2', x - 2, y + 24, 4, 10);
    px(c, '#6a6e76', x - 1, y - 4, 2, 4);
    px(c, '#6a6e76', x + 1, y + 34, 2, 2);
  }
  // 5) disco de freio ventilado com pinça vermelha
  {
    const x = r.x + step * 4.5, y = floor - 24;
    disc(c, x, y, 20, '#8a8e96');
    disc(c, x, y, 19, '#a8acb4');
    for (let k = 0; k < 12; k++) {
      const a = (k * Math.PI) / 6;
      disc(c, x + Math.cos(a) * 13, y + Math.sin(a) * 13, 1.2, '#4a4c52');
    }
    disc(c, x, y, 8, '#6a6e76');
    disc(c, x, y, 3, '#2a2a2e');
    c.fillStyle = '#c81818';
    c.fillRect(x + 10, y - 16, 10, 20);
    px(c, '#ff4a3a', x + 10, y - 16, 10, 2);
    px(c, '#fff', x + 12, y - 10, 6, 1);
  }
  // luz de oficina
  const g = c.createLinearGradient(0, r.y, 0, r.y + r.h);
  g.addColorStop(0, 'rgba(255,255,255,0.12)');
  g.addColorStop(1, 'rgba(0,0,0,0.15)');
  c.fillStyle = g;
  c.fillRect(r.x, r.y, r.w, r.h);
}

// posto da estrada ao entardecer: cobertura e loja (o mesmo desenho da pista), placa e o
// carro do jogador parado na bomba
export function drawStation(c: CanvasRenderingContext2D, r: Rect, car: CarSpec | undefined, t: number) {
  const hz = r.y + r.h * 0.5;
  const g = c.createLinearGradient(0, r.y, 0, hz);
  g.addColorStop(0, '#2a3a8a');
  g.addColorStop(0.6, '#e87a3a');
  g.addColorStop(1, '#ffd08a');
  c.fillStyle = g;
  c.fillRect(r.x, r.y, r.w, hz - r.y);
  px(c, '#4a6a3a', r.x, hz, r.w, r.h / 2);
  px(c, '#8a8a92', r.x, r.y + r.h - 34, r.w, 20);
  px(c, '#3a3a40', r.x, r.y + r.h - 14, r.w, 14);
  c.fillStyle = '#f2c81e';
  for (let x = r.x + ((t * 40) % 24) - 24; x < r.x + r.w; x += 24) c.fillRect(Math.round(x), r.y + r.h - 8, 12, 2);
  const st = SPRITES.station, sg = SPRITES.gasSign;
  const sw = r.w * 0.66, sh = (sw * st.h) / st.w;
  st.draw(c, r.x + r.w * 0.62, r.y + r.h - 16, sw, sh, 0);
  const gw = 20, gh = (gw * sg.h) / sg.w;
  sg.draw(c, r.x + 22, r.y + r.h - 16, gw, gh, 0);
  if (car) drawCarSide(c, r.x + r.w * 0.5, r.y + r.h - 18, 92, car, paintHex(car.id));
}
