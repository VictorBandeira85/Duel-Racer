// Modo Carreira: regiões com eventos contra pilotos com nome, dinheiro, concessionária,
// garagem (pintura e melhorias) e progresso salvo no aparelho.
import { applyBuild, buildKey, partOf, slotsFor, type Build } from './tuning';
import { CARS, PERF_CLASSES, prepareCar, type CarSpec, type PerfClass } from './cars';
import type { Course, StageDef } from './courses';
import type { RivalStyle } from './race';
import type { ThemeId } from './themes';
import { isObj } from './util';
import { cleanGearing, gearsWith, type Gearing } from './gearbox';
import { healthCar, type Health } from './wear';
import type { RivalRec, SponsorDeal, StreetState } from './rivalry';

export interface Driver { name: string; car: string; style: RivalStyle; skill: number; paint: string; quote: string }
// rematch: revanche contra um rival já vencido (evento opcional; o id leva -rv e não entra em done)
// extras: quantos figurantes correm junto (1 ou 2; sem isso, só o rival). O resultado continua contra o rival
export interface CareerEvent { id: string; name: string; driver: Driver; stages: StageDef[]; prize: number; boss?: boolean; rematch?: boolean; extras?: 1 | 2 }
// after: região cujo chefão libera esta (sem isso, a anterior da lista)
export interface Region { id: string; cls: PerfClass; name: string; desc: string; color: string; events: CareerEvent[]; after?: string }

const st = (theme: ThemeId, lanes: 2 | 4, extra: Partial<StageDef> = {}): StageDef => ({
  theme, lanes, curviness: 1, hilliness: 0.5, sections: 10, traffic: lanes === 4 ? 6 : 4, police: 1, ...extra,
});
const drv = (name: string, car: string, style: RivalStyle, skill: number, paint: string, quote: string): Driver =>
  ({ name, car, style, skill, paint, quote });

// Campeonato por classes: começa na D com carro fraco contra rivais de carro fraco e sobe D, C, B, A, S.
// Cada região é de uma classe (os rivais correm com carros dela) e só aceita carro da mesma classe ou
// abaixo (medida com as peças instaladas). Os prêmios de cada classe pagam o carro da classe seguinte.
export const REGIONS: Region[] = [
  {
    id: 'costa', cls: 'D', name: 'Costa do Sol', desc: 'Estradas à beira-mar, trânsito leve.', color: '#3a8ad0',
    events: [
      { id: 'D-c1', name: 'Racha da Orla', prize: 3000, driver: drv('Dudu Pneu', 'br-voyage', 'cauteloso', 0.86, '#1a9a3a', 'Vai com calma, novato.'), stages: [st('coast', 2, { dusk: true, curviness: 0.6, police: 0, traffic: 3, sections: 8 })] },
      { id: 'D-c2', name: 'Farol Vermelho', prize: 4000, driver: drv('Lia Faísca', 'br-pumagte', 'imprevisivel', 0.885, '#ececec', 'Hoje eu tô inspirada!'), stages: [st('coast', 2, { dusk: true, curviness: 0.8, traffic: 3 })] },
      { id: 'D-c3', name: 'Coqueiral', prize: 5000, extras: 1, driver: drv('Beto Turbo', 'br-passat', 'agressivo', 0.91, '#d01818', 'Sai da minha frente!'), stages: [st('coast', 4, { curviness: 0.7 }), st('forest', 2, { night: true, curviness: 0.7, police: 0 })] },
      { id: 'D-c4', name: 'Pôr do Sol', prize: 6000, driver: drv('Nina Maresia', 'br-voyagesport', 'cauteloso', 0.93, '#18b8d0', 'Constância vence corrida.'), stages: [st('coast', 2, { curviness: 1, tod: 'sunset' }), st('coast', 2, { night: true, curviness: 0.9 })] },
      { id: 'D-c5', name: 'Rei da Praia', prize: 12000, boss: true, driver: drv('Capitão Maré', 'br-monza', 'agressivo', 0.95, '#1f4fd0', 'Esta costa é minha há dez anos.'), stages: [st('coast', 4, { curviness: 0.9 }), st('coast', 2, { curviness: 1.1, weather: 'rain' }), st('forest', 2, { night: true, curviness: 1 })] },
    ],
  },
  {
    id: 'vale', cls: 'D', name: 'Vale Verde', desc: 'Fazendas, colinas e pontes.', color: '#58a83a',
    events: [
      { id: 'D-v1', name: 'Estrada do Celeiro', prize: 4000, driver: drv('Zé Trator', 'br-santana', 'agressivo', 0.92, '#d8c49a', 'Aqui é terra de gente bruta.'), stages: [st('farm', 2, { dusk: true, hilliness: 0.8 })] },
      { id: 'D-v2', name: 'Colheita Rápida', prize: 5000, driver: drv('Rosa Vento', 'br-monzacoupe', 'cauteloso', 0.93, '#7a3ac8', 'Respeite as curvas.'), stages: [st('farm', 2, { hilliness: 0.9, curviness: 1.1 }), st('forest', 2, { night: true })] },
      { id: 'D-v3', name: 'Ponte Velha', prize: 6000, extras: 1, driver: drv('Tico Nitro', 'br-pumagtb', 'imprevisivel', 0.94, '#f0c000', 'Nem eu sei o que vou fazer.'), stages: [st('forest', 4, { tod: 'dawn' }), st('farm', 2, { night: true })] },
      { id: 'D-v4', name: 'Serra Baixa', prize: 7000, driver: drv('Marta Freio', 'br-voyagesport', 'cauteloso', 0.94, '#8a8c92', 'Frear também é pilotar.'), stages: [st('forest', 2, { curviness: 1.2, hilliness: 0.9 }), st('farm', 4, { night: true })] },
      { id: 'D-v5', name: 'Barão do Vale', prize: 15000, boss: true, driver: drv('Barão do Vale', 'br-monza', 'agressivo', 0.96, '#1c1c20', 'Minha fazenda, minhas regras.'), stages: [st('farm', 2, { hilliness: 1 }), st('forest', 2, { night: true, curviness: 1.1 }), st('farm', 4, { weather: 'rain' })] },
    ],
  },
  {
    // biomas novos; clima e hora do dia definidos pela dificuldade do evento
    id: 'tropico', cls: 'C', name: 'Trópico Selvagem', desc: 'Praias, savana, selva e cânion.', color: '#f0a030',
    events: [
      { id: 'C-t1', name: 'Areia Dourada', prize: 6000, driver: drv('Surfista Léo', 'br-corsa', 'cauteloso', 0.93, '#18b8d0', 'A onda boa é a da estrada.'), stages: [st('beach', 4, { curviness: 0.7, police: 0, tod: 'sunset' }), st('beach', 2, { night: true, curviness: 0.8 })] },
      { id: 'C-t2', name: 'Safári', prize: 8000, extras: 1, driver: drv('Juba', 'br-kadett', 'agressivo', 0.94, '#c8a840', 'O rei da savana sou eu.'), stages: [st('savanna', 2, { curviness: 0.8, hilliness: 0.7 }), st('savanna', 4, { night: true, curviness: 0.6 })] },
      { id: 'C-t3', name: 'Chuva na Selva', prize: 10000, driver: drv('Tucano', 'br-uno', 'imprevisivel', 0.945, '#1a9a3a', 'Na mata ninguém me acha.'), stages: [st('jungle', 2, { curviness: 1.1, weather: 'rain' }), st('jungle', 2, { night: true, curviness: 1.2, weather: 'rain' })] },
      { id: 'C-t4', name: 'Pôr do Sol no Cânion', prize: 12000, extras: 2, driver: drv('Coiote', 'br-golgti', 'agressivo', 0.95, '#c8603a', 'Bip bip? Não comigo.'), stages: [st('canyon', 2, { curviness: 1.2, hilliness: 0.9, tod: 'sunset' }), st('canyon', 2, { curviness: 1.3, night: true })] },
      { id: 'C-t5', name: 'Rainha do Trópico', prize: 25000, boss: true, driver: drv('Rainha Jaci', 'br-vectra', 'cauteloso', 0.955, '#f0a030', 'Do mar ao cânion, tudo é meu.'), stages: [st('beach', 4, { curviness: 0.9 }), st('jungle', 2, { curviness: 1.3, weather: 'rain' }), st('canyon', 2, { curviness: 1.4, night: true, hilliness: 1 })] },
    ],
  },
  {
    id: 'deserto', cls: 'C', name: 'Rota do Deserto', desc: 'Retas longas, calor e polícia.', color: '#d0a860',
    events: [
      { id: 'C-d1', name: 'Miragem', prize: 8000, driver: drv('Sol Escaldante', 'br-uno', 'agressivo', 0.94, '#f0c000', 'O asfalto derrete, eu não.'), stages: [st('desert', 4, { dusk: true, police: 2 })] },
      { id: 'C-d2', name: 'Cânion', prize: 10000, extras: 1, driver: drv('Kiko Poeira', 'br-corsa', 'imprevisivel', 0.945, '#d8c49a', 'Cuidado com a poeira!'), stages: [st('desert', 2, { curviness: 1.2, hilliness: 0.8, tod: 'dawn' }), st('desert', 2, { night: true, police: 2 })] },
      { id: 'C-d3', name: 'Oásis Noturno', prize: 12000, extras: 2, driver: drv('Vera Lua', 'br-kadett', 'cauteloso', 0.95, '#7a3ac8', 'A noite é minha aliada.'), stages: [st('desert', 4, { night: true }), st('desert', 2, { night: true, curviness: 1.1 })] },
      { id: 'C-d4', name: 'Tempestade de Areia', prize: 15000, driver: drv('Tenente Brasa', 'patrol', 'agressivo', 0.955, '#f2f2f2', 'Racha na minha rodovia? Então vamos correr.'), stages: [st('desert', 2, { curviness: 1.3 }), st('desert', 4, { night: true, police: 2 })] },
      { id: 'C-d5', name: 'O Escorpião', prize: 30000, boss: true, driver: drv('Escorpião', 'br-golgti', 'agressivo', 0.96, '#1c1c20', 'Ninguém atravessa o deserto na minha frente.'), stages: [st('desert', 4, { police: 2 }), st('desert', 2, { curviness: 1.3, hilliness: 0.9 }), st('desert', 2, { night: true, curviness: 1.2 })] },
    ],
  },
  {
    id: 'metropole', cls: 'B', name: 'Metrópole', desc: 'Avenidas cheias, viadutos e noite.', color: '#8a8aa8',
    events: [
      { id: 'B-m1', name: 'Hora do Rush', prize: 20000, extras: 2, driver: drv('Táxi Veloz', 'serpe-v10', 'imprevisivel', 0.95, '#f0c000', 'Corrida até o aeroporto?'), stages: [st('city', 4, { dusk: true, traffic: 8, police: 2 })] },
      { id: 'B-m2', name: 'Avenida Neon', prize: 25000, driver: drv('Dani Neon', 'kaze-nx', 'cauteloso', 0.96, '#18b8d0', 'Luzes, câmera, aceleração.'), stages: [st('city', 4, { night: true, traffic: 7 }), st('city', 4, { night: true, police: 2 })] },
      { id: 'B-m3', name: 'Túnel do Centro', prize: 30000, extras: 1, driver: drv('Capitã Sirene', 'furia-tr', 'agressivo', 0.96, '#f2f2f2', 'Se ganhar de mim, a multa fica pra outro dia.'), stages: [st('city', 4, { traffic: 8, tod: 'dawn' }), st('forest', 4, { night: true })] },
      { id: 'B-m4', name: 'Chuva no Asfalto', prize: 35000, driver: drv('Iara Tormenta', 'kaze-nx', 'imprevisivel', 0.97, '#1f4fd0', 'Chuva é meu clima favorito.'), stages: [st('city', 4, { weather: 'rain', traffic: 7 }), st('city', 4, { weather: 'rain', night: true, police: 2 })] },
      { id: 'B-m5', name: 'Dama da Noite', prize: 80000, boss: true, driver: drv('Dama da Noite', 'furia-tr', 'cauteloso', 0.965, '#d01818', 'A cidade dorme. Eu não.'), stages: [st('city', 4, { night: true, traffic: 8, police: 2 }), st('city', 4, { weather: 'rain', night: true }), st('city', 4, { night: true, police: 3 })] },
    ],
  },
  {
    id: 'fronteira', cls: 'A', name: 'Fronteira Norte', desc: 'Outono, indústrias, penhascos e Alpes.', color: '#6aa0d0',
    events: [
      { id: 'A-f1', name: 'Folhas ao Vento', prize: 40000, driver: drv('Outonal', 'vortex-zr', 'cauteloso', 0.965, '#d07a2a', 'Cada curva, uma folha.'), stages: [st('autumn', 2, { curviness: 1.1, hilliness: 0.8, tod: 'sunset' }), st('autumn', 4, { night: true, curviness: 0.9 })] },
      { id: 'A-f2', name: 'Turno da Noite', prize: 50000, extras: 2, driver: drv('Operário', 'toro-lp5', 'agressivo', 0.97, '#7a7a6a', 'Bati o ponto. Agora é corrida.'), stages: [st('industrial', 4, { night: true, traffic: 8, police: 2 }), st('industrial', 4, { night: true, police: 2 })] },
      { id: 'A-f3', name: 'Neblina na Metrópole', prize: 60000, extras: 1, driver: drv('Fantasma', 'vortex-zr', 'imprevisivel', 0.975, '#ececec', 'Você vai ouvir, mas não vai ver.'), stages: [st('city', 4, { weather: 'rain', traffic: 9, police: 2 }), st('industrial', 4, { weather: 'rain', night: true, police: 3 })] },
      { id: 'A-f4', name: 'Beira do Abismo', prize: 70000, extras: 1, driver: drv('Águia', 'toro-lp5', 'agressivo', 0.98, '#d81a12', 'Lá de cima eu vejo tudo.'), stages: [st('mountain', 2, { curviness: 1.7, hilliness: 1 }), st('coast', 2, { curviness: 1.6, weather: 'rain', night: true })] },
      { id: 'A-f5', name: 'Barão dos Alpes', prize: 150000, boss: true, driver: drv('Barão Gélido', 'vortex-zr', 'agressivo', 0.99, '#6aa0d0', 'Lá no alto o ar é rarefeito. Para você.'), stages: [st('alpine', 2, { curviness: 1.5, hilliness: 1 }), st('alpine', 2, { curviness: 1.6, weather: 'rain', night: true }), st('alpinesnow', 2, { weather: 'snow', curviness: 1.5, hilliness: 1 })] },
    ],
  },
  {
    id: 'cume', cls: 'S', name: 'Cume Gelado', desc: 'Serra, neve e o lendário Rei da Serra.', color: '#e0e8f0',
    events: [
      { id: 'S-g1', name: 'Primeira Neve', prize: 70000, driver: drv('Ulf Gelo', 'toro-v12', 'cauteloso', 0.97, '#ececec', 'Na neve, quem corre muito, para.'), stages: [st('snow', 2, { dusk: true, weather: 'snow', curviness: 1.2, hilliness: 0.9 })] },
      { id: 'S-g2', name: 'Curva do Abismo', prize: 80000, extras: 1, driver: drv('Paulo Penhasco', 'silber-95', 'agressivo', 0.98, '#d81a12', 'Olha pra frente, não pra baixo.'), stages: [st('mountain', 2, { curviness: 1.5, hilliness: 1, tod: 'dawn' }), st('snow', 2, { night: true, weather: 'snow' })] },
      { id: 'S-g3', name: 'Tempestade Branca', prize: 90000, extras: 1, driver: drv('Capitã Sirene', 'patrol-sv', 'imprevisivel', 0.98, '#f2f2f2', 'Na serra também tem lei.'), stages: [st('snow', 2, { weather: 'snow', curviness: 1.3 }), st('mountain', 2, { night: true, weather: 'rain', curviness: 1.4 })] },
      { id: 'S-g4', name: 'Noite na Serra', prize: 100000, extras: 2, driver: drv('Lobo Solitário', 'silber-95', 'agressivo', 0.985, '#1c1c20', 'Uuuuuu.'), stages: [st('mountain', 2, { night: true, curviness: 1.5 }), st('snow', 2, { night: true, weather: 'snow' })] },
      { id: 'S-g5', name: 'Rei da Serra', prize: 250000, boss: true, driver: drv('Rei da Serra', 'furia-f4', 'agressivo', 0.995, '#f0c000', 'Chegou longe. Mas aqui termina.'), stages: [st('snow', 2, { weather: 'snow', curviness: 1.4, hilliness: 1 }), st('mountain', 2, { curviness: 1.6, hilliness: 1, weather: 'rain' }), st('mountain', 2, { night: true, curviness: 1.5 })] },
    ],
  },
];

// ---------- rivais de carro preparado ----------
// Os mecânicos e preparadores das fichas (rivals.ts) correm com peças, mais nas fases avançadas. A física e a
// IA usam a ficha preparada (potência, máxima, aderência, freio) e o ronco de fora leva as peças (soundMods).
export const RIVAL_BUILDS: Record<string, Build> = {
  'Dudu Pneu': { pneus: 'esportivo' }, // borracheiro: "troquei os quatro pneus"
  'Beto Turbo': { alimentacao: 'duplo', escape: 'esportivo', pneus: 'esportivo' }, // mecânico de oficina de bairro
  'Tico Nitro': { inducao: 'super', alimentacao: 'duplo' }, // inventor de garagem
  'Kiko Poeira': { pneus: 'semislick', suspensao: 'esportiva', bancos: 'forros' }, // piloto de rali
  'Escorpião': { comando: 'esportivo', escape: 'semabafador' }, // ferrão no pé direito
  'Táxi Veloz': { alimentacao: 'chip', escape: 'esportivo' }, // taxista que envenenou o carro
  'Dani Neon': { suspensao: 'corrida', rodas: 'r06', escape: 'semabafador' }, // carro rebaixado
  'Operário': { pistoes: 'forjados', comando: 'esportivo', alimentacao: 'duplo', escape: 'esportivo' }, // montou o Toro peça por peça
  'Barão Gélido': { alimentacao: 'programavel', pneus: 'esportivo', freios: 'corrida' }, // dinheiro de família europeia
  'Lobo Solitário': { escape: 'corrida', bancos: 'concha', comando: 'esportivo' },
  'Rei da Serra': { inducao: 'turbomaior', pneus: 'esportivo' }, // campeão de subida de montanha
};
// rivalidade (rivalry.ts): peças que o rival pôs depois de perder para o jogador e o tanto que ficou mais afiado
export const rivalExtra: { build: (d: Driver) => Build | undefined; skill: (d: Driver) => number } = { build: () => undefined, skill: () => 0 };
export const driverBuild = (d: Driver): Build | undefined => rivalExtra.build(d) ?? RIVAL_BUILDS[d.name];
const driverCars = new Map<string, CarSpec>();
/** carro do piloto da carreira: o de fábrica ou, para os preparadores, com as peças dele */
export function driverCar(d: Driver): CarSpec {
  const key = `${d.name}|${d.car}|${buildKey(driverBuild(d))}`;
  let c = driverCars.get(key);
  if (!c) {
    const base = CARS.find((x) => x.id === d.car)!;
    const b = driverBuild(d);
    driverCars.set(key, (c = b ? prepareCar(applyBuild(base, b)) : base));
  }
  return c;
}
/** peças do rival em poucas palavras (ficha da entrevista): "Turbo, escapamento" */
export function buildSummary(d: Driver): string[] {
  const b = driverBuild(d);
  if (!b) return [];
  const car = CARS.find((x) => x.id === d.car)!;
  return slotsFor(car, b).filter((sl) => b[sl.id]).map((sl) => {
    const p = partOf(car, sl.id, b[sl.id]);
    return sl.id === 'rodas' ? 'rodas' : sl.id === 'inducao' || sl.id === 'alimentacao' ? p.name : `${sl.name.toLowerCase()} ${p.name.toLowerCase()}`;
  });
}
// Equilíbrio do preparado (medido com o rival sozinho, 6 pistas por evento: +1 a +5,5% de ritmo sobre o de
// fábrica, chefões no topo; as peças foram escolhidas para isso). A máxima maior faria o rival andar acima do
// ritmo do evento o tempo todo; a habilidade compensa até ficar no máximo +3% no ritmo de cruzeiro (arranque,
// curva e freio continuam melhores: é aí que ele fica mais duro). Prêmio +10% contra rival preparado.
export const PREP_PACE = 1.03;
export function rivalSkillOf(d: Driver) {
  const b = driverBuild(d);
  const sk = Math.min(0.995, d.skill + rivalExtra.skill(d)); // rival que já perdeu para o jogador: mais afiado
  if (!b) return sk;
  const base = CARS.find((x) => x.id === d.car)!;
  return Math.min(sk, (sk * PREP_PACE * base.maxSpeed) / driverCar(d).maxSpeed);
}
export const prizeOf = (ev: CareerEvent) => (driverBuild(ev.driver) ? Math.round((ev.prize * 1.1) / 500) * 500 : ev.prize);

// ---------- figurantes ----------
// Nos eventos com `extras`, 1 ou 2 pilotos de outros eventos da mesma classe correm junto (carro de fábrica,
// habilidade um pouco abaixo da do rival, jeito de pilotar deles). Sempre os mesmos para o mesmo evento.
// Fora os chefões e as viaturas; cor trocada se repetir a do rival ou a do outro figurante.
export function eventExtras(ev: CareerEvent): Driver[] {
  const n = ev.extras ?? 0;
  if (!n) return [];
  const baseId = ev.id.replace(/-rv$/, '');
  const reg = REGIONS.find((r) => r.events.some((e) => e.id === baseId));
  if (!reg) return [];
  const seen = new Set([ev.driver.name]);
  const pool: Driver[] = [];
  for (const r of REGIONS) if (r.cls === reg.cls) for (const e of r.events) {
    const d = e.driver;
    if (e.boss || seen.has(d.name) || d.car.startsWith('patrol')) continue;
    seen.add(d.name);
    pool.push(d);
  }
  let h = 0;
  for (const ch of baseId) h = (h * 131 + ch.charCodeAt(0)) >>> 0;
  const rnd = () => ((h = (h * 1103515245 + 12345) >>> 0) / 4294967296);
  // embaralha pela semente do evento e prefere carros diferentes do rival e entre si
  const order = pool.map((d) => ({ d, k: rnd() })).sort((a, b) => a.k - b.k).map((o) => o.d);
  const out: Driver[] = [];
  for (const pass of [0, 1]) for (const d of order) {
    if (out.length >= n || out.includes(d)) continue;
    if (pass === 0 && (d.car === ev.driver.car || out.some((o) => o.car === d.car))) continue;
    out.push(d);
  }
  const used = [ev.driver.paint];
  const ALT = ['#1f4fd0', '#d01818', '#1a9a3a', '#f0c000', '#ececec', '#1c1c20', '#7a3ac8', '#18b8d0', '#d07a2a'];
  return out.map((d) => {
    const paint = used.includes(d.paint) ? ALT.find((c) => !used.includes(c))! : d.paint;
    used.push(paint);
    return { ...d, paint, skill: Math.max(0.84, Math.min(d.skill, ev.driver.skill) - 0.015) };
  });
}

// ---------- melhorias ----------
export type Upgrade = 'motor' | 'cambio' | 'pneus';
export const MAX_LEVEL = 3;
export const priceOf = (car: CarSpec) => Number(car.price.replace(/\D/g, ''));
export const upgradeCost = (car: CarSpec, level: number) => Math.round((priceOf(car) * 0.07 * level) / 500) * 500;
// revenda: 60% do preço; carro rodado (comprado usado) perde pelo km e pelos defeitos ainda não consertados
export const sellValue = (car: CarSpec, cs?: CareerSave) => {
  const km = cs?.odo?.[car.id] ?? 0;
  const fix = wearOf(cs, car.id).reduce((t, d) => t + repairCost(car, d), 0);
  return Math.max(1000, Math.round((priceOf(car) * 0.6 * Math.max(0.45, 1 - km / 400000) - fix) / 1000) * 1000);
};

// ---------- defeitos de carro usado (classificados) ----------
// Cada defeito aparece no jogo (lateral riscada/amassada, trinca no para-brisa, fumaça) e pesa na ficha;
// fix = fração do preço de 0 km que a oficina cobra para consertar
export type Defect = 'pintura' | 'amassado' | 'parabrisa' | 'fumaca' | 'pneus' | 'suspensao';
export const DEFECTS: Record<Defect, { name: string; ad: string; effect: string; fix: number }> = {
  pintura: { name: 'Pintura queimada', ad: 'pintura queimada de sol, riscos', effect: 'só a aparência', fix: 0.05 },
  amassado: { name: 'Lataria amassada', ad: 'amassados na lateral', effect: '-2% máxima, capô torto', fix: 0.05 },
  parabrisa: { name: 'Para-brisa trincado', ad: 'para-brisa trincado', effect: 'trinca na vista da cabine', fix: 0.02 },
  fumaca: { name: 'Motor cansado', ad: 'motor soltando fumaça', effect: '-15% potência, fumaça', fix: 0.12 },
  pneus: { name: 'Pneus carecas', ad: 'pneus carecas', effect: '-12% aderência e freio', fix: 0.03 },
  suspensao: { name: 'Suspensão com ruído', ad: 'barulho na suspensão', effect: '-10% dirigibilidade', fix: 0.04 },
};
export const DEFECT_IDS = Object.keys(DEFECTS) as Defect[];
export const wearOf = (cs: CareerSave | undefined | null, id: string): Defect[] => (cs?.wear?.[id] ?? []).filter((d) => d in DEFECTS);
export const repairCost = (car: CarSpec, d: Defect) => Math.max(300, Math.round((priceOf(car) * DEFECTS[d].fix) / 100) * 100);
// ficha com os defeitos: motor cansado perde força, pneu careca e suspensão gasta perdem aderência
export function wornCar(car: CarSpec, wear?: Defect[]): CarSpec {
  if (!wear?.length) return car;
  const has = (d: Defect) => wear.includes(d);
  const power = has('fumaca') ? 0.85 : 1;
  const grip = (has('pneus') ? 0.88 : 1) * (has('suspensao') ? 0.95 : 1);
  return {
    ...car,
    accel: car.accel * power,
    maxSpeed: car.maxSpeed * Math.cbrt(power) * (has('amassado') ? 0.98 : 1),
    lateralG: car.lateralG * grip,
    brakeG: car.brakeG * (has('pneus') ? 0.92 : 1),
    traction: (car.traction ?? 1) * (has('pneus') ? 0.9 : 1),
    handling: car.handling * (has('suspensao') ? 0.9 : 1),
  };
}
export const START_MONEY = 20000; // dá para um carro da classe D (o primeiro da carreira)
// a classe do carro (com as peças) cabe na região? (carro de classe abaixo também corre)
export const classFits = (carCls: PerfClass, regionCls: PerfClass) => PERF_CLASSES.indexOf(carCls) <= PERF_CLASSES.indexOf(regionCls);

// carro com as melhorias aplicadas (mesmo id: pintura, cabine e sprites continuam os mesmos)
// Ajustes da oficina (de graça, mudam a qualquer hora): relação de marchas, suspensão e rodas
// ratio -1 curta, 0, 1 longa (antigo: vira o diferencial ±2 passos); susp 0..2; gears/final: câmbio por marcha (gearbox.ts)
export interface Setup extends Gearing { ratio: number; susp: number; rims: string }
export const DEFAULT_SETUP: Setup = { ratio: 0, susp: 0, rims: '' };
export const RATIO_LABEL = ['CURTA', 'ORIGINAL', 'LONGA'];
export const SUSP_LABEL = ['ORIGINAL', 'ESPORTIVA', 'REBAIXADA'];
export const setupOf = (cs: CareerSave, id: string): Setup => {
  const st: Setup = { ...DEFAULT_SETUP, ...(cs.setup?.[id] ?? {}) };
  // câmbio do save conferido (passos inteiros, do tamanho do câmbio, marchas em ordem); senão, original
  const car = CARS.find((c) => c.id === id);
  const g = car ? cleanGearing(car, { gears: st.gears, final: st.final ?? (st.ratio === 1 || st.ratio === -1 ? st.ratio * 2 : 0) }) : undefined;
  return { ...st, ratio: g ? 0 : st.ratio, gears: g?.gears, final: g?.final };
};
export const buildOf = (cs: CareerSave, id: string): Build => cs.builds?.[id] ?? {};

export function tunedCar(car0: CarSpec, _lv?: unknown, st: Setup = DEFAULT_SETUP, build?: Build, wear?: Defect[], health?: Health): CarSpec {
  // as peças da preparação (tuning.ts) são o único caminho de melhoria; aqui entram os ajustes de graça:
  // o câmbio por marcha e o diferencial (gearbox.ts), os defeitos do carro usado e o desgaste (wear.ts)
  const car = healthCar(wornCar(applyBuild(car0, build), wear), health, wear);
  const tuned = prepareCar({ ...car, rims: st.rims || undefined }); // (arrasto medido com as relações de fábrica)
  // relações novas: a física de verdade decide a máxima (curto bate no corte antes, longo só ganha com fôlego)
  const legacy = st.final === undefined && !st.gears && (st.ratio === 1 || st.ratio === -1) ? st.ratio * 2 : undefined;
  tuned.gears = gearsWith(car.gears, { gears: st.gears, final: st.final ?? legacy });
  return tuned;
}

// ---------- save ----------
export interface CareerSave {
  money: number;
  owned: string[];
  car: string; // carro ativo
  upgrades: Record<string, Record<Upgrade, number>>;
  setup?: Record<string, Setup>; // ajustes da oficina por carro
  builds?: Record<string, Build>; // peças instaladas (preparação) por carro
  parts?: Record<string, string[]>; // peças já compradas por carro ("vaga:peça"): trocar de volta não cobra de novo
  done: string[]; // eventos vencidos
  wins: number;
  races: number;
  earned: number;
  // (campos novos, todos opcionais: saves antigos carregam sem eles)
  wear?: Record<string, Defect[]>; // defeitos do carro comprado usado, até a oficina consertar
  odo?: Record<string, number>; // hodômetro (km) do carro comprado usado (km do anúncio + rodados)
  usedSold?: string[]; // anúncios dos classificados já comprados ("semente:carro")
  beatenAt?: Record<string, number>; // vitórias que o jogador tinha quando venceu o evento pela 1ª vez (revanche)
  rematches?: string[]; // revanches já vencidas (id do evento)
  stats?: CareerStats; // estatísticas da carreira (tela ESTATÍSTICAS)
  health?: Record<string, Health>; // desgaste de pneus e motor por carro (wear.ts, upkeep.ts; sem isso = novo)
  wanted?: number; // ficha na polícia: multas e fugas acumuladas (perseguição mais dura); saves antigos sem isso = 0
  rivals?: Record<string, RivalRec>; // histórico com cada rival (rivalry.ts)
  sponsor?: SponsorDeal; // contrato de patrocínio em andamento (rivalry.ts)
  street?: StreetState; // rachas de rua noturnos: convite pendente e contagem (rivalry.ts)
}

const KEY = 'duel-racer:career';
// FASE DE TESTES (pedido do Victor): toda carreira, nova ou salva, tem pelo menos este saldo para
// experimentar carros e peças. Pôr 0 para desligar quando os testes acabarem.
export const TEST_MONEY = 1_000_000;
export function loadCareer(): CareerSave | null {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (!s || typeof s !== 'object' || typeof s.money !== 'number' || !Number.isFinite(s.money)) return null;
    // save de outra versão ou estragado: cada campo volta ao tipo certo (lista, número, objeto) em vez de
    // derrubar a tela da carreira; carro que saiu do jogo deixa de contar
    const list = (v: unknown) => (Array.isArray(v) ? v.filter((x) => typeof x === 'string') : []);
    for (const k of ['owned', 'done'] as const) s[k] = list(s[k]);
    for (const k of ['usedSold', 'rematches'] as const) if (s[k] !== undefined) s[k] = list(s[k]);
    for (const k of ['wins', 'races', 'earned'] as const) if (typeof s[k] !== 'number' || !Number.isFinite(s[k])) s[k] = 0;
    for (const k of ['setup', 'builds', 'parts', 'paint', 'wear', 'odo', 'beatenAt', 'stats', 'rivals', 'sponsor', 'street'] as const) if (s[k] !== undefined && !isObj(s[k])) delete s[k];
    // peças instaladas: cada vaga guarda o id da peça (texto); valor estranho sai e a vaga volta à original
    // (id desconhecido, como uma pressão fora da lista do wastegate, já cai na original em partOf)
    if (s.builds) for (const [id, b] of Object.entries(s.builds as Record<string, unknown>)) {
      if (!isObj(b)) delete s.builds[id];
      else for (const [k, v] of Object.entries(b as Record<string, unknown>)) if (typeof v !== 'string') delete (b as Record<string, unknown>)[k];
    }
    if (!isObj(s.upgrades)) s.upgrades = {};
    if (s.wanted !== undefined && (typeof s.wanted !== 'number' || !Number.isFinite(s.wanted))) s.wanted = 0;
    // melhorias genéricas antigas (motor/câmbio/pneus por nível) saíram: o que foi gasto volta em dinheiro
    for (const [id, lv] of Object.entries((s.upgrades ?? {}) as Record<string, Record<string, number>>)) {
      const car = CARS.find((c) => c.id === id);
      if (car) for (const l of Object.values(lv)) for (let k = 1; k <= l; k++) s.money += upgradeCost(car, k);
    }
    s.upgrades = {};
    // o Ímola de quatro portas saiu do jogo: quem tinha fica com o cupê (mesma ficha), peças e cor juntas
    const OLD = 'br-monzasedan', NEW = 'br-monzacoupe';
    if (Array.isArray(s.owned) && s.owned.includes(OLD)) {
      s.owned = s.owned.filter((id: string) => id !== OLD);
      if (!s.owned.includes(NEW)) {
        s.owned.push(NEW);
        for (const k of ['builds', 'parts', 'setup', 'paint'] as const) if (s[k]?.[OLD] !== undefined && s[k][NEW] === undefined) s[k][NEW] = s[k][OLD];
      }
      for (const k of ['builds', 'parts', 'setup', 'paint'] as const) if (s[k]) delete s[k][OLD];
    }
    if (s.car === OLD) s.car = NEW;
    s.owned = s.owned.filter((id: string) => CARS.some((c) => c.id === id));
    if (typeof s.car !== 'string' || !s.owned.includes(s.car)) s.car = s.owned[0] ?? '';
    if (s.money < TEST_MONEY) s.money = TEST_MONEY;
    return s;
  } catch {
    return null;
  }
}
export function saveCareer(s: CareerSave) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    // armazenamento cheio (fantasmas e recordes ocupam espaço): a carreira tem a vez; os fantasmas saem
    try {
      localStorage.removeItem('duel-racer:fantasmas');
      localStorage.setItem(KEY, JSON.stringify(s));
    } catch {
      /* sem armazenamento: vale só nesta sessão */
    }
  }
}
export function newCareer(): CareerSave {
  return { money: Math.max(START_MONEY, TEST_MONEY), owned: [], car: '', upgrades: {}, done: [], wins: 0, races: 0, earned: 0 };
}

export const levels = (s: CareerSave, id: string): Record<Upgrade, number> => s.upgrades[id] ?? { motor: 0, cambio: 0, pneus: 0 };
export const carById = (id: string) => CARS.find((c) => c.id === id)!;

// região liberada quando o chefão da região indicada (ou da anterior) foi vencido
export function regionUnlocked(s: CareerSave, ri: number) {
  if (ri === 0) return true;
  const prev = REGIONS.find((r) => r.id === REGIONS[ri].after) ?? REGIONS[ri - 1];
  return prev.events.some((e) => e.boss && s.done.includes(e.id));
}
// regiões que o chefão desta libera
export const regionsAfter = (ri: number) => REGIONS.filter((r, i) => i > 0 && (r.after ?? REGIONS[i - 1].id) === REGIONS[ri].id);
// eventos em ordem: cada um libera o seguinte; o chefão exige os quatro anteriores
export function eventUnlocked(s: CareerSave, ri: number, ei: number) {
  if (!regionUnlocked(s, ri)) return false;
  const evs = REGIONS[ri].events;
  if (evs[ei].boss) return evs.filter((e) => !e.boss).every((e) => s.done.includes(e.id));
  return ei === 0 || s.done.includes(evs[ei - 1].id);
}

// percurso de corrida para um evento (semente própria para cada evento)
export function eventCourse(ev: CareerEvent, attempt = 0): Course {
  let seed = 0;
  for (const ch of ev.id) seed = seed * 31 + ch.charCodeAt(0);
  seed += attempt * 7919; // trânsito e polícia mudam a cada tentativa (as pistas também)
  return { id: `car-${ev.id}`, name: ev.name, level: ev.boss ? 'Chefão' : 'Evento', rivalSkill: rivalSkillOf(ev.driver), stages: ev.stages, seed };
}

// ---------- resultado ----------
export interface EventResult {
  won: boolean;
  gameOver: boolean;
  prize: number;
  clean: number; // bônus por trechos limpos
  fines: number;
  repairs: number;
  total: number;
  firstWin: boolean;
  // figurantes: posição final do jogador entre todos (pelo tempo total) e o bônus por chegar à frente deles
  pos?: number;
  of?: number;
  field?: number;
  bet?: string; // racha de rua: rótulo da aposta no extrato (no lugar de Prêmio/Participação)
}

// ---------- estatísticas da carreira ----------
// km e contagens somadas no fim de cada trecho (logStage); eventos, dinheiro e recordes no resultado
export interface CareerStats {
  km: number; stages: number; events: number; eventWins: number; eventLosses: number;
  tickets: number; finesPaid: number; escapes: number; crashes: number; falls: number;
  top: number; topCar: string; carKm: Record<string, number>;
  earned: number; spent: number;
  best: Record<string, { t: number; car: string }>; // melhor tempo total de cada evento vencido
}
// estatísticas do save (save antigo: começa das contagens que ele já tinha)
export function statsOf(s: CareerSave): CareerStats {
  const d: CareerStats = {
    km: 0, stages: 0, events: s.races ?? 0, eventWins: s.wins ?? 0, eventLosses: Math.max(0, (s.races ?? 0) - (s.wins ?? 0)),
    tickets: 0, finesPaid: 0, escapes: 0, crashes: 0, falls: 0, top: 0, topCar: '', carKm: {}, earned: s.earned ?? 0, spent: 0, best: {},
  };
  s.stats = { ...d, ...(s.stats ?? {}) };
  return s.stats;
}
// dinheiro gasto (compras, peças, consertos, multas): entra nas estatísticas
export function spend(s: CareerSave, v: number) {
  if (v > 0) statsOf(s).spent += v;
}
// fim de um trecho: km rodados (também no hodômetro do carro usado), multas, fugas, batidas, máxima
export function logStage(s: CareerSave, carId: string, r: { km: number; top: number; tickets: number; crashes: number; escapes?: number; falls?: number }) {
  const st = statsOf(s);
  const km = Math.max(0, r.km || 0);
  st.km += km;
  st.stages++;
  st.carKm[carId] = (st.carKm[carId] ?? 0) + km;
  if (s.odo?.[carId] !== undefined) s.odo[carId] += km;
  st.tickets += r.tickets || 0;
  st.crashes += r.crashes || 0;
  st.escapes += r.escapes || 0;
  st.falls += r.falls || 0;
  if (r.top > st.top) {
    st.top = r.top;
    st.topCar = carId;
  }
  saveCareer(s);
}

// ---------- revanche ----------
// Rival vencido volta desafiando depois de mais duas vitórias do jogador (save antigo: já pode)
export const REMATCH_AFTER = 2;
export function rematchOpen(s: CareerSave, ev: CareerEvent) {
  if (!s.done.includes(ev.id) || (s.rematches ?? []).includes(`${ev.id}-rv`)) return false;
  // save antigo sem beatenAt: a ordem em done serve de aproximação (1º vencido = 1 vitória)
  return s.wins >= (s.beatenAt?.[ev.id] ?? s.done.indexOf(ev.id) + 1) + REMATCH_AFTER;
}
// a revanche: o mesmo rival um pouco mais afiado, mesmo roteiro com outro trânsito, prêmio de 80%
export function rematchEvent(ev: CareerEvent): CareerEvent {
  return {
    ...ev, id: `${ev.id}-rv`, name: `${ev.name} (revanche)`, rematch: true, prize: Math.round((ev.prize * 0.8) / 500) * 500,
    driver: { ...ev.driver, skill: Math.min(0.995, ev.driver.skill + 0.012) },
  };
}
export const rematchCount = (s: CareerSave) => REGIONS.reduce((n, r) => n + r.events.filter((e) => rematchOpen(s, e)).length, 0);

// bônus por figurante deixado para trás (tempo total menor que o dele): 5% do prêmio do evento cada
export const FIELD_BONUS = 0.05;
export function settleEvent(s: CareerSave, ev: CareerEvent, won: boolean, gameOver: boolean, cleanStages: number, fines: number, crashes: number, time = 0, field?: { pos: number; of: number; beaten: number }): EventResult {
  const doneList = ev.rematch ? (s.rematches ??= []) : s.done;
  const firstWin = won && !doneList.includes(ev.id);
  // vitória: prêmio (metade na repetição); derrota terminando a prova: 15% de participação
  const base = prizeOf(ev);
  const prize = won ? (firstWin ? base : Math.round(base / 2 / 500) * 500) : gameOver ? 0 : Math.round((base * 0.15) / 100) * 100;
  const clean = won ? Math.round((base * 0.1 * cleanStages) / 100) * 100 : 0;
  const fieldBonus = field && !gameOver ? field.beaten * Math.round((base * FIELD_BONUS) / 100) * 100 : 0;
  const repairs = Math.round((priceOf(carById(s.car)) * 0.01 * crashes) / 100) * 100;
  fines = Math.max(0, fines);
  const total = prize + clean + fieldBonus - fines - repairs;
  s.money = Math.max(0, s.money + total);
  s.races++;
  if (won) {
    s.wins++;
    if (firstWin) doneList.push(ev.id);
    if (firstWin && !ev.rematch) s.beatenAt = { ...(s.beatenAt ?? {}), [ev.id]: s.wins };
  }
  s.earned += Math.max(0, prize + clean + fieldBonus);
  const st = statsOf(s);
  st.events++;
  if (won) st.eventWins++;
  else st.eventLosses++;
  st.earned += Math.max(0, prize + clean + fieldBonus);
  st.finesPaid += fines;
  st.spent += fines + repairs;
  if (won && time > 0 && time < (st.best[ev.id]?.t ?? Infinity)) st.best[ev.id] = { t: time, car: s.car };
  saveCareer(s);
  return { won, gameOver, prize, clean, fines, repairs, total, firstWin, ...(field && !gameOver ? { pos: field.pos, of: field.of, field: fieldBonus } : {}) };
}
