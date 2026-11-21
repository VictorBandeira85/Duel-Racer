// Helicóptero da polícia: entra nas fugas longas (perseguição que já dura), vem de trás, passa por
// cima e fica voando à frente e acima do jogador, acompanhando. Enquanto ele vê o carro a polícia não
// "perde" o jogador (race.ts: lostT não sobe e a viatura não desiste) e ele pede reforço à frente de
// tempos em tempos; dentro do túnel ele perde a visão e, saindo, demora um pouco para achar de novo.
// Vai embora quando a perseguição acaba, quando fica tempo demais sem ver o carro ou quando acaba o
// tempo de voo dele. Desenho em pixel art feito aqui (vista de trás e de baixo, rotor girando), som de
// rotor posicional (grave, sem agudo), sombra no asfalto de dia e holofote no chão à noite.
import { audioCtx, audioOut, noiseBuffer } from './audio';
import { CAR_W, KMH, PLAYER_Z, SEG_LEN } from './config';
import { drawCrisp } from './crisp';
import { beaconGlow, pushSpotPool } from './nightlight';
import type { Race } from './race';
import type { Segment } from './track';

export interface Heli {
  phase: 'in' | 'hold' | 'out';
  t: number; // segundos na fase
  life: number; // segundos desde que chegou
  dz: number; // à frente do jogador (unidades do mundo; negativo = atrás)
  x: number; // lateral (do centro da pista)
  alt: number; // altura acima da pista
  vz: number; // velocidade dele
  side: number; // para que lado sai no fim
  sees: boolean; // está vendo o carro (a polícia não perde o jogador)
  searchT: number; // procurando depois do túnel
  blindT: number; // há quanto tempo não vê
  callT: number; // intervalo entre os pedidos de reforço
  fade: number; // 1 = inteiro; some aos poucos no fim
}

export const HELI_W = 7000; // diâmetro do rotor (~11 m)
const HELI_H = HELI_W * 0.56;
// à frente do jogador e a altura dele: a profundidade do jogo é comprimida e a faixa de céu entre o
// horizonte e o teto da cabine é estreita (~28 px no Toro V12): medido no print para ele caber nela
const HOLD_DZ = 110 * SEG_LEN; // (era 175: longe demais, virava um ponto no horizonte)
const HOLD_ALT = 2500; // ~110 segmentos à frente e alto: aparece no céu, acima das árvores (antes parecia pousado no asfalto)
const SIGHT = 320 * SEG_LEN; // além disso (para trás) ele já não vê o carro
const HELI_MAX = 265 / KMH; // ~265 km/h: um esportivo de pé no fundo consegue deixá-lo para trás
const M_LON = KMH / 3.6, M_LAT = 1.8 / CAR_W;

// quanto tempo de perseguição até ele chegar (procurado: chega antes)
const heliAfter = (r: Race) => 16 - 6 * r.copHeat();

export function heliStep(r: Race, h: Heli | null, dt: number): Heli | null {
  const chasing = r.police.some((p) => p.state === 'chase' || p.state === 'pull' || p.state === 'stopped');
  if (!h) {
    // só as polícias das classes A e S (as de alto nível) têm helicóptero
    const long = r.state === 'drive' && !r.heliUsed && r.police.some((p) => p.state === 'chase' && !p.block && (p.unit === 'A' || p.unit === 'S') && p.chaseT > heliAfter(r));
    if (!long) {
      heliSound(null);
      return null;
    }
    r.heliUsed = true;
    h = { phase: 'in', t: 0, life: 0, dz: -70 * SEG_LEN, x: r.x + 2500, alt: 7000, vz: r.speed + 5000, side: r.x > 0 ? -1 : 1, sees: false, searchT: 0, blindT: 0, callT: 9, fade: 1 };
    r.say('HELICÓPTERO NA COLA!', 2.2);
  }
  h.t += dt;
  h.life += dt;
  h.callT -= dt;
  if (h.phase !== 'out' && (!chasing || r.state === 'arrived' || h.life > 60 || h.blindT > 7)) {
    if (chasing && r.state === 'drive') r.say(h.blindT > 7 ? 'O HELICÓPTERO TE PERDEU!' : 'HELICÓPTERO VOLTOU À BASE', 2.2);
    h.phase = 'out';
    h.t = 0;
  }
  if (h.phase === 'in' && h.dz > HOLD_DZ * 0.85) {
    h.phase = 'hold';
    h.t = 0;
  }
  if (h.phase === 'out') {
    // sobe, vai ficando para trás e sai de lado
    h.vz += (r.speed * 0.55 - h.vz) * Math.min(1, dt * 0.6);
    h.alt += 1500 * dt;
    h.x += h.side * 2600 * dt;
    if (h.t > 6) h.fade = Math.max(0, h.fade - dt / 3);
  } else {
    // passeia um pouco para a frente e para trás e de um lado para o outro, sem largar o carro
    const wob = Math.sin(h.life * 0.37) * 18 * SEG_LEN + Math.sin(h.life * 0.91) * 6 * SEG_LEN;
    const want = Math.max(0, Math.min(HELI_MAX * (h.phase === 'in' ? 1.3 : 1), r.speed + (HOLD_DZ + wob - h.dz) * 0.45));
    h.vz += Math.max(-6000 * dt, Math.min(h.phase === 'in' ? 6000 * dt : 3500 * dt, want - h.vz));
    h.alt += (HOLD_ALT + Math.sin(h.life * 0.6) * 250 - h.alt) * Math.min(1, dt * 0.5);
    h.x += (r.x * 0.85 + Math.sin(h.life * 0.5) * 1400 - h.x) * Math.min(1, dt * 0.7);
  }
  h.dz += (h.vz - r.speed) * dt;
  // visão: no túnel não vê; saindo, leva uns segundos para achar o carro de novo
  const inT = r.inTunnel > 0.5;
  h.searchT = inT ? 3 : Math.max(0, h.searchT - dt);
  h.sees = h.phase !== 'out' && !inT && h.searchT <= 0 && h.dz > -SIGHT && r.state !== 'arrived';
  h.blindT = h.sees || h.phase === 'out' ? 0 : h.blindT + dt;
  if (h.phase === 'out' && (h.fade <= 0 || h.dz < -SIGHT * 1.3)) {
    heliSound(null);
    return null;
  }
  heliSound({ dz: h.dz * M_LON, dx: (h.x - r.x) * M_LAT, up: h.alt * M_LON, tunnel: r.inTunnel, k: h.fade });
  return h;
}

// ---------------- desenho ----------------
// vista de trás e um pouco de baixo: rotor principal (duas pás, achatado pela perspectiva), capô do
// motor, cabine azul-escura com a barriga branca, cone de cauda vindo na nossa direção com a deriva e o
// rotor de cauda de perfil, esquis e o holofote embaixo do nariz
const ROTOR_FRAMES = 4;
const PAL = {
  day: { blade: '#2a2c30', hub: '#55585e', top: '#1e2f58', topHi: '#34508a', belly: '#e6eaee', bellyLo: '#b9c0c8', stripe: '#c81e1e', glass: '#7fa0b8', dark: '#121820', skid: '#3a3e44', lamp: '#f4f0d0' },
  night: { blade: '#15161a', hub: '#2c2e33', top: '#121c34', topHi: '#1c2c4c', belly: '#5a6068', bellyLo: '#434950', stripe: '#5a1414', glass: '#2c3a48', dark: '#080a0e', skid: '#1e2024', lamp: '#fffbe0' },
};
function drawBody(g: CanvasRenderingContext2D, w: number, h: number, f: number, night: boolean) {
  const P = night ? PAL.night : PAL.day;
  const X = (u: number) => u * w, Y = (v: number) => v * h;
  const box = (u0: number, v0: number, u1: number, v1: number, col: string) => {
    g.fillStyle = col;
    g.fillRect(X(u0), Y(v0), X(u1 - u0), Y(v1 - v0));
  };
  const ell = (u: number, v: number, ru: number, rv: number, col: string) => {
    g.fillStyle = col;
    g.beginPath();
    g.ellipse(X(u), Y(v), X(ru), Y(rv), 0, 0, Math.PI * 2);
    g.fill();
  };
  // esquis: travessa e os dois patins vistos de ponta, com as pernas
  g.strokeStyle = P.skid;
  g.lineWidth = Math.max(1, w * 0.018);
  g.beginPath();
  g.moveTo(X(0.4), Y(0.62)); g.lineTo(X(0.31), Y(0.86));
  g.moveTo(X(0.6), Y(0.62)); g.lineTo(X(0.69), Y(0.86));
  g.stroke();
  box(0.27, 0.84, 0.35, 0.92, P.skid);
  box(0.65, 0.84, 0.73, 0.92, P.skid);
  // fuselagem
  ell(0.5, 0.5, 0.16, 0.24, P.top);
  g.save();
  g.beginPath();
  g.rect(0, Y(0.52), w, h);
  g.clip();
  ell(0.5, 0.5, 0.16, 0.24, P.belly);
  ell(0.5, 0.56, 0.12, 0.17, P.bellyLo);
  g.restore();
  box(0.34, 0.5, 0.66, 0.54, P.stripe); // faixa
  ell(0.44, 0.42, 0.045, 0.06, P.topHi); // reflexo
  // janelas da cabine vistas de trás (laterais)
  box(0.355, 0.4, 0.39, 0.49, P.glass);
  box(0.61, 0.4, 0.645, 0.49, P.glass);
  // capô do motor e escapes
  ell(0.5, 0.29, 0.09, 0.07, P.hub);
  box(0.43, 0.3, 0.46, 0.35, P.dark);
  box(0.54, 0.3, 0.57, 0.35, P.dark);
  // cone de cauda vindo na nossa direção: ponta mais embaixo, com a deriva e o rotor de cauda de perfil
  ell(0.5, 0.64, 0.05, 0.07, P.top);
  ell(0.5, 0.7, 0.032, 0.05, P.topHi);
  box(0.488, 0.52, 0.512, 0.86, P.top); // deriva (vertical)
  box(0.47, 0.84, 0.53, 0.87, P.top); // estabilizador
  const tr = f % 2 === 0;
  box(0.455, tr ? 0.54 : 0.6, 0.47, tr ? 0.82 : 0.76, P.blade); // rotor de cauda (de perfil)
  // holofote embaixo do nariz
  ell(0.5, 0.75, 0.025, 0.03, night ? P.lamp : P.dark);
  // mastro e rotor principal: duas pás girando, o disco achatado pela perspectiva (vista de baixo)
  box(0.485, 0.1, 0.515, 0.24, P.hub);
  const a = (f / ROTOR_FRAMES) * Math.PI;
  const cx = X(0.5), cy = Y(0.1);
  g.strokeStyle = P.blade;
  g.lineWidth = Math.max(1, h * 0.07);
  g.lineCap = 'butt';
  g.beginPath();
  for (const s of [1, -1]) {
    g.moveTo(cx, cy);
    g.lineTo(cx + s * Math.cos(a) * w * 0.5, cy + s * Math.sin(a) * h * 0.08);
  }
  g.stroke();
  box(0.47, 0.07, 0.53, 0.13, P.hub);
}

// arte do Victor (tools/ref/heli_art.py): de trás (no céu à frente do carro) e de frente (no retrovisor),
// sem as pás do rotor principal, que giram por cima a partir da cabeça do rotor (alto da arte)
import heliRearPng from './assets/heli/heli-rear.png';
import heliFrontPng from './assets/heli/heli-front.png';
const HELI_IMG: Record<'rear' | 'front', HTMLImageElement> = { rear: new Image(), front: new Image() };
HELI_IMG.rear.src = heliRearPng;
HELI_IMG.front.src = heliFrontPng;
const artReady = (v: 'rear' | 'front') => HELI_IMG[v].complete && HELI_IMG[v].naturalWidth > 0;
// caixa da arte: a largura do disco do rotor e 0,75 dela de altura (a arte, mais alta que larga, ocupa 92% da
// altura; antes, na caixa achatada do desenho por código, ficava miúda no céu), cabeça do rotor no alto
const ART_H = 0.75;
function drawArt(g: CanvasRenderingContext2D, w: number, h: number, f: number, night: boolean, v: 'rear' | 'front') {
  const im = HELI_IMG[v];
  const ah = h * 0.92, aw = (ah * im.naturalWidth) / im.naturalHeight;
  const x0 = (w - aw) / 2, y0 = h * 0.06;
  g.imageSmoothingEnabled = true;
  g.drawImage(im, x0, y0, aw, ah);
  if (night) { // à noite escurece junto com o resto (as luzes vêm em heliLights)
    g.globalCompositeOperation = 'source-atop';
    g.fillStyle = 'rgba(8,12,28,0.6)';
    g.fillRect(0, 0, w, h);
    g.globalCompositeOperation = 'source-over';
  }
  // pás do rotor principal girando (três, como no Esquilo de verdade, para nunca sumirem todas de pé), a
  // partir da cabeça do rotor; o disco borrado vem por cima em rotorDisc
  const P = night ? PAL.night : PAL.day;
  const cx = w / 2, cy = y0 + ah * HUB_Y;
  g.strokeStyle = P.blade;
  g.lineWidth = Math.max(1.5, h * 0.06);
  g.lineCap = 'round';
  g.beginPath();
  for (let i = 0; i < 3; i++) {
    const a = (f / ROTOR_FRAMES) * (Math.PI * 2 / 3) + (i * Math.PI * 2) / 3;
    g.moveTo(cx, cy);
    g.lineTo(cx + Math.cos(a) * w * 0.5, cy + Math.sin(a) * h * 0.06);
  }
  g.stroke();
}
const HUB_Y = 0.035; // cabeça do rotor na altura da arte
// disco do rotor girando (semitransparente, desenhado direto na tela: o sprite nítido não guarda meio-tom)
function rotorDisc(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, night: boolean, k: number) {
  if (w < 6) return;
  const cy = y - h + h * (0.06 + 0.92 * HUB_Y);
  c.fillStyle = night ? `rgba(20,22,28,${(0.3 * k).toFixed(3)})` : `rgba(48,52,60,${(0.26 * k).toFixed(3)})`;
  c.beginPath();
  c.ellipse(x, cy, w * 0.5, Math.max(1, h * 0.06), 0, 0, Math.PI * 2);
  c.fill();
}

// rotor: ~22 voltas por segundo vistas como 4 quadros (efeito estroboscópico de rotor de verdade)
const frameNow = () => Math.floor(performance.now() / 34) % ROTOR_FRAMES;

// pontos da tela deste quadro (holofote à noite e o cone de luz)
let shot: { x: number; y: number; w: number; h: number } | null = null; // y: base do desenho

// segmento onde o helicóptero está (render3d desenha nele, na ordem certa do longe para o perto)
export function heliSeg(r: Race) {
  const h = r.heli;
  if (!h || h.dz < 12 * SEG_LEN) return -1;
  return Math.floor((r.playerZ + h.dz) / SEG_LEN);
}

export function heliDraw(c: CanvasRenderingContext2D, r: Race, K: number, s: Segment, tint?: [string, number]) {
  const h = r.heli;
  if (!h || h.fade <= 0.01) return;
  const z = r.playerZ + h.dz, pct = z / SEG_LEN - s.index;
  const sc = s.p1.screen.scale + (s.p2.screen.scale - s.p1.screen.scale) * pct;
  if (!(sc > 0)) return;
  const gx = s.p1.screen.x + (s.p2.screen.x - s.p1.screen.x) * pct;
  const gy = s.p1.screen.y + (s.p2.screen.y - s.p1.screen.y) * pct;
  const w = HELI_W * sc * K, hh = HELI_H * sc * K;
  const x = gx + sc * h.x * K, y = gy - sc * (h.alt - HELI_H * 0.5) * K;
  const night = r.nightK > 0.5 || !!r.def.night;
  const f = frameNow();
  const ga = c.globalAlpha;
  c.globalAlpha = ga * h.fade;
  const art = artReady('rear');
  drawCrisp(c, `heli${f}${night ? 'n' : ''}${art ? 'a' : ''}`, x, y, w, art ? w * ART_H : hh, (g, W, H) => (art ? drawArt(g, W, H, f, night, 'rear') : drawBody(g, W, H, f, night)), 64, tint);
  if (art) rotorDisc(c, x, y, w, w * ART_H, night, 1);
  c.globalAlpha = ga;
  shot = { x, y, w, h: art ? w * ART_H : hh };
}

// sombra no asfalto de dia (o sol à frente e baixo: a sombra cai entre ele e o carro, mais perto) e,
// à noite, a mancha do holofote no chão em volta do carro (registrada na luz da noite, em lote)
export function heliGround(c: CanvasRenderingContext2D, r: Race, K: number, segs: Segment[], base: number, end: number) {
  const h = r.heli;
  shot = null;
  if (!h || h.fade <= 0.01) return;
  const lit = r.nightK > 0.3 || !!r.def.night;
  if (!lit && r.inTunnel < 0.5) {
    const z = r.playerZ + h.dz * 0.55;
    const idx = Math.floor(z / SEG_LEN);
    if (idx > base + 3 && idx < end - 1) {
      const s = segs[idx], pct = z / SEG_LEN - idx;
      if (!s.tunnel && s.p1.screen.y <= s.clip + 1) {
        const sc = s.p1.screen.scale + (s.p2.screen.scale - s.p1.screen.scale) * pct;
        const gy = s.p1.screen.y + (s.p2.screen.y - s.p1.screen.y) * pct;
        const gx = s.p1.screen.x + (s.p2.screen.x - s.p1.screen.x) * pct + sc * h.x * K;
        const rw = HELI_W * 0.5 * sc * K, k = Math.max(0, 1 - h.alt / 16000) * h.fade;
        // disco do rotor bem claro e o corpo mais escuro, achatados no chão (degraus, sem degradê)
        c.fillStyle = `rgba(0,0,0,${(0.16 * k).toFixed(3)})`;
        c.beginPath();
        c.ellipse(Math.round(gx), Math.round(gy), Math.max(1, rw), Math.max(0.6, rw * 0.09), 0, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = `rgba(0,0,0,${(0.3 * k).toFixed(3)})`;
        c.beginPath();
        c.ellipse(Math.round(gx), Math.round(gy), Math.max(1, rw * 0.32), Math.max(0.6, rw * 0.06), 0, 0, Math.PI * 2);
        c.fill();
      }
    }
  }
  if (lit && h.sees) {
    // o holofote passeia um pouco em volta do carro (logo à frente do capô, onde se vê)
    const ahead = PLAYER_Z + (8.5 + 2 * Math.sin(h.life * 0.8)) * SEG_LEN;
    const u = (r.x + Math.sin(h.life * 1.3) * 420) / r.track.roadW;
    pushSpotPool(ahead / SEG_LEN + (r.position % SEG_LEN) / SEG_LEN, u, 4, 0.5, h.fade);
    const z = r.position + ahead, idx = Math.floor(z / SEG_LEN);
    if (idx > base && idx < end) {
      const s = segs[idx], pct = z / SEG_LEN - idx;
      const sc = s.p1.screen.scale + (s.p2.screen.scale - s.p1.screen.scale) * pct;
      spot = { x: s.p1.screen.x + (s.p2.screen.x - s.p1.screen.x) * pct + sc * u * r.track.roadW * K, y: s.p1.screen.y + (s.p2.screen.y - s.p1.screen.y) * pct, w: sc * r.track.roadW * 0.4 * K };
    } else spot = null;
  } else spot = null;
}
let spot: { x: number; y: number; w: number } | null = null;

// à noite, depois da escuridão: luzes de navegação (vermelha à esquerda, verde à direita, pisca
// branco) e o facho do holofote descendo até o chão (um polígono claro, em dois degraus)
export function heliLights(c: CanvasRenderingContext2D, r: Race) {
  const h = r.heli, s0 = shot;
  if (!h || !s0 || h.fade <= 0.01) return;
  const k = Math.max(r.nightK, r.def.night ? 1 : 0) * h.fade;
  if (k <= 0.05) return;
  const t = performance.now();
  const L = s0.x - s0.w * 0.16, R = s0.x + s0.w * 0.16, ny = s0.y - s0.h * 0.5;
  const r0 = Math.max(1.2, s0.w * 0.03);
  beaconGlow(c, [[L, ny, r0, 1]], '255,40,30', k);
  beaconGlow(c, [[R, ny, r0, 1]], '40,255,90', k);
  if (Math.floor(t / 900) % 3 === 0) beaconGlow(c, [[s0.x, s0.y - s0.h * 0.82, r0 * 1.4, 1]], '255,255,255', k);
  const lx = s0.x, ly = s0.y - s0.h * 0.27; // holofote embaixo do nariz
  beaconGlow(c, [[lx, ly, Math.max(2, s0.w * 0.06), 1]], '255,250,220', k);
  if (!h.sees || !spot) return;
  c.save();
  c.globalCompositeOperation = 'lighter';
  const rain = r.wx === 'rain' ? r.rainK : 0; // na chuva o facho aparece mais (gotas no ar)
  for (const [m, a] of [[1, 0.03], [0.5, 0.04]] as const) {
    c.fillStyle = `rgba(210,225,255,${(a * (1 + rain) * k).toFixed(3)})`;
    c.beginPath();
    c.moveTo(lx - 1, ly);
    c.lineTo(lx + 1, ly);
    c.lineTo(spot.x + spot.w * m, spot.y);
    c.lineTo(spot.x - spot.w * m, spot.y);
    c.closePath();
    c.fill();
  }
  c.restore();
}

// no retrovisor de dentro: quando ele vem chegando por trás (ou ficou para trás)
export function heliMirror(c: CanvasRenderingContext2D, r: Race, cx: number, hz: number, f: number, pz: number, camH: number) {
  const h = r.heli;
  if (!h || h.fade <= 0.01) return;
  const d = pz - (r.playerZ + h.dz);
  if (d < 6 * SEG_LEN) return;
  const w = (HELI_W * f) / d, hh = w * 0.56;
  if (w < 2) return;
  const x = cx + ((h.x - r.x) * f) / d, y = hz + ((camH - h.alt + HELI_H * 0.5) * f) / d;
  const night = r.nightK > 0.5 || !!r.def.night;
  const fr = frameNow();
  const ga = c.globalAlpha;
  c.globalAlpha = ga * h.fade;
  const art = artReady('front');
  drawCrisp(c, `helif${fr}${night ? 'n' : ''}${art ? 'a' : ''}`, x, y, w, art ? w * ART_H : hh, (g, W, H) => (art ? drawArt(g, W, H, fr, night, 'front') : drawBody(g, W, H, fr, night)), 64);
  if (art) rotorDisc(c, x, y, w, w * ART_H, night, 1);
  c.globalAlpha = ga;
}

// ---------------- som do rotor ----------------
// "tuc-tuc-tuc" grave: ruído abafado (passa-baixa) com o volume batendo no ritmo das pás (dente de
// serra invertido: sobe de uma vez e cai), um baque grave no mesmo ritmo e um zunido baixo da turbina.
// Volume e abafamento pela distância, lado no estéreo; no túnel quase some. Se o jogo parar de
// chamar (pausa, menu), cala sozinho.
interface Rotor { src: AudioBufferSourceNode; lp: BiquadFilterNode; am: GainNode; lfo: OscillatorNode; thump: OscillatorNode; whine: OscillatorNode; whG: GainNode; gain: GainNode; pan: StereoPannerNode }
let rotor: Rotor | null = null;
let lastCall = 0, watch = 0;
export function heliSound(s: { dz: number; dx: number; up: number; tunnel: number; k: number } | null) {
  const ctx = audioCtx();
  if (!ctx) return;
  const t = ctx.currentTime;
  if (!s) {
    if (rotor) {
      const v = rotor;
      rotor = null;
      v.gain.gain.setTargetAtTime(0, t, 0.25);
      for (const o of [v.src, v.lfo, v.thump, v.whine]) o.stop(t + 1.5);
    }
    return;
  }
  if (!rotor) {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(2);
    src.loop = true;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.Q.value = 0.7;
    const am = ctx.createGain();
    am.gain.value = 0.5;
    const lfo = ctx.createOscillator();
    lfo.type = 'sawtooth';
    lfo.frequency.value = 17;
    const lfoG = ctx.createGain();
    lfoG.gain.value = -0.48;
    lfo.connect(lfoG).connect(am.gain);
    const thump = ctx.createOscillator();
    thump.frequency.value = 96; // batida das pás (58 Hz não saía no alto-falante do celular)
    const thG = ctx.createGain();
    thG.gain.value = 0.32;
    const thL = ctx.createGain();
    thL.gain.value = -0.32;
    lfo.connect(thL).connect(thG.gain);
    const whine = ctx.createOscillator();
    whine.type = 'triangle';
    whine.frequency.value = 410;
    const whG = ctx.createGain();
    whG.gain.value = 0.02;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    const pan = ctx.createStereoPanner();
    src.connect(lp).connect(am).connect(gain);
    thump.connect(thG).connect(gain);
    whine.connect(whG).connect(lp);
    gain.connect(pan).connect(audioOut());
    src.start();
    lfo.start();
    thump.start();
    whine.start();
    rotor = { src, lp, am, lfo, thump, whine, whG, gain, pan };
  }
  const d = Math.hypot(s.dz, s.dx, s.up);
  const muff = 1 - 0.75 * Math.min(1, s.tunnel);
  // helicóptero a ~150 m é alto (passa por cima do ronco); antes ficava a ~1% e sumia
  const gain = (0.42 / (1 + (d / 140) ** 2)) * muff * s.k;
  const cut = (520 + 1100 / (1 + d / 60)) * (1 - 0.5 * Math.min(1, s.tunnel));
  const pn = Math.max(-0.8, Math.min(0.8, (s.dx / Math.max(1, d)) * 1.4));
  if (!Number.isFinite(gain + cut + pn)) return;
  rotor.gain.gain.setTargetAtTime(gain, t, 0.12);
  rotor.lp.frequency.setTargetAtTime(cut, t, 0.12);
  rotor.pan.pan.setTargetAtTime(pn, t, 0.15);
  rotor.whG.gain.setTargetAtTime(0.02 / (1 + d / 30), t, 0.2);
  lastCall = performance.now();
  if (!watch) watch = window.setInterval(() => {
    if (rotor && performance.now() - lastCall > 300) heliSound(null);
    if (!rotor) { clearInterval(watch); watch = 0; }
  }, 250);
}
