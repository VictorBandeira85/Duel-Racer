export const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const easeIn = (a: number, b: number, t: number) => a + (b - a) * t * t;
export const easeInOut = (a: number, b: number, t: number) => a + (b - a) * (-Math.cos(t * Math.PI) / 2 + 0.5);
export const overlap = (x1: number, half1: number, x2: number, half2: number) => Math.abs(x1 - x2) < half1 + half2;

// Gerador pseudoaleatório com semente (mulberry32): mesma semente = mesma pista
export function rng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shade(hex: string, amount: number) {
  const n = parseInt(hex.slice(1), 16);
  const f = (c: number) => clamp(Math.round(c + amount * 255), 0, 255);
  const r = f(n >> 16), g = f((n >> 8) & 255), b = f(n & 255);
  return `rgb(${r},${g},${b})`;
}

export function formatTime(t: number) {
  const m = Math.floor(t / 60);
  const s = t - m * 60;
  return `${m}:${s.toFixed(2).padStart(5, '0')}`;
}

// cache com limite (o mais antigo sai primeiro): texturas e padrões feitos por cor, que no pôr do
// sol, no amanhecer e com o tempo virando ganham uma versão nova a cada degrau da mistura de cores
// e cresciam sem fim ao longo da sessão. get() devolve e põe no fim (o que está em uso não sai).
export class Lru<K, V> {
  private m = new Map<K, V>();
  constructor(private max: number, private onDrop?: (v: V) => void) {}
  get(k: K): V | undefined {
    const v = this.m.get(k);
    if (v !== undefined) {
      this.m.delete(k);
      this.m.set(k, v);
    }
    return v;
  }
  set(k: K, v: V) {
    this.m.delete(k);
    this.m.set(k, v);
    while (this.m.size > this.max) {
      const old = this.m.keys().next().value as K;
      const ov = this.m.get(old)!;
      this.m.delete(old);
      this.onDrop?.(ov);
    }
  }
  get size() {
    return this.m.size;
  }
}

// objeto comum (não nulo, não lista): conferência dos saves lidos do armazenamento, que podem vir de
// versões antigas ou estragados
export const isObj = (v: unknown): v is Record<string, any> => !!v && typeof v === 'object' && !Array.isArray(v);
