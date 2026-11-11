// Preparação: peças aftermarket por carro (carreira). Cada vaga (pistões, comando, alimentação,
// indução, escapamento, pneus, suspensão, rodas) tem a peça original e as opções à venda; a peça muda a
// ficha (potência, máxima, aderência, freio), o ronco (soundMods, aplicado ao motor daquele carro) e,
// na suspensão, a altura da carroceria na vista lateral (rideDrop). Para acrescentar peças ou vagas,
// basta incluir aqui: a tela da oficina, o save e a física leem este catálogo.
import type { CarSpec } from './cars';

export type SlotId = 'pistoes' | 'comando' | 'alimentacao' | 'inducao' | 'escape' | 'pneus' | 'suspensao' | 'rodas';
// mudanças no ronco: multiplicadores (drive, vol, low) e somas (rasp, pops, cam, intake, whine)
export interface SoundMods { drive?: number; vol?: number; low?: number; rasp?: number; pops?: number; cam?: number; intake?: number; whine?: number; turbo?: boolean }
export interface Part {
  id: string; name: string; note: string;
  cost: number; // fração do preço do carro (0 = original)
  power?: number; // multiplicador de potência
  grip?: number; brake?: number; handling?: number; traction?: number; // multiplicadores
  drop?: number; // quanto a carroceria desce (fração da altura livre): 0,2 esportiva, 0,35 corrida
  forced?: 'turbo' | 'super';
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
];

const ORIGINAL = (name = 'Original'): Part => ({ id: '', name, note: 'de fábrica', cost: 0 });

/** vagas e peças que servem neste carro (alimentação conforme carburador/injeção; indução conforme
 * o carro já ser turbo de fábrica) */
export function slotsFor(car: CarSpec): Slot[] {
  const carb = isCarb(car);
  return [
    { id: 'pistoes', name: 'Pistões', parts: [ORIGINAL(), { id: 'forjados', name: 'Forjados', note: '+4% cv', cost: 0.06, power: 1.04, sound: { drive: 1.05 } }] },
    { id: 'comando', name: 'Comando', parts: [ORIGINAL(),
      { id: 'esportivo', name: 'Esportivo', note: '+5% cv', cost: 0.05, power: 1.05, sound: { cam: 0.25, drive: 1.08 } },
      { id: 'corrida', name: 'De corrida', note: '+9% cv', cost: 0.09, power: 1.09, sound: { cam: 0.6, drive: 1.15, pops: 0.15 } }] },
    carb
      ? { id: 'alimentacao', name: 'Carburador', parts: [ORIGINAL(),
        { id: 'duplo', name: 'Corpo duplo', note: '+5% cv', cost: 0.04, power: 1.05, sound: { intake: 0.3 } },
        { id: 'weber', name: 'Dupla de corrida', note: '+9% cv', cost: 0.08, power: 1.09, sound: { intake: 0.55, rasp: 0.03 } }] }
      : { id: 'alimentacao', name: 'Injeção', parts: [ORIGINAL(),
        { id: 'chip', name: 'Chip e bicos', note: '+5% cv', cost: 0.04, power: 1.05, sound: { drive: 1.05 } },
        { id: 'programavel', name: 'Programável', note: '+9% cv', cost: 0.09, power: 1.09, sound: { drive: 1.1, pops: 0.2 } }] },
    factoryTurbo(car)
      ? { id: 'inducao', name: 'Turbina', parts: [ORIGINAL('De fábrica'), { id: 'turbomaior', name: 'Turbina maior', note: '+12% cv', cost: 0.12, power: 1.12, sound: { low: 0.92, pops: 0.2 } }] }
      : { id: 'inducao', name: 'Indução', parts: [ORIGINAL('Aspirado'),
        { id: 'turbo', name: 'Turbo', note: '+28% cv', cost: 0.22, power: 1.28, forced: 'turbo', sound: { turbo: true, low: 0.82, pops: 0.25 } },
        { id: 'super', name: 'Supercharger', note: '+20% cv', cost: 0.2, power: 1.2, forced: 'super', sound: { whine: 0.55, drive: 1.1 } }] },
    { id: 'escape', name: 'Escapamento', parts: [ORIGINAL(),
      { id: 'esportivo', name: 'Esportivo', note: '+3% cv', cost: 0.03, power: 1.03, sound: { drive: 1.25, vol: 1.15, rasp: 0.04, low: 1.15 } },
      { id: 'corrida', name: 'De corrida', note: '+6% cv', cost: 0.06, power: 1.06, sound: { drive: 1.6, vol: 1.3, rasp: 0.1, pops: 0.4, low: 1.35 } }] },
    { id: 'pneus', name: 'Pneus', parts: [ORIGINAL(),
      { id: 'esportivo', name: 'Esportivo de rua', note: '+6% curva', cost: 0.03, grip: 1.06, brake: 1.04, traction: 1.04, handling: 1.03 },
      { id: 'semislick', name: 'Semi slick', note: '+12% curva', cost: 0.07, grip: 1.12, brake: 1.08, traction: 1.08, handling: 1.05 }] },
    { id: 'suspensao', name: 'Suspensão', parts: [ORIGINAL(),
      { id: 'esportiva', name: 'Esportiva', note: '-20% altura', cost: 0.04, drop: 0.2, grip: 1.04, handling: 1.05 },
      { id: 'corrida', name: 'De corrida', note: '-35% altura', cost: 0.08, drop: 0.35, grip: 1.07, handling: 1.09 }] },
    { id: 'rodas', name: 'Rodas', parts: [ORIGINAL('Originais'), ...WHEEL_LIST.map(([id, name]): Part => ({ id, name, note: 'liga leve', cost: 0.03, wheel: id }))] },
  ];
}

export const partOf = (car: CarSpec, slot: SlotId, id: string | undefined): Part => {
  const sl = slotsFor(car).find((s) => s.id === slot)!;
  return sl.parts.find((p) => p.id === (id ?? '')) ?? sl.parts[0];
};
export const partCost = (car: CarSpec, p: Part) => (p.cost ? Math.max(300, Math.round((Number(car.price.replace(/\D/g, '')) * p.cost) / 100) * 100) : 0);
export const buildKey = (b: Build | undefined) => (b ? Object.entries(b).filter(([, v]) => v).sort().map(([k, v]) => `${k}=${v}`).join(',') : '');

/** aplica as peças à ficha (antes de prepareCar): potência, máxima, aderência, ronco e altura */
export function applyBuild(car: CarSpec, build: Build | undefined): CarSpec {
  if (!build || !buildKey(build)) return car;
  let power = 1, grip = 1, brake = 1, handling = 1, traction = 1, drop = 0;
  let forced: 'turbo' | 'super' | undefined;
  let wheel: string | undefined;
  const snd: SoundMods = {};
  for (const sl of slotsFor(car)) {
    const p = partOf(car, sl.id, build[sl.id]);
    power *= p.power ?? 1;
    grip *= p.grip ?? 1;
    brake *= p.brake ?? 1;
    handling *= p.handling ?? 1;
    traction *= p.traction ?? 1;
    drop = Math.max(drop, p.drop ?? 0);
    forced = p.forced ?? forced;
    wheel = p.wheel ?? wheel;
    const m = p.sound;
    if (m) {
      snd.drive = (snd.drive ?? 1) * (m.drive ?? 1);
      snd.vol = (snd.vol ?? 1) * (m.vol ?? 1);
      snd.low = (snd.low ?? 1) * (m.low ?? 1);
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
    handling: car.handling * handling,
    traction: (car.traction ?? 1) * traction,
    curve: forced === 'turbo' ? 'turbo' : car.curve,
    engine: forced === 'turbo' ? `${car.engine} turbo` : forced === 'super' ? `${car.engine} compressor` : car.engine,
    rideDrop: drop || undefined,
    wheelArt: wheel,
    soundMods: snd,
  };
}
