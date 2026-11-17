// Preparação: peças aftermarket por carro (carreira). Cada vaga (pistões, comando, alimentação,
// indução, escapamento, pneus, suspensão, rodas) tem a peça original e as opções à venda; a peça muda a
// ficha (potência, máxima, aderência, freio), o ronco (soundMods, aplicado ao motor daquele carro) e,
// na suspensão, a altura da carroceria na vista lateral (rideDrop). Para acrescentar peças ou vagas,
// basta incluir aqui: a tela da oficina, o save e a física leem este catálogo.
import type { CarSpec } from './cars';
import { engineSpec } from './enginesynth';
import { devPositions } from './devpos';
import { podMoved, podPlaces } from './podpos';

export type SlotId = 'pistoes' | 'comando' | 'alimentacao' | 'inducao' | 'escape' | 'pneus' | 'suspensao' | 'freios' | 'bancos' | 'rodas' | 'turbina' | 'intercooler' | 'downpipe' | 'polia' | 'pressao' | 'largada' | 'painel' | 'relogios';
// mudanças no ronco: multiplicadores (drive, vol, low) e somas (rasp, pops, cam, intake, whine)
export interface SoundMods { drive?: number; vol?: number; low?: number; rasp?: number; pops?: number; cam?: number; intake?: number; whine?: number; turbo?: boolean; spool?: number /* turbo aftermarket: força do assobio, do sopro e do alívio */; blower?: number /* supercharger: força do zunido */; rev?: number /* multiplicador do giro máximo (corte) */; press?: number /* pressão escolhida no wastegate/boost controller (bar): assobio e alívio mais fortes */;
  // timbre do escapamento e do downpipe (enginesynth.ts applySoundMods), relativo ao motor de cada carro:
  pipe?: number /* comprimento do tubo (x): menor = escape mais curto e seco */; fbAdd?: number /* ressonância do tubo (+ realimentação do eco) */;
  resShift?: number /* tom das ressonâncias (x): menor = mais grave e oco */; bass?: number /* ganho da ressonância grave (x) */; mid?: number /* ganho da ressonância média, a rouquidão (x) */;
  cabinOpen?: number /* abafamento da cabine (x no corte): maior = chega mais aberto */; burble?: number /* borbulho no alívio (+) */; crackle?: number /* crepitar no alívio: estalos mais cedo e mais vezes (+) */;
  rush?: number /* sopro do turbo (x) */; whistle?: number /* assobio do turbo (x) */ }
export interface Part {
  id: string; name: string; note: string;
  cost: number; // fração do preço do carro (0 = original)
  power?: number; // multiplicador de potência
  grip?: number; brake?: number; handling?: number; traction?: number; // multiplicadores
  mass?: number; // multiplicador do peso (bancos concha tiram peso)
  drop?: number; // quanto a carroceria desce (fração da altura livre): 0,2 esportiva, 0,35 corrida
  forced?: 'turbo' | 'super';
  boost?: number; // pressão máxima (bar) mostrada no manômetro auxiliar
  boostMul?: number; // turbo de fábrica: quanto a pressão sobe (o manômetro do quadro mostra)
  wheel?: string; // roda aftermarket: arquivo em src/assets/wheels (rNN)
  flow?: number; // turbina: pressão (bar) que ela sustenta com eficiência; acima disso só esquenta
  ic?: number; // intercooler: quanto do calor do turbo ele tira em alta rotação (0..1)
  bar?: number; // wastegate / boost controller: pressão escolhida (bar)
  spool?: [number, number]; // turbina: [rapidez com que enche, giro (fração do corte) em que a pressão aparece]
  launch?: number; // controle de largada (3-step): giro de largada, fração do corte
  rpm?: number; // 3-step: o mesmo giro em rpm (o que o visor do aparelho mostra)
  sound?: SoundMods;
}
export interface Slot { id: SlotId; name: string; parts: Part[] }
export type Build = Partial<Record<SlotId, string>>;

// carros de carburador (os demais são de injeção eletrônica)
const CARB = new Set(['br-monza', 'br-monzacoupe', 'br-voyage', 'br-voyagesport', 'br-santana', 'br-passat', 'br-opala', 'br-pumagtb', 'br-pumagte', 'br-chevette', 'br-147', 'br-sp2', 'br-charger', 'br-maverick', 'toro-lp5']);
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
// pressões do wastegate / boost controller (as do Victor): 0,7 a 3,5 bar
const BARS = [0.7, 1.0, 1.2, 1.5, 1.8, 2.0, 2.5, 3.0, 3.5];
export const fmtBar = (b: number) => (Math.round(b * 100) / 100).toFixed(Math.abs(b * 10 - Math.round(b * 10)) > 1e-6 ? 2 : 1).replace('.', ',');

/** turbo do kit com a pressão escolhida: potência e calor.
 * - Potência: cada bar a mais rende ~18% sobre o kit (.32 a 0,8 bar = 1); acima do que a turbina
 *   sustenta (`flow`), só 1/4 disso (ar quente e compressor fora da eficiência). Teto de +60% sobre o kit.
 * - Calor (por segundo, pé no fundo no giro máximo; a física multiplica pelo giro e pelo intercooler):
 *   cresce com a pressão e muito mais com o excesso sobre o `flow` (turbina pequena em pressão alta).
 * - `eq`: onde a temperatura extra se equilibra num giro alto (~85%), com o intercooler: 0,65 avisa,
 *   0,8 a central corta potência. */
export const HEAT_K = 0.02; // resfriamento sob carga (fração do calor extra por segundo)
export function turboHeatAt(heat: number, ic: number, rpm: number) {
  const r = Math.max(0, Math.min(1, rpm));
  return heat * (0.35 + 0.65 * r * r) * (1 - ic * (0.3 + 0.7 * r));
}
export function boostInfo(car: CarSpec, build: Build) {
  const sl = slotsFor(car, build);
  if (!sl.some((s) => s.id === 'pressao')) return null; // só o turbo do kit
  let b0 = 0, flow = 1.2, ic = 0, tPower = 1;
  for (const s of sl) {
    const p = partOf(car, s.id, build[s.id]);
    b0 = Math.max(b0, p.boost ?? 0);
    if (p.flow) flow = Math.max(flow, p.flow);
    ic = Math.max(ic, p.ic ?? 0);
    if (s.id === 'turbina') tPower = p.power ?? 1;
  }
  const set = partOf(car, 'pressao', build.pressao).bar;
  const bar = set ?? b0;
  const eff = Math.min(bar, flow) + 0.25 * Math.max(0, bar - flow);
  const kit = (b: number) => Math.min(1.6, 1 + 0.18 * (b - 0.8));
  // sem o controle a turbina fica na pressão dela (a potência da peça da turbina vale como está)
  const power = set === undefined ? 1 : kit(eff) / tPower;
  const heat = 0.0035 * bar + 0.008 * Math.max(0, bar - flow) ** 1.5;
  return { bar, b0, flow, ic, power, heat, eq: turboHeatAt(heat, ic, 0.85) / HEAT_K, set: set !== undefined };
}
/** palavra da temperatura do turbo para a ficha */
export const heatWord = (eq: number) => (eq < 0.3 ? 'frio' : eq < 0.55 ? 'morno' : eq < 0.8 ? 'quente' : 'ferve');

/** vagas e peças que servem neste carro (alimentação conforme carburador/injeção; indução conforme
 * o carro já ser turbo de fábrica). Com `build`, as vagas que dependem da indução só aparecem quando
 * ela está lá: turbo -> turbina, intercooler e downpipe; supercharger -> polia e intercooler. Sem
 * `build`, vêm todas (para procurar uma peça pelo nome da vaga). */
const redlineOf = (car: CarSpec) => (car.engine ? engineSpec(car.engine, car.id).redline : 6500);
// giros do 3-step (os do Victor), só os que ficam abaixo do corte do carro
function launchSteps(car: CarSpec) {
  return [2500, 3000, 3500, 4000, 4500, 5000, 5500, 6000].filter((r) => r <= redlineOf(car) - 500);
}
export function slotsFor(car: CarSpec, build?: Build): Slot[] {
  const carb = isCarb(car);
  const ft = factoryTurbo(car);
  const ind = build ? (ft ? 'turbo' : build.inducao === 'turbo' ? 'turbo' : build.inducao === 'super' ? 'super' : '') : 'all';
  const turbo = ind === 'turbo' || ind === 'all', sup = ind === 'super' || ind === 'all';
  const extra: Slot[] = [];
  // relógios auxiliares na cabine (como em applyBuild): turbo/compressor do kit, pistões ou alimentação
  const pods = !!build && !!(build.pistoes || build.alimentacao || (!ft && (ind === 'turbo' || ind === 'super')));
  if (turbo && !ft) extra.push({ id: 'turbina', name: 'Turbina', parts: [ORIGINAL('.32 (do kit)'),
    { id: 't40', name: '.40', note: '+8% cv, enche a ~35%', cost: 0.05, spool: [1.3, 0.35], power: 1.08, boost: 1.2, flow: 1.6, sound: { spool: 0.2, low: 0.94, pops: 0.1 } },
    { id: 't50', name: '.50', note: '+15% cv, enche a ~45%', cost: 0.09, spool: [1.0, 0.45], power: 1.15, boost: 1.6, flow: 2.1, sound: { spool: 0.4, low: 0.88, pops: 0.2 } },
    { id: 't60', name: '.60', note: '+22% cv, enche a ~55%', cost: 0.13, spool: [0.78, 0.55], power: 1.22, boost: 2.0, flow: 2.6, sound: { spool: 0.6, low: 0.83, pops: 0.28 } },
    { id: 't70', name: '.70', note: '+30% cv, enche a ~65%', cost: 0.18, spool: [0.6, 0.65], power: 1.3, boost: 2.4, flow: 3.1, sound: { spool: 0.8, low: 0.78, pops: 0.35 } }] });
  if (sup && !ft) extra.push({ id: 'polia', name: 'Polia', parts: [ORIGINAL('60 mm (do kit)'),
    { id: 'p40', name: '40 mm', note: '+8% cv', cost: 0.03, power: 1.08, boost: 0.65, sound: { whine: 0.15, blower: 0.25 } },
    { id: 'p30', name: '30 mm', note: '+14% cv', cost: 0.05, power: 1.14, boost: 0.85, sound: { whine: 0.3, blower: 0.5, drive: 1.05 } }] });
  if (turbo || sup) extra.push({ id: 'intercooler', name: 'Intercooler', parts: [ORIGINAL(ft ? 'Original' : 'Sem'),
    { id: 'esportivo', name: 'Esportivo', note: '+4% cv, -45% calor', cost: 0.04, power: 1.04, ic: 0.45 },
    { id: 'corrida', name: 'De corrida', note: '+7% cv, -65% calor', cost: 0.07, power: 1.07, ic: 0.65 }] });
  if (turbo) extra.push({ id: 'downpipe', name: 'Downpipe', parts: [ORIGINAL(),
    { id: 'd2', name: '2,0 pol', note: '+2% cv, quase original', cost: 0.02, power: 1.02, sound: { drive: 1.04, vol: 1.02, low: 1.03, resShift: 0.99, fbAdd: 0.01, rush: 1.12 } },
    { id: 'd3', name: '2,5 pol', note: '+3% cv, som mais cheio', cost: 0.03, power: 1.03, sound: { drive: 1.08, vol: 1.04, low: 1.06, resShift: 0.96, fbAdd: 0.03, bass: 1.12, pipe: 1.03, rush: 1.3, whistle: 1.05 } },
    { id: 'd4', name: '3,0 pol', note: '+4% cv, grave e oco', cost: 0.04, power: 1.04, sound: { drive: 1.12, vol: 1.06, low: 1.1, resShift: 0.92, fbAdd: 0.06, bass: 1.25, pipe: 1.06, pops: 0.08, rush: 1.55, whistle: 1.1 } },
    { id: 'd5', name: '3,5 pol', note: '+5% cv, oco, sopra', cost: 0.05, power: 1.05, sound: { drive: 1.16, vol: 1.08, low: 1.14, resShift: 0.88, fbAdd: 0.09, bass: 1.38, pipe: 1.1, pops: 0.15, burble: 0.1, rush: 1.8, whistle: 1.15 } }] });
  // controle de pressão do turbo do kit: wastegate ajustável no carburado, boost controller na injeção
  // (0,7 a 3,5 bar); comprado uma vez, mudar a pressão depois não cobra de novo (ownsPart)
  if (turbo && !ft) extra.push({ id: 'pressao', name: carb ? 'Wastegate' : 'Boost controller', parts: [ORIGINAL('Da turbina'),
    ...BARS.map((b): Part => ({ id: `b${Math.round(b * 100)}`, name: `${fmtBar(b)} bar`, note: carb ? 'wastegate ajustável' : 'boost controller', cost: carb ? 0.03 : 0.05, bar: b }))] });
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
      ? { id: 'inducao', name: 'Turbina', parts: [ORIGINAL('De fábrica'), { id: 'turbomaior', name: 'Turbina maior', note: '+18% cv, +0,3 bar', cost: 0.12, power: 1.18, boostMul: 1.3, sound: { low: 0.92, pops: 0.2, spool: 0.25 } }] }
      : { id: 'inducao', name: 'Indução', parts: [ORIGINAL('Aspirado'),
        { id: 'turbo', name: 'Turbo', note: '+42% cv', cost: 0.22, power: 1.42, forced: 'turbo', boost: 0.8, sound: { turbo: true, spool: 1, low: 0.82, pops: 0.25 } },
        { id: 'super', name: 'Supercharger', note: '+30% cv', cost: 0.2, power: 1.3, forced: 'super', boost: 0.45, sound: { whine: 0.55, blower: 1, drive: 1.1 } }] },
    ...extra,
    { id: 'escape', name: 'Escapamento', parts: [ORIGINAL(),
      // (ids esportivo e corrida mantidos por causa dos saves)
      { id: 'esportivo', name: 'Abafadores esportivos', note: '+4,5% cv, encorpado', cost: 0.03, power: 1.045, sound: { drive: 1.2, vol: 1.16, rasp: 0.02, low: 1.12, bass: 1.3, mid: 1.08, resShift: 0.96, fbAdd: 0.04, pops: 0.1 } },
      { id: 'semabafador', name: 'Sem abafadores', note: '+7% cv, rouco e alto', cost: 0.04, power: 1.07, sound: { drive: 1.4, vol: 1.18, rasp: 0.05, low: 1.18, bass: 1.45, mid: 1.28, resShift: 0.94, fbAdd: 0.1, pipe: 0.88, pops: 0.35, burble: 0.2, crackle: 0.25 } },
      { id: 'corrida', name: 'Sem restrições (corrida)', note: '+9% cv, bruto, estouros', cost: 0.06, power: 1.09, sound: { drive: 1.55, vol: 1.25, rasp: 0.07, low: 1.25, bass: 1.6, mid: 1.38, resShift: 0.92, fbAdd: 0.15, pipe: 0.8, pops: 0.7, burble: 0.45, crackle: 0.6, cabinOpen: 1.05 } }] },
    { id: 'pneus', name: 'Pneus', parts: [ORIGINAL(),
      { id: 'esportivo', name: 'Esportivo de rua', note: '+9% curva, +15% largada', cost: 0.03, grip: 1.09, brake: 1.06, traction: 1.15, handling: 1.045 },
      { id: 'semislick', name: 'Semi slick', note: '+18% curva, +35% largada', cost: 0.07, grip: 1.18, brake: 1.12, traction: 1.35, handling: 1.075 }] },
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
    // controle de largada (3-step): o jogador escolhe o giro em que o carro segura parado (2.500 a 6.000 rpm,
    // os que ficam abaixo do corte); comprado uma vez, mudar o giro não cobra de novo
    { id: 'largada', name: 'Controle de largada', parts: [ORIGINAL('Sem 3-step'), ...launchSteps(car).map((rpm): Part => ({ id: `r${rpm}`, name: `${rpm.toLocaleString('pt-BR')} rpm`, note: '3-step', cost: 0.02, launch: rpm / redlineOf(car), rpm }))] },
    // onde ficam os aparelhos (3-step, boost controller, wastegate) na cabine: lugares medidos em cada
    // painel (devpos.ts); só aparece com algum deles instalado. Mudar de lugar não custa nada
    ...(!build || build.largada || (turbo && !ft && build.pressao) ? [{ id: 'painel' as const, name: 'Aparelhos', parts: devPositions(car.dash, undefined, podMoved(car.dash, pods ? build?.relogios : '')).map((d, i): Part => ({ id: i ? d.id : '', name: d.name, note: 'lugar dos aparelhos', cost: 0 })) }] : []),
    // onde ficam os relógios auxiliares (pressão do turbo/compressor, óleo, combustível): no painel ou
    // na coluna (podpos.ts); só aparece com algum relógio (turbo/compressor, pistões ou alimentação) e
    // nas cabines com os dois lugares medidos. De graça; o primeiro é o lugar de fábrica da cabine
    ...(podPlaces(car.dash).length && (!build || pods) ? [{ id: 'relogios' as const, name: 'Relógios', parts: podPlaces(car.dash).map((d): Part => ({ id: d.id, name: d.name, note: 'lugar dos relógios', cost: 0 })) }] : []),
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
// a peça em vista com o nome que ela tem nesta montagem (o lugar dos aparelhos muda de nome quando os
// relógios trocam de lugar com eles, ver podAlt em devpos.ts)
export const partFor = (car: CarSpec, slot: SlotId, build: Build): Part =>
  slotsFor(car, build).find((s) => s.id === slot)?.parts.find((p) => p.id === (build[slot] ?? '')) ?? partOf(car, slot, build[slot]);
export const partCost = (car: CarSpec, p: Part) => (p.cost ? Math.max(300, Math.round((Number(car.price.replace(/\D/g, '')) * p.cost) / 100) * 100) : 0);
export const buildKey = (b: Build | undefined) => (b ? Object.entries(b).filter(([, v]) => v).sort().map(([k, v]) => `${k}=${v}`).join(',') : '');

/** aplica as peças à ficha (antes de prepareCar): potência, máxima, aderência, ronco e altura */
export function applyBuild(car: CarSpec, build: Build | undefined): CarSpec {
  if (!build || !buildKey(build)) return car;
  let boostMul = 1;
  let power = 1, grip = 1, brake = 1, handling = 1, traction = 1, drop = 0, mass = 1, boost = 0, launchCap: number | undefined, launchRpm: number | undefined, spool: [number, number] | undefined;
  let forced: 'turbo' | 'super' | undefined;
  let wheel: string | undefined;
  const snd: SoundMods = {};
  for (const sl of slotsFor(car, build)) { // só as vagas que valem com a indução instalada
    const p = partOf(car, sl.id, build[sl.id]);
    power *= p.power ?? 1;
    if (p.launch) { launchCap = p.launch; launchRpm = p.rpm; }
    if (p.spool) spool = p.spool;
    grip *= p.grip ?? 1;
    brake *= p.brake ?? 1;
    handling *= p.handling ?? 1;
    traction *= p.traction ?? 1;
    mass *= p.mass ?? 1;
    drop = Math.max(drop, p.drop ?? 0);
    forced = p.forced ?? forced;
    boost = Math.max(boost, p.boost ?? 0);
    boostMul *= p.boostMul ?? 1;
    wheel = p.wheel ?? wheel;
    const m = p.sound;
    if (m) {
      snd.drive = (snd.drive ?? 1) * (m.drive ?? 1);
      snd.vol = (snd.vol ?? 1) * (m.vol ?? 1);
      snd.low = (snd.low ?? 1) * (m.low ?? 1);
      for (const k of ['rev', 'pipe', 'resShift', 'bass', 'mid', 'cabinOpen', 'rush', 'whistle'] as const) if (m[k]) snd[k] = (snd[k] ?? 1) * m[k]!;
      for (const k of ['rasp', 'pops', 'cam', 'intake', 'whine', 'spool', 'blower', 'fbAdd', 'burble', 'crackle'] as const) if (m[k]) snd[k] = (snd[k] ?? 0) + m[k]!;
      if (m.turbo) snd.turbo = true;
    }
  }
  const bi = forced === 'turbo' ? boostInfo(car, build) : null;
  if (bi) {
    power *= bi.power;
    boost = bi.bar;
    if (bi.set) snd.press = bi.bar;
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
    turboHeat: bi?.heat, icEff: bi ? bi.ic : undefined,
    boostMul: boostMul !== 1 ? boostMul : undefined,
    // relógios auxiliares: pressão do turbo/compressor, de óleo (pistões e bielas) e de combustível (alimentação)
    pods: [...(forced ? ['boost' as const] : []), ...(build.pistoes ? ['oil' as const] : []), ...(build.alimentacao ? ['fuel' as const] : [])],
    carb: isCarb(car),
    prep: power,
    launchCap,
    launchRpm,
    // aparelhos na cabine: pressão escolhida no wastegate (carburado) ou boost controller (injeção) e o
    // lugar deles no painel (id de devpos.ts; vazio = o primeiro)
    boostSet: bi?.set ? bi.bar : undefined,
    boostDev: bi?.set ? (isCarb(car) ? 'wastegate' : 'controller') : undefined,
    devPos: build.painel || undefined,
    podPos: (forced || build.pistoes || build.alimentacao) && podPlaces(car.dash).some((p) => p.id && p.id === build.relogios) ? (build.relogios as CarSpec['podPos']) : undefined, // lugar dos relógios (podpos.ts; vazio = o de fábrica)
    // turbo do kit: a .32 (original do kit) enche rápido e cedo; as maiores, devagar e mais em cima
    spool: forced === 'turbo' && !factoryTurbo(car) ? spool ?? [1.6, 0.25] : undefined,
    wheelArt: wheel,
    soundMods: snd,
  };
}

// Aviso ao instalar uma peça, com o nome da vaga e da peça no português certo ("Comando de corrida
// instalado!", "Pistões forjados instalados!", "Discos ventilados instalados!")
type Gen = 'o' | 'a' | 'os' | 'as';
const SLOT_WORD: Record<string, [string, Gen]> = {
  pistoes: ['Pistões e bielas', 'os'], comando: ['Comando', 'o'], intercooler: ['Intercooler', 'o'], escape: ['Escapamento', 'o'],
  largada: ['Controle de largada', 'o'], pneus: ['Pneus', 'os'], suspensao: ['Suspensão', 'a'], turbina: ['Turbina', 'a'], polia: ['Polia de', 'a'], downpipe: ['Downpipe de', 'o'],
};
// adjetivo concordando com a vaga (esportivo -> esportiva/esportivos...)
const agree = (adj: string, g: Gen) => {
  const w = adj.charAt(0).toLowerCase() + adj.slice(1);
  if (/^de /.test(w) || g === 'o') return w;
  return w.replace(/^(\S+?)o(\b| )/, (_, st, sp) => `${st}${g === 'a' ? 'a' : g === 'os' ? 'os' : 'as'}${sp}`).replace(/^(\S+?)a(\b| )/, (m, st, sp) => (g === 'as' ? `${st}as${sp}` : m));
};
export function partInstalledMsg(car: CarSpec, slot: SlotId, p: Part): string {
  const done = (g: Gen) => `instalad${g}!`;
  const id = p.id;
  if (slot === 'largada') return `Controle de largada em ${p.name}!`;
  if (slot === 'painel') return `Aparelhos: ${p.name.toLowerCase()}!`;
  if (slot === 'relogios') return `Relógios: ${p.name.toLowerCase()}!`;
  if (slot === 'pressao') return `${isCarb(car) ? 'Wastegate regulada' : 'Boost controller regulado'} em ${p.name}!`;
  // peças cujo nome já diz tudo, ou que pedem outra frase
  const special: Record<string, string> = {
    'alimentacao:duplo': `Carburador de corpo duplo ${done('o')}`, 'alimentacao:weber': `Dupla carburação de corrida ${done('a')}`,
    'alimentacao:chip': `Chip e bicos ${done('os')}`, 'alimentacao:programavel': `Injeção programável ${done('a')}`,
    'inducao:turbo': `Turbo ${done('o')}`, 'inducao:super': `Supercharger ${done('o')}`, 'inducao:turbomaior': `Turbina maior ${done('a')}`,
    'freios:esportivo': `Discos ventilados ${done('os')}`, 'freios:corrida': `Discos de corrida ${done('os')}`,
    'pneus:esportivo': `Pneus esportivos de rua ${done('os')}`, 'pneus:semislick': `Pneus semi slick ${done('os')}`,
    'bancos:entretenimento': 'Som e entretenimento retirados!', 'bancos:forros': 'Forros de porta retirados!',
    'bancos:acabamentos': 'Acabamentos retirados!', 'bancos:concha': `Bancos de corrida ${done('os')}`,
    'bancos:estrutura': 'Alívio na estrutura feito!', 'bancos:corrida': 'Alívio de corrida feito!',
    'escape:esportivo': `Abafadores esportivos ${done('os')}`, 'escape:semabafador': 'Abafadores retirados!',
    'escape:corrida': `Escapamento sem restrições ${done('o')}`,
  };
  if (special[`${slot}:${id}`]) return special[`${slot}:${id}`];
  if (slot === 'rodas') return `Rodas ${/^[A-Z]{2,}$/.test(p.name) ? p.name : p.name.charAt(0).toLowerCase() + p.name.slice(1)} ${done('as')}`;
  const sw = SLOT_WORD[slot];
  if (sw) {
    const [noun, g] = sw;
    // números (turbina .50, polia 40 mm, downpipe 2,5 pol) entram como estão
    const what = /^[.\d]/.test(p.name) ? p.name : agree(p.name, g);
    return `${noun} ${what} ${done(g)}`;
  }
  const sl = slotsFor(car).find((s) => s.id === slot);
  return `${sl?.name ?? ''} ${p.name.toLowerCase()} ${done('o')}`.trim();
}
