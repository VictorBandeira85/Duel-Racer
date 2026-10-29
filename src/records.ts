// Recordes e fantasma, guardados no aparelho.
// Recorde: o melhor tempo de cada trecho com cada carro. Fantasma: a melhor passagem de cada
// trecho (com qualquer carro), gravada como a posição na pista a cada décimo de segundo, que
// volta transparente nas próximas tentativas para você disputar com ela.
import type { Race } from './race';

const KEY_T = 'duel-racer:recordes';
const KEY_G = 'duel-racer:fantasmas';
const KEY_ON = 'duel-racer:fantasma';
const MAX_GHOSTS = 60;
export const GHOST_DT = 0.1;

export interface Ghost {
  car: string; // id do carro
  paint?: string;
  time: number; // tempo do trecho (s)
  at: number; // quando foi gravado (para descartar os mais velhos)
  z: number[]; // posição ao longo da pista a cada GHOST_DT
  x: number[]; // posição lateral
}

const read = <T>(key: string, empty: T): T => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : empty;
  } catch {
    return empty;
  }
};
const write = (key: string, v: unknown) => {
  try {
    localStorage.setItem(key, JSON.stringify(v));
  } catch { /* sem espaço ou sem armazenamento: vale só nesta sessão */ }
};

export const stageKey = (course: string, stage: number) => `${course}:${stage}`;

export function ghostOn() {
  return read(KEY_ON, true);
}
export function setGhostOn(on: boolean) {
  write(KEY_ON, on);
}

export function bestTime(course: string, stage: number, car: string): number | undefined {
  return read<Record<string, number>>(KEY_T, {})[`${stageKey(course, stage)}:${car}`];
}

export function loadGhost(course: string, stage: number): Ghost | null {
  if (!ghostOn()) return null;
  // o fantasma de um amigo (código colado) tem a vez sobre o seu
  const friend = read<Record<string, Ghost>>('duel-racer:fantasmas-amigo', {})[stageKey(course, stage)];
  return friend ?? read<Record<string, Ghost>>(KEY_G, {})[stageKey(course, stage)] ?? null;
}

// Fim do trecho: grava o recorde do carro e, se for a melhor passagem do trecho, o fantasma.
// Devolve o recorde anterior (do carro) e se este tempo é novo recorde.
export function saveRun(r: Race, course: string, stage: number, paint?: string): { prev?: number; record: boolean; ghost: boolean } {
  const times = read<Record<string, number>>(KEY_T, {});
  const k = `${stageKey(course, stage)}:${r.car.id}`;
  const prev = times[k];
  const record = prev === undefined || r.time < prev;
  if (record) {
    times[k] = r.time;
    write(KEY_T, times);
  }
  const ghosts = read<Record<string, Ghost>>(KEY_G, {});
  const gk = stageKey(course, stage);
  const old = ghosts[gk];
  const better = !old || r.time < old.time;
  if (better && r.trace.z.length > 10) {
    ghosts[gk] = { car: r.car.id, paint, time: r.time, at: Date.now(), z: r.trace.z, x: r.trace.x };
    const keys = Object.keys(ghosts);
    if (keys.length > MAX_GHOSTS) {
      keys.sort((a, b) => ghosts[a].at - ghosts[b].at);
      for (const kk of keys.slice(0, keys.length - MAX_GHOSTS)) delete ghosts[kk];
    }
    write(KEY_G, ghosts);
  }
  return { prev, record, ghost: better };
}

// posição do fantasma no instante t (interpolada entre as amostras); null depois que chegou
export function ghostAt(g: Ghost, t: number): { z: number; x: number } | null {
  const f = t / GHOST_DT;
  const i = Math.floor(f);
  if (i < 0 || i >= g.z.length - 1) return null;
  const u = f - i;
  return { z: g.z[i] + (g.z[i + 1] - g.z[i]) * u, x: g.x[i] + (g.x[i + 1] - g.x[i]) * u };
}

// em que instante o fantasma passou por z (para mostrar a diferença de tempo)
export function ghostTimeAt(g: Ghost, z: number): number | null {
  const a = g.z;
  if (!a.length || z < a[0] || z > a[a.length - 1]) return null;
  let lo = 0, hi = a.length - 1;
  while (hi - lo > 1) {
    const m = (lo + hi) >> 1;
    if (a[m] < z) lo = m;
    else hi = m;
  }
  const span = a[hi] - a[lo];
  return (lo + (span > 0 ? (z - a[lo]) / span : 0)) * GHOST_DT;
}

// ---------- fantasma de amigo, por código ----------
// O melhor fantasma de cada trecho de um roteiro vira um texto para mandar a um amigo (WhatsApp,
// e-mail). Amostras a cada 0,2 s: avanço na pista e posição lateral em diferenças pequenas
// (1 byte cada), comprimidas e em base64. Quem cola o código corre contra esse fantasma.
const KEY_F = 'duel-racer:fantasmas-amigo';
const CODE_V = 'DR1';
const ZQ = 10, XQ = 25; // passo da quantização (unidades da pista)

export interface FriendGhost extends Ghost { friend: true }

async function pack(bytes: Uint8Array): Promise<string> {
  let out = bytes;
  let z = '0';
  if (typeof CompressionStream !== 'undefined') {
    const cs = new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate-raw'));
    out = new Uint8Array(await new Response(cs).arrayBuffer());
    z = '1';
  }
  let bin = '';
  out.forEach((b) => (bin += String.fromCharCode(b)));
  return z + btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
async function unpack(s: string): Promise<Uint8Array> {
  const z = s[0];
  const b64 = s.slice(1).replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64 + '==='.slice((b64.length + 3) % 4));
  let bytes = Uint8Array.from(bin, (ch) => ch.charCodeAt(0));
  if (z === '1') {
    const ds = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    bytes = new Uint8Array(await new Response(ds).arrayBuffer());
  }
  return bytes;
}

// código com os fantasmas (próprios) dos trechos do roteiro; null se não houver nenhum
export async function ghostCode(course: string, stages: number): Promise<{ code: string; n: number } | null> {
  const all = read<Record<string, Ghost>>(KEY_G, {});
  const meta: { i: number; car: string; paint?: string; time: number; z0: number; x0: number; n: number }[] = [];
  const bytes: number[] = [];
  for (let i = 0; i < stages; i++) {
    const g = all[stageKey(course, i)];
    if (!g || g.z.length < 4) continue;
    const z = g.z.filter((_, k) => k % 2 === 0), x = g.x.filter((_, k) => k % 2 === 0);
    meta.push({ i, car: g.car, paint: g.paint, time: Math.round(g.time * 100) / 100, z0: Math.round(z[0]), x0: Math.round(x[0]), n: z.length });
    let qz = Math.round(z[0] / ZQ), qx = Math.round(x[0] / XQ);
    for (let k = 1; k < z.length; k++) {
      // avanço (sempre para a frente) até 255 passos e lateral -127..127 por amostra; o
      // arredondamento acumulado é corrigido amostra a amostra (não deriva)
      const dz = Math.max(0, Math.min(255, Math.round(z[k] / ZQ) - qz));
      const dx = Math.max(-127, Math.min(127, Math.round(x[k] / XQ) - qx));
      qz += dz; qx += dx;
      bytes.push(dz, dx & 255);
    }
  }
  if (!meta.length) return null;
  const head = btoa(unescape(encodeURIComponent(JSON.stringify({ c: course, s: meta })))).replace(/=+$/, '');
  return { code: `${CODE_V}.${head}.${await pack(Uint8Array.from(bytes))}`, n: meta.length };
}

// lê o código de um amigo e guarda os fantasmas dele; devolve o roteiro e quantos trechos
export async function loadGhostCode(code: string): Promise<{ course: string; n: number } | null> {
  try {
    // aceita a mensagem inteira colada (o código começa em DR1. e vai até o fim da linha)
    const at = code.indexOf(CODE_V + '.');
    if (at < 0) return null;
    const [v, head, body] = code.slice(at).trim().split(/\s/)[0].split('.');
    if (v !== CODE_V || !head || !body) return null;
    const meta = JSON.parse(decodeURIComponent(escape(atob(head)))) as { c: string; s: { i: number; car: string; paint?: string; time: number; z0: number; x0: number; n: number }[] };
    const bytes = await unpack(body);
    const friends = read<Record<string, FriendGhost>>(KEY_F, {});
    let p = 0;
    for (const m of meta.s) {
      const z = [m.z0], x = [m.x0];
      let qz = Math.round(m.z0 / ZQ), qx = Math.round(m.x0 / XQ);
      for (let k = 1; k < m.n; k++) {
        qz += bytes[p++];
        const dx = bytes[p++];
        qx += dx > 127 ? dx - 256 : dx;
        z.push(qz * ZQ); x.push(qx * XQ);
      }
      // volta para amostras de 0,1 s (o meio de cada par é a média)
      const zz: number[] = [], xx: number[] = [];
      for (let k = 0; k < z.length; k++) {
        zz.push(z[k]); xx.push(x[k]);
        if (k < z.length - 1) { zz.push((z[k] + z[k + 1]) / 2); xx.push((x[k] + x[k + 1]) / 2); }
      }
      friends[stageKey(meta.c, m.i)] = { car: m.car, paint: m.paint, time: m.time, at: Date.now(), z: zz, x: xx, friend: true };
    }
    write(KEY_F, friends);
    return { course: meta.c, n: meta.s.length };
  } catch {
    return null;
  }
}

export const friendGhostCount = (course: string, stages: number) => {
  const f = read<Record<string, FriendGhost>>(KEY_F, {});
  let n = 0;
  for (let i = 0; i < stages; i++) if (f[stageKey(course, i)]) n++;
  return n;
};
export function clearFriendGhosts(course: string, stages: number) {
  const f = read<Record<string, FriendGhost>>(KEY_F, {});
  for (let i = 0; i < stages; i++) delete f[stageKey(course, i)];
  write(KEY_F, f);
}
