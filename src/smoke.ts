// Fumaça e vapor de motor batido, em pixel art: baforadas que sobem, crescem e somem, sem
// estado guardado (cada baforada sai do relógio e de uma semente, então não pisca nem acumula).
import { lowFx } from './perf';
import { rng } from './util';

// (x, y) = de onde sai (meio da tampa do motor); w = largura do carro na tela; power 0..1;
// drift = quanto o vento empurra para o lado (px por segundo de vida, carro andando)
export function drawSmoke(c: CanvasRenderingContext2D, x: number, y: number, w: number, power: number, seed: number, drift = 0) {
  if (power <= 0.02 || w < 3) return;
  const t = performance.now() / 1000;
  const r = rng(seed * 131 + 7);
  const n = Math.round((5 + power * 9) * (lowFx() ? 0.5 : 1));
  for (let i = 0; i < n; i++) {
    const life = 1.1 + r() * 0.7;
    const off = r() * life;
    const age = ((t + off) % life) / life; // 0 = acabou de sair, 1 = sumiu
    const sx = (r() - 0.5) * w * 0.35;
    const rise = w * (0.15 + age * 0.9);
    const size = w * (0.1 + age * 0.3) * (0.7 + power * 0.5);
    const px = x + sx + (r() - 0.5) * w * 0.25 * age + drift * age;
    const py = y - rise;
    // vapor branco saindo, escurecendo para fumaça cinza ao subir
    const g = Math.round(225 - age * 95 - r() * 25);
    const al = (0.5 * (1 - age) ** 1.1 * (0.45 + power * 0.55)).toFixed(3); // bolotas sobrepostas: cada uma mais leve
    // tufo em pixel: três bolotas sobrepostas (miolo claro em cima, sombra embaixo), como nuvem de 16 bits
    const s = Math.max(2, Math.round(size));
    const blob = (bx: number, by: number, bs: number, col: number) => {
      c.fillStyle = `rgba(${col},${col},${col + 4},${al})`;
      c.fillRect(Math.round(bx - bs / 2), Math.round(by - bs * 0.35), bs, Math.max(1, Math.round(bs * 0.7)));
      c.fillRect(Math.round(bx - bs * 0.35), Math.round(by - bs / 2), Math.max(1, Math.round(bs * 0.7)), bs);
    };
    blob(px, py + s * 0.18, s, Math.max(40, g - 40)); // sombra de baixo
    blob(px - s * 0.3, py, Math.round(s * 0.75), g);
    blob(px + s * 0.28, py - s * 0.08, Math.round(s * 0.7), g);
    blob(px, py - s * 0.22, Math.round(s * 0.55), Math.min(250, g + 18)); // brilho do miolo
  }
}

// Fumaça do motor traseiro/central vista pelos retrovisores: cada baforada é um ponto do mundo
// (lateral em relação à câmera do espelho, distância para trás e altura), que sai da tampa do motor,
// sobe e fica para trás alargando a esteira; proj leva o ponto à tela do espelho e devolve também
// a escala (px por unidade do mundo). dense = motor estourado: bem mais baforadas, maiores e escuras.
// sizeK: tamanho das baforadas (espelho pequeno usa menos); dim: luz (noite < 1)
export function drawSmokeTrail(
  c: CanvasRenderingContext2D, proj: (lat: number, dist: number, y: number) => [number, number, number],
  lat0: number, dist0: number, y0: number, power: number, seed: number, speed: number, dense = 0, sizeK = 1, dim = 1,
) {
  if (power <= 0.02) return;
  const t = performance.now() / 1000;
  const r = rng(seed * 977 + 13);
  const n = Math.round((6 + power * 10 + dense * 22) * (lowFx() ? 0.5 : 1));
  // andando, a esteira estica para trás; parado, a fumaça sobe quase reta
  const trail = 500 + Math.min(1, speed / 3000) * 3500;
  const list: [number, number, number, number, number][] = [];
  for (let i = 0; i < n; i++) {
    const life = 1.0 + r() * 0.8;
    const off = r() * life;
    const age = ((t + off) % life) / life;
    const side = r() - 0.5, rs = r(), gs = r();
    const lat = lat0 + side * (260 + age * 900);
    const dist = dist0 + age * trail * (0.7 + rs * 0.6);
    const y = y0 + age * (250 + dense * 350) * (0.6 + rs * 0.8);
    const size = (150 + age * 520) * (0.7 + power * 0.5) * (1 + dense * 0.6) * sizeK;
    list.push([lat, dist, y, size, age + gs * 1e-3]);
  }
  list.sort((a, b) => b[1] - a[1]); // do mais longe para o mais perto
  for (const [lat, dist, y, size, age] of list) {
    const [px, py, k] = proj(lat, dist, y);
    const s = Math.max(1, Math.round(size * k));
    // vapor claro de dano; motor estourado solta fumaça cinza-escura e espessa
    const g = Math.round((225 - age * 90) * (1 - dense * 0.55) * dim);
    const al = ((0.42 + dense * 0.35) * (1 - age) ** 1.1 * (0.45 + power * 0.55)).toFixed(3);
    const blob = (bx: number, by: number, bs: number, col: number) => {
      c.fillStyle = `rgba(${col},${col},${col + 4},${al})`;
      c.fillRect(Math.round(bx - bs / 2), Math.round(by - bs * 0.35), bs, Math.max(1, Math.round(bs * 0.7)));
      c.fillRect(Math.round(bx - bs * 0.35), Math.round(by - bs / 2), Math.max(1, Math.round(bs * 0.7)), bs);
    };
    if (s <= 1) {
      blob(px, py, 1, g);
      continue;
    }
    blob(px, py + s * 0.18, s, Math.max(30, g - 40));
    blob(px - s * 0.3, py, Math.round(s * 0.75), g);
    blob(px + s * 0.28, py - s * 0.08, Math.round(s * 0.7), g);
    blob(px, py - s * 0.22, Math.round(s * 0.55), Math.min(250, g + 18));
  }
}
