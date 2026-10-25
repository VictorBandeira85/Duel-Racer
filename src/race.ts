import { CAR_W, KMH, PLAYER_Z, POLICE_W, SEG_LEN, TRUCK_W } from './config';
import { autoGear, engineAccel, GEARS, type CarSpec } from './cars';
import type { Course, StageDef } from './courses';
import { THEMES, nightTheme, rainTheme, type Theme } from './themes';
import { SPRITES } from './sprites';
import { buildTrack, laneCenter, type Segment, type Track } from './track';
import { input, takeShift } from './input';
import { beep, crashSound, setEngine, setSiren } from './audio';
import { clamp, lerp, overlap, rng } from './util';

export const TRAFFIC_COLORS = ['#2a6fdb', '#e8e8e8', '#3d9b47', '#c9a227', '#7a3db8', '#d9542b', '#555566', '#80c0e0', '#8a2a2a'];

export interface TrafficCar {
  z: number;
  x: number;
  speed: number; // negativo = contramão
  color: string;
  truck: boolean;
  hit: boolean;
}

export interface Rival {
  z: number;
  x: number;
  targetX: number;
  speed: number;
  recover: number;
  think: number;
  finishTime: number;
}

export interface Police {
  spotZ: number;
  z: number;
  x: number;
  speed: number;
  state: 'parked' | 'chase' | 'done';
}

const HITBOX = 0.8;

export type RaceState = 'countdown' | 'drive' | 'crash' | 'ticket' | 'arrived';

export class Race {
  def: StageDef;
  theme: Theme;
  track: Track;
  state: RaceState = 'countdown';
  timer = 3.999;

  position = 0;
  x = 0;
  speed = 0;
  gear = 0;
  rpm = 0;
  steer = 0;
  throttle = false;
  braking = false;
  ghost = 0;
  shake = 0;
  bgOffset = 0;

  time = 0; // tempo do trecho (inclui multas)
  rivalTime = -1;
  clean = true;
  crashes = 0;
  tickets = 0;
  message = '';
  messageT = 0;

  rival: Rival | null = null;
  traffic: TrafficCar[] = [];
  police: Police[] = [];
  radar = 0;
  rand: () => number;

  onArrive?: () => void;
  onCrash?: () => void;

  constructor(
    public course: Course,
    public stageIdx: number,
    public car: CarSpec,
    public rivalCar: CarSpec | null,
    public auto: boolean,
  ) {
    this.def = course.stages[stageIdx];
    const base = THEMES[this.def.theme];
    this.theme = this.def.night ? nightTheme(base) : this.def.weather === 'rain' ? rainTheme(base) : base;
    const seed = course.id.length * 1000 + stageIdx * 97 + 11;
    this.track = buildTrack(this.def, this.theme, seed);
    this.rand = rng(seed + 5);

    const t = this.track;
    this.position = t.startZ - PLAYER_Z - SEG_LEN * 2;
    const myLane = t.lanes - 1;
    this.x = laneCenter(t, myLane);
    if (rivalCar) {
      this.rival = { z: this.playerZ, x: laneCenter(t, myLane - 1), targetX: laneCenter(t, myLane - 1), speed: 0, recover: 0, think: 0, finishTime: -1 };
    }
    for (let i = 0; i < this.def.traffic; i++) {
      const c: TrafficCar = { z: 0, x: 0, speed: 0, color: '', truck: false, hit: false };
      this.spawn(c, this.playerZ + (45 + (i / this.def.traffic) * 300) * SEG_LEN);
      this.traffic.push(c);
    }
    this.police = t.policeSpots.map((z) => ({ spotZ: z, z, x: t.roadW + 1500, speed: 0, state: 'parked' as const }));
  }

  get playerZ() {
    return this.position + PLAYER_Z;
  }

  get progress() {
    const t = this.track;
    return clamp((this.playerZ - t.startZ) / (t.finishZ - t.startZ), 0, 1);
  }

  findSegment(z: number): Segment {
    const s = this.track.segments;
    return s[clamp(Math.floor(z / SEG_LEN), 0, s.length - 1)];
  }

  private say(msg: string, t = 1.6) {
    this.message = msg;
    this.messageT = t;
  }

  private spawn(c: TrafficCar, z: number) {
    const r = this.rand;
    const lanes = this.track.lanes;
    const lane = Math.floor(r() * lanes);
    const oncoming = lane < lanes / 2;
    c.z = z;
    c.x = laneCenter(this.track, lane) + (r() - 0.5) * 300;
    c.speed = (oncoming ? -1 : 1) * (0.2 + r() * 0.16) * 12000;
    c.color = TRAFFIC_COLORS[Math.floor(r() * TRAFFIC_COLORS.length)];
    c.truck = r() < 0.18;
    c.hit = false;
  }

  // área de colisão um pouco menor que o desenho, para raspões não contarem
  carHalf(c: TrafficCar) {
    return ((c.truck ? TRUCK_W : CAR_W) / 2) * HITBOX;
  }

  update(dt: number) {
    if (this.messageT > 0) this.messageT -= dt;
    const max = this.car.maxSpeed;
    const t = this.track;
    const pSeg = this.findSegment(this.playerZ);

    if (this.state === 'countdown') {
      const before = Math.ceil(this.timer);
      this.timer -= dt;
      const after = Math.ceil(this.timer);
      if (after !== before && after <= 3) beep(after <= 0 ? 880 : 440, after <= 0 ? 0.4 : 0.15);
      if (this.timer <= 0) this.state = 'drive';
      this.throttle = input.gas;
      this.rpm = lerp(this.rpm, input.gas ? 0.85 : 0.1, dt * 6);
      setEngine(this.rpm, input.gas, true);
      return;
    }

    const driving = this.state === 'drive';
    if (this.state !== 'arrived') this.time += dt;

    // ---- câmbio ----
    if (driving && !this.auto) {
      if (takeShift('shiftUp')) this.gear = Math.min(4, this.gear + 1);
      if (takeShift('shiftDown')) this.gear = Math.max(0, this.gear - 1);
    } else {
      takeShift('shiftUp');
      takeShift('shiftDown');
    }

    this.throttle = driving && input.gas;
    this.braking = driving ? input.brake : true;
    this.steer = driving ? (input.left ? -1 : 0) + (input.right ? 1 : 0) : 0;

    const gearMax = max * GEARS[this.gear];
    if (this.throttle) this.speed += engineAccel(this.car, this.gear, this.speed) * dt;
    else this.speed -= max * 0.06 * dt;
    if (this.speed > gearMax) this.speed -= (this.speed - gearMax) * 2 * dt; // freio-motor
    if (this.braking) this.speed -= max * (this.state === 'crash' ? 2 : 0.6) * dt;
    const slope = (pSeg.p2.world.y - pSeg.p1.world.y) / SEG_LEN;
    this.speed -= slope * max * 0.1 * dt;
    this.speed = clamp(this.speed, 0, max * 1.05);
    if (this.auto) this.gear = autoGear(this.car, this.gear, this.speed, this.throttle);
    this.rpm = this.speed / (max * GEARS[this.gear]);

    // ---- direção ----
    const speedPct = this.speed / max;
    if (driving) {
      this.x += this.steer * dt * 2700 * this.car.handling * Math.sqrt(speedPct);
      this.x -= dt * speedPct * speedPct * pSeg.curve * 560;
    }

    // ---- fora da pista ----
    this.shake = 0;
    if (Math.abs(this.x) > t.roadW + 700) {
      const limit = max * 0.28;
      if (this.speed > limit) this.speed = Math.max(limit, this.speed - max * 0.6 * dt);
      if (this.speed > 100) this.shake = 1;
      if (driving && this.ghost <= 0) {
        for (const sp of pSeg.sprites) {
          const def = SPRITES[sp.kind];
          if (def.solid && overlap(this.x, CAR_W / 2, sp.x, def.w / 2)) {
            this.crash();
            break;
          }
        }
      }
    }
    this.x = clamp(this.x, -t.roadW * 3, t.roadW * 3);
    this.speed = clamp(this.speed, 0, max * 1.05);
    this.position += this.speed * dt;
    this.bgOffset += (pSeg.curve * this.speed * dt) / SEG_LEN;
    if (this.ghost > 0) this.ghost -= dt;

    this.updateTraffic(dt);
    this.updateRival(dt);
    this.updatePolice(dt);
    if (driving) this.checkCollisions();

    // ---- estados especiais ----
    if (this.state === 'crash' || this.state === 'ticket') {
      this.timer -= dt;
      if (this.timer <= 0) {
        if (this.state === 'crash') this.onCrash?.();
        this.resume();
      }
    }

    if (this.rival && this.rival.finishTime < 0 && this.rival.z >= t.finishZ) this.rival.finishTime = this.time;
    if (driving && this.playerZ >= t.finishZ) {
      this.state = 'arrived';
      this.timer = 2.2;
      this.rivalTime = this.rival
        ? this.rival.finishTime >= 0
          ? this.rival.finishTime
          : this.time + (t.finishZ - this.rival.z) / Math.max(this.rival.speed, 4000)
        : -1;
      setSiren(false);
    }
    if (this.state === 'arrived') {
      this.timer -= dt;
      if (this.timer <= 0 && this.onArrive) {
        const cb = this.onArrive;
        this.onArrive = undefined;
        cb();
      }
    }

    setEngine(Math.max(0.1, this.rpm), this.throttle, true);
  }

  crashPoint = { x: 0.5, y: 0.5 };

  private crash() {
    this.state = 'crash';
    this.timer = 2.6;
    this.clean = false;
    this.crashes++;
    this.gear = 0;
    this.crashPoint = { x: 0.3 + this.rand() * 0.4, y: 0.35 + this.rand() * 0.3 };
    crashSound();
  }

  // volta à pista depois de batida ou multa
  private resume() {
    this.state = 'drive';
    this.speed = 0;
    this.gear = 0;
    this.x = laneCenter(this.track, this.track.lanes - 1);
    this.ghost = 1.5;
    for (const c of this.traffic) {
      if (Math.abs(c.z - this.playerZ) < 12 * SEG_LEN) this.spawn(c, this.playerZ + (200 + this.rand() * 100) * SEG_LEN);
    }
  }

  private updateTraffic(dt: number) {
    const pz = this.playerZ;
    for (const c of this.traffic) {
      c.z += c.speed * dt;
      if (c.z < pz - 25 * SEG_LEN || c.z > pz + 420 * SEG_LEN) this.spawn(c, pz + (280 + this.rand() * 80) * SEG_LEN);
    }
  }

  // tempo até alcançar o próximo obstáculo numa faixa
  private laneTTC(laneX: number) {
    const r = this.rival!;
    let best = Infinity;
    const check = (z: number, x: number, speed: number) => {
      const dz = z - r.z;
      if (dz <= 0 || dz > 50 * SEG_LEN || Math.abs(x - laneX) > CAR_W * 1.1) return;
      const closing = r.speed - speed;
      if (closing > 0) best = Math.min(best, dz / closing);
    };
    for (const c of this.traffic) if (!c.hit) check(c.z, c.x, c.speed);
    check(this.playerZ, this.x, this.speed);
    return best;
  }

  private updateRival(dt: number) {
    const r = this.rival;
    if (!r || !this.rivalCar) return;
    const max = this.rivalCar.maxSpeed;
    let target = 0;
    if (r.finishTime >= 0 || this.state === 'arrived') target = max * 0.25;
    else {
      const gap = (r.z - this.playerZ) / SEG_LEN;
      target = max * this.course.rivalSkill * clamp(1 - gap * 0.0018, 0.92, 1.06);
    }

    r.think -= dt;
    if (r.think <= 0) {
      r.think = 0.25;
      const lanes = this.track.lanes;
      let bestX = r.targetX;
      let bestScore = this.laneTTC(r.targetX) + 0.4; // prefere ficar onde está
      for (let i = 0; i < lanes; i++) {
        const lx = laneCenter(this.track, i);
        if (lx === r.targetX) continue;
        const beside = Math.abs(this.playerZ - r.z) < SEG_LEN * 3 && Math.abs(this.x - lx) < CAR_W;
        if (beside) continue;
        const score = this.laneTTC(lx) * (i < lanes / 2 ? 0.85 : 1);
        if (score > bestScore) {
          bestScore = score;
          bestX = lx;
        }
      }
      r.targetX = bestX;
      if (bestScore < 1) target = Math.min(target, max * 0.35);
    }
    if (r.recover > 0) {
      r.recover -= dt;
      target = Math.min(target, max * 0.2);
    }
    r.speed += (target - r.speed) * Math.min(1, dt * (target > r.speed ? 0.22 : 1.5));
    r.x += clamp(r.targetX - r.x, -dt * 2600, dt * 2600);
    r.z += r.speed * dt;
  }

  private updatePolice(dt: number) {
    const pz = this.playerZ;
    this.radar = 0;
    let chasing = false;
    for (const p of this.police) {
      if (p.state === 'parked') {
        const d = p.spotZ - pz;
        if (d > 0 && d < 80 * SEG_LEN) this.radar = Math.max(this.radar, 1 - d / (80 * SEG_LEN));
        if (d <= 0) {
          if (this.speed * KMH > 150 && this.state === 'drive') {
            p.state = 'chase';
            p.speed = this.speed * 0.4;
            this.say('POLÍCIA!');
          } else p.state = 'done';
        }
      } else if (p.state === 'chase') {
        chasing = true;
        this.radar = 1;
        const target = this.car.maxSpeed * 0.985;
        p.speed += (target - p.speed) * Math.min(1, dt * 0.9);
        p.x += clamp(this.x - p.x, -dt * 3000, dt * 3000);
        p.z += p.speed * dt;
        if (this.state === 'drive' && p.z >= pz - SEG_LEN * 0.6) {
          p.state = 'done';
          this.state = 'ticket';
          this.timer = 3;
          this.tickets++;
          this.time += 10;
          this.clean = false;
          this.say('MULTADO! +10s', 3);
        } else if (pz - p.z > 90 * SEG_LEN) {
          p.state = 'done';
          this.say('ESCAPOU!');
        }
      }
    }
    setSiren(chasing);
  }

  private checkCollisions() {
    const pz = this.playerZ;
    const r = this.rival;
    const max = this.car.maxSpeed;
    const myHalf = (CAR_W / 2) * HITBOX;

    for (const c of this.traffic) {
      if (c.hit) continue;
      const half = this.carHalf(c);
      const dz = c.z - pz;
      const near = c.speed < 0 ? Math.abs(dz) < SEG_LEN : dz > -SEG_LEN * 0.3 && dz < SEG_LEN && this.speed > c.speed;
      if (this.ghost <= 0 && near && overlap(this.x, myHalf, c.x, half)) {
        if (c.speed < 0 || this.speed - c.speed > max * 0.3) {
          c.hit = true;
          this.crash();
          return;
        }
        this.speed = c.speed * 0.8;
        c.z = pz + SEG_LEN * 1.2;
        beep(120, 0.08);
      }
      if (r) {
        const rz = c.z - r.z;
        const rnear = c.speed < 0 ? Math.abs(rz) < SEG_LEN : rz > -SEG_LEN * 0.3 && rz < SEG_LEN && r.speed > c.speed;
        if (r.recover <= 0 && rnear && overlap(r.x, myHalf, c.x, half)) {
          c.hit = true;
          r.speed *= 0.3;
          r.recover = 1.2;
        }
      }
    }

    for (const p of this.police) {
      if (p.state === 'parked' && this.ghost <= 0 && Math.abs(p.z - pz) < SEG_LEN && overlap(this.x, myHalf, p.x, (POLICE_W / 2) * HITBOX)) {
        this.crash();
        return;
      }
    }

    if (r && this.ghost <= 0 && Math.abs(r.z - pz) < SEG_LEN * 0.8 && overlap(this.x, myHalf, r.x, myHalf)) {
      const push = (CAR_W - Math.abs(this.x - r.x)) / 2 + 20;
      const side = this.x < r.x ? -1 : 1;
      this.x += side * push;
      r.x -= side * push;
      if (this.speed > r.speed) this.speed *= 0.97;
      else r.speed *= 0.97;
    }
  }
}
