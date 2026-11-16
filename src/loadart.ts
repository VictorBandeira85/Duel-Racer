// Ilustrações da tela de carregamento (como fotos da revista): motor V8 na oficina e bancada de peças
// (arte do Victor, src/assets/loadart) e o posto da estrada (desenhado por código).
import { SPRITES } from './sprites';
import { drawCarSide, type CarSpec } from './cars';
import { paintHex } from './paint';
import { dither, type Rect } from './ui';

const px = (c: CanvasRenderingContext2D, col: string, x: number, y: number, w: number, h: number) => {
  c.fillStyle = col;
  c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
};

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

// arte do Victor recortada (tools/ref/loadart_art.py): o V8 2.9 biturbo e as peças de preparação
const ART = import.meta.glob('./assets/loadart/*.png', { eager: true, import: 'default' }) as Record<string, string>;
const imgs = new Map<string, HTMLImageElement>();
function art(name: string): HTMLImageElement | null {
  let im = imgs.get(name);
  if (!im) {
    im = new Image();
    im.src = ART[`./assets/loadart/${name}.png`];
    imgs.set(name, im);
  }
  return im.complete && im.naturalWidth ? im : null;
}
// peça apoiada pelo pé (x = meio, y = chão) com a sombra no chão
function put(c: CanvasRenderingContext2D, name: string, x: number, y: number, shadow = true) {
  const im = art(name);
  if (!im) return;
  if (shadow) {
    c.fillStyle = 'rgba(0,0,0,0.28)';
    c.beginPath();
    c.ellipse(Math.round(x), Math.round(y), im.width * 0.46, 2.5, 0, 0, Math.PI * 2);
    c.fill();
  }
  c.drawImage(im, Math.round(x - im.width / 2), Math.round(y - im.height));
}
// pendurada no painel perfurado por dois ganchos
function hang(c: CanvasRenderingContext2D, name: string, x: number, y: number) {
  const im = art(name);
  if (!im) return;
  const x0 = Math.round(x - im.width / 2), y0 = Math.round(y);
  for (const hx of [x0 + im.width * 0.28, x0 + im.width * 0.72]) {
    px(c, '#3a3c42', hx - 1, y0 - 5, 2, 7);
    px(c, '#8a8e96', hx - 1, y0 - 6, 2, 1);
  }
  c.drawImage(im, x0, y0);
}

// V8 biturbo (arte do Victor) sobre o cavalete da oficina, com a luz passando devagar
export function drawEngine(c: CanvasRenderingContext2D, r: Rect, t: number) {
  garage(c, r);
  const sm = c.imageSmoothingEnabled;
  c.imageSmoothingEnabled = false;
  const cx = r.x + r.w * 0.62, base = r.y + r.h - 8;
  // cavalete
  px(c, '#c8c020', cx - 56, base - 6, 112, 4);
  px(c, '#8a8418', cx - 50, base - 2, 6, 10);
  px(c, '#8a8418', cx + 44, base - 2, 6, 10);
  put(c, 'v8', cx, base - 3, false);
  c.imageSmoothingEnabled = sm;
  // brilho de oficina passando pelo motor
  const lx = r.x + r.w * (0.3 + 0.5 * (0.5 + 0.5 * Math.sin(t * 0.6)));
  const g = c.createRadialGradient(lx, r.y + 10, 4, lx, r.y + 10, r.w * 0.6);
  g.addColorStop(0, 'rgba(255,240,200,0.2)');
  g.addColorStop(1, 'rgba(255,240,200,0)');
  c.fillStyle = g;
  c.fillRect(r.x, r.y, r.w, r.h);
}

// bancada da oficina com as peças de preparação (arte do Victor): escapamento e comando pendurados no
// painel perfurado; molas e amortecedores, pistão, turbina e freio em cima da bancada
export function drawParts(c: CanvasRenderingContext2D, r: Rect, _t: number) {
  // painel perfurado (pegboard) e bancada de madeira
  px(c, '#b89a6a', r.x, r.y, r.w, r.h);
  c.fillStyle = '#8a7048';
  for (let y = r.y + 4; y < r.y + r.h - 30; y += 7) for (let x = r.x + 4; x < r.x + r.w; x += 7) c.fillRect(x, y, 1, 1);
  px(c, '#6a4a2a', r.x, r.y + r.h - 28, r.w, 28);
  px(c, '#8a6238', r.x, r.y + r.h - 28, r.w, 3);
  const floor = r.y + r.h - 22;
  const sm = c.imageSmoothingEnabled;
  c.imageSmoothingEnabled = false;
  hang(c, 'escape', r.x + r.w * 0.56, r.y + 12);
  hang(c, 'comando', r.x + r.w * 0.84, r.y + 16);
  put(c, 'suspensao', r.x + r.w * 0.15, floor);
  put(c, 'pistao', r.x + r.w * 0.36, floor);
  put(c, 'turbo', r.x + r.w * 0.56, floor);
  put(c, 'freio', r.x + r.w * 0.8, floor);
  c.imageSmoothingEnabled = sm;
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
