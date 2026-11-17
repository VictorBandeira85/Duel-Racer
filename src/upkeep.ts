// Manutenção da carreira: desgaste de pneus e motor por carro (wear.ts) e a REVISÃO paga na oficina.
// - healthOf: o estado do carro (save antigo ou carro sem registro = novo, 100%)
// - addUse: no fim de cada trecho a corrida desconta o uso (Race.use) do carro que correu
// - usedHealth: carro dos classificados já vem rodado (km do anúncio; pneus carecas / motor cansado)
// - revisão: pneus novos e motor revisado; preço pela classe (mão de obra) e pelo carro (peças)
// A garagem mostra os indicadores (PNEUS %, MOTOR %) na foto e o painel da revisão (drawService).
import { PERF_CLASSES, perfClass, type CarSpec, type PerfClass } from './cars';
import { priceOf, saveCareer, spend, wearOf, type CareerSave } from './career';
import { SAFE_W } from './config';
import { GREY, INK, RED, ink, tag } from './mag';
import { ox } from './screens';
import { inside, type Rect } from './ui';
import { isObj } from './util';
import { NEW_HEALTH, type Health, type Use } from './wear';

const num01 = (v: unknown, d = 1) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : d);
/** estado do carro (sempre conferido: valor estranho no save vira novo) */
export function healthOf(cs: CareerSave | null | undefined, id: string): Health {
  const h: unknown = isObj(cs?.health) ? cs!.health![id] : undefined;
  if (!isObj(h)) return { ...NEW_HEALTH };
  const o = h as Record<string, unknown>;
  return { tires: num01(o.tires), engine: num01(o.engine), km: typeof o.km === 'number' && Number.isFinite(o.km) ? Math.max(0, o.km) : 0 };
}
function setHealth(cs: CareerSave, id: string, h: Health) {
  cs.health = { ...(isObj(cs.health) ? cs.health : {}), [id]: { tires: +h.tires.toFixed(4), engine: +h.engine.toFixed(4), km: Math.round((h.km ?? 0) * 10) / 10 } };
}
/** porcentagem mostrada: com o defeito de usado equivalente, o defeito manda (pneus carecas ~15%) */
export function shownHealth(cs: CareerSave | null | undefined, id: string) {
  const h = healthOf(cs, id), d = wearOf(cs, id);
  return { tires: d.includes('pneus') ? Math.min(h.tires, 0.15) : h.tires, engine: d.includes('fumaca') ? Math.min(h.engine, 0.5) : h.engine, km: h.km ?? 0 };
}

/** fim do trecho: desconta o uso do carro que correu (e salva) */
export function addUse(cs: CareerSave, id: string, u: Use | undefined) {
  if (!u || !(u.km > 0 || u.tire > 0 || u.engine > 0)) return;
  const h = healthOf(cs, id);
  setHealth(cs, id, { tires: Math.max(0, h.tires - u.tire), engine: Math.max(0, h.engine - u.engine), km: (h.km ?? 0) + u.km });
  saveCareer(cs);
}
/** carro usado comprado: pneus e motor conforme o km e os defeitos do anúncio */
export function usedHealth(cs: CareerSave, id: string, km: number, defects: string[]) {
  setHealth(cs, id, {
    tires: defects.includes('pneus') ? 0.15 : Math.max(0.35, 0.85 - (km % 40000) / 80000),
    engine: defects.includes('fumaca') ? 0.5 : Math.max(0.6, 1 - km / 500000),
    km: Math.round(km % 10000),
  });
}
/** conserto de defeito do usado: pneus novos / retífica também zeram o desgaste correspondente */
export function afterRepair(cs: CareerSave, id: string, defect: string) {
  if (defect !== 'pneus' && defect !== 'fumaca') return;
  const h = healthOf(cs, id);
  setHealth(cs, id, defect === 'pneus' ? { ...h, tires: 1 } : { ...h, engine: 1 });
}
export function forgetHealth(cs: CareerSave, id: string) {
  if (isObj(cs.health)) delete cs.health![id];
}

// ---------- revisão ----------
const LABOR: Record<PerfClass, number> = { D: 300, C: 500, B: 900, A: 1500, S: 2500 };
/** preço da revisão: mão de obra pela classe do carro + pneus (3% do 0 km o jogo) e motor (8%) pelo gasto */
export function serviceCost(car: CarSpec, h: { tires: number; engine: number }) {
  const parts = priceOf(car) * (0.03 * (1 - h.tires) + 0.08 * (1 - h.engine));
  const cls = perfClass(car);
  return Math.round((LABOR[PERF_CLASSES.includes(cls) ? cls : 'D'] + parts) / 100) * 100;
}
export const needsService = (h: { tires: number; engine: number }) => h.tires < 0.995 || h.engine < 0.995;
/** faz a revisão (paga): pneus novos (tira o defeito de pneus carecas) e motor revisado. O motor
 * cansado do usado (fumaça) continua sendo conserto de retífica (CONSERTOS) */
export function doService(cs: CareerSave, car: CarSpec): string {
  const h = shownHealth(cs, car.id);
  if (!needsService(h)) return 'Revisão em dia: nada a fazer';
  const cost = serviceCost(car, h);
  if (cs.money < cost) return `Falta $${Math.round(cost - cs.money).toLocaleString('pt-BR')}`;
  cs.money -= cost;
  spend(cs, cost);
  const smoke = wearOf(cs, car.id).includes('fumaca');
  setHealth(cs, car.id, { tires: 1, engine: 1, km: 0 });
  if (cs.wear?.[car.id]) {
    cs.wear[car.id] = cs.wear[car.id].filter((d) => d !== 'pneus');
    if (!cs.wear[car.id].length) delete cs.wear[car.id];
  }
  saveCareer(cs);
  return smoke ? 'Revisão feita! (a fumaça é com a retífica)' : 'Revisão feita: pneus novos e motor em dia!';
}

// ---------- garagem: indicadores e painel ----------
export const svc = { open: false };
const pctColor = (v: number) => (v >= 0.75 ? '#2a9a3a' : v >= 0.45 ? '#d8a010' : RED);
/** indicadores na foto do carro (canto de cima, à esquerda): PNEUS e MOTOR com barrinha */
export function drawHealthChips(c: CanvasRenderingContext2D, cs: CareerSave, car: CarSpec, x: number, y: number) {
  const h = shownHealth(cs, car.id);
  [['PNEUS', h.tires], ['MOTOR', h.engine]].forEach(([k, v], i) => {
    const cx = x + i * 56, val = v as number;
    c.fillStyle = 'rgba(20,16,14,0.78)';
    c.fillRect(cx, y, 53, 9);
    ink(c, k as string, cx + 2, y + 2.5, 4, '#e8e0cc');
    c.fillStyle = '#3a342e';
    c.fillRect(cx + 24, y + 3, 12, 3);
    c.fillStyle = pctColor(val);
    c.fillRect(cx + 24, y + 3, Math.max(1, Math.round(12 * val)), 3);
    ink(c, `${Math.round(val * 100)}%`, cx + 51, y + 2.5, 4, val < 0.45 ? '#ff8a80' : '#fff', 'right');
  });
}
export const serviceButtons = () => ({ back: { x: ox() + 4, y: 211, w: 100, h: 15 } as Rect, ok: { x: ox() + 186, y: 211, w: 130, h: 15 } as Rect });
const bar = (c: CanvasRenderingContext2D, x: number, y: number, w: number, v: number) => {
  c.fillStyle = INK;
  c.fillRect(x - 1, y - 1, w + 2, 8);
  c.fillStyle = '#d8ccb4';
  c.fillRect(x, y, w, 6);
  c.fillStyle = pctColor(v);
  c.fillRect(x, y, Math.round(w * v), 6);
  // marcas a cada 25%, como régua
  c.fillStyle = 'rgba(26,22,20,0.45)';
  for (let k = 1; k < 4; k++) c.fillRect(x + Math.round((w * k) / 4), y, 1, 6);
};
export function drawService(c: CanvasRenderingContext2D, cs: CareerSave, car: CarSpec) {
  const x = ox();
  const h = shownHealth(cs, car.id);
  c.fillStyle = '#f6efdd';
  c.fillRect(x + 4, 139, SAFE_W - 8, 70);
  c.strokeStyle = RED;
  c.lineWidth = 1;
  c.strokeRect(x + 4.5, 139.5, SAFE_W - 9, 69);
  ink(c, 'REVISÃO', x + 9, 143, 5, RED);
  ink(c, `${Math.round(h.km).toLocaleString('pt-BR')} km desde a última revisão`, x + SAFE_W - 9, 143, 4, GREY, 'right');
  const rows: [string, number, string][] = [
    ['Pneus', h.tires, h.tires < 0.45 ? 'carecas: escorrega e freia mal' : h.tires < 0.75 ? 'meia-vida: menos aderência' : 'bons'],
    ['Motor', h.engine, h.engine < 0.45 ? 'cansado: perde força' : h.engine < 0.75 ? 'perdendo um pouco de força' : 'em forma'],
  ];
  rows.forEach(([k, v, note], i) => {
    const y = 156 + i * 16;
    ink(c, k, x + 9, y, 5, INK);
    bar(c, x + 52, y - 0.5, 110, v);
    ink(c, `${Math.round(v * 100)}%`, x + 168, y, 5, v < 0.45 ? RED : INK);
    ink(c, note, x + 196, y + 0.5, 4, GREY);
  });
  const cost = serviceCost(car, h);
  const need = needsService(h);
  ink(c, need ? `Pneus novos, óleo, filtros e regulagem: ${'$' + cost.toLocaleString('pt-BR')}` : 'Tudo em dia: nada a fazer.', x + 9, 192, 5, need ? INK : '#1a6a2a');
  if (wearOf(cs, car.id).includes('fumaca')) ink(c, 'fumaça: só com a retífica (consertos)', x + SAFE_W - 9, 200, 4, RED, 'right');
  const b = serviceButtons();
  tag(c, b.back, '◀ VOLTAR');
  if (need) tag(c, b.ok, `FAZER REVISÃO $${cost.toLocaleString('pt-BR')}`, cs.money >= cost, cost >= 100000 ? 4 : 5);
}
/** toque no painel: devolve a mensagem para o aviso (ou '' se não fez nada) */
export function tapService(cs: CareerSave, car: CarSpec, x: number, y: number): string {
  const b = serviceButtons();
  if (inside(x, y, b.back)) {
    svc.open = false;
    return '';
  }
  if (inside(x, y, b.ok)) return doService(cs, car);
  return '';
}
