// Showroom: os carros à venda como página de classificados da revista. Filtros por classe,
// marca e potência; cada anúncio abre o anúncio completo (foto, ficha, gráfico e preço) com
// o botão de compra. A compra vai para a garagem da carreira (o saldo é o da carreira).
import { carSwap } from './carswap';
import { SAFE_W, KMH } from './config';
import { DEALER_CARS, drawCarSide, perfClass, type CarSpec } from './cars';
import { classBadge, drawFilter, filterAt, filterRects, nextFilter, type ClassFilter } from './classui';
import { newCareer, priceOf, saveCareer } from './career';
import { flash, money, toast, topBar } from './careerScreens';
import { BRANDS, brandOf, drawLogo } from './brands';
import { paintHex } from './paint';
import type { AppState, Actions, MenuKey, ScreenId } from './screens';
import { accelChart, carRows, carStars, ox, verdictBox } from './screens';
import { GREY, INK, RED, YELLOW, arrow, box, burst, headline, ink, kicker, paper, photo, specRows, stars, tag } from './mag';
import { inside, type Rect } from './ui';

// faixas de potência (cv)
const POWER = [
  { label: 'TODAS', min: 0, max: 1e9 },
  { label: 'ATÉ 100 CV', min: 0, max: 100 },
  { label: '100 A 150', min: 100, max: 150 },
  { label: '150 A 250', min: 150, max: 250 },
  { label: '250 A 400', min: 250, max: 400 },
  { label: '400+ CV', min: 400, max: 1e9 },
];
const cv = (car: CarSpec) => parseInt(car.power, 10) || 0;

export const show = {
  cls: null as ClassFilter,
  brand: '', // '' = todas
  power: 0,
  page: 0,
  sel: 0, // anúncio marcado (teclado)
  detail: '', // id do carro aberto no anúncio completo ('' = lista)
  back: 'title' as ScreenId,
};

// marcas que têm carro à venda, na ordem do arquivo
const brandIds = () => Object.keys(BRANDS).filter((b) => DEALER_CARS.some((c) => brandOf(c.id)?.id === b));

// lista filtrada, do mais barato ao mais caro
function listing(cls = show.cls, brand = show.brand, power = show.power) {
  const p = POWER[power];
  return DEALER_CARS
    .filter((c) => (!cls || perfClass(c) === cls) && (!brand || brandOf(c.id)?.id === brand) && cv(c) >= p.min && cv(c) < p.max)
    .sort((a, b) => priceOf(a) - priceOf(b));
}

const PER_PAGE = 6;
const cards = () => {
  const x = ox();
  return Array.from({ length: PER_PAGE }, (_, i): Rect => ({ x: x + 4 + (i % 3) * 105, y: 50 + Math.floor(i / 3) * 79, w: 102, h: 76 }));
};
const listUi = () => {
  const x = ox();
  return {
    cls: filterRects(x + 4, 35, 138, 11),
    brand: { x: x + 148, y: 35, w: 84, h: 11 } as Rect,
    power: { x: x + 236, y: 35, w: 80, h: 11 } as Rect,
    back: { x: x + 4, y: 211, w: 90, h: 15 } as Rect,
    prev: { x: x + 136, y: 211, w: 14, h: 15 } as Rect,
    next: { x: x + 170, y: 211, w: 14, h: 15 } as Rect,
  };
};
const detailUi = () => {
  const x = ox();
  return { back: { x: x + 4, y: 211, w: 100, h: 15 } as Rect, buy: { x: x + 186, y: 211, w: 130, h: 15 } as Rect };
};

// abre o showroom (a carreira é criada se ainda não existir: o saldo e a garagem são dela)
export function openShowroom(s: AppState, a: Actions, carId = '', back: ScreenId = 'title') {
  if (!s.career) {
    s.career = newCareer();
    saveCareer(s.career);
  }
  show.back = back;
  show.detail = carId;
  if (carId) {
    // o filtro não pode esconder o carro pedido
    const car = DEALER_CARS.find((c) => c.id === carId);
    if (!car) show.detail = '';
    else if (!listing().includes(car)) Object.assign(show, { cls: null, brand: '', power: 0 });
  }
  a.go('showroom');
}

// ficha de filtro: rótulo pequeno em cima, valor dentro
function chip(c: CanvasRenderingContext2D, r: Rect, label: string, on: boolean) {
  c.fillStyle = on ? RED : INK;
  c.fillRect(r.x - 1, r.y - 1, r.w + 2, r.h + 2);
  c.fillStyle = on ? YELLOW : '#f6efdd';
  c.fillRect(r.x, r.y, r.w, r.h);
  ink(c, label, r.x + r.w / 2, r.y + 3, 5, INK, 'center');
}

function drawList(c: CanvasRenderingContext2D, s: AppState) {
  const cs = s.career!;
  const x = ox();
  const u = listUi();
  topBar(c, s, 'SHOWROOM', cs);
  kicker(c, 'CLASSIFICADOS', x + 4, 20, RED, '#fff');
  const all = listing();
  ink(c, `${all.length} anúncio${all.length === 1 ? '' : 's'}`, x + 90, 22, 5, GREY);
  // filtros: classe, marca e potência
  ink(c, 'CLASSE', u.cls[0].x, 30, 4, GREY);
  drawFilter(c, u.cls, show.cls, (k) => listing(k).length);
  ink(c, 'MARCA', u.brand.x, 30, 4, GREY);
  const br = show.brand ? BRANDS[show.brand] : undefined;
  chip(c, u.brand, br ? `  ${br.name.toUpperCase()}` : 'TODAS', !!br);
  if (br) drawLogo(c, br, u.brand.x + 3, u.brand.y + 1, 1);
  ink(c, 'POTÊNCIA', u.power.x, 30, 4, GREY);
  chip(c, u.power, POWER[show.power].label, show.power > 0);
  // página de anúncios
  const pages = Math.max(1, Math.ceil(all.length / PER_PAGE));
  show.page = Math.min(show.page, pages - 1);
  show.sel = Math.min(show.sel, Math.max(0, Math.min(PER_PAGE, all.length - show.page * PER_PAGE) - 1));
  if (!all.length) {
    ink(c, 'Nenhum carro com esses filtros', x + SAFE_W / 2, 110, 5, GREY, 'center');
    ink(c, 'Toque em TODAS para limpar', x + SAFE_W / 2, 122, 5, GREY, 'center');
  }
  cards().forEach((r, i) => {
    const car = all[show.page * PER_PAGE + i];
    if (!car) return;
    adCard(c, s, r, car, cs.owned.includes(car.id), i === show.sel);
  });
  if (pages > 1) {
    arrow(c, u.prev, 'left', true);
    arrow(c, u.next, 'right', true);
    ink(c, `${show.page + 1}/${pages}`, x + 160, 216, 5, INK, 'center');
  }
  tag(c, u.back, '◀ VOLTAR');
  ink(c, 'Toque no anúncio', x + SAFE_W - 4, 213, 4, GREY, 'right');
  ink(c, 'para ver tudo', x + SAFE_W - 4, 220, 4, GREY, 'right');
}

// anúncio pequeno: moldura fina, VENDE-SE, foto, nome, marca, números e o preço
function adCard(c: CanvasRenderingContext2D, s: AppState, r: Rect, car: CarSpec, owned: boolean, hot: boolean) {
  c.fillStyle = hot ? RED : INK;
  c.fillRect(r.x - 1, r.y - 1, r.w + 2, r.h + 2);
  c.fillStyle = '#f8f2e2';
  c.fillRect(r.x, r.y, r.w, r.h);
  classBadge(c, r.x + 2, r.y + 2, car, false, 6);
  ink(c, owned ? 'NA GARAGEM' : 'VENDE-SE', r.x + 11, r.y + 3, 4, owned ? '#1a6a2a' : RED);
  const b = brandOf(car.id);
  drawLogo(c, b, r.x + r.w - 11, r.y + 1, 1);
  const ph: Rect = { x: r.x + 3, y: r.y + 11, w: r.w - 6, h: 32 };
  photo(c, ph, () => drawCarSide(c, ph.x + 4, ph.y + 29, ph.w - 8, car, paintHex(car.id)), ['#5e6670', '#c8cdd2']);
  ink(c, car.name.toUpperCase(), r.x + 3, r.y + 46, 5, INK);
  ink(c, (b?.name ?? '').toUpperCase(), r.x + 3, r.y + 53, 4, INK);
  ink(c, `${car.power} • ${Math.round(car.maxSpeed * KMH)} km/h`, r.x + 3, r.y + 59, 4, GREY);
  c.fillStyle = owned ? '#1a6a2a' : RED;
  c.fillRect(r.x, r.y + r.h - 12, r.w, 12);
  ink(c, owned ? 'É SEU' : money(priceOf(car)), r.x + 4, r.y + r.h - 9, 5, owned ? '#fff' : YELLOW);
  if (s.career!.car === car.id) ink(c, 'EM USO', r.x + r.w - 4, r.y + r.h - 9, 4, '#fff', 'right');
}

function drawDetail(c: CanvasRenderingContext2D, s: AppState, car: CarSpec) {
  const cs = s.career!;
  const x = ox();
  const owned = cs.owned.includes(car.id);
  topBar(c, s, 'SHOWROOM', cs);
  kicker(c, owned ? 'NA SUA GARAGEM' : 'VENDE-SE', x + 4, 20, owned ? '#1a6a2a' : RED, '#fff');
  const b = brandOf(car.id);
  if (b) {
    drawLogo(c, b, x + 4, 31, 2);
    kicker(c, b.name.toUpperCase(), x + 26, 32, INK, '#efe6d2');
  }
  headline(c, car.name.toUpperCase(), x + (b ? 26 : 4), 43, 8, INK);
  classBadge(c, x + 150, 31, car, true, 9);
  stars(c, x + 150, 44, carStars(car), 5);
  const ph: Rect = { x: x + 4, y: 56, w: 198, h: 70 };
  photo(c, ph, () => {
    const sw = carSwap('showroom', car, s.t); // o carro chega rodando (e sai acelerando ao trocar)
    drawCarSide(c, ph.x + 8 + sw.dx * ph.w, ph.y + 64, 182, sw.car, paintHex(sw.car.id), sw.roll ? (sw.roll * ph.w) / (0.058 * 182) : undefined);
  });
  const fr: Rect = { x: x + 208, y: 50, w: 108, h: 80 };
  box(c, fr, 'FICHA');
  specRows(c, fr, carRows(car).filter(([k]) => k !== 'Preço'), 9.4);
  accelChart(c, { x: x + 4, y: 136, w: 150, h: 66 }, car);
  verdictBox(c, { x: x + 160, y: 136, w: 156, h: 66 }, car);
  if (!owned) burst(c, x + 168, 80, 27, ['SÓ', money(priceOf(car))], YELLOW, RED, s.t);
  // texto miúdo de classificado
  ink(c, `Único dono, revisado. Tratar c/ ${b?.name ?? 'loja'} Motors.`, x + 4, 204, 4, GREY);
  const u = detailUi();
  tag(c, u.back, '◀ ANÚNCIOS');
  const price = priceOf(car);
  if (owned) tag(c, u.buy, cs.car === car.id ? 'EM USO NA CARREIRA' : 'USAR NA CARREIRA');
  else {
    const ok = cs.money >= price;
    tag(c, u.buy, ok ? `COMPRAR ${money(price)}` : `FALTA ${money(price - cs.money)}`, ok && Math.floor(s.t * 2) % 2 === 0);
  }
}

export function drawShowroom(c: CanvasRenderingContext2D, s: AppState) {
  const car = show.detail ? DEALER_CARS.find((cc) => cc.id === show.detail) : undefined;
  paper(c);
  if (car) drawDetail(c, s, car);
  else drawList(c, s);
  toast(c, s);
}

function buy(s: AppState, car: CarSpec) {
  const cs = s.career!;
  if (cs.owned.includes(car.id)) {
    if (cs.car !== car.id) {
      cs.car = car.id;
      saveCareer(cs);
      flash(s, `${car.name} pronto para correr`);
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
  flash(s, first ? `${car.name} é seu! Boa carreira.` : `${car.name} comprado! Já está na garagem.`);
}

const cycle = (n: number, i: number, d: number) => (i + d + n) % n;

export function tapShowroom(s: AppState, a: Actions, x: number, y: number) {
  const car = show.detail ? DEALER_CARS.find((cc) => cc.id === show.detail) : undefined;
  if (car) {
    const u = detailUi();
    if (inside(x, y, u.back)) show.detail = '';
    else if (inside(x, y, u.buy)) buy(s, car);
    return;
  }
  const u = listUi();
  const all = listing();
  const pages = Math.max(1, Math.ceil(all.length / PER_PAGE));
  const f = filterAt(u.cls, x, y);
  if (f !== undefined) {
    if (f === null || listing(f).length) Object.assign(show, { cls: f, page: 0, sel: 0 });
  } else if (inside(x, y, u.brand)) {
    const ids = ['', ...brandIds()];
    show.brand = ids[cycle(ids.length, ids.indexOf(show.brand), 1)];
    Object.assign(show, { page: 0, sel: 0 });
  } else if (inside(x, y, u.power)) Object.assign(show, { power: cycle(POWER.length, show.power, 1), page: 0, sel: 0 });
  else if (inside(x, y, u.back)) a.go(show.back);
  else if (pages > 1 && inside(x, y, u.prev)) show.page = cycle(pages, show.page, -1);
  else if (pages > 1 && inside(x, y, u.next)) show.page = cycle(pages, show.page, 1);
  else cards().forEach((r, i) => {
    const cc = all[show.page * PER_PAGE + i];
    if (cc && inside(x, y, r)) show.detail = cc.id;
  });
}

export function keyShowroom(s: AppState, a: Actions, k: MenuKey) {
  if (show.detail) {
    if (k === 'back') show.detail = '';
    if (k === 'ok') tapShowroom(s, a, detailUi().buy.x + 4, detailUi().buy.y + 4);
    return;
  }
  const all = listing();
  const onPage = Math.max(0, Math.min(PER_PAGE, all.length - show.page * PER_PAGE));
  const pages = Math.max(1, Math.ceil(all.length / PER_PAGE));
  if (k === 'back') return a.go(show.back);
  if (k === 'ok' && onPage) show.detail = all[show.page * PER_PAGE + show.sel]?.id ?? '';
  if (k === 'left' || k === 'right') {
    const d = k === 'right' ? 1 : -1;
    const n = show.sel + d;
    if (n < 0 || n >= onPage) {
      // passa de página nas pontas
      show.page = cycle(pages, show.page, d);
      show.sel = d > 0 ? 0 : Math.max(0, Math.min(PER_PAGE, all.length - show.page * PER_PAGE) - 1);
    } else show.sel = n;
  }
  if (k === 'up' || k === 'down') {
    // cima/baixo trocam a classe (como na escolha do carro)
    show.cls = nextFilter(show.cls, k === 'down' ? 1 : -1, (c2) => listing(c2).length > 0);
    Object.assign(show, { page: 0, sel: 0 });
  }
}
