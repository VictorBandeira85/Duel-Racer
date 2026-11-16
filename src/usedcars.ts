// Mercado de usados da carreira (tela CLASSIFICADOS): anúncios de jornal com carros rodados e
// defeitos aparentes. Os defeitos aparecem no jogo pelo sistema de danos (src/damage.ts): lateral
// riscada/amassada, para-brisa trincado na cabine, fumaça do motor cansado; e pesam na ficha (wornCar).
import { DEALER_CARS, PERF_CLASSES, drawCarSide, perfClass, type CarSpec } from './cars';
import { DEFECTS, DEFECT_IDS, REGIONS, priceOf, regionUnlocked, repairCost, saveCareer, spend, wearOf, type CareerSave, type Defect } from './career';
import { drawSideDamage, type GlassMark } from './damage';
import { PAINTS, setPaint } from './paint';
import { rng } from './util';

export interface UsedAd { key: string; car: CarSpec; km: number; defects: Defect[]; price: number; paint: number; seller: string; phone: string; extra: string; sold: boolean }

const SELLERS = ['Seu Jorge', 'Dona Cida', 'Marquinhos', 'Tio Valdir', 'Rose', 'Juninho', 'Seu Arlindo', 'Cláudia', 'Pastor Edson', 'Alemão', 'Neide', 'Doutor Paulo'];
const EXTRAS = ['Único dono.', 'Aceito troca.', 'Doc. em dia.', 'Motivo: viagem.', 'Estudo proposta.', 'Som de fita.', 'Urgente!', 'Carro de garagem (quase).', 'IPVA pago.', 'Rodas de liga.'];

// classe mais alta liberada no campeonato: os usados não passam dela
function maxClass(cs: CareerSave) {
  let k = 0;
  REGIONS.forEach((r, i) => { if (regionUnlocked(cs, i)) k = Math.max(k, PERF_CLASSES.indexOf(r.cls)); });
  return k;
}

// Os seis anúncios da edição: mudam a cada corrida da carreira (semente = corridas feitas)
const adCache = { key: '', ads: [] as UsedAd[] };
export function usedAds(cs: CareerSave): UsedAd[] {
  const seed = cs.races ?? 0;
  const mc = maxClass(cs);
  const key = `${seed}|${mc}|${cs.owned.join(',')}|${(cs.usedSold ?? []).length}`;
  if (adCache.key === key) return adCache.ads;
  const r = rng(seed * 7919 + 1301);
  const pool = DEALER_CARS.filter((c) => !c.pendingArt && PERF_CLASSES.indexOf(perfClass(c)) <= mc);
  // sorteio sem repetição (os já comprados nesta edição aparecem como VENDIDO)
  const pick = [...pool];
  for (let i = pick.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [pick[i], pick[j]] = [pick[j], pick[i]];
  }
  const ads: UsedAd[] = [];
  for (const car of pick) {
    if (ads.length >= 6) break;
    const k = `${seed}:${car.id}`;
    const sold = (cs.usedSold ?? []).includes(k);
    if (cs.owned.includes(car.id) && !sold) continue; // modelo que o jogador já tem: fora
    const km = Math.round((30000 + r() * 170000) / 1000) * 1000;
    const n = 1 + Math.floor(r() * 3);
    const defects: Defect[] = [];
    while (defects.length < n) {
      const d = DEFECT_IDS[Math.floor(r() * DEFECT_IDS.length)];
      if (!defects.includes(d)) defects.push(d);
    }
    const fix = defects.reduce((t, d) => t + repairCost(car, d), 0);
    // preço: 74% do 0 km menos o km rodado, e o conserto pesa 1,3x (consertar compensa)
    const price = Math.max(Math.round((priceOf(car) * 0.2) / 500) * 500, Math.round((priceOf(car) * (0.74 - km / 700000) - fix * 1.3) / 500) * 500);
    ads.push({
      key: k, car, km, defects, price, paint: Math.floor(r() * 10), seller: SELLERS[Math.floor(r() * SELLERS.length)],
      phone: `${200 + Math.floor(r() * 700)}-${String(1000 + Math.floor(r() * 9000))}`, extra: EXTRAS[Math.floor(r() * EXTRAS.length)], sold,
    });
  }
  adCache.key = key;
  adCache.ads = ads;
  return ads;
}

// compra do usado: entra na garagem com os defeitos e o km do anúncio (e a cor do anúncio)
export function buyUsed(cs: CareerSave, ad: UsedAd): string {
  if (ad.sold) return 'Esse já foi vendido';
  if (cs.owned.includes(ad.car.id)) return 'Você já tem esse modelo';
  if (cs.money < ad.price) return `Falta ${fmt(ad.price - cs.money)}`;
  cs.money -= ad.price;
  spend(cs, ad.price);
  cs.owned.push(ad.car.id);
  if (!cs.car) cs.car = ad.car.id;
  cs.wear = { ...(cs.wear ?? {}), [ad.car.id]: [...ad.defects] };
  cs.odo = { ...(cs.odo ?? {}), [ad.car.id]: ad.km };
  cs.usedSold = [...(cs.usedSold ?? []).slice(-40), ad.key];
  setPaint(ad.car.id, ad.paint);
  saveCareer(cs);
  return `${ad.car.name} usado comprado! Está na garagem.`;
}
// conserto de um defeito na oficina
export function repairDefect(cs: CareerSave, car: CarSpec, d: Defect): string {
  const cost = repairCost(car, d);
  if (cs.money < cost) return `Falta ${fmt(cost - cs.money)}`;
  cs.money -= cost;
  spend(cs, cost);
  cs.wear = { ...(cs.wear ?? {}), [car.id]: wearOf(cs, car.id).filter((x) => x !== d) };
  if (!cs.wear[car.id].length) delete cs.wear[car.id];
  saveCareer(cs);
  return `${DEFECTS[d].name}: consertado!`;
}
// carro vendido: o próximo do mesmo modelo vem sem os defeitos e o km deste
export function forgetCar(cs: CareerSave, id: string) {
  if (cs.wear) delete cs.wear[id];
  if (cs.odo) delete cs.odo[id];
}
const fmt = (v: number) => `$${Math.round(v).toLocaleString('pt-BR')}`;

// dano de fábrica do usado dentro da corrida (Race.wear): amassado entorta o capô visto da cabine,
// motor cansado solta fumaça, para-brisa trincado já vem com as trincas
export function raceWear(wear: Defect[], seed: number): { damage: number; smoke: number; glass: GlassMark[] } {
  const r = rng(seed);
  const glass: GlassMark[] = wear.includes('parabrisa')
    ? [
      { x: 0.24 + r() * 0.1, y: 0.5 + r() * 0.15, size: 0.7, seed: Math.floor(r() * 1e6), star: false },
      { x: 0.66 + r() * 0.1, y: 0.25 + r() * 0.15, size: 0.45, seed: Math.floor(r() * 1e6), star: true },
    ]
    : [];
  return { damage: wear.includes('amassado') ? 0.3 : 0, smoke: wear.includes('fumaca') ? 0.12 : 0, glass };
}

// pintura queimada de sol: a cor desbota para um tom pálido e acinzentado
export function fadedPaint(hex: string) {
  const n = parseInt(hex.slice(1), 16), m = 0xbdb3a0, k = 0.45;
  const ch = (s: number) => Math.round(((n >> s) & 255) * (1 - k) + ((m >> s) & 255) * k);
  return `#${((1 << 24) | (ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).slice(1)}`;
}
// marcas na lateral conforme os defeitos (0..1, a escala de drawSideDamage)
export function sideLevel(wear: Defect[]) {
  let v = 0;
  if (wear.includes('pintura')) v = Math.max(v, 0.3);
  if (wear.includes('amassado')) v = Math.max(v, 0.5);
  if (wear.includes('parabrisa')) v = Math.max(v, 0.6); // acima de 0,55 a trinca aparece no vidro da lateral
  return v;
}
const hashId = (s: string) => [...s].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) | 0, 7);

// Lateral do carro usado (anúncio, oficina): cor desbotada, riscos e amassados recortados pela arte,
// trinca no vidro e fumaça saindo do escapamento. Só um carro com marcas por tela (cache único do dano).
export function drawUsedSide(c: CanvasRenderingContext2D, x: number, y: number, len: number, car: CarSpec, paint: string | undefined, wear: Defect[], t = 0, spin?: number) {
  const base = paint ?? car.color;
  const shown = wear.includes('pintura') ? fadedPaint(base) : base;
  const draw = (g: CanvasRenderingContext2D, p?: string) => drawCarSide(g, x, y, len, car, p ?? shown, spin);
  const lv = sideLevel(wear);
  const k = len / 170;
  if (lv > 0.05) drawSideDamage(c, draw, { x: x - 6 * k, y: y - 96 * k, w: 184 * k, h: 106 * k }, lv, hashId(car.id + wear.join()));
  else draw(c);
  if (wear.includes('fumaca')) {
    // fumaça azulada do óleo queimado: bolinhas em pixel subindo da traseira (lado direito)
    for (let i = 0; i < 6; i++) {
      const ph = (t * 0.7 + i / 6) % 1;
      const px = x + len * 0.88 + ph * len * 0.08, py = y - len * 0.05 - ph * len * 0.14;
      const r = Math.max(1, Math.round((1 + ph * 3) * k));
      c.fillStyle = `rgba(78,84,96,${(0.85 * (1 - ph)).toFixed(2)})`;
      c.fillRect(Math.round(px - r), Math.round(py - r), r * 2, r * 2);
    }
  }
}
export const paintOfAd = (ad: UsedAd) => PAINTS[ad.paint]?.hex;
