// Cores da carroceria que o jogador pode escolher para cada carro (guardadas no aparelho)
export const PAINTS = [
  { name: 'Azul', hex: '#1f4fd0' },
  { name: 'Vermelho', hex: '#d01818' },
  { name: 'Verde', hex: '#1a9a3a' },
  { name: 'Amarelo', hex: '#f0c000' },
  { name: 'Branco', hex: '#ececec' },
  { name: 'Preto', hex: '#1c1c20' },
  { name: 'Cinza', hex: '#8a8c92' },
  { name: 'Violeta', hex: '#7a3ac8' },
  { name: 'Ciano', hex: '#18b8d0' },
  { name: 'Bege', hex: '#d8c49a' },
  // cores de fábrica da Diablo SV (valem para todos os carros)
  { name: 'Giallo', hex: '#f2c200' },
  { name: 'Deep Black', hex: '#141418' },
  { name: 'Rosso Lucido', hex: '#e01810' },
  { name: 'Blu Le Mans', hex: '#1a50d8' },
  { name: 'Verde Ithaca', hex: '#38b828' },
];

const KEY = 'duel-racer:paint';
let chosen: Record<string, number> = {};
try {
  chosen = JSON.parse(localStorage.getItem(KEY) || '{}');
} catch {
  chosen = {};
}

// índice escolhido para o carro (undefined = cor original da arte)
export const paintIdx = (carId: string): number | undefined => chosen[carId];
export const paintHex = (carId: string): string | undefined => {
  const i = chosen[carId];
  return i === undefined ? undefined : PAINTS[i]?.hex;
};

export function setPaint(carId: string, idx: number) {
  chosen[carId] = idx;
  try {
    localStorage.setItem(KEY, JSON.stringify(chosen));
  } catch {
    // sem armazenamento (aba anônima): vale só nesta sessão
  }
}

// cor da paleta mais próxima de uma cor qualquer (para marcar a original no seletor)
export function nearestPaint(hex: string): number {
  const rgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const a = rgb(hex);
  let best = 0, bd = Infinity;
  PAINTS.forEach((p, i) => {
    const b = rgb(p.hex);
    const dd = (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;
    if (dd < bd) { bd = dd; best = i; }
  });
  return best;
}
