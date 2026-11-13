"""Cabine do Toro LP5 (Countach 5000 QV) a partir da arte nova do Victor (cab-wheel.png, 1672x941, couro
caramelo, volante de três raios). Não há a arte sem volante: o que fica atrás dele é RECONSTRUÍDO.
- escala: a arte inteira cabe na largura do painel com as folgas (1672 px -> 460 colunas, S = 0,2751):
  nada fica esticado nem espelhado em tela nenhuma (o jogo nunca passa de 460 colunas) e o retrovisor
  esquerdo da arte, longe na porta, aparece inteiro na tela larga e quase inteiro no celular
- vidros por geometria medida na arte (não pela cor: as pedras do muro e o asfalto têm os tons do painel):
  para-brisa à direita da borda da coluna A (x = 387 + 0,258 y) e acima da borda do painel (DASH_TOP,
  em cima da faixa vermelha do capô e do friso azulado do painel); janela da porta à esquerda da moldura
  (x = 223 + 0,452 y) e acima da soleira (y = 375 - 0,258 x). Os limpadores da arte saem (vidro limpo)
- retrovisor esquerdo: a carcaça vermelha (com o contorno escuro) fica; o vidro dele (com a estrada
  pintada) vira transparente, fechado pela moldura: o jogo desenha a vista de trás (glass.at)
- a arte corta no alto: acima dela (TOP_EXT) a moldura da porta e a coluna A continuam subindo na
  própria inclinação até o forro, que é desenhado em cima (couro caramelo escuro e a borracha do vidro)
- atrás do volante: o aro em cima do para-brisa vira vidro; a faixa do capô, o capuz do quadro, a aba de
  baixo dele e o painel de baixo continuam a textura dos dois lados de cada linha (bridge); atrás do
  miolo entra a capa da coluna de direção; a placa do quadro é coberta pelo quadro refeito
  (lp5_cluster.py), que leva os sete mostradores
- volante de três raios recortado da arte (aro pela elipse medida, raios e miolo por polígono); o touro
  dourado do miolo sai (fica o disco preto com o anel dourado) e entra o emblema fictício da Toro
  (brand_badges.stamp, no ponto WHEELS['countach'])
Uso: python3 tools/ref/lp5_cockpit.py <pasta com cab-wheel.png> <src/assets/cockpit>
     (DBG=<pasta> grava as máscaras e a arte reconstruída para conferência)
"""
import os
import sys

import cv2
import numpy as np
from PIL import Image, ImageDraw

W_ART, H_ART = 1672, 941
PAD, ROWS, EXT = 102, 124, 76
COLS = 256 + 2 * PAD
PXW = W_ART / COLS                  # 3,635 px da arte por coluna
PXH = PXW * 7 / 8                   # pixel 8:7: a linha cobre menos arte que a coluna
S = 1 / PXW
Y0 = 175.0                          # linha da arte onde começa o painel (a borda dele cai na linha 12)
TOPY = Y0 - EXT * PXH               # topo da cabine (acima da arte: construído)
UP = int(np.ceil(-TOPY)) + 2        # linhas construídas acima da arte
# volante (arte): elipses do aro (o de dentro é mais fundo embaixo: aro visto de cima), miolo e raios
RIM_OUT = (842.0, 431.0, 287.5, 284.5)
RIM_IN = (842.0, 431.0, 228.0, 230.0)
HUB = (849.0, 437.0, 71.0)          # disco do miolo (com o anel claro)
SPOKE_L = [(606, 377), (700, 383), (790, 378), (803, 395), (800, 455), (700, 455), (606, 449)]
SPOKE_R = [(2 * 848 - x, y) for x, y in SPOKE_L]
SPOKE_D = [(805, 488), (893, 488), (884, 520), (883, 662), (900, 684), (797, 684), (814, 662), (813, 520)]
BADGE = (849.0, 437.0, 44.0)        # anel dourado do miolo (o touro dentro dele sai)
PIV = (842.0, 431.0)                # centro do aro
# borda de cima do painel (x, y): o vidro para aqui (faixa vermelha do capô e friso do painel ficam)
DASH_TOP = [(380, 300), (436, 262), (442, 214), (470, 213), (500, 214), (530, 210), (560, 209), (600, 206), (640, 202),
            (670, 199), (700, 198), (760, 199), (850, 201), (950, 199), (1000, 198), (1080, 197), (1150, 197),
            (1220, 197), (1290, 192), (1360, 191), (1430, 195), (1470, 203), (1510, 207), (1560, 209), (1620, 211), (1672, 212)]
WS_L = (387.0, 0.258)               # borda da coluna A no para-brisa: x = a + b y
WIN_R = (223.0, 0.452)              # borda da moldura da porta na janela: x = a + b y
WIN_B = (375.0, -0.258)             # soleira da janela: y = a + b x
MIR_BOX = (6, 160, 352, 322)        # retrovisor esquerdo (carcaça, braço e vidro)
MIR_SEED = (130, 240)               # dentro do vidro do retrovisor
# forro (acima da arte): faixa de couro e a borracha do para-brisa embaixo dela
FORRO_Y = -48.0                     # borda de baixo do forro (y da arte, construído)
SEAL = 5.0
LINER = (150, 92, 40)
# placa do quadro (coberta pelo quadro refeito) e as linhas da reconstrução
PLATE = (507, 262, 1251, 380)       # contorno preto incluído (cantos arredondados: raio 4 colunas)
COLUMN = (848.0, 405.0, 62.0)       # capa da coluna de direção atrás do miolo (cx, topo, meia largura)
LOW_Y = 378                         # daqui para baixo (aba do capuz e painel de baixo): linhas lisas, sem cópia
COL_BOT = 560                       # fim da capa (embaixo dela, o vão escuro dos pedais)


def ellipse(shape, e, grow=0.0):
    H, W = shape
    y, x = np.mgrid[0:H, 0:W]
    return ((x - e[0]) / (e[2] + grow)) ** 2 + ((y - e[1]) / (e[3] + grow)) ** 2 <= 1


def poly(shape, pts, oy=0):
    m = np.zeros(shape, np.uint8)
    cv2.fillPoly(m, [np.array([(x, y + oy) for x, y in pts], np.int32)], 1)
    return m.astype(bool)


def wheel_mask(shape, oy=0):
    """aro (entre as duas elipses), miolo e os três raios; coordenadas da arte + oy linhas"""
    H, W = shape
    y, x = np.mgrid[0:H, 0:W]
    y = y - oy
    ro, ri = RIM_OUT, RIM_IN
    out = ((x - ro[0]) / ro[2]) ** 2 + ((y - ro[1]) / ro[3]) ** 2 <= 1
    inn = ((x - ri[0]) / ri[2]) ** 2 + ((y - ri[1]) / ri[3]) ** 2 <= 1
    hub = np.hypot(x - HUB[0], y - HUB[1]) <= HUB[2]
    sp = poly(shape, SPOKE_L, oy) | poly(shape, SPOKE_R, oy) | poly(shape, SPOKE_D, oy)
    return (out & ~inn) | ((hub | sp) & inn)


def dash_top(W):
    px, py = zip(*DASH_TOP)
    return np.interp(np.arange(W), px, py)


def glass_mask(H, W, oy):
    """vidros por geometria (coordenadas do quadro estendido: y da arte + oy)"""
    yy, xx = np.mgrid[0:H, 0:W]
    y = yy - oy
    top = dash_top(W)[xx]
    ws = (xx >= WS_L[0] + WS_L[1] * y) & (y < top)
    win = (xx < WIN_R[0] + WIN_R[1] * y) & (y < WIN_B[0] + WIN_B[1] * xx)
    return ws | win


def mirror_parts(art):
    """carcaça (vermelha + contorno escuro) e o vidro do retrovisor esquerdo, na caixa MIR_BOX"""
    x0, y0, x1, y1 = MIR_BOX
    a = art[y0:y1, x0:x1].astype(int)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    red = (r > 110) & (r - g > 55) & (r - b > 45)
    red = cv2.morphologyEx(red.astype(np.uint8), cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8))
    # só a carcaça (a maior mancha): os pontinhos laranja das pedras do muro ficam no vidro
    n, lab, st, _ = cv2.connectedComponentsWithStats(red, connectivity=8)
    red = (lab == 1 + np.argmax(st[1:, cv2.CC_STAT_AREA])).astype(np.uint8)
    # o anel vermelho fecha o vidro: o que ele cerca (ligado à semente) é o vidro
    n, lab = cv2.connectedComponents((1 - red).astype(np.uint8), connectivity=4)
    glass = lab == lab[MIR_SEED[1] - y0, MIR_SEED[0] - x0]
    filled = red.astype(bool) | glass
    # contorno escuro da carcaça (por fora) e da moldura do vidro (por dentro)
    body = cv2.dilate(filled.astype(np.uint8), np.ones((5, 5), np.uint8)).astype(bool)
    lum = a.mean(axis=2)
    edge = body & ~filled & (lum < 50) & (a[..., 0] >= a[..., 2])   # contorno escuro (não o asfalto azulado)
    housing = (red.astype(bool) | edge)
    # vidro: tira a borda escura de dentro da moldura (ela fica na carcaça)
    gi = glass & ~cv2.dilate(red, np.ones((5, 5), np.uint8)).astype(bool)
    housing |= glass & ~gi
    # a moldura tem de fechar o vidro com folga (2 colunas do jogo): o que faltar na faixa em volta dele
    # vira o contorno vermelho-escuro da carcaça (senão o vidro do retrovisor vaza para o da janela)
    ring = cv2.dilate(gi.astype(np.uint8), cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (15, 15))).astype(bool) & ~gi
    fix = ring & ~housing
    housing |= ring
    full = [np.zeros(art.shape[:2], bool) for _ in range(3)]
    for f, m in zip(full, (housing, gi, fix)):
        f[y0:y1, x0:x1] = m
    return full


def bridge(img, hole, bad=None):
    """cada trecho de linha a refazer continua a textura dos dois lados (cópia deslocada, sem espelhar);
    `bad`: pixels que não servem de fonte"""
    if bad is None:
        bad = np.zeros_like(hole)
    H, W = hole.shape
    out = img.astype(float)
    for y in range(H):
        row = hole[y]
        if not row.any():
            continue
        xs = np.nonzero(row)[0]
        for r in np.split(xs, np.nonzero(np.diff(xs) > 1)[0] + 1):
            a, b = r[0], r[-1]
            n = b - a + 1
            i = np.arange(n)
            okl, okr = a > 0, b < W - 1
            lsrc = np.clip(a - n + i, 0, W - 1)
            lsrc = np.where(lsrc < a - n + i, a - 1 - (i % max(1, a)), lsrc)
            rsrc = np.clip(b + 1 + i, 0, W - 1)
            t = ((i + 0.5) / n)[:, None]
            if okl and okr:
                wl, wr = (1 - t) * ~bad[y, lsrc][:, None], t * ~bad[y, rsrc][:, None]
                sw = wl + wr
                wl = np.where(sw > 0, wl / np.maximum(sw, 1e-9), 1 - t)
                wr = np.where(sw > 0, wr / np.maximum(sw, 1e-9), t)
                v = out[y, lsrc] * wl + out[y, rsrc] * wr
            else:
                v = out[y, lsrc] if okl else out[y, rsrc]
            out[y, a:b + 1] = v
    return out.astype(np.uint8)


def grain(shape, seed=5):
    rs = np.random.RandomState(seed)
    n = rs.normal(0, 1, shape)
    return cv2.GaussianBlur(n, (3, 3), 0.7) / 0.45


def smooth_rows(out, hole, g, win=40, k=5.0):
    """cada trecho de linha recebe a cor dos dois lados (mediana da faixa vizinha sem os interruptores
    vermelhos/verdes nem os brilhos), passando de uma para a outra, com o grão do couro"""
    H, W = hole.shape
    o = out.astype(int)
    skip = ((o[..., 0] > 150) & (o[..., 1] < 100)) | (o[..., 1] > o[..., 0] + 25) | (o.min(axis=2) > 170) | hole
    for y in range(H):
        if not hole[y].any():
            continue
        xs = np.nonzero(hole[y])[0]
        for r in np.split(xs, np.nonzero(np.diff(xs) > 1)[0] + 1):
            a, b = r[0], r[-1]
            def side(x0, x1):
                seg, ok = out[y, x0:x1], ~skip[y, x0:x1]
                return np.median(seg[ok], axis=0) if ok.sum() >= 3 else (np.median(seg, axis=0) if len(seg) else None)
            cl = side(max(0, a - win), a) if a > 0 else None
            cr = side(b + 1, b + 1 + win) if b < W - 1 else None
            cl = cr if cl is None else cl
            cr = cl if cr is None else cr
            t = ((np.arange(b - a + 1) + 0.5) / (b - a + 1))[:, None]
            v = cl * (1 - t) + cr * t + g[y, a:b + 1, None] * k * (np.maximum(cl, cr).mean() / 80 + 0.3)
            out[y, a:b + 1] = np.clip(v, 0, 255).astype(np.uint8)


def rebuild(E, wheel, glass, oy):
    """o painel atrás do volante (ver o cabeçalho)"""
    H, W = wheel.shape
    yy, xx = np.mgrid[0:H, 0:W]
    y = yy - oy
    # o contorno escuro do aro passa um pouco das elipses: refaz com folga
    hole = cv2.dilate(wheel.astype(np.uint8), np.ones((7, 7), np.uint8)).astype(bool) & ~glass
    out = E.copy()
    # capa da coluna de direção atrás do miolo (só aparece com o volante girado)
    cx, ct, hw = COLUMN
    col = hole & (np.abs(xx - cx) <= hw) & (y >= ct) & (y <= COL_BOT)
    # do capuz do quadro até a aba de baixo dele: cada linha continua a textura dos dois lados (faixas
    # retas); embaixo (painel dos interruptores, rádio, joelheira): a cor dos dois lados de cada linha
    # com o grão, sem copiar interruptores nem botões
    rest = hole & ~col
    out = bridge(out, rest & (y < LOW_Y), glass | wheel)
    smooth_rows(out, rest & (y >= LOW_Y), grain((H, W), 3))
    im = Image.fromarray(out)
    d = ImageDraw.Draw(im)
    top = ct + oy
    bot = COL_BOT + oy
    d.rounded_rectangle([cx - hw, top, cx + hw, bot], radius=26, fill=(9, 8, 12))
    d.rounded_rectangle([cx - hw + 4, top + 3, cx + hw - 4, bot - 4], radius=23, fill=(40, 38, 50))
    d.rounded_rectangle([cx - hw + 8, top + 9, cx + hw - 8, bot - 9], radius=20, fill=(29, 28, 37))
    d.line([(cx - hw + 22, top + 5), (cx + hw - 22, top + 5)], fill=(78, 76, 94), width=2)
    sh = np.array(im)
    g = grain((H, W), 7)[..., None] * 4.0
    out[col] = np.clip(sh[col] + g[col], 0, 255).astype(np.uint8)
    return out


# luzes-espia do painel de baixo (arte sem volante): lente de cada uma (x0, y0, x1, y1 da arte) e a cor
# acesa; na arte elas vêm acesas: no painel ficam apagadas (escurecidas, o texto apagado) e o jogo copia a
# lente acesa (countach-dashlamps.png) na hora certa (lp5Cluster em src/cockpit.ts)
DASH_LAMPS = [('mil', (492, 431, 529, 456)), ('temp', (536, 431, 577, 456)), ('farol', (490, 465, 531, 493)),
              ('freio', (535, 465, 578, 493)), ('porta', (584, 465, 627, 493)), ('alto', (634, 465, 677, 493))]
LAMP_BOX = (486, 426, 682, 498)     # caixa das seis (o recorte aceso)


def lamps_off(R, oy):
    for _, (x0, y0, x1, y1) in DASH_LAMPS:
        reg = R[y0 + oy:y1 + oy, x0:x1].astype(float)
        sat = reg.max(axis=2) - reg.min(axis=2)
        lum = reg.mean(axis=2)
        lens = (sat > 60) | (lum > 150)          # vidro colorido e o texto aceso (a moldura cinza fica)
        dim = reg * 0.30 + 6
        reg[lens] = dim[lens]
        R[y0 + oy:y1 + oy, x0:x1] = reg.astype(np.uint8)


def extend_up(art, oy):
    """acima da arte: moldura da porta, coluna A e janelas continuam subindo na própria inclinação;
    o forro é desenhado por cima"""
    H, W = art.shape[:2]
    E = np.zeros((H + oy, W, 3), np.uint8)
    E[oy:] = art
    xs = np.arange(W).astype(float)
    # inclinação de cada coluna (x na linha 0 da arte): moldura da porta 0,452, borda da coluna A 0,258
    def slope(x0):
        return np.interp(x0, [WIN_R[0], WS_L[0]], [WIN_R[1], WS_L[1]])
    for k in range(1, oy + 1):
        yt = -k                                   # linha da arte (negativa)
        r = k % 6                                 # linha de origem (repete o grão das 6 primeiras)
        # x0 na linha r da peça que passa por (x, yt): x = x0 + s (y - r)
        x0 = xs.copy()
        for _ in range(3):
            x0 = xs - slope(x0) * (yt - r)
        src = np.clip(np.round(x0).astype(int), 0, W - 1)
        E[oy - k] = art[r, src]
    # forro: couro caramelo escuro com o grão, a borda de baixo com a borracha do para-brisa
    yy, xx = np.mgrid[0:oy, 0:W]
    y = yy - oy
    edge = FORRO_Y + 0.010 * (W - xx) * 0                      # reta
    liner = y < edge
    sh = 1 - 0.35 * np.clip((y - (TOPY)) / (edge - TOPY), 0, 1)   # mais escuro perto do vidro
    g = grain((oy, W), 11) * 6
    col = np.clip(np.array(LINER)[None, None, :] * sh[..., None] + g[..., None], 0, 255)
    E[:oy][liner] = col[liner].astype(np.uint8)
    seal = (y >= edge) & (y < edge + SEAL)
    E[:oy][seal] = (14, 12, 14)
    E[:oy][(y >= edge) & (y < edge + 1.2)] = (70, 52, 34)
    return E


def sample(img, xs, ys):
    xi = np.clip(np.floor(xs).astype(int), 0, img.shape[1] - 1)
    yi = np.clip(np.floor(ys).astype(int), 0, img.shape[0] - 1)
    return img[yi][:, xi]


def main():
    d, out = sys.argv[1], sys.argv[2]
    dbg = os.environ.get('DBG')
    art = np.array(Image.open(os.path.join(d, 'cab-wheel.png')).convert('RGB'))
    H, W = art.shape[:2]
    nwp = os.path.join(d, 'cab-nowheel.png')
    nw = np.array(Image.open(nwp).convert('RGB'))[:H] if os.path.exists(nwp) else None
    base = nw if nw is not None else art
    oy = UP
    E = extend_up(base, oy)
    EH = E.shape[0]
    glass = glass_mask(EH, W, oy)
    wheel = wheel_mask((EH, W), oy)
    house, mglass, mfix = mirror_parts(base)
    mh = np.zeros((EH, W), bool)
    mg = np.zeros((EH, W), bool)
    mh[oy:], mg[oy:] = house, mglass
    glass = (glass & ~mh) | mg
    # o forro e a borracha não são vidro
    yy = np.arange(EH)[:, None] - oy
    glass &= ~(yy < FORRO_Y + SEAL)
    if nw is not None:   # arte sem volante: o painel é ela (as luzes-espia apagadas, lamps_off)
        R = E.copy()
        R[oy:][mfix] = (52, 8, 10)
        lamps_off(R, oy)
        print('painel da arte sem volante')
    else:
        R = rebuild(E, wheel, glass, oy)
        print('painel reconstruído atrás do volante (sem cab-nowheel.png na pasta)')
    # placa do quadro: lisa (o quadro refeito cobre)
    x0, y0, x1, y1 = PLATE
    im = Image.fromarray(R)
    ImageDraw.Draw(im).rounded_rectangle([x0, y0 + oy, x1, y1 + oy], radius=4 * PXW, fill=(10, 9, 9))
    R = np.array(im)
    if dbg:
        v = R.copy()
        v[glass] = (v[glass] * 0.3 + np.array([0, 200, 0]) * 0.7).astype(np.uint8)
        Image.fromarray(v).save(os.path.join(dbg, 'cab-glass.png'))
        v = E.copy()
        v[wheel] = (v[wheel] * 0.4 + np.array([200, 0, 200]) * 0.6).astype(np.uint8)
        Image.fromarray(v).save(os.path.join(dbg, 'cab-wheelmask.png'))
        Image.fromarray(R).save(os.path.join(dbg, 'cab-rebuilt.png'))
    # painel e teto (pixels nativos: coluna c cobre a arte de c*PXW a (c+1)*PXW; amostra no meio)
    xs = (np.arange(COLS) + 0.5) * PXW
    ys = oy + Y0 + (np.arange(ROWS) + 0.5) * PXH
    yt = oy + TOPY + (np.arange(EXT) + 0.5) * PXH
    if nw is not None:   # luzes-espia acesas: o recorte da caixa delas, como na arte (lp5Cluster copia a lente)
        c0, c1 = int(LAMP_BOX[0] // PXW), int(np.ceil(LAMP_BOX[2] / PXW))
        r0, r1 = int((LAMP_BOX[1] - Y0) // PXH), int(np.ceil((LAMP_BOX[3] - Y0) / PXH))
        lit = sample(E, xs[c0:c1], ys[r0:r1])
        Image.fromarray(lit).save(os.path.join(out, 'countach-dashlamps.png'), optimize=True)
        print('luzes do painel: recorte', (c0 - PAD, r0, c1 - c0, r1 - r0))
        for n, (x0, y0, x1, y1) in DASH_LAMPS:
            print('  ', n, tuple(round(v, 2) for v in (x0 / PXW - PAD, (y0 - Y0) / PXH, x1 / PXW - PAD, (y1 - Y0) / PXH)))
    st_rgb = np.concatenate([sample(R, xs, yt), sample(R, xs, ys)], axis=0)
    st_al = np.concatenate([~sample(glass, xs, yt), ~sample(glass, xs, ys)], axis=0)
    # farpas de 1 px espetadas no vidro em volta do retrovisor (faixa amarela do asfalto) saem
    mx0 = int(MIR_BOX[2] / PXW) + 2
    for _ in range(6):
        nb = np.zeros(st_al.shape, int)
        nb[1:] += st_al[:-1]; nb[:-1] += st_al[1:]; nb[:, 1:] += st_al[:, :-1]; nb[:, :-1] += st_al[:, 1:]
        spur = st_al & (nb <= 1)
        spur[:, mx0:] = False
        spur[:EXT] = False
        st_al &= ~spur
    # e os restos do cenário encostados na carcaça (cinza ou bege, não vermelho) também
    for _ in range(3):
        sr = st_rgb.astype(int)
        nb = np.zeros(st_al.shape, int)
        nb[1:] += st_al[:-1]; nb[:-1] += st_al[1:]; nb[:, 1:] += st_al[:, :-1]; nb[:, :-1] += st_al[:, 1:]
        junk = st_al & (nb < 4) & (sr[..., 0] - sr[..., 1] < 40) & (sr.mean(axis=2) > 60)
        junk[:, mx0:] = False
        junk[:EXT + 8] = False
        junk[EXT + 50:] = False
        st_al &= ~junk
    # ilhas opacas soltas no vidro (até 8 px: pontinhos do cenário) somem; furinhos de até 8 px fecham
    n, lab, stt, _ = cv2.connectedComponentsWithStats(st_al.astype(np.uint8), connectivity=8)
    for i in range(1, n):
        if stt[i, cv2.CC_STAT_AREA] <= 8:
            st_al[lab == i] = False
    n, lab, stt, _ = cv2.connectedComponentsWithStats((~st_al).astype(np.uint8), connectivity=4)
    mx1 = int(MIR_BOX[2] / PXW) + 2                        # retrovisor: as frestas da carcaça (até 70 px) fecham
    for i in range(1, n):
        x_, y_, w_, h_, area = stt[i]
        if area <= 8 or (area <= 70 and x_ + w_ <= mx1 and y_ >= EXT):
            for y, x in zip(*np.nonzero(lab == i)):
                nb = [st_rgb[q] for q in ((y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1))
                      if 0 <= q[0] < st_al.shape[0] and 0 <= q[1] < st_al.shape[1] and st_al[q]]
                if nb:
                    st_rgb[y, x] = np.median(nb, axis=0)
            st_al[lab == i] = True
    for name, sl in (('top', slice(0, EXT)), ('dash', slice(EXT, None))):
        Image.fromarray(np.dstack([st_rgb[sl], st_al[sl].astype(np.uint8) * 255]), 'RGBA').save(os.path.join(out, f'countach-{name}.png'), optimize=True)
    # volante: 256 colunas (as do meio do painel), WTOP linhas acima do topo do painel
    WTOP = int(np.ceil((Y0 - (RIM_OUT[1] - RIM_OUT[3])) / PXH)) + 1
    WROWS = int(np.ceil((RIM_OUT[1] + RIM_OUT[3] - Y0) / PXH)) + WTOP + 2
    wart = art.copy()
    wm = wheel_mask((H, W))
    # touro dourado do miolo sai: dentro do anel dourado fica o disco preto
    bx, by, br = BADGE
    yy, xx = np.mgrid[0:H, 0:W]
    dd = np.hypot(xx - bx, yy - by)
    inner = dd <= br - 7
    wart[inner] = (12, 11, 14)
    # nas bordas das elipses entra um pouco do fundo (couro, faixa vermelha do capô, interruptores): o
    # volante é cinza-arroxeado, sem cor forte (só o anel dourado do miolo)
    wa = art.astype(int)
    sat = wa.max(axis=2) - wa.min(axis=2)
    wm &= ~((sat > 75) & (dd > br + 3))
    wm = cv2.morphologyEx(wm.astype(np.uint8), cv2.MORPH_OPEN, np.ones((3, 3), np.uint8)).astype(bool)
    xs = (np.arange(256) + PAD + 0.5) * PXW
    ys = Y0 + (np.arange(WROWS) - WTOP + 0.5) * PXH
    wrgb, wal = sample(wart, xs, ys), sample(wm, xs, ys)
    wimg = np.dstack([wrgb, wal.astype(np.uint8) * 255])
    piv = (PIV[0] / PXW - PAD, (PIV[1] - Y0) / PXH)
    hub = (BADGE[0] / PXW - PAD, (BADGE[1] - Y0) / PXH + WTOP)
    sys.path.insert(0, os.path.dirname(__file__))
    import brand_badges as bb
    spot = bb.WHEELS['countach']
    bb.stamp(wimg, None, 'toro', spot)
    Image.fromarray(wimg, 'RGBA').save(os.path.join(out, 'countach-wheel.png'), optimize=True)
    r2 = lambda v: tuple(round(float(t), 2) for t in v)
    print('S', round(S, 4), 'PXW', round(PXW, 3), 'PXH', round(PXH, 3), 'topo', round(TOPY, 1))
    print('pivô', r2(piv), 'wheelTop', WTOP, 'linhas do volante', WROWS, 'miolo (png do volante)', r2(hub))
    nat = lambda x, y: (x / PXW - PAD, (y - Y0) / PXH)
    print('vidro do retrovisor (empilhado, com PAD)', r2((MIR_SEED[0] / PXW, EXT + (MIR_SEED[1] - Y0) / PXH)))
    print('placa', r2(nat(PLATE[0], PLATE[1])), r2(nat(PLATE[2], PLATE[3])))


if __name__ == '__main__':
    main()
