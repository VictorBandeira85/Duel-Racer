// Telas do racha de rua noturno (convite e aposta) e do patrocínio (propostas e contrato), no estilo da
// revista. A lógica (save, aposta, metas, pagamento) fica em rivalry.ts.
import { SAFE_W, view } from './config';
import { carById, driverCar, type CareerSave } from './career';
import { drawCarSide } from './cars';
import { BRANDS, drawLogo } from './brands';
import { paintHex } from './paint';
import { flash, money, toast, topBar } from './careerScreens';
import { BLUE, GREY, INK, RED, YELLOW, box, burst, headline, ink, kicker, paper, photo, rule, tag } from './mag';
import type { Actions, AppState, MenuKey } from './screens';
import { ox } from './screens';
import { inside, type Focusable, type FocusSet, type Rect } from './ui';
import { drawPortrait, rivalOf, wrapLines } from './rivals';
import {
  GOALS, canBetPink, cancelSponsor, cur, declineStreet, eventById, rivalLine, rivalRecordLine, signSponsor, sponsorName, sponsorOf, sponsorOffers, streetEvent, streetOffer,
} from './rivalry';

const GREEN = '#1a6a2a';
export const st = { bet: 0, confirm: false, offer: 0 };

// ---------- acessos (menu da carreira) ----------
export const sponsorTagRect = (): Rect => ({ x: ox() + 80, y: 19, w: 66, h: 11 });
export const streetTagRect = (): Rect => ({ x: ox() + 150, y: 19, w: 44, h: 11 });
// etiquetas no alto do menu da carreira: PATROCÍNIO (sempre) e RACHA! (convite pendente, piscando)
export function drawCareerTags(c: CanvasRenderingContext2D, s: AppState) {
  const cs = s.career!;
  const sp = sponsorOf(cs);
  tag(c, sponsorTagRect(), sp ? `★ ${BRANDS[sp.brand].name.toUpperCase()}` : 'PATROCÍNIO', false, 5);
  if (streetOffer(cs)) tag(c, streetTagRect(), 'RACHA!', Math.floor(s.t * 2) % 2 === 0, 5);
}
export function tapCareerTags(s: AppState, a: Actions, x: number, y: number) {
  if (inside(x, y, sponsorTagRect())) return openSponsor(s, a), true;
  if (streetOffer(s.career!) && inside(x, y, streetTagRect())) return openStreet(s, a), true;
  return false;
}
export const careerTagFocus = (s: AppState, a: Actions): Focusable[] => [
  { r: sponsorTagRect(), act: () => openSponsor(s, a) },
  ...(streetOffer(s.career!) ? [{ r: streetTagRect(), act: () => openStreet(s, a) }] : []),
];
export function openStreet(s: AppState, a: Actions) {
  st.bet = 0;
  st.confirm = false;
  a.go('racha');
  s.sel = 0;
}
export function openSponsor(s: AppState, a: Actions) {
  st.offer = 0;
  st.confirm = false;
  a.go('sponsor');
  s.sel = 0;
}
// saída do resultado: convite novo de racha aparece na hora
export function endContinue(s: AppState, a: Actions) {
  if (cur.newOffer && s.career && streetOffer(s.career)) {
    cur.newOffer = false;
    return openStreet(s, a);
  }
  a.go('career');
}

// ---------- RACHA ----------
const bets = (cs: CareerSave) => {
  const o = streetOffer(cs)!;
  return [o.bet, o.bet * 2];
};
const betRows = (): Rect[] => [0, 1, 2].map((i) => ({ x: ox() + 162, y: 46 + i * 24, w: 154, h: 21 }));
const streetButtons = () => ({ no: { x: ox() + 4, y: 211, w: 100, h: 15 } as Rect, later: { x: ox() + 110, y: 211, w: 100, h: 15 } as Rect, go: { x: ox() + 216, y: 211, w: 100, h: 15 } as Rect });
const confirmButtons = () => ({ no: { x: ox() + 60, y: 160, w: 90, h: 15 } as Rect, yes: { x: ox() + 156, y: 160, w: 104, h: 15 } as Rect });

export function drawStreet(c: CanvasRenderingContext2D, s: AppState) {
  const cs = s.career!;
  const o = streetOffer(cs);
  const ev = streetEvent(cs);
  const base = o && eventById(o.ev);
  if (!o || !ev || !base) {
    s.screen = 'career';
    return;
  }
  const d = ev.driver;
  const p = rivalOf(d);
  const x = ox();
  paper(c);
  topBar(c, s, 'RACHA SECRETO', cs);
  kicker(c, 'CONVITE · SÓ PARA QUEM É CONVIDADO', x + 4, 20, RED, YELLOW);
  // panfleto noturno: o carro dele sob a luz do poste
  const ph: Rect = { x: x + 4, y: 33, w: 152, h: 72 };
  photo(c, ph, () => {
    const g = c.createRadialGradient(ph.x + ph.w / 2, ph.y + 10, 4, ph.x + ph.w / 2, ph.y + 40, 90);
    g.addColorStop(0, 'rgba(255,214,140,0.35)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g;
    c.fillRect(ph.x, ph.y, ph.w, ph.h);
    drawCarSide(c, ph.x + 8, ph.y + 66, ph.w - 16, driverCar(d), d.paint, undefined, undefined, 'rival');
  }, ['#05070e', '#1c1f2a']);
  text2(c, 'HOJE À NOITE', ph.x + 4, ph.y + 4, YELLOW);
  drawPortrait(c, d, { x: x + 4, y: 111, w: 30, h: 36 });
  headline(c, d.name.toUpperCase(), x + 38, 111, 8, INK);
  ink(c, `"${p.nick.toUpperCase()}" · ${carById(d.car).name}`, x + 38, 122, 4, RED);
  const rec = rivalRecordLine(cs, d);
  if (rec) wrapLines(c, rec.replace('HISTÓRICO: ', ''), 116, 4).slice(0, 2).forEach((l, i) => ink(c, l, x + 38, 130 + i * 7, 4, BLUE));
  const said = rivalLine(cs, d, cs.races) ?? p.rematch;
  wrapLines(c, `"${said}"`, 150, 4).slice(0, 3).forEach((l, i) => ink(c, l, x + 4, 152 + i * 7, 4, INK));
  ink(c, '1 trecho · noite · sem trânsito', x + 4, 177, 4, GREY);
  ink(c, 'polícia reforçada', x + 4, 184, 4, RED);
  const left = o.until - cs.races;
  ink(c, left > 0 ? `O convite vale por mais ${left + 1} corrida${left ? 's' : ''}` : 'Último dia do convite', x + 4, 194, 4, GREY);
  // a aposta
  box(c, { x: x + 162, y: 33, w: 154, h: 112 }, 'A APOSTA', RED);
  const pinkOk = canBetPink(cs);
  const opts = [...bets(cs).map((v) => `DINHEIRO: ${money(v)}`), 'O ROSA: CARRO X CARRO'];
  betRows().forEach((r, i) => {
    const on = st.bet === i, dis = i === 2 && !pinkOk;
    c.fillStyle = on ? (i === 2 ? '#3a0a10' : INK) : dis ? '#e6dcc6' : '#f6efdd';
    c.fillRect(r.x + 3, r.y, r.w - 6, r.h);
    c.strokeStyle = on ? RED : 'rgba(26,22,20,0.35)';
    c.lineWidth = on ? 2 : 1;
    c.strokeRect(r.x + 3.5, r.y + 0.5, r.w - 7, r.h - 1);
    ink(c, opts[i], r.x + 8, r.y + 4, 5, on ? YELLOW : dis ? GREY : INK);
    const sub = i < 2 ? `ganha ${money(bets(cs)[i])} · perde ${money(Math.min(bets(cs)[i], cs.money))}`
      : dis ? 'precisa de 2 carros na garagem' : `ganha o ${carById(d.car).name} · perde o seu`;
    ink(c, sub, r.x + 8, r.y + 13, 4, on ? '#fff' : GREY);
  });
  // o seu carro, que vai para a aposta no rosa
  const mine = carById(cs.car);
  ink(c, `Você corre com o ${mine.name}`, x + 165, 124, 4, st.bet === 2 ? RED : INK);
  if (cs.owned.includes(d.car) && st.bet === 2) ink(c, 'Já tem esse carro: vale dinheiro', x + 165, 132, 4, GREY);
  const pr = { x: x + 168, y: 150, w: 142, h: 44 } as Rect;
  photo(c, pr, () => drawCarSide(c, pr.x + 6, pr.y + 40, pr.w - 12, carById(cs.car), paintHex(cs.car)), ['#05070e', '#1c1f2a']);
  if (st.bet === 2) burst(c, x + 300, 150, 14, ['O', 'ROSA'], '#f0a0c0', INK, s.t);
  const b = streetButtons();
  tag(c, b.no, '✕ RECUSAR');
  tag(c, b.later, 'DEPOIS');
  tag(c, b.go, 'ACEITAR ▶', Math.floor(s.t * 2) % 2 === 0);
  if (st.confirm) {
    // confirmação clara antes de apostar o carro
    c.fillStyle = 'rgba(10,8,6,0.6)';
    c.fillRect(0, 0, view.w, view.h);
    const r: Rect = { x: x + 40, y: 70, w: 240, h: 112 };
    box(c, r, 'TEM CERTEZA?', RED);
    headline(c, 'APOSTAR O SEU CARRO', r.x + r.w / 2, r.y + 16, 8, RED, 'center');
    const lines = [`Se perder, o seu ${mine.name}`, `(com as peças) fica com ${p.nick}.`, `Se vencer, o ${carById(d.car).name} dele é seu.`, 'Não tem volta.'];
    lines.forEach((l, i) => ink(c, l, r.x + r.w / 2, r.y + 32 + i * 10, 5, i === 3 ? RED : INK, 'center'));
    const cb = confirmButtons();
    tag(c, cb.no, 'NÃO');
    tag(c, cb.yes, 'SIM, APOSTO', true);
  }
  toast(c, s);
}
// texto branco com contorno (sobre a foto noturna)
const text2 = (c: CanvasRenderingContext2D, s: string, x: number, y: number, col: string) => kicker(c, s, x, y, INK, col);

function streetGo(s: AppState, a: Actions) {
  const cs = s.career!;
  if (st.bet === 2 && !canBetPink(cs)) return flash(s, 'Para apostar o carro, tenha pelo menos 2 na garagem');
  if (st.bet === 2 && !st.confirm) {
    st.confirm = true;
    return;
  }
  st.confirm = false;
  const v = st.bet < 2 ? bets(cs)[st.bet] : streetOffer(cs)!.bet;
  a.startStreet?.(st.bet === 2, v);
}
export function tapStreet(s: AppState, a: Actions, x: number, y: number) {
  const cs = s.career!;
  if (st.confirm) {
    const cb = confirmButtons();
    if (inside(x, y, cb.yes)) streetGo(s, a);
    else if (inside(x, y, cb.no)) st.confirm = false;
    return;
  }
  const b = streetButtons();
  if (inside(x, y, b.go)) return streetGo(s, a);
  if (inside(x, y, b.later)) return a.go('career');
  if (inside(x, y, b.no)) {
    declineStreet(cs);
    flash(s, 'Convite recusado');
    return a.go('career');
  }
  betRows().forEach((r, i) => {
    if (!inside(x, y, r)) return;
    if (i === 2 && !canBetPink(cs)) flash(s, 'Para apostar o carro, tenha pelo menos 2 na garagem');
    else st.bet = i;
  });
}
export function keyStreet(s: AppState, a: Actions, k: MenuKey) {
  if (st.confirm) {
    if (k === 'back') st.confirm = false;
    if (k === 'ok') streetGo(s, a);
    return;
  }
  if (k === 'back') a.go('career');
}
export function streetFocusables(s: AppState, a: Actions): FocusSet {
  if (st.confirm) {
    const cb = confirmButtons();
    return { key: 'racha:confirm', items: [{ r: cb.no, act: () => { st.confirm = false; } }, { r: cb.yes, act: () => streetGo(s, a) }], def: 0 };
  }
  const b = streetButtons();
  const rows = betRows().map((r, i): Focusable => ({ r, is: () => st.bet === i, pick: () => { if (i < 2 || canBetPink(s.career!)) st.bet = i; } }));
  return { key: 'racha', items: [...rows, { r: b.no }, { r: b.later }, { r: b.go, act: () => streetGo(s, a) }], def: 4 };
}

// ---------- PATROCÍNIO ----------
const offerCards = (): Rect[] => [0, 1, 2].map((i) => ({ x: ox() + 4 + i * 105, y: 96, w: 102, h: 108 }));
const sponsorButtons = () => ({ back: { x: ox() + 4, y: 211, w: 100, h: 15 } as Rect, cancel: { x: ox() + 110, y: 211, w: 100, h: 15 } as Rect, sign: { x: ox() + 216, y: 211, w: 100, h: 15 } as Rect });

export function drawSponsor(c: CanvasRenderingContext2D, s: AppState) {
  const cs = s.career!;
  const x = ox();
  paper(c);
  topBar(c, s, 'PATROCÍNIO', cs);
  kicker(c, 'CONTRATOS DE PATROCÍNIO', x + 4, 20, RED, '#fff');
  const sp = sponsorOf(cs);
  const top: Rect = { x: x + 4, y: 33, w: SAFE_W - 8, h: 56 };
  box(c, top, sp ? 'CONTRATO EM ANDAMENTO' : 'SEM CONTRATO', sp ? GREEN : INK);
  if (sp) {
    drawLogo(c, BRANDS[sp.brand], top.x + 5, top.y + 15, 3);
    headline(c, sponsorName(sp.brand).toUpperCase(), top.x + 38, top.y + 14, 8, INK);
    ink(c, GOALS[sp.goal].desc(sp), top.x + 38, top.y + 26, 4, BLUE);
    // progresso da meta e o prazo
    const bw = 100;
    c.fillStyle = '#e6dcc6';
    c.fillRect(top.x + 38, top.y + 34, bw, 5);
    c.fillStyle = GREEN;
    c.fillRect(top.x + 38, top.y + 34, Math.round((bw * Math.min(sp.prog, sp.target)) / sp.target), 5);
    ink(c, `${sp.prog}/${sp.target} · corrida ${sp.races} de ${sp.len}`, top.x + 142, top.y + 34, 4, INK);
    ink(c, `${money(sp.per)} por corrida na meta · bônus ${money(sp.bonus)} · já pagou ${money(sp.paid)}`, top.x + 38, top.y + 44, 4, GREY);
    const pr: Rect = { x: top.x + top.w - 76, y: top.y + 13, w: 72, h: 26 };
    photo(c, pr, () => drawCarSide(c, pr.x + 3, pr.y + 24, pr.w - 6, carById(sp.car), paintHex(sp.car)));
  } else {
    const msg = `Escolha uma proposta: a marca paga cada corrida que cumprir a meta e um bônus ao fechar o contrato. O adesivo vai no carro em uso (${carById(cs.car).name}). Racha de rua não conta.`;
    wrapLines(c, msg, top.w - 90, 4).slice(0, 5).forEach((l, i) => ink(c, l, top.x + 6, top.y + 14 + i * 8, 4, INK));
    const pr: Rect = { x: top.x + top.w - 76, y: top.y + 13, w: 72, h: 26 };
    photo(c, pr, () => drawCarSide(c, pr.x + 3, pr.y + 24, pr.w - 6, carById(cs.car), paintHex(cs.car)));
  }
  // as propostas
  ink(c, 'PROPOSTAS DO MÊS', x + 4, 91 - 1, 4, GREY);
  const offers = sponsorOffers(cs);
  offerCards().forEach((r, i) => {
    const o = offers[i];
    if (!o) return;
    const on = st.offer === i && !sp;
    c.fillStyle = sp ? '#ece4d0' : on ? '#fff8e4' : '#f6efdd';
    c.fillRect(r.x, r.y, r.w, r.h);
    c.strokeStyle = on ? RED : 'rgba(26,22,20,0.35)';
    c.lineWidth = on ? 2 : 1;
    c.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1);
    drawLogo(c, BRANDS[o.brand], r.x + 4, r.y + 4, 2);
    ink(c, BRANDS[o.brand].name.toUpperCase(), r.x + 26, r.y + 5, 5, INK);
    ink(c, sponsorName(o.brand).split(' ').slice(1).join(' ').toUpperCase(), r.x + 26, r.y + 14, 4, GREY);
    rule(c, r.x + 4, r.y + 25, r.w - 8, RED);
    ink(c, GOALS[o.goal].name, r.x + 4, r.y + 29, 4, RED);
    wrapLines(c, GOALS[o.goal].desc(o), r.w - 8, 4).slice(0, 3).forEach((l, k) => ink(c, l, r.x + 4, r.y + 38 + k * 7, 4, INK));
    ink(c, 'POR CORRIDA', r.x + 4, r.y + 64, 4, GREY);
    ink(c, money(o.per), r.x + r.w - 4, r.y + 64, 4, GREEN, 'right');
    ink(c, 'BÔNUS FINAL', r.x + 4, r.y + 73, 4, GREY);
    ink(c, money(o.bonus), r.x + r.w - 4, r.y + 73, 4, GREEN, 'right');
    ink(c, 'PRAZO', r.x + 4, r.y + 82, 4, GREY);
    ink(c, `${o.len} corridas`, r.x + r.w - 4, r.y + 82, 4, INK, 'right');
    ink(c, `total até ${money(o.per * o.target + o.bonus)}`, r.x + r.w / 2, r.y + 95, 4, on ? RED : GREY, 'center');
  });
  const b = sponsorButtons();
  tag(c, b.back, '◀ VOLTAR');
  if (sp) tag(c, b.cancel, st.confirm ? 'CONFIRMAR?' : 'CANCELAR', st.confirm);
  tag(c, b.sign, sp ? 'EM CONTRATO' : 'ASSINAR ▶', !sp && Math.floor(s.t * 2) % 2 === 0);
  toast(c, s);
}
function sponsorSign(s: AppState) {
  const cs = s.career!;
  if (sponsorOf(cs)) return flash(s, 'Cancele o contrato atual para assinar outro');
  const o = sponsorOffers(cs)[st.offer];
  if (!o) return;
  signSponsor(cs, o);
  flash(s, `Contrato com a ${sponsorName(o.brand)} assinado!`);
}
function sponsorCancel(s: AppState) {
  const cs = s.career!;
  if (!sponsorOf(cs)) return;
  if (!st.confirm) {
    st.confirm = true;
    return;
  }
  st.confirm = false;
  cancelSponsor(cs);
  flash(s, 'Contrato cancelado (sem bônus)');
}
export function tapSponsor(s: AppState, a: Actions, x: number, y: number) {
  const b = sponsorButtons();
  if (inside(x, y, b.back)) return a.go('careerMenu');
  if (inside(x, y, b.sign)) return sponsorSign(s);
  if (inside(x, y, b.cancel)) return sponsorCancel(s);
  st.confirm = false;
  offerCards().forEach((r, i) => {
    if (inside(x, y, r) && !sponsorOf(s.career!)) st.offer = i;
  });
}
export function keySponsor(s: AppState, a: Actions, k: MenuKey) {
  if (k === 'back') a.go('careerMenu');
}
export function sponsorFocusables(s: AppState, a: Actions): FocusSet {
  const b = sponsorButtons();
  const has = !!sponsorOf(s.career!);
  const cards = has ? [] : offerCards().map((r, i): Focusable => ({ r, is: () => st.offer === i, pick: () => { st.offer = i; }, act: () => sponsorSign(s) }));
  return { key: `sponsor:${has}`, items: [...cards, { r: b.back }, ...(has ? [{ r: b.cancel, act: () => sponsorCancel(s) }] : [{ r: b.sign, act: () => sponsorSign(s) }])], def: 0 };
}
