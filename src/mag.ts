// Kit visual "revista de carros dos anos 90": papel com retícula, cabeçalho vermelho com o
// logotipo, manchetes, foto de estúdio emoldurada, ficha técnica, selos estourados, estrelas,
// botões como etiquetas e o código de barras da capa. Usado por todas as telas de menu.
import { SAFE_W, view } from './config';
import { fixGlyphs, inside, text, type Rect } from './ui';

export const INK = '#1a1614';
export const PAPER = '#efe6d2';
export const PAPER2 = '#e4d9c0';
export const RED = '#d01f26';
export const YELLOW = '#ffd21a';
export const BLUE = '#1e4fb8';
export const GREY = '#7a7266';

export const mx = () => Math.floor((view.w - SAFE_W) / 2);

// papel envelhecido com retícula de pontos (como impressão em offset)
const paperCache = new Map<string, CanvasPattern>();
function paperPattern(c: CanvasRenderingContext2D, base: string, dot: string) {
  const key = base + dot;
  let p = paperCache.get(key);
  if (!p) {
    const t = document.createElement('canvas');
    t.width = t.height = 8;
    const x = t.getContext('2d')!;
    x.fillStyle = base;
    x.fillRect(0, 0, 8, 8);
    x.fillStyle = dot;
    x.fillRect(1, 1, 1, 1);
    x.fillRect(5, 5, 1, 1);
    p = c.createPattern(t, 'repeat')!;
    paperCache.set(key, p);
  }
  return p;
}

export function paper(c: CanvasRenderingContext2D, base = PAPER) {
  c.fillStyle = paperPattern(c, base, 'rgba(120,96,60,0.16)');
  c.fillRect(0, 0, view.w, view.h);
}

// faixa de retícula (área de destaque, fundo de quadro)
export function halftone(c: CanvasRenderingContext2D, r: Rect, color: string, base = 'rgba(0,0,0,0)') {
  c.save();
  c.beginPath();
  c.rect(r.x, r.y, r.w, r.h);
  c.clip();
  c.fillStyle = base;
  c.fillRect(r.x, r.y, r.w, r.h);
  c.fillStyle = color;
  for (let y = r.y; y < r.y + r.h; y += 3) for (let x = r.x + ((y / 3) % 2) * 1.5; x < r.x + r.w; x += 3) c.fillRect(Math.round(x), y, 1, 1);
  c.restore();
}

// logotipo da revista: letras grossas com contorno preto e sombra
export function logo(c: CanvasRenderingContext2D, s: string, x: number, y: number, size: number, fill = YELLOW, out = INK, align: CanvasTextAlign = 'left') {
  for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, 1], [-1, 1], [1, -1], [2, 2], [3, 3]]) text(c, s, x + dx, y + dy, size, out, align, null);
  text(c, s, x, y, size, fill, align, null);
}

// cabeçalho da página: faixa vermelha com o nome da revista, a seção e o número da página
export function masthead(c: CanvasRenderingContext2D, section: string, page?: string) {
  const { w } = view;
  c.fillStyle = RED;
  c.fillRect(0, 0, w, 15);
  c.fillStyle = INK;
  c.fillRect(0, 15, w, 2);
  const x = mx();
  text(c, 'DUEL RACER', x + 4, 4, 8, YELLOW, 'left', INK);
  text(c, section, x + SAFE_W - 4, 5, 5, '#fff', 'right', null);
  if (page) text(c, page, w / 2, 230, 5, GREY, 'center', null);
}

// chapéu (rótulo da seção, branco no preto) e manchete
export function kicker(c: CanvasRenderingContext2D, s: string, x: number, y: number, bg = INK, fg = YELLOW) {
  c.font = '5px "Press Start 2P", monospace';
  const tw = Math.ceil(c.measureText(fixGlyphs(s)).width);
  c.fillStyle = bg;
  c.fillRect(x, y, tw + 6, 9);
  text(c, s, x + 3, y + 2, 5, fg, 'left', null);
  return tw + 6;
}
export function headline(c: CanvasRenderingContext2D, s: string, x: number, y: number, size = 16, color = INK, align: CanvasTextAlign = 'left') {
  text(c, s, x, y, size, color, align, null);
}
export const ink = (c: CanvasRenderingContext2D, s: string, x: number, y: number, size = 5, color = INK, align: CanvasTextAlign = 'left') => text(c, s, x, y, size, color, align, null);

// foto de estúdio: moldura branca, sombra e fundo infinito (degradê de cinza com o chão)
export function photo(c: CanvasRenderingContext2D, r: Rect, draw: () => void, backdrop: [string, string] = ['#5e6670', '#c8cdd2']) {
  c.fillStyle = 'rgba(40,30,20,0.35)';
  c.fillRect(r.x + 3, r.y + 3, r.w, r.h);
  c.fillStyle = '#fbf8f0';
  c.fillRect(r.x - 3, r.y - 3, r.w + 6, r.h + 6);
  const g = c.createLinearGradient(0, r.y, 0, r.y + r.h);
  g.addColorStop(0, backdrop[0]);
  g.addColorStop(0.62, backdrop[1]);
  g.addColorStop(0.63, shadeHex(backdrop[1], -18));
  g.addColorStop(1, shadeHex(backdrop[1], 8));
  c.fillStyle = g;
  c.fillRect(r.x, r.y, r.w, r.h);
  c.save();
  c.beginPath();
  c.rect(r.x, r.y, r.w, r.h);
  c.clip();
  draw();
  c.restore();
}
function shadeHex(hex: string, d: number) {
  const n = parseInt(hex.slice(1), 16);
  const f = (v: number) => Math.max(0, Math.min(255, v + d));
  return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
}

// quadro com título em faixa (ficha técnica, box de dados)
export function box(c: CanvasRenderingContext2D, r: Rect, title: string, color = INK) {
  c.fillStyle = '#f8f2e4';
  c.fillRect(r.x, r.y, r.w, r.h);
  c.strokeStyle = color;
  c.lineWidth = 1;
  c.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1);
  c.fillStyle = color;
  c.fillRect(r.x, r.y, r.w, 10);
  text(c, title, r.x + 3, r.y + 3, 5, color === INK ? YELLOW : '#fff', 'left', null);
}

// linhas "rótulo ........ valor" da ficha técnica
export function specRows(c: CanvasRenderingContext2D, r: Rect, rows: [string, string][], step = 9, y0 = 13) {
  rows.forEach(([k, v], i) => {
    const y = r.y + y0 + i * step;
    ink(c, k, r.x + 3, y, 5, GREY);
    c.font = '5px "Press Start 2P", monospace';
    const kw = c.measureText(fixGlyphs(k)).width, vw = c.measureText(fixGlyphs(v)).width;
    c.fillStyle = 'rgba(26,22,20,0.35)';
    for (let x = r.x + 5 + kw; x < r.x + r.w - 5 - vw; x += 3) c.fillRect(Math.round(x), y + 4, 1, 1);
    ink(c, v, r.x + r.w - 3, y, 5, INK, 'right');
  });
}

// selo estourado (NOVO!, EXCLUSIVO, TESTE)
export function burst(c: CanvasRenderingContext2D, cx: number, cy: number, rad: number, lines: string[], fill = YELLOW, ink2 = RED, t = 0) {
  const n = 14;
  const k = 1 + Math.sin(t * 6) * 0.04;
  c.fillStyle = INK;
  starPath(c, cx + 2, cy + 2, rad * k, n);
  c.fill();
  c.fillStyle = fill;
  starPath(c, cx, cy, rad * k, n);
  c.fill();
  lines.forEach((l, i) => text(c, l, cx, cy - lines.length * 4 + i * 9 + 1, 5, ink2, 'center', null));
}
function starPath(c: CanvasRenderingContext2D, cx: number, cy: number, r: number, n: number) {
  c.beginPath();
  for (let i = 0; i < n * 2; i++) {
    const a = (i / (n * 2)) * Math.PI * 2 - Math.PI / 2;
    const rr = i % 2 ? r * 0.74 : r;
    c.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
  }
  c.closePath();
}

// estrelas de avaliação (0..5)
export function stars(c: CanvasRenderingContext2D, x: number, y: number, n: number, size = 5) {
  for (let i = 0; i < 5; i++) {
    const on = i < n;
    c.fillStyle = on ? RED : 'rgba(26,22,20,0.2)';
    const cx = x + i * (size + 2) + size / 2, cy = y + size / 2;
    c.beginPath();
    for (let k = 0; k < 10; k++) {
      const a = (k / 10) * Math.PI * 2 - Math.PI / 2, rr = k % 2 ? size * 0.22 : size * 0.55;
      c.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
    }
    c.fill();
  }
}

// botão: etiqueta preta (aceso = vermelho com borda amarela)
export function tag(c: CanvasRenderingContext2D, r: Rect, label: string, hot = false, size = 5) {
  c.fillStyle = 'rgba(40,30,20,0.35)';
  c.fillRect(r.x + 2, r.y + 2, r.w, r.h);
  c.fillStyle = hot ? RED : INK;
  c.fillRect(r.x, r.y, r.w, r.h);
  if (hot) {
    c.fillStyle = YELLOW;
    c.fillRect(r.x, r.y + r.h - 2, r.w, 2);
  }
  text(c, label, r.x + r.w / 2, r.y + Math.round((r.h - size) / 2), size, hot ? YELLOW : '#fff', 'center', null);
}
export const hit = inside;

// seta de folhear (sobre fotos): fundo de tinta translúcido e um triângulo nítido
export function arrow(c: CanvasRenderingContext2D, r: Rect, dir: 'left' | 'right' | 'up' | 'down', solid = false) {
  c.fillStyle = solid ? INK : 'rgba(26,22,20,0.55)';
  c.fillRect(r.x, r.y, r.w, r.h);
  const cx = r.x + r.w / 2, cy = r.y + r.h / 2, k = Math.max(2, Math.min(r.w, r.h) * 0.28);
  c.fillStyle = '#fff';
  c.beginPath();
  if (dir === 'left') { c.moveTo(cx - k * 0.7, cy); c.lineTo(cx + k * 0.6, cy - k); c.lineTo(cx + k * 0.6, cy + k); }
  else if (dir === 'right') { c.moveTo(cx + k * 0.7, cy); c.lineTo(cx - k * 0.6, cy - k); c.lineTo(cx - k * 0.6, cy + k); }
  else if (dir === 'up') { c.moveTo(cx, cy - k * 0.7); c.lineTo(cx - k, cy + k * 0.6); c.lineTo(cx + k, cy + k * 0.6); }
  else { c.moveTo(cx, cy + k * 0.7); c.lineTo(cx - k, cy - k * 0.6); c.lineTo(cx + k, cy - k * 0.6); }
  c.closePath();
  c.fill();
}

// código de barras e preço da capa
export function barcode(c: CanvasRenderingContext2D, x: number, y: number) {
  c.fillStyle = '#fff';
  c.fillRect(x - 2, y - 2, 34, 22);
  c.fillStyle = INK;
  let s = 7;
  for (let i = 0; i < 28; i++) {
    s = (s * 73 + 11) % 97;
    if (s % 3) c.fillRect(x + i, y, s % 5 === 0 ? 2 : 1, 13);
  }
  text(c, '7 891234', x + 15, y + 14, 5, INK, 'center', null);
}

// linha fina de separação (fio)
export function rule(c: CanvasRenderingContext2D, x: number, y: number, w: number, color = INK) {
  c.fillStyle = color;
  c.fillRect(x, y, w, 1);
}
