// Telas do modo Carreira: central (regiões e eventos), evento, garagem, concessionária e resultado.
import { SAFE_W, view, KMH } from './config';
import { CARS, drawCarSide } from './cars';
import {
  MAX_LEVEL, REGIONS, UPGRADES, carById, eventUnlocked, levels, newCareer, priceOf, regionUnlocked, saveCareer,
  sellValue, upgradeCost, type CareerSave, type EventResult,
} from './career';
import { PAINTS, nearestPaint, paintHex, paintIdx, setPaint } from './paint';
import type { AppState, Actions, MenuKey } from './screens';
import { ox, purpleBg, smallButton } from './screens';
import type { ThemeId } from './themes';
import { inside, panel, text, type Rect } from './ui';
import { formatTime } from './util';

const THEME_NAME: Record<ThemeId, string> = {
  forest: 'Floresta', farm: 'Fazenda', desert: 'Deserto', city: 'Cidade', mountain: 'Serra', snow: 'Neve', coast: 'Litoral',
};
const STYLE: Record<string, [string, string]> = {
  agressivo: ['AGRESSIVO', '#ff7a6a'], cauteloso: ['CAUTELOSO', '#8aff8a'], imprevisivel: ['IMPREVISÍVEL', '#ffe060'],
};
export const money = (v: number) => `$${Math.round(v).toLocaleString('pt-BR')}`;

// estado da interface da carreira (não vai para o save)
export const ui = { region: 0, event: 0, dealer: 0, garage: 0, msg: '', msgT: 0 };
function flash(s: AppState, msg: string) {
  ui.msg = msg;
  ui.msgT = s.t + 2.2;
}

function topBar(c: CanvasRenderingContext2D, s: AppState, title: string, cs: CareerSave) {
  const x = ox();
  panel(c, { x: x + 4, y: 4, w: SAFE_W - 8, h: 20 }, '#2a2060', '#100830');
  text(c, title, x + 12, 10, 8, '#ffd400', 'left', null);
  text(c, money(cs.money), x + SAFE_W - 12, 10, 8, '#8aff8a', 'right', null);
}

// aviso curto por cima de tudo (compra, falta de dinheiro etc.)
function toast(c: CanvasRenderingContext2D, s: AppState) {
  if (!ui.msg || s.t >= ui.msgT) return;
  const x = ox();
  panel(c, { x: x + 24, y: 92, w: SAFE_W - 48, h: 24 }, '#7a1010', '#300808');
  text(c, ui.msg, view.w / 2, 100, 5, '#fff', 'center', null);
}

// ---------- central da carreira ----------
const hubRows = () => [0, 1, 2, 3, 4].map((i): Rect => ({ x: ox() + 6, y: 56 + i * 29, w: SAFE_W - 12, h: 27 }));
const hubButtons = () => {
  const x = ox();
  return {
    prev: { x: x + 6, y: 28, w: 22, h: 24 }, next: { x: x + SAFE_W - 28, y: 28, w: 22, h: 24 },
    garage: { x: x + 6, y: 205, w: 96, h: 18 }, dealer: { x: x + 112, y: 205, w: 96, h: 18 }, back: { x: x + 218, y: 205, w: 96, h: 18 },
  };
};

export function drawCareer(c: CanvasRenderingContext2D, s: AppState) {
  const cs = s.career!;
  const x = ox();
  purpleBg(c, 'Carreira');
  topBar(c, s, `CARREIRA  ${carById(cs.car).name}`, cs);
  const ri = ui.region;
  const reg = REGIONS[ri];
  const b = hubButtons();
  const open = regionUnlocked(cs, ri);
  panel(c, { x: x + 32, y: 28, w: SAFE_W - 64, h: 24 }, open ? '#3c2f7a' : '#2a2a3a', '#1c1440');
  c.fillStyle = reg.color;
  c.fillRect(x + 36, 32, 6, 16);
  text(c, `${ri + 1}. ${reg.name}`, view.w / 2, 31, 8, open ? '#fff' : '#8a8aa0', 'center', null);
  text(c, open ? reg.desc : 'Vença o chefão da região anterior', view.w / 2, 43, 5, '#c8c0f0', 'center', null);
  smallButton(c, b.prev, '◀');
  smallButton(c, b.next, '▶');
  hubRows().forEach((r, ei) => {
    const ev = reg.events[ei];
    const done = cs.done.includes(ev.id);
    const can = eventUnlocked(cs, ri, ei);
    const hot = s.sel === ei && can;
    panel(c, r, hot ? '#6a5ec0' : can ? '#4e4290' : '#2c2a40', ev.boss ? '#a01818' : '#1c1440');
    // situação: vencido, liberado ou trancado
    c.fillStyle = done ? '#30c050' : can ? '#ffd400' : '#555566';
    c.fillRect(r.x + 5, r.y + 7, 12, 12);
    text(c, done ? 'V' : can ? '>' : 'X', r.x + 11, r.y + 9, 8, '#100830', 'center', null);
    text(c, ev.boss ? `CHEFÃO: ${ev.name}` : ev.name, r.x + 24, r.y + 5, 8, can ? '#fff' : '#77778a', 'left', null);
    text(c, `vs ${ev.driver.name} (${carById(ev.driver.car).name}) - ${ev.stages.length} trecho${ev.stages.length > 1 ? 's' : ''}`, r.x + 24, r.y + 17, 5, can ? '#d8d0ff' : '#66667a', 'left', null);
    text(c, money(done ? ev.prize / 2 : ev.prize), r.x + r.w - 6, r.y + 5, 8, can ? '#8aff8a' : '#55665a', 'right', null);
    if (done) text(c, 'REPETIR', r.x + r.w - 6, r.y + 17, 5, '#a8e0a8', 'right', null);
  });
  smallButton(c, b.garage, 'GARAGEM');
  smallButton(c, b.dealer, 'LOJA');
  smallButton(c, b.back, 'VOLTAR');
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
const eventButtons = () => ({ go: { x: ox() + 200, y: 208, w: 112, h: 20 }, back: { x: ox() + 8, y: 208, w: 96, h: 20 } });

export function drawEvent(c: CanvasRenderingContext2D, s: AppState) {
  const cs = s.career!;
  const reg = REGIONS[ui.region];
  const ev = reg.events[ui.event];
  const d = ev.driver;
  const x = ox();
  purpleBg(c, d.name);
  topBar(c, s, ev.boss ? 'CHEFÃO DA REGIÃO' : reg.name.toUpperCase(), cs);
  panel(c, { x: x + 6, y: 28, w: SAFE_W - 12, h: 176 }, '#2a2060', ev.boss ? '#a01818' : '#100830');
  text(c, ev.name, view.w / 2, 34, 8, '#ffd400', 'center', null);
  text(c, d.name, view.w / 2, 48, 16, ev.boss ? '#ff6a5a' : '#fff', 'center', '#100830');
  text(c, `"${d.quote}"`, view.w / 2, 68, 5, '#d8d0ff', 'center', null);
  const rc = carById(d.car);
  drawCarSide(c, x + 70, 132, 180, rc, d.paint);
  const [label, col] = STYLE[d.style];
  text(c, `${rc.name}  •  ${label}`, view.w / 2, 138, 5, col, 'center', null);
  // nível do piloto em estrelas (habilidade 0,88 a 1,02)
  const stars = Math.max(1, Math.min(5, Math.round((d.skill - 0.86) / 0.032)));
  text(c, 'NÍVEL', view.w / 2 - 34, 148, 5, '#ffd400', 'left', null);
  for (let k = 0; k < 5; k++) {
    c.fillStyle = k < stars ? '#ffd400' : '#3a3060';
    c.fillRect(view.w / 2 - 4 + k * 8, 148, 6, 6);
  }
  const trechos = ev.stages.map((st) => THEME_NAME[st.theme] + (st.night ? ' (noite)' : st.weather === 'rain' ? ' (chuva)' : st.weather === 'snow' ? ' (neve)' : '')).join(' > ');
  text(c, trechos, view.w / 2, 162, 5, '#c8c0f0', 'center', null);
  const done = cs.done.includes(ev.id);
  text(c, `Prêmio: ${money(done ? ev.prize / 2 : ev.prize)}${done ? ' (repetição)' : ''}`, view.w / 2, 176, 8, '#8aff8a', 'center', null);
  const lv = levels(cs, cs.car);
  text(c, `Seu carro: ${carById(cs.car).name}  M${lv.motor} C${lv.cambio} P${lv.pneus}`, view.w / 2, 190, 5, '#d8d0ff', 'center', null);
  const b = eventButtons();
  smallButton(c, b.back, '◀ VOLTAR');
  smallButton(c, b.go, 'CORRER ▶', Math.floor(s.t * 2) % 2 === 0);
  toast(c, s);
}

function tapEvent(s: AppState, a: Actions, x: number, y: number) {
  const b = eventButtons();
  if (inside(x, y, b.go)) a.startEvent(ui.region, ui.event);
  else if (inside(x, y, b.back)) a.go('career');
}

// ---------- garagem ----------
const swatchRects = (): Rect[] => PAINTS.map((_, i) => ({ x: ox() + 40 + i * 24, y: 112, w: 18, h: 10 }));
const upgradeRows = () => [0, 1, 2].map((i): Rect => ({ x: ox() + 6, y: 130 + i * 24, w: SAFE_W - 12, h: 22 }));
const garageButtons = () => {
  const x = ox();
  return {
    prev: { x: x + 6, y: 50, w: 22, h: 30 }, next: { x: x + SAFE_W - 28, y: 50, w: 22, h: 30 },
    use: { x: x + 112, y: 206, w: 96, h: 18 }, back: { x: x + 8, y: 206, w: 96, h: 18 }, dealer: { x: x + 216, y: 206, w: 96, h: 18 },
  };
};
const ownedCars = (cs: CareerSave) => CARS.filter((c) => cs.owned.includes(c.id));

export function drawGarage(c: CanvasRenderingContext2D, s: AppState) {
  const cs = s.career!;
  const x = ox();
  purpleBg(c, 'Garagem');
  topBar(c, s, 'GARAGEM', cs);
  const cars = ownedCars(cs);
  ui.garage = Math.min(ui.garage, cars.length - 1);
  const car = cars[ui.garage];
  const active = car.id === cs.car;
  drawCarSide(c, x + 50, 104, 220, car, paintHex(car.id));
  text(c, car.name, view.w / 2, 28, 8, '#fff', 'center', '#100830');
  text(c, active ? 'EM USO' : `${ui.garage + 1}/${cars.length}`, view.w / 2, 40, 5, active ? '#8aff8a' : '#c8c0f0', 'center', null);
  const b = garageButtons();
  if (cars.length > 1) {
    smallButton(c, b.prev, '◀');
    smallButton(c, b.next, '▶');
  }
  const cur = paintIdx(car.id) ?? nearestPaint(car.color);
  swatchRects().forEach((r, i) => {
    c.fillStyle = i === cur ? '#fff' : '#1a1040';
    c.fillRect(r.x - 1, r.y - 1, r.w + 2, r.h + 2);
    c.fillStyle = PAINTS[i].hex;
    c.fillRect(r.x, r.y, r.w, r.h);
  });
  const lv = levels(cs, car.id);
  upgradeRows().forEach((r, i) => {
    const u = UPGRADES[i];
    const l = lv[u.id];
    panel(c, r, '#4e4290', '#1c1440');
    text(c, u.name, r.x + 6, r.y + 4, 8, '#fff', 'left', null);
    text(c, u.desc, r.x + 6, r.y + 14, 5, '#c8c0f0', 'left', null);
    for (let k = 0; k < MAX_LEVEL; k++) {
      c.fillStyle = k < l ? '#30e060' : '#2a2050';
      c.fillRect(r.x + 152 + k * 13, r.y + 6, 10, 10);
    }
    const cost = upgradeCost(car, l + 1);
    const can = l < MAX_LEVEL;
    panel(c, { x: r.x + r.w - 106, y: r.y + 3, w: 100, h: 16 }, can ? (cs.money >= cost ? '#2a8a3a' : '#5a3a3a') : '#3a3a4a', '#100830');
    text(c, can ? `+ ${money(cost)}` : 'MÁXIMO', r.x + r.w - 56, r.y + 7, 5, '#fff', 'center', null);
  });
  smallButton(c, b.back, '◀ VOLTAR');
  smallButton(c, b.use, active ? 'EM USO' : 'USAR ESTE', !active);
  smallButton(c, b.dealer, 'LOJA ▶');
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
const dealerButtons = () => {
  const x = ox();
  return {
    prev: { x: x + 6, y: 50, w: 22, h: 30 }, next: { x: x + SAFE_W - 28, y: 50, w: 22, h: 30 },
    buy: { x: x + 180, y: 206, w: 132, h: 18 }, back: { x: x + 8, y: 206, w: 96, h: 18 },
  };
};

export function drawDealer(c: CanvasRenderingContext2D, s: AppState) {
  const cs = s.career!;
  const x = ox();
  const first = cs.owned.length === 0;
  purpleBg(c, 'Loja');
  topBar(c, s, first ? 'ESCOLHA SEU PRIMEIRO CARRO' : 'CONCESSIONÁRIA', cs);
  const car = CARS[ui.dealer];
  const owned = cs.owned.includes(car.id);
  drawCarSide(c, x + 50, 104, 220, car, paintHex(car.id));
  text(c, car.name, view.w / 2, 28, 8, '#fff', 'center', '#100830');
  text(c, `${ui.dealer + 1}/${CARS.length}`, view.w / 2, 40, 5, '#c8c0f0', 'center', null);
  const b = dealerButtons();
  smallButton(c, b.prev, '◀');
  smallButton(c, b.next, '▶');
  panel(c, { x: x + 6, y: 112, w: SAFE_W - 12, h: 88 }, '#8c84c8', '#2a2060');
  const rows: [string, string][] = [
    ['Preço', car.price], ['Motor', car.engine], ['Potência', car.power],
    ['0-100', `${car.zeroTo100.toFixed(1).replace('.', ',')} s`], ['Máxima', `${Math.round(car.maxSpeed * KMH)} km/h`],
  ];
  rows.forEach(([k, v], i) => {
    text(c, k + ':', x + 100, 120 + i * 13, 8, '#2a2060', 'right', null);
    text(c, v, x + 106, 120 + i * 13, 8, '#100830', 'left', null);
  });
  const price = priceOf(car);
  smallButton(c, b.back, first ? '◀ SAIR' : '◀ VOLTAR');
  if (owned) {
    const canSell = cs.owned.length > 1 && cs.car !== car.id;
    smallButton(c, b.buy, canSell ? `VENDER ${money(sellValue(car))}` : car.id === cs.car ? 'EM USO' : 'NA GARAGEM');
  } else {
    const ok = cs.money >= price;
    smallButton(c, b.buy, ok ? `COMPRAR ${money(price)}` : `FALTA ${money(price - cs.money)}`, ok && Math.floor(s.t * 2) % 2 === 0);
  }
  toast(c, s);
}

function tapDealer(s: AppState, a: Actions, x: number, y: number) {
  const cs = s.career!;
  const b = dealerButtons();
  const car = CARS[ui.dealer];
  if (inside(x, y, b.prev)) ui.dealer = (ui.dealer + CARS.length - 1) % CARS.length;
  else if (inside(x, y, b.next)) ui.dealer = (ui.dealer + 1) % CARS.length;
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
  purpleBg(c, 'Resultado');
  topBar(c, s, reg.name.toUpperCase(), cs);
  panel(c, { x: x + 20, y: 30, w: SAFE_W - 40, h: 176 }, '#2a2060', '#100830');
  const title = res.gameOver ? 'SEUS CARROS ACABARAM' : res.won ? 'VOCÊ VENCEU!' : `${ev.driver.name.toUpperCase()} VENCEU`;
  text(c, title, view.w / 2, 38, 8, res.won ? '#ffd400' : '#ff6a5a', 'center');
  text(c, ev.name, view.w / 2, 52, 5, '#c8c0f0', 'center', null);
  const total = s.results.reduce((a2, r) => a2 + r.time, 0);
  const rival = s.results.reduce((a2, r) => a2 + Math.max(0, r.rival), 0);
  if (!res.gameOver) text(c, `Você ${formatTime(total)}   Rival ${formatTime(rival)}`, view.w / 2, 64, 5, '#fff', 'center', null);
  const lines: [string, number][] = [['Prêmio', res.prize], ['Bônus trecho limpo', res.clean], ['Multas', -res.fines], ['Conserto', -res.repairs]];
  lines.forEach(([k, v], i) => {
    text(c, k, x + 44, 82 + i * 14, 8, '#d8d0ff', 'left', null);
    text(c, (v < 0 ? '-' : '') + money(Math.abs(v)), x + SAFE_W - 44, 82 + i * 14, 8, v < 0 ? '#ff8a7a' : '#8aff8a', 'right', null);
  });
  c.fillStyle = '#6a5ec0';
  c.fillRect(x + 44, 138, SAFE_W - 88, 1);
  text(c, 'Total', x + 44, 144, 8, '#fff', 'left', null);
  text(c, (res.total < 0 ? '-' : '') + money(Math.abs(res.total)), x + SAFE_W - 44, 144, 8, res.total < 0 ? '#ff8a7a' : '#ffd400', 'right', null);
  let note = `Saldo: ${money(cs.money)}`;
  if (res.firstWin && ev.boss) {
    const next = REGIONS[ui.region + 1];
    note = next ? `NOVA REGIÃO LIBERADA: ${next.name.toUpperCase()}!` : 'VOCÊ É O CAMPEÃO DA CARREIRA!';
  }
  text(c, note, view.w / 2, 166, res.firstWin && ev.boss ? 8 : 5, res.firstWin && ev.boss ? '#30e060' : '#d8d0ff', 'center', null);
  if (Math.floor(s.t * 2) % 2) text(c, 'TOQUE PARA CONTINUAR', view.w / 2, 190, 5, '#ffd400', 'center', null);
  toast(c, s);
}

// ---------- roteamento ----------
export function openCareer(s: AppState, a: Actions) {
  if (!s.career) {
    s.career = newCareer();
    saveCareer(s.career);
  }
  if (!s.career.owned.length) {
    ui.dealer = CARS.findIndex((c) => priceOf(c) <= s.career!.money);
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
      if (k === 'ok') b(dealerButtons().buy);
      if (k === 'back') a.go(cs.owned.length ? 'career' : 'title');
      return;
    case 'careerEnd':
      if (k === 'ok' || k === 'back') a.go('career');
  }
}
