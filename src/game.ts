import { CAR_HALF, CENTRIFUGAL, PLAYER_Z, ROAD_W, SEG_LEN, TRUCK_W } from './config';
import { CARS, TRAFFIC_COLORS, type CarSpec } from './cars';
import { STAGES, type Stage } from './stages';
import { SPRITES } from './sprites';
import { buildTrack, type Segment, type Track } from './track';
import { input, takeShift } from './input';
import { beep, crashSound, setEngine } from './audio';
import { clamp, lerp, overlap, rng } from './util';

export type Mode = 'menu' | 'countdown' | 'race' | 'finish';

export interface TrafficCar {
  z: number;
  offset: number;
  speed: number; // negativo = contramão
  color: string;
  truck: boolean;
  hit: boolean; // já bateu: não colide mais até reaparecer
}

export interface Rival {
  z: number;
  offset: number;
  target: number;
  speed: number;
  recover: number;
  think: number;
  finishTime: number;
}

const TORQUE = [1, 0.8, 0.62, 0.48, 0.38];
const TRAFFIC_UNIT = 12000;

export class Game {
  mode: Mode = 'menu';
  stageIdx = 0;
  carIdx = 0;
  auto = true;

  stage: Stage = STAGES[0];
  car: CarSpec = CARS[0];
  track: Track = buildTrack(STAGES[0]);

  position = 0;
  playerX = 0.5;
  speed = 0;
  gear = 0;
  rpm = 0;
  crash = 0;
  ghost = 0; // invulnerável logo após uma batida
  recoverX = 0.5;
  shake = 0;
  steer = 0;
  braking = false;
  throttle = false;
  time = 0;
  countdown = 0;
  finishTime = -1;
  finishDelay = 0;
  bgOffset = 0;

  rival: Rival = { z: 0, offset: -0.5, target: -0.5, speed: 0, recover: 0, think: 0, finishTime: -1 };
  traffic: TrafficCar[] = [];
  rand = rng(99);

  onFinish?: (won: boolean) => void;

  select(stageIdx: number, carIdx: number) {
    this.stageIdx = (stageIdx + STAGES.length) % STAGES.length;
    this.carIdx = (carIdx + CARS.length) % CARS.length;
    const stage = STAGES[this.stageIdx];
    if (stage !== this.stage) {
      this.stage = stage;
      this.track = buildTrack(stage);
    }
    this.car = CARS[this.carIdx];
  }

  get playerZ() {
    return this.position + PLAYER_Z;
  }

  findSegment(z: number): Segment {
    const s = this.track.segments;
    return s[clamp(Math.floor(z / SEG_LEN), 0, s.length - 1)];
  }

  toMenu() {
    this.mode = 'menu';
    this.position = 0;
    this.speed = 0;
    this.playerX = 0;
    this.traffic = [];
    this.rival.z = -1e9;
  }

  startRace() {
    this.mode = 'countdown';
    this.countdown = 3.999;
    this.position = this.track.startZ - PLAYER_Z - SEG_LEN * 3;
    this.playerX = 0.5;
    this.speed = 0;
    this.gear = 0;
    this.crash = 0;
    this.ghost = 0;
    this.time = 0;
    this.finishTime = -1;
    this.finishDelay = 0;
    this.rival = { z: this.playerZ, offset: -0.5, target: -0.5, speed: 0, recover: 0, think: 0, finishTime: -1 };
    this.rand = rng(this.stage.seed * 31 + 5);
    this.traffic = [];
    for (let i = 0; i < this.stage.traffic; i++) {
      const c = this.newCar();
      this.spawn(c, this.playerZ + (50 + (i / this.stage.traffic) * 330) * SEG_LEN);
      this.traffic.push(c);
    }
  }

  private newCar(): TrafficCar {
    return { z: 0, offset: 0, speed: 0, color: '', truck: false, hit: false };
  }

  private spawn(c: TrafficCar, z: number) {
    const r = this.rand;
    const oncoming = r() < 0.45;
    c.z = z;
    c.offset = (oncoming ? -0.5 : 0.5) + (r() - 0.5) * 0.15;
    c.speed = oncoming ? -(0.25 + r() * 0.15) * TRAFFIC_UNIT : (0.2 + r() * 0.17) * TRAFFIC_UNIT;
    c.color = TRAFFIC_COLORS[Math.floor(r() * TRAFFIC_COLORS.length)];
    c.truck = r() < 0.2;
    c.hit = false;
  }

  carHalf(c: TrafficCar) {
    return c.truck ? TRUCK_W / 2 / ROAD_W : CAR_HALF;
  }

  update(dt: number) {
    const max = this.car.maxSpeed;
    const pSeg = this.findSegment(this.playerZ);

    if (this.mode === 'menu') {
      // modo demonstração atrás do menu
      this.speed = max * 0.5;
      this.position += this.speed * dt;
      this.playerX = lerp(this.playerX, 0, dt);
      if (this.playerZ > this.track.finishZ) this.position = 0;
      this.bgOffset += (pSeg.curve * this.speed * dt) / SEG_LEN;
      return;
    }

    if (this.mode === 'countdown') {
      const before = Math.ceil(this.countdown);
      this.countdown -= dt;
      const after = Math.ceil(this.countdown);
      if (after !== before) beep(after <= 0 ? 880 : 440, after <= 0 ? 0.4 : 0.15);
      if (this.countdown <= 0) this.mode = 'race';
      this.throttle = input.gas;
      this.rpm = lerp(this.rpm, input.gas ? 0.9 : 0.12, dt * 6);
      setEngine(this.rpm, input.gas, true);
      return;
    }

    if (this.mode === 'race') this.time += dt;
    const racing = this.mode === 'race';
    const speedPct = this.speed / max;

    // ---- câmbio e motor ----
    if (racing && !this.auto) {
      if (takeShift('shiftUp')) this.gear = Math.min(4, this.gear + 1);
      if (takeShift('shiftDown')) this.gear = Math.max(0, this.gear - 1);
    } else {
      takeShift('shiftUp');
      takeShift('shiftDown');
    }
    const gears = this.car.gears;
    let gearMax = max * gears[this.gear];
    this.rpm = this.speed / gearMax;

    const control = racing && this.crash <= 0;
    this.throttle = control && input.gas;
    this.braking = control ? input.brake : this.mode === 'finish';
    this.steer = control ? (input.left ? -1 : 0) + (input.right ? 1 : 0) : 0;

    if (this.throttle && this.speed < gearMax) {
      const band = this.gear === 0 ? 1 : clamp(0.3 + this.rpm * 0.9, 0.3, 1);
      this.speed = Math.min(gearMax, this.speed + this.car.accel * max * 0.2 * TORQUE[this.gear] * band * dt);
    } else if (!this.throttle) {
      this.speed -= max * 0.08 * dt;
    }
    if (this.speed > gearMax) this.speed -= (this.speed - gearMax) * 2 * dt; // freio-motor
    if (this.braking) this.speed -= max * 0.7 * dt;
    if (this.crash > 0) this.speed -= max * 1.5 * dt;

    const slope = (pSeg.p2.world.y - pSeg.p1.world.y) / SEG_LEN;
    this.speed -= slope * max * 0.12 * dt;

    if (this.auto) {
      if (this.rpm >= 0.98 && this.throttle && this.gear < 4) this.gear++;
      else if (this.gear > 0 && this.speed < max * gears[this.gear - 1] * 0.85) this.gear--;
    }
    gearMax = max * gears[this.gear];

    // ---- direção ----
    if (control) {
      const dx = dt * 2.2 * this.car.handling * Math.sqrt(speedPct);
      this.playerX += this.steer * dx;
      this.playerX -= dx * speedPct * pSeg.curve * CENTRIFUGAL;
    }
    if (this.crash > 0) {
      this.crash -= dt;
      this.playerX = lerp(this.playerX, this.recoverX, dt * 3);
      if (this.crash <= 0) this.ghost = 1.2;
    } else if (this.ghost > 0) this.ghost -= dt;

    // ---- fora da pista ----
    this.shake = 0;
    if (Math.abs(this.playerX) > 1) {
      const limit = max * 0.3;
      if (this.speed > limit) this.speed = Math.max(limit, this.speed - max * 0.6 * dt);
      if (this.speed > 100) this.shake = 1;
      for (const sp of pSeg.sprites) {
        const def = SPRITES[sp.kind];
        if (def.solid && overlap(this.playerX, CAR_HALF, sp.offset, def.w / 2 / ROAD_W)) {
          this.doCrash();
          break;
        }
      }
    }
    this.playerX = clamp(this.playerX, -3.5, 3.5);
    this.speed = clamp(this.speed, 0, max * 1.05);
    this.position += this.speed * dt;
    this.bgOffset += (pSeg.curve * this.speed * dt) / SEG_LEN;

    this.updateTraffic(dt);
    this.updateRival(dt);
    this.checkCollisions();

    // ---- chegada ----
    if (this.rival.finishTime < 0 && this.rival.z >= this.track.finishZ) this.rival.finishTime = this.time;
    if (this.mode === 'race' && this.playerZ >= this.track.finishZ) {
      this.mode = 'finish';
      this.finishTime = this.time;
      this.finishDelay = 2;
      beep(660, 0.3);
    }
    if (this.mode === 'finish' && this.finishDelay > 0) {
      this.finishDelay -= dt;
      if (this.finishDelay <= 0) this.onFinish?.(this.won);
    }

    setEngine(Math.max(0.12, this.rpm), this.throttle, true);
  }

  get won() {
    return this.rival.finishTime < 0 || this.finishTime <= this.rival.finishTime;
  }

  get place() {
    if (this.finishTime >= 0) return this.won ? 1 : 2;
    return this.playerZ >= this.rival.z ? 1 : 2;
  }

  private doCrash() {
    if (this.crash > 0) return;
    this.crash = 1.4;
    this.gear = 0;
    this.recoverX = 0.5; // volta para a faixa da direita (mão correta)
    crashSound();
  }

  private updateTraffic(dt: number) {
    const pz = this.playerZ;
    for (const c of this.traffic) {
      c.z += c.speed * dt;
      if (c.z < pz - 25 * SEG_LEN || c.z > pz + 450 * SEG_LEN) this.spawn(c, pz + (300 + this.rand() * 80) * SEG_LEN);
    }
  }

  // tempo até colidir com o próximo obstáculo em uma faixa
  private laneTTC(lane: number) {
    const r = this.rival;
    let best = Infinity;
    const check = (z: number, offset: number, speed: number) => {
      const dz = z - r.z;
      if (dz <= 0 || dz > 50 * SEG_LEN || Math.abs(offset - lane) > 0.45) return;
      const closing = r.speed - speed;
      if (closing > 0) best = Math.min(best, dz / closing);
    };
    for (const c of this.traffic) if (!c.hit) check(c.z, c.offset, c.speed);
    check(this.playerZ, this.playerX, this.speed);
    return best;
  }

  private updateRival(dt: number) {
    const r = this.rival;
    const max = this.car.maxSpeed;

    let target = 0;
    if (this.mode !== 'countdown') {
      if (r.finishTime >= 0) target = max * 0.3;
      else {
        const gap = (r.z - this.playerZ) / SEG_LEN; // "elástico" para manter o duelo disputado
        target = max * 0.97 * clamp(1 - gap * 0.0025, 0.9, 1.08);
      }
    }

    r.think -= dt;
    if (r.think <= 0) {
      r.think = 0.25;
      const cur = this.laneTTC(r.target);
      if (cur < 2.2) {
        const other = this.laneTTC(-r.target);
        // não "fecha" o jogador quando estão lado a lado
        const beside = Math.abs(this.playerZ - r.z) < SEG_LEN * 2.5 && Math.abs(this.playerX + r.target) < 0.5;
        if (other > cur && !beside) r.target = -r.target;
        if (Math.min(cur, other) < 1) target = Math.min(target, max * 0.35);
      }
    }

    if (r.recover > 0) {
      r.recover -= dt;
      target = Math.min(target, max * 0.2);
    }
    const rate = target > r.speed ? 0.25 : 1.5;
    r.speed += (target - r.speed) * Math.min(1, dt * rate);
    r.offset += clamp(r.target - r.offset, -dt * 1.1, dt * 1.1);
    r.offset = clamp(r.offset, -0.8, 0.8);
    r.z += r.speed * dt;
  }

  private checkCollisions() {
    const pz = this.playerZ;
    const r = this.rival;
    const max = this.car.maxSpeed;

    for (const c of this.traffic) {
      if (c.hit) continue;
      const half = this.carHalf(c);
      // jogador
      const dz = c.z - pz;
      const near = c.speed < 0 ? Math.abs(dz) < SEG_LEN : dz > -SEG_LEN * 0.3 && dz < SEG_LEN && this.speed > c.speed;
      if (this.crash <= 0 && this.ghost <= 0 && near && overlap(this.playerX, CAR_HALF, c.offset, half)) {
        if (c.speed < 0 || this.speed - c.speed > max * 0.35) {
          c.hit = true;
          this.doCrash();
        } else {
          this.speed = c.speed * 0.8;
          c.z = pz + SEG_LEN * 1.2;
          beep(120, 0.08);
        }
      }
      // rival
      const rz = c.z - r.z;
      const rnear = c.speed < 0 ? Math.abs(rz) < SEG_LEN : rz > -SEG_LEN * 0.3 && rz < SEG_LEN && r.speed > c.speed;
      if (r.recover <= 0 && rnear && overlap(r.offset, CAR_HALF, c.offset, half)) {
        c.hit = true;
        r.speed *= 0.3;
        r.recover = 1.2;
      }
    }

    // contato jogador x rival
    if (this.ghost <= 0 && Math.abs(r.z - pz) < SEG_LEN * 0.8 && overlap(this.playerX, CAR_HALF, r.offset, CAR_HALF)) {
      const push = (CAR_HALF * 2 - Math.abs(this.playerX - r.offset)) / 2 + 0.01;
      const side = this.playerX < r.offset ? -1 : 1;
      this.playerX += side * push;
      r.offset -= side * push;
      if (this.speed > r.speed) this.speed *= 0.97;
      else r.speed *= 0.97;
    }
  }
}
