// Prioridade de carregamento das imagens. No jogo publicado (artifact) toda imagem de arquivo é baixada
// pelo carregador de tools/to-artifact.mjs, que tem uma fila: o que é pedido em segundo plano (lowPrio:
// pré-carregamento geral) espera; o que a tela atual precisa (need) passa na frente. Fora do artifact
// (vite, PC, APK) as imagens carregam direto e estas funções não fazem nada.
interface W { __imgLow?: number; __imgNeed?: (im: HTMLImageElement) => void; __baseline?: boolean }
const w = window as unknown as W;
// teste A/B do carregamento (tools de medida): com __baseline o jogo carrega como antes
export const baseline = () => !!w.__baseline;
export function lowPrio(f: () => void) {
  w.__imgLow = (w.__imgLow ?? 0) + 1;
  try { f(); } finally { w.__imgLow!--; }
}
// a tela precisa desta imagem agora: se ainda está na fila, vai para a frente
export function need(im: HTMLImageElement) {
  // (enquanto o carregador não entrega a imagem ela está sem src: complete vale true; o que diz é a largura)
  // (durante o pré-carregamento geral ninguém fura a fila)
  if (!im.naturalWidth && !w.__imgLow) w.__imgNeed?.(im);
}
