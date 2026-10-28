import { CAR_W, KMH, LANE_W, PLAYER_Z, POLICE_W, SEG_LEN, TRUCK_W } from './config';
import { aeroMul, CARS, G, LAUNCH_BOOST, Powertrain, perfClass, resistAcc, toGame, toMs, type CarLook, type CarSpec, type PerfClass } from './cars';
import { PAINTS } from './paint';
import type { Course, StageDef } from './courses';
import { THEMES, nightTheme, rainTheme, type Theme } from './themes';
import { SPRITES } from './sprites';
import { buildTrack, laneCenter, type Segment, type Track } from './track';
import { input, takeShift } from './input';
import { beep, bumpSound, crashSound, setSteam, tickSound, scrapeSound, setEngine, setEngineProfile, setSiren, setTires, shiftSound } from './audio';
import { clamp, lerp, overlap, rng } from './util';
import { updateTrafficAudio } from './trafficaudio';

// curvatura da pista por unidade de curva (1/m): curva 4 = fechada (~175 km/h a 1 g)
const CURVE_K = 0.00105;
const TRAFFIC_KG = 1300;
const COP_KMH = 245; // máxima da viatura na perseguição
const COP_ACC = 1300; // aceleração da viatura parada (unidades/s², ~32 km/h por segundo)
const BRAKE_BOOST = 1.2; // freios 20% mais fortes que a ficha (pedido de jogabilidade)
const SIGNAL_LEAD = 0.8; // s de pisca antes de trocar de faixa (mão dupla)
const FLASH_T = 2.2; // s do pedido de passagem: sobe o farol, pisca três vezes, abaixa
const COP_SV_KMH = 300;
const COP_SV_ACC = 2300;
const TRUCK_KG = 9000;

export type TrafficModel = 'sedan' | 'hatch' | 'pickup' | 'van' | 'truck';
const CAR_MODELS: TrafficModel[] = ['sedan', 'sedan', 'hatch', 'hatch', 'pickup', 'van'];
// Carros do jogo no meio do trânsito: quanto mais caro, mais raro (como na rua). Peso de cada
// classe no sorteio; GAME_SHARE = fração dos carros (fora caminhões) que são modelos do jogo.
const CLASS_WEIGHT: Record<PerfClass, number> = { D: 10, C: 6, B: 2.2, A: 0.8, S: 0.3 };
const GAME_SHARE = 0.45;
let gamePool: { car: CarSpec; acc: number }[] | null = null;
function pickGameCar(u: number): CarSpec | undefined {
  if (!gamePool) {
    let acc = 0;
    gamePool = CARS.filter((c) => !c.arcadeOnly && !c.pendingArt && c.rear.img && c.rear.frontImg).map((car) => ({ car, acc: (acc += CLASS_WEIGHT[perfClass(car)]) }));
  }
  const total = gamePool[gamePool.length - 1]?.acc ?? 0;
  return gamePool.find((g) => g.acc >= u * total)?.car;
}
// aparência de um carro do trânsito (genérico ou modelo do jogo, com faróis e piscas próprios)
export function trafficLook(t: TrafficCar, front: boolean, night: boolean, flash = false): CarLook {
  const look: CarLook = { color: t.color, front, truck: t.truck, night, model: t.model, signal: t.signal, flash, tilt: t.tilt };
  if (t.car) Object.assign(look, { rear: t.car.rear, paint: t.color, lamps: { up: night || flash ? 1 : 0, on: night || flash, high: flash } });
  return look;
}
export const TRAFFIC_COLORS = ['#2a6fdb', '#e8e8e8', '#3d9b47', '#c9a227', '#7a3db8', '#d9542b', '#555566', '#80c0e0', '#8a2a2a'];

export interface TrafficCar {
  z: number;
  x: number;
  speed: number; // negativo = contramão
  color: string;
  truck: boolean;
  model: TrafficModel;
  car?: CarSpec; // um dos carros do jogo no trânsito (sorteado pela raridade da classe)
  hit: boolean;
  base: number; // velocidade que o motorista gosta de manter
  tx: number; // faixa para onde está indo
  signal: number; // seta: -1 esquerda, 1 direita, 0 desligada
  signalT: number; // tempo de seta antes de começar a trocar de faixa
  moving: boolean;
  think: number;
  panic: number; // contramão de frente para o jogador: 0 tranquilo .. 3 batida iminente (buzina, freia, desvia)
  // depois de uma batida: fumaça do motor (0..1), arrasto de lado (unidades/s) e inclinação do desenho (rad)
  smoke: number;
  slide: number;
  tilt: number;
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
  wasAhead?: boolean;
  boost: number; // tempo restante de uma arrancada (imprevisível)
  pt: Powertrain;
  signal: number; // pisca ligado: -1 esquerdo, 1 direito
  pendX?: number; // faixa para onde vai assim que o pisca tiver dado o aviso
  sigT: number;
  flash: number; // tempo restante do pedido de passagem (farol piscando)
  flashCd: number;
}

// Jeito de pilotar de cada adversário
export type RivalStyle = 'agressivo' | 'cauteloso' | 'imprevisivel';
export const RIVAL_STYLE: Record<string, RivalStyle> = {
  'furia-f4': 'agressivo', 'silber-95': 'cauteloso', 'toro-v12': 'agressivo', 'vortex-zr': 'imprevisivel',
  'furia-tr': 'cauteloso', 'toro-lp5': 'imprevisivel', 'kaze-nx': 'cauteloso', 'serpe-v10': 'agressivo', patrol: 'agressivo', 'patrol-sv': 'agressivo',
};

export interface Police {
  spotZ: number;
  z: number;
  x: number;
  speed: number;
  // parado escondido → perseguindo → encostando o jogador → parado no acostamento → indo embora
  state: 'parked' | 'chase' | 'pull' | 'stopped' | 'leaving' | 'done';
  chaseT: number;
  sv?: boolean; // Diablo SV da polícia (carreira, carros de classe S): bem mais rápida
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
  // batida: tempo desde o impacto, tranco (0..1, sacode a cabine), arrasto de lado e giro do carro,
  // fumaça/vapor do motor (0..1) e dano acumulado das batidas leves (0..1, a fumaça aparece com ele)
  impactT = 0;
  jolt = 0;
  smoke = 0;
  damage = 0;
  private crashSlide = 0;
  private hitCar: TrafficCar | null = null; // com quem bateu (fica à frente, os dois arrastando juntos)
  private crashSpin = 0;
  slip = 0; // derrapagem (0 = com aderência, 1 = escorregando)
  spin = 0; // rodas patinando na arrancada
  balance = 0; // equilíbrio do carro: < 0 sai de frente, > 0 a traseira solta
  yaw = 0; // quanto o carro está "atravessado" (rad, + = virado para dentro da curva à direita)
  drift = 0; // ângulo de derrapagem (rad, + = frente virada para a direita); passou de ~32°, roda
  private spinOut = 0; // animação de rodada
  pt: Powertrain;
  air = 0; // alívio de peso no topo das lombadas (0..1)
  pitch = 0; // inclinação da carroceria acompanhando o chão (subida > 0)
  private airborne = false;
  private landT = 0;
  draft = 0; // vácuo atrás de outro carro (0..1)
  top = 0; // velocidade máxima do jogador no trecho
  rivalTop = 0;
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
  private caughtKmh = 0;
  traffic: TrafficCar[] = [];
  police: Police[] = [];
  officer: Officer | null = null;
  fine: Fine | null = null;
  private stopX = 0; // onde o jogador encosta
  radar = 0;
  signal = 0; // pisca do jogador (automático ao ultrapassar em mão dupla): -1 esquerdo, 1 direito
  private sigX = 0;
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
    this.pt = new Powertrain(car);
    this.rivalStyleOverride = opts.rivalStyle;
    setEngineProfile(car.engine, car.id);
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
        style: this.rivalStyleOverride ?? RIVAL_STYLE[this.rivalCar!.id] ?? 'cauteloso', mistake: 0, boost: 0, pt: new Powertrain(rivalCar),
        signal: 0, sigT: 0, flash: 0, flashCd: 4 };
      this.rival.pt.boost = LAUNCH_BOOST;
    }
    for (let i = 0; i < this.def.traffic; i++) {
      const c: TrafficCar = { z: 0, x: 0, speed: 0, color: '', truck: false, model: 'sedan', hit: false, base: 0, tx: 0, signal: 0, signalT: 0, moving: false, think: 0, panic: 0, smoke: 0, slide: 0, tilt: 0 };
      this.spawn(c, this.playerZ + (45 + (i / this.def.traffic) * 300) * SEG_LEN);
      this.traffic.push(c);
    }
    // na carreira, quem corre de carro classe S é perseguido pela Diablo SV da polícia
    const sv = course.id.startsWith('car-') && perfClass(car) === 'S';
    this.police = t.policeSpots.map((z) => ({ spotZ: z, z, x: t.roadW + 1500, speed: 0, state: 'parked' as const, chaseT: 0, sv }));
  }

  // faróis do rival: à noite ficam acesos (escamoteáveis em cima); de dia sobem só para pedir passagem
  rivalLamps(): { up: number; on: boolean; high: boolean } {
    const night = !!this.def.night;
    const r = this.rival;
    if (!r || r.flash <= 0) return { up: night ? 1 : 0, on: night, high: false };
    const t = FLASH_T - r.flash;
    const up = night ? 1 : clamp(Math.min(t, r.flash) / 0.3, 0, 1);
    const blink = t > 0.35 && r.flash > 0.4 && Math.floor((t - 0.35) / 0.25) % 2 === 0;
    return { up, on: night || blink, high: blink };
  }

  get turboCar() {
    return this.car.curve === 'turbo' || this.car.curve === 'seqturbo';
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
    c.car = !c.truck && r() < GAME_SHARE ? pickGameCar(r()) : undefined;
    if (c.car) {
      // metade na cor de fábrica, o resto numa cor qualquer da paleta
      c.color = r() < 0.5 ? c.car.color : PAINTS[Math.floor(r() * PAINTS.length)].hex;
      // dono de esportivo anda um pouco mais rápido
      c.speed *= { D: 1, C: 1.03, B: 1.08, A: 1.12, S: 1.16 }[perfClass(c.car)];
    }
    if (c.truck) c.speed *= 0.85; // caminhão anda mais devagar
    c.hit = false;
    c.base = c.speed;
    c.tx = laneCenter(this.track, lane);
    c.signal = 0;
    c.signalT = 0;
    c.moving = false;
    c.think = 1 + r() * 3;
    c.panic = 0;
    c.smoke = 0;
    c.slide = 0;
    c.tilt = 0;
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
      // segurando o giro na contagem o turbo já sobe pressão
      if (this.pt.boost < 1) this.pt.boost = lerp(this.pt.boost, input.gas ? LAUNCH_BOOST : 0.1, Math.min(1, dt * 2));
      setEngine(this.rpm, input.gas, true, this.pt.boost < 1 ? this.pt.boost : 0);
      return;
    }

    const driving = this.state === 'drive';
    if (this.state !== 'arrived') this.time += dt;

    // ---- câmbio ----
    if (driving && !this.auto) {
      if (takeShift('shiftUp')) this.pt.shift(Math.min(this.car.gears.length - 1, this.pt.gear + 1));
      if (takeShift('shiftDown')) this.pt.shift(Math.max(0, this.pt.gear - 1));
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

    // ---- relevo: inclinação e "flutuação" no topo das lombadas ----
    const slope = clamp((pSeg.p2.world.y - pSeg.p1.world.y) / SEG_LEN, -0.6, 0.6);
    const ahead = this.track.segments[(pSeg.index + 7) % this.track.segments.length];
    const slopeAhead = clamp((ahead.p2.world.y - ahead.p1.world.y) / SEG_LEN, -0.6, 0.6);
    // a carroceria inclina com o chão entre as rodas (a câmera vai junto, com um pouco de suspensão)
    const cSeg = this.findSegment(this.position);
    const slopeCam = clamp((cSeg.p2.world.y - cSeg.p1.world.y) / SEG_LEN, -0.6, 0.6);
    this.pitch = lerp(this.pitch, (slope + slopeCam) / 2, Math.min(1, dt * 6));
    const pct0 = this.speed / max;
    const lift = clamp(((slope - slopeAhead) * pct0 * pct0 - 0.015) * 12, 0, 1);
    this.air = lerp(this.air, lift, Math.min(1, dt * 8));
    if (this.air > 0.55) this.airborne = true;
    else if (this.airborne && this.air < 0.2) {
      this.airborne = false;
      this.landT = 0.18; // pancada da aterrissagem
    }
    // ---- forças (m/s²): motor, ar + pneus, freio, gravidade ----
    this.draft = lerp(this.draft, driving ? this.draftAhead(this.playerZ, this.x, this.speed) : 0, Math.min(1, dt * 3));
    const surf = this.surface();
    const aero = aeroMul(this.car, this.speed);
    const aDrive = this.pt.step(this.speed, this.throttle, dt, surf * (1 - this.air * 0.6), this.auto);
    this.gear = this.pt.gear;
    const gearMax = max * this.car.gears[this.gear];
    const rpmNow = this.speed / gearMax;
    // vácuo tira até 35% do arrasto; sem acelerar, o freio-motor segura conforme o giro
    const aResist = resistAcc(this.car, this.speed, 1 - 0.35 * this.draft) + (this.throttle ? 0 : 0.6 + 1.2 * clamp(rpmNow, 0, 1));
    const aGrav = (G * slope) / Math.sqrt(1 + slope * slope);
    this.speed += toGame(aDrive - aResist - aGrav) * dt;
    // freio: ~1 g no seco (menos na chuva/neve e no topo das lombadas; a asa ajuda em alta)
    if (this.braking) {
      if (this.state === 'crash') { /* a batida desacelera em updateCrash (arrastando) */ }
      else if (pulling) this.speed -= max * 0.17 * dt;
      else this.speed -= toGame(G * this.car.brakeG * BRAKE_BOOST * surf * aero * (1 - this.air * 0.5)) * dt;
    }
    // acima do corte de giro (reduziu marcha ou embalou na descida): o motor segura
    if (this.speed > gearMax) this.speed -= (this.speed - gearMax) * (slope < -0.05 ? 0.4 : 1.5) * dt;
    this.speed = clamp(this.speed, 0, max * 1.12);
    // patinando, o giro sobe sem o carro andar
    this.spin = lerp(this.spin, this.pt.spin, Math.min(1, dt * 8));
    this.rpm = Math.min(1.02, this.speed / (max * this.car.gears[this.gear]) + this.spin * 0.3);

    // ---- direção e aderência ----
    // Na curva, a força lateral é v² × curvatura (em g, independe do carro). Os pneus seguram
    // até ~1 g (carro, melhorias, piso, asa, lombada), mas essa aderência é dividida: frear forte
    // ou acelerar com tudo em marcha baixa deixa menos para a curva. Acima do limite o carro
    // derrapa; para onde, depende do equilíbrio: sai de frente (escorrega para fora, direção
    // leve) ou solta a traseira (atravessa e pode rodar). O carro NÃO se acalma sozinho: quase
    // não perde velocidade escorregando; quem corrige é o piloto, tirando o pé ou freando.
    const speedPct = this.speed / max;
    const vms = toMs(this.speed);
    const latG = (vms * vms * Math.abs(pSeg.curve) * CURVE_K) / G;
    const tire = this.car.lateralG * surf;
    const lonDrive = clamp(aDrive / (G * tire), 0, 1);
    const lonBrake = this.braking && speedPct > 0.15 ? clamp(this.car.brakeG / this.car.lateralG, 0, 1) : 0;
    const shared = 1 - 0.5 * lonDrive * lonDrive - 0.35 * lonBrake * lonBrake;
    const offGrip = Math.abs(this.x) > t.roadW + 700 ? 0.6 : 1;
    const grip = tire * aero * shared * (1 - this.air * 0.6) * offGrip;
    const demand = latG / grip;
    const excess = Math.max(0, demand - 1);
    // a aderência some rápido e volta mais devagar (o pneu precisa voltar a agarrar)
    const slipTarget = driving ? clamp(excess / 0.35, 0, 1) : 0;
    this.slip = lerp(this.slip, slipTarget, Math.min(1, dt * (slipTarget > this.slip ? 6 : 2.5)));
    // transferência de peso: freando, a frente carrega e a traseira alivia; acelerando com a
    // traseira, a potência solta o carro. Motor central é mais arisco, integral é mais neutro.
    // tração dianteira: acelerar puxa o carro para fora (sai de frente); tirar o pé solta a traseira
    const rwd = this.car.drive === 'traseira';
    const fwd = this.car.drive === 'dianteira';
    const mid = this.car.position !== 'dianteira';
    let bal = (mid ? 0.12 : -0.12) + (rwd ? 0 : fwd ? -0.18 : -0.25);
    if (this.throttle) bal += lonDrive * (rwd ? 1 : fwd ? -0.6 : 0.35) + this.spin * (rwd ? 0.5 : fwd ? -0.3 : 0.1);
    else if (this.braking) bal += mid ? 0.4 : 0.25;
    else bal += mid ? 0.18 : 0.06; // tirar o pé no meio da curva
    this.balance = lerp(this.balance, clamp(bal, -1, 1), Math.min(1, dt * 5));
    const over = clamp(this.balance / 0.5, 0, 1) * this.slip; // traseira escorregando
    const under = this.slip - over; // frente escorregando
    const steerMax = 2700 * this.car.handling * Math.sqrt(speedPct);
    const dir = Math.sign(pSeg.curve);
    if (driving) {
      this.x += this.steer * dt * steerMax * (1 - under * 0.45);
      this.x -= dir * dt * (Math.min(demand, 1) * steerMax * 0.72 + (excess * 1.4 + this.slip * 0.25) * steerMax * (1 - 0.3 * clamp(this.balance / 0.5, 0, 1)));
      this.speed -= toGame(G * (0.05 * under + 0.1 * over)) * dt; // pneu de lado arrasta só um pouco
      // ângulo de derrapagem: a traseira solta gira o carro para dentro da curva (acelerando
      // com tração traseira gira mais); quem segura é o piloto, com contraesterço (volante para
      // o lado contrário) e tirando o pé. Quando os pneus voltam a agarrar o carro se endireita.
      // Atravessou demais (~32°): rodou.
      if (this.spinOut <= 0) {
        const loose = clamp(Math.abs(this.drift) / 0.08 + over, 0, 1) * clamp(speedPct * 2.5, 0, 1);
        const rotIn = dir * over * (1.2 + (rwd && this.throttle ? 1.0 * lonDrive : 0));
        // contraesterço segura bem; esterçar a favor da derrapagem gira mais (só um pouco)
        const steerYaw = this.steer * (Math.sign(this.steer) === -Math.sign(this.drift) ? 2.0 : 0.7) * loose;
        const align = -this.drift * ((over < 0.12 ? 2.6 : 0.5) + (speedPct < 0.15 ? 4 : 0));
        this.drift = clamp(this.drift + (rotIn + steerYaw + align) * dt, -0.8, 0.8);
        // atravessado, o carro escorrega para o lado de fora e perde um pouco de velocidade
        this.x -= Math.sign(this.drift) * dt * Math.abs(this.drift) * steerMax * 0.9;
        this.speed -= toGame(G * 0.25 * Math.abs(this.drift)) * dt;
        if (Math.abs(this.drift) > 0.56) this.spinAround(Math.sign(this.drift));
      }
    } else if (pulling && copAhead) {
      this.x += clamp(this.stopX - this.x, -dt * 1400, dt * 1400); // encosta no acostamento
    }
    // carro atravessado (a câmera gira junto); na rodada dá uma volta rápida para o lado
    if (!driving && this.spinOut <= 0) this.drift = lerp(this.drift, 0, Math.min(1, dt * 4));
    let yawTarget = this.drift + (Math.abs(this.drift) > 0.1 ? (this.rand() - 0.5) * 0.015 : 0);
    if (this.spinOut > 0) {
      this.spinOut -= dt;
      // rodada: continua girando a partir de onde a derrapagem estava, e volta de frente no fim
      const k = Math.min(1, 1 - this.spinOut / 0.9);
      yawTarget = this.spinDir * (0.56 + Math.sin(k * Math.PI) * 0.5) * (1 - k * k);
      if (this.spinOut <= 0) this.drift = 0;
      this.speed -= max * 0.5 * dt;
    }
    this.yaw = lerp(this.yaw, yawTarget, Math.min(1, dt * (this.spinOut > 0 ? 7 : 12)));

    // ---- fora da pista ----
    this.shake = 0;
    this.jolt = Math.max(0, this.jolt - dt * (this.state === 'crash' ? 1.6 : 4));
    if (this.jolt > 0.05) this.shake = 1 + this.jolt * 4;
    // a fumaça da batida vai virando um fio; com dano acumulado, o motor segue soltando vapor
    this.smoke = Math.max(this.damage > 0.45 ? (this.damage - 0.45) * 1.2 : 0, this.smoke - dt * (this.state === 'crash' ? 0.12 : 0.3));
    if (this.scrapeT > 0) {
      this.scrapeT -= dt;
      this.shake = 1;
    }
    if (this.landT > 0) {
      this.landT -= dt;
      this.shake = 1;
    }
    if (this.slip > 0.45 || this.spinOut > 0 || (this.spin > 0.3 && this.speed > 50)) this.shake = 1;
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
    if (driving) this.top = Math.max(this.top, this.speed);
    this.position += this.speed * dt;
    this.bgOffset += (pSeg.curve * this.speed * dt) / SEG_LEN;
    if (this.ghost > 0) this.ghost -= dt;

    this.updateSignal(dt, driving);
    this.updateTraffic(dt);
    updateTrafficAudio(this, dt);
    this.updateRival(dt);
    this.updatePolice(dt);
    if (driving) this.checkCollisions();

    // ---- estados especiais ----
    if (this.state === 'crash') {
      this.updateCrash(dt);
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
        return; // o posto assume o som (senão o motor ficava ligado para sempre)
      }
    }

    // som: troca de marcha, pneus cantando (curva forte ou freada em alta) e trepidação fora da pista
    if (this.gear !== this.lastGear && this.speed > 200) shiftSound();
    this.lastGear = this.gear;
    const offRoad = Math.abs(this.x) > t.roadW + 700;
    // pneu canta só escorregando (derrapagem, rodada, patinando); frear em linha reta não
    const screech = driving && !offRoad ? Math.max(this.slip * 1.4, Math.abs(this.drift) * 2.2, this.spin * 1.2, this.spinOut > 0 ? 1 : 0) : 0;
    const surface = this.def.weather === 'snow' ? 'snow' : this.def.weather === 'rain' ? 'wet' : 'dry';
    setTires(screech, offRoad && this.speed > 100 ? 0.4 + speedPct * 0.6 : 0, surface, driving || this.state === 'arrived' ? speedPct : 0);
    setEngine(Math.max(0.1, this.rpm), this.throttle, true, this.turboCar ? this.pt.boost : 0);
    setSteam(this.smoke);
  }

  private lastGear = 0;
  crashPoint = { x: 0.5, y: 0.5 };

  private spinDir = 1;
  // rodou: perde quase toda a velocidade, mas segue sem contar como batida
  private spinAround(dir: number) {
    this.spinOut = 0.9;
    this.spinDir = dir || 1;
    this.clean = false;
    this.say('RODOU!');
    scrapeSound();
  }

  // batida de verdade: troca de quantidade de movimento com o outro (pelos pesos, quase sem
  // ricochete), tranco, o carro gira e desliza para o lado oposto ao do impacto até parar, o outro
  // é arremessado e roda; capô amassa, solta estilhaços e o motor fumega
  private crash(other?: { v: number; kg: number; side: number; car?: TrafficCar }) {
    this.state = 'crash';
    this.hitCar = null;
    this.timer = 3.4;
    this.clean = false;
    this.crashes++;
    this.gear = 0;
    this.pt.shift(0);
    const side = other?.side || (this.rand() < 0.5 ? -1 : 1);
    const v1 = this.speed, v2 = other?.v ?? 0, m1 = this.car.mass, m2 = other?.kg ?? 1800;
    const rel = Math.max(0, v1 - v2);
    const e = 0.12; // batida de lata: quase toda a energia vira amassado
    this.speed = Math.max(0, (m1 * v1 + m2 * v2 - m2 * e * rel) / (m1 + m2));
    const dv = rel * KMH; // km/h de diferença no impacto
    this.crashSlide = side * (500 + dv * 12);
    this.crashSpin = side * Math.min(0.3, 0.1 + dv / 500); // giro na batida (a câmera vai junto: sem exagero)
    this.impactT = 0;
    this.jolt = 1;
    this.smoke = 1;
    this.damage = 1;
    if (other?.car) {
      const c = other.car;
      c.hit = true;
      c.speed = (m1 * v1 + m2 * v2 + m1 * e * rel) / (m1 + m2);
      c.slide = -side * (300 + dv * (c.truck ? 3 : 10));
      c.smoke = 1;
      // fica à frente, no ponto da batida (e não "dentro" da câmera)
      c.z = Math.max(c.z, this.playerZ + SEG_LEN * 3);
      this.hitCar = c;
      if (v2 < 0) c.speed = Math.min(c.speed, 0) * 0.3; // de frente: os dois param ali mesmo
    }
    this.crashPoint = { x: 0.4 + this.rand() * 0.2 - side * 0.08, y: 0.45 + this.rand() * 0.2 };
    crashSound(Math.min(1, 0.4 + dv / 160));
  }

  // durante a batida: desliza girando, perde velocidade arrastando, a cabine para de sacudir aos poucos
  private updateCrash(dt: number) {
    this.impactT += dt;
    this.speed = Math.max(0, this.speed - this.car.maxSpeed * 0.25 * dt); // lata arrastando: para em ~1,5 s
    this.x += this.crashSlide * dt;
    // não atravessa o carro em que bateu: os dois param juntos, ele à frente
    const hc = this.hitCar;
    if (hc && hc.z - this.playerZ < SEG_LEN * 2.6) this.speed = Math.min(this.speed, Math.max(0, hc.speed));
    this.crashSlide *= Math.exp(-2.6 * dt);
    const t = this.impactT;
    this.drift = this.crashSpin * Math.min(1, t / 0.22) * (t < 1.2 ? 1 : Math.max(0.35, 1 - (t - 1.2) * 0.6));
  }

  // volta à pista depois de batida ou multa
  private resume() {
    this.state = 'drive';
    this.speed = 0;
    this.smoke = 0; // carro novo
    this.damage = 0;
    this.jolt = 0;
    this.drift = 0;
    this.gear = 0;
    this.pt.shift(0);
    this.x = laneCenter(this.track, this.track.lanes - 1);
    this.ghost = 1.5;
    for (const c of this.traffic) {
      if (Math.abs(c.z - this.playerZ) < 12 * SEG_LEN) this.spawn(c, this.playerZ + (200 + this.rand() * 100) * SEG_LEN);
    }
  }

  private updateTraffic(dt: number) {
    const pz = this.playerZ;
    for (const c of this.traffic) {
      if (!c.hit) this.trafficAI(c, dt);
      else {
        // batido: arrasta até parar, escorrega de lado e fica atravessado, fumegando
        c.panic = 0;
        c.speed -= Math.sign(c.speed) * Math.min(Math.abs(c.speed), 3000 * dt);
        c.x += c.slide * dt;
        c.slide *= Math.exp(-2.2 * dt);
        c.tilt += ((Math.sign(c.slide) || Math.sign(c.tilt)) * 0.16 - c.tilt) * Math.min(1, dt * 5);
        c.smoke = Math.max(0.3, c.smoke - dt * 0.08);
      }
      if (!c.hit && c.slide) { // empurrado num raspão: volta ao normal
        c.x += c.slide * dt;
        c.slide *= Math.exp(-5 * dt);
        if (Math.abs(c.slide) < 20) c.slide = 0;
      }
      c.z += c.speed * dt;
      // atrás, some só bem longe (continua visível no retrovisor)
      if (c.z < pz - 95 * SEG_LEN || c.z > pz + 420 * SEG_LEN) this.spawn(c, pz + (280 + this.rand() * 80) * SEG_LEN);
    }
  }

  // Motorista do trânsito: segue o carro da frente (sem atravessá-lo) e, onde há duas faixas
  // no mesmo sentido, troca de faixa dando seta antes, só se a faixa ao lado estiver livre
  private trafficAI(c: TrafficCar, dt: number) {
    const t = this.track;
    const dir = c.speed >= 0 ? 1 : -1;
    let gapAhead = Infinity, aheadSpeed = 0;
    const look = (z: number, x: number, sp: number) => {
      const dz = (z - c.z) * dir;
      if (dz <= 0 || dz > 8 * SEG_LEN || Math.abs(x - c.x) > CAR_W * 0.8 || sp * dir < 0) return;
      if (dz < gapAhead) {
        gapAhead = dz;
        aheadSpeed = sp;
      }
    };
    for (const o of this.traffic) if (o !== c && !o.hit) look(o.z, o.x, o.speed);
    if (dir > 0) look(this.playerZ, this.x, this.speed); // não atropela o jogador parado
    if (this.rival && dir > 0) look(this.rival.z, this.rival.x, this.rival.speed);
    let desired = c.base;
    if (gapAhead < 6 * SEG_LEN && Math.abs(aheadSpeed) < Math.abs(desired)) desired = aheadSpeed * (gapAhead < 2 * SEG_LEN ? 0.85 : 1);
    // contramão com o jogador vindo de frente na mesma faixa: buzina, pisca o farol e, em cima,
    // freia forte e joga o carro para o acostamento
    c.panic = 0;
    if (dir < 0) {
      const gap = c.z - this.playerZ, closing = this.speed - c.speed;
      if (gap > 0 && closing > 500 && Math.abs(this.x - c.x) < CAR_W * 1.1) c.panic = Math.max(0, 3 - gap / closing);
      if (c.panic > 1.5) {
        desired = c.base * 0.2;
        if (c.panic > 1.8) c.x = Math.max(-t.roadW - CAR_W * 0.25, c.x - dt * 1600); // até o acostamento
      }
    }
    c.speed += (desired - c.speed) * Math.min(1, dt * (c.panic > 1.5 ? 3 : 1.2));
    // passado o susto, volta devagar para a sua faixa
    if (c.panic === 0 && !c.moving && !c.signal && Math.abs(c.x - c.tx) > 150) c.x += clamp(c.tx - c.x, -dt * 500, dt * 500);

    if (t.lanes < 4) return; // uma faixa por sentido: não há para onde ir
    if (c.signalT > 0) {
      c.signalT -= dt;
      if (c.signalT <= 0) c.moving = true;
    }
    if (c.moving) {
      c.x += clamp(c.tx - c.x, -dt * 900, dt * 900);
      if (Math.abs(c.tx - c.x) < 5) {
        c.moving = false;
        c.signal = 0;
      }
      return;
    }
    c.think -= dt;
    if (c.think > 0 || c.signal) return;
    c.think = 1.5 + this.rand() * 2.5;
    const blocked = gapAhead < 5 * SEG_LEN && Math.abs(aheadSpeed) < Math.abs(c.base) * 0.92;
    if (!blocked && this.rand() > 0.12) return;
    const lw = (t.roadW * 2) / t.lanes;
    const lane = clamp(Math.floor((c.x + t.roadW) / lw), 0, t.lanes - 1);
    const group = lane < t.lanes / 2 ? 0 : t.lanes / 2;
    const tx = laneCenter(t, group + (1 - (lane - group)));
    const busy = this.traffic.some((o) => o !== c && Math.abs(o.x - tx) < CAR_W && Math.abs(o.z - c.z) < SEG_LEN * 3.5)
      || (Math.abs(this.x - tx) < CAR_W * 1.2 && Math.abs(this.playerZ - c.z) < SEG_LEN * 4)
      || (!!this.rival && Math.abs(this.rival.x - tx) < CAR_W * 1.2 && Math.abs(this.rival.z - c.z) < SEG_LEN * 4);
    if (busy) return;
    c.tx = tx;
    c.signal = tx > c.x ? 1 : -1;
    c.signalT = 1.1;
  }

  // piso: seco, chuva ou neve (multiplica aderência e freio); a tração integral perde menos
  surface(car: CarSpec = this.car) {
    const awd = car.drive === 'integral';
    return this.def.weather === 'snow' ? (awd ? 0.86 : 0.72) : this.def.weather === 'rain' ? (awd ? 0.93 : 0.84) : 1;
  }

  // aderência lateral máxima (em g) de um carro neste piso
  gripG(car: CarSpec = this.car, speed = 0) {
    return car.lateralG * this.surface(car) * aeroMul(car, speed);
  }

  // velocidade máxima (unidades do jogo) para fazer uma curva sem derrapar
  // (com asa a aderência cresce com v²: v² = A / (1 − A·aero/V²), V = 300 km/h)
  cornerSpeed(curve: number, car: CarSpec = this.car, margin = 1) {
    const a = (this.gripG(car) * margin * G) / Math.max(1e-6, Math.abs(curve) * CURVE_K);
    const v2 = a / Math.max(0.2, 1 - (a * car.aero) / 83.3 ** 2);
    return (Math.sqrt(v2) * 3.6) / KMH;
  }

  // vácuo: há um carro logo à frente na mesma faixa, no mesmo sentido?
  draftAhead(z: number, x: number, speed: number) {
    let best = 0;
    const consider = (cz: number, cx: number, cs: number) => {
      const dz = cz - z;
      if (cs <= 0 || dz < SEG_LEN * 0.8 || dz > SEG_LEN * 7 || Math.abs(cx - x) > CAR_W * 0.6 || speed < 4000) return;
      best = Math.max(best, 1 - (dz - SEG_LEN * 0.8) / (SEG_LEN * 6.2));
    };
    for (const c of this.traffic) if (!c.hit) consider(c.z, c.x, c.speed);
    if (this.rival && this.rival.z !== z) consider(this.rival.z, this.rival.x, this.rival.speed);
    if (z !== this.playerZ) consider(this.playerZ, this.x, this.speed);
    return best;
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

  // pisca automático do jogador, só em mão dupla: esquerdo ao sair rumo à contramão para
  // ultrapassar, direito ao voltar para a sua faixa; desliga quando a manobra termina
  private updateSignal(dt: number, driving: boolean) {
    const vx = dt > 0 ? (this.x - this.sigX) / dt : 0;
    this.sigX = this.x;
    const prev = this.signal;
    if (this.track.lanes !== 2 || !driving || this.speed * KMH < 30) this.signal = 0;
    else {
      const x = this.x, lw = this.track.roadW; // na mão dupla cada faixa tem roadW
      if (this.signal === 0) {
        // indo em direção à faixa central (não só corrigindo dentro da faixa)
        if (x > 0 && x < lw * 0.42 && vx < -500) this.signal = -1;
        else if (x < 0 && x > -lw * 0.42 && vx > 500) this.signal = 1;
      } else if (this.signal < 0 ? x < -lw * 0.25 || x > lw * 0.6 : x > lw * 0.25 || x < -lw * 0.6) this.signal = 0;
    }
    if (this.signal !== prev) tickSound();
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
      // elástico: na frente, o rival alivia (os mais fracos aliviam mais, dando chance de
      // recuperar depois de uma batida); atrás, acelera um pouco
      const skill = this.course.rivalSkill;
      const floor = clamp(0.85 - (1 - skill) * 1.6, 0.62, 0.85);
      target = max * skill * clamp(1 - gap * 0.0025, floor, 1.06);
      // limite de curva igual ao do jogador: olha as próximas curvas e alivia antes de
      // entrar (o agressivo vai mais perto do limite, o cauteloso com folga)
      const segs = this.track.segments;
      let curveAhead = 0;
      for (let k = 0; k < 10; k++) curveAhead = Math.max(curveAhead, Math.abs(segs[(rSeg.index + k) % segs.length].curve));
      // nunca acima do limite físico (o rival não derrapa); os mais fracos contornam mais devagar
      const nerve = r.style === 'agressivo' ? 1 : r.style === 'cauteloso' ? 0.9 : 0.96;
      target = Math.min(target, this.cornerSpeed(curveAhead, this.rivalCar, nerve) * (0.86 + 0.14 * skill));
      if (r.style === 'agressivo') target *= sharp ? 1 : 1.015;
      // vácuo atrás de outro carro
      target *= 1 + 0.04 * this.draftAhead(r.z, r.x, r.speed);
      // ultrapassado agora há pouco: o agressivo e o imprevisível devolvem a pressão
      if (r.wasAhead && gap < 0 && gap > -3 && r.style !== 'cauteloso' && r.boost <= 0) r.boost = 2;
      if (r.boost > 0 && r.style !== 'imprevisivel') target *= 1.05;
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
    r.wasAhead = gap > 0;

    r.think -= dt;
    if (r.think <= 0 && r.mistake <= 0) {
      r.think = r.style === 'cauteloso' ? 0.2 : 0.25;
      const lanes = this.track.lanes;
      // o cauteloso troca de faixa mais cedo (precisa de mais folga à frente)
      const margin = r.style === 'cauteloso' ? 0.6 : r.style === 'agressivo' ? 0.2 : 0.4;
      // nota de cada faixa: tempo livre à frente, com ajustes de estratégia
      const laneScore = (lx: number, i: number) => {
        let score = this.laneTTC(lx) * (i < lanes / 2 ? 0.85 : 1);
        const playerLane = Math.abs(this.x - lx) < LANE_W / 2;
        // o agressivo fecha a faixa do jogador quando ele vem colado atrás
        if (r.style === 'agressivo' && gap > 0.5 && gap < 7 && playerLane) score += 1.5;
        // jogador logo à frente: não fica preso atrás dele, prepara a ultrapassagem pelo lado
        if (gap < -0.5 && gap > -9) score += playerLane ? -2 : 0.6;
        return score;
      };
      let bestX = r.targetX;
      let bestScore = laneScore(r.targetX, lanes - 1) + margin; // prefere ficar onde está
      for (let i = 0; i < lanes; i++) {
        const lx = laneCenter(this.track, i);
        if (lx === r.targetX) continue;
        const beside = Math.abs(this.playerZ - r.z) < SEG_LEN * 3 && Math.abs(this.x - lx) < CAR_W;
        if (beside) continue;
        const score = laneScore(lx, i);
        if (score > bestScore) {
          bestScore = score;
          bestX = lx;
        }
      }
      if (bestX !== r.targetX && lanes === 2 && r.pendX === undefined) {
        // mão dupla: liga o pisca antes de sair para ultrapassar (esquerdo) e antes de voltar (direito)
        r.pendX = bestX;
        r.sigT = SIGNAL_LEAD;
        r.signal = Math.sign(bestX - r.x);
      } else if (r.pendX === undefined) r.targetX = bestX;
      if (bestScore < 1) target = Math.min(target, max * 0.35);
    }
    if (r.pendX !== undefined) {
      r.sigT -= dt;
      if (r.sigT <= 0 || r.mistake > 0) {
        r.targetX = r.pendX;
        r.pendX = undefined;
      } else if (this.laneTTC(r.targetX) < 1) target = Math.min(target, max * 0.5); // esperando o aviso: não encosta em ninguém
    }
    // desliga o pisca ao terminar a troca de faixa
    if (r.signal && r.pendX === undefined && Math.abs(r.targetX - r.x) < 120) r.signal = 0;
    // pedido de passagem: colado atrás do jogador, na mesma faixa e mais rápido, pisca o farol
    r.flash = Math.max(0, r.flash - dt);
    r.flashCd = Math.max(0, r.flashCd - dt);
    const behindGap = (this.playerZ - r.z) / SEG_LEN;
    if (r.flashCd <= 0 && r.finishTime < 0 && this.state === 'drive' && behindGap > 1.2 && behindGap < 9 &&
        Math.abs(r.x - this.x) < CAR_W && r.speed > this.speed * 0.97 && target > this.speed) {
      r.flash = FLASH_T;
      r.flashCd = 7 + this.rand() * 5;
    }
    if (r.recover > 0) {
      r.recover -= dt;
      target = Math.min(target, max * 0.2);
    }
    // acelera no máximo o que o carro dele consegue (com arrasto) e freia ~1,1 g
    const accel = target > r.speed;
    const aDrive = r.pt.step(r.speed, accel, dt, this.surface(this.rivalCar));
    if (accel) {
      const acc = toGame(aDrive - resistAcc(this.rivalCar, r.speed, 1 - 0.35 * this.draftAhead(r.z, r.x, r.speed)));
      r.speed = Math.min(target, r.speed + Math.max(0, acc) * dt);
    } else r.speed = Math.max(target, r.speed - toGame(G * this.rivalCar.brakeG * BRAKE_BOOST * this.surface(this.rivalCar) * aeroMul(this.rivalCar, r.speed)) * dt);
    r.x += clamp(r.targetX - r.x, -dt * (r.style === 'agressivo' ? 3000 : 2600), dt * (r.style === 'agressivo' ? 3000 : 2600));
    r.z += r.speed * dt;
    if (r.finishTime < 0) this.rivalTop = Math.max(this.rivalTop, r.speed);
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
          // de viatura o jogador é colega: o radar não persegue
          if (this.speed * KMH > 150 && this.state === 'drive' && !this.car.id.startsWith('patrol')) {
            this.caughtKmh = Math.round(this.speed * KMH); // velocidade da infração (vale para a multa)
            p.state = 'chase';
            p.chaseT = 0;
            p.speed = this.speed * 0.45; // saindo do esconderijo
            this.say('POLÍCIA!');
          } else p.state = 'done';
        }
      } else if (p.state === 'chase') {
        siren = true;
        this.radar = 1;
        p.chaseT += dt;
        // viatura preparada (V8 de interceptador): ~245 km/h de máxima e aceleração de sedã,
        // que cai com a velocidade; um esportivo de pé no fundo consegue fugir
        // a SV: ~300 km/h e o dobro do fôlego (o sedã continua como está)
        const copMax = (p.sv ? COP_SV_KMH : COP_KMH) / KMH;
        const target = Math.min(copMax, this.speed + 2500);
        const acc = (p.sv ? COP_SV_ACC : COP_ACC) * Math.max(0.15, 1 - p.speed / copMax);
        p.speed += clamp(target - p.speed, -4000 * dt, acc * dt);
        const gapNow = pz - p.z;
        if (gapNow < SEG_LEN * 1.5) p.speed = Math.min(p.speed, this.speed); // não ultrapassa antes da abordagem
        p.z += p.speed * dt;
        // atrás do jogador, pela faixa da esquerda (para ultrapassar)
        p.x += clamp(this.x - CAR_W * 1.3 - p.x, -dt * 2500, dt * 2500);
        const gap = pz - p.z;
        if (this.state === 'drive' && p.chaseT > 4 && gap < SEG_LEN * 2) this.startPullover(p);
        else if (gap > 160 * SEG_LEN || p.chaseT > 25) { // ~220 m de vantagem (ou desistiu)
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
    const kmh = Math.max(this.caughtKmh, Math.round(this.speed * KMH));
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
    this.pt.shift(0);
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
        // raspão: só a lateral encostou (sobreposição pequena); na contramão só de raspão mesmo
        const depth = myHalf + half - Math.abs(this.x - c.x);
        const side = this.x < c.x ? -1 : 1;
        if (depth < CAR_W * (c.speed > 0 ? 0.22 : 0.12)) {
          this.x += side * (depth + 60);
          this.speed *= c.speed > 0 ? 0.82 : 0.65;
          this.ghost = 0.35;
          this.scrapeT = c.speed > 0 ? 0.3 : 0.45;
          this.jolt = Math.max(this.jolt, c.speed > 0 ? 0.3 : 0.5);
          this.damage = Math.min(1, this.damage + (c.speed > 0 ? 0.06 : 0.12));
          c.slide = -side * 500; // o outro também é empurrado de lado
          scrapeSound();
          continue;
        }
        // de frente com quem vem na contramão, ou forte demais: batida
        const dv = (this.speed - c.speed) * KMH;
        if (c.speed < 0 || dv > (c.truck ? 70 : 110)) {
          this.crash({ v: c.speed, kg: c.truck ? TRUCK_KG : TRAFFIC_KG, side, car: c });
          return;
        }
        // batida leve na traseira: troca de quantidade de movimento conforme os pesos
        // (o caminhão quase não sente; um carro pequeno é empurrado para a frente)
        const m1 = this.car.mass, m2 = c.truck ? TRUCK_KG : TRAFFIC_KG, e = 0.3;
        const p = m1 * this.speed + m2 * c.speed;
        const rel = this.speed - c.speed;
        this.speed = Math.max(0, (p - m2 * e * rel) / (m1 + m2));
        c.speed = (p + m1 * e * rel) / (m1 + m2);
        c.z = pz + SEG_LEN * 1.1;
        this.x += side * Math.min(depth, 200) * 0.4;
        this.ghost = 0.4;
        this.scrapeT = 0.25 + dv / 200;
        if (dv > 45) this.clean = false;
        // batida leve: tranco, amassadinho (dano acumula e o motor começa a fumegar) e o outro fica marcado
        this.jolt = Math.max(this.jolt, Math.min(0.7, 0.25 + dv / 120));
        this.damage = Math.min(1, this.damage + Math.min(0.35, 0.08 + dv / 140));
        if (dv > 30) c.smoke = Math.max(c.smoke, 0.4);
        bumpSound(Math.min(1, 0.3 + dv / 100));
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
        this.crash({ v: 0, kg: 1800, side: this.x < p.x ? -1 : 1 });
        return;
      }
    }

    // encostou no rival: o mais leve é o que mais sai do lugar
    if (r && this.ghost <= 0 && Math.abs(r.z - pz) < SEG_LEN * 0.8 && overlap(this.x, myHalf, r.x, myHalf)) {
      const m1 = this.car.mass, m2 = this.rivalCar!.mass;
      const push = (CAR_W - Math.abs(this.x - r.x)) / 2 + 20;
      const side = this.x < r.x ? -1 : 1;
      this.x += (side * push * 2 * m2) / (m1 + m2);
      r.x -= (side * push * 2 * m1) / (m1 + m2);
      const behind = r.z - pz; // > 0: rival na frente
      const rel = this.speed - r.speed;
      if (Math.abs(behind) > SEG_LEN * 0.35 && Math.sign(behind) === Math.sign(rel)) {
        // um bateu na traseira do outro: troca de velocidade pelos pesos
        const p = m1 * this.speed + m2 * r.speed, e = 0.4;
        this.speed = (p - m2 * e * rel) / (m1 + m2);
        r.speed = (p + m1 * e * rel) / (m1 + m2);
        r.z = pz + Math.sign(behind) * SEG_LEN * 0.85;
        this.scrapeT = 0.3;
        scrapeSound();
      } else {
        this.speed *= 0.985;
        r.speed *= 0.985;
        if (this.scrapeT <= 0) scrapeSound();
        this.scrapeT = 0.2;
      }
    }
  }
}
