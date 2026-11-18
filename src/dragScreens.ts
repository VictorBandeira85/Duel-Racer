// Telas da ARRANCADA 402 m (drag.ts): a página da escolha (carro, adversário, recorde) e a do resultado,
// com o "ticket" da cronometragem como o das pistas de arrancada (reação, 60 pés, 201 m e 402 m, com a
// velocidade). Carro e rival pelo seletor de carros do Arcade (carpick.ts), com as peças da oficina.
import { CARS, drawCarSide, perfIndex } from './cars';
import { classBadge } from './classui';
import { paintHex } from './paint';
import { GREY, INK, RED, YELLOW, arrow, burst, headline, ink, kicker, masthead, paper, photo, tag } from './mag';
import { inside, text, type Focusable, type FocusSet, type Rect } from './ui';
import { lastDevice } from './input';
import { arcadePrepped, arcadeTuned } from './arcadeprep';
import { closePick, drawPick, keyPick, openPick, pick, pickFocus, pickStep, tapPick, type PickCtx } from './carpick';
import { dragCfg, dragHost, dragLast, dragRecord, secs, type DragFoe, type Splits } from './drag';
import type { Actions, AppState, MenuKey } from './screens';
import { ox } from './screens';

let pickFor: 'me' | 'foe' = 'me';
const myCar = (s: AppState) => CARS[s.carIdx] ?? CARS[0];
const foeCar = (s: AppState) => (dragCfg.foe === 'same' ? myCar(s) : dragCfg.foe === 'pick' ? CARS.find((k) => k.id === dragCfg.foeId) ?? myCar(s) : null);
function ctxFor(s: AppState, who = pickFor): PickCtx {
  if (who === 'me') return { all: CARS, shown: (k) => arcadeTuned(k), prepped: arcadePrepped, cur: myCar(s).id, set: (id) => { s.carIdx = Math.max(0, CARS.findIndex((k) => k.id === id)); } };
  return { all: CARS, shown: (k) => arcadeTuned(k), prepped: arcadePrepped, cur: foeCar(s)?.id ?? myCar(s).id, set: (id) => { dragCfg.foeId = id; } };
}
function openFor(s: AppState, who: 'me' | 'foe') {
  pickFor = who;
  if (who === 'foe' && !dragCfg.foeId) dragCfg.foeId = myCar(s).id;
  openPick(ctxFor(s, who));
}

// ---------- escolha ----------
const L = () => {
  const x = ox();
  return {
    me: { x: x + 4, y: 34, w: 154, h: 118 } as Rect,
    meFoto: { x: x + 8, y: 38, w: 146, h: 62 } as Rect,
    prev: { x: x + 8, y: 54, w: 12, h: 30 } as Rect,
    next: { x: x + 142, y: 54, w: 12, h: 30 } as Rect,
    meBtn: { x: x + 8, y: 133, w: 146, h: 15 } as Rect,
    foe: { x: x + 162, y: 34, w: 154, h: 118 } as Rect,
    foeFoto: { x: x + 166, y: 38, w: 146, h: 52 } as Rect,
    chips: [0, 1, 2].map((i): Rect => ({ x: x + 166 + i * 49, y: 116, w: 47, h: 13 })),
    foeBtn: { x: x + 166, y: 133, w: 146, h: 15 } as Rect,
    rec: { x: x + 4, y: 157, w: 312, h: 48 } as Rect,
    tod: [0, 1].map((i): Rect => ({ x: x + 216 + i * 50, y: 159, w: 48, h: 11 })),
    back: { x: x + 4, y: 211, w: 100, h: 15 } as Rect,
    go: { x: x + 216, y: 211, w: 100, h: 15 } as Rect,
  };
};
const FOES: [DragFoe, string][] = [['same', 'IGUAL'], ['pick', 'OUTRO'], ['clock', 'RELÓGIO']];

// cronômetro de mentira (contra o relógio): mostrador na foto do adversário
function stopwatch(c: CanvasRenderingContext2D, cx: number, cy: number, r: number, t: number) {
  c.fillStyle = INK;
  c.fillRect(cx - 3, cy - r - 6, 6, 5);
  c.beginPath();
  c.arc(cx, cy, r + 2, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = '#f4f0e6';
  c.beginPath();
  c.arc(cx, cy, r, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = INK;
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    c.fillRect(Math.round(cx + Math.sin(a) * (r - 3)) - 0.5, Math.round(cy - Math.cos(a) * (r - 3)) - 0.5, 1, 1);
  }
  const a = (t % 4) / 4 * Math.PI * 2;
  c.strokeStyle = RED;
  c.lineWidth = 1;
  c.beginPath();
  c.moveTo(cx, cy);
  c.lineTo(cx + Math.sin(a) * (r - 4), cy - Math.cos(a) * (r - 4));
  c.stroke();
}

export function drawDrag(c: CanvasRenderingContext2D, s: AppState) {
  const x = ox(), l = L();
  paper(c);
  masthead(c, 'ARRANCADA 402 M');
  if (pick.open) return drawPick(c, ctxFor(s));
  const kw = kicker(c, 'TIRO DE UM QUARTO DE MILHA', x + 4, 20, RED, '#fff');
  ink(c, 'Arcade', x + 10 + kw, 22, 5, GREY);
  const keys = lastDevice.kind !== 'touch';
  const frame = (r: Rect) => {
    c.fillStyle = INK;
    c.fillRect(r.x - 1, r.y - 1, r.w + 2, r.h + 2);
    c.fillStyle = '#f8f2e2';
    c.fillRect(r.x, r.y, r.w, r.h);
  };
  // o seu carro (com as peças da oficina do Arcade)
  const car = myCar(s), mine = arcadeTuned(car);
  frame(l.me);
  photo(c, l.meFoto, () => drawCarSide(c, l.meFoto.x + 14, l.meFoto.y + 56, l.meFoto.w - 28, mine, paintHex(car.id)), ['#7c8ea2', '#c09858']);
  arrow(c, l.prev, 'left');
  arrow(c, l.next, 'right');
  if (arcadePrepped(car.id)) kicker(c, 'PREPARADO', l.meFoto.x + 1, l.meFoto.y + 1, RED, YELLOW);
  else kicker(c, 'DE FÁBRICA', l.meFoto.x + 1, l.meFoto.y + 1, INK, '#fff');
  const name = car.name.toUpperCase();
  ink(c, name, l.me.x + 4, l.me.y + 68, name.length * 8 <= 146 ? 8 : 5, INK);
  classBadge(c, l.me.x + 4, l.me.y + 79, mine, false, 9);
  ink(c, `PI ${perfIndex(mine)} · ${Math.round((parseInt(car.power) * mine.accel) / car.accel)} cv`, l.me.x + 18, l.me.y + 81, 5, INK);
  ink(c, mine.launchCap ? '3-step instalado' : mine.drive === 'integral' ? 'Tração integral' : `Tração ${mine.drive}`, l.me.x + 4, l.me.y + 92, 4, GREY);
  tag(c, l.meBtn, 'TROCAR CARRO ▶');
  // adversário: o mesmo carro, outro escolhido ou só o relógio
  frame(l.foe);
  const foe = foeCar(s);
  photo(c, l.foeFoto, () => {
    if (foe) drawCarSide(c, l.foeFoto.x + 14, l.foeFoto.y + 47, l.foeFoto.w - 28, arcadeTuned(foe), paintHex(foe.id) ?? undefined);
    else stopwatch(c, l.foeFoto.x + l.foeFoto.w / 2, l.foeFoto.y + 27, 18, s.t);
  }, ['#5e6670', '#c8cdd2']);
  kicker(c, 'ADVERSÁRIO', l.foeFoto.x + 1, l.foeFoto.y + 1, INK, YELLOW);
  const fname = foe ? foe.name.toUpperCase() : 'CONTRA O RELÓGIO';
  ink(c, fname, l.foe.x + 4, l.foe.y + 60, fname.length * 5 <= 146 ? 5 : 4, INK);
  ink(c, foe ? (dragCfg.foe === 'same' ? 'O mesmo carro, ao seu lado' : 'Escolha o carro do rival') : 'Só você e o cronômetro', l.foe.x + 4, l.foe.y + 70, 4, GREY);
  l.chips.forEach((r, i) => {
    const on = dragCfg.foe === FOES[i][0];
    c.fillStyle = on ? RED : 'rgba(26,22,20,0.12)';
    c.fillRect(r.x, r.y, r.w, r.h);
    text(c, FOES[i][1], r.x + r.w / 2, r.y + 4, 5, on ? YELLOW : INK, 'center', null);
  });
  if (dragCfg.foe === 'pick') tag(c, l.foeBtn, 'TROCAR RIVAL ▶');
  else ink(c, dragCfg.foe === 'same' ? 'Mesmas peças, mesma potência' : 'Vale o seu recorde', l.foe.x + 77, l.foeBtn.y + 5, 4, GREY, 'center');
  // recorde do carro (de fábrica e preparado separados)
  const prepped = arcadePrepped(car.id), rec = dragRecord(car.id, prepped);
  c.fillStyle = INK;
  c.fillRect(l.rec.x, l.rec.y, l.rec.w, l.rec.h);
  text(c, `RECORDE ${prepped ? 'PREPARADO' : 'DE FÁBRICA'}`, l.rec.x + 4, l.rec.y + 4, 5, YELLOW, 'left', null);
  if (rec) {
    text(c, `${secs(rec.t402)} s`, l.rec.x + 4, l.rec.y + 16, 16, '#fff', 'left', null);
    text(c, `${Math.round(rec.v402)} km/h`, l.rec.x + 4, l.rec.y + 37, 5, YELLOW, 'left', null);
    const rows: [string, string][] = [['REAÇÃO', secs(rec.rt)], ['18 M', secs(rec.t60)], ['201 M', `${secs(rec.t201)}  ${Math.round(rec.v201)} km/h`]];
    rows.forEach(([a, b], i) => {
      text(c, a, l.rec.x + 150, l.rec.y + 16 + i * 10, 5, '#b8b0a0', 'left', null);
      text(c, b, l.rec.x + l.rec.w - 5, l.rec.y + 16 + i * 10, 5, '#fff', 'right', null);
    });
  } else {
    text(c, 'Nenhum tiro ainda com este carro', l.rec.x + 4, l.rec.y + 18, 5, '#fff', 'left', null);
    text(c, 'Segure o freio, acelere e solte no verde', l.rec.x + 4, l.rec.y + 30, 4, '#b8b0a0', 'left', null);
  }
  // hora: dia ou noite (à noite, a pista iluminada pelos postes e pelos faróis)
  l.tod.forEach((r, i) => {
    const on = dragCfg.night === (i === 1);
    c.fillStyle = on ? YELLOW : 'rgba(255,255,255,0.12)';
    c.fillRect(r.x, r.y, r.w, r.h);
    text(c, i ? 'NOITE' : 'DIA', r.x + r.w / 2, r.y + 3, 5, on ? INK : '#fff', 'center', null);
  });
  tag(c, l.back, '◀ ARCADE');
  tag(c, l.go, 'LARGAR ▶', keys);
  ink(c, 'Soltar antes do verde', x + 160, 211, 4, GREY, 'center');
  ink(c, 'queima a largada', x + 160, 219, 4, GREY, 'center');
}

function start(s: AppState) {
  const car = arcadeTuned(myCar(s)), foe = foeCar(s);
  dragHost.start(car, foe ? arcadeTuned(foe) : null);
}
function setFoe(f: DragFoe, s: AppState) {
  dragCfg.foe = f;
  if (f === 'pick' && !dragCfg.foeId) dragCfg.foeId = myCar(s).id;
}

export function tapDrag(s: AppState, a: Actions, x: number, y: number) {
  if (pick.open) return tapPick(ctxFor(s), x, y);
  const l = L();
  if (inside(x, y, l.back)) return a.go('arcadeMenu');
  if (inside(x, y, l.go)) return start(s);
  if (inside(x, y, l.prev)) return pickStep(ctxFor(s, 'me'), -1);
  if (inside(x, y, l.next)) return pickStep(ctxFor(s, 'me'), 1);
  if (inside(x, y, l.meFoto) || inside(x, y, l.meBtn)) return openFor(s, 'me');
  l.chips.forEach((r, i) => inside(x, y, r) && setFoe(FOES[i][0], s));
  l.tod.forEach((r, i) => { if (inside(x, y, r)) dragCfg.night = i === 1; });
  if (dragCfg.foe === 'pick' && (inside(x, y, l.foeBtn) || inside(x, y, l.foeFoto))) return openFor(s, 'foe');
}

export function keyDrag(s: AppState, a: Actions, k: MenuKey) {
  if (pick.open) return k === 'back' ? closePick() : k === 'prevTab' || k === 'nextTab' ? keyPick(ctxFor(s), k) : undefined;
  if (k === 'back') return a.go('arcadeMenu');
  if (k === 'prevTab' || k === 'nextTab') return pickStep(ctxFor(s, 'me'), k === 'nextTab' ? 1 : -1);
}

export function dragFocusables(s: AppState, a: Actions): FocusSet {
  if (pick.open) return pickFocus(ctxFor(s));
  const l = L();
  const items: Focusable[] = [
    { r: l.meFoto, lr: (d) => pickStep(ctxFor(s, 'me'), d), act: () => openFor(s, 'me') },
    ...l.chips.map((r, i): Focusable => ({ r, act: () => setFoe(FOES[i][0], s) })),
    ...l.tod.map((r, i): Focusable => ({ r, act: () => { dragCfg.night = i === 1; } })),
    ...(dragCfg.foe === 'pick' ? [{ r: l.foeBtn, act: () => openFor(s, 'foe') }] : []),
    { r: l.back, act: () => a.go('arcadeMenu') },
    { r: l.go, act: () => start(s) },
  ];
  return { key: `drag:${dragCfg.foe}`, items, def: items.length - 1 };
}

// ---------- resultado ----------
const E = () => {
  const x = ox();
  return {
    back: { x: x + 4, y: 211, w: 96, h: 15 } as Rect,
    swap: { x: x + 112, y: 211, w: 96, h: 15 } as Rect,
    again: { x: x + 220, y: 211, w: 96, h: 15 } as Rect,
  };
};
// ticket da cronometragem: papel branco com a borda serrilhada, as duas pistas lado a lado
function slip(c: CanvasRenderingContext2D, r: Rect, me: Splits, foe: Splits | null, won: boolean, foul: boolean) {
  c.fillStyle = 'rgba(40,30,20,0.35)';
  c.fillRect(r.x + 3, r.y + 3, r.w, r.h);
  c.fillStyle = '#fbf9f2';
  c.fillRect(r.x, r.y, r.w, r.h);
  // serrilhado em cima e embaixo
  c.fillStyle = '#efe6d2';
  for (let i = 0; i < r.w; i += 4) {
    c.fillRect(r.x + i, r.y, 2, 1);
    c.fillRect(r.x + i, r.y + r.h - 1, 2, 1);
  }
  const cx = r.x + r.w / 2;
  text(c, 'DRAGWAY', cx, r.y + 5, 5, INK, 'center', null);
  text(c, 'CRONOMETRAGEM OFICIAL', cx, r.y + 13, 4, GREY, 'center', null);
  c.fillStyle = INK;
  for (let i = r.x + 6; i < r.x + r.w - 6; i += 2) c.fillRect(i, r.y + 21, 1, 1);
  const cL = r.x + r.w - 56, cR = r.x + r.w - 6; // colunas (alinhadas à direita)
  text(c, foe ? 'RIVAL' : '', cL, r.y + 26, 4, GREY, 'right', null);
  text(c, 'VOCÊ', cR, r.y + 26, 4, RED, 'right', null);
  const rows: [string, (q: Splits) => string][] = [
    ['REAÇÃO', (q) => secs(q.rt)],
    ['18 M', (q) => secs(q.t60)],
    ['201 M', (q) => secs(q.t201)],
    ['KM/H', (q) => q.v201.toFixed(1).replace('.', ',')],
    ['402 M', (q) => secs(q.t402)],
    ['KM/H', (q) => q.v402.toFixed(1).replace('.', ',')],
  ];
  rows.forEach(([lab, f], i) => {
    const y = r.y + 36 + i * 11;
    if (i === 4) {
      c.fillStyle = 'rgba(208,31,38,0.1)';
      c.fillRect(r.x + 3, y - 3, r.w - 6, 20);
    }
    text(c, lab, r.x + 6, y, 5, INK, 'left', null);
    if (foe) text(c, f(foe), cL, y, 5, INK, 'right', null);
    text(c, f(me), cR, y, 5, foul && i === 0 ? RED : INK, 'right', null);
  });
  c.fillStyle = INK;
  for (let i = r.x + 6; i < r.x + r.w - 6; i += 2) c.fillRect(i, r.y + 104, 1, 1);
  if (foe) {
    text(c, 'TOTAL', r.x + 6, r.y + 110, 5, INK, 'left', null);
    text(c, secs(foe.rt + foe.t402), cL, r.y + 110, 5, INK, 'right', null);
    text(c, secs(me.rt + me.t402), cR, r.y + 110, 5, INK, 'right', null);
    text(c, 'reação + tempo: quem chega primeiro', cx, r.y + 120, 4, GREY, 'center', null);
  }
  const verdict = foul ? 'LUZ VERMELHA' : !foe ? 'TEMPO VÁLIDO' : won ? 'VENCEDOR: VOCÊ' : 'VENCEDOR: RIVAL';
  text(c, verdict, cx, r.y + r.h - 14, 5, foul || (foe && !won) ? RED : '#1a6a2a', 'center', null);
}

export function drawDragEnd(c: CanvasRenderingContext2D, s: AppState) {
  const x = ox(), e = E(), res = dragLast;
  paper(c);
  masthead(c, 'ARRANCADA 402 M');
  if (!res) {
    tag(c, e.back, '◀ ARCADE');
    return;
  }
  const head = res.foul ? 'QUEIMOU!' : !res.rival ? 'CONTRA O RELÓGIO' : res.won ? 'VITÓRIA!' : 'DERROTA';
  kicker(c, res.foul ? 'SAIU ANTES DO VERDE' : 'RESULTADO DO TIRO', x + 4, 20, RED, '#fff');
  headline(c, head, x + 4, 33, head.length > 10 ? 8 : 16, res.foul || (res.rival && !res.won) ? RED : INK);
  const ph: Rect = { x: x + 7, y: 56, w: 146, h: 62 };
  photo(c, ph, () => {
    if (res.rivalCar) drawCarSide(c, ph.x + 34, ph.y + 44, ph.w - 44, res.rivalCar, paintHex(res.rivalCar.id) ?? undefined);
    drawCarSide(c, ph.x + 2, ph.y + 58, ph.w - 30, res.car, paintHex(res.car.id) ?? undefined);
  }, ['#7c8ea2', '#c09858']);
  ink(c, res.car.name.toUpperCase(), x + 4, 124, 5, INK);
  ink(c, res.prepped ? 'Preparado (oficina do Arcade)' : 'De fábrica', x + 4, 133, 4, GREY);
  if (res.rivalCar) ink(c, `x ${res.rivalCar.name}`, x + 4, 141, 4, GREY);
  // recorde
  const rb: Rect = { x: x + 4, y: 152, w: 152, h: 52 };
  c.fillStyle = INK;
  c.fillRect(rb.x, rb.y, rb.w, rb.h);
  if (res.record) {
    text(c, 'NOVO RECORDE!', rb.x + 5, rb.y + 6, 5, YELLOW, 'left', null);
    text(c, `${secs(res.me.t402)} s`, rb.x + 5, rb.y + 18, 16, '#fff', 'left', null);
    if (res.best) text(c, `antes: ${secs(res.best.t402)} s`, rb.x + 5, rb.y + 40, 4, '#b8b0a0', 'left', null);
    burst(c, rb.x + rb.w - 18, rb.y + 4, 14, ['NOVO!'], YELLOW, RED, s.t);
  } else {
    text(c, res.foul ? 'TIRO NÃO VALE RECORDE' : 'RECORDE DO CARRO', rb.x + 5, rb.y + 6, 5, YELLOW, 'left', null);
    if (res.best) text(c, `${secs(res.best.t402)} s`, rb.x + 5, rb.y + 18, 16, '#fff', 'left', null);
    else text(c, 'Nenhum tiro válido ainda', rb.x + 5, rb.y + 22, 5, '#fff', 'left', null);
    if (res.best) text(c, `${Math.round(res.best.v402)} km/h · reação ${secs(res.best.rt)}`, rb.x + 5, rb.y + 40, 4, '#b8b0a0', 'left', null);
  }
  slip(c, { x: x + 164, y: 22, w: 152, h: 182 }, res.me, res.rival, res.won, res.foul);
  const keys = lastDevice.kind !== 'touch';
  tag(c, e.back, '◀ ARCADE');
  tag(c, e.swap, 'TROCAR CARRO');
  tag(c, e.again, 'DE NOVO ▶', keys);
}
export function tapDragEnd(s: AppState, a: Actions, x: number, y: number) {
  const e = E();
  if (inside(x, y, e.back)) return a.go('arcadeMenu');
  if (inside(x, y, e.swap)) return a.go('drag');
  if (inside(x, y, e.again)) return dragHost.again();
}
export function keyDragEnd(s: AppState, a: Actions, k: MenuKey) {
  if (k === 'back') a.go('drag');
}
export function dragEndFocusables(s: AppState, a: Actions): FocusSet {
  const e = E();
  return { key: 'dragEnd', def: 2, items: [{ r: e.back, act: () => a.go('arcadeMenu') }, { r: e.swap, act: () => a.go('drag') }, { r: e.again, act: () => dragHost.again() }] };
}
