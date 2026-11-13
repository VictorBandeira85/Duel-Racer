"""Cabine da Onça GTE (Puma GTE 1976) a partir das duas artes novas do Victor (com e sem volante, com
cenário pelos vidros), no molde de passat_cockpit2.py e silber_cockpit.py:
- painel, colunas e porta da arte SEM volante; volante esportivo de três raios da arte COM volante (aro
  pelas elipses medidas, raios pelo contorno medido, almofada por um círculo; as alavancas da coluna, a
  chave e o painel atrás vêm da arte sem volante). As duas artes estão alinhadas
  (diferença só no pontilhado); o volante é centrado entre os dois mostradores grandes (x 737), como na arte
- altura: o painel é ancorado com o topo de 76 linhas começando no forro (y 20 da arte: a borda de baixo
  do forro e a moldura preta do para-brisa aparecem na primeira linha); o centro do aro (y 494) cai 4
  linhas abaixo do pivô (linha 108 do painel): wheelDy em cockpit.ts
- vidros por geometria medida: para-brisa entre a borda do forro (primeira linha de cenário saturado em
  cada coluna, mediana corrida para pular a haste do retrovisor), a coluna (PILLAR_R) e o capô (HOOD);
  janela da porta (DOOR), menos a carcaça do retrovisor externo; vidro do retrovisor externo (o miolo
  dentro da moldura vermelha, a partir da semente). Restos de cenário grudados no contorno saem
- limpadores da arte saem (o jogo desenha os dele, na chuva): acima do capô viram vidro; onde as bases e
  a ponta da palheta encostam no capô e no friso vermelho, cada linha continua dos dois lados (WIPER_FIX)
- o capô e os para-lamas vermelhos vistos pelo para-brisa ficam (o Puma mostra os para-lamas) e vão para
  a máscara de pintura junto com a moldura da porta, a coluna e a carcaça do retrovisor externo
- retrovisor interno, haste e a base no forro saem (o jogo desenha o dele); a base vira forro
- retrovisor externo esquerdo: na tela de celular (932 x 430, 424 colunas: começa na coluna 18 do
  empilhado, x 114 da arte) a moldura esquerda dele (x 36 a 52) não aparece, nem na tela larga (x 61); como
  em mirror_complete.py shift, a moldura esquerda e o começo do vidro andam 94 px da arte para dentro (some
  esse tanto do meio do vidro) e o que sobra à esquerda vira a janela da porta
- mostradores: o miolo dos seis do painel (dentro do aro cromado da arte, que fica) vira fundo preto liso;
  o quadro refeito pela foto do carro real (onca_gte_gauges.py) cobre cada um, e o jogo desenha ponteiros,
  tambores e luzes. A lente verde acesa entre os dois grandes fica apagada (o jogo acende: lanterna)
- "PUMA" do rádio sai (marca real); a plaqueta "Puma GTE" do porta-luvas fica fora do recorte (x > 1413)
A arte cobre a folga inteira dos dois lados (a coluna -102 do painel cai em x 61 da arte): nada construído.
Escala 0,34 (pixel 8:7), como no Savana e no Passeio; volante sem ampliar.
Uso: python3 tools/ref/onca_gte_cockpit2.py <pasta com cab-wheel.png e cab-nowheel.png> <src/assets/cockpit>
     (DBG=<pasta> grava as máscaras para conferência)
"""
import os
import sys

import cv2
import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(__file__))
import brand_badges  # noqa: E402

S = 0.34
PXW, PXH = 1 / S, (1 / S) / (8 / 7)
PIV_X = 737.0                   # centro do aro (x) = meio entre os dois mostradores grandes: cai na coluna 128
WHEEL_C = (737.0, 494.0)        # centro do aro na arte com volante
Y0D = 216.0                     # linha da arte onde começa o painel (124 linhas); o topo começa 76 linhas acima (y 20)
PIV_N = (128.0, 104.0)
ROWS, EXT, PAD = 124, 76, 102
WTOP, WROWS = 4, 210
RIM_OUT = (737.0, 494.0, 246.0, 246.0)        # elipse de fora do aro (com o contorno): cx, cy, rx, ry
RIM_IN = (737.5, 495.0, 196.0, 205.0)         # a de dentro (o aro é mais grosso em cima e embaixo, visto de cima)
HUB = (737.0, 500.0, 57.0)                    # almofada com o aro dos parafusos: centro e raio
# contorno dos três raios (arte com volante), medido na arte: o raio é a peça inteira, com o rasgo (escuro)
SPOKES = [
    [(545, 447), (590, 455), (686, 460), (690, 518), (600, 500), (560, 490), (545, 488)],          # esquerdo
    [(1474 - x, y) for x, y in [(545, 447), (590, 455), (686, 460), (690, 518), (600, 500), (560, 490), (545, 488)]],  # direito: o esquerdo refletido
    [(707, 545), (770, 545), (768, 575), (762, 660), (780, 690), (782, 712), (696, 712), (698, 690), (718, 660), (710, 575)],  # de baixo
]
MIRROR_X = 1474                                # 2 x centro do volante: o raio direito ("momo" escrito) é o esquerdo refletido
EMB = (737.0, 498.0, 40.0)                     # miolo da buzina (logotipo da arte): vira botão escuro com a logo da Onça
# vidros medidos na arte sem volante (x, y)
PILLAR_R = [(352, 20), (352, 100), (356, 160), (361, 200), (367, 240), (375, 270), (383, 290), (390, 298)]
DOOR = [(0, 0), (200, 0), (213, 40), (222, 80), (229, 120), (242, 160), (253, 200), (265, 240), (277, 280), (284, 300), (294, 338),
        (300, 344), (0, 426)]
HOUSING = [(36, 268), (44, 254), (60, 246), (222, 246), (237, 256), (243, 275), (243, 328), (262, 327), (286, 335), (294, 348),
           (291, 359), (240, 373), (60, 373), (43, 363), (36, 346)]
MIRROR_SEED = (130, 300)
MIR_Y = (238, 382)               # linhas da arte do retrovisor externo
MIR_SRC, MIR_DST, MIR_W = 34, 128, 46   # a moldura esquerda (x 34 a 80 da arte) vai para x 128 (celular: coluna 18 = x 114)
# a moldura é mais baixa à esquerda (perspectiva): o pedaço que anda cresce na altura para emendar na x 174
# (em x 80: 252 a 360; em x 174: 249 a 365), em volta da linha do meio
MIR_MID, MIR_KY = 306.5, 108 / 116
# borda de cima do capô / friso vermelho / painel (x, y: primeira linha opaca embaixo do vidro)
HOOD = [(380, 301), (390, 297), (400, 293), (420, 284), (440, 276), (460, 267), (480, 260), (500, 255), (520, 250), (540, 247),
        (560, 246), (590, 245), (600, 247), (620, 250), (640, 253), (660, 256), (676, 258), (700, 260), (800, 259), (900, 257),
        (950, 255), (1070, 255), (1100, 255), (1150, 256), (1200, 257), (1250, 258), (1300, 260), (1350, 261), (1400, 262),
        (1450, 263), (1500, 265), (1550, 270), (1600, 281), (1650, 294), (1671, 300)]
# base do limpador do meio encostada no friso vermelho: cada linha refeita entre as duas colunas de fora
# (x0, x1 exclusivo), da borda do capô até y1
WIPER_FIX = [(1062, 1156, 264)]
# ponta do para-lama esquerdo, tapada pela palheta da esquerda (x 598 a 676): vermelho da borda do capô
# (HOOD) até a linha de cima do painel, com o contorno escuro embaixo, afinando até o friso
TIP = (598, 676, 262, 263)      # x0, x1, última linha vermelha, linha do contorno
IMIRROR_BASE = (1036, 0, 1156, 34)             # base do retrovisor interno no forro (vira forro)
LINER_DX = 130                                 # de onde vem o forro (tantos px à esquerda)
# mostradores do painel (centro e raio do miolo, dentro do aro cromado, na arte)
DIALS = [(657, 388, 71.0), (817, 388, 71.0), (933, 356, 35.0), (1039, 362, 45.0), (1157, 362, 45.0), (1275, 362, 45.0)]
FACE = (11, 11, 13)
GREEN_LENS = (722, 320, 752, 350)              # lente verde acesa entre os grandes (fica apagada)
RADIO_TXT = (1083, 511, 1120, 524)             # "PUMA" do rádio


def poly(shape, pts):
    return cv2.fillPoly(np.zeros(shape, np.uint8), [np.array(pts, np.int32)], 1) > 0


def hood_line(W):
    px, py = zip(*HOOD)
    return np.interp(np.arange(W), px, py)


def glass_mask(nw):
    H, W = nw.shape[:2]
    yy, xx = np.mgrid[0:H, 0:W]
    hsv = cv2.cvtColor(nw, cv2.COLOR_RGB2HSV).astype(int)
    red = (nw[..., 0].astype(int) > nw[..., 1].astype(int) + 60) & (nw[..., 0] > 90)
    sat = (hsv[..., 1] > 90) & (hsv[..., 2] > 60) & ~red
    # para-brisa: da borda do forro até o capô, à direita da coluna
    roof = np.full(W, 30.0)
    for x in range(340, W):
        ys = np.nonzero(sat[15:90, x])[0]
        if len(ys):
            roof[x] = 15 + ys[0]
    roof = np.array([np.median(roof[max(340, x - 40):max(341, x + 41)]) for x in range(W)])
    top = hood_line(W)
    lx, ly = zip(*PILLAR_R)
    left = np.interp(np.arange(H), ly, lx)
    ws = (yy >= roof[xx]) & (yy < top[xx]) & (xx >= left[yy]) & (xx >= HOOD[0][0] - 30)
    house = poly((H, W), HOUSING)
    door = poly((H, W), DOOR) & ~house
    # vidro do retrovisor externo: o miolo dentro da moldura vermelha (fecho convexo, a vista tem vermelho)
    hsvf = cv2.cvtColor(nw, cv2.COLOR_RGB2HSV_FULL).astype(int)
    hue = hsvf[..., 0] * 360 / 256
    frame = ((hue < 20) | (hue > 335)) & (hsvf[..., 1] > 90) & (hsvf[..., 2] > 60)
    frame = cv2.dilate(frame.astype(np.uint8), np.ones((3, 3), np.uint8)) > 0
    n, lab = cv2.connectedComponents((~frame & house).astype(np.uint8), connectivity=4)
    comp = lab == lab[MIRROR_SEED[1], MIRROR_SEED[0]]
    ys, xs = np.nonzero(comp)
    hull = cv2.convexHull(np.stack([xs, ys], 1).astype(np.int32))
    mir = cv2.fillPoly(np.zeros((H, W), np.uint8), [hull], 1) > 0
    g = ws | door
    # restos do cenário grudados no contorno (folhas, céu, grama: cores saturadas que não são o vermelho)
    scene = sat & (hsv[..., 0] > 15) & (hsv[..., 0] < 140) & ~house & (yy < top[xx] + 2)
    for _ in range(10):
        near = cv2.dilate(g.astype(np.uint8), np.ones((3, 3), np.uint8)) > 0
        g |= near & scene
    # dentro do polígono da carcaça, o que fica a mais de 3 px da moldura vermelha (pedras do muro nos
    # cantos arredondados) é janela; o contorno escuro da moldura fica
    near = cv2.dilate(frame.astype(np.uint8), np.ones((5, 5), np.uint8)) > 0
    g |= house & ~mir & ~near
    halo = house & near & ~frame & ~mir    # vira o contorno escuro da moldura
    return g | mir, mir, halo


def row_fix(img, x0, x1, ya, yb):
    """cada linha de ya a yb (inclusive) entre as colunas x0 e x1 passa da cor de fora da esquerda para a de
    fora da direita (mediana de 3 px de cada lado)"""
    for y in range(int(ya), int(yb) + 1):
        cl = np.median(img[y, x0 - 3:x0].astype(float), axis=0)
        cr = np.median(img[y, x1:x1 + 3].astype(float), axis=0)
        t = ((np.arange(x1 - x0) + 0.5) / (x1 - x0))[:, None]
        img[y, x0:x1] = (cl * (1 - t) + cr * t).astype(np.uint8)


def clean(nw):
    out = nw.copy()
    W = nw.shape[1]
    top = hood_line(W)
    # limpadores encostados no capô e no friso: cada linha continua dos dois lados
    for x0, x1, y1 in WIPER_FIX:
        ya = int(np.floor(min(top[x0:x1])))
        row_fix(out, x0, x1, ya, y1)
    x0, x1, yr, yc = TIP
    lit, red, dark = np.array([236, 70, 56]), np.array([206, 22, 16]), np.array([150, 10, 8])
    for x in range(x0, x1):
        y0 = int(np.ceil(top[x]))
        for y in range(y0, yr + 1):
            t = (y - y0) / max(1, yr - y0)
            out[y, x] = (lit if y == y0 else red if t < 0.7 else dark).astype(np.uint8)
        out[yc, x] = (12, 10, 12)
    # base do retrovisor interno no forro: forro de LINER_DX px à esquerda
    x0, y0, x1, y1 = IMIRROR_BASE
    out[y0:y1, x0:x1] = nw[y0:y1, x0 - LINER_DX:x1 - LINER_DX]
    # miolo dos mostradores: fundo preto liso (o aro cromado da arte fica)
    yy, xx = np.mgrid[0:nw.shape[0], 0:W]
    for cx, cy, r in DIALS:
        out[np.hypot(xx - cx, yy - cy) <= r + 0.5] = FACE
    # lente verde acesa: apagada (verde bem escuro, o jogo acende)
    x0, y0, x1, y1 = GREEN_LENS
    reg = out[y0:y1, x0:x1].astype(int)
    gm = reg[..., 1] > reg[..., 0] + 30
    reg[gm] = (reg[gm] * np.array([0.25, 0.32, 0.25])).astype(int) + np.array([6, 10, 7])
    out[y0:y1, x0:x1] = reg.astype(np.uint8)
    # "PUMA" do rádio: a frente lisa do rádio, logo à esquerda do letreiro
    x0, y0, x1, y1 = RADIO_TXT
    out[y0:y1, x0:x1] = nw[y0:y1, x0 - (x1 - x0) - 2:x0 - 2]
    return out


def red_mask(rgb, al):
    hsv = cv2.cvtColor(np.ascontiguousarray(rgb), cv2.COLOR_RGB2HSV_FULL).astype(int)
    hue = hsv[..., 0] * 360 / 256
    redh = (hue < 18) | (hue > 338)
    core = al & redh & (hsv[..., 1] > 110) & (hsv[..., 2] > 50)
    near = cv2.dilate(core.astype(np.uint8), np.ones((5, 5), np.uint8)) > 0
    # reflexos claros da lataria (riscos brancos dos para-lamas) e bordas escuras da cor do carro
    light = al & near & (hsv[..., 1] < 70) & (hsv[..., 2] > 150)
    orange = al & near & (hue >= 18) & (hue < 34) & (hsv[..., 1] > 110)   # pontinhos alaranjados do brilho da lataria
    return core | (al & near & redh & (hsv[..., 1] > 40) & (hsv[..., 2] > 28)) | light | orange


def grid(y0, rows, cols=256 + 2 * PAD):
    xs = PIV_X + (np.arange(cols) - PAD + 0.5 - PIV_N[0]) * PXW
    ys = y0 + (np.arange(rows) + 0.5) * PXH
    return xs, ys


def sample(img, xs, ys):
    xi = np.clip(np.floor(xs).astype(int), 0, img.shape[1] - 1)
    yi = np.clip(ys.astype(int), 0, img.shape[0] - 1)
    return img[yi][:, xi]


def wheel_mask(ww):
    H, W = ww.shape[:2]
    y4, x4 = np.mgrid[0:H, 0:W]
    ell = lambda e: ((x4 - e[0]) / e[2]) ** 2 + ((y4 - e[1]) / e[3]) ** 2 <= 1
    outer, inner = ell(RIM_OUT), ell(RIM_IN)
    sp = np.zeros((H, W), np.uint8)
    for p in SPOKES:
        cv2.fillPoly(sp, [np.array(p, np.int32)], 1)
    hub = np.hypot(x4 - HUB[0], y4 - HUB[1]) <= HUB[2] - 3
    return outer & (~inner | (sp > 0) | hub)


def shift_mirror(nw, A, mir):
    """moldura esquerda do retrovisor externo andando para dentro (ver o cabeçalho)"""
    ya, yb = MIR_Y
    src = np.clip(np.round(MIR_MID + (np.arange(ya, yb) - MIR_MID) * MIR_KY).astype(int), 0, nw.shape[0] - 1)
    for arr in (nw, A, mir):
        arr[ya:yb, MIR_DST:MIR_DST + MIR_W] = arr[src, MIR_SRC:MIR_SRC + MIR_W].copy()
    A[ya:yb, :MIR_DST] = False      # à esquerda: janela da porta
    mir[ya:yb, :MIR_DST] = False


def main():
    d, out = sys.argv[1], sys.argv[2]
    dbg = os.environ.get('DBG')
    nw = np.array(Image.open(os.path.join(d, 'cab-nowheel.png')).convert('RGB'))
    ww = np.array(Image.open(os.path.join(d, 'cab-wheel.png')).convert('RGB'))
    g, mir, halo = glass_mask(nw)
    nw = clean(nw)
    hl = nw[halo].astype(int)
    nw[halo] = np.where(hl.mean(axis=1, keepdims=True) < 40, hl, np.array([16, 9, 11])).astype(np.uint8)
    A = ~g
    shift_mirror(nw, A, mir)
    if dbg:
        v = nw.copy()
        v[g] = (0, 255, 0)
        v[mir] = (255, 0, 255)
        Image.fromarray(v).save(os.path.join(dbg, 'cab-alpha.png'))
        v = nw.copy()
        v[~A] = (0, 255, 0)
        Image.fromarray(v).save(os.path.join(dbg, 'cab-alpha2.png'))
    xs, ys = grid(Y0D, ROWS)
    d_rgb, d_al = sample(nw, xs, ys), sample(A, xs, ys)
    xs, yt = grid(Y0D - EXT * PXH, EXT)
    t_rgb, t_al = sample(nw, xs, yt), sample(A, xs, yt)
    st_al = np.concatenate([t_al, d_al], axis=0)
    st_rgb = np.concatenate([t_rgb, d_rgb], axis=0)
    st_mir = np.concatenate([sample(mir, xs, yt), sample(mir, *grid(Y0D, ROWS))], axis=0)
    nat = lambda p: (PIV_N[0] + (p[0] - PIV_X) * S, (p[1] - Y0D) / PXH)
    # farpas de 1 px espetadas no vidro saem
    for _ in range(6):
        nb = np.zeros(st_al.shape, int)
        nb[1:] += st_al[:-1]; nb[:-1] += st_al[1:]; nb[:, 1:] += st_al[:, :-1]; nb[:, :-1] += st_al[:, 1:]
        spur = st_al & (nb <= 1)
        spur[[0, -1]] = False; spur[:, [0, -1]] = False
        st_al &= ~spur
    # furinhos de até 12 px: fecham com a cor do vizinho; o vidro do retrovisor fica
    n, lab, stt, _ = cv2.connectedComponentsWithStats((~st_al).astype(np.uint8), connectivity=4)
    for i in range(1, n):
        if stt[i, cv2.CC_STAT_AREA] <= 12 and not st_mir[lab == i].any():
            for y, x in zip(*np.nonzero(lab == i)):
                nb = [(yy_, xx_) for yy_ in range(y - 1, y + 2) for xx_ in range(x - 1, x + 2)
                      if 0 <= yy_ < st_al.shape[0] and 0 <= xx_ < st_al.shape[1] and st_al[yy_, xx_]]
                if nb:
                    st_rgb[y, x] = np.median([st_rgb[q] for q in nb], axis=0)
            st_al[lab == i] = True
    # ilhas opacas soltas no vidro (até 40 px) somem
    n, lab, stt, _ = cv2.connectedComponentsWithStats(st_al.astype(np.uint8), connectivity=8)
    for i in range(1, n):
        if stt[i, cv2.CC_STAT_AREA] <= 40:
            st_al[lab == i] = False
    t_al, d_al = st_al[:EXT], st_al[EXT:]
    t_rgb, d_rgb = st_rgb[:EXT], st_rgb[EXT:]
    for name, rgb, a_ in (('dash', d_rgb, d_al), ('top', t_rgb, t_al)):
        m = red_mask(rgb, a_)
        if name == 'top':
            m[:6, 110:] = False   # forro rosado no alto (não é lataria); a coluna vermelha à esquerda fica
        Image.fromarray(np.dstack([rgb, a_.astype(np.uint8) * 255]), 'RGBA').save(os.path.join(out, f'br-pumagte-{name}.png'), optimize=True)
        Image.fromarray((m * 255).astype(np.uint8), 'L').save(os.path.join(out, f'br-pumagte-{name}-mask.png'), optimize=True)
        print(name, 'máscara de pintura', int(m.sum()))

    # volante (arte com volante)
    wheel = wheel_mask(ww)
    if dbg:
        v = ww.copy()
        v[~wheel] = (v[~wheel] * 0.35 + np.array([0, 160, 0]) * 0.65).astype(np.uint8)
        Image.fromarray(v[230:760, 470:1000]).resize((1060, 1060), Image.NEAREST).save(os.path.join(dbg, 'wheel-mask.png'))
    wart = ww.copy()
    # "momo" (marca real) está escrito no raio direito: o raio direito vira o esquerdo refletido (o volante
    # é simétrico; o rasgo e o bloco da emenda com o aro são iguais dos dois lados)
    rm = np.zeros(ww.shape[:2], np.uint8)
    cv2.fillPoly(rm, [np.array(SPOKES[1], np.int32)], 1)
    ys_, xs_ = np.nonzero(rm)
    wart[ys_, xs_] = ww[ys_, MIRROR_X - xs_]
    xs = WHEEL_C[0] + (np.arange(256) + 0.5 - PIV_N[0]) * PXW
    ys = WHEEL_C[1] + (np.arange(WROWS) + 0.5 - (PIV_N[1] + WTOP)) * PXH
    w_rgb, w_al = sample(wart, xs, ys), sample(wheel, xs, ys) & (ys < ww.shape[0])[:, None]
    wimg = np.dstack([w_rgb, w_al.astype(np.uint8) * 255])
    hub = (PIV_N[0] + (EMB[0] - WHEEL_C[0]) * S, PIV_N[1] + WTOP + (EMB[1] - WHEEL_C[1]) / PXH)
    # buzina: o logotipo da arte sai; botão preto liso com aro fino e a logo da Onça no meio
    yy, xx = np.mgrid[0:WROWS, 0:256]
    e = np.hypot(xx + 0.5 - hub[0], (yy + 0.5 - hub[1]) * (8 / 7))
    core_r = EMB[2] * S
    wimg[e <= core_r, :3] = (20, 19, 23)
    wimg[(e <= core_r) & (e > core_r - 1.1), :3] = (58, 57, 64)
    wimg[(e <= core_r) & (e > core_r - 1.1) & (yy + 0.5 > hub[1]), :3] = (10, 10, 12)
    brand_badges.stamp(wimg, None, 'onca', (round(hub[0]), round(hub[1]), 9, 0))
    Image.fromarray(wimg, 'RGBA').save(os.path.join(out, 'br-pumagte-wheel.png'), optimize=True)

    r1 = lambda p: tuple(round(float(v), 2) for v in p)
    print('topo começa na linha da arte', round(Y0D - EXT * PXH, 1))
    wr = (WHEEL_C[1] - Y0D) / PXH
    print('centro do aro na linha', round(wr, 2), 'do painel; wheelDy (painel esticado 128/124)', round(wr * 128 / 124 - PIV_N[1], 2))
    for cx, cy, r in DIALS:
        print('mostrador', r1(nat((cx, cy))), 'raio do miolo', round(r * S, 2))
    print('miolo do volante', r1(hub))
    gl = nat((175, 310))
    print('vidro do retrovisor (empilhado, com PAD)', (round(PAD + gl[0]), round(EXT + (310 - Y0D) / PXH)))


if __name__ == '__main__':
    main()
