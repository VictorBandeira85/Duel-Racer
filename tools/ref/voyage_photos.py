"""Fotos da revista do Jornada LS (Voyage LS 1986, pixel art do Victor). Só marcas fictícias:
- anúncio: sai a moldura com os títulos, os três quadrinhos e os selos (fica só o quadro do carro, com o
  fundo preto continuado); emblema da grade vira o logo da Ipê e a placa vira "JORNADA / IPÊ LS";
- vermelho: o selo de miniatura de vídeo some (cerca copiada do lado esquerdo e cerca-viva continuada),
  emblema da grade vira Ipê e a placa de vídeo vira "JORNADA LS";
- pista (bege): o logotipo e os dois endereços do site viram asfalto (faixas copiadas ao lado), emblema Ipê;
- motor: a marca da bateria some (etiqueta verde lisa, os raios ficam) e o emblema da grade vira Ipê.
Reduz para 560 x 315.
Uso: python3 tools/ref/voyage_photos.py <pasta com capa-*.png> <src/assets/photos>
"""
import os
import sys

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont

sys.path.insert(0, os.path.dirname(__file__))
from brand_badges import logo_img  # noqa: E402

BOLD = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
# emblemas: (cx, cy, meia largura, meia altura, lado do logo)
EMB = {'anuncio': [(530, 307, 30, 32, 46)], 'vermelho': [(1398, 564, 23, 29, 36)], 'bege': [(185, 601, 17, 24, 22)],
       'motor': [(1510, 874, 50, 52, 66)]}
# placas: (4 cantos da área de texto: alto-esq, alto-dir, baixo-dir, baixo-esq), linhas, cor da tinta, 'dark'|'light' = cor do fundo
PLATE = {'anuncio': ([(420, 412), (588, 449), (577, 524), (408, 487)], ['JORNADA', 'IPÊ LS'], (24, 20, 30), 'light'),
         'vermelho': ([(1327, 684), (1490, 659), (1490, 702), (1327, 731)], ['JORNADA LS'], (232, 232, 236), 'dark')}
OUT = {'anuncio': 'vg-anuncio', 'vermelho': 'vg-vermelho', 'bege': 'vg-pista', 'motor': 'vg-motor'}


def emblem(a, cx, cy, hw, hh, sz):
    """Apaga o emblema (restaura a grade em volta) e põe o logo da Ipê."""
    H, W = a.shape[:2]
    yy, xx = np.mgrid[0:H, 0:W]
    m = ((((xx - cx) / (hw + 3)) ** 2 + ((yy - cy) / (hh + 3)) ** 2) <= 1).astype(np.uint8)
    a[:] = cv2.inpaint(a, m, 5, cv2.INPAINT_TELEA)
    # disco escuro com aro (base do emblema), na proporção do emblema original
    k = min(hw / (sz * 0.5), hh / (sz * 0.5), 1.0)
    lg = Image.fromarray(logo_img('ipe', 48)).resize((max(8, int(round(2 * hw * 0.92))), max(8, int(round(2 * hh * 0.92)))), Image.NEAREST)
    del k
    lg = np.array(lg)
    h, w = lg.shape[:2]
    y0, x0 = cy - h // 2, cx - w // 2
    sel = lg[..., 3] > 0
    a[y0:y0 + h, x0:x0 + w][sel] = lg[..., :3][sel]


def plate(a, quad, lines, ink, mode):
    """Apaga o texto da placa (fica a cor do fundo dela) e escreve o novo, na perspectiva da placa."""
    H, W = a.shape[:2]
    pm = np.zeros((H, W), np.uint8)
    cv2.fillPoly(pm, [np.array(quad, np.int32)], 1)
    lum = a.astype(int).mean(axis=2)
    sat = a.astype(int).max(axis=2) - a.astype(int).min(axis=2)
    inside = pm > 0
    if mode == 'light':
        bg = inside & (lum > np.percentile(lum[inside], 60))
    else:
        bg = inside & (lum < np.percentile(lum[inside], 55)) & (sat < 40)
    a[inside] = np.median(a[bg], axis=0).astype(np.uint8)
    tw, th = 420, int(420 * 0.5) if len(lines) > 1 else 110
    t = Image.new('L', (tw, th), 0)
    d = ImageDraw.Draw(t)

    def fit(txt, size, y):  # corpo reduzido até o texto caber na largura da placa
        f = ImageFont.truetype(BOLD, size)
        while d.textlength(txt, font=f) > tw * 0.9:
            size -= 2
            f = ImageFont.truetype(BOLD, size)
        d.text((tw / 2, y), txt, font=f, fill=255, anchor='mm')
    if len(lines) > 1:
        fit(lines[0], 92, th * 0.36)
        fit(lines[1], 46, th * 0.8)
    else:
        fit(lines[0], 70, th / 2)
    M = cv2.getPerspectiveTransform(np.float32([(0, 0), (tw, 0), (tw, th), (0, th)]), np.float32(quad))
    al = cv2.warpPerspective(np.array(t), M, (W, H), flags=cv2.INTER_AREA).astype(float) / 255
    al = (al > 0.45)[..., None]  # tinta chapada, sem meio-tom (pixel art)
    a[:] = np.where(al, np.array(ink, np.uint8), a)


def patch(a, x0, y0, x1, y1, parts, soft=5):
    """Cobre o retângulo com pedaços do próprio chão: parts = [(linhas de destino y0..y1, dx, dy)]."""
    src = a.copy()
    new = a.copy()
    for ya, yb, dx, dy in parts:
        new[ya:yb, x0:x1] = src[ya + dy:yb + dy, x0 + dx:x1 + dx]
    m = np.zeros(a.shape[:2], np.float32)
    m[y0:y1, x0:x1] = 1
    m = cv2.GaussianBlur(m, (0, 0), soft)[..., None]
    a[:] = (new * m + src * (1 - m)).astype(np.uint8)
    # emendas entre os pedaços: mistura curta, só na vertical
    for ya, yb, dx, dy in parts[1:]:
        band = a[ya - 4:ya + 4, x0:x1].astype(np.float32)
        a[ya - 4:ya + 4, x0:x1] = cv2.blur(band, (1, 5)).astype(np.uint8)


def anuncio(a):
    emblem(a, *EMB['anuncio'][0])
    plate(a, *PLATE['anuncio'])
    # só o quadro do carro; em cima e embaixo o preto do próprio quadro continua
    x0, x1, y0, y1 = 150, 1530, 119, 632
    w = x1 - x0
    h = int(round(w * 315 / 560))
    out = np.zeros((h, w, 3), np.uint8)
    out[:] = np.median(a[y0:y0 + 12, x0:x1].reshape(-1, 3), axis=0).astype(np.uint8)
    top = (h - (y1 - y0)) // 2 + 20
    out[top:top + y1 - y0] = a[y0:y1, x0:x1]
    # pneu cortado pela moldura: continua para baixo a última linha, escurecendo
    last = a[y1 - 1, x0:x1].astype(float)
    for j in range(40):
        out[top + y1 - y0 + j] = (last * max(0.0, 1 - j / 26.0) + out[top + y1 - y0 + j] * min(1.0, j / 26.0)).astype(np.uint8)
    return out


def vermelho(a):
    emblem(a, *EMB['vermelho'][0])
    plate(a, *PLATE['vermelho'])
    H, W = a.shape[:2]
    src = a.copy()
    # o selo de vídeo ficava em x 1150..1640, y 25..335, sobre a cerca e a cerca-viva
    X0, PS, YF, YH = 1125, 887, 150, 266  # meio do poste ao lado do selo, meio de outro poste, fim da cerca copiada, topo da cerca-viva
    n = W - X0
    # cerca de cima: trecho limpo acima do teto do carro, espelhado a partir de um poste (emenda no poste)
    band = src[0:YF, PS - n + 1:PS + 1][:, ::-1]
    a[0:YF, X0:W] = band
    # cerca de baixo: a tela que sobrou ao lado do selo, repetida (ida e volta)
    mesh = src[YF:YH + 6, 1072:1116]
    mesh = np.concatenate([mesh[:, ::-1], mesh], axis=1)
    for x in range(X0, W):
        a[YF:YH + 6, x] = mesh[:, (x - X0) % mesh.shape[1]]
    # emenda entre as duas cercas: passagem gradual em 14 linhas
    for j in range(14):
        k = (j + 1) / 15.0
        a[YF - 14 + j, X0:W] = (band[YF - 14 + j] * (1 - k) + mesh[0][(np.arange(X0, W) - X0) % mesh.shape[1]] * k).astype(np.uint8)
    # postes e tronco descem retos até a cerca-viva
    low = band[100:YF].astype(int)
    post = (low.min(axis=2) > 150).mean(axis=0) > 0.6
    trunk = ((low[..., 0] > low[..., 2] + 35) & (low[..., 0] > low[..., 1] + 10)).mean(axis=0) > 0.6
    cont = cv2.dilate((post | trunk).astype(np.uint8)[None], np.ones((1, 5), np.uint8))[0] > 0
    for x in np.where(cont)[0]:
        for y in range(YF, YH + 6):
            a[y, X0 + x] = band[100 + (y - YF) % (YF - 100), x]
    # cerca-viva: blocos sorteados da cerca-viva que sobrou à direita e à esquerda do selo; na ponta
    # direita ela sobe (como na arte, que tem folhagem alta na borda)
    rng = np.random.default_rng(11)
    hs = [src[160:352, 1632:1672]]
    wall = np.full(W, 340)
    for x in range(X0, W):  # topo do muro azul em cada coluna
        col = src[336:400, x].astype(int)
        blue = (col[:, 2] > 140) & (col[:, 2] > col[:, 0] + 60) & (col[:, 2] > col[:, 1] + 30)
        wall[x] = 336 + (int(np.argmax(blue)) if blue.any() else 0)
    B = 16
    for bx in range(X0 + 8, W, B):
        t = np.clip((bx - 1560) / 70.0, 0, 1)
        top = int(YH - t * (YH - 120)) + int(rng.integers(-5, 4))
        for by in range(top, 384, B):
            s = hs[0]
            sy, sx = rng.integers(0, s.shape[0] - B + 1), rng.integers(0, s.shape[1] - B + 1)
            blk = s[sy:sy + B, sx:sx + B]
            if rng.random() < 0.5:
                blk = blk[:, ::-1]
            for i in range(B):
                x = bx + i
                if x >= W:
                    break
                yb = min(by + B, wall[x])
                if yb > by:
                    a[by:yb, x] = blk[:yb - by, i]
    return a


def bege(a):
    emblem(a, *EMB['bege'][0])
    # logotipo e endereço (alto, à esquerda): metade de cima vem do asfalto de cima, a de baixo do de baixo
    patch(a, 84, 88, 510, 218, [(88, 153, 0, -66), (153, 218, -24, 62)])
    # endereço (embaixo, à direita): asfalto de baixo
    patch(a, 1103, 888, 1536, 930, [(888, 930, -40, 46)], soft=3)
    patch(a, 1170, 874, 1536, 892, [(874, 892, 30, 70)], soft=3)  # pingos que passavam da linha de cima
    W = a.shape[1]
    h = int(round(W * 315 / 560))
    return a[52:52 + h]


def motor(a):
    emblem(a, *EMB['motor'][0])
    # bateria: dentro das etiquetas verdes tudo o que não é verde vira verde (os raios ficam)
    x0, y0, x1, y1 = 395, 250, 705, 495
    reg = a[y0:y1, x0:x1]
    r = reg.astype(int)
    green = ((r[..., 1] > r[..., 0] + 30) & (r[..., 1] > r[..., 2] + 15)).astype(np.uint8)
    lab = cv2.morphologyEx(green, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (41, 41)))
    yy, xx = np.mgrid[y0:y1, x0:x1]
    bolt = (r[..., 0] > 170) & (r[..., 2] < 130) & (r[..., 0] > r[..., 1] + 10)
    bolt = cv2.dilate(bolt.astype(np.uint8), np.ones((5, 5), np.uint8)) > 0
    keep = bolt & (((yy < 372) & (xx < 464)) | ((yy >= 372) & (xx > 634)))
    # verde "limpo" (longe das letras) de cada linha: a etiqueta fica lisa, com o leve degradê dela
    pure = cv2.erode(green, np.ones((5, 5), np.uint8)) > 0
    sel = (lab > 0) & ~keep
    for j in range(reg.shape[0]):
        if sel[j].any() and pure[j].sum() > 6:
            reg[j][sel[j]] = np.median(reg[j][pure[j]], axis=0).astype(np.uint8)
    # pés das letras que ficaram fora da etiqueta, rente ao filtro de ar
    low = a[432:458, 480:540]
    w = low.astype(int).min(axis=2) > 140
    low[cv2.dilate(w.astype(np.uint8), np.ones((3, 3), np.uint8)) > 0] = np.median(reg[440 - y0][pure[440 - y0]], axis=0).astype(np.uint8)
    return a


def main():
    src, out = sys.argv[1], sys.argv[2]
    for k, name in OUT.items():
        p = os.path.join(src, f'capa-{k}.png')
        if not os.path.exists(p):
            continue
        a = np.ascontiguousarray(np.array(Image.open(p).convert('RGB')))
        a = {'anuncio': anuncio, 'vermelho': vermelho, 'bege': bege, 'motor': motor}[k](a)
        im = Image.fromarray(a)
        if os.environ.get('DBG'):
            im.save(os.path.join(os.environ['DBG'], f'full-{k}.png'))
        im = im.resize((560, 315), Image.LANCZOS)
        # paleta curta como as outras fotos, com as cores do emblema garantidas (são poucos pixels e sumiriam)
        q = im.quantize(154, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
        lg = logo_img('ipe', 48)
        cols = sorted({tuple(int(v) for v in c[:3]) for c in lg.reshape(-1, 4) if c[3] > 0})
        pal = Image.new('P', (1, 1))
        pal.putpalette((q.getpalette()[:154 * 3] + [v for c in cols for v in c] + [0] * 768)[:768])
        im = im.quantize(palette=pal, dither=Image.Dither.NONE)
        im.save(os.path.join(out, f'{name}.png'), optimize=True)
        print(name, os.path.getsize(os.path.join(out, f'{name}.png')))


if __name__ == '__main__':
    main()
