// Câmera de fora do carro (modo foto e replay): a mesma pista do jogo (renderRoad), vista de uma
// câmera atrás do carro do jogador, que aparece na pista com o sprite da traseira (cor, rodas
// rebaixadas, placa do jogador). A câmera é posta trocando por um instante a posição, a altura e o
// "giro" da corrida, e tudo volta ao que era logo depois do desenho.
import { CAM_DEPTH, CAM_H, SEG_LEN } from './config';
import type { CarSpec } from './cars';
import { renderRoad, selfCar, type Viewport } from './render3d';
import type { Race } from './race';
import { myPlateLook } from './myplate';
import { paintHex } from './paint';
import { clamp, lerp } from './util';

export interface Cam {
  dist: number; // distância da câmera ao carro (unidades do mundo)
  orbit: number; // giro em volta do carro (rad, + = câmera à direita)
  height: number; // altura da câmera acima do chão
  aim?: number; // onde o carro fica na altura da tela (0 = topo, 1 = base)
}
export interface Pose { z: number; x: number; lift: number; brake: boolean; car: CarSpec; paint?: string }

export const playerPose = (r: Race): Pose => ({ z: r.playerZ, x: r.x, lift: r.lift, brake: r.braking, car: r.car, paint: paintHex(r.car.id) });

const groundAt = (r: Race, z: number) => {
  const s = r.findSegment(z);
  return lerp(s.p1.world.y, s.p2.world.y, clamp(z / SEG_LEN - s.index, 0, 1));
};

// hide: só o cenário (o carro é desenhado à parte, como na foto de lado)
export function renderOutside(c: CanvasRenderingContext2D, r: Race, vp0: Viewport, cam: Cam, pose: Pose, hide = false) {
  const segs = r.track.segments;
  const back = Math.max(400, cam.dist * Math.cos(cam.orbit));
  const side = cam.dist * Math.sin(cam.orbit);
  const camZ = Math.max(1, pose.z - back);
  const dz = pose.z - camZ;
  // desvio da pista entre a câmera e o carro (curva): a câmera vira um pouco para manter o carro à vista
  const base = r.findSegment(camZ);
  const basePct = (camZ % SEG_LEN) / SEG_LEN;
  let xo = 0, dx = -(base.curve * basePct);
  const carIdx = Math.min(segs.length - 1, Math.floor(pose.z / SEG_LEN));
  for (let i = base.index; i < carIdx; i++) {
    xo += dx;
    dx += segs[i].curve;
  }
  xo += dx * ((pose.z % SEG_LEN) / SEG_LEN);
  const camX = pose.x + side;
  const yaw = (pose.x - camX + xo * 0.85) / dz;
  // horizonte: o carro fica na altura pedida da tela
  const gCam = groundAt(r, camZ), gCar = groundAt(r, pose.z) + pose.lift * 0.5;
  const eye = gCam + cam.height;
  const target = vp0.y + vp0.h * (cam.aim ?? 0.8);
  const horizon = clamp(target - (CAM_DEPTH / dz) * (eye - gCar) * vp0.K, vp0.y - 60, vp0.y + vp0.h * 0.62);
  const vp: Viewport = { ...vp0, horizon, h0: horizon };
  const lit = !!r.def.night || r.nightK > 0.15 || r.inTunnel > 0.5;
  const saved = { position: r.position, x: r.x, lift: r.lift, yaw: r.yaw, pitch: r.pitch, shake: r.shake, speed: r.speed, ghostPos: r.ghostPos };
  try {
    r.position = camZ;
    r.x = camX;
    r.lift = cam.height - CAM_H;
    r.yaw = yaw;
    r.pitch = 0;
    r.shake = 0;
    r.speed = 0;
    r.ghostPos = null;
    selfCar.ent.z = pose.z;
    selfCar.ent.x = pose.x;
    selfCar.lift = pose.lift;
    selfCar.look = hide ? null : {
      color: pose.car.color, rear: pose.car.rear, paint: pose.paint, plate: myPlateLook(), drop: pose.car.rideDrop,
      brake: pose.brake, night: lit, lamps: { up: lit ? 1 : 0, on: lit }, driver: 'man',
    };
    renderRoad(c, r, vp);
  } finally {
    selfCar.look = null;
    Object.assign(r, saved);
  }
}
