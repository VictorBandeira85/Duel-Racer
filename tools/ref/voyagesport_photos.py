"""Fotos da revista do Jornada Sport (Voyage Sport 1992) e três capas de preparação (pixel art do Victor).
Só marcas fictícias; tudo o que é apagado é coberto com a cor/textura do entorno (nunca tarja):
- bancos: sem marcas, só reduz;
- folheto: ficam só os quatro QUADROS ilustrados, remontados num papel creme (painel em cima, cortado
  até as saídas de ar centrais; traseira, bancos e console embaixo). Saem as legendas e os parágrafos;
  o emblema do volante e o da tampa viram o logo da Ipê, o letreiro da tampa vira "JORNADA SPORT" e o
  rabisco do para-brisa some;
- turbo-motor: o intercooler fica só com "TURBO" (sai a marca e as linhas miúdas), a etiqueta da bateria
  fica lisa (cinza em cima, amarela embaixo) e somem os letreiros da tampa de válvulas, da turbina e da
  mangueira azul;
- kit-turbo: saem o título e os dois subtítulos (o jogo escreve o dele), a marca do manômetro some, as
  etiquetas vermelhas ficam lisas e o manômetro cresce e desce para o meio, no lugar do título;
- coletor: o adesivo do coletor fica liso e as duas etiquetas da frente ficam brancas, sem texto.
Reduz para 560 x 315.
Uso: python3 tools/ref/voyagesport_photos.py <pasta com capa-*.png> <src/assets/photos>
"""
import os
import sys

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont

sys.path.insert(0, os.path.dirname(__file__))
from brand_badges import logo_img  # noqa: E402

BOLD = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
OBLI = '/usr/share/fonts/truetype/freefont/FreeSansBoldOblique.ttf'
OUT = {'bancos': 'vs-bancos', 'folheto': 'vs-folheto', 'turbo-motor': 'pc-turbomotor', 'kit-turbo': 'pc-kitturbo',
       'coletor': 'pc-coletor'}
RNG = np.random.default_rng(7)


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


def ipe(a, cx, cy, d, erase=0):
    """Logo da Ipê (src/assets/brands.json) com diâmetro d; erase > 0 apaga antes o emblema antigo."""
    if erase:
        yy, xx = np.mgrid[0:a.shape[0], 0:a.shape[1]]
        heal(a, (xx - cx) ** 2 + (yy - cy) ** 2 <= erase ** 2, 5)
    lg = np.array(Image.fromarray(logo_img('ipe', 48)).resize((d, d), Image.NEAREST))
    y0, x0 = cy - d // 2, cx - d // 2
    sel = lg[..., 3] > 0
    a[y0:y0 + d, x0:x0 + d][sel] = lg[..., :3][sel]


# ---------------------------------------------------------------- Jornada Sport
def bancos(a):
    return a


def folheto(a):
    # volante: o emblema redondo fica com o aro preto da arte e ganha o logo da Ipê por dentro
    ipe(a, 536, 286, 34)
    # rabisco no canto do para-brisa
    r = rect_mask(a, 86, 46, 152, 68)
    heal(a, grow(r & (lum(a) < 150), 1), 3)
    # tampa traseira: emblema e letreiro
    ipe(a, 145, 562, 26, erase=17)
    r = rect_mask(a, 402, 549, 534, 581)
    sow(a, r, rect_mask(a, 352, 549, 398, 581))
    lay = Image.new('RGBA', (140, 34), (0, 0, 0, 0))
    d = ImageDraw.Draw(lay)
    f1, f2 = ImageFont.truetype(BOLD, 15), ImageFont.truetype(OBLI, 15)
    w1 = d.textlength('JORNADA', font=f1)
    d.text((2, 17), 'JORNADA', font=f1, fill=(236, 236, 240, 255), anchor='lm', stroke_width=2, stroke_fill=(20, 18, 26, 255))
    d.text((6 + w1, 17), 'SPORT', font=f2, fill=(226, 30, 26, 255), anchor='lm', stroke_width=2, stroke_fill=(20, 18, 26, 255))
    lay = np.array(lay)
    bb = Image.fromarray(lay[..., 3]).getbbox()
    lay = lay[bb[1]:bb[3], bb[0]:bb[2]]
    k = min(1.0, 128 / lay.shape[1])
    lay = np.array(Image.fromarray(lay).resize((int(lay.shape[1] * k), int(lay.shape[0] * k)), Image.LANCZOS))
    h, w = lay.shape[:2]
    x0, y0 = 532 - w, 565 - h // 2
    al = (lay[..., 3:] > 110)
    a[y0:y0 + h, x0:x0 + w] = np.where(al, lay[..., :3], a[y0:y0 + h, x0:x0 + w])

    # montagem: papel creme, painel em cima e os três quadros embaixo (sem legendas nem texto)
    S = 3  # monta em 3x e reduz junto com as outras
    Wd, Hd, M, G = 560 * S, 315 * S, 8 * S, 6 * S
    paper = np.median(a[400:420, 100:1500].reshape(-1, 3), axis=0)
    out = np.empty((Hd, Wd, 3), np.uint8)
    out[:] = paper.astype(np.uint8)
    edge = (22, 18, 28)
    quads = [(45, 427, 590, 731), (614, 427, 1148, 731), (1173, 427, 1630, 731)]
    hb = int(round((Wd - 2 * M - 2 * G) / sum((x1 - x0) / (y1 - y0) for x0, y0, x1, y1 in quads)))
    ht = Hd - 2 * M - G - hb
    wt = int(round((Wd - 2 * M) * (396 - 18) / ht))  # largura do recorte do painel (px da arte)

    def put(box, x, y, w, h):
        im = Image.fromarray(a[box[1]:box[3], box[0]:box[2]]).resize((w, h), Image.LANCZOS)
        out[y:y + h, x:x + w] = np.array(im)
        cv2.rectangle(out, (x, y), (x + w - 1, y + h - 1), edge, S + 1)
    put((45, 18, 45 + wt, 396), M, M, Wd - 2 * M, ht)
    x = M
    for i, q in enumerate(quads):
        w = int(round(hb * (q[2] - q[0]) / (q[3] - q[1]))) if i < 2 else Wd - M - x
        put(q, x, M + ht + G, w, hb)
        x += w + G
    return out


# ---------------------------------------------------------------- preparação
def turbo_motor(a):
    L, S_ = lum(a), sat(a)
    # intercooler: sai a marca (linha de cima) e as linhas miúdas à direita; fica "///// TURBO"
    plate = rect_mask(a, 1196, 676, 1492, 752)
    ink = (rect_mask(a, 1206, 684, 1376, 723) & ((L > 160) | (L < 82))) | (rect_mask(a, 1374, 700, 1480, 744) & (L > 150))
    heal(a, grow(ink, 2) & plate & ~rect_mask(a, 1196, 724, 1374, 752), 5)
    # bateria: etiqueta lisa (faixa cinza em cima, amarela embaixo)
    lab = rect_mask(a, 440, 292, 668, 344) & (L > 70)
    lab = cv2.morphologyEx(lab.astype(np.uint8), cv2.MORPH_OPEN, np.ones((5, 5), np.uint8))
    lab = cv2.morphologyEx(lab, cv2.MORPH_CLOSE, np.ones((15, 15), np.uint8)) > 0
    lab &= rect_mask(a, 444, 296, 664, 341)
    r = a.astype(int)
    yel = lab & (r[..., 0] > 200) & (r[..., 1] > 170) & (r[..., 2] < 90)
    gry = lab & (S_ < 40) & (L > 120) & (L < 215)
    top = lab & rect_mask(a, 440, 292, 668, 315)
    a[top] = np.median(a[gry], axis=0).astype(np.uint8) if gry.sum() > 20 else (170, 168, 176)
    a[lab & ~top] = np.median(a[yel], axis=0).astype(np.uint8)
    # letreiro da tampa de válvulas (claro sobre a chapa escura)
    r = rect_mask(a, 712, 560, 744, 620)
    ink = r & (L > 120) & (S_ < 70)
    sow(a, grow(ink, 1) & r & (S_ < 110), r & (L < 60))
    # letreiro da carcaça da turbina
    r = poly_mask(a, [(298, 726), (326, 722), (356, 778), (340, 800), (312, 790)])
    heal(a, grow(r & ((L > 200) | (L < 95)), 1) & r, 4)
    # etiqueta branca da mangueira azul
    r = rect_mask(a, 980, 652, 1038, 684)
    ink = r & (L > 150) & (S_ < 120)
    heal(a, grow(ink, 3) & r, 5)
    return a


def kit_turbo(a):
    H, W = a.shape[:2]
    white = np.array([254, 254, 254], np.uint8)
    solid = (a.min(axis=2) < 236).astype(np.uint8)
    n, lab, st, _ = cv2.connectedComponentsWithStats(solid, connectivity=8)
    # título e subtítulos: tudo o que está inteiro dentro da área de texto do meio vira papel
    X0, Y0, X1, Y1 = 470, 312, 1200, 646
    gone = np.zeros((H, W), bool)
    for i in range(1, n):
        x, y, w, h = st[i][:4]
        if x >= X0 and y >= Y0 and x + w <= X1 and y + h <= Y1:
            gone |= lab == i
    # (o serrilhado claro em volta das letras também: tudo o que não é de uma peça que sai da área)
    keep = np.zeros((H, W), bool)
    for i in range(1, n):
        x, y, w, h = st[i][:4]
        if not (x >= X0 and y >= Y0 and x + w <= X1 and y + h <= Y1) and x < X1 and x + w > X0 and y < Y1 and y + h > Y0:
            keep |= lab == i
    a[(grow(gone, 3) | rect_mask(a, X0, Y0, X1, Y1)) & ~grow(keep, 4)] = white
    # marca do manômetro: letras claras sobre o fundo preto
    r = rect_mask(a, 786, 198, 884, 221)
    L, S_ = lum(a), sat(a)
    ink = r & (L > 70) & (S_ < 50)
    a[grow(ink, 1) & r & (S_ < 90)] = np.median(a[r & (L < 45)], axis=0).astype(np.uint8)
    # adesivos azuis das abraçadeiras: o desenho branco de dentro vira azul liso
    for x0, y0, x1, y1 in ((462, 16, 512, 58), (558, 64, 606, 108)):
        rm = rect_mask(a, x0, y0, x1, y1)
        q = a.astype(int)
        navy = rm & (q[..., 2] > q[..., 0] + 35) & (L < 120)
        box = cv2.morphologyEx(navy.astype(np.uint8), cv2.MORPH_CLOSE, np.ones((13, 13), np.uint8)) > 0
        a[box & ~navy] = np.median(a[navy], axis=0).astype(np.uint8)
    # etiquetas vermelhas: o logo de dentro vira vermelho liso
    r_ = a.astype(int)
    red = ((r_[..., 0] > 170) & (r_[..., 1] < 70) & (r_[..., 2] < 70)).astype(np.uint8)
    red = cv2.morphologyEx(red, cv2.MORPH_CLOSE, np.ones((3, 3), np.uint8))
    n2, lab2, st2, _ = cv2.connectedComponentsWithStats(red)
    tags = [(1195, 90), (950, 182), (537, 184), (1533, 191), (332, 225), (257, 556), (1414, 566), (1357, 592), (1300, 622),
            (1541, 627), (1234, 657), (188, 691), (1393, 834)]
    for i in range(1, n2):
        x, y, w, h, ar = st2[i]
        if not any(abs(x - tx) < 6 and abs(y - ty) < 6 for tx, ty in tags):
            continue
        pts = cv2.findNonZero((lab2 == i).astype(np.uint8))
        hull = np.zeros((H, W), np.uint8)
        cv2.fillConvexPoly(hull, cv2.convexHull(pts), 1)
        hull = cv2.erode(hull, np.ones((5, 5), np.uint8)) > 0
        a[hull & (lab2 != i)] = np.median(a[lab2 == i], axis=0).astype(np.uint8)
    # manômetro: maior e no meio, onde ficava o título
    solid = (a.min(axis=2) < 236).astype(np.uint8)
    n, lab, st, _ = cv2.connectedComponentsWithStats(solid, connectivity=8)
    g = lab == lab[173, 760]
    x, y, w, h = cv2.boundingRect(g.astype(np.uint8))
    cnt, _ = cv2.findContours(g.astype(np.uint8), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    full = np.zeros((H, W), np.uint8)
    cv2.drawContours(full, cnt, -1, 255, -1)
    piece = np.dstack([a, full])[y:y + h, x:x + w].copy()
    a[grow(full > 0, 3)] = white
    K = 1.15
    piece = Image.fromarray(piece, 'RGBA').resize((int(w * K), int(h * K)), Image.LANCZOS)
    base = Image.fromarray(a).convert('RGBA')
    base.alpha_composite(piece, (838 - int(147 * K) - int((833 - 147 - x) * K), 290 - int(h * K / 2)))
    return np.array(base.convert('RGB'))


def coletor(a):
    L = lum(a)
    r = a.astype(int)
    # adesivo do coletor: letras azul-marinho, o "V" verde e a linha miúda
    p = poly_mask(a, [(548, 284), (662, 216), (684, 246), (584, 316), (560, 302)])
    ink = p & ((L < 150) | (r[..., 1] > r[..., 0] + 30))
    heal(a, grow(ink, 2) & grow(p, 2), 6)
    # etiquetas da frente: ficam brancas, sem texto (a borda preta continua)
    for x0, y0, x1, y1 in ((1455, 130, 1568, 224), (1385, 260, 1512, 372)):
        rm = rect_mask(a, x0, y0, x1, y1)
        wh = (rm & (L > 185) & (sat(a) < 45)).astype(np.uint8)
        wh = cv2.morphologyEx(wh, cv2.MORPH_CLOSE, np.ones((13, 13), np.uint8))
        n, lab, st, _ = cv2.connectedComponentsWithStats(wh)
        if n < 2:
            continue
        m = lab == 1 + int(np.argmax(st[1:, 4]))
        cnt, _ = cv2.findContours(m.astype(np.uint8), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        hull = np.zeros(a.shape[:2], np.uint8)
        cv2.fillConvexPoly(hull, cv2.convexHull(np.concatenate(cnt)), 1)
        hull = cv2.erode(hull, np.ones((5, 5), np.uint8)) > 0
        sow(a, hull, m & (L > 215) & ~grow(m & (L < 200), 1))
    return a


def main():
    src, out = sys.argv[1], sys.argv[2]
    fn = {'bancos': bancos, 'folheto': folheto, 'turbo-motor': turbo_motor, 'kit-turbo': kit_turbo, 'coletor': coletor}
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
        # paleta curta como as outras fotos; no folheto as cores do emblema da Ipê ficam garantidas
        # (são poucos pixels e sumiriam)
        if k == 'folheto':
            q = im.quantize(154, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
            lg = logo_img('ipe', 48)
            cols = sorted({tuple(int(v) for v in c[:3]) for c in lg.reshape(-1, 4) if c[3] > 0})
            pal = Image.new('P', (1, 1))
            pal.putpalette((q.getpalette()[:154 * 3] + [v for c in cols for v in c] + [0] * 768)[:768])
            im = im.quantize(palette=pal, dither=Image.Dither.NONE)
        elif k in ('bancos', 'coletor'):
            # muito pontilhado: 92 cores para ficar no peso das outras fotos, mais 4 reservadas para os
            # poucos pixels de cor viva (fivelas laranja dos cintos, friso vermelho), que sumiriam
            q = im.quantize(92, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
            px = np.array(im).reshape(-1, 3)
            viv = px[(px.max(axis=1).astype(int) - px.min(axis=1)) > 110]
            cols = []
            if len(viv) > 8:
                vq = Image.fromarray(viv[None]).quantize(4, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
                cols = vq.getpalette()[:12]
            pal = Image.new('P', (1, 1))
            pal.putpalette((q.getpalette()[:92 * 3] + cols + [0] * 768)[:768])
            im = im.quantize(palette=pal, dither=Image.Dither.NONE)
        else:
            im = im.quantize(160, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
        im.save(os.path.join(out, f'{name}.png'), optimize=True)
        print(name, os.path.getsize(os.path.join(out, f'{name}.png')))


if __name__ == '__main__':
    main()
