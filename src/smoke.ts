// Fumaça e vapor de motor batido, em pixel art: baforadas que sobem, crescem e somem, sem
// estado guardado (cada baforada sai do relógio e de uma semente, então não pisca nem acumula).
import { rng } from './util';

// (x, y) = de onde sai (meio da tampa do motor); w = largura do carro na tela; power 0..1;
// drift = quanto o vento empurra para o lado (px por segundo de vida, carro andando)
export function drawSmoke(c: CanvasRenderingContext2D, x: number, y: number, w: number, power: number, seed: number, drift = 0) {
  if (power <= 0.02 || w < 3) return;
  const t = performance.now() / 1000;
  const r = rng(seed * 131 + 7);
  const n = Math.round(5 + power * 9);
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
    c.fillStyle = `rgba(${g},${g},${g + 4},${(0.8 * (1 - age) ** 1.1 * (0.45 + power * 0.55)).toFixed(3)})`;
    // baforada em "blocos" (círculo grosso de pixel)
    const s = Math.max(1, Math.round(size));
    c.fillRect(Math.round(px - s / 2), Math.round(py - s * 0.35), s, Math.round(s * 0.7));
    c.fillRect(Math.round(px - s * 0.35), Math.round(py - s / 2), Math.round(s * 0.7), s);
  }
}
