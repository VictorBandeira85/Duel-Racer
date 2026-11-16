// Andamento de um roteiro do Arcade: depois de cada trecho concluído fica guardado (carro, rival,
// dia/noite, resultados e carros restantes). Sair no meio do roteiro não perde o que já foi feito:
// o Guia de Roteiros oferece CONTINUAR do próximo trecho.
import type { StageResult } from './screens';

export interface ArcadeSave { course: string; courseIdx: number; carIdx: number; oppIdx: number; night: boolean; time?: string; lives: number; results: StageResult[] }
const KEY = 'duel-racer:arcade-andamento';

export function loadArcade(): ArcadeSave | null {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || 'null');
    // (save estragado ou de outra versão: sem andamento, em vez de travar o CONTINUAR)
    if (!v || !Array.isArray(v.results) || !Number.isInteger(v.courseIdx) || v.courseIdx < 0) return null;
    v.results = v.results.filter((q: unknown) => !!q && typeof (q as StageResult).time === 'number');
    if (typeof v.lives !== 'number' || !Number.isFinite(v.lives) || v.lives < 1) v.lives = 1;
    return v;
  } catch {
    return null;
  }
}
export function saveArcade(v: ArcadeSave) {
  try {
    localStorage.setItem(KEY, JSON.stringify(v));
  } catch {
    /* sem armazenamento */
  }
}
export function clearArcade() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* sem armazenamento */
  }
}
