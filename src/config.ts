// Resolução interna estilo 16 bits. A altura é fixa; a largura acompanha a tela.
export const view = { w: 400, h: 240 };
export const SAFE_W = 320; // área central usada pelos menus

export const SEG_LEN = 200;
export const LANE_W = 2200; // largura de uma faixa (unidades do mundo)
export const DRAW_DIST = 260;
export const FOV = 100;
export const CAM_DEPTH = 1 / Math.tan(((FOV / 2) * Math.PI) / 180);
export const CAM_H = 780; // altura dos olhos do motorista
export const PLAYER_Z = 400; // frente do carro, à frente da câmera
export const CAR_W = 1100;
export const TRUCK_W = 1300;
export const POLICE_W = 1100;

export const KMH = 0.025; // unidades/s -> km/h

// Cabine: teto, para-brisa e painel (em pixels internos)
export const ROOF_H = 22;
export const DASH_Y = 128; // o painel começa perto da metade da tela, como no original
