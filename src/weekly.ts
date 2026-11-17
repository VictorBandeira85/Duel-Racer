// Ranking da semana entre amigos, por código (como o fantasma de amigo): os seus melhores tempos de
// cada trecho dos roteiros do Arcade nesta semana (semana do ano, de segunda a domingo) viram um
// código DRW1 com o apelido e a placa; colando os códigos dos amigos, a tela RANKING DA SEMANA monta
// a tabela de cada roteiro com a posição de cada um. Na semana seguinte tudo recomeça.
import { COURSES } from './courses';
import { parsePlate, myPlate } from './myplate';
import { cleanName, playerName } from './daily';
import { isObj } from './util';

const KEY_ME = 'duel-racer:semana';
const KEY_FR = 'duel-racer:semana-amigos';
const CODE_V = 'DRW1';
const MAX_FRIENDS = 30;

// semana ISO (a semana 1 tem a primeira quinta-feira do ano): "2026-47"
export function weekKey(d = new Date()) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  const w = Math.ceil(((t.getTime() - y0.getTime()) / 86400000 + 1) / 7);
  return `${t.getUTCFullYear()}-${String(w).padStart(2, '0')}`;
}
// segunda e domingo da semana atual ("16/11 a 22/11")
export function weekSpan(d = new Date()) {
  const mon = new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay() + 6) % 7));
  const sun = new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + 6);
  const f = (x: Date) => `${String(x.getDate()).padStart(2, '0')}/${String(x.getMonth() + 1).padStart(2, '0')}`;
  return `${f(mon)} a ${f(sun)}`;
}

// tempos em centésimos por trecho: { roteiro: [cs do trecho 1, cs do trecho 2, ...] } (0 = não correu)
export type Times = Record<string, number[]>;
export interface Entry { n: string; p: string; c: string; e: Times; me?: boolean; at?: number }

const read = (k: string) => {
  try {
    const v = JSON.parse(localStorage.getItem(k) || 'null');
    return isObj(v) ? v : null;
  } catch {
    return null;
  }
};
const write = (k: string, v: unknown) => {
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch { /* sem armazenamento: só nesta sessão */ }
};

function okTimes(e: unknown): e is Times {
  if (!isObj(e)) return false;
  for (const [id, arr] of Object.entries(e)) {
    const c = COURSES.find((q) => q.id === id);
    if (!c || !Array.isArray(arr) || arr.length > c.stages.length) return false;
    if (!arr.every((v) => Number.isInteger(v) && (v === 0 || (v >= 500 && v <= 360000)))) return false;
  }
  return true;
}

export function myTimes(): Times {
  const v = read(KEY_ME);
  return v && v.w === weekKey() && okTimes(v.t) ? v.t : {};
}
// fim de um trecho do Arcade (main.ts): guarda se for o melhor da semana neste trecho
export function logWeek(course: string, stage: number, time: number) {
  const c = COURSES.find((q) => q.id === course);
  if (!c || stage < 0 || stage >= c.stages.length || !(time > 5 && time < 3600)) return;
  const t = myTimes();
  const arr = t[course] ?? [];
  while (arr.length < c.stages.length) arr.push(0);
  const cs = Math.round(time * 100);
  if (!arr[stage] || cs < arr[stage]) {
    arr[stage] = cs;
    t[course] = arr;
    write(KEY_ME, { w: weekKey(), t });
  }
}

export function friends(): Entry[] {
  const v = read(KEY_FR);
  if (!v || v.w !== weekKey() || !Array.isArray(v.list)) return [];
  return v.list.filter((f: unknown) => isObj(f) && typeof f.n === 'string' && typeof f.p === 'string' && okTimes(f.e));
}
export function clearFriends() {
  write(KEY_FR, { w: weekKey(), list: [] });
}

export const myName = () => cleanName(playerName() || 'PILOTO');

// ---------- código ----------
function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
const check = (body: string) => (hash(`${CODE_V}|${body}`) % 1679616).toString(36).toUpperCase().padStart(4, '0');
const b64e = (s: string) => btoa(unescape(encodeURIComponent(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const b64d = (s: string) => decodeURIComponent(escape(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4))));

// código com os tempos da semana; null se ainda não correu nada nesta semana
export function weekCode(): { code: string; n: number } | null {
  const t = myTimes();
  // sem os zeros do fim (trechos não corridos)
  const e: Times = {};
  let n = 0;
  for (const [id, arr] of Object.entries(t)) {
    const a = [...arr];
    while (a.length && !a[a.length - 1]) a.pop();
    if (a.length) {
      e[id] = a;
      n += a.filter(Boolean).length;
    }
  }
  if (!n) return null;
  const p = myPlate();
  const body = b64e(JSON.stringify({ w: weekKey(), n: myName(), p: p.text, c: p.city, e }));
  return { code: `${CODE_V}.${body}.${check(body)}`, n };
}

// lê o código de um amigo; devolve a entrada ou o motivo da recusa
export function parseWeekCode(raw: string): Entry | string {
  const m = raw.match(/DRW1\.([A-Za-z0-9_-]+)\.([0-9A-Za-z]{4})/);
  if (!m) return raw.includes('DR1.') ? 'Esse é um código de fantasma: cole na tela de Ranking > DESAFIO DE AMIGO.' : 'Não achei um código do ranking da semana (começa com DRW1.).';
  const [, body, cc] = m;
  if (check(body) !== cc.toUpperCase()) return 'Código incompleto ou alterado: copie de novo, inteiro.';
  let v: unknown;
  try {
    v = JSON.parse(b64d(body));
  } catch {
    return 'Código estragado: copie de novo, inteiro.';
  }
  if (!isObj(v) || typeof v.w !== 'string' || typeof v.n !== 'string' || typeof v.p !== 'string') return 'Código estragado: copie de novo, inteiro.';
  if (!/^\d{4}-\d{2}$/.test(v.w)) return 'Código estragado.';
  if (v.w !== weekKey()) return `Código de outra semana (${v.w.slice(5)}ª de ${v.w.slice(0, 4)}): peça o desta semana.`;
  const p = parsePlate(v.p);
  if (!p) return 'Placa inválida no código.';
  if (!okTimes(v.e)) return 'Tempos inválidos no código.';
  const n = cleanName(v.n);
  if (n === myName() && p === myPlate().text) return 'Esse código é o seu! Mande para um amigo.';
  return { n, p, c: typeof v.c === 'string' ? v.c.slice(0, 24) : '', e: v.e as Times, at: Date.now() };
}
export function addFriend(f: Entry) {
  const list = friends().filter((q) => !(q.n === f.n && q.p === f.p));
  list.push(f);
  list.sort((a, b) => (b.at ?? 0) - (a.at ?? 0));
  write(KEY_FR, { w: weekKey(), list: list.slice(0, MAX_FRIENDS) });
}

// tabela de um roteiro: quem correu (eu e os amigos), mais trechos primeiro e depois o menor tempo total
export interface Row { name: string; plate: string; me: boolean; done: number; total: number; stages: number[] }
export function table(courseId: string): Row[] {
  const c = COURSES.find((q) => q.id === courseId);
  if (!c) return [];
  const p = myPlate();
  const all: Entry[] = [{ n: myName(), p: p.text, c: p.city, e: myTimes(), me: true }, ...friends()];
  const rows: Row[] = [];
  for (const en of all) {
    const arr = en.e[courseId];
    if (!arr || !arr.some(Boolean)) continue;
    const st = c.stages.map((_, i) => arr[i] || 0);
    rows.push({ name: en.n, plate: en.p, me: !!en.me, done: st.filter(Boolean).length, total: st.reduce((a, b) => a + b, 0) / 100, stages: st.map((v) => v / 100) });
  }
  return rows.sort((a, b) => b.done - a.done || a.total - b.total);
}
// roteiros com algum tempo nesta semana (meu ou de amigo), na ordem do guia
export function activeCourses(): number[] {
  const ids = new Set<string>([...Object.keys(myTimes()), ...friends().flatMap((f) => Object.keys(f.e))]);
  return COURSES.map((c, i) => (ids.has(c.id) && table(c.id).length ? i : -1)).filter((i) => i >= 0);
}
