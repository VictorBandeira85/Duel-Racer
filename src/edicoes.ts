// Revista do leitor: a cada marco (chefão vencido, recorde num roteiro, carro novo, preparação grande,
// vitórias em conta redonda) sai uma edição nova da DUEL RACER com o SEU carro na capa e manchetes dos
// seus feitos. Número e mês avançam (Nº 02 = NOVEMBRO DE 1994...). O histórico fica no aparelho (chave
// própria, validada ao carregar) e a tela EDIÇÕES ANTERIORES folheia as capas já ganhas.
// Os marcos são achados comparando o que já existe nos saves (carreira, oficina do Arcade, recordes)
// com os marcos já publicados: nada precisa avisar daqui de fora.
import { CARS, drawCar, drawCarSide, type CarSpec } from './cars';
import { DEFAULT_SETUP, REGIONS, loadCareer, tunedCar, type CareerSave } from './career';
import { applyBuild, buildKey, partOf, slotsFor, type Build, type SlotId } from './tuning';
import { loadArcadeBuilds } from './arcadeprep';
import { COURSES } from './courses';
import { paintHex } from './paint';
import { SAFE_W } from './config';
import { BLUE, GREY, INK, RED, YELLOW, arrow, barcode, ink, kicker, logo, masthead, paper, photo, tag } from './mag';
import { inside, type Focusable, type FocusSet, type Rect } from './ui';
import { formatTime, isObj } from './util';
import type { Actions, AppState, MenuKey, ScreenId } from './screens';
import { ox } from './screens';

export type IssueKind = 'boss' | 'prep' | 'wins' | 'car' | 'rec';
export interface IssueCar { id: string; paint?: string; build?: Build; rims?: string; view: 'side' | 'front' | 'rear' }
export interface Issue { n: number; kind: IssueKind; kick: string; title: string; sub: string; lines: string[]; car: IssueCar | null; at: number }
interface Store { seen: string[]; issues: Issue[]; shown: number }

const KEY = 'duel-racer:edicoes';
const MAX_ISSUES = 240;
const KINDS: IssueKind[] = ['boss', 'prep', 'wins', 'car', 'rec'];
const MONTHS = ['JANEIRO', 'FEVEREIRO', 'MARÇO', 'ABRIL', 'MAIO', 'JUNHO', 'JULHO', 'AGOSTO', 'SETEMBRO', 'OUTUBRO', 'NOVEMBRO', 'DEZEMBRO'];

// ---------- save (validado: o que vier estragado ou de outra versão sai, sem derrubar a capa) ----------
const str = (v: unknown, max = 60) => (typeof v === 'string' ? v.slice(0, max) : '');
function okCar(v: unknown): IssueCar | null {
  if (!isObj(v) || typeof v.id !== 'string' || !CARS.some((c) => c.id === v.id)) return null;
  const out: IssueCar = { id: v.id, view: v.view === 'front' || v.view === 'rear' ? v.view : 'side' };
  if (typeof v.paint === 'string' && /^#[0-9a-f]{6}$/i.test(v.paint)) out.paint = v.paint;
  if (typeof v.rims === 'string' && v.rims.length < 24) out.rims = v.rims;
  if (isObj(v.build)) {
    const b: Build = {};
    for (const [k, p] of Object.entries(v.build)) if (typeof p === 'string' && p && p.length < 24) b[k as SlotId] = p;
    if (buildKey(b)) out.build = b;
  }
  return out;
}
function okIssue(v: unknown): Issue | null {
  if (!isObj(v) || !Number.isInteger(v.n) || v.n < 2 || v.n > 9999 || !KINDS.includes(v.kind)) return null;
  const title = str(v.title, 64);
  if (!title) return null;
  return {
    n: v.n, kind: v.kind, kick: str(v.kick, 30), title, sub: str(v.sub, 70),
    lines: Array.isArray(v.lines) ? v.lines.map((l: unknown) => str(l, 40)).filter(Boolean).slice(0, 3) : [],
    car: okCar(v.car), at: typeof v.at === 'number' && Number.isFinite(v.at) ? v.at : 0,
  };
}
export function loadIssues(): Store | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw === null) return null;
    const v: unknown = JSON.parse(raw);
    if (!isObj(v)) return null; // estragado: começa de novo (o que já existe conta como visto)
    const seen = Array.isArray(v.seen) ? v.seen.filter((k: unknown) => typeof k === 'string' && k.length < 80) : [];
    // edições em ordem de número, sem repetir número
    const issues: Issue[] = [];
    if (Array.isArray(v.issues)) for (const i of v.issues.map(okIssue)) if (i && !issues.some((q) => q.n === i.n)) issues.push(i);
    issues.sort((a, b) => a.n - b.n);
    const shown = Number.isInteger(v.shown) ? v.shown : 0;
    return { seen: [...new Set<string>(seen)], issues: issues.slice(-MAX_ISSUES), shown };
  } catch {
    return null;
  }
}
let store: Store | null = null;
let baseline = false; // sem histórico (primeira vez ou save estragado): a próxima conferência só marca o que existe
function cur(): Store {
  if (!store) {
    const v = loadIssues();
    baseline = !v;
    store = v ?? { seen: [], issues: [], shown: 0 };
  }
  return store;
}
function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(cur()));
  } catch {
    /* sem armazenamento: vale só nesta sessão */
  }
}
export const issues = () => cur().issues;
// para testes (save trocado por fora): relê do aparelho
export function reloadIssues() {
  store = null;
  lastSync = -99;
}

// número, mês e ano de uma edição (Nº 01 = OUTUBRO DE 1994)
export function issueDate(n: number) {
  const m = 9 + (n - 1);
  return { month: MONTHS[m % 12], year: 1994 + Math.floor(m / 12), ano: Math.floor((n - 1) / 12) + 1 };
}
const roman = (n: number) => ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'][n - 1] ?? String(n);
export const issueNo = (n: number) => `Nº ${String(n).padStart(2, '0')}`;
// linha do alto da capa: a edição mais nova do leitor
export function mastLine() {
  const n = issues().length ? issues()[issues().length - 1].n : 1;
  const d = issueDate(n);
  return `${issueNo(n)}  •  ANO ${roman(d.ano)}  •  ${d.month} DE ${d.year}`;
}

// ---------- marcos ----------
interface Feat { keys: string[]; kind: IssueKind; pri: number; kick: string; title: string; sub: string; line: string; car: IssueCar | null }
// manchete de cada chefão
const BOSS_TITLE: Record<string, string> = {
  'D-c5': 'O NOVO REI DA PRAIA', 'D-v5': 'O NOVO BARÃO DO VALE', 'C-t5': 'NOVO DONO DO TRÓPICO', 'C-d5': 'O ESCORPIÃO PERDEU O FERRÃO',
  'B-m5': 'A NOITE TEM NOVO DONO', 'A-f5': 'O NOVO BARÃO DOS ALPES', 'S-g5': 'O NOVO REI DA SERRA',
};
const REGION_IN: Record<string, string> = { costa: 'NA', vale: 'NO', tropico: 'NO', deserto: 'NA', metropole: 'NA', fronteira: 'NA', cume: 'NO' };
const WIN_MARKS = [5, 10, 25, 50, 100, 200, 500];
const carOf = (id: string) => CARS.find((c) => c.id === id);
// nome curto para manchete ("GTI DE 300 CV"): nome inteiro se couber, senão a sigla do fim
function shortName(car: CarSpec) {
  const n = car.name.toUpperCase();
  if (n.length <= 10) return n;
  const last = n.split(' ').pop()!;
  return /^[A-Z0-9]{2,4}$/.test(last) ? last : n;
}
const cvOf = (car: CarSpec, b?: Build) => Math.round((parseInt(car.power) || 0) * (b ? applyBuild(car, b).accel / car.accel : 1));
const tierOf = (car: CarSpec, b?: Build) => {
  if (!b || !buildKey(b)) return 0;
  const k = applyBuild(car, b).accel / car.accel;
  return k >= 1.8 ? 3 : k >= 1.5 ? 2 : k >= 1.25 ? 1 : 0;
};
// peças em poucas palavras: "turbo, escapamento esportivo, rodas"
export function partsLine(car: CarSpec, b?: Build) {
  if (!b || !buildKey(b)) return '';
  return slotsFor(car, b).filter((sl) => b[sl.id] && partOf(car, sl.id, b[sl.id]).id === b[sl.id]).map((sl) => {
    const p = partOf(car, sl.id, b[sl.id]);
    return sl.id === 'rodas' ? 'rodas' : sl.id === 'inducao' || sl.id === 'alimentacao' ? p.name.toLowerCase() : `${sl.name.toLowerCase()} ${p.name.toLowerCase()}`;
  }).join(', ');
}
function careerCar(cs: CareerSave, id: string, view: IssueCar['view']): IssueCar {
  const b = cs.builds?.[id];
  return { id, view, paint: paintHex(id), ...(b && buildKey(b) ? { build: { ...b } } : {}), ...(cs.setup?.[id]?.rims ? { rims: cs.setup[id].rims } : {}) };
}
function prepFeat(car: CarSpec, b: Build, keyBase: string, look: IssueCar): Feat | null {
  const tier = tierOf(car, b);
  if (!tier) return null;
  const ind = b.inducao ? partOf(car, 'inducao', b.inducao) : null;
  const forced = applyBuild(car, b).forced;
  const what = forced === 'turbo' || ind?.forced === 'turbo' ? 'O TURBO DO LEITOR' : forced === 'super' ? 'O COMPRESSOR DO LEITOR' : 'PREPARADO PELO LEITOR';
  const cv = cvOf(car, b);
  const parts = partsLine(car, b);
  return {
    keys: [1, 2, 3].filter((t) => t <= tier).map((t) => `${keyBase}:${car.id}:${t}`), kind: 'prep', pri: 60 + tier,
    kick: 'OFICINA DO LEITOR', title: `${shortName(car)} DE ${cv} CV: ${what}`,
    sub: parts ? parts[0].toUpperCase() + parts.slice(1) : 'Preparado peça por peça', line: `${car.name} com ${cv} cv`, car: look,
  };
}
function scanFeats(cs: CareerSave | null): Feat[] {
  const out: Feat[] = [];
  if (cs) {
    const losses = cs.stats?.eventLosses ?? Math.max(0, (cs.races ?? 0) - (cs.wins ?? 0));
    const active = carOf(cs.car);
    REGIONS.forEach((r, i) => {
      const boss = r.events.find((e) => e.boss);
      if (!boss || !cs.done.includes(boss.id)) return;
      const bt = BOSS_TITLE[boss.id] ?? `${boss.driver.name.toUpperCase()} VENCIDO`;
      const inv = losses === 0;
      const reg = `${REGION_IN[r.id] ?? 'NA'} ${r.name.toUpperCase()}`;
      out.push({
        keys: [`boss:${boss.id}`], kind: 'boss', pri: 100 + i,
        kick: inv ? 'INVICTO!' : 'CAMPEONATO', title: inv ? `INVICTO ${reg}` : bt,
        sub: inv ? `${bt.charAt(0)}${bt.slice(1).toLowerCase()} • ${bt.toLowerCase().includes(boss.driver.name.toLowerCase()) ? 'chefão vencido' : `${boss.driver.name} vencido`}` : `${boss.driver.name} vencido ${(REGION_IN[r.id] ?? 'NA').toLowerCase()} ${r.name}`,
        line: `${boss.driver.name} vencido`, car: active ? careerCar(cs, active.id, 'side') : null,
      });
    });
    for (const id of cs.owned) {
      const car = carOf(id);
      if (!car) continue;
      out.push({ keys: [`car:${id}`], kind: 'car', pri: 40, kick: 'ZERO-QUILÔMETRO', title: `CHEGOU O ${car.name.toUpperCase()}!`, sub: `${car.power} na garagem do leitor`, line: `Novo: ${car.name}`, car: careerCar(cs, id, 'side') });
      const b = cs.builds?.[id];
      const f = b && prepFeat(car, b, 'prep', careerCar(cs, id, 'side'));
      if (f) out.push(f);
    }
    const wm = WIN_MARKS.filter((m) => (cs.wins ?? 0) >= m);
    if (wm.length) {
      const m = wm[wm.length - 1];
      out.push({ keys: wm.map((k) => `wins:${k}`), kind: 'wins', pri: 50, kick: 'CAMPEONATO', title: `${m} VITÓRIAS: QUEM SEGURA?`, sub: `${cs.races} corridas, ${cs.wins} vitórias na carreira`, line: `${m} vitórias na carreira`, car: active ? careerCar(cs, active.id, 'rear') : null });
    }
  }
  // oficina do Arcade
  for (const [id, b] of Object.entries(loadArcadeBuilds())) {
    const car = carOf(id);
    const f = car && prepFeat(car, b, 'aprep', { id, view: 'side', paint: paintHex(id), build: { ...b } });
    if (f) out.push(f);
  }
  // recordes dos roteiros do Arcade (o primeiro tempo no ranking de cada um)
  for (const co of COURSES) {
    let best: { time: number; car: string } | undefined;
    try {
      const v: unknown = JSON.parse(localStorage.getItem(`duel-racer:scores:${co.id}`) || '[]');
      if (Array.isArray(v)) for (const e of v) if (isObj(e) && typeof e.time === 'number' && e.time > 0 && (!best || e.time < best.time)) best = { time: e.time, car: String(e.car) };
    } catch {
      /* ranking estragado: sem recorde */
    }
    if (!best) continue;
    const car = carOf(best.car);
    const ab = car ? loadArcadeBuilds()[car.id] : undefined;
    out.push({
      keys: [`rec:${co.id}`], kind: 'rec', pri: 30, kick: 'RECORDE DO ROTEIRO', title: `${co.name.toUpperCase()} EM ${formatTime(best.time)}`,
      sub: `Recorde do leitor${car ? ` com o ${car.name}` : ''}`, line: `Recorde: ${co.name}`,
      car: car ? { id: car.id, view: 'rear', paint: paintHex(car.id), ...(ab ? { build: { ...ab } } : {}) } : null,
    });
  }
  return out;
}
// chamadas de enchimento do "nesta edição" (quando a edição tem um feito só)
const FILLER = ['Teste: pneus de inverno', 'Classificados de usados', 'Os rivais falam', 'Radares novos na Serra', 'Oficina: turbo x compressor', 'Postos 24 horas na rodovia', 'Mapa dos roteiros', 'Cartas do leitor'];
function makeIssue(feats: Feat[], n: number): Issue {
  const f = [...feats].sort((a, b) => b.pri - a.pri);
  const main = f[0];
  const lines = f.slice(1).map((q) => q.line).slice(0, 3);
  for (let k = 0; lines.length < 3; k++) lines.push(FILLER[(n * 3 + k) % FILLER.length]);
  return { n, kind: main.kind, kick: main.kick, title: main.title, sub: main.sub, lines, car: main.car, at: Date.now() };
}

// compara os saves com os marcos já publicados; marcos novos viram uma edição (true = saiu edição)
// Primeira vez (sem histórico): o que já existe conta como visto e sai uma edição só, com o feito maior
let lastSync = -99;
export function syncIssues(cs: CareerSave | null | undefined): boolean {
  const st = cur();
  const first = baseline;
  baseline = false;
  const feats = scanFeats(cs ?? loadCareer());
  const fresh = feats.filter((f) => f.keys.some((k) => !st.seen.includes(k)));
  if (!fresh.length) {
    if (first) persist();
    return false;
  }
  for (const f of fresh) for (const k of f.keys) if (!st.seen.includes(k)) st.seen.push(k);
  const n = (st.issues.length ? st.issues[st.issues.length - 1].n : 1) + 1;
  st.issues.push(makeIssue(first ? [fresh.sort((a, b) => b.pri - a.pri)[0]] : fresh, n));
  if (st.issues.length > MAX_ISSUES) st.issues.splice(0, st.issues.length - MAX_ISSUES);
  persist();
  return true;
}
// chamado a cada quadro de menu: confere os marcos a cada 2 s (fora da corrida)
export function issuesTick(s: AppState) {
  if (s.screen === 'race' || s.screen === 'loading') return;
  if (s.t - lastSync < 2 && s.t >= lastSync) return;
  lastSync = s.t;
  syncIssues(s.career);
}

// ---------- capa da edição do leitor na capa da revista ----------
// A edição nova aparece primeiro ao chegar na capa (uma vez); depois entra no rodízio a cada 4 edições
let lastT = -9, enterT = 0, freshN = 0;
export function titleIssue(s: AppState, slot: number, u: number): { is: Issue; u: number; fresh: boolean } | null {
  const t = s.t;
  if (t - lastT > 0.5 || t < lastT) {
    enterT = t;
    freshN = 0;
    lastSync = t;
    syncIssues(s.career);
  }
  lastT = t;
  const st = cur();
  if (!st.issues.length) return null;
  const latest = st.issues[st.issues.length - 1];
  if (latest.n > st.shown) {
    freshN = latest.n;
    st.shown = latest.n;
    persist();
  }
  const k = t - enterT;
  if (freshN && k < 9) return { is: st.issues.find((q) => q.n === freshN) ?? latest, u: Math.min(1, k / 8), fresh: true };
  if (slot % 4 !== 2) return null;
  const i = Math.floor(slot / 4) % st.issues.length;
  return { is: st.issues[st.issues.length - 1 - i], u, fresh: false };
}

// carro da capa com as peças e as rodas da época da edição (guardado por montagem)
const tunedCache = new Map<string, CarSpec>();
function lookOf(ic: IssueCar): CarSpec | null {
  const car = carOf(ic.id);
  if (!car) return null;
  const key = `${ic.id}|${buildKey(ic.build)}|${ic.rims ?? ''}`;
  let t = tunedCache.get(key);
  if (!t) tunedCache.set(key, (t = tunedCar(car, undefined, { ...DEFAULT_SETUP, rims: ic.rims ?? '' }, ic.build)));
  return t;
}

// fundos de cada tipo de edição
const BACKDROP: Record<IssueKind, [string, string]> = { boss: ['#2a1a3a', '#c86a3a'], prep: ['#3a3430', '#8a7e70'], wins: ['#5a9ae8', '#d8e8f6'], car: ['#5e6670', '#c8cdd2'], rec: ['#4a78c0', '#c8d8e8'] };
function scenery(c: CanvasRenderingContext2D, ph: Rect, kind: IssueKind, t: number) {
  const floor = ph.y + Math.round(ph.h * 0.62);
  if (kind === 'boss') {
    // pôr do sol na serra: céu em faixas, sol e montanhas recortadas
    const bands = ['#2a1a3a', '#5a2a4a', '#9a3a3a', '#d0663a', '#f0a040'];
    const bh = Math.ceil((floor - ph.y) / bands.length);
    bands.forEach((col, i) => { c.fillStyle = col; c.fillRect(ph.x, ph.y + i * bh, ph.w, bh); });
    c.fillStyle = '#ffd86a';
    c.beginPath();
    c.arc(ph.x + ph.w * 0.7, floor - 6, 16, Math.PI, 0);
    c.fill();
    c.fillStyle = '#1a1220';
    c.beginPath();
    c.moveTo(ph.x, floor);
    for (let x = 0; x <= ph.w; x += 16) c.lineTo(ph.x + x, floor - 8 - ((x * 37) % 23));
    c.lineTo(ph.x + ph.w, floor);
    c.fill();
    c.fillStyle = '#2a2a2e';
    c.fillRect(ph.x, floor, ph.w, ph.h);
    c.fillStyle = '#e8e0c8';
    for (let x = ph.x - ((t * 40) % 24); x < ph.x + ph.w; x += 24) c.fillRect(Math.round(x), floor + 14, 12, 1);
  } else if (kind === 'prep') {
    // oficina: parede com painel furado e ferramentas, luz de cima
    c.fillStyle = '#9a7a52';
    c.fillRect(ph.x + 8, ph.y + 8, ph.w - 16, floor - ph.y - 14);
    c.fillStyle = '#6a5034';
    for (let y = ph.y + 6; y < floor - 6; y += 4) for (let x = ph.x + 4 + ((y / 4) % 2) * 2; x < ph.x + ph.w; x += 4) c.fillRect(x, y, 1, 1);
    c.fillStyle = '#2a2420';
    for (let k = 0; k < 6; k++) {
      const x = ph.x + 20 + k * (ph.w / 6);
      c.fillRect(x, ph.y + 12, 2, 18 + (k % 3) * 4);
      c.fillRect(x - 2, ph.y + 10, 6, 3);
    }
    const g = c.createRadialGradient(ph.x + ph.w * 0.4, ph.y, 4, ph.x + ph.w * 0.4, ph.y + ph.h * 0.5, ph.h);
    g.addColorStop(0, 'rgba(255,236,180,0.4)');
    g.addColorStop(1, 'rgba(255,236,180,0)');
    c.fillStyle = g;
    c.fillRect(ph.x, ph.y, ph.w, ph.h);
  } else if (kind === 'wins' || kind === 'rec') {
    // estrada: céu, campo e asfalto com as faixas passando
    c.fillStyle = '#2e8a2a';
    c.fillRect(ph.x, floor - 10, ph.w, ph.h);
    const cx = ph.x + ph.w * 0.34;
    c.fillStyle = '#3a3a3e';
    c.beginPath();
    c.moveTo(cx - 6, floor - 10);
    c.lineTo(cx + 6, floor - 10);
    c.lineTo(cx + ph.w * 0.7, ph.y + ph.h);
    c.lineTo(cx - ph.w * 0.7, ph.y + ph.h);
    c.fill();
    c.fillStyle = YELLOW;
    for (let k = 0; k < 6; k++) {
      const f = ((k + t * 2) % 6) / 6, f2 = Math.min(1, f + 0.06);
      const top = floor - 10, span = ph.y + ph.h - top;
      const y1 = top + span * f * f, y2 = top + span * f2 * f2;
      c.fillRect(Math.round(cx - 1 - f * 2), Math.round(y1), Math.round(2 + f * 4), Math.max(1, Math.round(y2 - y1)));
    }
  } else {
    const g = c.createRadialGradient(ph.x + ph.w / 2, ph.y + ph.h * 0.45, 10, ph.x + ph.w / 2, ph.y + ph.h * 0.45, ph.w * 0.5);
    g.addColorStop(0, 'rgba(255,255,255,0.35)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g;
    c.fillRect(ph.x, ph.y, ph.w, ph.h);
  }
}
function shade(c: CanvasRenderingContext2D, ph: Rect, h: number) {
  const g = c.createLinearGradient(0, ph.y, 0, ph.y + h);
  g.addColorStop(0, 'rgba(10,8,6,0.66)');
  g.addColorStop(0.7, 'rgba(10,8,6,0.32)');
  g.addColorStop(1, 'rgba(10,8,6,0)');
  c.fillStyle = g;
  c.fillRect(ph.x, ph.y, ph.w, h);
}
// manchete no maior tamanho que couber; se nem a 8 couber, em duas linhas (devolve a altura usada)
function fitTitle(c: CanvasRenderingContext2D, s: string, x: number, y: number, maxW: number): number {
  const wid = (t: string, z: number) => {
    c.font = `${z}px "Press Start 2P", monospace`;
    return c.measureText(t).width + 3;
  };
  for (const z of [12, 10, 8]) if (wid(s, z) <= maxW) {
    logo(c, s, x, y, z, '#fff', INK);
    return z + 3;
  }
  const words = s.split(' ');
  let a = '';
  for (const w of words) {
    if (wid(a ? `${a} ${w}` : w, 8) > maxW && a) break;
    a = a ? `${a} ${w}` : w;
  }
  const b = s.slice(a.length).trim();
  logo(c, a, x, y, 8, '#fff', INK);
  logo(c, b, x, y + 11, 8, '#fff', INK);
  return 22;
}
const BAND = (is: Issue) => {
  const d = issueDate(is.n);
  return `${issueNo(is.n)}  •  ${d.month} DE ${d.year}  •  EDIÇÃO DO LEITOR`;
};
const KICK_BG: Record<IssueKind, string> = { boss: RED, prep: BLUE, wins: '#1a6a2a', car: INK, rec: RED };

/** capa de uma edição do leitor no quadro ph (capa da revista, folheador); u = 0..1 da edição */
export function drawIssueCover(c: CanvasRenderingContext2D, ph: Rect, is: Issue, u: number, t: number, fresh = false, code = true) {
  const enter = Math.min(1, u * 16);
  const ease = 1 - (1 - enter) ** 3;
  const car = is.car ? lookOf(is.car) : null;
  const floor = ph.y + ph.h - 12;
  photo(c, ph, () => {
    scenery(c, ph, is.kind, t);
    if (!car || !is.car) return;
    const v = is.car.view;
    if (v === 'side') {
      const len = Math.min(ph.w * 0.6, (ph.h - 40) * 3.2, 230);
      // recorde e chefão: riscos de velocidade atrás do carro
      if (is.kind === 'rec' || is.kind === 'boss') {
        c.fillStyle = 'rgba(255,255,255,0.5)';
        for (let k = 0; k < 5; k++) c.fillRect(Math.round(ph.x + 8 + len * 0.8 + ((k * 23 + t * 90) % 50)), floor - 8 - k * 7, 18 + (k % 2) * 10, 1);
      }
      drawCarSide(c, ph.x + 6 + (1 - ease) * ph.w * 0.8, floor, len, car, is.car.paint);
    } else {
      const w = Math.min(ph.h * 0.72, ph.w * 0.3);
      const bob = Math.round(Math.sin(t * 9) * 0.6);
      drawCar(c, ph.x + ph.w * 0.34, floor - 2 + bob + (1 - ease) * 60, w, { color: car.color, rear: car.rear, paint: is.car.paint, front: v === 'front', brake: v === 'rear' && Math.floor(t) % 4 === 0 });
    }
  }, BACKDROP[is.kind]);
  shade(c, ph, 40);
  const kw = kicker(c, is.kick || 'EDIÇÃO DO LEITOR', ph.x + 6, ph.y + 5, KICK_BG[is.kind], is.kind === 'car' ? YELLOW : '#fff');
  if (fresh && Math.floor(t * 2) % 2 === 0) kicker(c, 'NOVA EDIÇÃO!', ph.x + 10 + kw, ph.y + 5, YELLOW, RED);
  const boxW = Math.min(118, Math.floor(ph.w * 0.36));
  const th = fitTitle(c, is.title, ph.x + 6, ph.y + 16, ph.w - 74); // (o canto direito fica livre: selo do desafio do dia na capa)
  if (is.sub) {
    c.font = '5px "Press Start 2P", monospace';
    let sub = is.sub;
    const maxW = ph.w - boxW - 24;
    if (c.measureText(sub).width > maxW) {
      while (sub.length > 4 && c.measureText(`${sub}…`).width > maxW) sub = sub.slice(0, -1);
      sub = `${sub.trimEnd().replace(/,$/, '')}…`;
    }
    kicker(c, sub, ph.x + 6, ph.y + 18 + th, 'rgba(26,22,20,0.82)', '#fff');
  }
  // nesta edição
  const bx = ph.x + ph.w - boxW - 4, by = ph.y + 30 + Math.max(0, th - 15);
  const bh = Math.min(42, ph.y + ph.h - 36 - by);
  if (bh >= 24) {
    c.fillStyle = 'rgba(16,14,12,0.72)';
    c.fillRect(bx, by, boxW, bh);
    ink(c, 'NESTA EDIÇÃO', bx + 4, by + 3, 4, YELLOW);
    is.lines.slice(0, Math.floor((bh - 12) / 9)).forEach((l, i) => {
      c.font = '4px "Press Start 2P", monospace';
      let s = l;
      while (s.length > 4 && c.measureText(s).width > boxW - 8) s = s.slice(0, -1);
      ink(c, s, bx + 4, by + 12 + i * 9, 4, '#fff');
    });
  }
  // faixa vermelha e código de barras
  c.fillStyle = RED;
  c.fillRect(ph.x, ph.y + ph.h - 10, ph.w, 10);
  ink(c, BAND(is), ph.x + 4, ph.y + ph.h - 8, 4, '#fff');
  if (code) barcode(c, ph.x + ph.w - 38, ph.y + ph.h - 34);
}

// capinha pequena (folheador): faixa com o número, o carro e o mês
function drawThumb(c: CanvasRenderingContext2D, r: Rect, is: Issue, hot: boolean) {
  c.fillStyle = 'rgba(40,30,20,0.35)';
  c.fillRect(r.x + 2, r.y + 2, r.w, r.h);
  c.fillStyle = hot ? RED : INK;
  c.fillRect(r.x - 1, r.y - 1, r.w + 2, r.h + 2);
  const [a, b] = BACKDROP[is.kind];
  const g = c.createLinearGradient(0, r.y, 0, r.y + r.h);
  g.addColorStop(0, a);
  g.addColorStop(1, b);
  c.fillStyle = g;
  c.fillRect(r.x, r.y, r.w, r.h);
  const car = is.car ? lookOf(is.car) : null;
  c.save();
  c.beginPath();
  c.rect(r.x, r.y, r.w, r.h);
  c.clip();
  if (car && is.car) {
    if (is.car.view === 'side') drawCarSide(c, r.x + 2, r.y + r.h - 9, r.w - 4, car, is.car.paint);
    else drawCar(c, r.x + r.w / 2, r.y + r.h - 8, r.w * 0.5, { color: car.color, rear: car.rear, paint: is.car.paint, front: is.car.view === 'front' });
  }
  c.restore();
  c.fillStyle = RED;
  c.fillRect(r.x, r.y, r.w, 8);
  ink(c, issueNo(is.n), r.x + 2, r.y + 2, 4, YELLOW);
  c.fillStyle = 'rgba(16,14,12,0.78)';
  c.fillRect(r.x, r.y + r.h - 8, r.w, 8);
  const d = issueDate(is.n);
  ink(c, `${d.month.slice(0, 3)} ${String(d.year).slice(2)}`, r.x + r.w / 2, r.y + r.h - 6, 4, '#fff', 'center');
}

// ---------- tela EDIÇÕES ANTERIORES ----------
export const back = { sel: -1, top: 0, from: 'title' as ScreenId, t0: 0 };
const THUMBS = 6;
const coverR = (): Rect => ({ x: ox() + 4, y: 22, w: SAFE_W - 8, h: 112 });
const thumbR = (i: number): Rect => ({ x: ox() + 21 + i * 47, y: 152, w: 43, h: 48 });
const stripR = (): Rect => ({ x: ox() + 19, y: 150, w: THUMBS * 47, h: 52 });
const btns = () => ({ back: { x: ox() + 4, y: 211, w: 100, h: 15 } as Rect, prev: { x: ox() + 4, y: 160, w: 13, h: 32 } as Rect, next: { x: ox() + 303, y: 160, w: 13, h: 32 } as Rect });
export function openIssues(s: AppState, a: Actions, from: ScreenId, n?: number) {
  syncIssues(s.career);
  a.go('issues');
  back.from = from;
  const list = issues();
  const i = n === undefined ? -1 : list.findIndex((q) => q.n === n);
  back.sel = i >= 0 ? i : list.length - 1;
  back.top = Math.max(0, Math.min(back.sel - THUMBS + 1, list.length - THUMBS));
  back.t0 = s.t;
}
function pickIssue(s: AppState, i: number) {
  const list = issues();
  if (!list.length) return;
  const n = Math.max(0, Math.min(list.length - 1, i));
  if (n !== back.sel) back.t0 = s.t;
  back.sel = n;
  if (back.sel < back.top) back.top = back.sel;
  if (back.sel >= back.top + THUMBS) back.top = back.sel - THUMBS + 1;
}
export function drawIssues(c: CanvasRenderingContext2D, s: AppState) {
  const x = ox();
  paper(c);
  masthead(c, 'EDIÇÕES ANTERIORES');
  const list = issues();
  const b = btns();
  if (!list.length) {
    const r = coverR();
    c.strokeStyle = 'rgba(26,22,20,0.3)';
    c.setLineDash([3, 3]);
    c.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1);
    c.setLineDash([]);
    ink(c, 'NENHUMA EDIÇÃO DO LEITOR AINDA', x + SAFE_W / 2, r.y + 34, 5, INK, 'center');
    ['Vença um chefão, bata um recorde, compre', 'um carro ou prepare um motor de verdade:', 'o seu feito vira capa da DUEL RACER.'].forEach((l, i) => ink(c, l, x + SAFE_W / 2, r.y + 52 + i * 10, 5, GREY, 'center'));
    tag(c, b.back, '◀ VOLTAR');
    return;
  }
  back.sel = Math.max(0, Math.min(back.sel, list.length - 1));
  const is = list[back.sel];
  drawIssueCover(c, coverR(), is, Math.min(1, (s.t - back.t0) / 8), s.t);
  const d = issueDate(is.n);
  ink(c, `${issueNo(is.n)} • ${d.month} DE ${d.year}`, x + 4, 140, 5, INK);
  ink(c, `${back.sel + 1} DE ${list.length}`, x + SAFE_W - 4, 140, 5, GREY, 'right');
  for (let k = 0; k < THUMBS; k++) {
    const q = list[back.top + k];
    if (q) drawThumb(c, thumbR(k), q, back.top + k === back.sel);
  }
  if (back.top > 0) arrow(c, b.prev, 'left', true);
  if (back.top + THUMBS < list.length) arrow(c, b.next, 'right', true);
  tag(c, b.back, '◀ VOLTAR');
}
export function tapIssues(s: AppState, a: Actions, x: number, y: number) {
  const b = btns();
  if (inside(x, y, b.back)) return a.go(back.from);
  if (inside(x, y, b.prev)) return pickIssue(s, back.top - 1);
  if (inside(x, y, b.next)) return pickIssue(s, back.top + THUMBS);
  for (let k = 0; k < THUMBS; k++) if (inside(x, y, thumbR(k)) && issues()[back.top + k]) return pickIssue(s, back.top + k);
}
export function keyIssues(s: AppState, a: Actions, k: MenuKey) {
  if (k === 'back') return a.go(back.from);
  if (k === 'prevTab' || k === 'nextTab') pickIssue(s, back.sel + (k === 'nextTab' ? 1 : -1));
}
export function issuesFocusables(s: AppState, a: Actions): FocusSet {
  const b = btns();
  const items: Focusable[] = [];
  if (issues().length) items.push({ r: stripR(), lr: (d) => pickIssue(s, back.sel + d), act: () => {} });
  items.push({ r: b.back, act: () => a.go(back.from) });
  return { key: 'issues', items, def: 0 };
}
// para testes automatizados (save trocado por fora)
Object.assign(window, { edicoes: { reloadIssues, issues, syncIssues } });
