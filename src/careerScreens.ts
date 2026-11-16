import { carSwap } from './carswap';
import { boostInfo, buildKey, fmtBar, heatWord, partCost, partInstalledMsg, partOf, slotArt, slotsFor, type Build, type SlotId } from './tuning';
import { setEngine, setEngineProfile, starterSound } from './audio';
import { lastDevice } from './input';
import { drawShowroom, keyShowroom, openShowroom, show, showroomFocusables, tapShowroom } from './showroom';
// Telas do modo Carreira: central (regiões e eventos), evento, garagem, concessionária e resultado.
import { SAFE_W, view, KMH, RES } from './config';
import { svgSprite } from './svgsprites';
const PARTPNG = import.meta.glob('./assets/parts/*.png', { eager: true, import: 'default' }) as Record<string, string>;
const partPng = (n: string) => PARTPNG[`./assets/parts/${n}.png`];
import { CARS, DEALER_CARS, RIMS, accelCurve, drawCarSide, wheelPng, perfClass, type CarSpec } from './cars';
import { classBadge, classLetter, drawFilter, filterAt, filterRects, filtered, nextFilter, stepCar, type ClassFilter } from './classui';
import {
  DEFAULT_SETUP, RATIO_LABEL, REGIONS, SUSP_LABEL, setupOf, buildOf, classFits, type Setup, carById, eventUnlocked, levels, newCareer, priceOf, regionUnlocked, regionsAfter, saveCareer,
  sellValue, tunedCar, type CareerSave, type EventResult, type Upgrade,
} from './career';
import { PAINTS, nearestPaint, paintHex, paintIdx, setPaint } from './paint';
import type { ScreenId, AppState, Actions, MenuKey } from './screens';
import { accelChart, carRows, carStars, ox, padlock, stageChip, verdictBox } from './screens';
import { BLUE, GREY, INK, RED, YELLOW, arrow, box, burst, headline, ink, kicker, masthead, paper, photo, rule, specRows, stars, tag } from './mag';
import { focusRing, inside, text, type Focusable, type FocusSet, type Rect } from './ui';
import { formatTime } from './util';
import { drawPortrait, preLine, rivalOf, wrapLines } from './rivals';
import { drawFixPanel, drawFixTag, drawStats, drawUsed, fixFocusables, fixTag, keyFix, keyStats, keyUsed, openUsed, pg, statsFocusables, tapFix, tapStats, tapUsed, usedFocusables } from './careerPages';
import { drawUsedSide, forgetCar } from './usedcars';
import { rematchCount, rematchEvent, rematchOpen, spend, wearOf, type CareerEvent, type Defect } from './career';
import { arcadeBuildOf, arcadePrepped, arcadeTuned, setArcadePart } from './arcadeprep';

const STYLE: Record<string, [string, string]> = {
  agressivo: ['AGRESSIVO', RED], cauteloso: ['CAUTELOSO', '#1a6a2a'], imprevisivel: ['IMPREVISÍVEL', '#b07000'],
};
export const money = (v: number) => `$${Math.round(v).toLocaleString('pt-BR')}`;

// estado da interface da carreira (não vai para o save)
// demo: oficina de preparação aberta fora da carreira (catálogo): id do carro em vista; nada é comprado
// arc: oficina do Arcade (id do carro em vista): instala de graça, nas preparações do Arcade (arcadeprep.ts)
// rematch: o evento aberto (ou a última corrida) é a revanche do rival
export const ui = { rematch: false, demo: '', arc: '', demoBack: 'title' as ScreenId, prep: false, prepRow: 0, prepView: {} as Build, revT0: -9, region: 0, event: 0, dealer: 0, garage: 0, gFocus: 6, rimPick: false, rimView: '', msg: '', msgT: 0, filter: null as ClassFilter };
export function flash(s: AppState, msg: string) {
  ui.msg = msg;
  ui.msgT = s.t + 2.2;
}

export function topBar(c: CanvasRenderingContext2D, s: AppState, title: string, cs: CareerSave) {
  masthead(c, title);
  void s;
  // saldo do leitor no canto, como etiqueta de preço
  const x = ox() + SAFE_W - 4;
  c.font = '5px "Press Start 2P", monospace';
  const w = Math.ceil(c.measureText(`SALDO ${money(cs.money)}`).width) + 7;
  c.fillStyle = '#1a6a2a';
  c.fillRect(x - w, 19, w, 11);
  text(c, `SALDO ${money(cs.money)}`, x - 3, 22, 5, '#fff', 'right', null);
}

// aviso curto por cima de tudo (compra, falta de dinheiro etc.)
// y: onde o aviso cai (na oficina fica abaixo da foto, para não tapar as rodas do carro)
export function toast(c: CanvasRenderingContext2D, s: AppState, y = 96) {
  if (!ui.msg || s.t >= ui.msgT) return;
  const x = ox();
  c.fillStyle = INK;
  c.fillRect(x + 24, y, SAFE_W - 48, 22);
  c.fillStyle = YELLOW;
  c.fillRect(x + 24, y, 4, 22);
  text(c, ui.msg, view.w / 2, y + 8, 5, '#fff', 'center', null);
}

// retrato do piloto: capacete na cor do carro dele, com a viseira e o número
export function helmet(c: CanvasRenderingContext2D, cx: number, cy: number, r: number, color: string, num: number) {
  c.fillStyle = INK;
  c.beginPath();
  c.ellipse(cx, cy, r + 1, r * 1.05 + 1, 0, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = color;
  c.beginPath();
  c.ellipse(cx, cy, r, r * 1.05, 0, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = 'rgba(255,255,255,0.35)';
  c.fillRect(cx - r * 0.6, cy - r * 0.75, r * 0.5, r * 0.2);
  c.fillStyle = '#1c2a3a';
  c.fillRect(cx - r * 0.85, cy - r * 0.1, r * 1.7, r * 0.42);
  c.fillStyle = 'rgba(160,200,255,0.5)';
  c.fillRect(cx - r * 0.7, cy - r * 0.05, r * 0.5, r * 0.12);
  c.fillStyle = '#fff';
  c.fillRect(cx - r * 0.3, cy + r * 0.45, r * 0.6, r * 0.35);
  text(c, String(num), cx, cy + r * 0.45, 5, INK, 'center', null);
}

// ---------- central da carreira ----------
const hubRows = () => [0, 1, 2, 3, 4].map((i): Rect => ({ x: ox() + 4, y: 58 + i * 30, w: SAFE_W - 8, h: 28 }));
const hubButtons = () => {
  const x = ox();
  return {
    prev: { x: x + 4, y: 34, w: 16, h: 20 }, next: { x: x + SAFE_W - 20, y: 34, w: 16, h: 20 },
    collection: { x: x + 4, y: 211, w: 74, h: 15 }, garage: { x: x + 83, y: 211, w: 74, h: 15 },
    dealer: { x: x + 162, y: 211, w: 82, h: 15 }, back: { x: x + 249, y: 211, w: 67, h: 15 },
  };
};

// classe do carro do jogador com as peças e ajustes (é ela que vale para entrar na região)
const myClass = (cs: CareerSave) => perfClass(tunedFor(carById(cs.car), levels(cs, cs.car), setupOf(cs, cs.car), buildOf(cs, cs.car)));
const fits = (cs: CareerSave, ri: number) => classFits(myClass(cs), REGIONS[ri].cls);
const noFit = (cs: CareerSave, ri: number) => `Só até a classe ${REGIONS[ri].cls}: seu carro é ${myClass(cs)}`;

export function drawCareer(c: CanvasRenderingContext2D, s: AppState) {
  const cs = s.career!;
  const x = ox();
  paper(c);
  topBar(c, s, 'CAMPEONATO', cs);
  const ri = ui.region;
  const ok = fits(cs, ri);
  kicker(c, `CARRO: ${carById(cs.car).name.toUpperCase()} · CLASSE ${myClass(cs)}`, x + 4, 20, ok ? INK : RED, ok ? YELLOW : '#fff');
  const reg = REGIONS[ri];
  const b = hubButtons();
  const open = regionUnlocked(cs, ri);
  // a região como seção da revista: faixa na cor dela, nome e descrição
  c.fillStyle = open ? reg.color : '#9a9286';
  c.fillRect(x + 24, 34, SAFE_W - 48, 20);
  text(c, `ETAPA ${ri + 1}: ${reg.name.toUpperCase()}`, view.w / 2 + 8, 37, 8, '#fff', 'center', INK);
  classLetter(c, x + 28, 37, reg.cls, 14); // classe da região
  const prevName = (REGIONS.find((r2) => r2.id === reg.after) ?? REGIONS[ri - 1])?.name ?? '';
  // carro acima da classe da região: o aviso entra no lugar da descrição
  text(c, !open ? `Vença o chefão de ${prevName}` : ok ? reg.desc : `Só carros até a classe ${reg.cls}: troque na GARAGEM`, view.w / 2 + 8, 47, 5, ok || !open ? '#fff' : YELLOW, 'center', null);
  arrow(c, b.prev, 'left');
  arrow(c, b.next, 'right');
  hubRows().forEach((r, ei) => {
    const ev = reg.events[ei];
    const done = cs.done.includes(ev.id);
    const can = eventUnlocked(cs, ri, ei);
    const hot = s.sel === ei && can;
    c.fillStyle = hot ? '#fff8e4' : can ? '#f6efdd' : '#e6dcc6';
    c.fillRect(r.x, r.y, r.w, r.h);
    c.strokeStyle = hot ? RED : ev.boss ? RED : 'rgba(26,22,20,0.35)';
    c.lineWidth = hot || ev.boss ? 2 : 1;
    c.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1);
    // retrato do rival e o carro dele
    // liberado: o retrato do rival; trancado: só o capacete apagado (ainda não se sabe quem é)
    if (can) drawPortrait(c, ev.driver, { x: r.x + 3, y: r.y + 3, w: 20, h: r.h - 6 });
    else helmet(c, r.x + 13, r.y + 14, 8, '#9a9286', ei + 1);
    const rc = carById(ev.driver.car);
    if (can) drawCarSide(c, r.x + r.w - 122, r.y + 25, 54, rc, ev.driver.paint, undefined, undefined, 'rival');
    if (ev.boss) kicker(c, 'CHEFÃO', r.x + 26, r.y + 3, RED, '#fff');
    ink(c, ev.name.toUpperCase(), r.x + (ev.boss ? 64 : 26), r.y + 5, 5, can ? INK : GREY);
    ink(c, `vs ${ev.driver.name} • ${ev.stages.length} trecho${ev.stages.length > 1 ? 's' : ''}`, r.x + 26, r.y + 17, 5, can ? BLUE : GREY);
    ink(c, money(done ? ev.prize / 2 : ev.prize), r.x + r.w - 6, r.y + 5, 5, can ? '#1a6a2a' : GREY, 'right');
    if (done && rematchOpen(cs, ev)) {
      // rival vencido voltou pedindo revanche (opcional, com prêmio): selo piscando
      if (Math.floor(s.t * 2) % 2 === 0) kicker(c, 'REVANCHE!', r.x + r.w - 52, r.y + 15, RED, YELLOW);
      else ink(c, 'REVANCHE!', r.x + r.w - 6, r.y + 17, 5, RED, 'right');
    } else if (done) ink(c, 'VENCIDO ✓', r.x + r.w - 6, r.y + 17, 5, '#1a6a2a', 'right');
    else if (!can) padlock(c, r.x + r.w - 60, r.y + 15); // ao lado do prêmio, sem cobrir o valor
  });
  tag(c, b.collection, 'GARAGEM');
  tag(c, b.garage, 'OFICINA');
  tag(c, b.dealer, 'CONCESSIONÁRIA');
  tag(c, b.back, '◀ VOLTAR');
  toast(c, s);
}

function pickEvent(s: AppState, a: Actions, ei: number) {
  const cs = s.career!;
  if (!eventUnlocked(cs, ui.region, ei)) return flash(s, regionUnlocked(cs, ui.region) ? 'Vença os eventos anteriores primeiro' : 'Região trancada');
  ui.event = ei;
  ui.rematch = rematchOpen(cs, REGIONS[ui.region].events[ei]); // rival vencido pedindo revanche: abre nela
  a.go('event');
}

function tapCareer(s: AppState, a: Actions, x: number, y: number) {
  const b = hubButtons();
  if (inside(x, y, b.prev)) ui.region = (ui.region + REGIONS.length - 1) % REGIONS.length;
  else if (inside(x, y, b.next)) ui.region = (ui.region + 1) % REGIONS.length;
  else if (inside(x, y, b.collection)) a.go('collection');
  else if (inside(x, y, b.garage)) a.go('garage');
  else if (inside(x, y, b.dealer)) openShowroom(s, a, '', 'career');
  else if (inside(x, y, b.back)) a.go('careerMenu');
  else hubRows().forEach((r, i) => inside(x, y, r) && pickEvent(s, a, i));
}

// ---------- evento (antes da corrida) ----------
// normal: na revanche, botão para correr a prova de sempre (sem a revanche)
const eventButtons = () => ({ go: { x: ox() + 216, y: 211, w: 100, h: 15 }, back: { x: ox() + 4, y: 211, w: 100, h: 15 }, normal: { x: ox() + 110, y: 211, w: 100, h: 15 } });
// o evento aberto: o da lista ou a revanche dele
export function eventShown(): CareerEvent {
  const ev = REGIONS[ui.region].events[ui.event];
  return ui.rematch ? rematchEvent(ev) : ev;
}
const ASK = ['Um recado para o leitor?', 'Qual é o plano para hoje?', 'Está confiante?', 'O que acha do novato?', 'Medo de perder?'];

// O ADVERSÁRIO: entrevista curta de revista antes da prova (retrato, ficha, história e a fala dele)
export function drawEvent(c: CanvasRenderingContext2D, s: AppState) {
  const cs = s.career!;
  const reg = REGIONS[ui.region];
  const ev = eventShown();
  const d = ev.driver;
  const p = rivalOf(d);
  const x = ox();
  paper(c);
  topBar(c, s, ui.rematch ? 'REVANCHE' : 'O ADVERSÁRIO', cs);
  const hot = ev.boss || ui.rematch;
  kicker(c, ui.rematch ? 'ELE VOLTOU E QUER REVANCHE' : `${ev.boss ? 'CHEFÃO DA REGIÃO' : reg.name.toUpperCase()} · ${ev.name.toUpperCase()}`, x + 4, 20, hot ? RED : INK, hot ? '#fff' : YELLOW);
  // retrato e ficha: nome, apelido, idade, cidade, estilo e nível
  drawPortrait(c, d, { x: x + 4, y: 33, w: 52, h: 60 });
  headline(c, d.name.toUpperCase(), x + 62, 34, 8, ev.boss ? RED : INK);
  const nick = `"${p.nick.toUpperCase()}"`;
  ink(c, nick, x + 62, 45, 5, RED);
  ink(c, `${typeof p.age === 'number' ? `${p.age} anos` : `idade ${p.age}`} · ${p.city}`, x + 62 + (nick.length + 1) * 5, 45, 5, GREY);
  const [label, col] = STYLE[d.style];
  ink(c, 'ESTILO', x + 62, 54, 5, GREY);
  ink(c, label, x + 98, 54, 5, col);
  const lvl = Math.max(1, Math.min(5, Math.round((d.skill - 0.86) / 0.032)));
  ink(c, 'NÍVEL', x + 190, 54, 5, GREY);
  stars(c, x + 220, 53, lvl, 6);
  wrapLines(c, `${p.bio[0]} ${p.bio[1]}`, SAFE_W - 66, 5).slice(0, 3).forEach((l, i) => ink(c, l, x + 62, 64 + i * 8, 5, INK));
  // a entrevista: a pergunta da revista e a resposta dele (muda a cada tentativa)
  const n = cs.races;
  rule(c, x + 4, 97, SAFE_W - 8, RED);
  ink(c, `REVISTA: ${ui.rematch ? 'Por que a revanche?' : ASK[n % ASK.length]}`, x + 4, 101, 5, GREY);
  text(c, '"', x + 4, 108, 16, RED, 'left', null);
  wrapLines(c, ui.rematch ? p.rematch : preLine(d, n), SAFE_W - 26, 5).slice(0, 2).forEach((l, i) => ink(c, l, x + 20, 111 + i * 8, 5, INK));
  // o carro dele e o roteiro
  const rc = carById(d.car);
  const ph: Rect = { x: x + 4, y: 132, w: 150, h: 46 };
  photo(c, ph, () => drawCarSide(c, ph.x + 6, ph.y + 42, ph.w - 12, rc, d.paint, undefined, undefined, 'rival'));
  ink(c, `O ${rc.name} de ${p.nick}`, ph.x, ph.y + ph.h + 4, 4, GREY);
  ink(c, 'ROTEIRO', x + 162, 131, 5, GREY);
  ev.stages.forEach((st, k) => stageChip(c, x + 162 + k * 42, 139, st));
  ink(c, `${rc.power} · ${Math.round(rc.maxSpeed * KMH)} km/h`, x + 162, 160, 4, INK);
  ink(c, rc.engine.slice(0, 26), x + 162, 168, 4, GREY);
  const done = cs.done.includes(ev.id);
  burst(c, x + 294, 176, 21, ['PRÊMIO', money(done ? ev.prize / 2 : ev.prize)], YELLOW, '#1a6a2a', s.t);
  const np = Object.values(buildOf(cs, cs.car)).filter(Boolean).length;
  if (fits(cs, ui.region)) ink(c, `Seu carro: ${carById(cs.car).name}, classe ${myClass(cs)} (${np ? `${np} peça${np > 1 ? 's' : ''}` : 'original'})`, x + 4, 199, 4, INK);
  else ink(c, `Seu ${carById(cs.car).name} é classe ${myClass(cs)}: aqui só até a classe ${reg.cls}`, x + 4, 199, 4, RED);
  const b = eventButtons();
  tag(c, b.back, '◀ VOLTAR');
  if (ui.rematch) tag(c, b.normal, 'PROVA NORMAL');
  tag(c, b.go, ui.rematch ? 'REVANCHE ▶' : 'CORRER ▶', Math.floor(s.t * 2) % 2 === 0);
  toast(c, s);
}

// largada do evento: só com carro da classe da região ou abaixo
function goEvent(s: AppState, a: Actions) {
  if (!fits(s.career!, ui.region)) return flash(s, noFit(s.career!, ui.region));
  a.startEvent(ui.region, ui.event, ui.rematch);
}
function tapEvent(s: AppState, a: Actions, x: number, y: number) {
  const b = eventButtons();
  if (inside(x, y, b.go)) goEvent(s, a);
  else if (inside(x, y, b.back)) a.go('career');
  else if (ui.rematch && inside(x, y, b.normal)) ui.rematch = false; // a prova de sempre (a revanche fica para depois)
}

// ---------- garagem ----------
const swatchRects = (): Rect[] => PAINTS.map((_, i) => ({ x: ox() + 44 + i * 12, y: 128, w: 10, h: 7 }));
const prepBox = (): Rect => ({ x: ox() + 4, y: 139, w: SAFE_W - 8, h: 55 });
// ajustes de graça: relação de marchas, suspensão e rodas (toque para trocar)
const setupTags = () => [0, 1, 2].map((i): Rect => ({ x: ox() + 4 + i * 105, y: 196, w: 102, h: 12 }));
const garageButtons = () => {
  const x = ox();
  return {
    prev: { x: x + 4, y: 70, w: 12, h: 28 }, next: { x: x + 190, y: 70, w: 12, h: 28 },
    use: { x: x + 110, y: 211, w: 100, h: 15 }, back: { x: x + 4, y: 211, w: 100, h: 15 }, dealer: { x: x + 216, y: 211, w: 100, h: 15 },
  };
};
// itens da oficina que as setas percorrem (em 2D): a preparação, os 3 ajustes, usar,
// classificados, voltar, a paleta de pintura e as setas de trocar de carro
const paletteRect = (): Rect => {
  const sw = swatchRects();
  return { x: sw[0].x - 2, y: sw[0].y - 2, w: sw[sw.length - 1].x + sw[0].w - sw[0].x + 4, h: sw[0].h + 4 };
};
const garageFocusRects = (): Rect[] => {
  const b = garageButtons();
  return [prepBox(), ...setupTags(), b.use, b.dealer, b.back, paletteRect(), b.prev, b.next];
};
const ownedCars = (cs: CareerSave) => CARS.filter((c) => cs.owned.includes(c.id));

// carro com melhorias, guardado por nível (o índice de desempenho é medido uma vez)
const tunedCache = new Map<string, CarSpec>();
// carreira em uso (os defeitos do carro usado entram na ficha de qualquer tela)
let curCareer: CareerSave | null = null;
function tunedFor(car: CarSpec, lv: Record<Upgrade, number>, st: Setup = DEFAULT_SETUP, build?: Build, wear = wearOf(curCareer, car.id)) {
  const key = `${car.id}:${lv.motor}${lv.cambio}${lv.pneus}:${st.ratio}${st.susp}${st.rims}:${buildKey(build)}:${wear.join()}`;
  let t = tunedCache.get(key);
  if (!t) tunedCache.set(key, (t = tunedCar(car, lv, st, build, wear)));
  return t;
}

export function drawGarage(c: CanvasRenderingContext2D, s: AppState) {
  const cs = s.career!;
  const x = ox();
  paper(c);
  topBar(c, s, 'OFICINA DO LEITOR', cs);
  const cars = ownedCars(cs);
  ui.garage = Math.min(ui.garage, cars.length - 1);
  const car = cars[ui.garage]!;
  const active = car.id === cs.car;
  const st = setupOf(cs, car.id);
  if (ui.prep) return drawPrep(c, s, car);
  // escolhendo a cor das rodas: a foto já mostra a cor em vista
  const tuned = tunedFor(car, levels(cs, car.id), ui.rimPick ? { ...st, rims: ui.rimView } : st, buildOf(cs, car.id));
  kicker(c, active ? 'EM USO' : `${ui.garage + 1} DE ${cars.length} NA GARAGEM`, x + 4, 20, active ? '#1a6a2a' : INK, '#fff');
  headline(c, car.name.toUpperCase(), x + 4, 33, 8, INK);
  // classe com as melhorias instaladas (as melhorias podem subir o carro de classe)
  classBadge(c, x + 150, 32, tuned, true, 9);
  const ph: Rect = { x: x + 4, y: 46, w: 198, h: 74 };
  photo(c, ph, () => {
    // troca de carro animada: o que está sai acelerando e o outro chega (cada um com o seu ronco)
    const sw = carSwap('garage', car, s.t);
    const shown = sw.car.id === car.id ? tuned : tunedFor(sw.car, levels(cs, sw.car.id), setupOf(cs, sw.car.id), buildOf(cs, sw.car.id));
    const spin = sw.roll ? (sw.roll * ph.w) / (0.058 * 182) : undefined;
    // carro usado: riscos, amassados, trinca e fumaça dos defeitos ainda não consertados
    const wear = wearOf(cs, sw.car.id);
    if (wear.length) drawUsedSide(c, ph.x + 8 + sw.dx * ph.w, ph.y + 68, 182, shown, paintHex(sw.car.id), wear, s.t, spin);
    else drawCarSide(c, ph.x + 8 + sw.dx * ph.w, ph.y + 68, 182, shown, paintHex(sw.car.id), spin);
  }, ['#4a4238', '#a89a86']);
  drawFixTag(c, cs, car);
  const b = garageButtons();
  if (cars.length > 1) {
    arrow(c, b.prev, 'left');
    arrow(c, b.next, 'right');
  }
  const fr: Rect = { x: x + 208, y: 43, w: 108, h: 80 };
  box(c, fr, 'COM AS PEÇAS');
  specRows(c, fr, [['Potência', `${Math.round((parseInt(car.power) * tunedFor(car, levels(cs, car.id), DEFAULT_SETUP, buildOf(cs, car.id)).accel) / car.accel)} cv`] /* a relação de marchas não muda a potência */, ['0-100', `${(accelCurve(tuned, 30).t100 || tuned.zeroTo100).toFixed(1).replace('.', ',')} s`], ['Máxima', `${Math.round(tuned.maxSpeed * KMH)} km/h`], ['Curva', `${tuned.lateralG.toFixed(2).replace('.', ',')} g`], ['Revenda', money(sellValue(car, cs))]], 12, 15);
  ink(c, 'PINTURA', x + 4, 129, 5, GREY);
  const cur = paintIdx(car.id) ?? nearestPaint(car.color);
  swatchRects().forEach((r, i) => {
    c.fillStyle = i === cur ? RED : INK;
    c.fillRect(r.x - 1, r.y - 1, r.w + 2, r.h + 2);
    c.fillStyle = PAINTS[i].hex;
    c.fillRect(r.x, r.y, r.w, r.h);
  });
  // peças instaladas (preparação): resumo; tocar abre o catálogo
  if (ui.rimPick) {
    drawRimPick(c);
    toast(c, s, 141);
    return;
  }
  if (pg.fix) {
    drawFixPanel(c, s, car);
    toast(c, s, 100);
    return;
  }
  const pb = prepBox();
  c.fillStyle = '#f6efdd';
  c.fillRect(pb.x, pb.y, pb.w, pb.h);
  c.strokeStyle = 'rgba(26,22,20,0.35)';
  c.lineWidth = 1;
  c.strokeRect(pb.x + 0.5, pb.y + 0.5, pb.w - 1, pb.h - 1);
  ink(c, 'PREPARAÇÃO', pb.x + 5, pb.y + 3, 5, RED);
  ink(c, 'toque para abrir o catálogo de peças', pb.x + pb.w - 5, pb.y + 3, 4, GREY, 'right');
  const sum = slotsFor(car, buildOf(cs, car.id));
  const pitch = sum.length > 10 ? 43 / Math.ceil(sum.length / 2) : 8.6;
  sum.forEach((sl, i) => {
    const pt = partOf(car, sl.id, buildOf(cs, car.id)[sl.id]);
    const cx = pb.x + 5 + (i % 2) * 156, cy = Math.round(pb.y + 11 + Math.floor(i / 2) * pitch);
    const fs = sum.length > 10 ? 4 : 5;
    ink(c, `${sl.id === 'bancos' ? 'Peso' : sl.id === 'pistoes' ? 'Pistões' : sl.id === 'pressao' ? 'Pressão' : sl.id === 'largada' ? 'Largada' : sl.name}:`, cx, cy, fs, GREY); // nomes longos não cabem na coluna
    ink(c, pt.name.replace(/ \(.*\)$/, ''), cx + 62, cy, fs, pt.id ? RED : INK); // (sem o parêntese: "Sem restrições (corrida)" invadia a outra coluna)
  });
  const nParts = Object.values(buildOf(cs, car.id)).filter(Boolean).length;
  const lab = [`MARCHAS ${RATIO_LABEL[st.ratio + 1]}`, nParts ? `PREPARAÇÃO (${nParts}) ▶` : 'PREPARAÇÃO ▶', 'COR DAS RODAS ▶'];
  setupTags().forEach((r, i) => {
    const changed = i === 0 ? st.ratio !== 0 : i === 1 ? nParts > 0 : !!st.rims;
    c.fillStyle = changed ? '#fff1c8' : '#f6efdd';
    c.fillRect(r.x, r.y, r.w, r.h);
    c.strokeStyle = changed ? RED : 'rgba(26,22,20,0.35)';
    c.lineWidth = 1;
    c.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1);
    ink(c, lab[i], r.x + r.w / 2, r.y + 3.5, 5, changed ? RED : INK, 'center');
  });
  tag(c, b.back, '◀ VOLTAR');
  tag(c, b.use, active ? 'EM USO' : 'USAR ESTE', !active);
  tag(c, b.dealer, 'CLASSIFICADOS ▶');
  // teclado: o item escolhido com as setas fica marcado
  const kf = garageFocusRects()[ui.gFocus % garageFocusRects().length];
  if (kf && lastDevice.kind !== 'touch') focusRing(c, kf);
  toast(c, s, 141);
}

// ---- cor das rodas (de graça): painel com as cores, a foto mostra a escolhida ----
const RIM_IDS = () => ['', ...Object.keys(RIMS)];
const rimLabel = (id: string) => (id ? RIMS[id].label : 'ORIGINAIS');
const rimChips = (): Rect[] => RIM_IDS().map((_, i, all) => {
  const w = Math.floor((SAFE_W - 8 - (all.length - 1) * 4) / all.length);
  return { x: ox() + 4 + i * (w + 4), y: 160, w, h: 22 };
});
const rimButtons = () => ({ back: { x: ox() + 4, y: 211, w: 100, h: 15 } as Rect, ok: { x: ox() + 216, y: 211, w: 100, h: 15 } as Rect });
function drawRimPick(c: CanvasRenderingContext2D) {
  const x = ox(), pb = prepBox();
  c.fillStyle = '#f6efdd';
  c.fillRect(pb.x, pb.y, pb.w, 88);
  ink(c, 'COR DAS RODAS', x + 9, 143, 5, RED);
  ink(c, 'escolha e confirme (sem custo)', x + SAFE_W - 9, 143, 4, GREY, 'right');
  rimChips().forEach((r, i) => {
    const id = RIM_IDS()[i], on = id === ui.rimView;
    c.fillStyle = on ? '#fff1c8' : '#efe6d2';
    c.fillRect(r.x, r.y, r.w, r.h);
    c.strokeStyle = on ? RED : 'rgba(26,22,20,0.35)';
    c.lineWidth = on ? 2 : 1;
    c.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1);
    // amostra da cor (as originais: aro de alumínio)
    c.fillStyle = id ? RIMS[id].color : '#c8ccd2';
    c.beginPath();
    c.arc(r.x + 9, r.y + r.h / 2, 5, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#1a1614';
    c.beginPath();
    c.arc(r.x + 9, r.y + r.h / 2, 1.5, 0, Math.PI * 2);
    c.fill();
    ink(c, rimLabel(id), r.x + 18, r.y + 8, 5, on ? RED : INK);
  });
  const b = rimButtons();
  tag(c, b.back, '◀ VOLTAR');
  tag(c, b.ok, 'USAR ESTA COR', true);
}
function rimStep(d: number) {
  const ids = RIM_IDS();
  ui.rimView = ids[(ids.indexOf(ui.rimView) + d + ids.length) % ids.length];
}
function rimConfirm(s: AppState) {
  const cs = s.career!, car = ownedCars(cs)[ui.garage];
  const st = setupOf(cs, car.id);
  cs.setup = { ...(cs.setup ?? {}), [car.id]: { ...st, rims: ui.rimView } };
  saveCareer(cs);
  ui.rimPick = false;
  flash(s, `Rodas ${rimLabel(ui.rimView).toLowerCase()}`);
}

function tapGarage(s: AppState, a: Actions, x: number, y: number) {
  const cs = s.career!;
  const cars = ownedCars(cs);
  const car = cars[ui.garage];
  if (ui.prep) return tapPrep(s, car, x, y);
  if (pg.fix) return tapFix(s, car, x, y);
  if (wearOf(cs, car.id).length && !ui.rimPick && inside(x, y, fixTag())) {
    pg.fix = true; // painel de consertos do usado
    pg.fixRow = 0;
    return;
  }
  if (ui.rimPick) {
    const rb = rimButtons();
    if (inside(x, y, rb.back)) ui.rimPick = false;
    else if (inside(x, y, rb.ok)) rimConfirm(s);
    else rimChips().forEach((r, i) => inside(x, y, r) && (ui.rimView = RIM_IDS()[i]));
    return;
  }
  const b = garageButtons();
  if (inside(x, y, b.prev) && cars.length > 1) ui.garage = (ui.garage + cars.length - 1) % cars.length;
  else if (inside(x, y, b.next) && cars.length > 1) ui.garage = (ui.garage + 1) % cars.length;
  else if (inside(x, y, b.back)) a.go('career');
  else if (inside(x, y, b.dealer)) openShowroom(s, a, '', 'garage');
  else if (inside(x, y, b.use)) {
    cs.car = car.id;
    saveCareer(cs);
    flash(s, `${car.name} pronto para correr`);
  } else {
    swatchRects().forEach((r, i) => inside(x, y, { x: r.x - 2, y: r.y - 6, w: r.w + 4, h: r.h + 12 }) && setPaint(car.id, i));
    setupTags().forEach((r, i) => {
      if (!inside(x, y, r)) return;
      const st = setupOf(cs, car.id);
      const rims = ['', ...Object.keys(RIMS)];
      if (i === 1) return openPrep(cs, car);
      // cor das rodas: abre o painel de cores (escolhe vendo na foto e confirma)
      if (i === 2) {
        ui.rimPick = true;
        ui.rimView = st.rims;
        return;
      }
      if (i === 0) st.ratio = st.ratio >= 1 ? -1 : st.ratio + 1;
      else st.rims = rims[(rims.indexOf(st.rims) + 1) % rims.length];
      cs.setup = { ...(cs.setup ?? {}), [car.id]: st };
      saveCareer(cs);
      flash(s, i === 0 ? `Relação ${RATIO_LABEL[st.ratio + 1].toLowerCase()}` : i === 1 ? `Suspensão ${SUSP_LABEL[st.susp].toLowerCase()}` : `Rodas ${st.rims ? RIMS[st.rims].label.toLowerCase() : 'originais'}`);
    });
    if (inside(x, y, prepBox())) openPrep(cs, car);
  }
}

// ---------- preparação: peças aftermarket (tuning.ts) ----------
// Cada linha é uma vaga (pistões, comando, alimentação, indução, escapamento, pneus, suspensão); as
// setas trocam a peça em vista (a foto, a ficha e o ronco já mostram como fica) e o botão compra/instala.
// toque: as vagas são cartões grandes em duas colunas (tocar escolhe a vaga); a peça da vaga escolhida
// troca numa barra só, com setas e botão de comprar grandes
// (até 10 vagas: 2 colunas; com as vagas do turbo/supercharger: 3 colunas, na mesma altura de toque)
const prepRows = (n: number) => {
  const cols = n > 10 ? 3 : 2, cw = (312 - (cols - 1) * 4) / cols;
  return Array.from({ length: n }, (_, i): Rect => ({ x: ox() + 4 + (i % cols) * (cw + 4), y: 121 + Math.floor(i / cols) * 17.6, w: cw, h: 16.2 }));
};
// vagas da tela: as do carro com as peças em vista (escolher turbo já mostra turbina, intercooler...)
const prepSlots = (car: CarSpec) => slotsFor(car, ui.prepView);
const prepSel = (car: CarSpec) => { const sl = prepSlots(car); ui.prepRow = Math.min(ui.prepRow, sl.length - 1); return sl; };
const prepBar = () => {
  const x = ox();
  return { prev: { x: x + 4, y: 97, w: 30, h: 21 } as Rect, next: { x: x + 172, y: 97, w: 30, h: 21 } as Rect, name: { x: x + 36, y: 97, w: 134, h: 21 } as Rect, buy: { x: x + 206, y: 97, w: 110, h: 21 } as Rect };
};
const prepButtons = () => {
  const x = ox();
  return { back: { x: x + 4, y: 211, w: 100, h: 15 }, rev: { x: x + 110, y: 211, w: 100, h: 15 }, stock: { x: x + 216, y: 211, w: 100, h: 15 } };
};
function openPrep(cs: CareerSave, car: CarSpec) {
  // suspensão do ajuste antigo (de graça) vira a peça equivalente, já comprada
  const st = setupOf(cs, car.id);
  if (st.susp > 0 && !buildOf(cs, car.id).suspensao) {
    const id = ['', 'esportiva', 'corrida'][st.susp];
    cs.builds = { ...(cs.builds ?? {}), [car.id]: { ...buildOf(cs, car.id), suspensao: id } };
    cs.parts = { ...(cs.parts ?? {}), [car.id]: [...(cs.parts?.[car.id] ?? []), `suspensao:${id}`] };
    cs.setup = { ...(cs.setup ?? {}), [car.id]: { ...st, susp: 0 } };
    saveCareer(cs);
  }
  ui.demo = ''; // oficina da carreira: compra e instala de verdade (nunca o modo catálogo)
  ui.arc = '';
  ui.prep = true;
  ui.prepRow = 0;
  ui.prepView = { ...buildOf(cs, car.id) };
}
// preparação na carreira: o próximo carro da garagem
function prepSwap(s: AppState) {
  const cs = s.career!, cars = ownedCars(cs);
  if (cars.length < 2) return;
  ui.revT0 = -9;
  setEngine(0, false, false);
  ui.garage = (ui.garage + 1) % cars.length;
  openPrep(cs, cars[ui.garage]);
}
// wastegate / boost controller: comprado uma vez, qualquer pressão depois é só regular
const ownsPart = (cs: CareerSave, car: CarSpec, slot: SlotId, id: string) => !id || (cs.parts?.[car.id] ?? []).some((k) => k === `${slot}:${id}` || ((slot === 'pressao' || slot === 'largada') && k.startsWith(`${slot}:`)));

// o que vale na tela de preparação: na carreira, os ajustes e defeitos do carro e as peças instaladas;
// no Arcade, o carro de fábrica e as peças da oficina do Arcade; no catálogo, nada instalado
const ZERO_LV: Record<Upgrade, number> = { motor: 0, cambio: 0, pneus: 0 };
function prepCtx(s: AppState, car: CarSpec) {
  const cs = s.career;
  if (ui.arc || !cs) return { lv: ZERO_LV, st: DEFAULT_SETUP, cur: ui.arc ? arcadeBuildOf(car.id) : {}, wear: [] as Defect[] };
  return { lv: levels(cs, car.id), st: setupOf(cs, car.id), cur: ui.demo ? {} : buildOf(cs, car.id), wear: wearOf(cs, car.id) };
}
function drawPrep(c: CanvasRenderingContext2D, s: AppState, car: CarSpec) {
  const cs = s.career;
  const x = ox();
  const { lv, st, cur, wear } = prepCtx(s, car);
  const tf = (b: Build, set: Setup = st) => tunedFor(car, lv, set, b, wear);
  const now = tf(cur), view = tf(ui.prepView);
  kicker(c, ui.arc ? 'ARCADE' : ui.demo ? 'CATÁLOGO' : 'PREPARAÇÃO', x + 4, 20, RED, '#fff');
  // título na linha do selo: a foto ganha a altura para a lateral grande
  headline(c, car.name.toUpperCase(), x + (ui.arc ? 46 : 62), 21, 6, INK);
  classBadge(c, x + (ui.arc ? 46 : 62) + car.name.length * 6 + 6, 20, view, true, 8);
  const ph: Rect = { x: x + 4, y: 35, w: 198, h: 59 };
  photo(c, ph, () => {
    // só a lateral, grande (altura, rodas e o que mais vier aparecem melhor)
    drawCarSide(c, ph.x + 4, ph.y + 56, 190, view, paintHex(car.id));
  }, ['#4a4238', '#a89a86']);
  const fr: Rect = { x: x + 208, y: 43, w: 108, h: 51 };
  box(c, fr, 'COMO FICA');
  // potência pela razão com a ficha (o 'accel' de alguns carros já vem ajustado); 0-100 medido na física
  const cv = (b: Build) => Math.round((parseInt(car.power) * tf(b, DEFAULT_SETUP).accel) / car.accel);
  const t100 = (t: CarSpec) => accelCurve(t, 30).t100 || t.zeroTo100;
  const diff = (a: number, b: number, unit: string, dec = 0) => {
    const d = a - b;
    const txt = `${a.toFixed(dec).replace('.', ',')} ${unit}`;
    return Math.abs(d) < 10 ** -dec / 2 ? txt : `${txt} (${d > 0 ? '+' : '-'}${Math.abs(d).toFixed(dec).replace('.', ',')})`;
  };
  const slots = prepSel(car);
  // turbo do kit com a vaga do turbo escolhida: a última linha mostra a pressão e a temperatura no lugar da curva
  const bi = boostInfo(car, ui.prepView);
  const turboRow = bi && ['inducao', 'turbina', 'intercooler', 'downpipe', 'pressao'].includes(slots[ui.prepRow]?.id ?? '');
  specRows(c, fr, [
    ['Pot.', diff(cv(ui.prepView), cv(cur), 'cv')], ['0-100', diff(t100(view), t100(now), 's', 1)],
    ['Máx.', diff(Math.round(view.maxSpeed * KMH), Math.round(now.maxSpeed * KMH), 'km/h')],
    turboRow ? ['Turbo', `${fmtBar(bi.bar)} bar ${heatWord(bi.eq)}`] : ['Curva', diff(view.lateralG, now.lateralG, 'g', 2)],
  ], 9, 14);
  prepRows(slots.length).forEach((r, i) => {
    const sl = slots[i];
    const vp = partOf(car, sl.id, ui.prepView[sl.id]), installed = (cur[sl.id] ?? '') === vp.id;
    const hot = ui.prepRow === i;
    c.fillStyle = hot ? INK : installed ? '#f6efdd' : '#fff1c8';
    c.fillRect(r.x, r.y, r.w, r.h);
    c.strokeStyle = hot ? RED : 'rgba(26,22,20,0.35)';
    c.lineWidth = hot ? 2 : 1;
    c.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1);
    ink(c, sl.name.toUpperCase(), r.x + 4, r.y + 2, 4, hot ? YELLOW : GREY);
    ink(c, vp.name, r.x + 4, r.y + 8.5, vp.name.length * 5.6 > r.w - 8 ? 4 : 5, hot ? '#fff' : vp.id ? RED : INK);
    // nome de vaga comprido (BOOST CONTROLLER): o aviso desce para a linha da peça, à direita
    const low = sl.name.length * 4 + 44 > r.w;
    if (!installed) ink(c, 'EM VISTA', r.x + r.w - 4, r.y + (low ? 10 : 2), 4, hot ? YELLOW : RED, 'right');
  });
  // barra da vaga escolhida: ◀ peça ▶ e o botão de comprar/instalar
  {
    const pb = prepBar(), sl = slots[ui.prepRow];
    const vp = partOf(car, sl.id, ui.prepView[sl.id]), installed = (cur[sl.id] ?? '') === vp.id;
    arrow(c, pb.prev, 'left');
    arrow(c, pb.next, 'right');
    c.fillStyle = '#f8f2e2';
    c.fillRect(pb.name.x, pb.name.y, pb.name.w, pb.name.h);
    c.strokeStyle = INK;
    c.lineWidth = 1;
    c.strokeRect(pb.name.x + 0.5, pb.name.y + 0.5, pb.name.w - 1, pb.name.h - 1);
    const n = sl.parts.findIndex((q) => q.id === vp.id);
    // ilustração da peça (ou a roda) no canto da barra; a foto fica toda para a lateral do carro
    const art = vp.wheel ? wheelPng(vp.wheel) : partPng(slotArt(car, sl.id) ?? '');
    const ai = art && svgSprite(art, 19 * RES, 19 * RES);
    if (ai) {
      c.fillStyle = '#14110f';
      c.fillRect(pb.name.x + 1, pb.name.y + 1, 19, 19);
      c.drawImage(ai, pb.name.x + 1, pb.name.y + 1, 19, 19);
    }
    const tx = art ? pb.name.x + 20 + (pb.name.w - 20) / 2 : pb.name.x + pb.name.w / 2;
    // pressão: o efeito depende da turbina e do intercooler em vista (potência sobre a da turbina e o calor)
    const pn = sl.id === 'pressao' && vp.id && bi ? `${bi.power >= 1 ? '+' : '-'}${Math.abs(Math.round((bi.power - 1) * 100))}% cv, calor ${heatWord(bi.eq)}` : vp.note;
    ink(c, vp.id && sl.id !== 'rodas' ? `${n + 1}/${sl.parts.length} · ${pn}` : `${sl.name.toUpperCase()} ${n + 1}/${sl.parts.length}`, tx, pb.name.y + 3, 4, GREY, 'center');
    ink(c, vp.name, tx, pb.name.y + 10, vp.name.length > 18 ? 5 : 6, vp.id ? RED : INK, 'center');
    const cost = partCost(car, vp);
    if (ui.arc) tag(c, pb.buy, installed ? 'INSTALADA' : vp.id ? 'INSTALAR GRÁTIS' : 'VOLTAR AO ORIGINAL', !installed); // Arcade: sem dinheiro
    else if (ui.demo || !cs) tag(c, pb.buy, vp.id ? `NA CARREIRA ${money(cost)}` : 'DE FÁBRICA'); // catálogo: só mostra o preço
    else {
      const own = ownsPart(cs, car, sl.id, vp.id);
      tag(c, pb.buy, installed ? 'INSTALADA' : own ? 'INSTALAR' : `COMPRAR ${money(cost)}`, !installed && (own || cs.money >= cost));
    }
  }
  const b = prepButtons();
  tag(c, b.back, ui.demo || ui.arc ? '◀ VOLTAR' : '◀ OFICINA');
  tag(c, b.rev, 'OUVIR O RONCO'); // (sem o vermelho fixo: parecia o item escolhido; o foco é o contorno amarelo)
  // catálogo: passa pelos carros do showroom; carreira: troca entre os carros da garagem (só se houver outro)
  if (ui.demo || ui.arc) tag(c, b.stock, 'OUTRO CARRO ▶');
  else if (cs && ownedCars(cs).length > 1) tag(c, b.stock, 'TROCAR CARRO ▶');
  // ronco de teste: partida e duas aceleradas com as peças em vista
  const t = s.t - ui.revT0;
  if (t >= 0 && t < 2.6) {
    if (t > 0.42) setEngine(0.1 + 0.7 * Math.max(0, Math.sin((t - 0.42) * 2.9)) ** 0.7, Math.sin((t - 0.42) * 2.9) > 0.15 && Math.cos((t - 0.42) * 2.9) > -0.2, true, view.soundMods?.turbo ? 0.8 * Math.max(0, Math.sin((t - 0.42) * 2.9)) : 0);
  } else if (ui.revT0 > 0) {
    ui.revT0 = -9;
    setEngine(0, false, false);
  }
  toast(c, s);
}

function prepStep(car: CarSpec, slot: SlotId, d: number) {
  const parts = slotsFor(car).find((sl) => sl.id === slot)!.parts;
  const i = parts.findIndex((p) => p.id === (ui.prepView[slot] ?? ''));
  ui.prepView = { ...ui.prepView, [slot]: parts[(i + d + parts.length) % parts.length].id };
}
function prepInstall(s: AppState, car: CarSpec, slot: SlotId) {
  if (ui.arc) {
    // Arcade: instala de graça, nas preparações do Arcade (a carreira não muda)
    const p = partOf(car, slot, ui.prepView[slot]), cur = arcadeBuildOf(car.id);
    if ((cur[slot] ?? '') === p.id) return flash(s, 'Já está instalada');
    if (!slotsFor(car, cur).some((sl) => sl.id === slot)) return flash(s, ui.prepView.inducao === 'super' ? 'Instale o supercharger primeiro' : 'Instale o turbo primeiro');
    setArcadePart(car.id, slot, p.id);
    return flash(s, p.id ? partInstalledMsg(car, slot, p) : 'Peça original de volta');
  }
  const cs = s.career!;
  if (ui.demo) return flash(s, 'Catálogo: compre e instale na oficina da carreira');
  const p = partOf(car, slot, ui.prepView[slot]);
  if ((buildOf(cs, car.id)[slot] ?? '') === p.id) return flash(s, 'Já está instalada');
  // turbina, polia, intercooler e downpipe só entram com o turbo/supercharger já instalado
  if (!slotsFor(car, buildOf(cs, car.id)).some((sl) => sl.id === slot)) return flash(s, ui.prepView.inducao === 'super' ? 'Instale o supercharger primeiro' : 'Instale o turbo primeiro');
  if (!ownsPart(cs, car, slot, p.id)) {
    const cost = partCost(car, p);
    if (cs.money < cost) return flash(s, `Falta ${money(cost - cs.money)}`);
    cs.money -= cost;
    spend(cs, cost);
    cs.parts = { ...(cs.parts ?? {}), [car.id]: [...(cs.parts?.[car.id] ?? []), `${slot}:${p.id}`] };
  }
  cs.builds = { ...(cs.builds ?? {}), [car.id]: { ...buildOf(cs, car.id), [slot]: p.id } };
  saveCareer(cs);
  flash(s, p.id ? partInstalledMsg(car, slot, p) : 'Peça original de volta');
}
function prepRev(s: AppState, car: CarSpec) {
  const { lv, st, wear } = prepCtx(s, car);
  const view = tunedFor(car, lv, st, ui.prepView, wear);
  setEngineProfile(view.engine, car.id, view.soundMods);
  starterSound();
  ui.revT0 = s.t;
}
function closePrep() {
  ui.prep = false;
  ui.revT0 = -9;
  setEngine(0, false, false);
}
function tapPrep(s: AppState, car: CarSpec, x: number, y: number) {
  const b = prepButtons();
  if (inside(x, y, b.back)) return closePrep();
  if (inside(x, y, b.rev)) return prepRev(s, car);
  if (inside(x, y, b.stock)) return prepSwap(s);
  const slots = prepSel(car), pb = prepBar();
  if (inside(x, y, pb.prev)) return prepStep(car, slots[ui.prepRow].id, -1);
  if (inside(x, y, pb.next) || inside(x, y, pb.name)) return prepStep(car, slots[ui.prepRow].id, 1);
  if (inside(x, y, pb.buy)) return prepInstall(s, car, slots[ui.prepRow].id);
  prepRows(slots.length).forEach((r, i) => {
    if (inside(x, y, { x: r.x - 2, y: r.y - 0.7, w: r.w + 4, h: r.h + 1.4 })) ui.prepRow = i;
  });
}

function keyPrep(s: AppState, k: MenuKey) {
  const car = ui.arc ? arcCar() : ui.demo ? demoCar() : ownedCars(s.career!)[ui.garage];
  const slots = prepSel(car);
  if (k === 'back') return closePrep();
  if (k === 'up') ui.prepRow = (ui.prepRow + slots.length - 1) % slots.length;
  if (k === 'down') ui.prepRow = (ui.prepRow + 1) % slots.length;
  if (k === 'left') prepStep(car, slots[ui.prepRow].id, -1);
  if (k === 'right') prepStep(car, slots[ui.prepRow].id, 1);
  if (k === 'ok') prepInstall(s, car, slots[ui.prepRow].id);
}

// ---------- catálogo: a oficina de preparação fora da carreira ----------
// Qualquer carro do showroom, todas as peças em vista (ficha, lateral, ronco e preço), sem comprar.
// Entradas: capas de peças da revista e o botão PREPARAÇÃO do anúncio no showroom.
const demoCars = () => DEALER_CARS.filter((k) => !k.pendingArt);
const demoCar = () => demoCars().find((k) => k.id === ui.demo) ?? demoCars()[0];
export function openPrepDemo(s: AppState, a: Actions, carId = '', back: ScreenId = 'title') {
  if (!s.career) {
    s.career = newCareer();
    saveCareer(s.career);
  }
  // carro que já é seu: a oficina de verdade, na garagem da carreira (compra e instala)
  const mine = ownedCars(s.career).findIndex((k) => k.id === carId);
  if (mine >= 0) {
    ui.garage = mine;
    a.go('garage');
    openPrep(s.career, ownedCars(s.career)[mine]);
    return;
  }
  const list = demoCars();
  ui.demo = (list.find((k) => k.id === carId) ?? list.find((k) => k.id === 'br-golgti') ?? list[0]).id;
  ui.demoBack = back;
  ui.arc = '';
  ui.prep = true;
  ui.prepRow = 0;
  ui.prepView = {};
  a.go('prepDemo');
}
function demoStep(d: number) {
  const list = demoCars(), i = list.findIndex((k) => k.id === ui.demo);
  ui.demo = list[(i + d + list.length) % list.length].id;
  ui.prepRow = 0;
  ui.prepView = {};
  ui.revT0 = -9;
  setEngine(0, false, false);
}
function closeDemo(a: Actions) {
  const back = ui.demoBack;
  closePrep();
  ui.demo = '';
  a.go(back);
}
function drawPrepDemo(c: CanvasRenderingContext2D, s: AppState) {
  paper(c);
  topBar(c, s, 'OFICINA DE PREPARAÇÃO', s.career!);
  drawPrep(c, s, demoCar());
}
function tapPrepDemo(s: AppState, a: Actions, x: number, y: number) {
  const b = prepButtons();
  if (inside(x, y, b.back)) return closeDemo(a);
  if (inside(x, y, b.stock)) return demoStep(1);
  // tocar na foto também troca de carro (metade esquerda volta, direita avança)
  const ph: Rect = { x: ox() + 4, y: 35, w: 198, h: 59 };
  if (inside(x, y, ph)) return demoStep(x < ph.x + ph.w / 2 ? -1 : 1);
  tapPrep(s, demoCar(), x, y);
}

// ---------- Arcade: CORRER ou OFICINA ----------
// CORRER: o fluxo de sempre (carro, rival, roteiro), com as peças da oficina do Arcade em cada carro.
// OFICINA: a tela de preparação com qualquer carro do Arcade; sem dinheiro, instalar é de graça.
const arcCar = () => CARS.find((k) => k.id === ui.arc) ?? CARS[0];
const arcTiles = () => careerTiles();
const arcBack = () => careerMenuBack();
function arcPick(s: AppState, a: Actions, i: number) {
  if (i === 0) return a.go('car');
  openArcadePrep(s, a);
}
function drawArcadeMenu(c: CanvasRenderingContext2D, s: AppState) {
  const x = ox();
  paper(c);
  masthead(c, 'ARCADE');
  kicker(c, 'MODO ARCADE', x + 4, 20, RED, '#fff');
  const [run, shop] = arcTiles();
  const frame = (r: Rect, hot: boolean) => {
    c.fillStyle = hot ? RED : INK;
    c.fillRect(r.x - 1, r.y - 1, r.w + 2, r.h + 2);
    c.fillStyle = '#f8f2e2';
    c.fillRect(r.x, r.y, r.w, r.h);
  };
  const hot = (i: number) => lastDevice.kind !== 'touch' && s.sel % 2 === i;
  const cur = CARS[s.carIdx] ?? CARS[0];
  // correr: o último carro escolhido, já com as peças da oficina do Arcade
  frame(run, hot(0));
  const ph: Rect = { x: run.x + 4, y: run.y + 4, w: run.w - 8, h: 92 };
  photo(c, ph, () => drawCarSide(c, ph.x + 6, ph.y + 84, ph.w - 12, arcadeTuned(cur), paintHex(cur.id)), ['#3a5a8a', '#c8b89a']);
  if (arcadePrepped(cur.id)) kicker(c, 'PREPARADO', ph.x + 2, ph.y + 2, RED, YELLOW);
  headline(c, 'CORRER', run.x + 6, run.y + 102, 16, INK);
  ink(c, 'Carro, rival e roteiro', run.x + 6, run.y + 124, 5, GREY);
  ink(c, 'Cada carro com as suas peças', run.x + 6, run.y + 134, 5, GREY);
  tag(c, { x: run.x + 6, y: run.y + run.h - 20, w: run.w - 12, h: 15 }, 'ESCOLHER CARRO ▶', hot(0));
  // oficina: até três carros já preparados (ou o carro escolhido, se nenhum foi mexido)
  frame(shop, hot(1));
  const gp: Rect = { x: shop.x + 4, y: shop.y + 4, w: shop.w - 8, h: 92 };
  const prepped = CARS.filter((k) => arcadePrepped(k.id));
  photo(c, gp, () => {
    const show = prepped.length ? prepped.slice(0, 3) : [cur];
    const ys = [[84], [50, 84], [36, 60, 84]][Math.max(0, show.length - 1)];
    show.forEach((cc, i) => drawCarSide(c, gp.x + 6 + (i % 2) * 8, gp.y + ys[i], show.length > 1 ? gp.w - 30 : gp.w - 12, arcadeTuned(cc), paintHex(cc.id)));
  }, ['#4a4238', '#a89a86']);
  kicker(c, 'GRÁTIS', gp.x + 2, gp.y + 2, '#1a6a2a', '#fff');
  headline(c, 'OFICINA', shop.x + 6, shop.y + 102, 16, INK);
  ink(c, prepped.length ? `${prepped.length} carro${prepped.length === 1 ? '' : 's'} preparado${prepped.length === 1 ? '' : 's'}` : 'Nenhum carro preparado', shop.x + 6, shop.y + 124, 5, GREY);
  ink(c, 'Peças de graça, sem dinheiro', shop.x + 6, shop.y + 134, 5, GREY);
  tag(c, { x: shop.x + 6, y: shop.y + shop.h - 20, w: shop.w - 12, h: 15 }, 'PREPARAR CARRO ▶', hot(1));
  tag(c, arcBack(), '◀ CAPA');
}
function tapArcadeMenu(s: AppState, a: Actions, x: number, y: number) {
  if (inside(x, y, arcBack())) return a.go('title');
  arcTiles().forEach((r, i) => inside(x, y, r) && arcPick(s, a, i));
}
export function openArcadePrep(s: AppState, a: Actions, carId = (CARS[s.carIdx] ?? CARS[0]).id) {
  a.go('arcadePrep');
  ui.demo = '';
  ui.arc = carId;
  ui.prep = true;
  ui.prepRow = 0;
  ui.prepView = { ...arcadeBuildOf(carId) };
}
function arcStep(d: number) {
  const i = Math.max(0, CARS.findIndex((k) => k.id === ui.arc));
  ui.arc = CARS[(i + d + CARS.length) % CARS.length].id;
  ui.prepRow = 0;
  ui.prepView = { ...arcadeBuildOf(ui.arc) };
  ui.revT0 = -9;
  setEngine(0, false, false);
}
// volta à escolha CORRER/OFICINA com o carro da oficina já escolhido para correr
function closeArcadePrep(s: AppState, a: Actions) {
  const i = CARS.findIndex((k) => k.id === ui.arc);
  if (i >= 0) s.carIdx = i;
  closePrep();
  ui.arc = '';
  a.go('arcadeMenu');
  s.sel = 1;
}
function drawArcadePrep(c: CanvasRenderingContext2D, s: AppState) {
  if (!ui.arc) ui.arc = (CARS[s.carIdx] ?? CARS[0]).id;
  paper(c);
  masthead(c, 'OFICINA DO ARCADE');
  // no lugar do saldo da carreira: no Arcade não há dinheiro
  const x = ox() + SAFE_W - 4, lab = 'ARCADE: GRÁTIS';
  c.font = '5px "Press Start 2P", monospace';
  const w = Math.ceil(c.measureText(lab).width) + 7;
  c.fillStyle = '#1a6a2a';
  c.fillRect(x - w, 19, w, 11);
  text(c, lab, x - 3, 22, 5, '#fff', 'right', null);
  drawPrep(c, s, arcCar());
}
function tapArcadePrep(s: AppState, a: Actions, x: number, y: number) {
  const b = prepButtons();
  if (inside(x, y, b.back)) return closeArcadePrep(s, a);
  if (inside(x, y, b.stock)) return arcStep(1);
  const ph: Rect = { x: ox() + 4, y: 35, w: 198, h: 59 };
  if (inside(x, y, ph)) return arcStep(x < ph.x + ph.w / 2 ? -1 : 1);
  tapPrep(s, arcCar(), x, y);
}

// ---------- minha garagem: os carros comprados num pôster de revista ----------
const COL_PER_PAGE = 6;
const collectionCards = () => {
  const x = ox();
  return Array.from({ length: COL_PER_PAGE }, (_, i): Rect => ({ x: x + 6 + (i % 3) * 104, y: 46 + Math.floor(i / 3) * 80, w: 100, h: 74 }));
};
const collectionButtons = () => {
  const x = ox();
  return { back: { x: x + 4, y: 211, w: 100, h: 15 }, garage: { x: x + 216, y: 211, w: 100, h: 15 }, prev: { x: x + 128, y: 211, w: 14, h: 15 }, next: { x: x + 178, y: 211, w: 14, h: 15 } };
};
let colPage = 0;
function drawCollection(c: CanvasRenderingContext2D, s: AppState) {
  const cs = s.career!;
  const x = ox();
  paper(c);
  topBar(c, s, 'MINHA GARAGEM', cs);
  const cars = ownedCars(cs);
  const pages = Math.max(1, Math.ceil(cars.length / COL_PER_PAGE));
  colPage = Math.min(colPage, pages - 1);
  const total = cars.reduce((t, car) => t + sellValue(car, cs), 0);
  kicker(c, 'PÔSTER DO LEITOR', x + 4, 20, RED, '#fff');
  ink(c, `${cars.length} carro${cars.length > 1 ? 's' : ''} • vale ${money(total)}`, x + 4, 34, 5, GREY);
  collectionCards().forEach((r, i) => {
    const car = cars[colPage * COL_PER_PAGE + i];
    if (!car) {
      // vaga livre: o contorno tracejado de um carro que ainda falta
      c.strokeStyle = 'rgba(26,22,20,0.25)';
      c.setLineDash([2, 2]);
      c.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1);
      c.setLineDash([]);
      ink(c, 'VAGA LIVRE', r.x + r.w / 2, r.y + r.h / 2 - 2, 5, 'rgba(26,22,20,0.35)', 'center');
      return;
    }
    const active = car.id === cs.car;
    const ph: Rect = { x: r.x + 3, y: r.y + 3, w: r.w - 6, h: 46 };
    const tuned = tunedFor(car, levels(cs, car.id), setupOf(cs, car.id), buildOf(cs, car.id));
    photo(c, ph, () => drawCarSide(c, ph.x + 4, ph.y + 42, ph.w - 8, tuned, paintHex(car.id)), ['#4a4238', '#a89a86']);
    classBadge(c, r.x + 4, r.y + 53, tuned, false, 6);
    ink(c, car.name.toUpperCase(), r.x + 14, r.y + 54, 5, INK);
    ink(c, `${car.power} • ${Math.round(tuned.maxSpeed * KMH)} km/h`, r.x + 4, r.y + 64, 5, GREY);
    if (active) burst(c, r.x + r.w - 12, r.y + 10, 11, ['EM', 'USO'], YELLOW, RED, s.t);
  });
  const b = collectionButtons();
  if (pages > 1) {
    arrow(c, b.prev, 'left', true);
    arrow(c, b.next, 'right', true);
    ink(c, `${colPage + 1}/${pages}`, x + 160, 216, 5, INK, 'center');
  }
  tag(c, b.back, '◀ CARREIRA');
  tag(c, b.garage, 'OFICINA ▶');
  ink(c, 'Toque num carro para abrir na oficina', x + 160, 202, 5, GREY, 'center');
  toast(c, s);
}
function tapCollection(s: AppState, a: Actions, x: number, y: number) {
  const cars = ownedCars(s.career!);
  const pages = Math.max(1, Math.ceil(cars.length / COL_PER_PAGE));
  const b = collectionButtons();
  if (inside(x, y, b.back)) return a.go('careerMenu');
  if (inside(x, y, b.garage)) return a.go('garage');
  if (pages > 1 && inside(x, y, b.prev)) colPage = (colPage + pages - 1) % pages;
  else if (pages > 1 && inside(x, y, b.next)) colPage = (colPage + 1) % pages;
  else collectionCards().forEach((r, i) => {
    const k = colPage * COL_PER_PAGE + i;
    if (inside(x, y, r) && cars[k]) {
      ui.garage = k;
      a.go('garage');
    }
  });
}

// ---------- concessionária ----------
const dealerFilterRects = () => filterRects(ox() + SAFE_W - 148, 33, 144, 11);
function setDealerFilter(f: ClassFilter) {
  ui.filter = f;
  if (!filtered(DEALER_CARS, f).includes(ui.dealer)) ui.dealer = filtered(DEALER_CARS, f)[0] ?? ui.dealer;
}

const dealerButtons = () => {
  const x = ox();
  return {
    prev: { x: x + 4, y: 77, w: 12, h: 28 }, next: { x: x + 190, y: 77, w: 12, h: 28 },
    buy: { x: x + 186, y: 211, w: 130, h: 15 }, back: { x: x + 4, y: 211, w: 100, h: 15 },
  };
};

export function drawDealer(c: CanvasRenderingContext2D, s: AppState) {
  const cs = s.career!;
  const x = ox();
  const first = cs.owned.length === 0;
  paper(c);
  topBar(c, s, first ? 'SEU PRIMEIRO CARRO' : 'CLASSIFICADOS', cs);
  const car = DEALER_CARS[ui.dealer];
  const owned = cs.owned.includes(car.id);
  kicker(c, first ? 'COMECE POR AQUI' : 'VENDE-SE', x + 4, 20, RED, '#fff');
  headline(c, car.name.toUpperCase(), x + 4, 33, 8, INK);
  drawFilter(c, dealerFilterRects(), ui.filter, (k) => filtered(DEALER_CARS, k).length);
  const ids = filtered(DEALER_CARS, ui.filter);
  ink(c, `${ids.indexOf(ui.dealer) + 1} de ${ids.length}`, x + 4, 45, 5, GREY);
  classBadge(c, x + 60, 43, car, true, 9);
  stars(c, x + 130, 45, carStars(car), 5);
  const ph: Rect = { x: x + 4, y: 56, w: 198, h: 70 };
  photo(c, ph, () => drawCarSide(c, ph.x + 8, ph.y + 64, 182, car, paintHex(car.id)));
  const b = dealerButtons();
  arrow(c, b.prev, 'left');
  arrow(c, b.next, 'right');
  const fr: Rect = { x: x + 208, y: 50, w: 108, h: 80 };
  box(c, fr, 'FICHA');
  specRows(c, fr, carRows(car).filter(([k]) => k !== 'Preço'), 9.4);
  accelChart(c, { x: x + 4, y: 136, w: 150, h: 66 }, car);
  verdictBox(c, { x: x + 160, y: 136, w: 156, h: 66 }, car);
  const price = priceOf(car);
  // preço em destaque, como anúncio
  burst(c, x + 168, 80, 27, ['SÓ', money(price)], YELLOW, RED, s.t);
  tag(c, b.back, first ? '◀ CAPA' : '◀ VOLTAR');
  if (owned) {
    const canSell = cs.owned.length > 1 && cs.car !== car.id;
    tag(c, b.buy, canSell ? `VENDER POR ${money(sellValue(car, cs))}` : car.id === cs.car ? 'EM USO' : 'NA SUA GARAGEM');
  } else {
    const ok = cs.money >= price;
    tag(c, b.buy, ok ? `COMPRAR ${money(price)}` : `FALTA ${money(price - cs.money)}`, ok && Math.floor(s.t * 2) % 2 === 0);
  }
  toast(c, s);
}

function tapDealer(s: AppState, a: Actions, x: number, y: number) {
  const cs = s.career!;
  const b = dealerButtons();
  const car = DEALER_CARS[ui.dealer];
  const f = filterAt(dealerFilterRects(), x, y);
  if (f !== undefined) {
    if (f === null || filtered(DEALER_CARS, f).length) setDealerFilter(f);
  } else if (inside(x, y, b.prev)) ui.dealer = stepCar(DEALER_CARS, ui.filter, ui.dealer, -1);
  else if (inside(x, y, b.next)) ui.dealer = stepCar(DEALER_CARS, ui.filter, ui.dealer, 1);
  else if (inside(x, y, b.back)) a.go(cs.owned.length ? 'career' : 'careerMenu');
  else if (inside(x, y, b.buy)) {
    if (cs.owned.includes(car.id)) {
      if (cs.owned.length > 1 && cs.car !== car.id) {
        cs.owned = cs.owned.filter((id) => id !== car.id);
        const v = sellValue(car, cs);
        cs.money += v;
        delete cs.upgrades[car.id];
        forgetCar(cs, car.id); // defeitos e km do usado vão junto com ele
        saveCareer(cs);
        flash(s, `${car.name} vendido por ${money(v)}`);
      }
      return;
    }
    const price = priceOf(car);
    if (cs.money < price) return flash(s, `Falta ${money(price - cs.money)}`);
    const first = cs.owned.length === 0;
    cs.money -= price;
    spend(cs, price);
    cs.owned.push(car.id);
    if (first || !cs.car) cs.car = car.id;
    saveCareer(cs);
    if (first) {
      flash(s, `Bem-vindo à carreira com o ${car.name}!`);
      ui.region = 0;
      a.go('career');
    } else flash(s, `${car.name} comprado! Escolha-o na garagem.`);
  }
}

// ---------- resultado do evento ----------
export function drawCareerEnd(c: CanvasRenderingContext2D, s: AppState) {
  const cs = s.career!;
  const res = s.careerResult as EventResult;
  if (!res) {
    s.screen = 'career'; // sem resultado para mostrar: volta ao campeonato
    return;
  }
  const ev = eventShown(); // o evento corrido (ou a revanche dele)
  const x = ox();
  paper(c);
  topBar(c, s, 'RESULTADO DO DESAFIO', cs);
  kicker(c, ev.name.toUpperCase(), x + 4, 20, INK);
  const title = res.gameOver ? 'SEUS CARROS ACABARAM' : res.won ? 'VOCÊ VENCEU!' : `${ev.driver.name.toUpperCase()} VENCEU`;
  headline(c, title, x + 4, 34, 8, res.won ? '#1a6a2a' : RED);
  drawPortrait(c, ev.driver, { x: x + SAFE_W - 28, y: 31, w: 24, h: 28 });
  const total = s.results.reduce((a2, r) => a2 + r.time, 0);
  const rival = s.results.reduce((a2, r) => a2 + Math.max(0, r.rival), 0);
  if (!res.gameOver) ink(c, `Você ${formatTime(total)}  •  ${ev.driver.name} ${formatTime(rival)}`, x + 4, 48, 5, INK);
  const t: Rect = { x: x + 4, y: 60, w: 200, h: 92 };
  box(c, t, 'EXTRATO');
  const lines: [string, number][] = [[res.won ? 'Prêmio' : 'Participação', res.prize], ['Bônus trecho limpo', res.clean], ['Multas', -res.fines], ['Conserto', -res.repairs]];
  lines.forEach(([k, v], i) => {
    const y = t.y + 16 + i * 13;
    ink(c, k, t.x + 6, y, 5, GREY);
    ink(c, (v < 0 ? '-' : '') + money(Math.abs(v)), t.x + t.w - 6, y, 5, v < 0 ? RED : '#1a6a2a', 'right');
  });
  rule(c, t.x + 6, t.y + 70, t.w - 12, RED);
  ink(c, 'TOTAL', t.x + 6, t.y + 77, 8, INK);
  ink(c, (res.total < 0 ? '-' : '') + money(Math.abs(res.total)), t.x + t.w - 6, t.y + 77, 8, res.total < 0 ? RED : '#1a6a2a', 'right');
  const car = s.playerCar?.id === cs.car ? s.playerCar : carById(cs.car); // com as peças da oficina
  photo(c, { x: x + 214, y: 64, w: 102, h: 62 }, () => drawCarSide(c, x + 218, 120, 94, car, paintHex(car.id)));
  let note = `Saldo: ${money(cs.money)}`;
  if (res.firstWin && ev.boss) {
    const next = regionsAfter(ui.region);
    const champion = REGIONS.every((r) => r.events.some((e) => e.boss && cs.done.includes(e.id)));
    note = next.length ? `LIBERADA: ${next.map((r) => r.name.toUpperCase()).join(' E ')}!` : champion ? 'VOCÊ É O CAMPEÃO DA CARREIRA!' : 'REGIÃO CONCLUÍDA!';
    burst(c, x + 266, 170, 30, ['CHEFÃO', 'DERROTADO!'], YELLOW, RED, s.t);
  }
  headline(c, note, x + 4, 166, res.firstWin && ev.boss ? 8 : 5, res.firstWin && ev.boss ? '#1a6a2a' : INK);
  // a fala do rival depois do resultado (derrota dele ou vitória dele)
  const p = rivalOf(ev.driver);
  const said = `${p.nick.toUpperCase()}: "${res.won ? p.lose : p.win}"`;
  const bw = res.firstWin && ev.boss ? 226 : SAFE_W - 8;
  c.fillStyle = '#f8f2e4';
  c.fillRect(x + 4, 178, bw, 28);
  c.fillStyle = res.won ? '#1a6a2a' : RED;
  c.fillRect(x + 4, 178, 3, 28);
  wrapLines(c, said, bw - 14, 5).slice(0, 3).forEach((l, i) => ink(c, l, x + 11, 181 + i * 8, 5, INK));
  if (Math.floor(s.t * 2) % 2) ink(c, 'TOQUE PARA CONTINUAR ▶', x + 160, 222, 5, RED, 'center');
  toast(c, s);
}

// ---------- carreira: escolha entre correr e ver a garagem ----------
const careerTiles = () => {
  const x = ox();
  return [{ x: x + 4, y: 34, w: 154, h: 168 }, { x: x + 162, y: 34, w: 154, h: 168 }] as Rect[];
};
const careerMenuBack = () => ({ x: ox() + 4, y: 211, w: 100, h: 15 }) as Rect;
// classificados de usados e estatísticas (careerPages.ts)
const careerMenuExtra = () => [{ x: ox() + 110, y: 211, w: 100, h: 15 }, { x: ox() + 216, y: 211, w: 100, h: 15 }] as Rect[];
function careerMenuExtraPick(s: AppState, a: Actions, i: number) {
  if (i === 0) return openUsed(s, a, 'careerMenu');
  pg.back = 'careerMenu';
  a.go('careerStats');
}

function drawCareerMenu(c: CanvasRenderingContext2D, s: AppState) {
  const cs = s.career!;
  const x = ox();
  paper(c);
  topBar(c, s, 'CARREIRA', cs);
  kicker(c, 'MODO CARREIRA', x + 4, 20, RED, '#fff');
  const owned = ownedCars(cs);
  const cur = owned.find((cc) => cc.id === cs.car) ?? owned[0];
  const [run, gar] = careerTiles();
  const frame = (r: Rect, hot: boolean) => {
    c.fillStyle = hot ? RED : INK;
    c.fillRect(r.x - 1, r.y - 1, r.w + 2, r.h + 2);
    c.fillStyle = '#f8f2e2';
    c.fillRect(r.x, r.y, r.w, r.h);
  };
  const hot = (i: number) => lastDevice.kind !== 'touch' && s.sel % 2 === i;
  // correr: o carro em uso na estrada e a região mais avançada
  frame(run, hot(0));
  const ph: Rect = { x: run.x + 4, y: run.y + 4, w: run.w - 8, h: 92 };
  photo(c, ph, () => {
    if (cur) drawCarSide(c, ph.x + 6, ph.y + 84, ph.w - 12, tunedFor(cur, levels(cs, cur.id), setupOf(cs, cur.id), buildOf(cs, cur.id)), paintHex(cur.id));
  }, ['#3a5a8a', '#c8b89a']);
  if (!cur) {
    ink(c, 'SEU CARRO AQUI', ph.x + ph.w / 2, ph.y + 36, 5, '#fff', 'center');
    ink(c, 'compre no showroom', ph.x + ph.w / 2, ph.y + 46, 5, '#fff', 'center');
  }
  headline(c, 'CORRER', run.x + 6, run.y + 102, 16, INK);
  const reg = REGIONS.reduce((best, _, i) => (regionUnlocked(cs, i) ? i : best), 0);
  ink(c, cur ? `Com o ${cur.name}` : 'Primeiro, escolha um carro', run.x + 6, run.y + 124, 5, GREY);
  ink(c, `Região: ${REGIONS[reg].name}`, run.x + 6, run.y + 134, 5, GREY);
  tag(c, { x: run.x + 6, y: run.y + run.h - 20, w: run.w - 12, h: 15 }, cur ? 'IR PARA O CAMPEONATO ▶' : 'ESCOLHER CARRO ▶', hot(0));
  // garagem: os carros comprados, pequenos, como pôster
  frame(gar, hot(1));
  const gp: Rect = { x: gar.x + 4, y: gar.y + 4, w: gar.w - 8, h: 92 };
  photo(c, gp, () => {
    const show = owned.slice(0, 3);
    const ys = [[84], [50, 84], [36, 60, 84]][Math.max(0, show.length - 1)];
    show.forEach((cc, i) => drawCarSide(c, gp.x + 6 + (i % 2) * 8, gp.y + ys[i], show.length > 1 ? gp.w - 30 : gp.w - 12, cc, paintHex(cc.id)));
  }, ['#4a4238', '#a89a86']);
  if (!owned.length) ink(c, 'GARAGEM VAZIA', gp.x + gp.w / 2, gp.y + 42, 5, '#fff', 'center');
  headline(c, 'GARAGEM', gar.x + 6, gar.y + 102, 16, INK);
  const total = owned.reduce((t, car) => t + sellValue(car, cs), 0);
  ink(c, `${owned.length} carro${owned.length === 1 ? '' : 's'} • vale ${money(total)}`, gar.x + 6, gar.y + 124, 5, GREY);
  ink(c, 'Oficina, cores e ajustes', gar.x + 6, gar.y + 134, 5, GREY);
  tag(c, { x: gar.x + 6, y: gar.y + gar.h - 20, w: gar.w - 12, h: 15 }, 'VER GARAGEM ▶', hot(1));
  tag(c, careerMenuBack(), '◀ CAPA');
  const [ub, sb] = careerMenuExtra();
  tag(c, ub, 'CLASSIFICADOS');
  tag(c, sb, 'ESTATÍSTICAS');
  // rivais vencidos pedindo revanche: aviso no canto da foto de correr
  const nr = rematchCount(cs);
  if (nr) kicker(c, `${nr} REVANCHE${nr > 1 ? 'S' : ''}!`, run.x + 6, run.y + 6, RED, YELLOW);
  toast(c, s);
}

function careerMenuPick(s: AppState, a: Actions, i: number) {
  if (i === 0) return openCareer(s, a);
  if (!s.career!.owned.length) {
    flash(s, 'Garagem vazia: compre seu carro no showroom');
    return openShowroom(s, a, '', 'careerMenu');
  }
  a.go('collection');
}
function tapCareerMenu(s: AppState, a: Actions, x: number, y: number) {
  if (inside(x, y, careerMenuBack())) return a.go('title');
  const ex = careerMenuExtra().findIndex((r) => inside(x, y, r));
  if (ex >= 0) return careerMenuExtraPick(s, a, ex);
  careerTiles().forEach((r, i) => inside(x, y, r) && careerMenuPick(s, a, i));
}

// ---------- roteamento ----------
export function openCareer(s: AppState, a: Actions) {
  if (!s.career) {
    s.career = newCareer();
    saveCareer(s.career);
  }
  if (!s.career.owned.length) {
    // primeiro carro: escolhido nos classificados do showroom
    openShowroom(s, a, '', 'careerMenu');
    show.cls = 'D'; // o campeonato começa na classe D: os classificados já abrem nela
    flash(s, 'Escolha seu primeiro carro: o campeonato começa na classe D');
  } else {
    // abre na região mais avançada liberada
    ui.region = REGIONS.reduce((best, _, i) => (regionUnlocked(s.career!, i) ? i : best), 0);
    a.go('career');
  }
}

export function drawCareerScreen(c: CanvasRenderingContext2D, s: AppState) {
  // telas do Arcade: não dependem da carreira
  if (s.screen === 'arcadeMenu') return drawArcadeMenu(c, s);
  if (s.screen === 'arcadePrep') return drawArcadePrep(c, s);
  // sem carreira carregada (não deveria acontecer): volta para a capa em vez de quebrar
  if (!s.career) {
    s.screen = 'title';
    return;
  }
  curCareer = s.career;
  switch (s.screen) {
    case 'usedCars': return drawUsed(c, s);
    case 'careerStats': return drawStats(c, s);
    case 'career': return drawCareer(c, s);
    case 'event': return drawEvent(c, s);
    case 'garage': return drawGarage(c, s);
    case 'dealer': return drawDealer(c, s);
    case 'careerEnd': return drawCareerEnd(c, s);
    case 'collection': return drawCollection(c, s);
    case 'careerMenu': return drawCareerMenu(c, s);
    case 'showroom': return drawShowroom(c, s);
    case 'prepDemo': return drawPrepDemo(c, s);
  }
}

export function tapCareerScreen(s: AppState, a: Actions, x: number, y: number) {
  switch (s.screen) {
    case 'usedCars': return tapUsed(s, a, x, y);
    case 'careerStats': return tapStats(s, a, x, y);
    case 'career': return tapCareer(s, a, x, y);
    case 'event': return tapEvent(s, a, x, y);
    case 'garage': return tapGarage(s, a, x, y);
    case 'dealer': return tapDealer(s, a, x, y);
    case 'careerEnd': return a.go('career');
    case 'collection': return tapCollection(s, a, x, y);
    case 'careerMenu': return tapCareerMenu(s, a, x, y);
    case 'showroom': return tapShowroom(s, a, x, y);
    case 'prepDemo': return tapPrepDemo(s, a, x, y);
    case 'arcadeMenu': return tapArcadeMenu(s, a, x, y);
    case 'arcadePrep': return tapArcadePrep(s, a, x, y);
  }
}

export function keyCareerScreen(s: AppState, a: Actions, k: MenuKey) {
  const cs = s.career!;
  const b = (r: Rect) => tapCareerScreen(s, a, r.x + r.w / 2, r.y + r.h / 2);
  switch (s.screen) {
    case 'usedCars': return keyUsed(s, a, k);
    case 'careerStats': return keyStats(s, a, k);
    case 'showroom': return keyShowroom(s, a, k);
    case 'arcadeMenu':
      if (k === 'left' || k === 'right' || k === 'up' || k === 'down') s.sel = 1 - (s.sel % 2);
      if (k === 'ok') arcPick(s, a, s.sel % 2);
      if (k === 'back') a.go('title');
      return;
    case 'arcadePrep':
      if (k === 'back') return closeArcadePrep(s, a);
      if (k === 'prevTab' || k === 'nextTab') return arcStep(k === 'nextTab' ? 1 : -1);
      return keyPrep(s, k);
    case 'prepDemo':
      if (k === 'back') return closeDemo(a);
      if (k === 'prevTab' || k === 'nextTab') return demoStep(k === 'nextTab' ? 1 : -1);
      return keyPrep(s, k);
    case 'careerMenu':
      if (k === 'left' || k === 'right' || k === 'up' || k === 'down') s.sel = 1 - (s.sel % 2);
      if (k === 'ok') careerMenuPick(s, a, s.sel % 2);
      if (k === 'back') a.go('title');
      return;
    case 'career':
      if (k === 'left') ui.region = (ui.region + REGIONS.length - 1) % REGIONS.length;
      if (k === 'right') ui.region = (ui.region + 1) % REGIONS.length;
      if (k === 'up') s.sel = (s.sel + 4) % 5;
      if (k === 'down') s.sel = (s.sel + 1) % 5;
      if (k === 'ok') pickEvent(s, a, s.sel);
      if (k === 'back') a.go('careerMenu');
      return;
    case 'event':
      if (k === 'ok') goEvent(s, a);
      if (k === 'back') a.go('career');
      return;
    case 'garage': {
      if (ui.prep) return keyPrep(s, k);
      if (pg.fix) return keyFix(s, ownedCars(cs)[ui.garage], k);
      if (ui.rimPick) {
        if (k === 'back') ui.rimPick = false;
        return;
      }
      // (setas e A ficam com o foco em 2D: careerFocusables) LB/RB trocam de carro da garagem
      if (k === 'prevTab') b(garageButtons().prev);
      if (k === 'nextTab') b(garageButtons().next);
      if (k === 'back') a.go('career');
      return;
    }
    case 'dealer':
      if (k === 'left') b(dealerButtons().prev);
      if (k === 'right') b(dealerButtons().next);
      if (k === 'up' || k === 'down' || k === 'prevTab' || k === 'nextTab') setDealerFilter(nextFilter(ui.filter, k === 'down' || k === 'nextTab' ? 1 : -1, (c2) => filtered(DEALER_CARS, c2).length > 0));
      if (k === 'ok') b(dealerButtons().buy);
      if (k === 'back') a.go(cs.owned.length ? 'career' : 'careerMenu');
      return;
    case 'careerEnd':
      if (k === 'ok' || k === 'back') a.go('career');
      return;
    case 'collection':
      if (k === 'prevTab') b(collectionButtons().prev);
      if (k === 'nextTab') b(collectionButtons().next);
      if (k === 'back') a.go('careerMenu');
  }
}

// ---------- foco (setas, A/Enter e mouse) das telas da carreira, da oficina e do catálogo ----------
export function careerFocusables(s: AppState, a: Actions): FocusSet | null {
  const cs = s.career;
  const sel = (i: number, r: Rect, extra: Partial<Focusable> = {}): Focusable => ({ r, is: () => s.sel === i, pick: () => { s.sel = i; }, ...extra });
  if (s.screen === 'arcadeMenu') return { key: 'arcadeMenu', items: [...arcTiles().map((r, i) => sel(i, r, { act: () => arcPick(s, a, i) })), { r: arcBack() }] };
  if (!cs && s.screen !== 'showroom' && s.screen !== 'arcadePrep') return null;
  // catálogo de peças (oficina da carreira e o de fora dela): as vagas são a "linha" da tela
  const prep = (car: CarSpec, demo: boolean): FocusSet => {
    const slots = prepSel(car), pb = prepBar(), bt = prepButtons();
    const rows = prepRows(slots.length).map((r, i): Focusable => ({ r, is: () => ui.prepRow === i, pick: () => { ui.prepRow = i; }, lr: (d) => prepStep(car, slots[i].id, d), act: () => prepInstall(s, car, slots[i].id) }));
    const items: Focusable[] = [{ r: pb.prev }, { r: pb.name }, { r: pb.next }, { r: pb.buy }, ...rows, { r: bt.back }, { r: bt.rev }, { r: bt.stock }];
    if (demo) items.unshift({ r: { x: ox() + 4, y: 35, w: 198, h: 59 }, lr: ui.arc ? arcStep : demoStep, act: () => (ui.arc ? arcStep(1) : demoStep(1)) });
    return { key: `prep:${demo}:${ui.arc ? 'arc' : ''}`, items, def: items.indexOf(rows[0]) };
  };
  switch (s.screen) {
    case 'usedCars': return usedFocusables(s, a);
    case 'careerStats': return statsFocusables(s, a);
    case 'showroom': return showroomFocusables(s, a);
    case 'prepDemo': return prep(demoCar(), true);
    case 'arcadePrep': return prep(arcCar(), true);
    case 'careerMenu': return { key: 'careerMenu', items: [...careerTiles().map((r, i) => sel(i, r, { act: () => careerMenuPick(s, a, i) })), { r: careerMenuBack() }, ...careerMenuExtra().map((r, i) => ({ r, act: () => careerMenuExtraPick(s, a, i) }))] };
    case 'career': {
      const b = hubButtons();
      const reg = (d: number) => { ui.region = (ui.region + REGIONS.length + d) % REGIONS.length; };
      return { key: 'career', def: 2, items: [{ r: b.prev, act: () => reg(-1) }, { r: b.next, act: () => reg(1) }, ...hubRows().map((r, i) => sel(i, r, { lr: reg, act: () => pickEvent(s, a, i) })), { r: b.collection }, { r: b.garage }, { r: b.dealer }, { r: b.back }] };
    }
    case 'event': {
      const b = eventButtons();
      return { key: `event:${ui.rematch}`, def: 1, items: [{ r: b.back }, { r: b.go, act: () => goEvent(s, a) }, ...(ui.rematch ? [{ r: b.normal }] : [])] };
    }
    case 'garage': {
      const cars = ownedCars(cs!);
      if (ui.prep) return prep(cars[ui.garage], false);
      if (pg.fix) return fixFocusables(s, cars[ui.garage]);
      if (ui.rimPick) {
        const rb = rimButtons();
        const chips = rimChips().map((r, i): Focusable => ({ r, is: () => ui.rimView === RIM_IDS()[i], pick: () => { ui.rimView = RIM_IDS()[i]; }, lr: rimStep, act: () => rimConfirm(s) }));
        return { key: 'garage:rims', items: [...chips, { r: rb.back }, { r: rb.ok }] };
      }
      const rects = garageFocusRects();
      const car = () => cars[ui.garage];
      const paint = (d: number) => setPaint(car().id, ((paintIdx(car().id) ?? nearestPaint(car().color)) + d + PAINTS.length) % PAINTS.length);
      return {
        key: 'garage', items: rects.map((r, i): Focusable => ({
          r, is: () => ui.gFocus % rects.length === i, pick: () => { ui.gFocus = i; },
          ...(i === 7 ? { lr: paint, act: () => paint(1) } : {}),
        })).concat(wearOf(cs!, car().id).length ? [{ r: fixTag(), act: () => { pg.fix = true; pg.fixRow = 0; } }] : []),
      };
    }
    case 'dealer': {
      const b = dealerButtons();
      const step = (d: number) => tapCareerScreen(s, a, (d < 0 ? b.prev : b.next).x + 3, (d < 0 ? b.prev : b.next).y + 3);
      const items: Focusable[] = [...dealerFilterRects().map((r) => ({ r })), { r: { x: b.prev.x, y: 46, w: b.next.x + b.next.w - b.prev.x, h: 90 }, lr: step, act: () => step(1) }, { r: b.back }, { r: b.buy }];
      return { key: 'dealer', items, def: items.length - 1 };
    }
    case 'collection': {
      const cars = ownedCars(cs!), b = collectionButtons();
      const pages = Math.max(1, Math.ceil(cars.length / COL_PER_PAGE));
      const cards = collectionCards().map((r, i) => ({ r, i })).filter((q) => cars[colPage * COL_PER_PAGE + q.i]).map((q) => ({ r: q.r }));
      return { key: 'collection', items: [...cards, { r: b.back }, ...(pages > 1 ? [{ r: b.prev }, { r: b.next }] : []), { r: b.garage }] };
    }
  }
  return null;
}
