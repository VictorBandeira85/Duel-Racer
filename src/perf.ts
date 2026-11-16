// Gráficos: "AUTOMÁTICO" mede os quadros na corrida e desce/sobe a qualidade em degraus (abaixo);
// "MÁXIMO" não desce nunca; "ECONÔMICO" fica sempre no degrau 2.
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
// Qualidade automática em degraus (0 = tudo; cada degrau alivia o que mais pesa naquele ponto):
//   1  estrada, carros e objetos desenhados em resolução 2x (em vez de 4x): quase não muda o visual
//   2  econômico: distância de desenho menor, chão sem textura, retrovisor externo a meia taxa,
//      metade das gotas/fumaça, sem estilhaços
//   3  mínimo: a tela inteira em 2x (um quarto dos pixels: o maior alívio em celular fraco) e a
//      camada de luzes da noite em meia resolução
// Desce quando os quadros caem (rápido se a queda é forte) e volta a subir depois de um bom tempo
// com folga; um degrau que falhou logo depois de subir fica vetado na sessão (sem ficar trocando).
// Dia e noite têm cada um o seu degrau: a noite custa mais (escuridão, fachos, luzes somadas).
export const MAX_LEVEL = 3;
const softGpu = (() => {
  try {
    const gl = document.createElement('canvas').getContext('webgl');
    const ext = gl?.getExtension('WEBGL_debug_renderer_info');
    return ext ? String(gl!.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : '';
  } catch {
    return '';
  }
})();
// ponto de partida seguro: desenho por software (sem placa de vídeo) começa no econômico; placa
// integrada Intel e iPhone/iPad (Safari: canvas 2D grande custa caro) começam em 2x e sobem se der
const IOS = typeof navigator !== 'undefined' && (/iPhone|iPad|iPod/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1));
const START = /swiftshader|llvmpipe|software|basic render/i.test(softGpu) ? 2 : (/intel/i.test(softGpu) && !/arc/i.test(softGpu)) || IOS ? 1 : 0;
interface Budget { level: number; floor: number; slow: number; fast: number; since: number; rose: number }
// no iPhone o automático não sobe sozinho para o degrau 0 (estrada em 4x = 4 vezes os pixels): a 60
// quadros o tempo entre quadros não mostra folga, a subida era às cegas e no meio da corrida derrubava
// para ~6 quadros por 1-3 s até voltar (vídeo da Metrópole à noite). MÁXIMO continua escolhível.
const CEIL = IOS ? 1 : 0;
const mk = (lv: number): Budget => ({ level: lv, floor: 0, slow: 0, fast: 0, since: 0, rose: Infinity });
const budgets = { day: mk(START), night: mk(START) };
let cur: Budget = budgets.day;
// o desenho da pista avisa se o trecho é noturno (ou túnel): cada um tem o seu degrau
export function setPerfScene(night: boolean) {
  const b = night ? budgets.night : budgets.day;
  if (b !== cur) { cur = b; ema = 1 / 60; b.slow = b.fast = 0; }
}
export const perfLevel = () => (mode === 'eco' ? 2 : mode === 'alto' ? 0 : cur.level);
export const lowRes = () => mode === 'eco' || (mode === 'auto' && cur.level >= 1);
export const lowFx = () => mode === 'eco' || (mode === 'auto' && cur.level >= 2);
export const minRes = () => mode === 'auto' && cur.level >= 3;
// muda quando algo que pede um novo tamanho de canvas mudou (main.ts refaz o resize)
export const perfKey = () => `${mode}${perfLevel()}`;
let ema = 1 / 60;

export const fxMode = () => mode;
export function setFxMode(m: FxMode) {
  mode = m;
  try {
    localStorage.setItem(KEY, m);
  } catch { /* sem armazenamento: vale só nesta sessão */ }
}

// chamado a cada quadro da corrida com o tempo real do quadro (s)
export function perfSample(dt: number) {
  if (dt <= 0 || dt > 0.2) return; // pausa, troca de aba
  if (mode !== 'auto') return;
  ema += (dt - ema) * 0.05;
  const b = cur;
  b.since += dt;
  b.rose += dt;
  const drop = () => {
    // caiu logo depois de ter subido: este degrau não segura aqui; fica vetado
    if (b.rose < 90) b.floor = Math.max(b.floor, b.level + 1);
    b.level++;
    b.slow = b.fast = b.since = 0;
    b.rose = Infinity;
    ema = 1 / 60;
  };
  // abaixo de ~52 quadros: desce depois de 3 s; abaixo de ~40: depois de 1,5 s. Entre duas trocas,
  // pelo menos 5 s (cada troca muda a resolução da estrada, da tela ou das luzes: trocar a toda
  // hora faz a imagem inteira "piscar"; a faixa entre 52 e 58,5 qps não mexe em nada)
  if (ema > 1 / 52 && b.level < MAX_LEVEL) {
    b.slow += dt;
    b.fast = 0;
    if (b.since > 5 && (b.slow > 3 || (ema > 1 / 40 && b.slow > 1.5))) drop();
  } else if (ema < 1 / 58.5) {
    b.fast += dt;
    b.slow = 0;
    // volta a subir só depois de um bom tempo folgado (e nunca acima de um degrau vetado)
    if (b.fast > 30 && b.since > 30 && b.level > Math.max(b.floor, CEIL)) {
      b.level--;
      b.fast = b.since = 0;
      b.rose = 0;
      ema = 1 / 60;
    }
  } else b.slow = Math.max(0, b.slow - dt);
}

// quadro de contagem para pular trabalho em quadros alternados
let tick = 0;
export const fxTick = () => ++tick;
