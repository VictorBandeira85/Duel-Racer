// Pista molhada: o asfalto ganha o brilho do céu refletido, mais forte ao longe (ângulo rasante) e
// em degraus (nada de degradê nem grão que pisque), na medida de r.wetK — molha aos poucos quando a
// chuva começa e seca aos poucos quando para. Um quadrilátero por trecho, só sobre o asfalto.
import { SEG_LEN } from './config';
import type { Race } from './race';
import type { Segment } from './track';

const LEVELS = [0.05, 0.09, 0.14, 0.19, 0.24];
const cols = new Map<string, string>();
function col(sky: string, a: number) {
  const k = `${sky}|${a.toFixed(3)}`;
  let v = cols.get(k);
  if (!v) {
    const m = sky.startsWith('#') ? [1, 3, 5].map((i) => parseInt(sky.slice(i, i + 2), 16)) : (sky.match(/\d+/g) ?? ['0', '0', '0']).slice(0, 3).map(Number);
    v = `rgba(${m.join(',')},${a.toFixed(3)})`;
    if (cols.size > 400) cols.clear();
    cols.set(k, v);
  }
  return v;
}

export function wetSheen(c: CanvasRenderingContext2D, s: Segment, r: Race) {
  if (r.wetK < 0.04 || r.wx !== 'rain' || s.tunnel) return;
  const nk = Math.max(r.nightK, r.def.night ? 1 : 0);
  if (nk > 0.85) return; // de noite o céu é escuro: quem brilha no molhado são os faróis
  const d = s.p1.camera.z / SEG_LEN;
  const lv = d < 10 ? 0 : d < 24 ? 1 : d < 50 ? 2 : d < 100 ? 3 : 4;
  // faixas alternadas de 3 trechos um pouco mais e menos brilhantes (lâmina d'água irregular)
  const band = Math.floor(s.index / 3) & 1 ? 1 : 0.7;
  const a = Math.round(LEVELS[lv] * band * r.wetK * (1 - nk) * 32) / 32;
  if (a <= 0) return;
  const { x: x1, y: y1, w: w1 } = s.p1.screen;
  const { x: x2, y: y2, w: w2 } = s.p2.screen;
  if (y1 - y2 < 0.25) return;
  c.fillStyle = col(r.theme.sky[1], a);
  c.beginPath();
  c.moveTo(x1 - w1, y1);
  c.lineTo(x1 + w1, y1);
  c.lineTo(x2 + w2, y2);
  c.lineTo(x2 - w2, y2);
  c.closePath();
  c.fill();
}
