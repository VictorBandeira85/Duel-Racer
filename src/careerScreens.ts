// Telas do modo Carreira: central (regiões e eventos), evento, garagem, concessionária e resultado.
import { SAFE_W, view, KMH } from './config';
import { CARS, DEALER_CARS, drawCarSide, gearbox, layout, type CarSpec } from './cars';
import { classBadge, drawFilter, filterAt, filterRects, filtered, nextFilter, stepCar, type ClassFilter } from './classui';
import {
  MAX_LEVEL, REGIONS, UPGRADES, carById, eventUnlocked, levels, newCareer, priceOf, regionUnlocked, regionsAfter, saveCareer,
  sellValue, tunedCar, upgradeCost, type CareerSave, type EventResult, type Upgrade,
} from './career';
import { PAINTS, nearestPaint, paintHex, paintIdx, setPaint } from './paint';
import type { AppState, Actions, MenuKey } from './screens';
import { accelChart, carRows, carStars, ox, padlock, stageChip, verdictBox } from './screens';
import { BLUE, GREY, INK, RED, YELLOW, box, burst, headline, ink, kicker, masthead, paper, photo, rule, specRows, stars, tag } from './mag';
import type { ThemeId } from './themes';
import { inside, panel, text, type Rect } from './ui';
import { formatTime } from './util';

const THEME_NAME: Record<ThemeId, string> = {
  forest: 'Floresta', farm: 'Fazenda', desert: 'Deserto', city: 'Cidade', mountain: 'Serra', snow: 'Neve', coast: 'Litoral',
  canyon: 'Cânion', jungle: 'Selva', autumn: 'Outono', beach: 'Praia', savanna: 'Savana', industrial: 'Indústria', alpine: 'Alpes', alpinesnow: 'Alpes nevados',
};
const STYLE: Record<string, [string, string]> = {
  agressivo: ['AGRESSIVO', RED], cauteloso: ['CAUTELOSO', '#1a6a2a'], imprevisivel: ['IMPREVISÍVEL', '#b07000'],
};
export const money = (v: number) => `$${Math.round(v).toLocaleString('pt-BR')}`;

// estado da interface da carreira (não vai para o save)
export const ui = { region: 0, event: 0, dealer: 0, garage: 0, msg: '', msgT: 0, filter: null as ClassFilter };
function flash(s: AppState, msg: string) {
  ui.msg = msg;
  ui.msgT = s.t + 2.2;
}

function topBar(c: CanvasRenderingContext2D, s: AppState, title: string, cs: CareerSave) {
  masthead(c, title);
  void s;
  // saldo do leitor no canto, como etiqueta de preço
  const x = ox() + SAFE_W - 4;
  c.font = '5px "Press Start 2P", monospace';
  const w = Math.ceil(c.measureText(money(cs.money)).width) + 30;
  c.fillStyle = '#1a6a2a';
  c.fillRect(x - w, 19, w, 11);
  text(c, `SALDO ${money(cs.money)}`, x - 3, 22, 5, '#fff', 'right', null);
}

// aviso curto por cima de tudo (compra, falta de dinheiro etc.)
function toast(c: CanvasRenderingContext2D, s: AppState) {
  if (!ui.msg || s.t >= ui.msgT) return;
  const x = ox();
  c.fillStyle = INK;
  c.fillRect(x + 24, 96, SAFE_W - 48, 22);
  c.fillStyle = YELLOW;
  c.fillRect(x + 24, 96, 4, 22);
  text(c, ui.msg, view.w / 2, 104, 5, '#fff', 'center', null);
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
    garage: { x: x + 4, y: 211, w: 100, h: 15 }, dealer: { x: x + 110, y: 211, w: 100, h: 15 }, back: { x: x + 216, y: 211, w: 100, h: 15 },
  };
};

export function drawCareer(c: CanvasRenderingContext2D, s: AppState) {
  const cs = s.career!;
  const x = ox();
  paper(c);
  topBar(c, s, 'CAMPEONATO', cs);
  kicker(c, `CARRO: ${carById(cs.car).name.toUpperCase()}`, x + 4, 20, INK);
  const ri = ui.region;
  const reg = REGIONS[ri];
  const b = hubButtons();
  const open = regionUnlocked(cs, ri);
  // a região como seção da revista: faixa na cor dela, nome e descrição
  c.fillStyle = open ? reg.color : '#9a9286';
  c.fillRect(x + 24, 34, SAFE_W - 48, 20);
  text(c, `ETAPA ${ri + 1}: ${reg.name.toUpperCase()}`, view.w / 2, 37, 8, '#fff', 'center', INK);
  const prevName = (REGIONS.find((r2) => r2.id === reg.after) ?? REGIONS[ri - 1])?.name ?? '';
  text(c, open ? reg.desc : `Vença o chefão de ${prevName}`, view.w / 2, 47, 5, '#fff', 'center', null);
  tag(c, b.prev, '◀');
  tag(c, b.next, '▶');
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
    helmet(c, r.x + 13, r.y + 14, 8, can ? ev.driver.paint : '#9a9286', ei + 1);
    const rc = carById(ev.driver.car);
    if (can) drawCarSide(c, r.x + r.w - 122, r.y + 25, 54, rc, ev.driver.paint);
    if (ev.boss) kicker(c, 'CHEFÃO', r.x + 26, r.y + 3, RED, '#fff');
    ink(c, ev.name.toUpperCase(), r.x + (ev.boss ? 64 : 26), r.y + 5, 5, can ? INK : GREY);
    ink(c, `vs ${ev.driver.name} • ${ev.stages.length} trecho${ev.stages.length > 1 ? 's' : ''}`, r.x + 26, r.y + 17, 5, can ? BLUE : GREY);
    ink(c, money(done ? ev.prize / 2 : ev.prize), r.x + r.w - 6, r.y + 5, 5, can ? '#1a6a2a' : GREY, 'right');
    if (done) ink(c, 'VENCIDO ✓', r.x + r.w - 6, r.y + 17, 5, '#1a6a2a', 'right');
    else if (!can) padlock(c, r.x + r.w - 14, r.y + 18);
  });
  tag(c, b.garage, 'OFICINA');
  tag(c, b.dealer, 'CLASSIFICADOS');
  tag(c, b.back, '◀ CAPA');
  toast(c, s);
}

function pickEvent(s: AppState, a: Actions, ei: number) {
  const cs = s.career!;
  if (!eventUnlocked(cs, ui.region, ei)) return flash(s, regionUnlocked(cs, ui.region) ? 'Vença os eventos anteriores primeiro' : 'Região trancada');
  ui.event = ei;
  a.go('event');
}

function tapCareer(s: AppState, a: Actions, x: number, y: number) {
  const b = hubButtons();
  if (inside(x, y, b.prev)) ui.region = (ui.region + REGIONS.length - 1) % REGIONS.length;
  else if (inside(x, y, b.next)) ui.region = (ui.region + 1) % REGIONS.length;
  else if (inside(x, y, b.garage)) a.go('garage');
  else if (inside(x, y, b.dealer)) a.go('dealer');
  else if (inside(x, y, b.back)) a.go('title');
  else hubRows().forEach((r, i) => inside(x, y, r) && pickEvent(s, a, i));
}

// ---------- evento (antes da corrida) ----------
const eventButtons = () => ({ go: { x: ox() + 216, y: 211, w: 100, h: 15 }, back: { x: ox() + 4, y: 211, w: 100, h: 15 } });

export function drawEvent(c: CanvasRenderingContext2D, s: AppState) {
  const cs = s.career!;
  const reg = REGIONS[ui.region];
  const ev = reg.events[ui.event];
  const d = ev.driver;
  const x = ox();
  paper(c);
  topBar(c, s, 'ENTREVISTA EXCLUSIVA', cs);
  kicker(c, ev.boss ? 'CHEFÃO DA REGIÃO' : reg.name.toUpperCase(), x + 4, 20, ev.boss ? RED : INK, ev.boss ? '#fff' : YELLOW);
  // o piloto: retrato, nome, a frase dele
  helmet(c, x + 20, 50, 14, d.paint, ui.event + 1);
  headline(c, d.name.toUpperCase(), x + 40, 36, 16, ev.boss ? RED : INK);
  text(c, '"', x + 40, 52, 16, RED, 'left', null);
  ink(c, d.quote, x + 54, 56, 5, INK);
  const [label, col] = STYLE[d.style];
  ink(c, 'ESTILO', x + 40, 68, 5, GREY);
  ink(c, label, x + 76, 68, 5, col);
  const lvl = Math.max(1, Math.min(5, Math.round((d.skill - 0.86) / 0.032)));
  ink(c, 'NÍVEL', x + 160, 68, 5, GREY);
  stars(c, x + 190, 67, lvl, 6);
  // o carro dele, em foto de estúdio, e a ficha
  const rc = carById(d.car);
  const ph: Rect = { x: x + 4, y: 80, w: 190, h: 76 };
  photo(c, ph, () => drawCarSide(c, ph.x + 8, ph.y + 70, 174, rc, d.paint));
  ink(c, `O ${rc.name} de ${d.name}`, ph.x, ph.y + ph.h + 5, 5, GREY);
  const fr: Rect = { x: x + 200, y: 77, w: 116, h: 82 };
  box(c, fr, `FICHA: ${rc.name.toUpperCase()}`);
  specRows(c, fr, carRows(rc).filter(([k]) => k !== 'Preço' && k !== 'Layout'), 11, 15);
  // o roteiro e o prêmio
  ink(c, 'ROTEIRO', x + 4, 172, 5, GREY);
  ev.stages.forEach((st, k) => stageChip(c, x + 44 + k * 42, 169, st));
  const done = cs.done.includes(ev.id);
  burst(c, x + 290, 182, 22, ['PRÊMIO', money(done ? ev.prize / 2 : ev.prize)], YELLOW, '#1a6a2a', s.t);
  const lv = levels(cs, cs.car);
  ink(c, `Seu carro: ${carById(cs.car).name} (motor ${lv.motor}, câmbio ${lv.cambio}, pneus ${lv.pneus})`, x + 4, 197, 5, INK);
  const b = eventButtons();
  tag(c, b.back, '◀ VOLTAR');
  tag(c, b.go, 'CORRER ▶', Math.floor(s.t * 2) % 2 === 0);
  toast(c, s);
}

function tapEvent(s: AppState, a: Actions, x: number, y: number) {
  const b = eventButtons();
  if (inside(x, y, b.go)) a.startEvent(ui.region, ui.event);
  else if (inside(x, y, b.back)) a.go('career');
}

// ---------- garagem ----------
const swatchRects = (): Rect[] => PAINTS.map((_, i) => ({ x: ox() + 44 + i * 12, y: 128, w: 10, h: 7 }));
const upgradeRows = () => [0, 1, 2].map((i): Rect => ({ x: ox() + 4, y: 142 + i * 22, w: SAFE_W - 8, h: 20 }));
const garageButtons = () => {
  const x = ox();
  return {
    prev: { x: x + 4, y: 64, w: 16, h: 30 }, next: { x: x + 186, y: 64, w: 16, h: 30 },
    use: { x: x + 110, y: 211, w: 100, h: 15 }, back: { x: x + 4, y: 211, w: 100, h: 15 }, dealer: { x: x + 216, y: 211, w: 100, h: 15 },
  };
};
const ownedCars = (cs: CareerSave) => CARS.filter((c) => cs.owned.includes(c.id));

// carro com melhorias, guardado por nível (o índice de desempenho é medido uma vez)
const tunedCache = new Map<string, CarSpec>();
function tunedFor(car: CarSpec, lv: Record<Upgrade, number>) {
  const key = `${car.id}:${lv.motor}${lv.cambio}${lv.pneus}`;
  let t = tunedCache.get(key);
  if (!t) tunedCache.set(key, (t = tunedCar(car, lv)));
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
  const tuned = tunedFor(car, levels(cs, car.id));
  kicker(c, active ? 'EM USO' : `${ui.garage + 1} DE ${cars.length} NA GARAGEM`, x + 4, 20, active ? '#1a6a2a' : INK, '#fff');
  headline(c, car.name.toUpperCase(), x + 4, 33, 8, INK);
  // classe com as melhorias instaladas (as melhorias podem subir o carro de classe)
  classBadge(c, x + 150, 32, tuned, true, 9);
  const ph: Rect = { x: x + 4, y: 46, w: 198, h: 74 };
  photo(c, ph, () => drawCarSide(c, ph.x + 8, ph.y + 68, 182, car, paintHex(car.id)), ['#4a4238', '#a89a86']);
  const b = garageButtons();
  if (cars.length > 1) {
    tag(c, b.prev, '◀');
    tag(c, b.next, '▶');
  }
  const fr: Rect = { x: x + 208, y: 43, w: 108, h: 80 };
  box(c, fr, 'COM AS MELHORIAS');
  specRows(c, fr, [['Potência', `${Math.round(parseInt(car.power) * tuned.accel)} cv`], ['0-100', `${tuned.zeroTo100.toFixed(1).replace('.', ',')} s`], ['Máxima', `${Math.round(tuned.maxSpeed * KMH)} km/h`], ['Curva', `${tuned.lateralG.toFixed(2).replace('.', ',')} g`], ['Revenda', money(sellValue(car))]], 12, 15);
  ink(c, 'PINTURA', x + 4, 129, 5, GREY);
  const cur = paintIdx(car.id) ?? nearestPaint(car.color);
  swatchRects().forEach((r, i) => {
    c.fillStyle = i === cur ? RED : INK;
    c.fillRect(r.x - 1, r.y - 1, r.w + 2, r.h + 2);
    c.fillStyle = PAINTS[i].hex;
    c.fillRect(r.x, r.y, r.w, r.h);
  });
  // peças à venda, como num catálogo
  const lv = levels(cs, car.id);
  upgradeRows().forEach((r, i) => {
    const u = UPGRADES[i];
    const l = lv[u.id];
    c.fillStyle = '#f6efdd';
    c.fillRect(r.x, r.y, r.w, r.h);
    c.strokeStyle = 'rgba(26,22,20,0.35)';
    c.lineWidth = 1;
    c.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1);
    ink(c, u.name.toUpperCase(), r.x + 5, r.y + 4, 5, INK);
    ink(c, u.desc, r.x + 5, r.y + 12, 5, GREY);
    for (let k = 0; k < MAX_LEVEL; k++) {
      c.fillStyle = INK;
      c.fillRect(r.x + 150 + k * 11, r.y + 5, 9, 10);
      c.fillStyle = k < l ? RED : '#f8f2e4';
      c.fillRect(r.x + 151 + k * 11, r.y + 6, 7, 8);
    }
    const cost = upgradeCost(car, l + 1);
    const can = l < MAX_LEVEL;
    const afford = cs.money >= cost;
    tag(c, { x: r.x + r.w - 84, y: r.y + 3, w: 80, h: 14 }, can ? `INSTALAR ${money(cost)}` : 'NO MÁXIMO', can && afford, 5);
  });
  tag(c, b.back, '◀ VOLTAR');
  tag(c, b.use, active ? 'EM USO' : 'USAR ESTE', !active);
  tag(c, b.dealer, 'CLASSIFICADOS ▶');
  toast(c, s);
}

function tapGarage(s: AppState, a: Actions, x: number, y: number) {
  const cs = s.career!;
  const cars = ownedCars(cs);
  const car = cars[ui.garage];
  const b = garageButtons();
  if (inside(x, y, b.prev) && cars.length > 1) ui.garage = (ui.garage + cars.length - 1) % cars.length;
  else if (inside(x, y, b.next) && cars.length > 1) ui.garage = (ui.garage + 1) % cars.length;
  else if (inside(x, y, b.back)) a.go('career');
  else if (inside(x, y, b.dealer)) a.go('dealer');
  else if (inside(x, y, b.use)) {
    cs.car = car.id;
    saveCareer(cs);
    flash(s, `${car.name} pronto para correr`);
  } else {
    swatchRects().forEach((r, i) => inside(x, y, { x: r.x - 2, y: r.y - 6, w: r.w + 4, h: r.h + 12 }) && setPaint(car.id, i));
    upgradeRows().forEach((r, i) => {
      if (!inside(x, y, r)) return;
      const u = UPGRADES[i];
      const lv = { ...levels(cs, car.id) };
      if (lv[u.id] >= MAX_LEVEL) return flash(s, 'Já está no máximo');
      const cost = upgradeCost(car, lv[u.id] + 1);
      if (cs.money < cost) return flash(s, `Falta ${money(cost - cs.money)}`);
      cs.money -= cost;
      lv[u.id]++;
      cs.upgrades[car.id] = lv;
      saveCareer(cs);
      flash(s, `${u.name} nível ${lv[u.id]} instalado!`);
    });
  }
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
    prev: { x: x + 4, y: 74, w: 16, h: 30 }, next: { x: x + 186, y: 74, w: 16, h: 30 },
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
  tag(c, b.prev, '◀');
  tag(c, b.next, '▶');
  const fr: Rect = { x: x + 208, y: 50, w: 108, h: 80 };
  box(c, fr, 'FICHA');
  specRows(c, fr, carRows(car).filter(([k]) => k !== 'Preço'), 9.4);
  accelChart(c, { x: x + 4, y: 136, w: 150, h: 66 }, car);
  verdictBox(c, { x: x + 160, y: 136, w: 156, h: 66 }, car);
  const price = priceOf(car);
  // preço em destaque, como anúncio
  burst(c, x + 170, 76, 20, ['SÓ', money(price)], YELLOW, RED, s.t);
  tag(c, b.back, first ? '◀ CAPA' : '◀ VOLTAR');
  if (owned) {
    const canSell = cs.owned.length > 1 && cs.car !== car.id;
    tag(c, b.buy, canSell ? `VENDER POR ${money(sellValue(car))}` : car.id === cs.car ? 'EM USO' : 'NA SUA GARAGEM');
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
  else if (inside(x, y, b.back)) a.go(cs.owned.length ? 'career' : 'title');
  else if (inside(x, y, b.buy)) {
    if (cs.owned.includes(car.id)) {
      if (cs.owned.length > 1 && cs.car !== car.id) {
        cs.owned = cs.owned.filter((id) => id !== car.id);
        cs.money += sellValue(car);
        delete cs.upgrades[car.id];
        saveCareer(cs);
        flash(s, `${car.name} vendido por ${money(sellValue(car))}`);
      }
      return;
    }
    const price = priceOf(car);
    if (cs.money < price) return flash(s, `Falta ${money(price - cs.money)}`);
    const first = cs.owned.length === 0;
    cs.money -= price;
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
  const reg = REGIONS[ui.region];
  const ev = reg.events[ui.event];
  const x = ox();
  paper(c);
  topBar(c, s, 'RESULTADO DO DESAFIO', cs);
  kicker(c, ev.name.toUpperCase(), x + 4, 20, INK);
  const title = res.gameOver ? 'SEUS CARROS ACABARAM' : res.won ? 'VOCÊ VENCEU!' : `${ev.driver.name.toUpperCase()} VENCEU`;
  headline(c, title, x + 4, 34, 8, res.won ? '#1a6a2a' : RED);
  helmet(c, x + SAFE_W - 20, 40, 10, ev.driver.paint, ui.event + 1);
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
  const car = carById(cs.car);
  photo(c, { x: x + 214, y: 64, w: 102, h: 62 }, () => drawCarSide(c, x + 218, 120, 94, car, paintHex(car.id)));
  let note = `Saldo: ${money(cs.money)}`;
  if (res.firstWin && ev.boss) {
    const next = regionsAfter(ui.region);
    const champion = REGIONS.every((r) => r.events.some((e) => e.boss && cs.done.includes(e.id)));
    note = next.length ? `LIBERADA: ${next.map((r) => r.name.toUpperCase()).join(' E ')}!` : champion ? 'VOCÊ É O CAMPEÃO DA CARREIRA!' : 'REGIÃO CONCLUÍDA!';
    burst(c, x + 266, 170, 30, ['CHEFÃO', 'DERROTADO!'], YELLOW, RED, s.t);
  }
  headline(c, note, x + 4, 166, res.firstWin && ev.boss ? 8 : 5, res.firstWin && ev.boss ? '#1a6a2a' : INK);
  if (Math.floor(s.t * 2) % 2) ink(c, 'TOQUE PARA CONTINUAR ▶', x + 160, 222, 5, RED, 'center');
  toast(c, s);
}

// ---------- roteamento ----------
export function openCareer(s: AppState, a: Actions) {
  if (!s.career) {
    s.career = newCareer();
    saveCareer(s.career);
  }
  if (!s.career.owned.length) {
    ui.dealer = DEALER_CARS.findIndex((c) => priceOf(c) <= s.career!.money);
    a.go('dealer');
  } else {
    // abre na região mais avançada liberada
    ui.region = REGIONS.reduce((best, _, i) => (regionUnlocked(s.career!, i) ? i : best), 0);
    a.go('career');
  }
}

export function drawCareerScreen(c: CanvasRenderingContext2D, s: AppState) {
  switch (s.screen) {
    case 'career': return drawCareer(c, s);
    case 'event': return drawEvent(c, s);
    case 'garage': return drawGarage(c, s);
    case 'dealer': return drawDealer(c, s);
    case 'careerEnd': return drawCareerEnd(c, s);
  }
}

export function tapCareerScreen(s: AppState, a: Actions, x: number, y: number) {
  switch (s.screen) {
    case 'career': return tapCareer(s, a, x, y);
    case 'event': return tapEvent(s, a, x, y);
    case 'garage': return tapGarage(s, a, x, y);
    case 'dealer': return tapDealer(s, a, x, y);
    case 'careerEnd': return a.go('career');
  }
}

export function keyCareerScreen(s: AppState, a: Actions, k: MenuKey) {
  const cs = s.career!;
  const b = (r: Rect) => tapCareerScreen(s, a, r.x + r.w / 2, r.y + r.h / 2);
  switch (s.screen) {
    case 'career':
      if (k === 'left') ui.region = (ui.region + REGIONS.length - 1) % REGIONS.length;
      if (k === 'right') ui.region = (ui.region + 1) % REGIONS.length;
      if (k === 'up') s.sel = (s.sel + 4) % 5;
      if (k === 'down') s.sel = (s.sel + 1) % 5;
      if (k === 'ok') pickEvent(s, a, s.sel);
      if (k === 'back') a.go('title');
      return;
    case 'event':
      if (k === 'ok') a.startEvent(ui.region, ui.event);
      if (k === 'back') a.go('career');
      return;
    case 'garage':
      if (k === 'left') b(garageButtons().prev);
      if (k === 'right') b(garageButtons().next);
      if (k === 'ok') b(garageButtons().use);
      if (k === 'back') a.go('career');
      return;
    case 'dealer':
      if (k === 'left') b(dealerButtons().prev);
      if (k === 'right') b(dealerButtons().next);
      if (k === 'up' || k === 'down') setDealerFilter(nextFilter(ui.filter, k === 'down' ? 1 : -1, (c2) => filtered(DEALER_CARS, c2).length > 0));
      if (k === 'ok') b(dealerButtons().buy);
      if (k === 'back') a.go(cs.owned.length ? 'career' : 'title');
      return;
    case 'careerEnd':
      if (k === 'ok' || k === 'back') a.go('career');
  }
}
