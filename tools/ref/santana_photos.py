"""Fotos da revista do Savana GLS (Santana GLS 2.0 1990, pixel art do Victor). Só marcas fictícias;
tudo o que é apagado é coberto com a cor/textura do entorno (nunca tarja):
- garagem: sai a faixa "CLÁSSICOS | <título>" da parede (o jogo escreve o título dele) e o logo grande da
  parede (parede continuada), o emblema da grade vira o logo da Ipê (grade refeita com as lâminas do
  lado), a placa amarela da parede fica lisa, a etiqueta da placa amarela de baixo fica preta e lisa e
  somem os letreiros da moto;
- catálogo: sai o endereço do site (chão copiado da mesma linha), o logo da chave vira o da Ipê, o
  emblema da tampa vira Ipê, os letreiros da tampa e do para-choque somem e a placa fica com "Savana"
  no lugar do nome, mantendo o "2000";
- laranja: emblema da grade vira Ipê, a placa fica lisa, o emblema da lateral some (lataria
  continuada), o miolo das duas rodas fica liso e sai o endereço do site.
Reduz para 560 x 315 com paleta curta, reservando as cores do logo da Ipê (são poucos pixels).
Uso: python3 tools/ref/santana_photos.py <pasta com capa-*.png> <src/assets/photos>
"""
import os
import sys

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont

sys.path.insert(0, os.path.dirname(__file__))
from brand_badges import logo_img  # noqa: E402

OBLI = '/usr/share/fonts/truetype/freefont/FreeSansBoldOblique.ttf'
OUT = {'garagem': 'sn-garagem', 'catalogo': 'sn-catalogo', 'laranja': 'sn-laranja'}
RNG = np.random.default_rng(11)


def lum(a):
    return a.astype(int).sum(axis=2) // 3


def sat(a):
    return a.astype(int).max(axis=2) - a.astype(int).min(axis=2)


def rect_mask(a, x0, y0, x1, y1):
    m = np.zeros(a.shape[:2], bool)
    m[y0:y1, x0:x1] = True
    return m


def poly_mask(a, pts):
    m = np.zeros(a.shape[:2], np.uint8)
    cv2.fillPoly(m, [np.array(pts, np.int32)], 1)
    return m > 0


def ell_mask(a, cx, cy, rx, ry):
    yy, xx = np.mgrid[0:a.shape[0], 0:a.shape[1]]
    return ((xx - cx) / rx) ** 2 + ((yy - cy) / ry) ** 2 <= 1


def grow(m, n):
    return cv2.dilate(m.astype(np.uint8), np.ones((2 * n + 1, 2 * n + 1), np.uint8)) > 0


def sow(a, mask, src):
    """Cobre `mask` com pixels sorteados de `src` da mesma linha (mantém o pontilhado da arte); nas
    linhas sem fonte, usa a fonte inteira."""
    allp = a[src]
    for y in np.where(mask.any(axis=1))[0]:
        xs = np.where(mask[y])[0]
        pool = a[y][src[y]]
        if len(pool) < 4:
            pool = allp
        a[y, xs] = pool[RNG.integers(0, len(pool), len(xs))]


def heal(a, mask, r=4):
    """Cobre `mask` continuando o entorno (superfícies lisas com degradê)."""
    a[:] = cv2.inpaint(a, mask.astype(np.uint8), r, cv2.INPAINT_TELEA)


def ipe(a, cx, cy, d):
    """Logo da Ipê (src/assets/brands.json) com diâmetro d, centrado em (cx, cy)."""
    lg = np.array(Image.fromarray(logo_img('ipe', 48)).resize((d, d), Image.NEAREST))
    y0, x0 = cy - d // 2, cx - d // 2
    sel = lg[..., 3] > 0
    a[y0:y0 + d, x0:x0 + d][sel] = lg[..., :3][sel]


def grille(a, x0, y0, x1, y1, dx):
    """Refaz a grade no retângulo copiando as lâminas horizontais deslocadas dx na mesma linha."""
    a[y0:y1, x0:x1] = a[y0:y1, x0 + dx:x1 + dx]


def ground(a, y0, y1, parts, soft=4):
    """Endereço do site sobre o chão: blocos do próprio chão da mesma altura, copiados de onde não há
    nada (parts = [(x0, x1 de destino, deslocamento dx)]), com a borda misturada de leve."""
    src = a.copy()
    new = a.copy()
    m = np.zeros(a.shape[:2], np.float32)
    for x0, x1, dx in parts:
        new[y0:y1, x0:x1] = src[y0:y1, x0 + dx:x1 + dx]
        m[y0:y1, x0:x1] = 1
    m = cv2.GaussianBlur(m, (0, 0), soft)
    m = np.maximum(m, cv2.erode(m, np.ones((2 * soft + 1, 2 * soft + 1), np.float32)) > 0.99)[..., None]
    a[:] = (new * m + src * (1 - m)).astype(np.uint8)


# ---------------------------------------------------------------- garagem (sedã preto)
def garagem(a):
    L, S_ = lum(a), sat(a)
    # faixa de título (quadrado vermelho, "CLÁSSICOS", traço, placa branca com o título e a sombra):
    # parede continuada (degradê lavanda com as manchas claras da esquerda)
    band = rect_mask(a, 36, 58, 992, 138)
    heal(a, band, 9)
    # suaviza o miolo do remendo (o inpaint deixa estrias) e devolve um pontilhado leve da parede
    sm = cv2.GaussianBlur(a, (0, 0), 6)
    core = rect_mask(a, 40, 62, 988, 134)
    a[core] = sm[core]
    # logo grande da parede (disco com aro e sombra)
    # (o aro do logo encosta na faixa escura do teto: o teto ali é copiado do trecho ao lado)
    a[24:54, 1020:1184] = a[24:54, 850:1014]
    # (parede lisa ali: cada linha é a interpolação entre a parede à esquerda e à direita do disco)
    disc = ell_mask(a, 1101, 110, 77, 77) & ~rect_mask(a, 0, 0, 1672, 54)
    f = a.astype(np.float32)
    for y in np.where(disc.any(axis=1))[0]:
        xs = np.where(disc[y])[0]
        l, r = f[y, 1014:1022].mean(axis=0), f[y, 1182:1190].mean(axis=0)
        t = ((xs - 1018) / (1186 - 1018))[:, None]
        a[y, xs] = (l * (1 - t) + r * t).astype(np.uint8)
    sm = cv2.GaussianBlur(a, (0, 0), 3)
    a[disc] = sm[disc]
    # placa amarela "DG-...": fica lisa (letras escuras viram o amarelo da própria placa)
    r = rect_mask(a, 314, 193, 446, 238)
    q = a.astype(int)
    yel = rect_mask(a, 306, 188, 452, 244) & (q[..., 0] > 200) & (q[..., 1] > 150) & (q[..., 2] < 110)
    # (cor de cada linha = mediana do amarelo da linha: a placa tem só um degradê vertical)
    for y in range(193, 238):
        a[y, 314:446] = np.median(a[y][yel[y]], axis=0).astype(np.uint8)
    # etiqueta escura da placa amarela de baixo: borrões coloridos viram preto liso
    dk = np.median(a[rect_mask(a, 1036, 274, 1134, 285) & (L < 50)], axis=0).astype(np.uint8)
    a[273:286, 1035:1134] = dk
    a[286:291, 1061:1096] = dk
    # emblema da grade: grade refeita com as lâminas da esquerda e logo da Ipê
    grille(a, 1278, 568, 1330, 620, -60)
    ipe(a, 1303, 594, 34)
    # moto: letreiro do tanque e da carenagem lateral (brancos sobre o vermelho)
    L, S_ = lum(a), sat(a)
    q = a.astype(int)
    red = (q[..., 0] > 150) & (q[..., 1] < 80) & (q[..., 2] < 80)
    # (letras brancas com contorno escuro: tudo o que não é vermelho no retângulo vira vermelho)
    for x0, y0, x1, y1 in ((1458, 402, 1499, 430), (1630, 421, 1672, 438)):
        r = rect_mask(a, x0, y0, x1, y1)
        heal(a, grow(r & ~red, 1) & r, 4)
    return a


# ---------------------------------------------------------------- catálogo (colagem + traseira azul)
def catalogo(a):
    L = lum(a)
    # endereço do site sobre o chão de terra
    ground(a, 872, 926, [(1346, 1500, -190), (1500, 1656, -330)])
    # chave: miolo do logo vira o plástico da chave, com o logo da Ipê; o aro preto da arte fica
    inner = ell_mask(a, 697, 112, 19, 18)
    plast = rect_mask(a, 640, 70, 760, 150) & ~ell_mask(a, 697, 112, 25, 24) & (L > 60) & (L < 120) & (sat(a) < 60)
    sow(a, inner, plast)
    ipe(a, 697, 112, 24)
    # tampa traseira: emblema vira Ipê (azul da lataria continuado)
    heal(a, ell_mask(a, 1098, 547, 17, 19), 5)
    ipe(a, 1098, 549, 24)
    # letreiros da lataria (letras claras com contorno preto): azul da lataria continuado
    for pts in ([(898, 596), (1006, 610), (1004, 636), (896, 622)], [(1176, 650), (1308, 670), (1306, 700), (1174, 682)]):
        heal(a, poly_mask(a, pts), 5)
    # placa: o nome em letra cursiva vira "Savana" (o "2000" fica)
    plate = poly_mask(a, [(1040, 563), (1160, 581), (1157, 630), (1035, 619)])
    word = poly_mask(a, [(1058, 566), (1158, 581), (1156, 600), (1056, 586)])
    L = lum(a)
    paper = plate & (L > 185)
    a[word] = np.median(a[paper], axis=0).astype(np.uint8)
    lay = Image.new('L', (300, 90), 0)
    d = ImageDraw.Draw(lay)
    d.text((150, 45), 'Savana', font=ImageFont.truetype(OBLI, 62), fill=255, anchor='mm')
    lay = np.array(lay.rotate(-7.5, resample=Image.BICUBIC, expand=False))
    bb = Image.fromarray(lay).getbbox()
    lay = lay[bb[1]:bb[3], bb[0]:bb[2]]
    k = 76 / lay.shape[1]
    lay = np.array(Image.fromarray(lay).resize((76, max(1, int(lay.shape[0] * k))), Image.LANCZOS))
    h, w = lay.shape
    x0, y0 = 1066, 584 - h // 2
    ink = np.median(a[plate & (L < 50)], axis=0).astype(np.uint8)
    sel = (lay > 120) & word[y0:y0 + h, x0:x0 + w]
    a[y0:y0 + h, x0:x0 + w][sel] = ink
    return a


# ---------------------------------------------------------------- laranja (cupê)
def laranja(a):
    # endereço do site sobre o piso roxo
    ground(a, 864, 914, [(1350, 1500, -400), (1500, 1660, -470)])
    # emblema da grade: lâminas da esquerda e logo da Ipê
    grille(a, 222, 530, 260, 580, -40)
    ipe(a, 240, 555, 28)
    # placa lisa (fica a borda e os parafusos; o miolo vira o fundo claro dela)
    inner = poly_mask(a, [(166, 645), (272, 651), (274, 691), (166, 686)])
    L = lum(a)
    paper = poly_mask(a, [(158, 638), (280, 645), (282, 698), (158, 692)]) & (L > 170) & (sat(a) < 50)
    for y in np.where(inner.any(axis=1))[0]:
        a[y, inner[y]] = np.median(a[y][paper[y]], axis=0).astype(np.uint8) if paper[y].sum() > 4 else np.median(a[paper], axis=0)
    # emblema da lateral: lataria laranja continuada
    heal(a, rect_mask(a, 819, 580, 854, 604), 5)
    # miolo das rodas: o logo some, fica um disco liso dentro do aro preto
    for cx, cy, rx, ry in ((715, 722, 10, 12), (1411, 677, 9, 11)):
        m = ell_mask(a, cx, cy, rx, ry)
        a[m] = (170, 168, 186)
        a[m & ell_mask(a, cx - 2, cy - 3, rx - 3, ry - 4)] = (204, 202, 216)
    return a


def main():
    src, out = sys.argv[1], sys.argv[2]
    fn = {'garagem': garagem, 'catalogo': catalogo, 'laranja': laranja}
    lg = logo_img('ipe', 48)
    cols = sorted({tuple(int(v) for v in c[:3]) for c in lg.reshape(-1, 4) if c[3] > 0})
    for k, name in OUT.items():
        p = os.path.join(src, f'capa-{k}.png')
        if not os.path.exists(p):
            continue
        a = np.ascontiguousarray(np.array(Image.open(p).convert('RGB')))
        a = fn[k](a)
        im = Image.fromarray(a)
        if os.environ.get('DBG'):
            im.save(os.path.join(os.environ['DBG'], f'full-{k}.png'))
        im = im.resize((560, 315), Image.LANCZOS)
        # paleta curta como as outras fotos; as cores do emblema da Ipê ficam garantidas
        n = 156
        q = im.quantize(n, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
        pal = Image.new('P', (1, 1))
        pal.putpalette((q.getpalette()[:n * 3] + [v for c in cols for v in c] + [0] * 768)[:768])
        im = im.quantize(palette=pal, dither=Image.Dither.NONE)
        im.save(os.path.join(out, f'{name}.png'), optimize=True)
        print(name, os.path.getsize(os.path.join(out, f'{name}.png')))


if __name__ == '__main__':
    main()
