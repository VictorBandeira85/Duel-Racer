// Desafios de cada trecho (3 metas sorteadas pelo trecho, com valores na medida do carro) e
// conquistas (metas do jogo inteiro). Desafios cumpridos dão medalha (1 bronze, 2 prata,
// 3 ouro) e, na carreira, dinheiro; conquistas aparecem num aviso no alto da tela.
import { KMH } from './config';
import type { Race } from './race';
import { rng } from './util';

export type ChallengeKind = 'passes' | 'top' | 'clean' | 'nobrake' | 'near' | 'avg' | 'air' | 'noscrape';
export interface Challenge { kind: ChallengeKind; target: number; label: string }
export interface ChallengeResult { label: string; done: boolean }

const MEDAL_KEY = 'duel-racer:medalhas';
const ACH_KEY = 'duel-racer:conquistas';
const STATS_KEY = 'duel-racer:estatisticas';
export const CHALLENGE_PRIZE = 1500; // por desafio cumprido, na carreira

const read = <T>(key: string, empty: T): T => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? { ...empty, ...(JSON.parse(raw) as T) } : empty;
  } catch {
    return empty;
  }
};
const write = (key: string, v: unknown) => {
  try {
    localStorage.setItem(key, JSON.stringify(v));
  } catch { /* sem armazenamento */ }
};

// ---------- desafios do trecho ----------
export function stageChallenges(r: Race): Challenge[] {
  const def = r.def;
  const rand = rng((r.course.seed ?? r.course.id.length * 1000) + r.stageIdx * 131 + 77);
  const max = r.car.maxSpeed * KMH;
  const pool: Challenge[] = [];
  const traffic = def.traffic;
  const n = Math.max(4, Math.round(traffic * (2.5 + rand() * 1.5)));
  pool.push({ kind: 'passes', target: n, label: `Ultrapasse ${n} carros` });
  const top = Math.round((max * (0.82 + rand() * 0.08)) / 5) * 5;
  pool.push({ kind: 'top', target: top, label: `Chegue a ${top} km/h` });
  pool.push({ kind: 'clean', target: 0, label: def.weather === 'rain' ? 'Trecho limpo na chuva' : def.weather === 'snow' ? 'Trecho limpo na neve' : def.weather === 'fog' ? 'Trecho limpo na neblina' : 'Sem batidas nem multas' });
  pool.push({ kind: 'nobrake', target: 3, label: 'Freie no máximo 3 s' });
  const near = Math.max(2, Math.round(traffic * 0.8));
  pool.push({ kind: 'near', target: near, label: `Passe raspando ${near} carros na contramão` });
  const avg = Math.round((max * (0.5 + rand() * 0.08)) / 5) * 5;
  pool.push({ kind: 'avg', target: avg, label: `Média acima de ${avg} km/h` });
  if (def.hilliness >= 0.9) pool.push({ kind: 'air', target: 0.5, label: 'Fique meio segundo no ar num salto' });
  pool.push({ kind: 'noscrape', target: 0, label: 'Nenhum raspão' });
  // três diferentes, sorteados pelo trecho
  const out: Challenge[] = [];
  while (out.length < 3 && pool.length) out.push(pool.splice(Math.floor(rand() * pool.length), 1)[0]);
  return out;
}

// cumprido? (no meio do trecho só os que já não podem mais falhar: os "de chegar a" )
export function checkChallenge(ch: Challenge, r: Race, final: boolean): boolean {
  const st = r.stats;
  switch (ch.kind) {
    case 'passes': return st.passes >= ch.target;
    case 'top': return r.top * KMH >= ch.target;
    case 'near': return st.near >= ch.target;
    case 'air': return st.bestAir >= ch.target;
    case 'clean': return final && r.crashes === 0 && r.tickets === 0;
    case 'nobrake': return final && st.brakeT <= ch.target;
    case 'noscrape': return final && st.scrapes === 0 && r.crashes === 0;
    case 'avg': {
      if (!final) return false;
      const km = ((r.track.finishZ - r.track.startZ) * KMH) / 3600;
      return km / (r.time / 3600) >= ch.target;
    }
  }
}

export const medalName = (n: number) => ['', 'BRONZE', 'PRATA', 'OURO'][n] ?? '';
export const MEDAL_COLOR = ['#555', '#c87a3a', '#c8ccd4', '#ffd23a'];

// guarda a melhor medalha do trecho; devolve se melhorou
export function saveMedal(course: string, stage: number, n: number): boolean {
  const m = read<Record<string, number>>(MEDAL_KEY, {});
  const k = `${course}:${stage}`;
  if ((m[k] ?? 0) >= n) return false;
  m[k] = n;
  write(MEDAL_KEY, m);
  return true;
}
export function medals(): Record<string, number> {
  return read<Record<string, number>>(MEDAL_KEY, {});
}

// ---------- conquistas ----------
export interface Stats { passes: number; near: number; tunnels: number; golds: number; wins: number; stages: number }
const EMPTY: Stats = { passes: 0, near: 0, tunnels: 0, golds: 0, wins: 0, stages: 0 };
export function loadStats(): Stats {
  return read<Stats>(STATS_KEY, { ...EMPTY });
}

export interface Achievement { id: string; name: string; desc: string }
export const ACHIEVEMENTS: Achievement[] = [
  { id: 'win', name: 'Primeiro Duelo', desc: 'Vença um trecho contra o rival' },
  { id: 'clean', name: 'Mão Leve', desc: 'Trecho sem bater nem levar multa' },
  { id: 'v300', name: 'Barreira dos 300', desc: 'Passe de 300 km/h' },
  { id: 'air', name: 'Asas', desc: 'Fique 1 s no ar num salto' },
  { id: 'pass50', name: 'Ultrapassador', desc: '50 ultrapassagens no total' },
  { id: 'pass500', name: 'Dono da Estrada', desc: '500 ultrapassagens no total' },
  { id: 'near25', name: 'Por um Fio', desc: 'Passe raspando 25 carros na contramão' },
  { id: 'tunnel10', name: 'Rato de Túnel', desc: 'Atravesse 10 túneis' },
  { id: 'rain', name: 'Pista Molhada', desc: 'Trecho limpo na chuva' },
  { id: 'snow', name: 'Gelo Fino', desc: 'Trecho limpo na neve' },
  { id: 'fog', name: 'Olhos de Lince', desc: 'Trecho limpo na neblina' },
  { id: 'dusk', name: 'Pôr do Sol', desc: 'Complete um trecho com pôr do sol' },
  { id: 'night', name: 'Coruja', desc: 'Vença um trecho de noite' },
  { id: 'record', name: 'Contra Si Mesmo', desc: 'Bata o próprio recorde de um trecho' },
  { id: 'gold', name: 'Ouro', desc: 'Cumpra os 3 desafios de um trecho' },
  { id: 'gold25', name: 'Baú de Ouro', desc: '25 medalhas de ouro' },
  { id: 'maps10', name: 'Explorador', desc: 'Libere 10 mapas no Arcade' },
  { id: 'legend', name: 'Lenda', desc: 'Conclua a Rota das Lendas' },
];

export function unlockedAchievements(): Record<string, number> {
  return read<Record<string, number>>(ACH_KEY, {});
}

// aviso no alto da tela (conquistas e desafios cumpridos no meio do trecho)
const toasts: { text: string; sub: string; t: number; color: string }[] = [];
export function toast(text: string, sub = '', color = '#ffd23a') {
  toasts.push({ text, sub, t: 3.2, color });
}
export function takeToast(dt: number) {
  const t = toasts[0];
  if (!t) return null;
  t.t -= dt;
  if (t.t <= 0) toasts.shift();
  return t;
}

function grant(ids: string[]) {
  const got = unlockedAchievements();
  let changed = false;
  for (const id of ids) {
    if (got[id]) continue;
    const a = ACHIEVEMENTS.find((q) => q.id === id);
    if (!a) continue;
    got[id] = Date.now();
    changed = true;
    toast(`CONQUISTA: ${a.name}`, a.desc);
  }
  if (changed) write(ACH_KEY, got);
}

// fim do trecho: soma as estatísticas e confere as conquistas
export function stageAchievements(r: Race, o: { won: boolean; record: boolean; medal: number; unlocked: number; legend: boolean }) {
  const s = loadStats();
  s.passes += r.stats.passes;
  s.near += r.stats.near;
  s.tunnels += r.stats.tunnels;
  s.stages++;
  if (o.medal >= 3) s.golds++;
  if (o.won) s.wins++;
  write(STATS_KEY, s);
  const clean = r.crashes === 0 && r.tickets === 0;
  const ids: string[] = [];
  if (o.won && r.rival) ids.push('win');
  if (clean) ids.push('clean');
  if (r.top * KMH >= 300) ids.push('v300');
  if (r.stats.bestAir >= 1) ids.push('air');
  if (s.passes >= 50) ids.push('pass50');
  if (s.passes >= 500) ids.push('pass500');
  if (s.near >= 25) ids.push('near25');
  if (s.tunnels >= 10) ids.push('tunnel10');
  if (clean && r.def.weather === 'rain') ids.push('rain');
  if (clean && r.def.weather === 'snow') ids.push('snow');
  if (clean && r.def.weather === 'fog') ids.push('fog');
  if (r.def.dusk) ids.push('dusk');
  if (o.won && r.rival && r.def.night && !r.def.dusk) ids.push('night');
  if (o.record) ids.push('record');
  if (o.medal >= 3) ids.push('gold');
  if (s.golds >= 25) ids.push('gold25');
  if (o.unlocked >= 10) ids.push('maps10');
  if (o.legend) ids.push('legend');
  grant(ids);
}
