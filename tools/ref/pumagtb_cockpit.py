"""Cabine da Onça GTB (Puma GTB S2) a partir das duas artes novas do Victor (com e sem volante, com
cenário pelos vidros), no molde da Onça GTE (onca_gte_cockpit2.py):
- painel, colunas e porta da arte SEM volante; volante esportivo de três raios da arte COM volante (aro pelas
  elipses medidas, raios pelo contorno medido, almofada por um círculo); as duas artes estão alinhadas
- vidros por geometria medida: para-brisa da borda de cima até o capô vermelho (HOOD), à direita da coluna
  (PILLAR_R); janela da porta (DOOR) menos a carcaça do retrovisor externo; vidro do retrovisor (o miolo
  dentro da moldura vermelha). Restos de cenário grudados no contorno saem
- a arte não tem forro em cima (o para-brisa vai até a borda): o forro é desenhado (LINER), descendo em
  curva até a coluna
- limpadores da arte saem (acima do capô viram vidro; onde encostam no capô, cada linha continua)
- retrovisor interno sai (o jogo desenha o dele): vira para-brisa
- retrovisor externo esquerdo: a moldura esquerda anda para dentro (aparece no celular), como na GTE
- mostradores: o miolo dos seis vira fundo preto liso; o quadro (pumagtb_gauges.py) cobre cada um
- buzina: o logotipo da arte vira botão escuro com a logo da Onça
Escala 0,34 (pixel 8:7), como na GTE.
Uso: python3 tools/ref/pumagtb_cockpit.py <pasta com cockwheel.png e cockdash.png> <src/assets/cockpit>  (DBG=<pasta>)
"""
import os
import sys

import cv2
import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(__file__))
import brand_badges  # noqa: E402

ID = 'br-pumagtb'
S = 0.34
PXW, PXH = 1 / S, (1 / S) / (8 / 7)
PIV_X = 735.0
WHEEL_C = (735.0, 512.0)
Y0D = 216.0
PIV_N = (128.0, 104.0)
ROWS, EXT, PAD = 124, 76, 102
WTOP, WROWS = 4, 210
RIM_OUT = (734.0, 510.0, 247.0, 230.0)
RIM_IN = (734.0, 510.0, 222.0, 205.0)
HUB = (735.0, 517.0, 68.0)
SPOKES = [
    [(552, 458), (600, 461), (690, 468), (692, 526), (640, 521), (600, 507), (552, 503)],
    [(1470 - x, y) for x, y in [(552, 458), (600, 461), (690, 468), (692, 526), (640, 521), (600, 507), (552, 503)]],
    [(698, 572), (774, 572), (770, 640), (760, 690), (768, 718), (702, 718), (710, 690), (700, 640)],
]
EMB = (735.0, 512.0, 36.0)
PILLAR_R = [(393, 0), (400, 50), (412, 100), (424, 150), (436, 200), (446, 250), (452, 290)]
# janela da porta até a borda escura da coluna (x = 205 + 0,385 y, medida na arte): o vão entre o retrovisor e a coluna é vidro
DOOR = [(0, 0), (206, 0), (260, 140), (321, 300), (344, 360), (349, 374), (0, 432)]
HOUSING = [(56, 262), (66, 244), (86, 235), (245, 235), (262, 247), (285, 280), (300, 305), (318, 314), (318, 332), (292, 346),
           (258, 372), (242, 385), (82, 385), (62, 374), (55, 352)]
MIRROR_SEED = (160, 310)
CORNER = [(268, 284), (316, 280), (330, 318), (349, 374), (244, 388), (254, 330)]   # canto da janela atrás do pé do retrovisor
MIR_Y = (230, 390)
MIR_SRC, MIR_DST, MIR_W = 52, 124, 98   # emenda em x 222, onde a moldura tem a mesma altura da coluna 150 copiada
MIR_MID, MIR_KY = 310.0, 1.0
DIALS = [(669, 400, 58.0), (830, 400, 58.0), (1024, 404, 32.0), (1110, 404, 32.0), (1198, 404, 32.0), (1283, 404, 32.0)]
FACE = (11, 11, 13)
WIPERS = [(680, 815), (1140, 1285)]   # faixas (x) onde os limpadores encostam no capô

def poly(shape, pts):
    return cv2.fillPoly(np.zeros(shape, np.uint8), [np.array(pts, np.int32)], 1) > 0


HOOD_CACHE = {}


def hood_line(W, img=None):
    """borda de cima do capô vermelho em cada coluna (primeira linha vermelha entre 240 e 300); onde os
    limpadores tapam a borda, interpolada; à esquerda do capô, a coluna"""
    if 'h' in HOOD_CACHE:
        return HOOD_CACHE['h']
    a = img.astype(int)
    red = (a[..., 0] > a[..., 1] + 60) & (a[..., 0] > 90) & (a[..., 2] < 110)
    xs, ys = [], []
    for x in range(446, W):
        if any(x0 <= x < x1 for x0, x1 in WIPERS):
            continue
        r = np.nonzero(red[245:300, x] & red[249:304, x])[0]   # vermelho de pelo menos 4 linhas (o capô)
        if len(r):
            xs.append(x)
            ys.append(245 + r[0])
    ys = np.array(ys, float)
    ys = np.array([np.median(ys[max(0, i - 6):i + 7]) for i in range(len(ys))])
    h = np.interp(np.arange(W), xs, ys)
    # borda lisa (pedido do Victor: capô uniforme, sem dentes nem restos do limpador): curva suave pelos pontos
    sel = np.arange(446, W)
    cf = np.polyfit(sel, h[sel], 6)
    h[sel] = np.round(np.polyval(cf, sel))
    HOOD_CACHE['h'] = h
    return h


def glass_mask(nw):
    H, W = nw.shape[:2]
    yy, xx = np.mgrid[0:H, 0:W]
    hsv = cv2.cvtColor(nw, cv2.COLOR_RGB2HSV).astype(int)
    red = (nw[..., 0].astype(int) > nw[..., 1].astype(int) + 60) & (nw[..., 0] > 90)
    sat = (hsv[..., 1] > 90) & (hsv[..., 2] > 60) & ~red
    # para-brisa: do forro desenhado (LINER) até o capô, à direita da coluna
    roof = liner_line(W)
    top = hood_line(W, nw)
    left = pillar_edge(nw)
    ws = (yy >= roof[xx]) & (yy < top[xx]) & (xx >= left[yy])
    house = poly((H, W), HOUSING)
    door = poly((H, W), DOOR) & ~house
    # pé do retrovisor (a chapa vermelha que desce até a soleira) com o contorno escuro: fica sólido
    a_ = nw.astype(int)
    sail = (a_[..., 0] > a_[..., 1] + 50) & (a_[..., 0] > 80) & (xx < 330) & (yy > 280) & (yy < 390)
    sail = cv2.morphologyEx(sail.astype(np.uint8), cv2.MORPH_CLOSE, np.ones((9, 9), np.uint8))
    sail = cv2.dilate(sail, np.ones((5, 5), np.uint8)) > 0
    # o canto da janela entre o retrovisor e a coluna, do braço até a soleira, é a chapa do pé do retrovisor
    # (sólida: o retrovisor não fica solto no vidro)
    door &= ~sail & ~poly((H, W), CORNER)
    # risco amarelo da estrada desenhado entre o retrovisor e a coluna: vidro
    yel = (a_[..., 0] > 160) & (a_[..., 1] > 110) & (a_[..., 2] < 90) & (xx > 255) & (xx < 330) & (yy > 230) & (yy < 300)
    yel = cv2.dilate(yel.astype(np.uint8), np.ones((5, 5), np.uint8)) > 0
    door |= yel & ~poly((H, W), CORNER)
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
    scene = sat & (hsv[..., 0] > 15) & (hsv[..., 0] < 140) & ~house & (yy < top[xx] + 2) & (yy >= roof[xx])
    for _ in range(10):
        near = cv2.dilate(g.astype(np.uint8), np.ones((3, 3), np.uint8)) > 0
        g |= near & scene
    # dentro do polígono da carcaça, o que fica a mais de 3 px da moldura vermelha (pedras do muro nos
    # cantos arredondados) é janela; o contorno escuro da moldura fica
    near = cv2.dilate(frame.astype(np.uint8), np.ones((5, 5), np.uint8)) > 0
    g |= house & ~mir & ~near
    halo = house & near & ~frame & ~mir    # vira o contorno escuro da moldura
    g &= ~poly((H, W), CORNER)   # a chapa do canto é sólida inteira
    return g | mir, mir, halo


def row_fix(img, x0, x1, ya, yb):
    """cada linha de ya a yb (inclusive) entre as colunas x0 e x1 passa da cor de fora da esquerda para a de
    fora da direita (mediana de 3 px de cada lado)"""
    for y in range(int(ya), int(yb) + 1):
        cl = np.median(img[y, x0 - 3:x0].astype(float), axis=0)
        cr = np.median(img[y, x1:x1 + 3].astype(float), axis=0)
        t = ((np.arange(x1 - x0) + 0.5) / (x1 - x0))[:, None]
        img[y, x0:x1] = (cl * (1 - t) + cr * t).astype(np.uint8)


def pillar_edge(nw):
    """borda direita da coluna: em cada linha, o primeiro pixel de cenário (saturado, não vermelho) à
    direita de x 370 (alisado); abaixo do capô, a reta medida"""
    a = nw.astype(int)
    hsv = cv2.cvtColor(nw, cv2.COLOR_RGB2HSV).astype(int)
    red = (a[..., 0] > a[..., 1] + 60) & (a[..., 0] > 90)
    gray = (np.abs(a[..., 0] - a[..., 2]) < 30) & (a.mean(axis=2) > 80)   # asfalto
    scene = (((hsv[..., 1] > 90) & (hsv[..., 2] > 60)) | gray) & ~red
    H = nw.shape[0]
    lx, ly = zip(*PILLAR_R)
    ref = np.interp(np.arange(H), ly, lx)
    e = ref.copy()
    for y in range(0, 300):
        xs = np.nonzero(scene[y, 370:480])[0]
        if len(xs):
            e[y] = 370 + xs[0]
    e[:300] = [np.median(e[max(0, y - 8):y + 9]) for y in range(300)]
    return np.minimum(e, ref + 12)


def liner_line(W):
    """borda de baixo do forro desenhado: 30 linhas na maior parte, descendo em curva até a coluna"""
    x = np.arange(W).astype(float)
    return 34 + 22 * np.clip((620 - x) / 230, 0, 1) ** 1.6


def clean(nw):
    out = nw.copy()
    H, W = nw.shape[:2]
    top = hood_line(W, nw)
    yy, xx = np.mgrid[0:H, 0:W]
    # limpadores encostados no capô: o que é escuro/cinza entre a borda do capô e 22 linhas abaixo dela, nas
    # faixas dos limpadores, é refeito a partir do vermelho em volta (inpaint)
    a = nw.astype(int)
    red = (a[..., 0] > a[..., 1] + 60) & (a[..., 0] > 90)
    band = (yy >= top[xx] - 1) & (yy <= top[xx] + 16)
    inx = np.zeros(W, bool)
    for x0, x1 in WIPERS:
        inx[x0:x1] = True
    hole = band & inx[xx] & ~red
    # (o contorno preto de baixo do capô fica: só o que está acima do vermelho mais baixo da coluna)
    for x in np.nonzero(inx)[0]:
        r = np.nonzero(red[int(top[x]):int(top[x]) + 24, x])[0]
        lim = int(top[x]) + (r.max() if len(r) else 0)
        hole[lim + 1:, x] = False
    out = cv2.inpaint(out, hole.astype(np.uint8), 4, cv2.INPAINT_TELEA)
    # nas faixas dos limpadores, cada linha do capô (da borda até 20 linhas abaixo) vai da cor de fora da
    # esquerda para a de fora da direita: some o pivô e a palheta
    for x0, x1 in WIPERS:
        for y in range(int(min(top[x0:x1])) - 1, int(max(top[x0:x1])) + 20):
            cl = np.median(out[y, x0 - 4:x0].astype(float), axis=0)
            cr = np.median(out[y, x1:x1 + 4].astype(float), axis=0)
            t = ((np.arange(x1 - x0) + 0.5) / (x1 - x0))[:, None]
            out[y, x0:x1] = (cl * (1 - t) + cr * t).astype(np.uint8)
    # da borda lisa até o primeiro vermelho de cada coluna: o vermelho claro da borda (sem asfalto nos dentes)
    a2 = out.astype(int)
    red2 = (a2[..., 0] > a2[..., 1] + 60) & (a2[..., 0] > 150)   # vermelho claro da lataria (o escuro da quina é contorno)
    for x in range(446, W):
        y0 = int(top[x])
        r = np.nonzero(red2[y0:y0 + 12, x])[0]
        if len(r) and r[0] > 0:
            out[y0:y0 + r[0], x] = out[y0 + r[0], x]
        # pontos escuros soltos nas 3 primeiras linhas (contorno quebrado da arte): o vermelho de baixo
        for y in range(y0 + 8, y0 - 1, -1):   # (a palheta deitada sobre a borda do capô: até 8 linhas)
            if not red2[y, x] and red2[y + 1:y + 9, x].any():
                out[y, x] = out[y + 1 + int(np.argmax(red2[y + 1:y + 9, x])), x]
                red2[y, x] = True
    # forro desenhado no alto (a arte não tem): cinza-escuro com a borda clara de baixo e a moldura preta
    ln = liner_line(W)
    left = pillar_edge(nw)
    zone = (yy < ln[xx]) & (xx >= left[yy] - 6)
    sh = np.clip((ln[xx] - yy) / 30, 0, 1)
    col = np.stack([40 + 12 * sh, 38 + 12 * sh, 46 + 12 * sh], -1)
    out[zone] = col[zone].astype(np.uint8)
    edge = zone & (yy >= ln[xx] - 3)
    out[edge] = (14, 12, 16)
    out[zone & (yy >= ln[xx] - 5) & (yy < ln[xx] - 3)] = (78, 76, 86)
    # chapa do canto: preto da borracha da janela, com um filete claro na borda de cima; o vermelho da arte por cima
    cm = poly((H, W), CORNER)
    keep = (nw[..., 0].astype(int) > nw[..., 1].astype(int) + 50) & (nw[..., 0] > 80) & (nw[..., 1] < 110)
    out[cm & ~keep] = (24, 21, 27)
    edge = cm & ~(cv2.erode(cm.astype(np.uint8), np.ones((3, 3), np.uint8)) > 0) & ~keep
    out[edge] = (58, 54, 64)
    # miolo dos mostradores: fundo preto liso (o aro da arte fica)
    for cx, cy, r in DIALS:
        out[np.hypot(xx - cx, yy - cy) <= r + 0.5] = FACE
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
    nw = np.array(Image.open(os.path.join(d, 'cockdash.png')).convert('RGB'))
    ww = np.array(Image.open(os.path.join(d, 'cockwheel.png')).convert('RGB'))
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
        Image.fromarray(np.dstack([rgb, a_.astype(np.uint8) * 255]), 'RGBA').save(os.path.join(out, f'{ID}-{name}.png'), optimize=True)
        Image.fromarray((m * 255).astype(np.uint8), 'L').save(os.path.join(out, f'{ID}-{name}-mask.png'), optimize=True)
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
    pass  # (o volante da GTB não tem marca nos raios)
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
    Image.fromarray(wimg, 'RGBA').save(os.path.join(out, f'{ID}-wheel.png'), optimize=True)

    r1 = lambda p: tuple(round(float(v), 2) for v in p)
    print('topo começa na linha da arte', round(Y0D - EXT * PXH, 1))
    wr = (WHEEL_C[1] - Y0D) / PXH
    print('centro do aro na linha', round(wr, 2), 'do painel; wheelDy (painel esticado 128/124)', round(wr * 128 / 124 - PIV_N[1], 2))
    for cx, cy, r in DIALS:
        print('mostrador', r1(nat((cx, cy))), 'raio do miolo', round(r * S, 2))
    print('miolo do volante', r1(hub))
    gl = nat((195, 310))   # meio do vidro depois da emenda (150 a 242)
    print('vidro do retrovisor (empilhado, com PAD)', (round(PAD + gl[0]), round(EXT + (310 - Y0D) / PXH)))


if __name__ == '__main__':
    main()
