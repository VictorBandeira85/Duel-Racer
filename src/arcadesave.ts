// Andamento de um roteiro do Arcade: depois de cada trecho concluído fica guardado (carro, rival,
// dia/noite, resultados e carros restantes). Sair no meio do roteiro não perde o que já foi feito:
// o Guia de Roteiros oferece CONTINUAR do próximo trecho.
import type { StageResult } from './screens';

export interface ArcadeSave { course: string; courseIdx: number; carIdx: number; oppIdx: number; night: boolean; time?: string; lives: number; results: StageResult[] }
const KEY = 'duel-racer:arcade-andamento';

export function loadArcade(): ArcadeSave | null {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || 'null');
    return v && Array.isArray(v.results) ? v : null;
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
