import { LANE_W, SEG_LEN } from './config';
import type { StageDef } from './courses';
import { SPRITES, type SpriteKind } from './sprites';
import type { Theme } from './themes';
import { easeIn, easeInOut, rng } from './util';

export interface Point {
  world: { y: number; z: number };
  camera: { x: number; y: number; z: number };
  screen: { x: number; y: number; w: number; scale: number };
}

export interface SpriteInst {
  kind: SpriteKind;
  x: number; // centro, em unidades do mundo (0 = meio da pista)
  seed: number;
}

export interface Segment {
  index: number;
  p1: Point;
  p2: Point;
  curve: number;
  sprites: SpriteInst[];
  cars: { z: number; x: number }[];
  clip: number;
  tunnel?: boolean; // dentro de um túnel (paredes e teto, sem cenário)
}

export interface Track {
  segments: Segment[];
  roadW: number; // meia largura da pista
  lanes: number;
  startZ: number;
  finishZ: number;
  policeSpots: number[];
}

const point = (y: number, z: number): Point => ({
  world: { y, z },
  camera: { x: 0, y: 0, z: 0 },
  screen: { x: 0, y: 0, w: 0, scale: 0 },
});

export function laneCenter(track: Track, lane: number) {
  const lw = (track.roadW * 2) / track.lanes;
  return -track.roadW + lw * (lane + 0.5);
}

const TUNNELS: Partial<Record<string, number>> = { mountain: 2, alpine: 2, alpinesnow: 1, coast: 1, canyon: 1 };

export function buildTrack(def: StageDef, theme: Theme, seed: number): Track {
  const rand = rng(seed);
  const roadW = (def.lanes * LANE_W) / 2;
  const segments: Segment[] = [];
  const lastY = () => (segments.length ? segments[segments.length - 1].p2.world.y : 0);

  const addSegment = (curve: number, y: number) => {
    const n = segments.length;
    segments.push({ index: n, p1: point(lastY(), n * SEG_LEN), p2: point(y, (n + 1) * SEG_LEN), curve, sprites: [], cars: [], clip: 0 });
  };

  const addRoad = (enter: number, hold: number, leave: number, curve: number, height: number) => {
    const startY = lastY();
    const endY = startY + height * SEG_LEN;
    const total = enter + hold + leave;
    const first = segments.length;
    for (let n = 0; n < enter; n++) addSegment(easeIn(0, curve, n / enter), easeInOut(startY, endY, n / total));
    for (let n = 0; n < hold; n++) addSegment(curve, easeInOut(startY, endY, (enter + n) / total));
    for (let n = 0; n < leave; n++) addSegment(easeInOut(curve, 0, n / leave), easeInOut(startY, endY, (enter + hold + n) / total));
    // guarda-corpo do lado de fora das curvas mais fechadas
    if (Math.abs(curve) >= 2.5) {
      const side = curve > 0 ? -1 : 1;
      for (let n = first + Math.floor(enter / 2); n < first + total - Math.floor(leave / 2); n += 2)
        segments[n].sprites.push({ kind: 'rail', x: side * (roadW + 700), seed: 0 });
    }
    // aviso antes da curva, no acostamento da direita: curva suave ou acentuada, para o lado dela
    if (Math.abs(curve) >= 1 && first > 70) {
      const sharp = Math.abs(curve) >= 2.5;
      const kind: SpriteKind = sharp ? (curve > 0 ? 'sharpR' : 'sharpL') : curve > 0 ? 'warnR' : 'warnL';
      const at = segments[first - 55];
      if (!at.sprites.some((sp) => sp.x > 0 && Math.abs(sp.x - (roadW + 1300)) < 1500)) at.sprites.push({ kind, x: roadW + 1300, seed: 0 });
    }
    // curvas fechadas: placas de chevrons ao longo do lado de fora
    if (Math.abs(curve) >= 2.5) {
      const x = (roadW + 1400) * (curve > 0 ? -1 : 1);
      for (let n = first + Math.max(0, enter - 24); n < first + enter + hold; n += 16) segments[n]?.sprites.push({ kind: curve > 0 ? 'signR' : 'signL', x, seed: 0 });
    }
  };

  const hill = () => {
    if (rand() > def.hilliness) return 0;
    return (rand() * 2 - 1) * 50 * def.hilliness - lastY() / SEG_LEN / 3;
  };

  addRoad(0, 60, 0, 0, 0);
  const startIndex = 8;

  for (let i = 0; i < def.sections; i++) {
    const r = rand();
    const len = [30, 50, 80][Math.floor(rand() * 3)];
    const curve = (rand() < 0.5 ? -1 : 1) * [1.5, 2.5, 4][Math.floor(rand() * 3)] * def.curviness;
    if (r < 0.35) addRoad(len, len * 2, len, 0, hill());
    else if (r < 0.8) addRoad(len, len, len, curve, hill());
    else {
      addRoad(len, len, len, curve, hill() / 2);
      addRoad(len, len, len, -curve, hill() / 2);
    }
  }

  addRoad(40, 60, 40, 0, -lastY() / SEG_LEN);
  const finishIndex = segments.length + 20;
  addRoad(0, 300, 0, 0, 0);

  // balizas brancas dos dois lados
  for (let i = 0; i < segments.length; i += 8) {
    segments[i].sprites.push({ kind: 'post', x: -(roadW + 900), seed: 0 }, { kind: 'post', x: roadW + 900, seed: 0 });
  }

  // iluminação pública: postes do lado direito em alguns trechos (perto das cidades, das
  // pontes e da chegada); na cidade e na zona industrial, em quase toda a estrada
  const urban = theme.scenery.includes('lamp');
  const stretches = urban ? 6 : 2;
  for (let k = 0; k < stretches; k++) {
    const start = Math.floor(segments.length * (k + 0.2 + rand() * 0.5) / stretches);
    const len = 120 + Math.floor(rand() * 160);
    for (let i = start; i < Math.min(segments.length - 1, start + len); i += 14) {
      segments[i].sprites = segments[i].sprites.filter((sp) => !(sp.x > 0 && sp.x < roadW + 2500));
      segments[i].sprites.push({ kind: 'lamp', x: roadW + 1300, seed: 0 });
    }
  }
  for (let i = finishIndex - 90; i < finishIndex + 30; i += 14) if (segments[i]) segments[i].sprites.push({ kind: 'lamp', x: roadW + 1300, seed: 0 });

  // posto de gasolina na chegada
  for (const k of [60, 35]) segments[finishIndex - k].sprites.push({ kind: 'gasSign', x: roadW + 2200, seed: 0 });
  segments[finishIndex + 4].sprites.push({ kind: 'station', x: roadW + 5200, seed: 0 });
  // placa de PARE: o trecho termina parando no posto, como no Test Drive II
  segments[finishIndex + 2].sprites.push({ kind: 'stop', x: roadW + 700, seed: 0 });

  // cenário
  for (let i = 20; i < segments.length; i++) {
    const s = segments[i];
    if (rand() < theme.density) {
      const side = rand() < 0.5 ? -1 : 1;
      const kind = theme.scenery[Math.floor(rand() * theme.scenery.length)];
      const half = SPRITES[kind].w / 2;
      const x = side * (roadW + 1600 + half + rand() * (rand() < 0.2 ? 9000 : 3000));
      s.sprites.push({ kind, x, seed: Math.floor(rand() * 1e6) });
    }
  }

  // viadutos sobre a pista, em trechos retos
  for (let b = 0, tries = 0; b < (theme.bridges ?? 0) && tries < 200; tries++) {
    const i = Math.floor(segments.length * (0.2 + rand() * 0.55));
    if (segments[i].curve !== 0 || segments[i - 10]?.curve !== 0 || segments[i].sprites.some((sp) => sp.kind === 'bridge')) continue;
    segments[i].sprites.push({ kind: 'bridge', x: 0, seed: 0 });
    b++;
  }

  // túneis nas serras, no litoral e no cânion: 1 ou 2 por trecho, de 45 a 110 segmentos (com
  // sorteio próprio, para não mudar o resto da pista)
  const nTunnels = TUNNELS[def.theme] ?? 0;
  const tr = rng(seed * 31 + 7);
  for (let k = 0, tries = 0; k < nTunnels && tries < 60; tries++) {
    const len = 45 + Math.floor(tr() * 65);
    const a = Math.floor(startIndex + 120 + tr() * (finishIndex - startIndex - 360));
    const b = a + len;
    if (segments.slice(a - 40, b + 40).some((sg) => sg.tunnel || sg.sprites.some((sp) => sp.kind === 'bridge'))) continue;
    for (let i = a; i < b; i++) {
      segments[i].tunnel = true;
      segments[i].sprites = [];
    }
    // a boca do túnel fica na encosta: nada de árvore ou placa logo antes e logo depois
    for (let i = a - 8; i < a; i++) segments[i].sprites = segments[i].sprites.filter((sp) => sp.kind === 'post');
    for (let i = b; i < b + 4; i++) segments[i].sprites = segments[i].sprites.filter((sp) => sp.kind === 'post');
    k++;
  }

  // pontos onde a polícia fica escondida
  const policeSpots: number[] = [];
  for (let i = 0; i < def.police; i++) {
    const t = 0.25 + (0.55 * (i + rand() * 0.6)) / Math.max(1, def.police);
    policeSpots.push(Math.floor(startIndex + (finishIndex - startIndex) * t) * SEG_LEN);
  }

  return { segments, roadW, lanes: def.lanes, startZ: startIndex * SEG_LEN, finishZ: finishIndex * SEG_LEN, policeSpots };
}
