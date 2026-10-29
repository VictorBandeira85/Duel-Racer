// Modo econômico: em aparelho fraco, quando o jogo não consegue manter ~50 quadros por segundo,
// alivia o que mais pesa (distância de desenho da pista, retrovisor externo redesenhado a cada
// quadro, gotas de chuva e fumaça). "AUTO" decide sozinho, medindo os quadros na corrida.
export type FxMode = 'auto' | 'alto' | 'eco';
const KEY = 'duel-racer:efeitos';
export const FX_LABEL: Record<FxMode, string> = { auto: 'AUTOMÁTICO', alto: 'MÁXIMO', eco: 'ECONÔMICO' };

let mode: FxMode = (() => {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'alto' || v === 'eco' ? v : 'auto';
  } catch {
    return 'auto';
  }
})();
let autoLow = false;
let ema = 1 / 60;
let slowT = 0, fastT = 0;

export const fxMode = () => mode;
export function setFxMode(m: FxMode) {
  mode = m;
  try {
    localStorage.setItem(KEY, m);
  } catch { /* sem armazenamento: vale só nesta sessão */ }
}
export const lowFx = () => mode === 'eco' || (mode === 'auto' && autoLow);

// chamado a cada quadro da corrida com o tempo real do quadro (s)
export function perfSample(dt: number) {
  if (dt <= 0 || dt > 0.2) return; // pausa, troca de aba
  ema += (dt - ema) * 0.05;
  if (ema > 1 / 48) {
    slowT += dt;
    fastT = 0;
    if (slowT > 3) autoLow = true;
  } else if (ema < 1 / 57) {
    fastT += dt;
    slowT = 0;
    // volta ao máximo só depois de um bom tempo folgado (no econômico tudo fica mais leve)
    if (fastT > 20) autoLow = false;
  }
}

// quadro de contagem para pular trabalho em quadros alternados
let tick = 0;
export const fxTick = () => ++tick;
