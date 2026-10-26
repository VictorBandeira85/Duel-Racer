import { CAR_W, KMH, LANE_W, PLAYER_Z, POLICE_W, SEG_LEN, TRUCK_W } from './config';
import { autoGear, engineAccel, GEARS, type CarSpec } from './cars';
import type { Course, StageDef } from './courses';
import { THEMES, nightTheme, rainTheme, type Theme } from './themes';
import { SPRITES } from './sprites';
import { buildTrack, laneCenter, type Segment, type Track } from './track';
import { input, takeShift } from './input';
import { beep, crashSound, scrapeSound, setEngine, setEngineProfile, setSiren, setTires, shiftSound } from './audio';
import { clamp, lerp, overlap, rng } from './util';

export type TrafficModel = 'sedan' | 'hatch' | 'pickup' | 'van' | 'truck';
const CAR_MODELS: TrafficModel[] = ['sedan', 'sedan', 'hatch', 'hatch', 'pickup', 'van'];
export const TRAFFIC_COLORS = ['#2a6fdb', '#e8e8e8', '#3d9b47', '#c9a227', '#7a3db8', '#d9542b', '#555566', '#80c0e0', '#8a2a2a'];

export interface TrafficCar {
  z: number;
  x: number;
  speed: number; // negativo = contramão
  color: string;
  truck: boolean;
  model: TrafficModel;
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
  style: RivalStyle;
  mistake: number; // tempo restante de um erro (imprevisível)
  boost: number; // tempo restante de uma arrancada (imprevisível)
}

// Jeito de pilotar de cada adversário
export type RivalStyle = 'agressivo' | 'cauteloso' | 'imprevisivel';
export const RIVAL_STYLE: Record<string, RivalStyle> = {
  'furia-f4': 'agressivo', 'silber-95': 'cauteloso', 'toro-v12': 'agressivo', 'vortex-zr': 'imprevisivel',
  'furia-tr': 'cauteloso', 'toro-lp5': 'imprevisivel', 'kaze-nx': 'cauteloso', 'serpe-v10': 'agressivo',
};

export interface Police {
  spotZ: number;
  z: number;
  x: number;
  speed: number;
  // parado escondido → perseguindo → encostando o jogador → parado no acostamento → indo embora
  state: 'parked' | 'chase' | 'pull' | 'stopped' | 'leaving' | 'done';
  chaseT: number;
}

// Policial que desce da viatura e mostra a multa
export interface Officer {
  z: number;
  x: number;
  phase: 'walk' | 'show' | 'back';
  t: number;
}

export interface Fine {
  kmh: number;
  limit: number;
  value: number;
}

const HITBOX = 0.8;

export type RaceState = 'countdown' | 'drive' | 'crash' | 'pullover' | 'ticket' | 'arrived';

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
  scrapeT = 0; // tremida curta depois de um raspão
  bgOffset = 0;

  time = 0; // tempo do trecho (inclui multas)
  rivalTime = -1;
  clean = true;
  crashes = 0;
  tickets = 0;
  message = '';
  messageT = 0;

  rival: Rival | null = null;
  rivalPaint?: string; // cor do rival (piloto da carreira)
  private rivalStyleOverride?: RivalStyle;
  fines = 0; // soma das multas do trecho
  traffic: TrafficCar[] = [];
  police: Police[] = [];
  officer: Officer | null = null;
  fine: Fine | null = null;
  private stopX = 0; // onde o jogador encosta
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
    opts: { rivalStyle?: RivalStyle; rivalPaint?: string } = {},
  ) {
    this.rivalPaint = opts.rivalPaint;
    this.rivalStyleOverride = opts.rivalStyle;
    setEngineProfile(car.engine);
    this.def = course.stages[stageIdx];
    const base = THEMES[this.def.theme];
    this.theme = this.def.night ? nightTheme(base) : this.def.weather === 'rain' ? rainTheme(base) : base;
    const seed = (course.seed ?? course.id.length * 1000) + stageIdx * 97 + 11;
    this.track = buildTrack(this.def, this.theme, seed);
    this.rand = rng(seed + 5);

    const t = this.track;
    this.position = t.startZ - PLAYER_Z - SEG_LEN * 2;
    const myLane = t.lanes - 1;
    this.x = laneCenter(t, myLane);
    if (rivalCar) {
      this.rival = { z: this.playerZ, x: laneCenter(t, myLane - 1), targetX: laneCenter(t, myLane - 1), speed: 0, recover: 0, think: 0, finishTime: -1,
        style: this.rivalStyleOverride ?? RIVAL_STYLE[this.rivalCar!.id] ?? 'cauteloso', mistake: 0, boost: 0 };
    }
    for (let i = 0; i < this.def.traffic; i++) {
      const c: TrafficCar = { z: 0, x: 0, speed: 0, color: '', truck: false, model: 'sedan', hit: false };
      this.spawn(c, this.playerZ + (45 + (i / this.def.traffic) * 300) * SEG_LEN);
      this.traffic.push(c);
    }
    this.police = t.policeSpots.map((z) => ({ spotZ: z, z, x: t.roadW + 1500, speed: 0, state: 'parked' as const, chaseT: 0 }));
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

  say(msg: string, t = 1.6) {
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
    c.model = c.truck ? 'truck' : CAR_MODELS[Math.floor(r() * CAR_MODELS.length)];
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

    const pulling = this.state === 'pullover';
    const cop = pulling ? this.police.find((p) => p.state === 'pull') : undefined;
    const copAhead = !!cop && cop.z > this.playerZ + SEG_LEN * 1.2;
    this.throttle = driving && input.gas;
    this.braking = driving ? input.brake : pulling ? copAhead : this.state !== 'ticket' || this.speed > 0;
    this.steer = driving ? (input.left ? -1 : 0) + (input.right ? 1 : 0) : 0;

    const gearMax = max * GEARS[this.gear];
    if (this.throttle) this.speed += engineAccel(this.car, this.gear, this.speed) * dt;
    else this.speed -= max * 0.06 * dt;
    if (this.speed > gearMax) this.speed -= (this.speed - gearMax) * 2 * dt; // freio-motor
    if (this.braking) this.speed -= max * (this.state === 'crash' ? 2 : pulling ? 0.17 : 0.6) * dt;
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
    } else if (pulling && copAhead) {
      this.x += clamp(this.stopX - this.x, -dt * 1400, dt * 1400); // encosta no acostamento
    }

    // ---- fora da pista ----
    this.shake = 0;
    if (this.scrapeT > 0) {
      this.scrapeT -= dt;
      this.shake = 1;
    }
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
    if (this.state === 'crash') {
      this.timer -= dt;
      if (this.timer <= 0) {
        this.onCrash?.();
        this.resume();
      }
    }
    if (this.state === 'ticket') this.updateOfficer(dt);

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

    // som: troca de marcha, pneus cantando (curva forte ou freada em alta) e trepidação fora da pista
    if (this.gear !== this.lastGear && this.speed > 200) shiftSound();
    this.lastGear = this.gear;
    const offRoad = Math.abs(this.x) > t.roadW + 700;
    const cornering = Math.abs(this.steer) * speedPct * speedPct + Math.abs(pSeg.curve) * speedPct * speedPct * 0.18;
    const screech = driving && !offRoad ? Math.max((cornering - 0.42) * 2.5, this.braking && speedPct > 0.3 ? 0.6 : 0) : 0;
    setTires(screech, offRoad && this.speed > 100 ? 0.4 + speedPct * 0.6 : 0);
    setEngine(Math.max(0.1, this.rpm), this.throttle, true);
  }

  private lastGear = 0;
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
    const rSeg = this.findSegment(r.z);
    const sharp = Math.abs(rSeg.curve) >= 3;
    const gap = (r.z - this.playerZ) / SEG_LEN; // > 0: rival na frente
    let target = 0;
    if (r.finishTime >= 0 || this.state === 'arrived') target = max * 0.25;
    else {
      target = max * this.course.rivalSkill * clamp(1 - gap * 0.0025, 0.85, 1.06);
      // personalidade: o cauteloso alivia nas curvas fechadas, o agressivo arrisca mais
      if (r.style === 'cauteloso' && sharp) target *= 0.93;
      if (r.style === 'agressivo') target *= sharp ? 1 : 1.015;
      if (r.style === 'imprevisivel') {
        if (r.mistake <= 0 && r.boost <= 0 && this.rand() < dt * (sharp ? 0.12 : 0.05)) {
          if (this.rand() < 0.6) {
            r.mistake = 1.3; // errou: sai de traço e perde velocidade
            r.targetX = clamp(r.x + (this.rand() < 0.5 ? -1 : 1) * LANE_W, -this.track.roadW + CAR_W / 2, this.track.roadW - CAR_W / 2);
          } else r.boost = 2.5;
        }
        if (r.mistake > 0) target *= 0.72;
        if (r.boost > 0) target *= 1.06;
      }
    }
    r.mistake = Math.max(0, r.mistake - dt);
    r.boost = Math.max(0, r.boost - dt);

    r.think -= dt;
    if (r.think <= 0 && r.mistake <= 0) {
      r.think = r.style === 'cauteloso' ? 0.2 : 0.25;
      const lanes = this.track.lanes;
      // o cauteloso troca de faixa mais cedo (precisa de mais folga à frente)
      const margin = r.style === 'cauteloso' ? 0.6 : r.style === 'agressivo' ? 0.2 : 0.4;
      let bestX = r.targetX;
      let bestScore = this.laneTTC(r.targetX) + margin; // prefere ficar onde está
      for (let i = 0; i < lanes; i++) {
        const lx = laneCenter(this.track, i);
        if (lx === r.targetX) continue;
        const beside = Math.abs(this.playerZ - r.z) < SEG_LEN * 3 && Math.abs(this.x - lx) < CAR_W;
        if (beside) continue;
        let score = this.laneTTC(lx) * (i < lanes / 2 ? 0.85 : 1);
        // o agressivo fecha a faixa do jogador quando ele vem colado atrás
        if (r.style === 'agressivo' && gap > 0.5 && gap < 7 && Math.abs(this.x - lx) < LANE_W / 2) score += 1.5;
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
    r.x += clamp(r.targetX - r.x, -dt * (r.style === 'agressivo' ? 3000 : 2600), dt * (r.style === 'agressivo' ? 3000 : 2600));
    r.z += r.speed * dt;
  }

  private updatePolice(dt: number) {
    const pz = this.playerZ;
    const max = this.car.maxSpeed;
    this.radar = 0;
    let siren = false;
    for (const p of this.police) {
      if (p.state === 'parked') {
        const d = p.spotZ - pz;
        if (d > 0 && d < 80 * SEG_LEN) this.radar = Math.max(this.radar, 1 - d / (80 * SEG_LEN));
        // a viatura sai do esconderijo logo depois que o jogador passa
        if (d <= -3 * SEG_LEN) {
          if (this.speed * KMH > 150 && this.state === 'drive') {
            p.state = 'chase';
            p.chaseT = 0;
            p.speed = this.speed * 0.6;
            this.say('POLÍCIA!');
          } else p.state = 'done';
        }
      } else if (p.state === 'chase') {
        siren = true;
        this.radar = 1;
        p.chaseT += dt;
        // sai forte e depois só ganha terreno se o jogador estiver abaixo do máximo
        const target = Math.min(max * 0.975, this.speed + 2500);
        p.speed += clamp(target - p.speed, -4000 * dt, 3000 * dt);
        const gapNow = pz - p.z;
        if (gapNow < SEG_LEN * 1.5) p.speed = Math.min(p.speed, this.speed); // não ultrapassa antes da abordagem
        p.z += p.speed * dt;
        // atrás do jogador, pela faixa da esquerda (para ultrapassar)
        p.x += clamp(this.x - CAR_W * 1.3 - p.x, -dt * 2500, dt * 2500);
        const gap = pz - p.z;
        if (this.state === 'drive' && p.chaseT > 2.5 && gap < SEG_LEN * 2.5) this.startPullover(p);
        else if (gap > 60 * SEG_LEN || p.chaseT > 30) {
          p.state = 'done';
          this.say('ESCAPOU!');
        }
      } else if (p.state === 'pull') {
        siren = true;
        this.radar = 1;
        // ultrapassa e se mantém 8 segmentos à frente (visível no para-brisa), reduzindo junto
        const err = pz + SEG_LEN * 8 - p.z;
        p.speed = Math.max(0, this.speed + clamp(err * 1.5, -3000, 3500));
        p.z += p.speed * dt;
        const ahead = p.z > pz + SEG_LEN * 1.2;
        p.x += clamp((ahead ? this.stopX : this.x - CAR_W * 1.3) - p.x, -dt * 2200, dt * 2200);
        if (this.speed <= 0 && p.speed < 80 && Math.abs(err) < SEG_LEN * 0.6) {
          p.state = 'stopped';
          p.speed = 0;
          this.state = 'ticket';
          this.officer = { z: p.z - 300, x: p.x - 700, phase: 'walk', t: 0 };
        }
      } else if (p.state === 'stopped') {
        this.radar = 1;
      } else if (p.state === 'leaving') {
        p.speed = Math.min(9000, p.speed + 2500 * dt);
        p.z += p.speed * dt;
        p.x += clamp(laneCenter(this.track, this.track.lanes - 1) - p.x, -dt * 1500, dt * 1500);
        if (p.z - pz > 300 * SEG_LEN) p.state = 'done';
      }
    }
    setSiren(siren);
  }

  private startPullover(p: Police) {
    p.state = 'pull';
    this.state = 'pullover';
    this.clean = false;
    this.tickets++;
    const kmh = Math.round(this.speed * KMH);
    const limit = this.track.lanes === 4 ? 120 : 100;
    this.fine = { kmh, limit, value: Math.round((150 + (kmh - limit) * 3) / 10) * 10 };
    this.fines += this.fine.value;
    this.stopX = this.track.roadW + 350;
    this.ghost = 99;
    this.say('ENCOSTE O CARRO!', 2.5);
    for (const c of this.traffic) {
      if (Math.abs(c.z - this.playerZ) < 30 * SEG_LEN) this.spawn(c, this.playerZ + (220 + this.rand() * 100) * SEG_LEN);
    }
  }

  // policial caminha até o carro, mostra a multa e volta
  private updateOfficer(dt: number) {
    const o = this.officer;
    if (!o) return;
    o.t += dt;
    const nearZ = this.position + 1150;
    const nearX = this.x - 650;
    if (o.phase === 'walk') {
      o.z += clamp(nearZ - o.z, -dt * 500, dt * 500);
      o.x += clamp(nearX - o.x, -dt * 350, dt * 350);
      if (Math.abs(nearZ - o.z) < 10) {
        o.phase = 'show';
        o.t = 0;
      }
    } else if (o.phase === 'show') {
      if (o.t > 4.5 || (o.t > 1.2 && (input.gas || input.brake))) {
        o.phase = 'back';
        o.t = 0;
      }
    } else {
      const cop = this.police.find((p) => p.state === 'stopped');
      const backZ = cop ? cop.z - 300 : o.z;
      o.z += clamp(backZ - o.z, -dt * 700, dt * 700);
      o.x += clamp((cop ? cop.x - 700 : o.x) - o.x, -dt * 600, dt * 600);
      if (Math.abs(backZ - o.z) < 10) {
        this.officer = null;
        this.fine = null;
        if (cop) cop.state = 'leaving';
        this.state = 'drive';
        this.speed = 0;
        this.gear = 0;
        this.ghost = 1.5;
      }
    }
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
        // raspão: só a lateral encostou (sobreposição pequena) e não é de frente
        const depth = myHalf + half - Math.abs(this.x - c.x);
        if (depth < CAR_W * 0.22 && c.speed > 0) {
          const side = this.x < c.x ? -1 : 1;
          this.x += side * (depth + 60);
          this.speed *= 0.82;
          this.ghost = 0.35;
          this.scrapeT = 0.3;
          scrapeSound();
          continue;
        }
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
