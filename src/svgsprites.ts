// Converte arte SVG em imagens (sprites) para o canvas do jogo.
// Cada SVG vira uma imagem uma vez; cada tamanho usado é rasterizado e guardado em cache.
// As bordas são endurecidas (sem semitransparência), para manter o visual de pixel art.

const images = new Map<string, HTMLImageElement>();
const rasters = new Map<string, HTMLCanvasElement>();
const MAX_RASTERS = 160;

function image(svg: string): HTMLImageElement | null {
  let img = images.get(svg);
  if (!img) {
    img = new Image();
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    images.set(svg, img);
  }
  return img.complete && img.naturalWidth > 0 ? img : null;
}

// Carrega antecipadamente (para não piscar na primeira vez que aparece)
export function preloadSvg(...svgs: string[]) {
  for (const s of svgs) image(s);
}

// Sprite do SVG no tamanho pedido (null enquanto a imagem ainda carrega)
export function svgSprite(svg: string, w: number, h: number): HTMLCanvasElement | null {
  const img = image(svg);
  if (!img) return null;
  // tamanhos agrupados de 2 em 2 px para não gerar um sprite por quadro
  const bw = Math.max(2, Math.round(w / 2) * 2), bh = Math.max(2, Math.round(h / 2) * 2);
  const key = `${svg.length}:${svg.slice(-40)}:${bw}x${bh}`;
  let cv = rasters.get(key);
  if (cv) return cv;
  cv = document.createElement('canvas');
  cv.width = bw;
  cv.height = bh;
  const c = cv.getContext('2d')!;
  c.drawImage(img, 0, 0, bw, bh);
  const data = c.getImageData(0, 0, bw, bh);
  const d = data.data;
  for (let i = 3; i < d.length; i += 4) d[i] = d[i] >= 110 ? 255 : 0;
  c.putImageData(data, 0, 0);
  if (rasters.size >= MAX_RASTERS) rasters.delete(rasters.keys().next().value!);
  rasters.set(key, cv);
  return cv;
}
