import { CLASS_COLOR, PERF_CLASSES, perfClass, perfIndex, type CarSpec, type PerfClass } from './cars';
import { text, type Rect } from './ui';

// Selo da classe de desempenho (letra num quadrado colorido) e, opcional, o índice ao lado
export function classBadge(c: CanvasRenderingContext2D, x: number, y: number, car: CarSpec, pi = false, size = 12) {
  const k = perfClass(car);
  c.fillStyle = '#1a1614';
  c.fillRect(x - 1, y - 1, size + 2, size + 2);
  c.fillStyle = CLASS_COLOR[k];
  c.fillRect(x, y, size, size);
  c.fillStyle = 'rgba(255,255,255,0.35)';
  c.fillRect(x, y, size, 1);
  text(c, k, x + size / 2 + 0.5, y + size / 2 - (size >= 12 ? 3.5 : 2.5), size >= 12 ? 8 : 5, '#fff', 'center', null);
  if (pi) text(c, `PI ${perfIndex(car)}`, x + size + 4, y + size / 2 - 2.5, 5, '#1a1614', 'left', null);
}

// Filtro por classe: TODOS e uma ficha para cada classe
export type ClassFilter = PerfClass | null;
const OPTIONS: ClassFilter[] = [null, ...PERF_CLASSES];

export function filterRects(x: number, y: number, w: number, h = 16): Rect[] {
  const first = 34, gap = 2;
  const cw = (w - first - gap * PERF_CLASSES.length) / PERF_CLASSES.length;
  return OPTIONS.map((_, i): Rect => (i === 0 ? { x, y, w: first, h } : { x: x + first + gap + (i - 1) * (cw + gap), y, w: cw, h }));
}

export function drawFilter(c: CanvasRenderingContext2D, rects: Rect[], cur: ClassFilter, counts: (k: PerfClass) => number) {
  rects.forEach((r, i) => {
    const k = OPTIONS[i];
    const on = cur === k;
    const empty = k !== null && counts(k) === 0;
    // fichas de papel com contorno de tinta; a escolhida ganha borda vermelha e sublinhado
    c.fillStyle = on ? '#d01f26' : '#1a1614';
    c.fillRect(r.x - 1, r.y - 1, r.w + 2, r.h + 2);
    c.fillStyle = k ? (empty ? '#e4d9c0' : CLASS_COLOR[k]) : on ? '#ffd21a' : '#f6efdd';
    c.fillRect(r.x, r.y, r.w, r.h);
    if (on) {
      c.fillStyle = '#d01f26';
      c.fillRect(r.x - 1, r.y + r.h + 1, r.w + 2, 2);
    }
    const col = k ? (empty ? '#b0a690' : '#fff') : '#1a1614';
    text(c, k ?? 'TODOS', r.x + r.w / 2 + 0.5, r.y + r.h / 2 - (k ? 3.5 : 2.5), k ? 8 : 5, col, 'center', k && !empty ? '#1a1614' : null);
  });
}

export const filterAt = (rects: Rect[], x: number, y: number): ClassFilter | undefined => {
  const i = rects.findIndex((r) => x >= r.x && x <= r.x + r.w && y >= r.y - 3 && y <= r.y + r.h + 3);
  return i < 0 ? undefined : OPTIONS[i];
};

// próximo filtro (pula classes sem carro)
export function nextFilter(cur: ClassFilter, dir: 1 | -1, has: (k: PerfClass) => boolean): ClassFilter {
  let i = OPTIONS.indexOf(cur);
  for (let n = 0; n < OPTIONS.length; n++) {
    i = (i + dir + OPTIONS.length) % OPTIONS.length;
    const k = OPTIONS[i];
    if (k === null || has(k)) return k;
  }
  return null;
}

// índices (na lista) dos carros que passam no filtro, do mais fraco ao mais forte dentro da classe
export const filtered = (list: CarSpec[], f: ClassFilter) => list.map((car, i) => ({ car, i })).filter(({ car }) => !f || perfClass(car) === f).map(({ i }) => i);

// anda para o carro anterior/seguinte dentro do filtro
export function stepCar(list: CarSpec[], f: ClassFilter, cur: number, dir: 1 | -1) {
  const ids = filtered(list, f);
  if (!ids.length) return cur;
  const at = ids.indexOf(cur);
  if (at < 0) return ids[0];
  return ids[(at + dir + ids.length) % ids.length];
}
