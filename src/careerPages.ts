// Páginas extras da carreira: CLASSIFICADOS (carros usados com defeitos), ESTATÍSTICAS (revista) e o
// painel de consertos da oficina. Os cartões do adversário ficam em careerScreens.ts (evento e resultado).
import { CARS, drawCarSide, perfClass, type CarSpec } from './cars';
import { paintHex } from './paint';
import { classLetter } from './classui';
import { DEFECTS, REGIONS, carById, priceOf, repairCost, statsOf, wearOf, type CareerSave, type Defect } from './career';
import { flash, money, toast, topBar } from './careerScreens';
import { BLUE, GREY, INK, RED, box, ink, kicker, paper, photo, specRows, tag } from './mag';
import type { Actions, AppState, MenuKey, ScreenId } from './screens';
import { ox } from './screens';
import { inside, type Focusable, type FocusSet, type Rect } from './ui';
import { buyUsed, drawUsedSide, paintOfAd, repairDefect, usedAds, type UsedAd } from './usedcars';
import { formatTime } from './util';
import { SAFE_W } from './config';

// estado das páginas (não vai para o save)
export const pg = { ad: 0, back: 'careerMenu' as ScreenId, rec: 0, fix: false, fixRow: 0 };

// ---------- CLASSIFICADOS ----------
const adRects = () => [0, 1, 2, 3, 4, 5].map((i): Rect => ({ x: ox() + 4, y: 33 + i * 29, w: 150, h: 27 }));
const usedButtons = () => ({ back: { x: ox() + 4, y: 211, w: 100, h: 15 } as Rect, buy: { x: ox() + 196, y: 211, w: 120, h: 15 } as Rect });
export function openUsed(s: AppState, a: Actions, back: ScreenId) {
  pg.back = back;
  pg.ad = 0;
  a.go('usedCars');
  void s;
}

export function drawUsed(c: CanvasRenderingContext2D, s: AppState) {
  const cs = s.career!;
  const x = ox();
  paper(c, '#ece6d6');
  topBar(c, s, 'CLASSIFICADOS', cs);
  kicker(c, `VEÍCULOS USADOS · EDIÇÃO ${(cs.races ?? 0) + 1}`, x + 4, 20, INK, '#fff');
  const ads = usedAds(cs);
  pg.ad = Math.min(pg.ad, Math.max(0, ads.length - 1));
  // coluna de anúncios miúdos, como no jornal: nome em negrito, km, defeitos e o preço
  adRects().forEach((r, i) => {
    const ad = ads[i];
    if (!ad) return;
    const on = i === pg.ad;
    c.fillStyle = on ? '#fff8e4' : '#f6f1e2';
    c.fillRect(r.x, r.y, r.w, r.h);
    c.strokeStyle = on ? RED : 'rgba(26,22,20,0.55)';
    c.lineWidth = on ? 2 : 1;
    c.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1);
    classLetter(c, r.x + 3, r.y + 3, perfClass(ad.car), 8);
    ink(c, ad.car.name.toUpperCase(), r.x + 14, r.y + 4, 5, ad.sold ? GREY : INK);
    const dd = ad.defects.map((d) => DEFECTS[d].ad.split(/[ ,]/)[0]);
    ink(c, `${(ad.km / 1000).toFixed(0)} mil km · ${dd.slice(0, 2).join(', ')}${dd.length > 2 ? ' +1' : ''}`, r.x + 4, r.y + 12, 4, GREY);
    ink(c, money(ad.price), r.x + r.w - 4, r.y + 19, 5, ad.sold ? GREY : '#1a6a2a', 'right');
    ink(c, `Tel. ${ad.phone}`, r.x + 4, r.y + 20, 4, GREY);
    if (ad.sold) stamp(c, r.x + r.w / 2, r.y + 13, 'VENDIDO');
  });
  c.fillStyle = 'rgba(26,22,20,0.5)';
  c.fillRect(x + 158, 33, 1, 174);
  const ad = ads[pg.ad];
  if (!ad) {
    ink(c, 'Nenhum anúncio nesta edição.', x + 238, 100, 5, GREY, 'center');
  } else drawAdDetail(c, s, cs, ad);
  const b = usedButtons();
  tag(c, b.back, '◀ VOLTAR');
  if (ad) tag(c, b.buy, ad.sold ? 'VENDIDO' : cs.owned.includes(ad.car.id) ? 'JÁ É SEU' : `COMPRAR ${money(ad.price)}`, !ad.sold && cs.money >= ad.price);
  toast(c, s, 150);
}

function stamp(c: CanvasRenderingContext2D, cx: number, cy: number, s: string) {
  c.save();
  c.translate(cx, cy);
  c.rotate(-0.12);
  c.strokeStyle = RED;
  c.lineWidth = 1;
  c.strokeRect(-26.5, -6.5, 53, 12);
  ink(c, s, 0, -3, 5, RED, 'center');
  c.restore();
}

function drawAdDetail(c: CanvasRenderingContext2D, s: AppState, cs: CareerSave, ad: UsedAd) {
  const x = ox() + 162, w = SAFE_W - 166;
  const ph: Rect = { x, y: 33, w, h: 58 };
  photo(c, ph, () => drawUsedSide(c, ph.x + 6, ph.y + 53, w - 12, ad.car, paintOfAd(ad), ad.defects, s.t), ['#6a6458', '#c8bea8']);
  ink(c, ad.car.name.toUpperCase(), x, 96, 8, INK);
  ink(c, `${ad.km.toLocaleString('pt-BR')} km · classe ${perfClass(ad.car)} · ${ad.extra}`, x, 106, 4, GREY);
  // defeitos aparentes, com o que cada um faz no carro e quanto custa consertar
  ad.defects.forEach((d, i) => {
    const y = 115 + i * 13;
    c.fillStyle = RED;
    c.fillRect(x, y + 1, 3, 3);
    ink(c, DEFECTS[d].name, x + 6, y, 5, RED);
    ink(c, money(repairCost(ad.car, d)), x + w, y, 4, GREY, 'right'); // quanto custa consertar
    ink(c, DEFECTS[d].effect, x + 6, y + 7, 4, GREY);
  });
  const fix = ad.defects.reduce((t, d) => t + repairCost(ad.car, d), 0);
  const y = 158;
  ink(c, '0 KM', x, y, 4, GREY);
  ink(c, money(priceOf(ad.car)), x + 26, y, 4, GREY);
  c.fillStyle = GREY;
  c.fillRect(x + 25, y + 2, money(priceOf(ad.car)).length * 4 + 2, 1); // preço do 0 km riscado
  ink(c, `consertos ${money(fix)}`, x + w, y, 4, GREY, 'right');
  ink(c, 'PREÇO', x, y + 10, 5, INK);
  ink(c, money(ad.price), x + w, y + 8, 8, '#1a6a2a', 'right');
  ink(c, `Tratar c/ ${ad.seller}`, x, y + 22, 4, BLUE);
  if (cs.owned.includes(ad.car.id) && !ad.sold) ink(c, 'Você já tem esse modelo', x + w, y + 22, 4, RED, 'right');
  ink(c, 'Anúncios novos a cada corrida da carreira.', x, y + 32, 4, GREY);
}

function usedBuy(s: AppState) {
  const cs = s.career!;
  const ad = usedAds(cs)[pg.ad];
  if (!ad) return;
  flash(s, buyUsed(cs, ad));
}
export function tapUsed(s: AppState, a: Actions, x: number, y: number) {
  const b = usedButtons();
  if (inside(x, y, b.back)) return a.go(pg.back);
  if (inside(x, y, b.buy)) return usedBuy(s);
  adRects().forEach((r, i) => { if (inside(x, y, r) && usedAds(s.career!)[i]) pg.ad = i; });
}
export function keyUsed(s: AppState, a: Actions, k: MenuKey) {
  const n = usedAds(s.career!).length;
  if (k === 'up') pg.ad = (pg.ad + n - 1) % Math.max(1, n);
  if (k === 'down') pg.ad = (pg.ad + 1) % Math.max(1, n);
  if (k === 'back') a.go(pg.back);
}
export function usedFocusables(s: AppState, a: Actions): FocusSet {
  const ads = usedAds(s.career!), b = usedButtons();
  const rows = adRects().filter((_, i) => ads[i]).map((r, i): Focusable => ({ r, is: () => pg.ad === i, pick: () => { pg.ad = i; }, act: () => usedBuy(s) }));
  return { key: 'usedCars', items: [...rows, { r: b.back, act: () => a.go(pg.back) }, { r: b.buy, act: () => usedBuy(s) }], def: 0 };
}

// ---------- ESTATÍSTICAS ----------
const REC_PER_PAGE = 8;
const statButtons = () => ({ back: { x: ox() + 4, y: 211, w: 100, h: 15 } as Rect, more: { x: ox() + 216, y: 211, w: 100, h: 15 } as Rect });
const km = (v: number) => `${Math.round(v).toLocaleString('pt-BR')} km`;
// recordes: melhor tempo de cada evento vencido, na ordem do campeonato
function records(cs: CareerSave) {
  const st = statsOf(cs);
  const out: { name: string; t: number; car: string }[] = [];
  for (const r of REGIONS) for (const e of r.events) for (const id of [e.id, `${e.id}-rv`]) {
    const b = st.best[id];
    if (b) out.push({ name: id.endsWith('-rv') ? `${e.name} (rev.)` : e.name, t: b.t, car: b.car });
  }
  return out;
}
export function drawStats(c: CanvasRenderingContext2D, s: AppState) {
  const cs = s.career!;
  const st = statsOf(cs);
  const x = ox();
  paper(c);
  topBar(c, s, 'ESTATÍSTICAS', cs);
  kicker(c, 'FICHA DO PILOTO', x + 4, 20, RED, '#fff');
  const pct = st.events ? Math.round((st.eventWins / st.events) * 100) : 0;
  const L: Rect = { x: x + 4, y: 33, w: 154, h: 104 };
  box(c, L, 'NA ESTRADA');
  specRows(c, L, [
    ['Km rodados', km(st.km)], ['Trechos', String(st.stages)], ['Corridas', String(st.events)], ['Vitórias', String(st.eventWins)],
    ['Derrotas', String(st.eventLosses)], ['Aproveitamento', `${pct}%`], ['Batidas', String(st.crashes)], ['Motos no chão', String(st.falls)],
    ['Máxima', st.top ? `${Math.round(st.top)} km/h` : '-'],
  ], 10, 13);
  if (st.topCar) ink(c, `máxima com o ${carById(st.topCar)?.name ?? st.topCar}`, L.x + L.w - 3, L.y + L.h + 3, 4, GREY, 'right');
  const R: Rect = { x: x + 162, y: 33, w: 154, h: 74 };
  box(c, R, 'POLÍCIA E BOLSO', RED);
  specRows(c, R, [
    ['Multas', String(st.tickets)], ['Valor pago', money(st.finesPaid)], ['Fugas', String(st.escapes)],
    ['Dinheiro ganho', money(st.earned)], ['Dinheiro gasto', money(st.spent)], ['Saldo da carreira', `${st.earned - st.spent < 0 ? '-' : ''}${money(Math.abs(st.earned - st.spent))}`],
  ], 10, 13);
  // carro favorito: o que mais rodou
  const fav = Object.entries(st.carKm).sort((p, q) => q[1] - p[1])[0];
  const favCar = fav ? CARS.find((k) => k.id === fav[0]) : undefined;
  const ph: Rect = { x: x + 162, y: 112, w: 154, h: 40 };
  photo(c, ph, () => { if (favCar) drawCarSidePlain(c, ph.x + 27, ph.y + 37, 100, favCar); }, ['#3a5a8a', '#c8b89a']);
  ink(c, favCar ? `FAVORITO: ${favCar.name.toUpperCase()}` : 'FAVORITO: AINDA NENHUM', ph.x, ph.y + ph.h + 4, 4, INK);
  if (fav) ink(c, km(fav[1]), ph.x + ph.w, ph.y + ph.h + 4, 4, '#1a6a2a', 'right');
  // recordes por pista (evento)
  const recs = records(cs);
  const pages = Math.max(1, Math.ceil(recs.length / REC_PER_PAGE));
  pg.rec = Math.min(pg.rec, pages - 1);
  const B: Rect = { x: x + 4, y: 163, w: SAFE_W - 8, h: 45 };
  box(c, B, `RECORDES POR PISTA${pages > 1 ? ` (${pg.rec + 1}/${pages})` : ''}`, BLUE);
  if (!recs.length) ink(c, 'Vença um evento para gravar o seu tempo aqui.', B.x + B.w / 2, B.y + 22, 5, GREY, 'center');
  recs.slice(pg.rec * REC_PER_PAGE, (pg.rec + 1) * REC_PER_PAGE).forEach((r, i) => {
    const cx = B.x + 4 + (i % 2) * 156, cy = B.y + 13 + Math.floor(i / 2) * 8;
    ink(c, r.name.length > 20 ? `${r.name.slice(0, 19)}.` : r.name, cx, cy, 4, INK);
    ink(c, formatTime(r.t), cx + 148, cy, 4, RED, 'right');
  });
  const b = statButtons();
  tag(c, b.back, '◀ VOLTAR');
  if (pages > 1) tag(c, b.more, 'RECORDES ▶');
  toast(c, s);
}
function drawCarSidePlain(c: CanvasRenderingContext2D, x: number, y: number, len: number, car: CarSpec) {
  drawCarSide(c, x, y, len, car, paintHex(car.id)); // o favorito com a cor escolhida
}
export function tapStats(s: AppState, a: Actions, x: number, y: number) {
  const b = statButtons();
  if (inside(x, y, b.back)) return a.go(pg.back);
  if (inside(x, y, b.more)) pg.rec++;
  const pages = Math.max(1, Math.ceil(records(s.career!).length / REC_PER_PAGE));
  if (pg.rec >= pages) pg.rec = 0;
}
export function keyStats(s: AppState, a: Actions, k: MenuKey) {
  if (k === 'back') a.go(pg.back);
  if (k === 'right' || k === 'nextTab' || k === 'ok') tapStats(s, a, statButtons().more.x + 2, statButtons().more.y + 2);
}
export function statsFocusables(s: AppState, a: Actions): FocusSet {
  const b = statButtons();
  return { key: 'careerStats', items: [{ r: b.back, act: () => a.go(pg.back) }, { r: b.more, act: () => tapStats(s, a, b.more.x + 2, b.more.y + 2) }], def: 0 };
}

// ---------- oficina: consertos dos defeitos do usado ----------
export const fixTag = (): Rect => ({ x: ox() + 232, y: 125, w: 84, h: 11 });
const fixRows = (n: number) => Array.from({ length: n }, (_, i): Rect => ({ x: ox() + 4, y: 152 + i * 13, w: SAFE_W - 8, h: 12 }));
export const fixButtons = () => ({ back: { x: ox() + 4, y: 211, w: 100, h: 15 } as Rect, all: { x: ox() + 196, y: 211, w: 120, h: 15 } as Rect });
export function drawFixTag(c: CanvasRenderingContext2D, cs: CareerSave, car: CarSpec) {
  const n = wearOf(cs, car.id).length;
  if (n) tag(c, fixTag(), `CONSERTOS (${n}) ▶`, true, 4);
  const odo = cs.odo?.[car.id];
  if (odo !== undefined) ink(c, `${Math.round(odo).toLocaleString('pt-BR')} km rodados`, ox() + 202, 114, 4, '#fff', 'right');
}
export function drawFixPanel(c: CanvasRenderingContext2D, s: AppState, car: CarSpec) {
  const cs = s.career!;
  const x = ox();
  const wear = wearOf(cs, car.id);
  c.fillStyle = '#f6efdd';
  c.fillRect(x + 4, 139, SAFE_W - 8, 70);
  c.strokeStyle = RED;
  c.lineWidth = 1;
  c.strokeRect(x + 4.5, 139.5, SAFE_W - 9, 69);
  ink(c, 'FUNILARIA E MECÂNICA', x + 9, 143, 5, RED);
  ink(c, 'toque num defeito para consertar', x + SAFE_W - 9, 143, 4, GREY, 'right');
  if (!wear.length) ink(c, 'Tudo em ordem: nada para consertar.', x + SAFE_W / 2, 172, 5, '#1a6a2a', 'center');
  pg.fixRow = Math.min(pg.fixRow, Math.max(0, wear.length - 1));
  fixRows(wear.length).forEach((r, i) => {
    const d = wear[i], on = i === pg.fixRow;
    c.fillStyle = on ? '#fff1c8' : '#efe6d2';
    c.fillRect(r.x + 2, r.y, r.w - 4, r.h);
    ink(c, DEFECTS[d].name, r.x + 6, r.y + 3, 5, INK);
    ink(c, DEFECTS[d].effect, r.x + 128, r.y + 4, 4, GREY);
    ink(c, `${money(repairCost(car, d))} ▶`, r.x + r.w - 6, r.y + 3, 5, cs.money >= repairCost(car, d) ? '#1a6a2a' : RED, 'right');
  });
  const b = fixButtons();
  const all = wear.reduce((t, d) => t + repairCost(car, d), 0);
  tag(c, b.back, '◀ VOLTAR');
  if (wear.length) tag(c, b.all, `TUDO ${money(all)}`, cs.money >= all);
}
function fixOne(s: AppState, car: CarSpec, d: Defect | undefined) {
  if (d) flash(s, repairDefect(s.career!, car, d));
}
function fixAll(s: AppState, car: CarSpec) {
  const cs = s.career!;
  const wear = wearOf(cs, car.id);
  const all = wear.reduce((t, d) => t + repairCost(car, d), 0);
  if (!wear.length) return;
  if (cs.money < all) return flash(s, `Falta ${money(all - cs.money)}`);
  for (const d of wear) repairDefect(cs, car, d);
  flash(s, `${car.name} como novo!`);
}
export function tapFix(s: AppState, car: CarSpec, x: number, y: number) {
  const b = fixButtons();
  const wear = wearOf(s.career!, car.id);
  if (inside(x, y, b.back)) pg.fix = false;
  else if (inside(x, y, b.all)) fixAll(s, car);
  else fixRows(wear.length).forEach((r, i) => { if (inside(x, y, r)) { pg.fixRow = i; fixOne(s, car, wear[i]); } });
}
export function keyFix(s: AppState, car: CarSpec, k: MenuKey) {
  const n = wearOf(s.career!, car.id).length;
  if (k === 'up') pg.fixRow = (pg.fixRow + n - 1) % Math.max(1, n);
  if (k === 'down') pg.fixRow = (pg.fixRow + 1) % Math.max(1, n);
  if (k === 'ok') fixOne(s, car, wearOf(s.career!, car.id)[pg.fixRow]);
  if (k === 'back') pg.fix = false;
}
export function fixFocusables(s: AppState, car: CarSpec): FocusSet {
  const wear = wearOf(s.career!, car.id), b = fixButtons();
  const rows = fixRows(wear.length).map((r, i): Focusable => ({ r, is: () => pg.fixRow === i, pick: () => { pg.fixRow = i; }, act: () => fixOne(s, car, wearOf(s.career!, car.id)[i]) }));
  return { key: 'garage:fix', items: [...rows, { r: b.back, act: () => { pg.fix = false; } }, { r: b.all, act: () => fixAll(s, car) }] };
}
