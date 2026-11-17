// Relógios auxiliares da preparação (pressão do turbo/compressor, óleo, combustível): onde o jogador
// escolhe pô-los (vaga 'relogios' em tuning.ts): no painel (copos apoiados em cima dele) ou na coluna
// da porta (suporte moldado preso à coluna, `pillar`). A posição de fábrica de cada cabine é o `pod` de
// COCKPIT_ART (cockpit.ts); aqui fica a outra, medida em prints do jogo com grade em pixels da arte
// (as mesmas coordenadas de `pod`), sem tapar
// quadro, radar, retrovisor, volante nem os aparelhos (devpos.ts) em nenhum dos lugares deles.
// Na coluna, medir a coluna na arte (colunas opacas do friso interno em cada linha do topo; x do pod =
// coluna - 102, y = linha - 76): rente ao friso escuro, nunca na moldura da porta nem no vidro.
// Cabines sem entrada aqui ficam só com a posição de fábrica (sem a vaga): as fora do escopo e o Kaze NX
// (na coluna da direita os relógios subiriam até o placar da corrida).
export type PodPlace = 'painel' | 'coluna';
export interface PodAlt { x: number; y: number; r?: number; dx?: number; dy?: number; pillar?: string /* na coluna: cor do suporte */ }

export const POD_POS: Record<string, { def: PodPlace; alt: PodAlt }> = {
  // de fábrica no painel: a outra é a coluna (centro do friso interno medido no topo da arte)
  f40: { def: 'painel', alt: { x: -33, y: -52, r: 7.5, dx: 1.7, dy: 17.5, pillar: '#1f1a24' } },
  'br-golgti': { def: 'painel', alt: { x: 13, y: -45, r: 7, dx: 3.5, dy: 17.5, pillar: '#2a2733' } },
  'br-pumagte': { def: 'painel', alt: { x: -13, y: -52, r: 7, dx: 2.3, dy: 17.5, pillar: '#1c191f' } },
  testarossa: { def: 'painel', alt: { x: -40, y: -50, r: 7.5, dx: 6.1, dy: 17.5, pillar: '#1d3466' } },
  countach: { def: 'painel', alt: { x: -9, y: -53, r: 7.5, dx: 3.8, dy: 17.5, pillar: '#a85a1e' } },
  // de fábrica na coluna: a outra são copos sobre o painel, à direita do quadro (os aparelhos de cima do
  // painel vão para a coluna, podAlt em devpos.ts)
  diablo: { def: 'coluna', alt: { x: 251, y: -3, r: 7.5 } },
  'br-monza': { def: 'coluna', alt: { x: 273, y: 12, r: 7.5 } },
  'br-monzasedan': { def: 'coluna', alt: { x: 273, y: 10, r: 7.5 } },
  'br-voyage': { def: 'coluna', alt: { x: 273, y: 18, r: 7.5 } },
  'br-voyagesport': { def: 'coluna', alt: { x: 273, y: 16, r: 7.5 } },
  'br-santana': { def: 'coluna', alt: { x: 273, y: 18, r: 7.5 } },
  '959': { def: 'coluna', alt: { x: 273, y: 15, r: 7.5 } },
  'br-passat': { def: 'coluna', alt: { x: 283, y: 30, r: 7.5 } },
  viper: { def: 'coluna', alt: { x: 213, y: -3, r: 7.5 } },
};

export const PLACE_NAME: Record<PodPlace, string> = { painel: 'No painel', coluna: 'Na coluna' };

/** lugares dos relógios nesta cabine (o primeiro é o de fábrica, id vazio); vazio = sem escolha */
export function podPlaces(dash: string): { id: string; place: PodPlace; name: string }[] {
  const p = POD_POS[dash];
  if (!p) return [];
  const other: PodPlace = p.def === 'painel' ? 'coluna' : 'painel';
  return [{ id: '', place: p.def, name: PLACE_NAME[p.def] }, { id: other, place: other, name: PLACE_NAME[other] }];
}

/** os relógios estão fora do lugar de fábrica desta cabine? (`relogios`: o que está na vaga; os
 * aparelhos trocam de lugar com eles, ver podAlt em devpos.ts) */
export const podMoved = (dash: string, relogios?: string) => !!POD_POS[dash] && relogios === (POD_POS[dash].def === 'painel' ? 'coluna' : 'painel');
