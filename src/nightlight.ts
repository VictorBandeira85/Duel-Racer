// Iluminação de noite (e no túnel): a escuridão é desenhada por cima da pista e dos carros, com o
// facho dos faróis do jogador recortado nela; depois as luzes dos outros carros (faróis de quem
// vem de frente, lanternas de quem vai na frente) são somadas por cima, acesas de verdade. Quem
// vem atrás ofusca nos retrovisores e, ao emparelhar, clareia o lado da tela por onde passa.
import type { CarLook } from './cars';

interface Light { x: number; y: number; w: number; front: boolean }
const lights: Light[] = [];
let collecting = false;

export function beginLights() {
  lights.length = 0;
  collecting = true;
}
// chamado por drawCar: guarda onde estão as luzes do carro (só durante a pista, à noite)
export function pushCarLights(x: number, y: number, w: number, look: CarLook) {
  if (!collecting || !look.night || w < 3) return;
  lights.push({ x, y, w, front: !!look.front });
}

// escuridão com o facho dos faróis do jogador (camada guardada, refeita se mudar o tamanho)
let dark: HTMLCanvasElement | null = null;
let darkKey = '';
function darkLayer(w: number, h: number, horizon: number, a: number) {
  const key = `${w}x${h}:${horizon}:${a.toFixed(2)}`;
  if (dark && darkKey === key) return dark;
  dark = dark ?? document.createElement('canvas');
  dark.width = w;
  dark.height = h;
  darkKey = key;
  const g = dark.getContext('2d')!;
  g.clearRect(0, 0, w, h);
  g.fillStyle = `rgba(0,0,12,${a})`;
  g.fillRect(0, 0, w, h);
  // facho: elipse achatada saindo de baixo do capô e alcançando a pista à frente
  g.globalCompositeOperation = 'destination-out';
  g.save();
  g.translate(w / 2, h);
  g.scale(1, 0.62);
  const r = w * 0.55;
  const beam = g.createRadialGradient(0, 0, r * 0.15, 0, 0, r);
  beam.addColorStop(0, 'rgba(0,0,0,0.92)');
  beam.addColorStop(0.55, 'rgba(0,0,0,0.6)');
  beam.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = beam;
  g.fillRect(-r, -r, r * 2, r);
  g.restore();
  // a luz amarelada dos faróis na pista
  g.globalCompositeOperation = 'source-over';
  const warm = g.createRadialGradient(w / 2, h, 0, w / 2, h, h * 0.55);
  warm.addColorStop(0, 'rgba(255,236,170,0.10)');
  warm.addColorStop(1, 'rgba(255,236,170,0)');
  g.fillStyle = warm;
  g.fillRect(0, 0, w, h);
  return dark;
}

function blob(c: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, rgb: string, a: number) {
  if (rx < 0.5 || a <= 0.01) return;
  c.save();
  c.translate(x, y);
  c.scale(1, ry / rx);
  const g = c.createRadialGradient(0, 0, 0, 0, 0, rx);
  g.addColorStop(0, `rgba(${rgb},${a.toFixed(3)})`);
  g.addColorStop(0.35, `rgba(${rgb},${(a * 0.45).toFixed(3)})`);
  g.addColorStop(1, `rgba(${rgb},0)`);
  c.fillStyle = g;
  c.fillRect(-rx, -rx, rx * 2, rx * 2);
  c.restore();
}

export interface Pass { x: number; dz: number } // quem vem atrás com farol aceso (dz > 0 atrás)

// fim da pista: escuridão, luzes dos carros somadas e a claridade de quem emparelha
export function finishNight(c: CanvasRenderingContext2D, vp: { x: number; y: number; w: number; h: number; horizon: number }, strength: number, passers: Pass[], segLen: number) {
  collecting = false;
  if (strength <= 0.02) return;
  const top = Math.max(vp.y, Math.floor(vp.horizon) - 40);
  const h = vp.y + vp.h - top;
  c.drawImage(darkLayer(Math.round(vp.w), Math.round(h), 0, 0.68 * strength), vp.x, top);
  c.save();
  c.globalCompositeOperation = 'lighter';
  for (const l of lights) {
    if (l.front) {
      // faróis de quem vem de frente: dois focos fortes e o clarão na pista à frente dele
      for (const s of [-0.33, 0.33]) blob(c, l.x + s * l.w, l.y - l.w * 0.26, l.w * 0.3, l.w * 0.22, '255,244,200', 0.6 * strength);
      blob(c, l.x, l.y + l.w * 0.05, l.w * 0.9, l.w * 0.18, '255,240,190', 0.22 * strength);
    } else {
      // lanternas de quem vai na frente
      for (const s of [-0.38, 0.38]) blob(c, l.x + s * l.w, l.y - l.w * 0.28, l.w * 0.16, l.w * 0.11, '255,40,24', 0.55 * strength);
    }
  }
  // quem vem atrás com farol aceso: o lado por onde passa clareia, mais forte ao emparelhar,
  // esmaecendo quando ele já passou
  for (const p of passers) {
    const ahead = -p.dz;
    const f = p.dz > 0 ? Math.max(0, 1 - p.dz / (segLen * 12)) ** 1.5 : Math.max(0, 1 - ahead / (segLen * 2.5));
    if (f <= 0.01) continue;
    const right = p.x > 0;
    const x0 = right ? vp.x + vp.w : vp.x;
    const g = c.createLinearGradient(x0, 0, x0 + (right ? -1 : 1) * vp.w * 0.5, 0);
    g.addColorStop(0, `rgba(255,236,190,${(0.4 * f * strength).toFixed(3)})`);
    g.addColorStop(1, 'rgba(255,236,190,0)');
    c.fillStyle = g;
    c.fillRect(vp.x, vp.horizon, vp.w, vp.y + vp.h - vp.horizon);
  }
  c.restore();
}

// ofuscamento no retrovisor: o farol de quem vem atrás brilha e clareia o espelho
export function mirrorGlare(c: CanvasRenderingContext2D, x: number, y: number, bw: number, near: number, strength: number) {
  if (strength <= 0.02) return;
  c.save();
  c.globalCompositeOperation = 'lighter';
  for (const s of [-0.3, 0.3]) blob(c, x + s * bw, y - bw * 0.28, Math.max(1.5, bw * 0.45), Math.max(1, bw * 0.3), '255,246,210', (0.45 + 0.5 * near) * strength);
  c.restore();
}
export function mirrorWash(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, near: number, strength: number) {
  if (near <= 0.01 || strength <= 0.02) return;
  c.save();
  c.globalCompositeOperation = 'lighter';
  c.fillStyle = `rgba(255,240,205,${(0.35 * near * strength).toFixed(3)})`;
  c.fillRect(x, y, w, h);
  c.restore();
}
