import { CAR_W, KMH, LANE_W, PLAYER_Z, POLICE_W, SEG_LEN, TRUCK_W } from './config';
import { aeroMul, CARS, G, LAUNCH_BOOST, Powertrain, perfClass, resistAcc, toGame, toMs, type CarLook, type CarSpec, type PerfClass, SHIFT_T } from './cars';
import { PAINTS } from './paint';
import type { Course, StageDef } from './courses';
import { THEMES, blendTheme, fogTheme, nightTheme, rainTheme, sunsetTheme, type Theme } from './themes';
import { SPRITES } from './sprites';
import { buildTrack, laneCenter, type Segment, type Track } from './track';
import { input, takeShift } from './input';
import { beep, radarBeep, bumpSound, crashSound, landSound, stoneSound, setTunnel, setSteam, tickSound, scrapeSound, setEngine, setEngineProfile, setSiren, setTires, shiftSound } from './audio';
import { clamp, lerp, overlap, rng } from './util';
import { updateTrafficAudio } from './trafficaudio';
import { GHOST_DT, ghostAt, type Ghost } from './records';

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
  // freando: mais devagar do que gosta de andar (trânsito na mesma mão, atrás de alguém ou em pânico)
  const brake = t.speed > 0 && t.speed < t.base * 0.9;
  const look: CarLook = { color: t.color, front, truck: t.truck, night, model: t.model, signal: t.signal, flash, tilt: t.tilt, brake };
  if (t.car) Object.assign(look, { rear: t.car.rear, paint: t.color, lamps: { up: night || flash ? 1 : 0, on: night || flash, high: flash } });
  return look;
}
// gravidade de verdade (9,81 m/s², ~144 unidades por metro)
const GRAV = (9.81 * 3.6) / KMH;
// alcance do detector de radar: ~500 m (uns 9 s a 200 km/h) até a viatura escondida
const RADAR_RANGE = 360 * SEG_LEN;
// o relevo da pista é exagerado (rampas de 30-60%): seguindo o chão ao pé da letra o carro
// decolava a 6 m de altura. Pneus e suspensão absorvem a subida brusca: no topo, o carro só leva
// para cima até ~3,5 m/s de velocidade vertical (salto de palmo a meio metro, voo de meio segundo
// a um segundo, mais se a pista despencar logo depois)
const VY_UP = 3.5 * 144;
const RELIEF = 0.4;
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
  rel?: number; // posição em relação ao jogador no quadro anterior (conta ultrapassagens)
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
  private dayTheme: Theme;
  private duskStep = -1;
  sun = 0; // pôr do sol: 1 = sol alto no começo, 0 = já se pôs
  inTunnel = 0; // 0..1, sobe ao entrar no túnel (eco do ronco, luz)
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
  // marcas no para-brisa que ficam até trocar de carro: trinca de batida, estrela de pedra
  // (x, y em fração do para-brisa; size 0..1; seed para o desenho)
  glass: { x: number; y: number; size: number; seed: number; star: boolean }[] = [];
  overheat = false;
  // passagem gravada (posição a cada GHOST_DT do relógio do trecho) e o fantasma da melhor
  trace: { z: number[]; x: number[] } = { z: [], x: [] };
  ghostRun: Ghost | null = null; // fantasma (melhor passagem do trecho)
  showGhost = true; // o jogador pode esconder o fantasma (menu de pausa)
  ghostPos: { z: number; x: number; ghost: true } | null = null; // motor batido esquentando: perde força e o ponteiro da água sobe
  private stoneT = 0;
  // contagens do trecho para os desafios e as conquistas
  stats = { passes: 0, near: 0, brakeT: 0, airT: 0, bestAir: 0, scrapes: 0, tunnels: 0 };
  challenges: import('./challenges').Challenge[] = [];
  private wasTunnel = false;
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
  airborne = false;
  lift = 0; // altura das rodas acima do chão no salto (unidades do mundo)
  private carY = 0; // altura do carro (unidades do mundo)
  private vy = 0; // velocidade vertical (unidades/s)
  private prevGy: number | null = null;
  private prevVyG = 0;
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
  private radarBeepT = 0;
  private radarBand = 0;
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
    // cópia: o pôr do sol acende a noite no meio do trecho sem mexer na definição do percurso
    this.def = { ...course.stages[stageIdx] };
    const base = THEMES[this.def.theme];
    this.dayTheme = base;
    this.theme = this.def.night ? nightTheme(base) : this.def.weather === 'rain' ? rainTheme(base) : this.def.weather === 'fog' ? fogTheme(base) : base;
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
    // carros que ficam para trás só somem bem longe (retrovisor), então o trânsito tem 20% a
    // mais de carros para a estrada à frente continuar tão cheia quanto antes
    const nTraffic = Math.round(this.def.traffic * 1.2);
    for (let i = 0; i < nTraffic; i++) {
      const c: TrafficCar = { z: 0, x: 0, speed: 0, color: '', truck: false, model: 'sedan', hit: false, base: 0, tx: 0, signal: 0, signalT: 0, moving: false, think: 0, panic: 0, smoke: 0, slide: 0, tilt: 0 };
      this.spawn(c, this.playerZ + (45 + (i / nTraffic) * 300) * SEG_LEN);
      this.traffic.push(c);
    }
    // na carreira, quem corre de carro classe S é perseguido pela Diablo SV da polícia
    const sv = course.id.startsWith('car-') && perfClass(car) === 'S';
    this.police = t.policeSpots.map((z) => ({ spotZ: z, z, x: t.roadW + 1500, speed: 0, state: 'parked' as const, chaseT: 0, sv }));
  }

  // faróis do rival: à noite ficam acesos (escamoteáveis em cima); de dia sobem só para pedir passagem
  rivalLamps(): { up: number; on: boolean; high: boolean } {
    const night = !!this.def.night || this.inTunnel > 0.5; // no túnel também acende
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

  // marca nova no para-brisa (pedra: estrelinha; batida: trinca maior)
  crackGlass(size: number, star: boolean) {
    if (this.glass.length >= 8) return;
    const r = this.rand;
    this.glass.push({ x: 0.15 + r() * 0.7, y: star ? 0.15 + r() * 0.55 : 0.35 + r() * 0.4, size, seed: Math.floor(r() * 1e6), star });
  }

  // pedrinha atirada pelo pneu do caminhão da frente: colado atrás dele e rápido, às vezes
  // uma pedra estala no vidro e deixa uma estrelinha
  private stones(dt: number) {
    if (this.speed * KMH < 90) return;
    const pz = this.playerZ;
    const behindTruck = this.traffic.some((c) => c.truck && c.speed > 0 && c.z - pz > 0 && c.z - pz < SEG_LEN * 4 && Math.abs(c.x - this.x) < TRUCK_W * 0.6);
    if (!behindTruck) return;
    this.stoneT += dt;
    if (this.stoneT > 1.5 && this.rand() < dt * 0.25) {
      this.stoneT = 0;
      this.crackGlass(0.25 + this.rand() * 0.25, true);
      stoneSound();
    }
  }

  // pôr do sol ao longo do trecho (céu, chão, faróis) e o túnel (eco no ronco)
  private updateAmbient(dt: number, seg: Segment) {
    if (this.def.dusk) {
      const p = this.progress;
      // dia -> pôr do sol (até 55%) -> noite (a partir de 85%); em degraus, para não recriar texturas a cada quadro
      const step = Math.round(p * 24);
      if (step !== this.duskStep) {
        this.duskStep = step;
        const q = step / 24;
        const sunset = sunsetTheme(this.dayTheme), night = nightTheme(this.dayTheme);
        this.theme = q < 0.55 ? blendTheme(this.dayTheme, sunset, q / 0.55) : blendTheme(sunset, night, Math.min(1, (q - 0.55) / 0.3));
        this.def.night = q > 0.72;
      }
      this.sun = clamp(1 - p / 0.75, 0, 1);
    }
    if (this.state === 'drive') {
      if (this.braking && this.speed > 0) this.stats.brakeT += dt;
      if (this.airborne) {
        this.stats.airT += dt;
        this.stats.bestAir = Math.max(this.stats.bestAir, this.stats.airT);
      } else this.stats.airT = 0;
    }
    if (seg.tunnel && !this.wasTunnel) this.stats.tunnels++;
    this.wasTunnel = !!seg.tunnel;
    const inT = seg.tunnel ? 1 : 0;
    this.inTunnel += (inT - this.inTunnel) * Math.min(1, dt * 4);
    setTunnel(this.inTunnel);
  }

  // altura do chão em z
  groundY(z: number) {
    const s = this.findSegment(z);
    return lerp(s.p1.world.y, s.p2.world.y, (z % SEG_LEN) / SEG_LEN);
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
    c.rel = undefined;
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
    this.updateAmbient(dt, pSeg);
    while (this.state !== 'arrived' && this.trace.z.length * GHOST_DT <= this.time) {
      this.trace.z.push(Math.round(this.playerZ));
      this.trace.x.push(Math.round(this.x));
    }
    const gp = this.showGhost && this.ghostRun && ghostAt(this.ghostRun, this.time);
    this.ghostPos = gp ? { z: gp.z, x: gp.x, ghost: true } : null;

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
    // a carroceria inclina com o chão entre as rodas (a câmera vai junto, com um pouco de suspensão)
    const cSeg = this.findSegment(this.position);
    const slopeCam = clamp((cSeg.p2.world.y - cSeg.p1.world.y) / SEG_LEN, -0.6, 0.6);
    // no ar, o carro aponta para onde está indo (sobe de nariz e vai embicando na queda)
    const pitchTo = this.airborne ? clamp(this.vy / Math.max(this.speed, 1), -0.6, 0.6) : (slope + slopeCam) / 2;
    this.pitch = lerp(this.pitch, pitchTo, Math.min(1, dt * (this.airborne ? 3 : 6)));
    // ---- salto: o carro é um corpo com velocidade vertical própria. Segue o chão enquanto a
    // gravidade dá conta; num topo de lombada que cai mais rápido do que ela puxa, decola,
    // voa em parábola e cai com uma pancada proporcional à velocidade de queda ----
    if (dt > 0) {
      // o voo é calculado no relevo "de verdade" (a pista desenhada exagera as rampas ~2,5×);
      // a altura resultante (lift) vale em unidades do mundo, sem exagero
      const gy = this.groundY(this.position) * RELIEF;
      // posição mudada de uma vez (reinício, teste): recomeça colado no chão
      if (this.prevGy !== null && Math.abs(gy - this.prevGy) > 400 * RELIEF) this.prevGy = null;
      const vyG = this.prevGy === null ? 0 : (gy - this.prevGy) / dt;
      if (this.prevGy === null) {
        this.carY = gy;
        this.vy = 0;
      }
      this.prevGy = gy;
      this.vy -= GRAV * dt;
      this.carY += this.vy * dt;
      if (this.carY <= gy) {
        const impact = vyG - this.vy; // velocidade com que bate no chão (unidades/s)
        if (this.airborne && impact > 250) {
          this.landT = Math.min(0.45, 0.12 + impact / 5000);
          landSound(Math.min(1, 0.2 + impact / 2500)); // pneus quicando no asfalto
          if (impact > 2600) this.damage = Math.min(1, this.damage + (impact - 2600) / 20000);
          if (impact > 3200 && this.rand() < 0.5) this.crackGlass(Math.min(1, (impact - 2600) / 4000), false);
          this.speed *= 1 - Math.min(0.12, impact / 30000); // a pancada rouba um pouco de embalo
        }
        this.carY = gy;
        this.vy = Math.min(vyG, VY_UP);
      }
      this.lift = this.carY - gy;
      if (this.lift > 12) this.airborne = true;
      else if (this.lift <= 0) this.airborne = false;
      // alívio de peso: quanto o chão "foge" para baixo (perto do topo, antes de decolar)
      const relief = clamp(-(vyG - this.prevVyG) / dt / GRAV, 0, 1);
      this.prevVyG = vyG;
      this.air = this.airborne ? 1 : lerp(this.air, relief * 0.8, Math.min(1, dt * 8));
    }
    // ---- forças (m/s²): motor, ar + pneus, freio, gravidade ----
    this.draft = lerp(this.draft, driving ? this.draftAhead(this.playerZ, this.x, this.speed) : 0, Math.min(1, dt * 3));
    const surf = this.surface();
    const aero = aeroMul(this.car, this.speed);
    // radiador amassado: acima de 60% de dano o motor esquenta e perde até ~14% da força
    const hurt = this.damage > 0.6 ? 1 - (this.damage - 0.6) * 0.35 : 1;
    if (this.damage > 0.6 && !this.overheat && this.state === 'drive') {
      this.overheat = true;
      this.message = 'MOTOR ESQUENTANDO!';
      this.messageT = 2.5;
    }
    const aDrive = this.pt.step(this.speed, this.throttle, dt, surf * (1 - this.air * 0.6), this.auto) * hurt;
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
    const rpmGear = Math.min(1.02, this.speed / (max * this.car.gears[this.gear]) + this.spin * 0.3);
    // troca de marcha de câmbio manual: embreagem pisada, o giro cai devagar no começo e depressa
    // depois, e casa com a marcha nova quando ela entra (na redução, sobe no "punta-tacco")
    if (this.gear !== this.shownGear) {
      const up = this.gear > this.shownGear;
      this.shiftFrom = this.rpm;
      this.shiftDur = up ? SHIFT_T : 0.25;
      this.shiftLeft = this.shiftDur;
      this.shownGear = this.gear;
    }
    if (this.shiftLeft > 0) {
      this.shiftLeft -= dt;
      const u = clamp(this.shiftLeft / this.shiftDur, 0, 1);
      this.rpm = rpmGear + (this.shiftFrom - rpmGear) * u * u * (3 - 2 * u);
    } else this.rpm = rpmGear;

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
    if (driving) this.stones(dt);
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
    const screech = driving && !offRoad ? Math.max(this.slip * 1.4, Math.abs(this.drift) * 2.2, this.spin * 0.55, this.spinOut > 0 ? 1 : 0) : 0;
    const surface = this.def.weather === 'snow' ? 'snow' : this.def.weather === 'rain' ? 'wet' : 'dry';
    setTires(screech, offRoad && this.speed > 100 ? 0.4 + speedPct * 0.6 : 0, surface, driving || this.state === 'arrived' ? speedPct : 0);
    // durante a troca o pé sai do acelerador: o ronco perde carga até a marcha entrar
    setEngine(Math.max(0.1, this.rpm), this.throttle && this.pt.shiftT <= 0, true, this.turboCar ? this.pt.boost : 0);
    setSteam(this.smoke);
  }

  private lastGear = 0;
  private shownGear = 0; // marcha que o giro já acompanha (durante a troca, o giro faz a transição)
  private shiftFrom = 0;
  private shiftDur = 0;
  private shiftLeft = 0;
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
    this.glass = [];
    this.overheat = false;
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
      // ultrapassagem (passou de à frente para atrás) e raspão de quem vem na contramão
      const rel = c.z - pz;
      if (c.rel !== undefined && c.rel > 0 && rel <= 0 && !c.hit && this.state === 'drive') {
        if (c.base > 0) this.stats.passes++;
        else if (Math.abs(c.x - this.x) < CAR_W * 1.35) this.stats.near++;
      }
      c.rel = rel;
      // atrás, some só bem longe (continua visível no retrovisor)
      if (c.z < pz - 200 * SEG_LEN || c.z > pz + 420 * SEG_LEN) this.spawn(c, pz + (280 + this.rand() * 80) * SEG_LEN);
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
  private laneTTC(laneX: number, v = this.rival!.speed) {
    const r = this.rival!;
    let best = Infinity;
    const check = (z: number, x: number, speed: number) => {
      const dz = z - r.z;
      if (dz <= 0 || dz > 50 * SEG_LEN || Math.abs(x - laneX) > CAR_W * 1.1) return;
      const closing = v - speed;
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
    // limite de curva (depois de todos os ajustes: vácuo, pressão e erro não passam da
    // aderência): para cada curva até ~80 segmentos à frente, a velocidade de contorno com
    // folga (o rival não derrapa como o jogador) e o quanto ele consegue frear até chegar nela
    if (r.finishTime < 0 && this.state !== 'arrived') {
      const segs = this.track.segments;
      const nerve = r.style === 'agressivo' ? 0.93 : r.style === 'cauteloso' ? 0.82 : 0.88;
      const brakeA = toGame(G * this.rivalCar.brakeG * BRAKE_BOOST * this.surface(this.rivalCar)) * 0.6;
      const skill = this.course.rivalSkill;
      const into = (r.z % SEG_LEN) / SEG_LEN;
      for (let k = 0; k < 80; k++) {
        const cv = Math.abs(segs[(rSeg.index + k) % segs.length].curve);
        if (cv < 0.5) continue;
        const vc = this.cornerSpeed(cv, this.rivalCar, nerve) * (0.9 + 0.1 * skill);
        const dist = Math.max(0, k - into) * SEG_LEN;
        target = Math.min(target, Math.sqrt(vc * vc + 2 * brakeA * dist));
      }
    }
    const want = target; // o que ele quer andar (antes de ficar preso atrás de alguém)
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
        // com a velocidade que ele quer (atrás de alguém mais lento, a faixa dele "fecha")
        let score = this.laneTTC(lx, Math.max(r.speed, want)) * (i < lanes / 2 ? 0.85 : 1);
        // mão dupla: só sai para a contramão com pista livre de verdade (tempo para ultrapassar
        // e voltar antes de quem vem de frente)
        if (lanes === 2 && lx < 0 && Math.abs(r.x - lx) > LANE_W / 2 && score < 4.5) score = -1;
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
    // na contramão com alguém vindo de frente perto: volta já para a própria faixa (sem esperar
    // o pisca) e alivia; se a faixa dele estiver ocupada ao lado, freia forte para se encaixar
    if (this.track.lanes === 2 && r.x < 0 && r.finishTime < 0) {
      const home = laneCenter(this.track, 1);
      if (this.laneTTC(r.x) < 2.6) {
        r.pendX = undefined;
        r.targetX = home;
        r.signal = 1;
        if (this.laneTTC(home) < 0.8) target = Math.min(target, r.speed * 0.6);
      } else if (r.pendX === undefined && r.targetX < 0 && this.laneTTC(home, Math.max(r.speed, want)) > 4) {
        // ultrapassagem feita (ou nada à frente na faixa dele): volta para a mão, com o pisca
        r.pendX = home;
        r.sigT = SIGNAL_LEAD;
        r.signal = 1;
      }
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
    if (r.flashCd <= 0 && r.finishTime < 0 && this.state === 'drive' && behindGap > 0.6 && behindGap < 9 &&
        Math.abs(r.x - this.x) < CAR_W && r.speed > this.speed * 0.9 && want > this.speed * 1.02) {
      r.flash = FLASH_T;
      r.flashCd = 7 + this.rand() * 5;
    }
    if (r.recover > 0) {
      r.recover -= dt;
      target = Math.min(target, max * 0.2);
    }
    // segue quem está na frente na linha dele (e na faixa para onde vai): freia a tempo de
    // ficar a uma distância segura em vez de bater na traseira enquanto espera a ultrapassagem
    {
      const half = CAR_W / 2;
      // o que o freio dele faz de verdade (mesma conta do freio lá embaixo), com folga
      const aB = toGame(G * this.rivalCar.brakeG * BRAKE_BOOST * this.surface(this.rivalCar) * aeroMul(this.rivalCar, r.speed)) * 0.6;
      const lo = Math.min(r.x, r.targetX) - half, hi = Math.max(r.x, r.targetX) + half;
      const follow = (z: number, x: number, w: number, speed: number) => {
        const dz = z - r.z;
        if (dz <= 0 || dz > 70 * SEG_LEN || x + w < lo || x - w > hi) return;
        // na linha atual pesa sempre; na de destino, só se já estiver indo para lá
        const inPath = Math.abs(x - r.x) < half + w || Math.abs(r.targetX - r.x) > 60;
        if (!inPath) return;
        const safe = SEG_LEN * 1.4 + Math.max(0, speed) * 0.25;
        const v = speed < 0 ? 0 : speed;
        const allow = dz > safe ? v + Math.sqrt(2 * aB * (dz - safe)) : v * clamp((dz - SEG_LEN * 0.8) / (safe - SEG_LEN * 0.8), 0.5, 1);
        target = Math.min(target, Math.max(0, allow));
      };
      for (const c of this.traffic) follow(c.z, c.x, this.carHalf(c), c.hit ? 0 : c.speed);
      // o jogador também (colado atrás dele o rival pisca o farol, não bate)
      if (this.state === 'drive') follow(this.playerZ, this.x, CAR_W / 2, this.speed);
    }
    // acelera no máximo o que o carro dele consegue (com arrasto) e freia ~1,1 g
    const accel = target > r.speed;
    const aDrive = r.pt.step(r.speed, accel, dt, this.surface(this.rivalCar));
    if (accel) {
      const acc = toGame(aDrive - resistAcc(this.rivalCar, r.speed, 1 - 0.35 * this.draftAhead(r.z, r.x, r.speed)));
      r.speed = Math.min(target, r.speed + Math.max(0, acc) * dt);
    } else r.speed = Math.max(target, r.speed - toGame(G * this.rivalCar.brakeG * BRAKE_BOOST * this.surface(this.rivalCar) * aeroMul(this.rivalCar, r.speed)) * dt);
    // não fecha ninguém ao trocar de faixa: espera se houver carro bem ao lado no caminho
    let dx = clamp(r.targetX - r.x, -dt * (r.style === 'agressivo' ? 3000 : 2600), dt * (r.style === 'agressivo' ? 3000 : 2600));
    if (dx) {
      const nx = r.x + dx;
      for (const c of this.traffic) {
        if (Math.abs(c.z - r.z) < SEG_LEN * 1.1 && !overlap(r.x, CAR_W / 2, c.x, this.carHalf(c)) && overlap(nx, CAR_W / 2, c.x, this.carHalf(c))) {
          dx = 0;
          break;
        }
      }
    }
    r.x += dx;
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
        if (d > 0 && d < RADAR_RANGE) this.radar = Math.max(this.radar, 1 - d / RADAR_RANGE);
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
        this.copTraffic(p, dt);
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
        this.copTraffic(p, dt);
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
        this.copTraffic(p, dt);
        if (p.z - pz > 300 * SEG_LEN) p.state = 'done';
      }
    }
    setSiren(siren);
    this.radarAlarm(dt);
  }

  // detector de radar por níveis: 5 luzes (2 verdes, 2 amarelas, 1 vermelha) e um bip por
  // nível, espaçado no verde, médio no amarelo e nervoso no vermelho
  radarLevel() {
    return this.radar > 0 ? Math.min(5, Math.ceil(this.radar * 5)) : 0;
  }
  private radarAlarm(dt: number) {
    const lvl = this.state === 'drive' || this.state === 'pullover' ? this.radarLevel() : 0;
    const band = lvl >= 5 ? 3 : lvl >= 3 ? 2 : lvl ? 1 : 0; // verde, amarelo, vermelho
    const changed = band !== this.radarBand;
    this.radarBand = band;
    if (!lvl) {
      this.radarBeepT = 0;
      return;
    }
    this.radarBeepT -= dt;
    if (this.radarBeepT <= 0 || changed) { // mudou de cor: bipa já no ritmo novo
      const red = lvl >= 5, yellow = lvl >= 3;
      radarBeep(red ? 760 : yellow ? 680 : 600);
      this.radarBeepT = red ? 0.16 : yellow ? 0.45 : 1.1;
    }
  }

  // viatura no meio do trânsito: desvia de quem está à frente na mesma linha (pelo lado com
  // mais espaço; de quem vem na contramão, sempre para a direita), freia se não der e, se
  // encostar, os dois se empurram e ela perde velocidade (não atravessa ninguém)
  private copTraffic(p: Police, dt: number) {
    const ph = (p.sv ? CAR_W * 1.08 : POLICE_W) / 2;
    const edge = this.track.roadW - ph;
    for (const c of this.traffic) {
      const half = this.carHalf(c);
      const dz = c.z - p.z;
      const closing = p.speed - c.speed;
      if (dz < -SEG_LEN * 0.4 || dz > SEG_LEN * 6 || closing <= 0) continue;
      if (!overlap(p.x, ph + 60, c.x, half)) continue;
      const room = ph + half + 90;
      let side = c.speed < 0 ? 1 : p.x < c.x ? -1 : 1;
      if (c.speed > 0 && Math.abs(c.x + side * room) > edge) side = -side;
      const tx = clamp(c.x + side * room, -edge, edge);
      p.x += clamp(tx - p.x, -dt * 3200, dt * 3200);
      const still = overlap(p.x, ph, c.x, half);
      // não deu para sair da frente a tempo: segura atrás dele
      if (still && dz < SEG_LEN * 2.2 && dz > 0) p.speed = Math.min(p.speed, Math.max(0, c.speed) + (dz - SEG_LEN * 0.9) * 2);
      // encostou: raspão, cada um para um lado
      if (still && Math.abs(dz) < SEG_LEN * 0.7) {
        const sd = p.x < c.x ? -1 : 1;
        p.x += sd * 120;
        c.slide = -sd * 450;
        p.speed = Math.min(p.speed, Math.max(0, c.speed) * 0.85);
        if (Math.abs(p.z - this.playerZ) < SEG_LEN * 12) scrapeSound();
      }
    }
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
      // o carro batido (pelo rival) fica parado na pista: continua sólido para o jogador
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
          this.stats.scrapes++;
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
        this.stats.scrapes++;
        if (dv > 45) this.clean = false;
        // batida leve: tranco, amassadinho (dano acumula e o motor começa a fumegar) e o outro fica marcado
        this.jolt = Math.max(this.jolt, Math.min(0.7, 0.25 + dv / 120));
        this.damage = Math.min(1, this.damage + Math.min(0.35, 0.08 + dv / 140));
        if (dv > 25 && this.rand() < 0.35 + dv / 120) this.crackGlass(Math.min(1, dv / 90), false);
        if (dv > 30) c.smoke = Math.max(c.smoke, 0.4);
        bumpSound(Math.min(1, 0.3 + dv / 100));
      }
      if (r && !c.hit) {
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
        this.stats.scrapes++;
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
