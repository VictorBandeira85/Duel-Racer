// Resolução interna (estilo 16 bits). A largura se ajusta à proporção da tela.
export const view = { w: 480, h: 270 };

export const SEG_LEN = 200; // comprimento de cada segmento da pista
export const RUMBLE = 3; // segmentos por faixa de zebra
export const ROAD_W = 2000; // meia largura da pista
export const FOV = 100;
export const CAM_H = 1500;
export const DRAW_DIST = 300;
export const CAM_DEPTH = 1 / Math.tan(((FOV / 2) * Math.PI) / 180);
export const PLAYER_Z = CAM_H * CAM_DEPTH;
export const CENTRIFUGAL = 0.3;

export const CAR_W = 800; // largura do carro em unidades do mundo
export const CAR_HALF = CAR_W / 2 / ROAD_W; // meia largura em unidades de pista
export const TRUCK_W = 900;

export const KMH = 0.025; // unidades/s -> km/h exibidos
export const METERS = 1 / 40; // unidades -> metros exibidos
