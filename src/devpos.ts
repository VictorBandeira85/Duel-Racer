// Aparelhos da preparação na cabine (3-step, boost controller, wastegate): onde o jogador escolhe
// pô-los (vaga 'painel' em tuning.ts). Cada cabine atualizada tem 2 a 4 lugares medidos na arte
// (medidos em prints do jogo com grade em pixels da arte), sempre apoiados no painel, console ou coluna, sem
// tapar quadro, radar, retrovisor, volante nem os manômetros auxiliares (pod). As outras cabines
// usam um lugar padrão sobre o painel, ao lado do radar.
// x: centro do grupo de aparelhos (pixels da arte, como pod); y: linha do pé (base da imagem);
// s: escala (1 = caixinha do 3-step com 32 pixels de largura, ~9 cm na escala do quadro); dir: 'h' lado a lado,
// 'v' um em cima do outro (o primeiro embaixo); lean: na pilha vertical, quanto x anda por linha
// subindo (segue a inclinação da coluna); mount: 'top' apoiado em cima do painel (sombra no pé),
// 'face' preso numa face do painel/console/coluna (sombra atrás)
export interface DevPos { id: string; name: string; x: number; y: number; s?: number; dir?: 'h' | 'v'; lean?: number; mount?: 'top' | 'face' }

const TOP = 'Sobre o painel', SIDE = 'Ao lado do volante', CONSOLE = 'No console', VENT = 'Na saída de ar', PILLAR = 'Na coluna';
export const DEV_POS: Record<string, DevPos[]> = {
  // Fúria F4: relógios auxiliares no alto do painel (228 a 277); console da arte com os três relógios
  // (coluna fina demais: o aparelho ficaria no vidro)
  f40: [
    { id: 'painel', name: TOP, x: 24, y: 27, s: 0.75, mount: 'top' }, // no alto do painel, à esquerda do volante
    { id: 'esquerda', name: SIDE, x: 14, y: 86, s: 0.9, mount: 'face' },
    { id: 'console', name: CONSOLE, x: 312, y: 98, s: 0.75, mount: 'face' },
  ],
  // Toro V12 (e a viatura SV): relógios auxiliares na coluna
  diablo: [
    { id: 'painel', name: TOP, x: 268, y: -2, s: 0.85, mount: 'top' },
    { id: 'esquerda', name: SIDE, x: 10, y: 44, s: 0.8, mount: 'face' },
    { id: 'console', name: CONSOLE, x: 258, y: 72, s: 0.7, mount: 'face' },
  ],
  // Gaúcho GTI: relógios auxiliares em copo no alto do painel, à direita (241 a 319)
  'br-golgti': [
    { id: 'console', name: CONSOLE, x: 302, y: 96, s: 0.85, mount: 'face' },
    { id: 'esquerda', name: SIDE, x: 24, y: 66, s: 0.75, dir: 'v', mount: 'face' },
    { id: 'coluna', name: PILLAR, x: 19, y: -4, s: 0.7, dir: 'v', lean: -0.4, mount: 'face' },
  ],
  // Ímola S/R: relógios auxiliares na coluna
  'br-monza': [
    { id: 'painel', name: TOP, x: 290, y: 19, s: 0.85, mount: 'top' },
    { id: 'esquerda', name: SIDE, x: 28, y: 64, s: 0.75, dir: 'v', mount: 'face' },
    { id: 'ventilacao', name: VENT, x: 300, y: 56, s: 0.8, mount: 'face' },
  ],
  // Savana GLS: relógios auxiliares na coluna
  'br-santana': [
    { id: 'painel', name: TOP, x: 290, y: 21, s: 0.85, mount: 'top' },
    { id: 'esquerda', name: SIDE, x: 25, y: 97, s: 0.62, dir: 'v', mount: 'face' },
    { id: 'ventilacao', name: VENT, x: 305, y: 100, s: 0.75, dir: 'v', mount: 'face' },
  ],
  // Jornada Sport: relógios auxiliares na coluna; console liso entre o painel e as saídas de ar
  'br-voyagesport': [
    { id: 'painel', name: TOP, x: 290, y: 21, s: 0.85, mount: 'top' },
    { id: 'console', name: CONSOLE, x: 270, y: 74, s: 0.85, mount: 'face' },
    { id: 'esquerda', name: SIDE, x: 30, y: 76, s: 0.62, dir: 'v', mount: 'face' },
  ],
  // Kaze NX (mão inglesa): relógios auxiliares na face do console, à esquerda do volante (na coluna a
  // pilha subiria até o placar da corrida)
  nsx: [
    { id: 'painel', name: TOP, x: 66, y: -4, s: 0.75, mount: 'top' },
    { id: 'direita', name: SIDE, x: 222, y: 48, s: 0.8, dir: 'v', mount: 'face' },
  ],
  // Serpe V10: relógios auxiliares na coluna
  viper: [
    { id: 'painel', name: TOP, x: 245, y: -10, s: 0.85, mount: 'top' },
    { id: 'frente', name: 'Acima dos relógios', x: 305, y: 24, s: 0.75, mount: 'face' },
    { id: 'esquerda', name: SIDE, x: 9, y: 50, s: 0.75, dir: 'v', mount: 'face' },
  ],
  // Ímola Classic Coupé: mesmo painel do S/R (lugares medidos de novo na arte do cupê)
  'br-monzasedan': [
    { id: 'painel', name: TOP, x: 290, y: 18, s: 0.85, mount: 'top' },
    { id: 'esquerda', name: SIDE, x: 28, y: 64, s: 0.75, dir: 'v', mount: 'face' },
    { id: 'ventilacao', name: VENT, x: 302, y: 54, s: 0.8, mount: 'face' },
  ],
  // Jornada LS: face lisa à direita do quadro, entre o alto do painel e as saídas de ar
  'br-voyage': [
    { id: 'painel', name: TOP, x: 290, y: 23, s: 0.85, mount: 'top' },
    { id: 'console', name: CONSOLE, x: 285, y: 70, s: 0.85, mount: 'face' },
  ],
  // Passeio GTS: relógios auxiliares na coluna; face lisa à direita do quadro
  'br-passat': [
    { id: 'painel', name: TOP, x: 300, y: 33, s: 0.85, mount: 'top' },
    { id: 'console', name: CONSOLE, x: 290, y: 78, s: 0.8, mount: 'face' },
  ],
  // Onça GTE: relógios auxiliares em copo no alto do painel, à direita (266 a 300)
  'br-pumagte': [
    { id: 'painel', name: TOP, x: 24, y: 38, s: 0.65, mount: 'top' },
    { id: 'esquerda', name: SIDE, x: 25, y: 64, s: 0.55, dir: 'v', mount: 'face' }, // acima das teclas, à esquerda do volante
  ],
  // Fúria TR: relógios auxiliares na face à direita do quadro (266 a 320); face lisa abaixo deles
  testarossa: [
    { id: 'console', name: CONSOLE, x: 290, y: 68, s: 0.8, mount: 'face' },
    { id: 'painel', name: TOP, x: 20, y: 27, s: 0.75, mount: 'top' },
  ],
  // Silber 95: relógios auxiliares na coluna
  '959': [
    { id: 'painel', name: TOP, x: 290, y: 19, s: 0.8, mount: 'top' },
    { id: 'ventilacao', name: VENT, x: 302, y: 72, s: 0.75, mount: 'face' },
  ],
  // Toro LP5: relógios auxiliares no alto do painel, à direita (263 a 317)
  countach: [
    { id: 'console', name: CONSOLE, x: 300, y: 72, s: 0.75, mount: 'face' },
    { id: 'painel', name: TOP, x: 38, y: 27, s: 0.65, mount: 'top' },
  ],
};

/** lugares dos aparelhos nesta cabine (o primeiro é o padrão); `radar`: canto do detector (padrão das
 * cabines sem lugares medidos: em cima do painel, logo à direita dele) */
export function devPositions(dash: string, radar: [number, number] = [206, 22]): DevPos[] {
  return DEV_POS[dash] ?? [{ id: 'painel', name: TOP, x: radar[0] + 54, y: radar[1] + 6, s: 0.8, mount: 'top' }];
}
