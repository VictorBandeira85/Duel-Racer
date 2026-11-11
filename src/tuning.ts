// Preparação: peças aftermarket por carro (carreira). Cada vaga (pistões, comando, alimentação,
// indução, escapamento, pneus, suspensão, rodas) tem a peça original e as opções à venda; a peça muda a
// ficha (potência, máxima, aderência, freio), o ronco (soundMods, aplicado ao motor daquele carro) e,
// na suspensão, a altura da carroceria na vista lateral (rideDrop). Para acrescentar peças ou vagas,
// basta incluir aqui: a tela da oficina, o save e a física leem este catálogo.
import type { CarSpec } from './cars';

export type SlotId = 'pistoes' | 'comando' | 'alimentacao' | 'inducao' | 'escape' | 'pneus' | 'suspensao' | 'freios' | 'bancos' | 'rodas' | 'turbina' | 'intercooler' | 'downpipe' | 'polia';
// mudanças no ronco: multiplicadores (drive, vol, low) e somas (rasp, pops, cam, intake, whine)
export interface SoundMods { drive?: number; vol?: number; low?: number; rasp?: number; pops?: number; cam?: number; intake?: number; whine?: number; turbo?: boolean; rev?: number /* multiplicador do giro máximo (corte) */ }
export interface Part {
  id: string; name: string; note: string;
  cost: number; // fração do preço do carro (0 = original)
  power?: number; // multiplicador de potência
  grip?: number; brake?: number; handling?: number; traction?: number; // multiplicadores
  mass?: number; // multiplicador do peso (bancos concha tiram peso)
  drop?: number; // quanto a carroceria desce (fração da altura livre): 0,2 esportiva, 0,35 corrida
  forced?: 'turbo' | 'super';
  boost?: number; // pressão máxima (kgf/cm²) mostrada no manômetro auxiliar
  wheel?: string; // roda aftermarket: arquivo em src/assets/wheels (rNN)
  sound?: SoundMods;
}
export interface Slot { id: SlotId; name: string; parts: Part[] }
export type Build = Partial<Record<SlotId, string>>;

// carros de carburador (os demais são de injeção eletrônica)
const CARB = new Set(['br-monza', 'br-passat', 'br-opala', 'br-pumagtb', 'br-pumagte', 'br-chevette', 'br-147', 'br-sp2', 'br-charger', 'br-maverick', 'toro-lp5']);
export const isCarb = (car: CarSpec) => CARB.has(car.id);
const factoryTurbo = (car: CarSpec) => car.curve === 'turbo' || car.curve === 'seqturbo';

// rodas aftermarket (tools/ref/wheels_sheet.py recorta a folha do Victor em src/assets/wheels/rNN.png)
export const WHEEL_LIST: [string, string][] = [
  ['r01', 'Cinco raios'],
  ['r02', 'Raios duplos'],
  ['r03', 'Seis raios'],
  ['r04', 'Raios em Y'],
  ['r05', 'Doze raios'],
  ['r06', 'Preta aro vermelho'],
  ['r07', 'Tela fina'],
  ['r08', 'Dourada 5 raios'],
  ['r09', 'Grafite em Y'],
  ['r10', 'Oito raios'],
  ['r11', 'Três peças'],
  ['r12', 'Raiada'],
  ['r13', 'Grafite raiada'],
  ['r14', 'Turbina'],
  ['r15', 'Furos'],
  ['r16', 'Tela dourada'],
  ['r17', 'Preta e vermelha'],
  ['r18', 'Dez raios'],
  ['r19', 'Pás largas'],
  ['r20', 'Colmeia'],
  ['r21', 'Estrela'],
  ['r22', 'Grafite 6 raios'],
  ['r23', 'Garras'],
  ['r24', 'Dourada 10 raios'],
  ['r25', 'Cinco furos'],
  ['r26', 'Raios curvos'],
  ['r27', 'Preta aro azul'],
  // clássicas (segunda folha): calotas, aço, raiadas e ligas de época
  ['c01', 'Calota cromada'],
  ['c02', 'Aço vermelha'],
  ['c03', 'Três pontas'],
  ['c04', 'Pétalas'],
  ['c05', 'Raiada de arame'],
  ['c06', 'Aço de rali'],
  ['c07', 'Aço furada'],
  ['c08', 'Cinco raios preta'],
  ['c09', 'Calota de aletas'],
  ['c10', 'Calota lisa'],
  ['c11', 'Cinco raios clássica'],
  ['c12', 'Oito raios de corrida'],
  ['c13', 'Oito furos'],
  ['c14', 'Grafite rebitada'],
  ['c15', 'SS'],
  ['c16', 'Tela prata'],
  ['c17', 'Quatro raios aro vermelho'],
  ['c18', 'Alumínio rebitada'],
  ['c19', 'Calota de rasgos'],
  ['c20', 'Cruz'],
  ['c21', 'Quatro raios'],
  ['c22', 'Calota aero'],
  ['c23', 'Estrela cromada'],
  ['c24', 'Furada aro vermelho'],
  ['c25', 'Cinco raios larga'],
];

const ORIGINAL = (name = 'Original'): Part => ({ id: '', name, note: 'original', cost: 0 });

/** vagas e peças que servem neste carro (alimentação conforme carburador/injeção; indução conforme
 * o carro já ser turbo de fábrica). Com `build`, as vagas que dependem da indução só aparecem quando
 * ela está lá: turbo -> turbina, intercooler e downpipe; supercharger -> polia e intercooler. Sem
 * `build`, vêm todas (para procurar uma peça pelo nome da vaga). */
export function slotsFor(car: CarSpec, build?: Build): Slot[] {
  const carb = isCarb(car);
  const ft = factoryTurbo(car);
  const ind = build ? (ft ? 'turbo' : build.inducao === 'turbo' ? 'turbo' : build.inducao === 'super' ? 'super' : '') : 'all';
  const turbo = ind === 'turbo' || ind === 'all', sup = ind === 'super' || ind === 'all';
  const extra: Slot[] = [];
  if (turbo && !ft) extra.push({ id: 'turbina', name: 'Turbina', parts: [ORIGINAL('.32 (do kit)'),
    { id: 't40', name: '.40', note: '+8% cv', cost: 0.05, power: 1.08, boost: 1.2, sound: { low: 0.94, pops: 0.1 } },
    { id: 't50', name: '.50', note: '+15% cv', cost: 0.09, power: 1.15, boost: 1.6, sound: { low: 0.88, pops: 0.2 } },
    { id: 't60', name: '.60', note: '+22% cv', cost: 0.13, power: 1.22, boost: 2.0, sound: { low: 0.83, pops: 0.28 } },
    { id: 't70', name: '.70', note: '+30% cv', cost: 0.18, power: 1.3, boost: 2.4, sound: { low: 0.78, pops: 0.35 } }] });
  if (sup && !ft) extra.push({ id: 'polia', name: 'Polia', parts: [ORIGINAL('60 mm (do kit)'),
    { id: 'p40', name: '40 mm', note: '+8% cv', cost: 0.03, power: 1.08, boost: 0.65, sound: { whine: 0.15 } },
    { id: 'p30', name: '30 mm', note: '+14% cv', cost: 0.05, power: 1.14, boost: 0.85, sound: { whine: 0.3, drive: 1.05 } }] });
  if (turbo || sup) extra.push({ id: 'intercooler', name: 'Intercooler', parts: [ORIGINAL(ft ? 'Original' : 'Sem'),
    { id: 'esportivo', name: 'Esportivo', note: '+4% cv', cost: 0.04, power: 1.04 },
    { id: 'corrida', name: 'De corrida', note: '+7% cv', cost: 0.07, power: 1.07 }] });
  if (turbo) extra.push({ id: 'downpipe', name: 'Downpipe', parts: [ORIGINAL(),
    { id: 'd3', name: '2,5 pol', note: '+3% cv', cost: 0.03, power: 1.03, sound: { drive: 1.1, vol: 1.05, low: 1.05 } },
    { id: 'd5', name: '3,5 pol', note: '+5% cv', cost: 0.05, power: 1.05, sound: { drive: 1.2, vol: 1.1, low: 1.12, pops: 0.15 } }] });
  return [
    { id: 'pistoes', name: 'Pistões e bielas', parts: [ORIGINAL(),
      { id: 'aliviados', name: 'Aliviados', note: '+4% cv', cost: 0.04, power: 1.04, sound: { drive: 1.03 } },
      { id: 'forjados', name: 'Forjados', note: '+6% cv', cost: 0.06, power: 1.06, sound: { drive: 1.05 } }] },
    { id: 'comando', name: 'Comando', parts: [ORIGINAL(),
      { id: 'esportivo', name: 'Esportivo', note: '+7,5% cv, +5% giro', cost: 0.05, power: 1.075, sound: { cam: 0.25, drive: 1.08, rev: 1.05 } },
      { id: 'corrida', name: 'De corrida', note: '+13,5% cv, +10% giro', cost: 0.09, power: 1.135, sound: { cam: 0.6, drive: 1.15, pops: 0.15, rev: 1.1 } }] },
    carb
      ? { id: 'alimentacao', name: 'Carburador', parts: [ORIGINAL(),
        { id: 'duplo', name: 'Corpo duplo', note: '+7,5% cv', cost: 0.04, power: 1.075, sound: { intake: 0.3 } },
        { id: 'weber', name: 'Dupla de corrida', note: '+13,5% cv', cost: 0.08, power: 1.135, sound: { intake: 0.55, rasp: 0.03 } }] }
      : { id: 'alimentacao', name: 'Injeção', parts: [ORIGINAL(),
        { id: 'chip', name: 'Chip e bicos', note: '+7,5% cv', cost: 0.04, power: 1.075, sound: { drive: 1.05 } },
        { id: 'programavel', name: 'Programável', note: '+13,5% cv, +5% giro', cost: 0.09, power: 1.135, sound: { drive: 1.1, pops: 0.2, rev: 1.05 } }] },
    ft
      ? { id: 'inducao', name: 'Turbina', parts: [ORIGINAL('De fábrica'), { id: 'turbomaior', name: 'Turbina maior', note: '+18% cv', cost: 0.12, power: 1.18, sound: { low: 0.92, pops: 0.2 } }] }
      : { id: 'inducao', name: 'Indução', parts: [ORIGINAL('Aspirado'),
        { id: 'turbo', name: 'Turbo', note: '+42% cv', cost: 0.22, power: 1.42, forced: 'turbo', boost: 0.8, sound: { turbo: true, low: 0.82, pops: 0.25 } },
        { id: 'super', name: 'Supercharger', note: '+30% cv', cost: 0.2, power: 1.3, forced: 'super', boost: 0.45, sound: { whine: 0.55, drive: 1.1 } }] },
    ...extra,
    { id: 'escape', name: 'Escapamento', parts: [ORIGINAL(),
      { id: 'esportivo', name: 'Esportivo', note: '+4,5% cv', cost: 0.03, power: 1.045, sound: { drive: 1.25, vol: 1.15, rasp: 0.04, low: 1.15 } },
      { id: 'corrida', name: 'De corrida', note: '+9% cv', cost: 0.06, power: 1.09, sound: { drive: 1.6, vol: 1.3, rasp: 0.1, pops: 0.4, low: 1.35 } }] },
    { id: 'pneus', name: 'Pneus', parts: [ORIGINAL(),
      { id: 'esportivo', name: 'Esportivo de rua', note: '+9% curva', cost: 0.03, grip: 1.09, brake: 1.06, traction: 1.06, handling: 1.045 },
      { id: 'semislick', name: 'Semi slick', note: '+18% curva', cost: 0.07, grip: 1.18, brake: 1.12, traction: 1.12, handling: 1.075 }] },
    { id: 'suspensao', name: 'Suspensão', parts: [ORIGINAL(),
      { id: 'esportiva', name: 'Esportiva', note: '-20% altura', cost: 0.04, drop: 0.2, grip: 1.06, handling: 1.075 },
      { id: 'corrida', name: 'De corrida', note: '-35% altura', cost: 0.08, drop: 0.35, grip: 1.105, handling: 1.135 }] },
    { id: 'freios', name: 'Freios', parts: [ORIGINAL(),
      { id: 'esportivo', name: 'Discos ventilados', note: '+10,5% freio', cost: 0.04, brake: 1.105 },
      { id: 'corrida', name: 'Discos de corrida', note: '+21% freio', cost: 0.08, brake: 1.21 }] },
    // alívio de peso em etapas (cada uma inclui as anteriores); id 'bancos' e 'concha' mantidos por causa dos saves
    { id: 'bancos', name: 'Alívio de peso', parts: [ORIGINAL(),
      { id: 'entretenimento', name: 'Retirar entretenimento', note: '-1,5% peso', cost: 0.01, mass: 0.985 },
      { id: 'forros', name: 'Forros de porta', note: '-3% peso', cost: 0.02, mass: 0.97 },
      { id: 'acabamentos', name: 'Acabamentos', note: '-4,5% peso', cost: 0.03, mass: 0.955 },
      { id: 'concha', name: 'Bancos de corrida', note: '-6,5% peso', cost: 0.05, mass: 0.935 },
      { id: 'estrutura', name: 'Estrutura', note: '-9% peso', cost: 0.07, mass: 0.91 },
      { id: 'corrida', name: 'Alívio de corrida', note: '-12% peso', cost: 0.1, mass: 0.88 }] },
    { id: 'rodas', name: 'Rodas', parts: [ORIGINAL('Originais'), ...WHEEL_LIST.map(([id, name]): Part => ({ id, name, note: id[0] === 'c' ? 'clássica' : 'liga leve', cost: 0.03, wheel: id }))] },
  ];
}

// ilustração de cada vaga (src/assets/parts, tools/ref/parts_photos.py)
export const slotArt = (car: CarSpec, slot: SlotId): string | undefined =>
  ({ pistoes: 'pistao', comando: 'comando', alimentacao: isCarb(car) ? 'carburador' : 'injecao', inducao: 'turbo', turbina: 'turbo', escape: 'escape', suspensao: 'suspensao', freios: 'freio', bancos: 'bancos' } as Partial<Record<SlotId, string>>)[slot];

export const partOf = (car: CarSpec, slot: SlotId, id: string | undefined): Part => {
  const sl = slotsFor(car).find((s) => s.id === slot)!;
  return sl.parts.find((p) => p.id === (id ?? '')) ?? sl.parts[0];
};
export const partCost = (car: CarSpec, p: Part) => (p.cost ? Math.max(300, Math.round((Number(car.price.replace(/\D/g, '')) * p.cost) / 100) * 100) : 0);
export const buildKey = (b: Build | undefined) => (b ? Object.entries(b).filter(([, v]) => v).sort().map(([k, v]) => `${k}=${v}`).join(',') : '');

/** aplica as peças à ficha (antes de prepareCar): potência, máxima, aderência, ronco e altura */
export function applyBuild(car: CarSpec, build: Build | undefined): CarSpec {
  if (!build || !buildKey(build)) return car;
  let power = 1, grip = 1, brake = 1, handling = 1, traction = 1, drop = 0, mass = 1, boost = 0;
  let forced: 'turbo' | 'super' | undefined;
  let wheel: string | undefined;
  const snd: SoundMods = {};
  for (const sl of slotsFor(car, build)) { // só as vagas que valem com a indução instalada
    const p = partOf(car, sl.id, build[sl.id]);
    power *= p.power ?? 1;
    grip *= p.grip ?? 1;
    brake *= p.brake ?? 1;
    handling *= p.handling ?? 1;
    traction *= p.traction ?? 1;
    mass *= p.mass ?? 1;
    drop = Math.max(drop, p.drop ?? 0);
    forced = p.forced ?? forced;
    boost = Math.max(boost, p.boost ?? 0);
    wheel = p.wheel ?? wheel;
    const m = p.sound;
    if (m) {
      snd.drive = (snd.drive ?? 1) * (m.drive ?? 1);
      snd.vol = (snd.vol ?? 1) * (m.vol ?? 1);
      snd.low = (snd.low ?? 1) * (m.low ?? 1);
      if (m.rev) snd.rev = (snd.rev ?? 1) * m.rev;
      for (const k of ['rasp', 'pops', 'cam', 'intake', 'whine'] as const) if (m[k]) snd[k] = (snd[k] ?? 0) + m[k]!;
      if (m.turbo) snd.turbo = true;
    }
  }
  return {
    ...car,
    accel: car.accel * power,
    maxSpeed: car.maxSpeed * Math.cbrt(power), // a máxima cresce com a raiz cúbica da potência (arrasto)
    lateralG: car.lateralG * grip,
    brakeG: car.brakeG * brake,
    mass: car.mass * mass,
    handling: car.handling * handling,
    traction: (car.traction ?? 1) * traction,
    curve: forced === 'turbo' ? 'turbo' : car.curve,
    engine: forced === 'turbo' ? `${car.engine} turbo` : forced === 'super' ? `${car.engine} compressor` : car.engine,
    rideDrop: drop || undefined,
    forced, boostMax: forced ? boost : undefined,
    // relógios auxiliares: pressão do turbo/compressor, de óleo (pistões e bielas) e de combustível (alimentação)
    pods: [...(forced ? ['boost' as const] : []), ...(build.pistoes ? ['oil' as const] : []), ...(build.alimentacao ? ['fuel' as const] : [])],
    carb: isCarb(car),
    prep: power,
    wheelArt: wheel,
    soundMods: snd,
  };
}
