// Fotos da revista (pixel art do Victor, sem marcas reais): Toro LP5 (ensaio, motor, raio-x e
// galeria), Kaze NX (tools/ref/nx_photos.py) Serpe V10 (tools/ref/viper_photos.py) Furia TR (tools/ref/testarossa_photos.py) e Furia F4 (tools/ref/f40_photos.py). Usadas nas capas do menu principal e nas páginas de carregamento.
import type { Rect } from './ui';

const PH = import.meta.glob('./assets/photos/*.png', { eager: true, import: 'default' }) as Record<string, string>;
const ph = (n: string) => PH[`./assets/photos/${n}.png`];

// box: onde está o carro (ou o assunto) na foto, em pixels da foto de 560 x 315 — o enquadramento
// da capa é calculado para ele aparecer inteiro em qualquer tamanho de quadro (drawPhoto). Toda foto
// nova precisa da sua caixa (do para-choque ao para-choque e do teto ao chão).
export interface Photo { src: string; kicker: string; kc: string; title: string; sub: string; inside: string[]; box: number[] }
export const LP5_PHOTOS: Photo[] = [
  { src: ph('lp5-ensaio'), kicker: 'ENSAIO', kc: '#d01f26', title: 'TORO LP5', sub: 'A cunha que parou o mundo', inside: ['V12 e portas tesoura', 'Quanto custa manter uma', 'O LP5 contra a Fúria F4'], box: [100, 95, 530, 288] },
  { src: ph('lp5-motor'), kicker: 'TÉCNICA', kc: '#1e4fb8', title: 'V12 DE 455 CV', sub: 'O coração do Toro LP5 de perto', inside: ['48 válvulas, 6 carburadores', 'Câmbio na frente do motor', 'Acerto dos carburadores'], box: [25, 70, 520, 268] },
  { src: ph('lp5-raiox'), kicker: 'RAIO-X', kc: '#1a1614', title: 'POR DENTRO DO LP5', sub: 'Tubos, couro e doze cilindros', inside: ['Chassi tubular desenhado', 'Onde vai o tanque', 'Peso: 1.490 kg'], box: [10, 35, 550, 265] },
  { src: ph('lp5-galeria'), kicker: 'GALERIA', kc: '#d01f26', title: 'PORTAS PARA O CÉU', sub: 'O LP5 em branco e vermelho', inside: ['As cores da fábrica', 'Asa traseira: vale a pena?', 'Leitores mostram o seu'], box: [5, 10, 555, 300] },
].filter((p) => !!p.src);
export const NX_PHOTOS: Photo[] = [
  { src: ph('nx-serra'), kicker: 'ENSAIO', kc: '#d01f26', title: 'KAZE NX NA SERRA', sub: 'O japonês que encara os italianos', inside: ['NX contra a Fúria F4', 'Quanto custa manter', 'Direção leve e precisa'], box: [55, 85, 435, 262] },
  { src: ph('nx-senna'), kicker: 'BASTIDORES', kc: '#1e4fb8', title: 'O NX DO CAMPEÃO', sub: 'O carro de todo dia do tricampeão', inside: ['Ele ajudou a acertar o NX', 'Alumínio e V6 de 274 cv', 'Um dia no autódromo'], box: [35, 95, 530, 290] },
  { src: ph('nx-drift'), kicker: 'TESTE', kc: '#d01f26', title: 'NX DE LADO', sub: 'Motor central e tração traseira', inside: ['Como ele sai de traseira', 'Pneus: quanto duram', 'NX na estrada da praia'], box: [0, 120, 540, 288] },
  { src: ph('nx-raiox'), kicker: 'RAIO-X', kc: '#1a1614', title: 'POR DENTRO DO NX', sub: 'O primeiro esportivo todo de alumínio', inside: ['Chassi e carroceria de alumínio', 'V6 3.0 central transversal', 'Peso: 1.370 kg'], box: [5, 60, 520, 290] },
  { src: ph('nx-lavagem'), kicker: 'CUIDADOS', kc: '#1a6a2a', title: 'BANHO DE LOJA', sub: 'Como deixar o NX brilhando', inside: ['Lavar sem riscar', 'Cera de carnaúba', 'Faróis escamoteáveis'], box: [0, 40, 560, 300] },
  { src: ph('nx-prata'), kicker: 'GALERIA', kc: '#d01f26', title: 'NX EM PRATA', sub: 'A cor mais pedida no Japão', inside: ['As cores da fábrica', 'Teto preto de série', 'Rodas de 15 e 16'], box: [18, 55, 545, 285] },
].filter((p) => !!p.src);

const imgs = new Map<string, HTMLImageElement>();
function img(src: string) {
  let im = imgs.get(src);
  if (!im) {
    im = new Image();
    im.src = src;
    imgs.set(src, im);
  }
  return im.complete && im.naturalWidth ? im : null;
}
export const VP_PHOTOS: Photo[] = [
  { src: ph('vp-estrada'), kicker: 'TESTE', kc: '#d01f26', title: 'SERPE V10', sub: 'Oito litros e nenhum teto', inside: ['V10 de 400 cv na estrada', 'Sem ABS e sem controle', 'Escapamento na soleira'], box: [35, 115, 525, 252] },
  { src: ph('vp-dupla'), kicker: 'COMPARATIVO', kc: '#1e4fb8', title: 'V10 AMARELO X AZUL', sub: 'Roadster contra a versão de listras', inside: ['Qual acelera mais', 'Listras de corrida', 'Capota: vale a pena?'], box: [35, 5, 515, 300] },
  { src: ph('vp-raiox'), kicker: 'RAIO-X', kc: '#1a1614', title: 'POR DENTRO DO V10', sub: 'Um motor de caminhão num esportivo', inside: ['8.0 de alumínio, 20 válvulas', 'Câmbio de seis marchas', 'Peso: 1.490 kg'], box: [5, 30, 550, 300] },
  { src: ph('vp-arcoiris'), kicker: 'GALERIA', kc: '#d01f26', title: 'SERPE EM VERMELHO', sub: 'O roadster mais bravo dos EUA', inside: ['As cores da fábrica', 'Rodas de três raios', 'Leitores mostram o seu'], box: [65, 80, 460, 275] },
  { src: ph('vp-cabine'), kicker: 'POR DENTRO', kc: '#1a6a2a', title: 'O PAINEL DO V10', sub: 'Couro, relógios brancos e só', inside: ['Mostradores no meio do painel', 'Sem vidro nas portas', 'Bancos baixos'], box: [0, 40, 560, 300] },
  { src: ph('vp-mostradores'), kicker: 'TÉCNICA', kc: '#1e4fb8', title: 'QUATRO RELÓGIOS', sub: 'Água, óleo, gasolina e bateria', inside: ['Leia o painel do V10', 'Temperatura ideal', 'Pressão do óleo no giro alto'], box: [50, 60, 520, 160] },
].filter((p) => !!p.src);
export const TR_PHOTOS: Photo[] = [
  { src: ph('tr-ensaio'), kicker: 'ENSAIO', kc: '#d01f26', title: 'FURIA TR', sub: 'As lâminas que viraram lenda', inside: ['Boxer de 12 cilindros', 'Couro e câmbio de grade', 'Cabeçotes vermelhos'], box: [190, 140, 535, 285] },
  { src: ph('tr-miami'), kicker: 'VIAGEM', kc: '#1e4fb8', title: 'TR NA BEIRA-MAR', sub: 'Pôr do sol, palmeiras e 390 cv', inside: ['A ponte ao entardecer', 'Escape quádruplo', 'Lanternas com grade'], box: [105, 135, 500, 295] },
  { src: ph('tr-campo'), kicker: 'TESTE', kc: '#d01f26', title: 'FURIA TR NA SERRA', sub: 'Largo, baixo e na mão inglesa', inside: ['Curvas de vicinal', 'Faróis escamoteáveis', 'Consumo na estrada'], box: [80, 65, 525, 275] },
  { src: ph('tr-trio'), kicker: 'GALERIA', kc: '#1a1614', title: 'TRÊS GERAÇÕES', sub: 'A família das laterais com lâminas', inside: ['TR, 512 e a última', 'O que mudou em cada', 'Rodas de cinco raios'], box: [5, 95, 525, 250] },
  { src: ph('tr-motor'), kicker: 'TÉCNICA', kc: '#1e4fb8', title: 'BOXER 4.9 DE 48V', sub: 'Doze cilindros deitados', inside: ['Cabeçotes vermelhos', 'Radiadores laterais', 'Revisão das correias'], box: [0, 60, 560, 300] },
  { src: ph('tr-cabine'), kicker: 'POR DENTRO', kc: '#1a6a2a', title: 'O PAINEL DA TR', sub: 'Relógios laranja e couro azul', inside: ['Quatro relógios', 'Câmbio de grade', 'Bancos baixos'], box: [60, 60, 500, 300] },
].filter((p) => !!p.src);
export const F4_PHOTOS: Photo[] = [
  { src: ph('f4-pista'), kicker: 'ENSAIO', kc: '#d01f26', title: 'FURIA F4', sub: 'Dois turbos e nenhum luxo', inside: ['V8 biturbo de 478 cv', 'Carroceria de kevlar', '340 km/h na pista'], box: [35, 55, 525, 232] },
  { src: ph('f4-raiox'), kicker: 'RAIO-X', kc: '#1a1614', title: 'POR DENTRO DA F4', sub: 'Tubos, kevlar e dois turbos', inside: ['Gaiola e chassi tubular', 'Motor atrás dos bancos', 'Peso: 1.100 kg'], box: [25, 40, 540, 290] },
].filter((p) => !!p.src);
export const DIA_PHOTOS: Photo[] = [
  { src: ph('dia-salao'), kicker: 'ENSAIO', kc: '#d01f26', title: 'TORO V12', sub: 'O diabo agora tem portas tesoura', inside: ['V12 de 517 cv', '330 km/h de máxima', 'Portas que abrem para o céu'], box: [55, 85, 500, 285] },
  { src: ph('dia-deserto'), kicker: 'TESTE', kc: '#1e4fb8', title: 'V12 NO DESERTO', sub: 'Asa alta e quatro escapes', inside: ['Retas sem fim', 'Lanternas duplas', 'Consumo a 300 km/h'], box: [60, 110, 520, 250] },
  { src: ph('dia-bolonha'), kicker: 'VIAGEM', kc: '#1a1614', title: 'DE VOLTA À FÁBRICA', sub: 'Um amarelo que para a cidade', inside: ['Ruas de pedra', 'Faróis escamoteáveis', 'Os vizinhos aprovam'], box: [15, 125, 445, 278] },
  { src: ph('dia-console'), kicker: 'POR DENTRO', kc: '#1a6a2a', title: 'O CONSOLE DO V12', sub: 'Fibra, ar automático e toca-fitas', inside: ['Climatizador digital', 'Botões de grade', 'Câmbio de alavanca alta'], box: [110, 20, 480, 300] },
  { src: ph('dia-motor'), kicker: 'TÉCNICA', kc: '#1e4fb8', title: 'V12 5.7 DE 48V', sub: 'Doze cilindros atrás dos bancos', inside: ['Coletor de magnésio', 'Injeção multiponto', 'Revisão das válvulas'], box: [30, 40, 540, 300] },
].filter((p) => !!p.src);
export const GOL_PHOTOS: Photo[] = [
  { src: ph('gol-preto'), kicker: 'ENSAIO', kc: '#d01f26', title: 'GAÚCHO GTI', sub: 'O esportivo nacional de injeção', inside: ['AP 2.0 de 120 cv', 'Faróis de milha de série', 'Bancos com tecido xadrez'], box: [35, 75, 530, 282] },
  { src: ph('gol-amarelo'), kicker: 'TESTE', kc: '#1e4fb8', title: 'GTI NA ESTRADA', sub: 'Aerofólio, escape duplo e 210 km/h', inside: ['0 a 100 em 9,2 s', 'Consumo na serra', 'Rodas de liga leve'], box: [62, 95, 530, 278] },
  { src: ph('gol-giro'), kicker: 'TÉCNICA', kc: '#1a1614', title: 'ATÉ O CORTE', sub: 'Conta-giros VDO e motor AP', inside: ['Leia o painel do GTI', 'Faixa vermelha em 6.250', 'Relógio digital no meio'], box: [150, 100, 410, 315] },
  { src: ph('gol-motor'), kicker: 'OFICINA', kc: '#1a6a2a', title: 'INJEÇÃO ELETRÔNICA', sub: 'O primeiro nacional injetado', inside: ['Revisão da injeção', 'Velas e cabos', 'Filtro de ar esportivo'], box: [60, 40, 540, 315] },
].filter((p) => !!p.src);
// Ímola S/R (Monza S/R 1987): tools/ref/monza_photos.py
export const MZ_PHOTOS: Photo[] = [
  { src: ph('mz-aviao'), kicker: 'TESTE', kc: '#d01f26', title: 'ÍMOLA S/R', sub: 'O hatch esportivo decola na pista', inside: ['2.0 a álcool de 110 cv', 'Contra o treinador da base', 'Câmbio curto de 5 marchas'], box: [104, 100, 506, 302] },
  { src: ph('mz-preto'), kicker: 'ENSAIO', kc: '#1a1614', title: 'HATCH DE RESPEITO', sub: 'Aerofólio, filetes vermelhos e escape esportivo', inside: ['Rodas de liga de série', 'Bancos de tecido exclusivo', 'Porta-malas com tampão'], box: [65, 85, 517, 300] },
  { src: ph('mz-casal'), kicker: 'COMPARATIVO', kc: '#1e4fb8', title: 'DOIS ÍMOLAS', sub: 'Prata ou cobre: qual levar para casa?', inside: ['Consumo na estrada', 'Econômetro no painel', 'O preço de cada versão'], box: [189, 105, 553, 286] },
  { src: ph('mz-motor'), kicker: 'TÉCNICA', kc: '#1e4fb8', title: 'ÁLCOOL 2.0', sub: 'Comando no cabeçote e torque em baixa', inside: ['Partida a frio sem susto', 'Regulagem do carburador', 'Velas e ponto certos'], box: [40, 20, 520, 300] },
].filter((p) => !!p.src);
// Jornada LS (Voyage LS 1986): tools/ref/voyage_photos.py
export const VG_PHOTOS: Photo[] = ([
  { src: ph('vg-anuncio'), kicker: 'LANÇAMENTO', kc: '#1e4fb8', title: 'JORNADA LS', sub: 'O sedã de duas portas da Ipê chega às lojas', inside: ['1.6 a álcool de 90 cv', 'Faróis de neblina de série', 'Derivado do hatch Gaúcho'], box: [30, 60, 532, 280] },
  { src: ph('vg-vermelho'), kicker: 'TESTE', kc: '#d01f26', title: 'LEVE E VALENTE', sub: '900 kg, carburador e quatro marchas bem escalonadas', inside: ['0 a 100 e retomadas', 'Consumo com álcool', 'Porta-malas de carro grande'], box: [6, 50, 544, 290] },
  { src: ph('vg-pista'), kicker: 'NA ESTRADA', kc: '#1a1614', title: 'SEDÃ PARA VIAJAR', sub: 'Mil quilômetros com o Jornada LS e a família', inside: ['Porta-malas para as férias', 'Silêncio em quarta marcha', 'Quanto custa o quilômetro'], box: [12, 22, 548, 313] },
  { src: ph('vg-motor'), kicker: 'TÉCNICA', kc: '#1a6a2a', title: 'ÁLCOOL 1.6', sub: 'Por dentro do motor de 90 cv do Jornada', inside: ['Regulagem do carburador', 'Partida a frio sem susto', 'Manutenção fácil e barata'], box: [40, 20, 520, 300] },
] as Photo[]).filter((p) => !!p.src);
// Jornada Sport (Voyage Sport 1992): tools/ref/voyagesport_photos.py
export const VS_PHOTOS: Photo[] = ([
  { src: ph('vs-bancos'), kicker: 'POR DENTRO', kc: '#1a1614', title: 'XADREZ ESPORTIVO', sub: 'Os bancos em tecido xadrez do Jornada Sport', inside: ['Encosto alto na frente', 'Atrás cabem três?', 'Acabamento em cinza'], box: [120, 85, 556, 305] },
  { src: ph('vs-folheto'), kicker: 'SÉRIE ESPECIAL', kc: '#d01f26', title: 'JORNADA SPORT', sub: 'O sedã esportivo da Ipê: 1.8 de 99 cv e 960 kg', inside: ['Volante de quatro botões', 'Brake-light de série', 'Só em prata ou preto'], box: [8, 8, 552, 307] },
] as Photo[]).filter((p) => !!p.src);
// Savana GLS (Santana GLS 1990): tools/ref/santana_photos.py
export const SN_PHOTOS: Photo[] = ([
] as Photo[]).filter((p) => !!p.src);
// Peças de preparação (tools/ref/parts_photos.py): capas e páginas de carregamento
export const PC_PHOTOS: Photo[] = [
  { src: ph('pc-motor'), kicker: 'RAIO-X', kc: '#1a1614', title: 'DOZE EM V', sub: 'Por dentro do coração do Toro', inside: ['48 válvulas, 12 borboletas', 'Coletores 6 em 1', 'Quanto custa abrir um'], box: [95, 14, 464, 278] },
  { src: ph('pc-pistao'), kicker: 'PREPARAÇÃO', kc: '#d01f26', title: 'PISTÃO FORJADO', sub: 'Aguenta mais giro e mais pressão', inside: ['Forjado ou fundido?', 'Bielas reforçadas', 'Taxa certa para o turbo'], box: [213, 14, 346, 278] },
  { src: ph('pc-comando'), kicker: 'PREPARAÇÃO', kc: '#d01f26', title: 'COMANDO BRAVO', sub: 'Mais cavalos lá em cima, lenta embolada', inside: ['Esportivo ou de corrida', 'Molas duplas', 'Polia regulável'], box: [14, 52, 546, 240] },
  { src: ph('pc-carburador'), kicker: 'OFICINA', kc: '#1a6a2a', title: 'CORPO DUPLO', sub: 'Acerto fino de giclê e ronco de admissão', inside: ['Dupla de corrida: vale?', 'Regulagem da lenta', 'Álcool pede mais giclê'], box: [134, 14, 425, 278] },
  { src: ph('pc-injecao'), kicker: 'TÉCNICA', kc: '#1e4fb8', title: 'INJEÇÃO PROGRAMÁVEL', sub: 'Bicos maiores e mapa sob medida', inside: ['Chip ou programável', 'Corpo de borboleta maior', 'Sonda: leia a mistura'], box: [91, 14, 468, 278] },
  { src: ph('pc-turbo'), kicker: 'TESTE', kc: '#d01f26', title: 'TURBO NELE!', sub: 'Mais 28% de potência e o assobio de brinde', inside: ['Turbo ou supercharger?', 'Válvula de alívio', 'Pressão: até onde ir'], box: [123, 14, 437, 278] },
  { src: ph('pc-escape'), kicker: 'PREPARAÇÃO', kc: '#1a1614', title: 'QUATRO EM UM', sub: 'Coletor dimensionado e ponteira de titânio', inside: ['Esportivo ou de corrida', 'O ronco muda mesmo', 'Abafador: perde quanto?'], box: [10, 20, 550, 295] },
  { src: ph('pc-suspensao'), kicker: 'OFICINA', kc: '#1a6a2a', title: 'MAIS BAIXO, MAIS FIRME', sub: 'Molas esportivas e amortecedores a gás', inside: ['20% ou 35% mais baixo', 'Curva com mais g', 'Cuidado com a lombada'], box: [50, 5, 510, 310] },
  { src: ph('pc-freio'), kicker: 'TESTE', kc: '#1e4fb8', title: 'FREIA MAIS TARDE', sub: 'Disco ventilado e pinça de corrida', inside: ['Pastilha: qual usar', 'Fluido de alta temperatura', 'Metros a menos de 100 a 0'], box: [138, 14, 421, 278] },
  { src: ph('pc-bancos'), kicker: 'ALÍVIO DE PESO', kc: '#d01f26', title: 'BANCO CONCHA', sub: 'Segura o corpo e tira peso do carro', inside: ['Fibra ou tubular', 'Cinto de quatro pontos', 'Trilho regulável'], box: [50, 5, 510, 310] },
  { src: ph('pc-turbomotor'), kicker: 'OFICINA', kc: '#1e4fb8', title: 'TURBO NO AP', sub: 'Turbina, intercooler e pressão no carburador', inside: ['Turbina da .32 à .70', 'Intercooler: vale a pena', 'Manômetro na cabine'], box: [30, 55, 535, 300] },
  { src: ph('pc-kitturbo'), kicker: 'PREPARAÇÃO', kc: '#d01f26', title: 'KIT TURBO', sub: 'Peça por peça, o que vai no seu motor', inside: ['Downpipe de 2,5 ou 3,5 pol', 'Qual turbina escolher', 'Monte o seu na oficina'], box: [10, 5, 550, 310] },
  { src: ph('pc-coletor'), kicker: 'PREPARAÇÃO', kc: '#1a1614', title: 'ADMISSÃO DE CORRIDA', sub: 'Coletor de dutos longos e pressão de sobra', inside: ['Turbo ou supercharger?', 'Polia menor, mais pressão', 'Visite a oficina'], box: [95, 40, 465, 280] },
].filter((p) => !!p.src);
export const preloadPhotos = () => [...LP5_PHOTOS, ...NX_PHOTOS, ...VP_PHOTOS, ...TR_PHOTOS, ...F4_PHOTOS, ...DIA_PHOTOS, ...GOL_PHOTOS, ...MZ_PHOTOS, ...VG_PHOTOS, ...VS_PHOTOS, ...SN_PHOTOS, ...PC_PHOTOS].forEach((p) => img(p.src));

// Enquadramento: a foto cobre o quadro e a caixa do carro (p.box) fica inteira e centrada na área
// livre (sem a faixa vermelha de baixo, 'bottom' px), com uma aproximação lenta (u: 0..1) que nunca
// corta a caixa. Se o carro não cabe com a foto cobrindo o quadro, a foto diminui até ele caber e
// as sobras dos lados mostram a própria foto desfocada e escurecida.
const blurred = new Map<string, HTMLCanvasElement>();
function blurOf(im: HTMLImageElement) {
  let cv = blurred.get(im.src);
  if (!cv) {
    cv = document.createElement('canvas');
    cv.width = Math.max(1, Math.round(im.naturalWidth / 14));
    cv.height = Math.max(1, Math.round(im.naturalHeight / 14));
    const g = cv.getContext('2d')!;
    g.imageSmoothingEnabled = true;
    g.drawImage(im, 0, 0, cv.width, cv.height);
    g.fillStyle = 'rgba(10,8,14,0.45)';
    g.fillRect(0, 0, cv.width, cv.height);
    blurred.set(im.src, cv);
  }
  return cv;
}
export function photoFrame(r: Rect, W: number, H: number, box: number[], u: number, bottom = 10) {
  const k = W / 560; // a caixa é dada na foto de 560 px
  const [bx0, by0, bx1, by1] = box.map((v) => v * k);
  const m = 3; // folga em volta do carro
  const fw = r.w - 2 * m, fh = r.h - bottom - 2 * m;
  const cover = Math.max(r.w / W, r.h / H);
  const fit = Math.min(fw / (bx1 - bx0), fh / (by1 - by0));
  const s = fit >= cover ? Math.min(cover * (1.02 + u * 0.06), fit) : fit;
  const w = W * s, h = H * s;
  const bcx = ((bx0 + bx1) / 2) * s, bcy = ((by0 + by1) / 2) * s;
  let x = r.x + r.w / 2 - bcx, y = r.y + m + fh / 2 - bcy;
  // sem buracos: com a foto maior que o quadro, ela não sai das bordas
  if (w >= r.w) x = Math.min(r.x, Math.max(r.x + r.w - w, x));
  if (h >= r.h) y = Math.min(r.y, Math.max(r.y + r.h - h, y));
  return { x, y, w, h, fill: w < r.w - 0.5 || h < r.h - 0.5 };
}
export function drawPhoto(c: CanvasRenderingContext2D, r: Rect, p: Photo, u: number) {
  const im = img(p.src);
  if (!im) return false;
  const f = photoFrame(r, im.naturalWidth, im.naturalHeight, p.box, u);
  const sm = c.imageSmoothingEnabled;
  c.imageSmoothingEnabled = true;
  if (f.fill) {
    const cover = Math.max(r.w / im.naturalWidth, r.h / im.naturalHeight) * 1.1;
    const bw = im.naturalWidth * cover, bh = im.naturalHeight * cover;
    c.drawImage(blurOf(im), r.x + (r.w - bw) / 2, r.y + (r.h - bh) / 2, bw, bh);
    c.fillStyle = 'rgba(0,0,0,0.35)';
    c.fillRect(f.x - 1, f.y, 1, f.h);
    c.fillRect(f.x + f.w, f.y, 1, f.h);
  }
  c.drawImage(im, f.x, f.y, f.w, f.h);
  c.imageSmoothingEnabled = sm;
  return true;
}
