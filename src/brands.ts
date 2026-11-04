// Marcas fictícias: nome e logotipo em pixel art (9 x 9) de cada fabricante. Os mesmos dados
// (src/assets/brands.json) são usados por tools/ref/brand_badges.py para gravar os emblemas
// nos sprites e nos volantes.
import data from './assets/brands.json';

export interface Brand { id: string; name: string; logo: string[] }
const PAL = data.palette as Record<string, string>;
export const BRANDS: Record<string, Brand> = Object.fromEntries(
  Object.entries(data.brands).map(([id, b]) => [id, { id, name: (b as { name: string }).name, logo: (b as { logo: string[] }).logo }]),
);
const CAR_BRAND = data.cars as Record<string, string>;
export const brandOf = (carId: string): Brand | undefined => BRANDS[CAR_BRAND[carId]];

// logotipo com o canto de cima à esquerda em (x, y), cada pixel do desenho com `px` de lado
export function drawLogo(c: CanvasRenderingContext2D, b: Brand | undefined, x: number, y: number, px = 1) {
  if (!b) return;
  b.logo.forEach((row, j) => {
    for (let i = 0; i < row.length; i++) {
      const ch = row[i];
      if (ch === '.') continue;
      c.fillStyle = PAL[ch];
      c.fillRect(x + i * px, y + j * px, px, px);
    }
  });
}
