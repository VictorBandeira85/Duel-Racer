// Desafio do dia: sem servidor, tudo sai da data local (AAAA-MM-DD). Todo mundo que abre o jogo
// no mesmo dia recebe o mesmo trecho (mapa, pista, hora e clima), o mesmo carro do showroom e a
// mesma regra extra. Guarda o melhor tempo de cada dia, o histórico e a ofensiva (dias seguidos
// jogando o desafio do próprio dia). O resultado vira um código curto (nome, data, tempo e
// conferência) para mandar a um amigo; com o fantasma junto, quem cola corre contra a passagem dele.
import { CARS, perfClass, type CarSpec } from './cars';
import { COURSES, type ArcadeTime, type Course, type StageDef } from './courses';
import { ghostCode, loadGhostCode } from './records';
import { rng } from './util';
import { KMH } from './config';

export type DailyRule = 'none' | 'clean' | 'rival' | 'avg';
export interface Daily {
  date: string; // AAAA-MM-DD
  courseIdx: number; // roteiro de onde saiu o trecho
  stage: number; // trecho do roteiro
  car: CarSpec;
  rival: CarSpec | null;
  time: ArcadeTime;
  weather?: StageDef['weather'];
  rule: DailyRule;
  avg: number; // km/h exigidos na regra 'avg'
  course: Course; // roteiro de um trecho só, pronto para a corrida
}

const pad2 = (n: number) => String(n).padStart(2, '0');
export const dateKey = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
export const todayKey = () => dateKey(new Date());
// "15/11/2026"
export const dateLabel = (k: string) => k.split('-').reverse().join('/');
const MONTHS = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];
// "15 NOV" (selo da capa)
export const dateShort = (k: string) => `${Number(k.slice(8, 10))} ${MONTHS[Number(k.slice(5, 7)) - 1] ?? ''}`;
// dia anterior/seguinte (pelo calendário local; meio-dia evita a troca do horário de verão)
const shiftDay = (k: string, d: number) => {
  const t = new Date(Number(k.slice(0, 4)), Number(k.slice(5, 7)) - 1, Number(k.slice(8, 10)) + d, 12);
  return dateKey(t);
};
// número do dia desde 01/01/2024 (vai no código: 3 letras em base 36 dão até o ano 2150)
const EPOCH = Date.UTC(2024, 0, 1);
const dayNum = (k: string) => Math.round((Date.UTC(Number(k.slice(0, 4)), Number(k.slice(5, 7)) - 1, Number(k.slice(8, 10))) - EPOCH) / 864e5);
const numDay = (n: number) => {
  const d = new Date(EPOCH + n * 864e5);
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
};

// semente da data (FNV-1a): a mesma em qualquer aparelho
function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

// carros que podem sair no sorteio: os do showroom (sem viaturas e sem os que esperam a arte)
const pool = () => CARS.filter((c) => !c.arcadeOnly && !c.pendingArt);

export const RULE_LABEL: Record<DailyRule, string> = { none: 'MELHOR TEMPO', clean: 'SEM BATER', rival: 'CHEGUE ANTES DO RIVAL', avg: 'MÉDIA ACIMA DE' };
export const TIME_NAME: Record<ArcadeTime, string> = { day: 'DE DIA', sunset: 'NO PÔR DO SOL', dawn: 'AO AMANHECER', night: 'À NOITE' };
export const WEATHER_NAME: Record<string, string> = { rain: 'CHUVA', snow: 'NEVE', fog: 'NEBLINA' };
// versão curta (linha da ficha do resultado)
export const ruleShort = (d: Daily) => (d.rule === 'avg' ? `Média > ${d.avg}` : d.rule === 'clean' ? 'Sem bater' : d.rule === 'rival' ? 'Antes do rival' : 'Regra extra');
export const ruleText = (d: Daily) => (d.rule === 'avg' ? `${RULE_LABEL.avg} ${d.avg} KM/H` : RULE_LABEL[d.rule]);

const cache = new Map<string, Daily>();
export function dailyFor(date: string): Daily {
  const hit = cache.get(date);
  if (hit) return hit;
  const r = rng(hash(`duel-racer:${date}`));
  const pick = <T>(a: T[]) => a[Math.floor(r() * a.length) % a.length];
  const courseIdx = Math.floor(r() * COURSES.length) % COURSES.length;
  const src = COURSES[courseIdx];
  const stage = Math.floor(r() * src.stages.length) % src.stages.length;
  const cars = pool();
  const car = pick(cars);
  const time = pick<ArcadeTime>(['day', 'day', 'sunset', 'dawn', 'night']);
  const base = src.stages[stage];
  // clima conforme a paisagem: neve só nas pistas de neve, sem chuva no deserto
  const snowy = base.theme === 'snow' || base.theme === 'alpinesnow';
  const dry = base.theme === 'desert' || base.theme === 'canyon' || base.theme === 'savanna';
  const weather = pick<StageDef['weather']>(snowy ? ['snow', 'snow', 'fog', undefined] : dry ? [undefined, undefined, undefined, 'fog'] : [undefined, undefined, 'rain', 'fog']);
  const rule = pick<DailyRule>(['none', 'clean', 'clean', 'rival', 'rival', 'avg', 'avg']);
  // rival: obrigatório na regra do rival; nas outras, às vezes. Da mesma classe do seu carro quando dá
  const same = cars.filter((c) => c !== car && perfClass(c) === perfClass(car));
  const rivalPick = pick(same.length ? same : cars.filter((c) => c !== car));
  const rival = rule === 'rival' || r() < 0.5 ? rivalPick : null;
  // média exigida: 80% da média que o piloto do jogo faz com o mesmo carro no trecho (medida com
  // o rival correndo sozinho: ~95 km/h + 22% da máxima, menos nas pistas sinuosas e com morro)
  const ai = 95 + 0.22 * car.maxSpeed * KMH - 10 * (base.curviness - 1) - 5 * (base.hilliness - 0.5);
  const avg = Math.max(60, Math.floor((0.8 * ai) / 10) * 10);
  const st: StageDef = { ...base, weather, ...(time === 'day' ? { night: false, dusk: false, tod: undefined } : time === 'night' ? { night: true, dusk: false, tod: undefined } : { night: false, dusk: false, tod: time }) };
  // pista própria do dia (semente da data); o id separa recorde e fantasma de cada dia
  const course: Course = { id: `dia-${date}`, name: 'Desafio do Dia', level: src.level, rivalSkill: src.rivalSkill, stages: [st], seed: 50000 + (hash(date) % 40000) };
  const d: Daily = { date, courseIdx, stage, car, rival, time, weather, rule, avg, course };
  cache.set(date, d);
  return d;
}

// "Serra e Mar · trecho 3"
export const mapLabel = (d: Daily) => `${COURSES[d.courseIdx].name} · trecho ${d.stage + 1}`;

// tempo no estilo de revista: 3'12"40
export function fmtLap(t: number) {
  const cs = Math.max(0, Math.round(t * 100));
  const m = Math.floor(cs / 6000), s = Math.floor((cs % 6000) / 100), c = cs % 100;
  return `${m}'${pad2(s)}"${pad2(c)}`;
}

// a regra extra foi cumprida? (resultado do trecho)
export function ruleOk(d: Daily, res: { crashes: number; time: number; rival: number; avg: number }) {
  if (d.rule === 'clean') return res.crashes === 0;
  if (d.rule === 'rival') return res.rival >= 0 && res.time <= res.rival;
  if (d.rule === 'avg') return res.avg >= d.avg;
  return true;
}

// ---------- histórico ----------
export interface DayEntry { best?: number; tries: number; ok?: boolean; live?: boolean } // live: jogado no próprio dia
interface DailySave { days: Record<string, DayEntry>; friend?: Record<string, FriendResult> }
export interface FriendResult { name: string; time: number; ghost: boolean }
const KEY = 'duel-racer:desafio';
function load(): DailySave {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || 'null');
    return s && s.days ? s : { days: {} };
  } catch {
    return { days: {} };
  }
}
function store(s: DailySave) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch { /* sem armazenamento: vale só nesta sessão */ }
}
export const dayEntry = (date: string): DayEntry | undefined => load().days[date];
export const friendResult = (date: string): FriendResult | undefined => load().friend?.[date];

// dia em que a corrida do desafio largou (passar da meia-noite correndo ainda conta para a ofensiva)
let started: string | null = null;
export const markStart = () => { started = todayKey(); };

// fim do desafio: conta a tentativa e guarda o melhor tempo do dia (só valem as que cumpriram a regra)
export function saveDaily(d: Daily, time: number | null, ok: boolean): { prev?: number; best: boolean } {
  const s = load();
  const e = s.days[d.date] ?? { tries: 0 };
  const prev = e.best;
  e.tries++;
  if (d.date === (started ?? todayKey())) e.live = true;
  const best = time !== null && ok && (prev === undefined || time < prev);
  if (best) {
    e.best = time!;
    e.ok = true;
  }
  s.days[d.date] = e;
  store(s);
  return { prev, best };
}

// ofensiva: dias seguidos jogando o desafio do próprio dia (conta até hoje, ou até ontem se
// hoje ainda não jogou: a sequência só quebra depois de um dia inteiro sem jogar)
export function streak(today = todayKey()): number {
  const days = load().days;
  let k = days[today]?.live ? today : shiftDay(today, -1);
  let n = 0;
  while (days[k]?.live) {
    n++;
    k = shiftDay(k, -1);
  }
  return n;
}
export const daysPlayed = () => Object.values(load().days).filter((e) => e.live).length;

// ---------- código do resultado ----------
// DRD1.NOME.dddttttcc: ddd = dia (base 36), tttt = tempo em centésimos (base 36), cc = conferência.
// Com o fantasma, o código dele (DR1..., records.ts) vem logo depois, separado por espaço.
const CODE_V = 'DRD1';
const b36 = (n: number, w: number) => n.toString(36).toUpperCase().padStart(w, '0');
const check = (name: string, body: string) => b36(hash(`${CODE_V}|${name}|${body}`) % 1296, 2);
export const cleanName = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10) || 'PILOTO';

export function resultCode(name: string, date: string, time: number) {
  const nm = cleanName(name);
  const body = b36(dayNum(date), 3) + b36(Math.round(time * 100), 4);
  return `${CODE_V}.${nm}.${body}${check(nm, body)}`;
}
// código com o fantasma do dia junto (null se não houver fantasma gravado)
export async function resultCodeWithGhost(name: string, d: Daily, time: number) {
  const g = await ghostCode(d.course.id, 1);
  return g ? `${resultCode(name, d.date, time)} ${g.code}` : null;
}

export function parseResult(raw: string): { name: string; date: string; time: number } | null {
  const m = raw.toUpperCase().match(/DRD1\.([A-Z0-9]{1,10})\.([0-9A-Z]{9})(?![0-9A-Z])/);
  if (!m) return null;
  const [, name, all] = m;
  const body = all.slice(0, 7), cc = all.slice(7);
  if (check(name, body) !== cc) return null;
  const day = parseInt(body.slice(0, 3), 36), cs = parseInt(body.slice(3), 36);
  if (!Number.isFinite(day) || !Number.isFinite(cs) || cs <= 0) return null;
  return { name, date: numDay(day), time: cs / 100 };
}

// cola o código de um amigo: guarda o resultado (e o fantasma, se veio junto) para aquele dia
export async function acceptCode(raw: string): Promise<(FriendResult & { date: string }) | null> {
  const r = parseResult(raw);
  if (!r) return null;
  let ghost = false;
  if (raw.includes('DR1.')) {
    const g = await loadGhostCode(raw);
    ghost = !!g && g.course === `dia-${r.date}`;
  }
  const s = load();
  s.friend = { ...(s.friend ?? {}), [r.date]: { name: r.name, time: r.time, ghost } };
  store(s);
  return { ...r, ghost };
}

// nome do jogador no código (perguntado na primeira vez)
const NAME_KEY = 'duel-racer:nome';
export function playerName(): string | null {
  try {
    return localStorage.getItem(NAME_KEY);
  } catch {
    return null;
  }
}
export function setPlayerName(n: string) {
  try {
    localStorage.setItem(NAME_KEY, cleanName(n));
  } catch { /* sem armazenamento */ }
}
