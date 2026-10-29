// Iluminação de noite (e no túnel): a escuridão é desenhada por cima da pista e dos carros, com o
// facho dos faróis do jogador recortado nela; depois as luzes dos outros carros (faróis de quem
// vem de frente, lanternas de quem vai na frente) são somadas por cima, acesas de verdade. Quem
// vem atrás ofusca nos retrovisores e, ao emparelhar, clareia o lado da tela por onde passa.
import type { CarLook } from './cars';

interface Light { x: number; y: number; w: number; h: number; front: boolean; brake: boolean; signal: number; dots: number[][]; high: boolean }
const lights: Light[] = [];
let collecting = false;

export function beginLights() {
  lights.length = 0;
  collecting = true;
}
// chamado por drawCar: guarda onde estão as luzes do carro (só durante a pista, à noite)
export function pushCarLights(x: number, y: number, w: number, look: CarLook, spots: { h: number; dots: number[][] }) {
  if (!collecting || !look.night || w < 3) return;
  lights.push({ x, y, w, h: spots.h, front: !!look.front, brake: !!look.brake, signal: look.signal ?? 0, dots: spots.dots, high: !!look.flash || !!look.lamps?.high });
}
const blinkOn = () => Math.floor(performance.now() / 250) % 2 === 0;

// escuridão com o facho dos faróis do jogador (camada guardada, refeita se mudar o tamanho)
let dark: HTMLCanvasElement | null = null;
let darkKey = '';
// seen: linha (na camada) onde a pista visível acaba (o painel); hz: altura do horizonte na camada
function darkLayer(w: number, h: number, seen: number, hz: number, a: number) {
  const key = `${w}x${h}:${seen}:${hz}:${a.toFixed(2)}`;
  if (dark && darkKey === key) return dark;
  dark = dark ?? document.createElement('canvas');
  dark.width = w;
  dark.height = h;
  darkKey = key;
  const g = dark.getContext('2d')!;
  g.clearRect(0, 0, w, h);
  g.fillStyle = `rgba(0,0,12,${a})`;
  g.fillRect(0, 0, w, h);
  // facho: elipse larga com o centro logo abaixo da linha do painel, alcançando os acostamentos
  // dos dois lados perto do carro e afinando lá na frente
  const span = Math.max(8, seen - hz);
  g.globalCompositeOperation = 'destination-out';
  g.save();
  g.translate(w / 2, seen + span * 0.15);
  const r = w * 0.8;
  g.scale(1, (span * 1.0) / r);
  const beam = g.createRadialGradient(0, 0, r * 0.1, 0, 0, r);
  beam.addColorStop(0, 'rgba(0,0,0,0.95)');
  beam.addColorStop(0.5, 'rgba(0,0,0,0.75)');
  beam.addColorStop(0.8, 'rgba(0,0,0,0.35)');
  beam.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = beam;
  g.fillRect(-r, -r, r * 2, r * 2);
  g.restore();
  g.globalCompositeOperation = 'source-over';
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
export function finishNight(c: CanvasRenderingContext2D, vp: { x: number; y: number; w: number; h: number; horizon: number; dash?: number }, strength: number, passers: Pass[], segLen: number) {
  collecting = false;
  if (strength <= 0.02) return;
  const top = Math.max(vp.y, Math.floor(vp.horizon) - 40);
  const h = vp.y + vp.h - top;
  const seenY = Math.min(vp.y + vp.h, vp.dash ?? vp.y + vp.h);
  c.drawImage(darkLayer(Math.round(vp.w), Math.round(h), Math.round(seenY - top), Math.round(vp.horizon - top), 0.68 * strength), vp.x, top);
  c.save();
  c.globalCompositeOperation = 'lighter';
  // facho dos faróis do jogador na pista: luz amarelada somada, forte perto do capô e sumindo
  // lá na frente (o asfalto da noite é escuro: só recortar a escuridão não basta)
  {
    // a parte visível da pista vai do horizonte até o painel
    const bot = vp.y + vp.h, seen = Math.min(bot, vp.dash ?? bot), span = seen - vp.horizon;
    const far = vp.horizon + span * 0.1;
    const cx = vp.x + vp.w / 2;
    const k = strength;
    // facho principal: trapézio bem aberto na base (pega os acostamentos e o que está na beira
    // da pista) afinando até lá na frente
    const g = c.createLinearGradient(0, seen + span * 0.25, 0, far);
    g.addColorStop(0, `rgba(255,232,170,${(0.34 * k).toFixed(3)})`);
    g.addColorStop(0.5, `rgba(255,232,170,${(0.2 * k).toFixed(3)})`);
    g.addColorStop(1, 'rgba(255,232,170,0)');
    c.fillStyle = g;
    c.beginPath();
    c.moveTo(cx - vp.w * 0.95, bot);
    c.lineTo(cx - vp.w * 0.95, seen + span * 0.25);
    c.lineTo(cx - vp.w * 0.17, far);
    c.lineTo(cx + vp.w * 0.17, far);
    c.lineTo(cx + vp.w * 0.95, seen + span * 0.25);
    c.lineTo(cx + vp.w * 0.95, bot);
    c.closePath();
    c.fill();
    // espalhamento para os lados perto do carro (claridade nas laterais, mais fraca)
    c.save();
    c.translate(cx, seen + span * 0.1);
    c.scale(1, (span * 0.55) / (vp.w * 0.75));
    const sp = c.createRadialGradient(0, 0, 0, 0, 0, vp.w * 0.75);
    sp.addColorStop(0, `rgba(255,236,190,${(0.14 * k).toFixed(3)})`);
    sp.addColorStop(0.6, `rgba(255,236,190,${(0.08 * k).toFixed(3)})`);
    sp.addColorStop(1, 'rgba(255,236,190,0)');
    c.fillStyle = sp;
    c.fillRect(-vp.w * 0.75, -vp.w * 0.75, vp.w * 1.5, vp.w * 1.5);
    c.restore();
    // miolo mais claro de cada farol, um pouco aberto para fora
    for (const sgn of [-1, 1]) {
      const h2 = c.createLinearGradient(0, seen + span * 0.25, 0, vp.horizon + span * 0.28);
      h2.addColorStop(0, `rgba(255,240,200,${(0.16 * k).toFixed(3)})`);
      h2.addColorStop(1, 'rgba(255,240,200,0)');
      c.fillStyle = h2;
      c.beginPath();
      c.moveTo(cx + sgn * vp.w * 0.05, bot);
      c.lineTo(cx + sgn * vp.w * 0.02, vp.horizon + span * 0.28);
      c.lineTo(cx + sgn * vp.w * 0.14, vp.horizon + span * 0.28);
      c.lineTo(cx + sgn * vp.w * 0.7, bot);
      c.closePath();
      c.fill();
    }
  }
  // as luzes vêm do mais longe para o mais perto: o brilho de cada carro não passa por cima da
  // carroceria dos carros mais perto (recorte com os retângulos deles)
  for (let li = 0; li < lights.length; li++) {
    const l = lights[li];
    let clipped = false;
    for (let j = li + 1; j < lights.length; j++) {
      const n = lights[j];
      if (n.w <= l.w) continue; // mesmo tamanho ou menor: não está mais perto
      if (!clipped) c.save();
      clipped = true;
      // cada recorte se soma aos anteriores (interseção): fora de todos os carros mais perto
      c.beginPath();
      c.rect(vp.x, vp.y - 50, vp.w, vp.h + 100);
      c.rect(n.x - n.w / 2, n.y - n.h, n.w, n.h);
      c.clip('evenodd');
    }
    const L = l.x - l.w / 2, T = l.y - l.h;
    const pts = l.dots.map(([u, f]) => [L + u * l.w, T + f * l.h]);
    if (l.front) {
      // faróis de quem vem de frente: foco forte em cada farol, halo e o clarão na pista à frente
      const k = l.high ? 1.5 : 1;
      for (const [px, py] of pts) {
        blob(c, px, py, l.w * 0.34 * k, l.w * 0.24 * k, '255,244,200', 0.5 * strength);
        blob(c, px, py, l.w * 0.08, l.w * 0.07, '255,255,240', 0.9 * strength);
      }
      blob(c, l.x, l.y + l.w * 0.05, l.w * 0.9 * k, l.w * 0.18, '255,240,190', 0.22 * strength);
    } else {
      // lanternas: brilho vermelho em cada lâmpada; no freio fica bem mais forte, com halo
      // grande e o reflexo vermelho no asfalto atrás do carro
      for (const [px, py] of pts) {
        if (l.brake) {
          blob(c, px, py, l.w * 0.42, l.w * 0.3, '255,30,16', 0.32 * strength);
          blob(c, px, py, l.w * 0.13, l.w * 0.1, '255,90,60', 0.85 * strength);
        } else {
          blob(c, px, py, l.w * 0.2, l.w * 0.14, '255,36,20', 0.42 * strength);
          blob(c, px, py, l.w * 0.06, l.w * 0.05, '255,80,50', 0.6 * strength);
        }
      }
      blob(c, l.x, l.y + l.w * 0.03, l.w * (l.brake ? 0.85 : 0.6), l.w * 0.1, '255,30,16', (l.brake ? 0.28 : 0.12) * strength);
    }
    // seta piscando: brilho âmbar do lado para onde vai
    if (l.signal && blinkOn()) {
      const [px, py] = pts[l.signal > 0 ? pts.length - 1 : 0] ?? [l.x, l.y - l.h / 2];
      const sx = l.front ? (l.signal > 0 ? L + l.w * 0.08 : L + l.w * 0.92) : px; // de frente o lado se inverte
      blob(c, sx, py, l.w * 0.22, l.w * 0.16, '255,160,30', 0.6 * strength);
    }
    if (clipped) c.restore();
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
