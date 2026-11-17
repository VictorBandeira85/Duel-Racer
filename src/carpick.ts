// Seletor de carro da oficina do Arcade e do catálogo de preparação: página de revista com as fichas de
// classe (TODOS, D, C, B, A, S) e uma grade rolável de carros (lateral, nome, classe/PI e o selo
// PREPARADO). Só as miniaturas da parte visível são desenhadas (o sprite de cada uma é pedido na hora,
// como nas outras grades). Teclado/controle: setas andam na grade (rolando), A/Enter escolhe,
// LB/RB trocam a classe, B/Esc fecha (keyCareerScreen).
import { SAFE_W } from './config';
import { drawCarSide, perfClass, perfIndex, type CarSpec } from './cars';
import { classBadge, drawFilter, filterAt, filterRects, nextFilter, type ClassFilter } from './classui';
import { brandOf, drawLogo } from './brands';
import { paintHex } from './paint';
import { GREY, INK, RED, YELLOW, arrow, ink, kicker, photo, tag } from './mag';
import { inside, text, type Focusable, type FocusSet, type Rect } from './ui';
import { lastDevice } from './input';
import { ox } from './screens';

// o que muda entre a oficina do Arcade e o catálogo
export interface PickCtx {
  all: CarSpec[]; // carros que podem ser escolhidos
  shown: (car: CarSpec) => CarSpec; // o carro como aparece (no Arcade, com as peças)
  prepped: (id: string) => boolean;
  cur: string; // id do carro em vista
  set: (id: string) => void; // troca o carro da oficina
}

export const pick = { open: false, f: null as ClassFilter, sel: 0, top: 0 };

const COLS = 3, ROWS = 3, TOP = 52, CH = 48, GAP = 5;

// carros do filtro, do mais fraco ao mais forte (índice de desempenho como aparece)
export function pickList(ctx: PickCtx, f: ClassFilter = pick.f) {
  return ctx.all
    .map((car) => ({ car, v: ctx.shown(car) }))
    .filter((q) => !f || perfClass(q.v) === f)
    .sort((a, b) => perfIndex(a.v) - perfIndex(b.v))
    .map((q) => q.car);
}
// lista do filtro atual; se o filtro ficou vazio (o carro subiu de classe com as peças), todos
const listNow = (ctx: PickCtx) => {
  const l = pickList(ctx);
  return l.length ? l : pickList(ctx, null);
};

// anterior/próximo dentro do filtro (as setas ◀ ▶ da oficina, Q/E e LB/RB)
export function pickStep(ctx: PickCtx, d: number) {
  const l = listNow(ctx), i = l.findIndex((k) => k.id === ctx.cur);
  ctx.set((i < 0 ? l[0] : l[(i + d + l.length) % l.length]).id);
}
// posição do carro em vista na lista do filtro (para o "3/12" da foto)
export function pickPos(ctx: PickCtx) {
  const l = listNow(ctx);
  return { i: l.findIndex((k) => k.id === ctx.cur), n: l.length };
}

const rowsOf = (n: number) => Math.ceil(n / COLS);
function reveal(n: number) {
  const r = Math.floor(pick.sel / COLS);
  if (r < pick.top) pick.top = r;
  if (r >= pick.top + ROWS) pick.top = r - ROWS + 1;
  pick.top = Math.max(0, Math.min(Math.max(0, rowsOf(n) - ROWS), pick.top));
}
function scroll(n: number, d: number) {
  pick.top = Math.max(0, Math.min(Math.max(0, rowsOf(n) - ROWS), pick.top + d));
}

export function openPick(ctx: PickCtx) {
  // o filtro que não tem o carro em vista volta para TODOS (o carro aparece marcado)
  if (!pickList(ctx).some((k) => k.id === ctx.cur)) pick.f = null;
  const l = pickList(ctx);
  pick.sel = Math.max(0, l.findIndex((k) => k.id === ctx.cur));
  pick.top = 0;
  reveal(l.length);
  pick.open = true;
}
export const closePick = () => { pick.open = false; };
function setFilter(ctx: PickCtx, f: ClassFilter) {
  pick.f = f;
  const l = pickList(ctx);
  pick.sel = Math.max(0, l.findIndex((k) => k.id === ctx.cur));
  pick.top = 0;
  reveal(l.length);
}
function choose(ctx: PickCtx, car: CarSpec) {
  ctx.set(car.id);
  pick.open = false;
}

const layout = () => {
  const x = ox();
  const gw = SAFE_W - 8 - 20, cw = (gw - (COLS - 1) * GAP) / COLS;
  const sx = x + SAFE_W - 4 - 16;
  return {
    chips: filterRects(x + 4, 35, SAFE_W - 8, 13),
    cell: (slot: number): Rect => ({ x: x + 4 + (slot % COLS) * (cw + GAP), y: TOP + Math.floor(slot / COLS) * (CH + GAP), w: cw, h: CH }),
    up: { x: sx, y: TOP, w: 16, h: 24 } as Rect,
    track: { x: sx, y: TOP + 27, w: 16, h: ROWS * CH + (ROWS - 1) * GAP - 54 } as Rect,
    down: { x: sx, y: TOP + ROWS * CH + (ROWS - 1) * GAP - 24, w: 16, h: 24 } as Rect,
    back: { x: x + 4, y: 211, w: 96, h: 15 } as Rect,
  };
};

// potência como aparece (no Arcade, a das peças: a mesma conta da ficha do CORRER)
const cvOf = (car: CarSpec, v: CarSpec) => Math.round((parseInt(car.power) * v.accel) / car.accel);

function cell(c: CanvasRenderingContext2D, ctx: PickCtx, r: Rect, car: CarSpec, hot: boolean) {
  const v = ctx.shown(car), cur = car.id === ctx.cur;
  c.fillStyle = hot ? RED : INK;
  c.fillRect(r.x - 1, r.y - 1, r.w + 2, r.h + 2);
  if (hot) c.fillRect(r.x - 2, r.y - 2, r.w + 4, r.h + 4);
  c.fillStyle = cur ? '#fff1c8' : '#f8f2e2';
  c.fillRect(r.x, r.y, r.w, r.h);
  const ph: Rect = { x: r.x + 4, y: r.y + 4, w: r.w - 8, h: 24 };
  photo(c, ph, () => drawCarSide(c, ph.x + 3, ph.y + 22, ph.w - 6, v, paintHex(car.id)), ['#5e6670', '#c8cdd2']);
  drawLogo(c, brandOf(car.id), ph.x + ph.w - 11, ph.y + 1, 1);
  if (cur) kicker(c, 'EM VISTA', ph.x, ph.y, INK, YELLOW);
  // nome: grande se couber, senão menor
  const name = car.name.toUpperCase(), room = r.w - 8;
  ink(c, name, r.x + 4, r.y + 32, name.length * 5 <= room ? 5 : 4, cur ? RED : INK);
  classBadge(c, r.x + 4, r.y + 39, v, false, 7);
  ink(c, `PI ${perfIndex(v)}`, r.x + 14, r.y + 40, 4, INK);
  if (ctx.prepped(car.id)) {
    c.fillStyle = RED;
    c.fillRect(r.x + r.w - 43, r.y + 38, 41, 8);
    text(c, 'PREPARADO', r.x + r.w - 22.5, r.y + 40, 4, YELLOW, 'center', null);
  } else ink(c, `${cvOf(car, v)} cv`, r.x + r.w - 4, r.y + 40, 4, GREY, 'right');
}

export function drawPick(c: CanvasRenderingContext2D, ctx: PickCtx) {
  const x = ox(), L = layout();
  const list = pickList(ctx), n = list.length;
  pick.sel = Math.min(pick.sel, Math.max(0, n - 1));
  scroll(n, 0); // só limita a rolagem (as setas ▲ ▼ podem deixar o carro marcado fora da vista)
  const kw = kicker(c, 'TROCAR CARRO', x + 4, 20, RED, '#fff');
  ink(c, `${n} carro${n === 1 ? '' : 's'}${pick.f ? ` na classe ${pick.f}` : ''}`, x + 10 + kw, 22, 5, GREY);
  drawFilter(c, L.chips, pick.f, (k) => pickList(ctx, k).length);
  const keys = lastDevice.kind !== 'touch';
  for (let slot = 0; slot < COLS * ROWS; slot++) {
    const li = pick.top * COLS + slot;
    if (li >= n) break;
    cell(c, ctx, L.cell(slot), list[li], keys && li === pick.sel);
  }
  // rolagem: setas e a barra com a parte visível
  const rows = rowsOf(n), more = rows > ROWS;
  arrow(c, L.up, 'up', more && pick.top > 0);
  arrow(c, L.down, 'down', more && pick.top < rows - ROWS);
  c.fillStyle = 'rgba(26,22,20,0.18)';
  c.fillRect(L.track.x + 5, L.track.y, 6, L.track.h);
  if (more) {
    const th = Math.max(10, (L.track.h * ROWS) / rows), ty = L.track.y + ((L.track.h - th) * pick.top) / (rows - ROWS);
    c.fillStyle = INK;
    c.fillRect(L.track.x + 4, Math.round(ty), 8, Math.round(th));
  }
  tag(c, L.back, '◀ VOLTAR');
  const a = pick.top * COLS + 1, b = Math.min(n, (pick.top + ROWS) * COLS);
  ink(c, n ? `${a}-${b} de ${n}` : 'Nenhum carro', x + 160, 216, 5, INK, 'center');
  if (!keys) {
    ink(c, 'Toque no carro', x + SAFE_W - 4, 213, 4, GREY, 'right');
    ink(c, 'para preparar', x + SAFE_W - 4, 220, 4, GREY, 'right');
  }
}

export function tapPick(ctx: PickCtx, x: number, y: number) {
  const L = layout(), list = pickList(ctx), n = list.length;
  if (inside(x, y, L.back)) return closePick();
  const f = filterAt(L.chips, x, y);
  if (f !== undefined) return void ((f === null || pickList(ctx, f).length) && setFilter(ctx, f));
  if (inside(x, y, L.up)) return scroll(n, -1);
  if (inside(x, y, L.down)) return scroll(n, 1);
  if (inside(x, y, L.track)) {
    // toque na barra: vai para aquela altura da lista
    const rows = rowsOf(n);
    pick.top = Math.max(0, Math.min(rows - ROWS, Math.round(((y - L.track.y) / L.track.h) * rows - ROWS / 2)));
    return;
  }
  for (let slot = 0; slot < COLS * ROWS; slot++) {
    const li = pick.top * COLS + slot;
    if (li < n && inside(x, y, L.cell(slot))) return choose(ctx, list[li]);
  }
}

export function keyPick(ctx: PickCtx, k: 'prevTab' | 'nextTab') {
  setFilter(ctx, nextFilter(pick.f, k === 'nextTab' ? 1 : -1, (c2) => pickList(ctx, c2).length > 0));
}

// foco: fichas, a grade inteira (as fora da vista sem lugar na tela; o "jump" anda na grade e rola),
// setas de rolagem e VOLTAR
const NOWHERE: Rect = { x: NaN, y: NaN, w: 0, h: 0 };
export function pickFocus(ctx: PickCtx): FocusSet {
  const L = layout(), list = pickList(ctx), n = list.length;
  const chips: Focusable[] = L.chips.map((r, i) => ({ r, act: () => { const f = ([null, 'D', 'C', 'B', 'A', 'S'] as ClassFilter[])[i]; if (f === null || pickList(ctx, f).length) setFilter(ctx, f); } }));
  const vis = (li: number) => li >= pick.top * COLS && li < (pick.top + ROWS) * COLS;
  const cells: Focusable[] = list.map((car, li) => ({
    r: vis(li) ? L.cell(li - pick.top * COLS) : NOWHERE,
    is: () => pick.sel === li,
    pick: () => { pick.sel = li; reveal(n); },
    act: () => choose(ctx, car),
  }));
  const off = chips.length;
  const items: Focusable[] = [...chips, ...cells, { r: L.up, act: () => scroll(n, -1) }, { r: L.down, act: () => scroll(n, 1) }, { r: L.back, act: closePick }];
  const jump = (k: 'up' | 'down' | 'left' | 'right', cur: number) => {
    const li = cur - off;
    if (li < 0 || li >= n) return -1;
    const col = li % COLS;
    if (k === 'left') return col > 0 ? cur - 1 : -1;
    if (k === 'right') return col < COLS - 1 && li + 1 < n ? cur + 1 : -1; // última coluna: vai para a rolagem
    if (k === 'up') return li - COLS >= 0 ? cur - COLS : -1; // primeira fileira: sobe para as fichas
    // baixo: a fileira de baixo (na última, o carro mais à direita dela; depois, o VOLTAR)
    if (li + COLS < n) return cur + COLS;
    if (Math.floor(li / COLS) < rowsOf(n) - 1) return off + n - 1;
    return -1;
  };
  return { key: `pick:${pick.f ?? ''}`, items, def: off + pick.sel, jump };
}
