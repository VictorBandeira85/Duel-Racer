// Rivalidade, rachas de rua e patrocínio (modo Carreira).
// - Cada rival lembra o histórico com o jogador (vitórias, derrotas, batidas). A cada derrota para o
//   jogador ele põe uma peça a mais no carro (escada pela personalidade, até MAX_HEAT degraus) e fica um
//   pouco mais afiado; as falas (entrevista, rádio na corrida e depois do resultado) usam o histórico.
// - Desafio na estrada: às vezes um rival já vencido espera parado no acostamento de um trecho e larga
//   quando o jogador chega; quem chegar primeiro ao posto leva o prêmio extra.
// - Racha de rua noturno: convite secreto (depois de algumas vitórias), um trecho à noite sem trânsito e
//   com mais polícia; aposta em dinheiro ou "o rosa" (o carro).
// - Patrocínio: marcas fictícias (src/assets/brands.json) pagam por corrida que cumpre a meta e um bônus
//   ao fim do contrato; o adesivo vai na lateral do carro do contrato.
import {
  REGIONS, RIVAL_BUILDS, carById, driverBuild, driverCar as driverCarOf, prizeOf, priceOf, regionUnlocked, rivalExtra, rivalSkillOf, saveCareer, setupOf, buildOf, statsOf, tunedCar, wearOf,
  type CareerEvent, type CareerSave, type Driver, type EventResult,
} from './career';
import { CARS, perfClass, sideHook, type CarSpec, type PerfClass } from './cars';
import { BRANDS, drawLogo } from './brands';
import { partOf, slotsFor, type Build, type SlotId } from './tuning';
import { KMH, SEG_LEN } from './config';
import { text } from './ui';
import { toast } from './challenges';
import { rivalOf } from './rivals';
import { nearestPaint, setPaint } from './paint';
import { isObj } from './util';
import type { ExtraDef, Race, RivalStyle } from './race';
import type { StageResult } from './screens';

// ---------- save ----------
// w: vitórias do jogador sobre ele; l: derrotas do jogador; hits: batidas do jogador correndo com ele
export interface RivalRec { w: number; l: number; hits: number; last?: 'w' | 'l' }
export type SponsorGoal = 'clean' | 'wins' | 'nofine' | 'avg';
// target: corridas que cumprem a meta para fechar o contrato; len: corridas de prazo; prog: cumpridas
export interface SponsorDeal { brand: string; goal: SponsorGoal; target: number; speed?: number; per: number; bonus: number; len: number; races: number; prog: number; paid: number; car: string }
// offer: convite pendente (id do evento do rival, aposta em dinheiro, válido até a corrida `until`)
export interface StreetState { offer?: { ev: string; bet: number; until: number; seen?: boolean }; n: number; won: number; lost: number }

const num = (v: unknown, d = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
interface Live { career: CareerSave | null; mode: string; screen: string }
let live: () => Live | null = () => null;
const getSave = () => live()?.career ?? null;
const getMode = () => live()?.mode ?? '';
// main.ts liga a rivalidade à carreira carregada (a ficha do rival muda com o histórico)
export function bindRivalry(state: () => Live) {
  live = state;
}

export function recOf(cs: CareerSave, name: string): RivalRec {
  const r = isObj(cs.rivals) ? (cs.rivals as Record<string, unknown>)[name] : undefined;
  if (!isObj(r)) return { w: 0, l: 0, hits: 0 };
  const o = r as Record<string, unknown>;
  return { w: Math.max(0, Math.floor(num(o.w))), l: Math.max(0, Math.floor(num(o.l))), hits: Math.max(0, Math.floor(num(o.hits))), ...(o.last === 'w' || o.last === 'l' ? { last: o.last } : {}) };
}
export function recordDuel(cs: CareerSave, name: string, playerWon: boolean, crashes = 0) {
  const r = recOf(cs, name);
  if (playerWon) r.w++;
  else r.l++;
  r.hits += Math.max(0, crashes | 0);
  r.last = playerWon ? 'w' : 'l';
  cs.rivals = { ...(isObj(cs.rivals) ? cs.rivals : {}), [name]: r };
}

// ---------- o rival se prepara ----------
// degraus de peças por personalidade: agressivo quer potência e barulho, cauteloso quer pneu, freio e
// suspensão, imprevisível mexe em tudo. No máximo MAX_HEAT degraus (não fica imbatível: a habilidade do
// preparado já é limitada ao ritmo do evento em rivalSkillOf).
export const MAX_HEAT = 4;
const HEAT_SKILL = 0.003; // habilidade a mais por degrau
const LADDER: Record<RivalStyle, [SlotId, string[]][]> = {
  agressivo: [['escape', ['esportivo']], ['comando', ['esportivo']], ['alimentacao', ['chip', 'duplo']], ['escape', ['semabafador']], ['pistoes', ['forjados']], ['comando', ['corrida']]],
  cauteloso: [['pneus', ['esportivo']], ['freios', ['esportivo']], ['suspensao', ['esportiva']], ['pneus', ['semislick']], ['freios', ['corrida']], ['bancos', ['concha']]],
  imprevisivel: [['alimentacao', ['chip', 'duplo']], ['bancos', ['forros']], ['escape', ['esportivo']], ['pneus', ['esportivo']], ['comando', ['esportivo']], ['suspensao', ['esportiva']]],
};
export const heatOf = (cs: CareerSave | null, name: string) => (cs ? Math.min(MAX_HEAT, recOf(cs, name).w) : 0);
const heatCache = new Map<string, { build?: Build; added: string[] }>();
// peças do rival com `lvl` degraus (as de RIVAL_BUILDS e as que ele pôs depois) e o nome das novas
export function heatBuild(d: Driver, lvl: number): { build?: Build; added: string[] } {
  const key = `${d.name}|${d.car}|${d.style}|${lvl}`;
  let v = heatCache.get(key);
  if (v) return v;
  const base = RIVAL_BUILDS[d.name];
  const car = CARS.find((c) => c.id === d.car);
  if (!lvl || !car) {
    heatCache.set(key, (v = { build: base, added: [] }));
    return v;
  }
  const b: Build = { ...(base ?? {}) };
  const added: string[] = [];
  for (const [slot, ids] of LADDER[d.style] ?? []) {
    if (added.length >= lvl) break;
    const sl = slotsFor(car, b).find((q) => q.id === slot);
    if (!sl) continue;
    const ti = sl.parts.findIndex((p) => ids.includes(p.id));
    const ci = Math.max(0, sl.parts.findIndex((p) => p.id === (b[slot] ?? '')));
    if (ti <= ci) continue;
    b[slot] = sl.parts[ti].id;
    const p = partOf(car, slot, b[slot]);
    added.push(slot === 'alimentacao' ? p.name.toLowerCase() : `${sl.name.toLowerCase()} ${p.name.toLowerCase()}`);
  }
  heatCache.set(key, (v = { build: b, added }));
  return v;
}
// a peça que ele vai pôr da próxima vez (fala depois de perder)
const nextPart = (d: Driver, lvl: number) => (lvl >= MAX_HEAT ? '' : heatBuild(d, lvl + 1).added[lvl] ?? '');
rivalExtra.build = (d) => {
  const lvl = heatOf(getSave(), d.name);
  return lvl ? heatBuild(d, lvl).build : undefined;
};
rivalExtra.skill = (d) => heatOf(getSave(), d.name) * HEAT_SKILL;

// ---------- falas com o histórico ----------
type Mood = 'none' | 'lead' | 'even' | 'revenge' | 'respect';
export function moodOf(cs: CareerSave, d: Driver): Mood {
  const r = recOf(cs, d.name);
  if (!r.w && !r.l) return 'none';
  if (r.l > r.w) return 'lead';
  if (r.w === r.l) return 'even';
  return r.w - r.l >= 3 ? 'respect' : 'revenge';
}
const pl = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const fill = (s: string, d: Driver, r: RivalRec, part: string) =>
  s.replace(/\{wv\}/g, pl(r.w, 'vez', 'vezes')).replace(/\{lv\}/g, pl(r.l, 'vez', 'vezes')).replace(/\{wd\}/g, pl(r.w, 'derrota engasgada', 'derrotas engasgadas'))
    .replace(/\{hv\}/g, pl(r.hits, 'vez', 'vezes')).replace(/\{wa\}/g, pl(r.w, 'derrota', 'derrotas')).replace(/\{w\}/g, String(r.w)).replace(/\{l\}/g, String(r.l)).replace(/\{h\}/g, String(r.hits)).replace(/\{p\}/g, part).replace(/\{n\}/g, rivalOf(d).nick);
const PRE: Record<Mood, Partial<Record<RivalStyle, string[]>> & { all: string[] }> = {
  none: { all: [] },
  lead: {
    all: ['Já te venci {lv}. Veio buscar mais uma?', 'O placar está {l} a {w} pra mim. Não se acostume a perder, não.'],
    agressivo: ['{l} a {w}. Se eu fosse você, nem largava.', 'Você bateu {hv} correndo comigo. Cuidado com o meu para-choque.'],
  },
  even: { all: ['{w} a {w}. Hoje sai o desempate.', 'Empatados. Hoje alguém sai da estrada com o rabo entre as pernas.'] },
  revenge: {
    all: ['Você me venceu {wv}. Hoje eu vim com {p}.', 'Pus {p} no carro só por sua causa.'],
    agressivo: ['{wd}. Hoje é vingança, com {p} e tudo.', 'Você vai ouvir o meu escape a noite inteira. Pus {p}.'],
    cauteloso: ['Aprendi com {wa}. Pus {p} e estudei cada curva.', 'Você é rápido, admito. Mas agora tenho {p}.'],
    imprevisivel: ['Mexi no carro de madrugada: {p}. Nem eu sei o que vai dar!', '{w} a {l} pra você? Hoje vira, juro pela minha mãe.'],
  },
  respect: {
    all: ['{w} vitórias suas. Respeito. Mas hoje o meu carro está outro.', 'Você virou a lenda da estrada. Correr com você já é uma honra.'],
    agressivo: ['{wv} você me venceu. Odeio admitir, mas você é bom.'],
    cauteloso: ['Tiro o chapéu: {w} vitórias. Vamos fazer uma corrida limpa.'],
  },
};
const pickLine = (m: Mood, st: RivalStyle, k: number) => {
  const L = [...(PRE[m][st] ?? []), ...PRE[m].all];
  return L.length ? L[k % L.length] : '';
};
// fala da entrevista antes da corrida (null: sem histórico, vale a fala da ficha)
export function rivalLine(cs: CareerSave, d: Driver, attempt: number): string | null {
  const m = moodOf(cs, d);
  if (m === 'none') return null;
  const r = recOf(cs, d.name);
  const lvl = heatOf(cs, d.name);
  const parts = heatBuild(d, lvl).added;
  // sem peça nova para citar, fica com as frases que não falam de peça
  const L = [...(PRE[m][d.style] ?? []), ...PRE[m].all].filter((s) => (parts.length || !s.includes('{p}')) && (r.hits > 0 || !s.includes('{hv}')));
  if (!L.length) return null;
  return fill(L[attempt % L.length], d, r, parts[parts.length - 1] ?? '');
}
// placar contra ele (ficha da entrevista): "VOCÊ 3 x 1 ELE · 2 BATIDAS · +ESCAPE"
export function rivalRecordLine(cs: CareerSave, d: Driver): string | null {
  const r = recOf(cs, d.name);
  if (!r.w && !r.l) return null;
  const lvl = heatOf(cs, d.name);
  return `HISTÓRICO: você ${r.w} x ${r.l}${r.hits ? ` · ${r.hits} batida${r.hits > 1 ? 's' : ''}` : ''}${lvl ? ` · preparou ${lvl}x` : ''}`;
}
// fala depois do resultado (null: a da ficha)
export function postLine(cs: CareerSave, d: Driver, playerWon: boolean): string | null {
  const r = recOf(cs, d.name);
  if (r.w + r.l < 2) return null;
  const lvl = heatOf(cs, d.name);
  if (playerWon) {
    const np = nextPart(d, lvl);
    if (lvl >= MAX_HEAT || !np) return r.w - r.l >= 3 ? `${r.w} vezes... Você é o melhor que já vi nessa estrada.` : 'Não tem mais o que pôr nesse carro. Agora é no braço.';
    return d.style === 'cauteloso' ? `Parabéns. Vou estudar a corrida e pôr ${np}.` : d.style === 'agressivo' ? `Isso não fica assim! Vou pôr ${np} e você vai ver.` : `Perdi de novo? Amanhã ponho ${np}. Ou um foguete.`;
  }
  return r.l >= 2 ? `${r.l} a ${r.w}! Já virou costume, novato.` : null;
}

// ---------- rádio: provocação na corrida ----------
const RADIO: Record<'passed' | 'lost', Record<Mood, string[]>> = {
  // o rival passou o jogador
  passed: {
    none: ['Tchau, novato!', 'Olha a minha traseira!'], lead: ['De novo atrás de mim?', 'É sempre assim, né?'],
    even: ['Desempate é meu!', 'Fica aí atrás.'], revenge: ['Sentiu a peça nova?', 'Hoje é minha vez!'], respect: ['Desculpa, lenda. Vou passar.', 'Agora é corrida de verdade!'],
  },
  // o jogador passou o rival
  lost: {
    none: ['Sorte de principiante!', 'Ainda tem estrada!'], lead: ['Aproveita, dura pouco.', 'Já te pego!'],
    even: ['Isso não acabou!', 'Volto já!'], revenge: ['De novo não!', 'Não, não, não!'], respect: ['Vai, mestre. Tô colado.', 'Bonita ultrapassagem.'],
  },
};
function radio(cs: CareerSave, d: Driver, kind: 'passed' | 'lost', k: number) {
  const L = RADIO[kind][moodOf(cs, d)];
  toast(`RÁDIO · ${rivalOf(d).nick.toUpperCase()}`, `"${L[k % L.length]}"`, kind === 'passed' ? '#ff7a5a' : '#8ad0ff');
}

// ---------- corrida atual (desafio na estrada, rádio, notas do resultado) ----------
interface RoadPlan { d: Driver; stage: number; prize: number; done?: boolean }
export const cur = {
  ev: null as CareerEvent | null,
  street: null as null | { ev: CareerEvent; pink: boolean; bet: number; car: string },
  road: null as RoadPlan | null,
  notes: [] as [string, number | null][], // linhas a mais no resultado (texto e dinheiro)
  newOffer: false, // racha novo para mostrar ao sair do resultado
};
const hash = (s: string) => {
  let h = 2166136261;
  for (const ch of s) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  return h;
};
export const regionOfEvent = (id: string) => REGIONS.findIndex((r) => r.events.some((e) => e.id === id.replace(/-rv$/, '')));
export const eventById = (id: string) => REGIONS.flatMap((r) => r.events).find((e) => e.id === id);
const myCar = (cs: CareerSave): CarSpec => tunedCar(carById(cs.car), undefined, setupOf(cs, cs.car), buildOf(cs, cs.car), wearOf(cs, cs.car));
export const myClassOf = (cs: CareerSave): PerfClass => perfClass(myCar(cs));
// rivais já vencidos (fora as viaturas), com o evento em que foram vencidos
function beaten(cs: CareerSave) {
  const out: { ev: CareerEvent; ri: number }[] = [];
  const seen = new Set<string>();
  REGIONS.forEach((r, ri) => r.events.forEach((e) => {
    if (!cs.done.includes(e.id) || e.driver.car.startsWith('patrol') || seen.has(e.driver.name)) return;
    seen.add(e.driver.name);
    out.push({ ev: e, ri });
  }));
  return out;
}
export const ROAD_CHANCE = 0.3;
// largada de um evento: sorteia (pela semente da corrida) se um rival vencido vai desafiar na estrada
export function planRun(cs: CareerSave, ev: CareerEvent, street?: { pink: boolean; bet: number }) {
  cur.ev = ev;
  cur.street = street ? { ev, pink: street.pink, bet: street.bet, car: cs.car } : null;
  cur.notes = [];
  cur.road = null;
  cur.newOffer = false;
  if (street || (ev.extras ?? 0) >= 2) return;
  const h = hash(`${ev.id}:${cs.races}:${cs.wins}`);
  if ((h % 1000) / 1000 >= ROAD_CHANCE) return;
  const ri = regionOfEvent(ev.id);
  const cls = REGIONS[ri]?.cls;
  const pool = beaten(cs).filter((b) => b.ev.driver.name !== ev.driver.name && REGIONS[b.ri].cls === cls);
  if (!pool.length) return;
  const b = pool[(h >>> 10) % pool.length];
  cur.road = { d: b.ev.driver, stage: (h >>> 4) % ev.stages.length, prize: Math.max(500, Math.round((prizeOf(b.ev) * 0.25) / 500) * 500) };
}
// figurante a mais no trecho do desafio (o rival que espera na estrada)
export function roadOpts<T extends { extras?: ExtraDef[]; extrasAhead?: boolean[] }>(i: number, o: T): T {
  const rd = cur.road;
  if (!rd || rd.stage !== i || getMode() !== 'career') return o;
  const ex = o.extras ?? [];
  if (ex.length >= 2) return o;
  const d = rd.d;
  const def: ExtraDef = { car: driverCarOf(d), paint: d.paint, style: d.style, skill: rivalSkillOf(d), name: d.name };
  return { ...o, extras: [...ex, def], extrasAhead: [...ex.map((_, k) => o.extrasAhead?.[k] ?? true), true] };
}

// rádio e desafio na estrada ligados à corrida (só na carreira)
export function attachRivalry(r: Race, i: number): Race {
  const cs = getSave();
  if (!cs || getMode() !== 'career' || !cur.ev) return r;
  const d = cur.ev.driver;
  const up = r.update.bind(r);
  let side = 0, cd = 4, said = 0;
  // desafio na estrada: o figurante a mais espera parado a ~30% do trecho e larga quando o jogador chega
  const rd = cur.road && cur.road.stage === i ? cur.road : null;
  const ch = rd ? r.extras.find((e) => e.name === rd.d.name) : undefined;
  let wait = !!ch;
  const z0 = r.track.startZ + (r.track.finishZ - r.track.startZ) * 0.3;
  if (ch) {
    ch.r.z = z0;
    ch.r.speed = 0;
  }
  r.update = (dt: number) => {
    up(dt);
    if (ch && wait) {
      ch.r.z = z0;
      ch.r.speed = 0;
      if (r.state === 'drive' && r.playerZ > z0 - 14 * SEG_LEN) {
        wait = false;
        ch.r.speed = r.speed * 0.75;
        toast('DESAFIO NA ESTRADA!', `${rd!.d.name}: chegue antes dele ao posto (+$${rd!.prize.toLocaleString('pt-BR')})`, '#ffd23a');
      }
    }
    // rádio: o rival passou o jogador ou foi passado (com folga, para não repetir no lado a lado)
    if (r.state !== 'drive' || !r.rival) return;
    cd -= dt;
    const gap = r.rival.z - r.playerZ;
    const s = gap > SEG_LEN * 0.8 ? 1 : gap < -SEG_LEN * 0.8 ? -1 : side;
    if (side && s !== side && cd <= 0 && said < 4) {
      radio(cs, d, s > 0 ? 'passed' : 'lost', hash(`${cs.races}:${i}:${said}`));
      cd = 9;
      said++;
    }
    side = s;
  };
  if (ch && rd) {
    const arrive = r.onArrive;
    r.onArrive = () => {
      // o desafiante sai do resultado do trecho (não conta como figurante do evento)
      const won = r.time <= ch.time;
      r.extras = r.extras.filter((e) => e !== ch);
      if (!rd.done) {
        rd.done = true;
        recordDuel(cs, rd.d.name, won, 0);
        if (won) cs.money += rd.prize;
        statsOf(cs).earned += won ? rd.prize : 0;
        cur.notes.push([`Desafio na estrada: ${won ? 'venceu' : 'perdeu'} ${rd.d.name}`, won ? rd.prize : 0]);
        toast(won ? 'DESAFIO NA ESTRADA: VENCEU!' : 'DESAFIO NA ESTRADA: PERDEU', won ? `+$${rd.prize.toLocaleString('pt-BR')}` : `${rd.d.name} chegou antes`, won ? '#30e060' : '#ff6a4a');
        saveCareer(cs);
      }
      arrive?.();
    };
  }
  return r;
}

// ---------- racha de rua noturno ----------
export const STREET_WINS = 3; // vitórias para os convites começarem
export const STREET_CHANCE = 0.4;
export function streetOf(cs: CareerSave): StreetState {
  const s = isObj(cs.street) ? (cs.street as unknown as Record<string, unknown>) : {};
  const o = isObj(s.offer) ? (s.offer as Record<string, unknown>) : null;
  const offer = o && typeof o.ev === 'string' && eventById(o.ev) ? { ev: o.ev, bet: Math.max(500, num(o.bet, 500)), until: num(o.until), ...(o.seen ? { seen: true } : {}) } : undefined;
  return { n: num(s.n), won: num(s.won), lost: num(s.lost), ...(offer ? { offer } : {}) };
}
// convite válido (ainda no prazo)
export function streetOffer(cs: CareerSave) {
  const st = streetOf(cs);
  return st.offer && cs.races <= st.offer.until ? st.offer : null;
}
function rollStreet(cs: CareerSave) {
  const st = streetOf(cs);
  if (cs.wins < STREET_WINS || (st.offer && cs.races <= st.offer.until)) return;
  const h = hash(`racha:${cs.races}:${cs.wins}:${st.n}`);
  if ((h % 1000) / 1000 >= STREET_CHANCE) return;
  // rival vencido com carro da classe do jogador (de preferência um carro que ele ainda não tem)
  const mine = myClassOf(cs);
  const all = beaten(cs);
  const same = all.filter((b) => perfClass(carById(b.ev.driver.car)) === mine);
  const fresh = same.filter((b) => !cs.owned.includes(b.ev.driver.car));
  const pool = fresh.length ? fresh : same.length ? same : all;
  if (!pool.length) return;
  const b = pool[(h >>> 10) % pool.length];
  st.offer = { ev: b.ev.id, bet: Math.max(1000, Math.round(prizeOf(b.ev) / 1000) * 1000), until: cs.races + 3 };
  cs.street = st;
  cur.newOffer = true;
}
// o racha: um trecho à noite, sem trânsito e com mais polícia, no cenário da região do rival
export function streetEvent(cs: CareerSave): CareerEvent | null {
  const o = streetOffer(cs);
  const base = o && eventById(o.ev);
  if (!o || !base) return null;
  const st = streetOf(cs);
  const s0 = base.stages[0];
  return {
    id: `racha-${st.n + 1}`, name: 'Racha noturno', prize: o.bet,
    driver: { ...base.driver, skill: Math.min(0.995, base.driver.skill + 0.006) },
    stages: [{ theme: s0.theme, lanes: 2, night: true, curviness: Math.max(0.8, s0.curviness), hilliness: s0.hilliness, sections: 9, traffic: 0, police: 3 }],
  };
}
export const canBetPink = (cs: CareerSave) => cs.owned.length >= 2;
export function declineStreet(cs: CareerSave) {
  const st = streetOf(cs);
  delete st.offer;
  cs.street = st;
  saveCareer(cs);
}
// resultado do racha: a aposta (dinheiro ou o carro), multas e conserto
export function settleStreet(cs: CareerSave, ev: CareerEvent, won: boolean, gameOver: boolean, fines: number, crashes: number): EventResult {
  const sc = cur.street!;
  const st = streetOf(cs);
  delete st.offer;
  st.n++;
  if (won) st.won++;
  else st.lost++;
  cs.street = st;
  const repairs = Math.round((priceOf(carById(cs.car)) * 0.01 * crashes) / 100) * 100;
  fines = Math.max(0, fines);
  let prize = 0;
  const d = ev.driver;
  if (sc.pink) {
    if (won) {
      const id = d.car;
      if (!cs.owned.includes(id)) {
        cs.owned.push(id);
        const b = driverBuild(d);
        if (b) {
          cs.builds = { ...(cs.builds ?? {}), [id]: { ...b } };
          cs.parts = { ...(cs.parts ?? {}), [id]: Object.entries(b).filter(([, v]) => v).map(([k, v]) => `${k}:${v}`) };
        }
        setPaint(id, nearestPaint(d.paint));
        cur.notes.push([`O ROSA: o ${carById(id).name} de ${rivalOf(d).nick} é seu!`, null]);
      } else {
        prize = Math.round((priceOf(carById(id)) * 0.6) / 1000) * 1000; // já tinha: o carro dele vira dinheiro
        cur.notes.push([`O ROSA: ${carById(id).name} repetido, vendido`, null]);
      }
    } else if (cs.owned.length >= 2 && cs.owned.includes(sc.car)) {
      const id = sc.car;
      cs.owned = cs.owned.filter((k) => k !== id);
      for (const k of ['builds', 'parts', 'setup', 'wear', 'odo'] as const) if (cs[k]) delete (cs[k] as Record<string, unknown>)[id];
      if (cs.sponsor?.car === id) delete cs.sponsor;
      cs.car = cs.owned[0];
      cur.notes.push([`O ROSA: seu ${carById(id).name} agora é de ${rivalOf(d).nick}`, null]);
    } else prize = -sc.bet; // (não deveria acontecer: nunca se aposta o único carro)
  } else prize = won ? sc.bet : -Math.min(sc.bet, cs.money);
  const total = prize - fines - repairs;
  cs.money = Math.max(0, cs.money + total);
  cs.races++;
  if (won) cs.wins++;
  const s2 = statsOf(cs);
  s2.events++;
  if (won) s2.eventWins++;
  else s2.eventLosses++;
  if (prize > 0) { s2.earned += prize; cs.earned += prize; }
  s2.finesPaid += fines;
  s2.spent += fines + repairs + Math.max(0, -prize);
  void gameOver;
  saveCareer(cs);
  return { won, gameOver, prize, clean: 0, fines, repairs, total, firstWin: false, bet: sc.pink ? 'Aposta: o rosa' : 'Aposta' };
}

// ---------- patrocínio ----------
const SUFFIX: Record<string, string> = {
  furia: 'Corse', toro: 'Racing', silber: 'Motorsport', vanguarda: 'Peças', kaze: 'Racing Team', serpe: 'Performance', fiore: 'Lubrificantes', ipe: 'Original', onca: 'Esporte', fenix: 'Competição',
};
export const sponsorName = (brand: string) => `${BRANDS[brand]?.name ?? brand} ${SUFFIX[brand] ?? ''}`.trim();
export const GOALS: Record<SponsorGoal, { name: string; desc: (s: Pick<SponsorDeal, 'target' | 'speed'>) => string }> = {
  clean: { name: 'VENCER SEM BATER', desc: (s) => `Vença ${s.target} provas sem nenhuma batida` },
  wins: { name: 'VITÓRIAS', desc: (s) => `Vença ${s.target} provas` },
  nofine: { name: 'NUNCA SER MULTADO', desc: (s) => `${s.target} provas sem multa (multa encerra)` },
  avg: { name: 'MÉDIA ALTA', desc: (s) => `${s.target} provas com média acima de ${s.speed} km/h` },
};
export function sponsorOf(cs: CareerSave): SponsorDeal | null {
  const o = cs.sponsor as unknown;
  if (!isObj(o)) return null;
  const s = o as Record<string, unknown>;
  if (typeof s.brand !== 'string' || !BRANDS[s.brand] || typeof s.goal !== 'string' || !(s.goal in GOALS)) {
    delete cs.sponsor;
    return null;
  }
  const d: SponsorDeal = {
    brand: s.brand, goal: s.goal as SponsorGoal, target: Math.max(1, num(s.target, 3)), per: Math.max(0, num(s.per)), bonus: Math.max(0, num(s.bonus)),
    len: Math.max(1, num(s.len, 6)), races: Math.max(0, num(s.races)), prog: Math.max(0, num(s.prog)), paid: Math.max(0, num(s.paid)), car: typeof s.car === 'string' ? s.car : cs.car,
    ...(typeof s.speed === 'number' ? { speed: s.speed } : {}),
  };
  cs.sponsor = d;
  return d;
}
// tamanho do dinheiro: o prêmio do 1º evento da região mais avançada liberada
const payLevel = (cs: CareerSave) => {
  const ri = REGIONS.reduce((best, _, i) => (regionUnlocked(cs, i) ? i : best), 0);
  return prizeOf(REGIONS[ri].events[0]);
};
// três propostas (mudam a cada 3 corridas), marcas e metas diferentes
export function sponsorOffers(cs: CareerSave): SponsorDeal[] {
  const cur0 = sponsorOf(cs);
  const h = hash(`spons:${Math.floor(cs.races / 3)}`);
  const brands = Object.keys(BRANDS).filter((b) => b !== cur0?.brand);
  const goals: SponsorGoal[] = ['clean', 'wins', 'nofine', 'avg'];
  const base = payLevel(cs);
  const vmax = myCar(cs).maxSpeed * KMH;
  const out: SponsorDeal[] = [];
  for (let k = 0; k < 3; k++) {
    const brand = brands[(h >>> (k * 5)) % brands.length + 0] ?? brands[k];
    if (out.some((o) => o.brand === brand)) {
      const alt = brands.find((b) => !out.some((o) => o.brand === b));
      if (!alt) break;
      out.push(offerOf(alt, goals[(h + k) % 4], k, base, vmax, cs));
    } else out.push(offerOf(brand, goals[(h + k) % 4], k, base, vmax, cs));
  }
  return out;
}
function offerOf(brand: string, goal: SponsorGoal, k: number, base: number, vmax: number, cs: CareerSave): SponsorDeal {
  const target = goal === 'nofine' ? 4 : goal === 'avg' ? 3 : 2 + (k % 2);
  const hard = goal === 'clean' ? 1.4 : goal === 'nofine' ? 1.2 : 1;
  return {
    brand, goal, target, len: target + 3, races: 0, prog: 0, paid: 0, car: cs.car,
    per: Math.round((base * 0.1 * hard) / 100) * 100, bonus: Math.round((base * (0.3 + 0.15 * target) * hard) / 500) * 500,
    ...(goal === 'avg' ? { speed: Math.round((vmax * 0.6) / 5) * 5 } : {}),
  };
}
export function signSponsor(cs: CareerSave, d: SponsorDeal) {
  cs.sponsor = { ...d, car: cs.car, races: 0, prog: 0, paid: 0 };
  saveCareer(cs);
}
export function cancelSponsor(cs: CareerSave) {
  delete cs.sponsor;
  saveCareer(cs);
}
// fim de uma prova oficial: a meta foi cumprida nesta corrida? paga e conta
function sponsorRace(cs: CareerSave, won: boolean, gameOver: boolean, res: StageResult[], fines: number, crashes: number) {
  const sp = sponsorOf(cs);
  if (!sp) return;
  const nm = sponsorName(sp.brand);
  sp.races++;
  const avg = res.length ? res.reduce((a, r) => a + r.avg, 0) / res.length : 0;
  if (sp.goal === 'nofine' && fines > 0) {
    cur.notes.push([`${nm}: multado, contrato encerrado`, null]);
    delete cs.sponsor;
    return;
  }
  const ok = !gameOver && (sp.goal === 'clean' ? won && crashes === 0 : sp.goal === 'wins' ? won : sp.goal === 'nofine' ? true : avg >= (sp.speed ?? 0));
  if (ok) {
    sp.prog++;
    sp.paid += sp.per;
    cs.money += sp.per;
    statsOf(cs).earned += sp.per;
    cs.earned += sp.per;
    cur.notes.push([`${nm}: meta da corrida`, sp.per]);
  }
  if (sp.prog >= sp.target) {
    cs.money += sp.bonus;
    statsOf(cs).earned += sp.bonus;
    cs.earned += sp.bonus;
    cur.notes.push([`${nm}: CONTRATO CUMPRIDO!`, sp.bonus]);
    delete cs.sponsor;
  } else if (sp.races >= sp.len) {
    cur.notes.push([`${nm}: prazo acabou, sem bônus`, null]);
    delete cs.sponsor;
  } else cs.sponsor = sp;
}

// ---------- fim de evento (main.ts, depois de settleEvent/settleStreet) ----------
export function afterEvent(cs: CareerSave, ev: CareerEvent, won: boolean, gameOver: boolean, res: StageResult[], fines: number, crashes: number) {
  const before = heatOf(cs, ev.driver.name);
  recordDuel(cs, ev.driver.name, won, crashes);
  const after = heatOf(cs, ev.driver.name);
  if (after > before) {
    const p = heatBuild(ev.driver, after).added[after - 1];
    if (p) cur.notes.push([`${ev.driver.name} vai pôr ${p}`, null]);
  }
  if (!cur.street) sponsorRace(cs, won, gameOver, res, fines, crashes);
  rollStreet(cs);
  saveCareer(cs);
}

// ---------- adesivo do patrocinador (lateral do carro, drawCarSide) ----------
// placa branca com o logotipo e o nome entre as rodas, na altura da porta
export function sponsorDecal(c: CanvasRenderingContext2D, car: CarSpec, L: number, T: number, W: number, H: number) {
  const cs = getSave();
  const sp = cs && sponsorOf(cs);
  if (!sp || car.id !== sp.car || !car.wheels || car.wheels.length < 2) return;
  const [a, b] = car.wheels;
  const R = H - a[1] * H;
  const cx = L + ((a[0] + b[0]) / 2) * W;
  const h = Math.max(3, Math.round(W * 0.05));
  const big = W >= 120;
  const name = (BRANDS[sp.brand]?.name ?? '').toUpperCase();
  const fs = Math.max(3, Math.round(h * 0.5));
  c.font = `${fs}px "Press Start 2P", monospace`;
  const px = Math.max(0.34, (h - 1) / 9);
  const w = big ? Math.ceil(9 * px + 4 + c.measureText(name).width) : h + 1;
  const x0 = Math.round(cx - w / 2), y0 = Math.round(T + a[1] * H - R * 1.05 - h / 2);
  c.fillStyle = '#141416';
  c.fillRect(x0 - 1, y0 - 1, w + 2, h + 2);
  c.fillStyle = '#f4f2ea';
  c.fillRect(x0, y0, w, h);
  drawLogo(c, BRANDS[sp.brand], x0 + 0.5, y0 + (h - 9 * px) / 2, px);
  if (big) {
    c.fillStyle = '#c81818';
    c.fillRect(x0 + 9 * px + 2, y0 + 1, w - 9 * px - 3, Math.max(1, Math.round(h * 0.22)));
    text(c, name, x0 + 9 * px + 2, y0 + h - fs - 1, fs, '#141416', 'left', null);
  }
}
export const decalScreens = new Set(['careerMenu', 'career', 'event', 'garage', 'collection', 'careerEnd', 'gas', 'sponsor', 'racha']);
sideHook.after = (c, car, L, T, W, H, driver) => {
  const st = live();
  if (driver === 'rival' || !st?.career || !decalScreens.has(st.screen) || (st.screen === 'gas' && st.mode !== 'career')) return;
  sponsorDecal(c, car, L, T, W, H);
};
