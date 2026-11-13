"""Fotos da revista da Onça GTE (Puma GTE, pixel art do Victor). Só marcas fictícias; tudo o que é
apagado é coberto com a cor/textura do entorno (nunca tarja):
- rio (capa-amarelo): o letreiro do canto some (céu continuado linha a linha e a copa da árvore
  continuada com a folhagem da árvore da direita), a placa vermelha fica lisa e o emblema do capô vira o
  logo da Onça;
- sucesso: somem as faixas, o título, o parágrafo e o selo do ano: o fundo azul riscado é continuado ao
  longo dos riscos (cópia deslocada na direção deles, que casa os riscos dos dois lados), o asfalto de
  baixo com o cascalho do lado e a grama da beira com a própria grama; placa lisa e logo da Onça no capô;
- especiais: da página ficam só as fotos (o Onça amarelo, o jipe e o bugue) remontadas no papel creme;
  somem textos e a faixa com logo; a placa fica lisa, o emblema do capô vira o logo da Onça e a plaqueta
  da grade e a placa do jipe ficam lisas;
- teste: ficam só as fotos (as seis pequenas e o cupê verde grande) no papel creme: o título sai, o muro
  de tijolos é continuado onde ele estava e as três fotos de cima vão para a direita (o canto de cima
  à esquerda fica livre para o título da capa); placas lisas, adesivo da porta coberto com a lataria
  verde, miolo dos volantes liso e logo da Onça no capô;
- mosaico: as seis fotos ficam no papel creme (sem a faixa de texto, centradas na altura); o letreiro
  da grade some (lâminas continuadas), as placas ficam lisas, os emblemas dos capôs viram o logo da
  Onça e o sinal miúdo da tampa traseira some; o "GTE" fica.
Reduz para 560 x 315 com paleta curta (cores do logo da Onça garantidas).
Uso: python3 tools/ref/pumagte_photos.py <pasta com capa-*.png> <src/assets/photos>
"""
import os
import sys

import cv2
import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(__file__))
from brand_badges import logo_img  # noqa: E402

OUT = {'amarelo': 'pg-rio', 'sucesso': 'pg-sucesso', 'especiais': 'pg-especiais', 'teste': 'pg-teste',
       'mosaico': 'pg-mosaico'}
RNG = np.random.default_rng(74)


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


def heal(a, mask, r=4):
    """Cobre `mask` continuando o entorno (superfícies lisas com degradê)."""
    a[:] = cv2.inpaint(a, mask.astype(np.uint8), r, cv2.INPAINT_TELEA)


def flat_rows(a, mask, ref):
    """Plaqueta lisa: cada linha de `mask` vira a mediana da cor de fundo (`ref`) da mesma linha."""
    allc = np.median(a[ref], axis=0).astype(np.uint8)
    for y in np.where(mask.any(axis=1))[0]:
        a[y, mask[y]] = np.median(a[y][ref[y]], axis=0).astype(np.uint8) if ref[y].sum() > 3 else allc


def sow(a, mask, src):
    """Cobre `mask` com pixels sorteados de `src` da mesma linha (mantém o pontilhado do fundo)."""
    allp = a[src]
    for y in np.where(mask.any(axis=1))[0]:
        xs = np.where(mask[y])[0]
        pool = a[y][src[y]]
        if len(pool) < 4:
            pool = allp
        a[y, xs] = pool[RNG.integers(0, len(pool), len(xs))]


def paper(h, w, src):
    """Papel creme: retalho limpo da página repetido (espelhado a cada volta para não marcar emenda)."""
    ph, pw = src.shape[:2]
    out = np.zeros((h, w) + src.shape[2:], src.dtype)
    for j in range(0, h, ph):
        for i in range(0, w, pw):
            t = src[:, ::-1] if (i // pw) % 2 else src
            t = t[::-1] if (j // ph) % 2 else t
            out[j:j + ph, i:i + pw] = t[:min(ph, h - j), :min(pw, w - i)]
    return out


def cream_paper(a, src):
    """Papel creme: cada pixel sorteado da margem limpa da página (`src`); o retalho fino repetido
    marcava listras."""
    pool = a[src]
    return pool[RNG.integers(0, len(pool), a.shape[0] * a.shape[1])].reshape(a.shape)


def put(c, img, x, y, k=1.0):
    """Cola a foto com fator k (vizinho mais próximo: guarda o pixel), filete escuro e sombra leve."""
    h, w = img.shape[:2]
    im = np.array(Image.fromarray(img).resize((int(round(w * k)), int(round(h * k))), Image.NEAREST))
    h, w = im.shape[:2]
    sh = c[y + 6:y + h + 6, x + 6:x + w + 6].astype(np.float32)
    c[y + 6:y + h + 6, x + 6:x + w + 6] = (sh * 0.75).astype(np.uint8)
    c[y - 3:y + h + 3, x - 3:x + w + 3] = (22, 22, 26)
    c[y:y + h, x:x + w] = im


def onca(a, cx, cy, w, h):
    """Logo da Onça (src/assets/brands.json, 9 x 9) em w x h, centrado em (cx, cy)."""
    lg = np.array(Image.fromarray(logo_img('onca', 9)).resize((w, h), Image.NEAREST))
    y0, x0 = cy - h // 2, cx - w // 2
    sel = lg[..., 3] > 0
    a[y0:y0 + h, x0:x0 + w][sel] = lg[..., :3][sel]


def badge(a, mask, cx, cy, w, h, r=6):
    """Emblema do capô: lataria continuada por baixo (com desfoque leve) e o logo da Onça por cima."""
    heal(a, mask, r)
    sm = cv2.GaussianBlur(a, (0, 0), 1.5)
    a[mask] = sm[mask]
    onca(a, cx, cy, w, h)


def detail(a, hole, patch, sigma=4):
    """Lataria/chão continuados: degradê do entorno (inpaint) + o grão fino de um retalho limpo."""
    heal(a, hole, 9)
    p = patch.astype(np.float32)
    tex = paper(a.shape[0], a.shape[1], p - cv2.GaussianBlur(p, (0, 0), sigma))
    f = a.astype(np.float32)
    f[hole] += tex[hole]
    a[:] = np.clip(f, 0, 255).astype(np.uint8)


def slide(a, hole, ok, v, steps, mean=0):
    """Cobre `hole` copiando o próprio desenho deslocado ao longo do vetor v (passos em `steps`, na
    ordem): para cada pixel vale o primeiro deslocamento que cai em pixel bom (`ok` e fora do buraco);
    com mean=n vale a média dos n primeiros bons (borra só ao longo de v: some a emenda entre trechos
    copiados de lugares diferentes). Deslocar na direção dos riscos/lâminas leva cada risco sobre ele
    mesmo: os dois lados casam. Devolve os pixels que ficaram sem fonte."""
    h, w = a.shape[:2]
    src = a.copy()
    good = ok & ~hole
    ys, xs = np.nonzero(hole)
    acc = np.zeros((len(ys), 3), np.float32)
    cnt = np.zeros(len(ys), np.float32)
    left = np.ones(len(ys), bool)
    for s in steps:
        if not mean and not left.any():
            break
        sy = np.round(ys + v[1] * s).astype(int)
        sx = np.round(xs + v[0] * s).astype(int)
        inb = (sy >= 0) & (sy < h) & (sx >= 0) & (sx < w) & (left | (mean > 0) & (cnt < mean))
        hit = inb.copy()
        hit[inb] = good[sy[inb], sx[inb]]
        if mean:
            acc[hit] += src[sy[hit], sx[hit]].astype(np.float32)
            cnt[hit] += 1
        else:
            a[ys[hit], xs[hit]] = src[sy[hit], sx[hit]]
        left &= ~hit
    if mean:
        k = cnt > 0
        a[ys[k], xs[k]] = np.clip(acc[k] / cnt[k][:, None], 0, 255).astype(np.uint8)
    rest = np.zeros((h, w), bool)
    rest[ys[left], xs[left]] = True
    return rest


# ---------------------------------------------------------------- rio (amarelo no Rio)
def amarelo(a):
    # letreiro do canto (faixa preta, faixa vermelha, listras): polígono medido com folga
    sign = poly_mask(a, [(92, 14), (762, 14), (705, 130), (378, 130), (344, 188), (12, 188)])
    sign = grow(sign, 3)
    q = a.astype(int)
    sky = (q[..., 2] > 200) & (q[..., 0] < 70) & (q[..., 1] < 200)
    # céu: a mesma linha copiada da direita (deslocamentos pares, o primeiro que cai em céu sem nuvem):
    # guarda o xadrez do pontilhado e o degradê de cada altura
    pool = sky & (rect_mask(a, 770, 0, 1140, 66) | rect_mask(a, 1070, 66, 1460, 118) | rect_mask(a, 1340, 118, 1460, 190)
                  | rect_mask(a, 660, 132, 1090, 190))
    slide(a, sign, pool, np.array([1.0, 0.0]), list(range(304, 1600, 16)))
    # copa da árvore da esquerda (ia até x ~ 290 em cima e embaixo do letreiro): a árvore da direita
    # espelhada e puxada 80 px para dentro (folhagem não tem lado; a borda irregular e os vãos de céu
    # vêm dela), achatada na altura para a copa dela (y 0 a 150) cobrir a faixa do letreiro
    yy, xx = np.mgrid[0:a.shape[0], 0:a.shape[1]]
    crown = (sign | rect_mask(a, 0, 14, 110, 190)) & (xx < 288)  # (com a cunha à esquerda: sem emenda na diagonal)
    sx = np.where(xx >= 80, 1751 - xx, 1520 + xx)
    sy = np.where(xx >= 80, yy * 150 // 188, yy * 128 // 188)
    sx = np.clip(sx, 0, a.shape[1] - 1)
    src = a[sy, sx]
    leaf = ~sky[sy, sx] & ~((q[sy, sx, 2] > 200) & (q[sy, sx, 0] > 150))  # (nem céu nem nuvem)
    sel = crown & leaf
    a[sel] = src[sel]
    # placa vermelha lisa (borda escura e filete claro ficam)
    inner = rect_mask(a, 288, 666, 462, 716)
    red = (q[..., 0] > 200) & (q[..., 1] < 70) & (q[..., 2] < 70)
    flat_rows(a, inner, inner & red)
    # emblema do capô: logo da Onça
    heal(a, grow(ell_mask(a, 401, 634, 25, 17), 2), 6)
    onca(a, 401, 634, 18, 18)
    return a


# ---------------------------------------------------------------- sucesso (vermelho, fundo azul)
def sucesso(a):
    q = a.astype(int)
    blue = (q[..., 2] > q[..., 0] + 30) & (q[..., 2] > q[..., 1] + 5)
    banners = rect_mask(a, 0, 0, 1262, 106)
    hole = banners | rect_mask(a, 30, 100, 650, 330) | rect_mask(a, 44, 320, 362, 650)
    # silhueta do carro (lataria vermelha fechada mais os vidros): nunca é buraco nem fonte
    seal = poly_mask(a, [(1140, 700), (1672, 630), (1672, 800), (1640, 880), (1610, 912), (1290, 925),
                         (1070, 895), (1060, 850)])
    red = (q[..., 0] > 170) & (q[..., 1] < 90) & (q[..., 2] < 80) & ~banners & ~seal
    car = cv2.morphologyEx(red.astype(np.uint8), cv2.MORPH_CLOSE, np.ones((41, 41), np.uint8))
    cnts, _ = cv2.findContours(car, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    cv2.drawContours(car, cnts, -1, 1, -1)  # (faróis e vidros por dentro)
    car = grow((car > 0) | poly_mask(a, [(590, 470), (700, 262), (1010, 200), (1250, 140), (1260, 330), (800, 440)])
               | ell_mask(a, 300, 705, 60, 66), 8)
    hole &= ~car
    # fundo azul riscado: o próprio desenho deslocado ao longo dos riscos (inclinação medida no fundo
    # limpo com o tensor de estrutura: dy/dx = 1,5); onde a linha do risco não acha fundo limpo (canto
    # esquerdo), o risco do retalho limpo de cima à direita, com o degradê do entorno
    v = np.array([0.555, 0.832])
    steps = [s for k in range(1, 18) for s in (23 * k, -23 * k)]
    sky = blue & ~grow(car, 16) & rect_mask(a, 5, 0, 1672, 640)  # (sem a sombra azulada do asfalto)
    left = slide(a, hole, sky, v, steps, mean=4)
    # (linhas de risco que não acham fundo limpo em nenhum dos dois sentidos: os riscos vizinhos já
    # refeitos, deslocados na horizontal)
    q2 = a.astype(int)
    yy0 = np.mgrid[0:a.shape[0], 0:a.shape[1]][0]
    blue2 = (q2[..., 2] > q2[..., 0] + 30) & (q2[..., 2] > q2[..., 1] + 5) & ~grow(car, 16) & (yy0 < 640)
    left = slide(a, left, blue2, np.array([1.0, 0.0]), [s for k in range(1, 30) for s in (-47 * k, 47 * k)], mean=2)
    detail(a, left, a[2:100, 1250:1530].copy(), 6)
    # (fim do parágrafo encostado no para-lama: só o que não é azul nem lataria, acima do contorno)
    q2 = a.astype(int)
    lat = grow((q2[..., 0] > 170) & (q2[..., 1] < 90) & (q2[..., 2] < 80), 7)
    box = rect_mask(a, 240, 575, 350, 640)
    tail = grow(box & (lum(a) > 150) & (sat(a) < 90) & ~lat, 4) & box & ~lat
    slide(a, tail, blue2 & ~tail, v, steps, mean=4)
    crumbs = box & (lum(a) > 140) & (sat(a) < 100)
    heal(a, grow(crumbs, 1) & ~grow((q2[..., 0] > 170) & (q2[..., 1] < 90), 1), 3)
    # selo do ano (canto de baixo à direita, com a sombra): asfalto de cascalho e a grama da beira
    yy, xx = np.mgrid[0:a.shape[0], 0:a.shape[1]]
    grass = seal & (yy < 668 + (xx - 1458) * 0.1) & (xx > 1440)
    # (o degradê do asfalto não pode puxar o verde da grama que encosta em cima do selo)
    q = a.astype(int)
    lawn = grow(seal, 12) & ~seal & (q[..., 1] > q[..., 2] + 40)
    road = grow(seal, 12) & ~seal & ~lawn
    b = a.copy()
    b[lawn] = np.median(a[road], axis=0).astype(np.uint8)
    heal(b, seal, 9)
    # cascalho: blocos de 4 x 4 sorteados do asfalto limpo de baixo (sem repetição que marque), só o
    # grão fino deles somado ao degradê do entorno
    pt = a[884:941, 500:1000].astype(np.float32)
    tex = np.zeros(a.shape, np.float32)
    for y in range(0, a.shape[0], 4):
        for x in range(1000, a.shape[1], 4):
            j, i = RNG.integers(0, pt.shape[0] - 4), RNG.integers(0, pt.shape[1] - 4)
            tex[y:y + 4, x:x + 4] = pt[j:j + 4, i:i + 4][:min(4, a.shape[0] - y), :min(4, a.shape[1] - x)]
    det = tex - cv2.GaussianBlur(tex, (0, 0), 6)
    af = a.astype(np.float32)
    ring = grow(seal, 30) & ~grow(seal, 4) & ~grow(car, 10) & ~lawn & ~grow(q[..., 1] > q[..., 2] + 40, 4)
    k = (af - cv2.GaussianBlur(af, (0, 0), 6))[ring].std() / max(det[seal].std(), 1)
    f = b.astype(np.float32) + det * k
    a[seal] = np.clip(f[seal], 0, 255).astype(np.uint8)
    gt = paper(a.shape[0], a.shape[1], a[560:640, 1585:1665].copy())
    a[grass] = gt[grass]
    # placa "lisa": letras claras viram o azul-marinho dela (filete claro de volta fica)
    plate = poly_mask(a, [(335, 809), (459, 778), (485, 832), (358, 862)])
    flat_rows(a, plate, plate & (lum(a) < 80))
    # emblema do capô: logo da Onça
    badge(a, grow(poly_mask(a, [(398, 748), (404, 722), (425, 704), (452, 698), (454, 712), (432, 742), (410, 756)]), 3),
          426, 727, 18, 18, 5)
    return a


# ---------------------------------------------------------------- especiais (página com três fotos)
def especiais(a):
    q = a.astype(int)
    # Onça amarelo: placa preta lisa (filete claro fica) e logo da Onça no capô
    inner = rect_mask(a, 712, 682, 862, 740)
    flat_rows(a, inner, inner & (lum(a) < 45))
    badge(a, grow(ell_mask(a, 769, 648, 25, 13), 2), 772, 649, 18, 18)
    # jipe: plaqueta clara da grade lisa (miolo creme chapado; o contorno escuro fica) e placa amarela lisa
    ov = ell_mask(a, 1127, 143, 27, 11)
    lt = ov & (lum(a) > 170) & (sat(a) < 120)
    flat_rows(a, ov, lt)
    inner = rect_mask(a, 958, 208, 990, 230)
    yel = (q[..., 0] > 170) & (q[..., 1] > 110) & (q[..., 2] < 120)
    flat_rows(a, inner, inner & yel)
    Y = a[333:838, 14:1080].copy()
    J = a[8:316, 812:1632].copy()
    B = a[334:836, 1150:1659].copy()
    c = cream_paper(a, rect_mask(a, 24, 898, 384, 938))
    # o Onça grande em cima à esquerda, o bugue ao lado e o jipe embaixo à direita
    put(c, Y, 26, 26, 1.0)
    put(c, B, 1672 - 26 - B.shape[1], 30, 1.0)
    put(c, J, 1672 - 26 - int(round(J.shape[1] * 1.18)), 941 - 26 - int(round(J.shape[0] * 1.18)), 1.18)
    return c


# ---------------------------------------------------------------- teste (página do teste)
def teste(a):
    q = a.astype(int)
    # placa da frente: lisa, no creme dela (some também a faixa vermelha; a borda fica)
    plate = poly_mask(a, [(487, 733), (619, 745), (616, 836), (488, 823)])
    cream = plate & (q[..., 0] > 200) & (q[..., 1] > 190) & (q[..., 2] > 150) & rect_mask(a, 0, 0, 1672, 782)
    flat_rows(a, plate, cream)
    low = plate & rect_mask(a, 0, 782, 1672, 941)
    a[low] = np.median(a[plate & rect_mask(a, 0, 768, 1672, 782)], axis=0).astype(np.uint8)
    sm = cv2.GaussianBlur(a, (0, 0), 1.5)
    a[plate] = sm[plate]
    # placa da traseira (foto pequena)
    plate = rect_mask(a, 459, 176, 515, 206)
    cream = plate & (q[..., 0] > 200) & (q[..., 1] > 190)
    flat_rows(a, plate, cream)
    # adesivo da porta (com o contorno escuro): lataria verde continuada com o grão da porta; o friso
    # cromado de cima não entra no degradê (senão escorre claro para dentro)
    st = grow(poly_mask(a, [(1268, 532), (1372, 512), (1398, 622), (1300, 646)]), 3)
    near = grow(st, 14) & ~st
    b = a.copy()
    b[near & (lum(a) > 90)] = np.median(a[near & (lum(a) <= 90)], axis=0).astype(np.uint8)
    detail(b, st, a[650:700, 1290:1400].copy(), 3)
    a[st] = b[st]
    # miolo dos volantes liso (o disco escuro continua por cima do logo)
    for cx, cy, r in ((176, 118, 12), (356, 406, 14)):
        d = ell_mask(a, cx, cy, r, r)
        heal(a, d & ((lum(a) > 70) | (sat(a) > 60)), 4)
        sm = cv2.GaussianBlur(a, (0, 0), 1.2)
        a[d] = sm[d]
    # emblema do capô: logo da Onça
    badge(a, grow(poly_mask(a, [(560, 712), (566, 694), (590, 676), (614, 678), (606, 708), (584, 722), (566, 722)]), 3),
          588, 699, 18, 18)
    # o título sai: muro de tijolos continuado onde estava a caixa (mesmas fiadas, copiadas do muro
    # limpo à esquerda) e as três fotos de cima vão para a direita
    for x in range(1020, 1663):
        a[299:336, x] = a[299:336, 880 + (x - 1020) % 140]
    P1 = a[18:288, 13:385].copy()
    P2 = a[18:288, 399:774].copy()
    P3 = a[18:288, 791:1030].copy()
    c = a.copy()
    pp = cream_paper(a, rect_mask(a, 20, 928, 1650, 940) | rect_mask(a, 20, 1, 1650, 13))
    c[0:296] = pp[0:296]
    c[:296, 1662:] = pp[:296, 1662:]
    x = 1660 - 3
    for P in (P3, P2, P1):
        x -= P.shape[1]
        put(c, P, x, 18)
        x -= 15
    # filete de cima da foto grande, agora reto de ponta a ponta à direita da coluna
    c[296:299, 777:1663] = (22, 22, 26)
    return c


# ---------------------------------------------------------------- mosaico (seis detalhes)
def mosaico(a):
    q = a.astype(int)
    # sinal miúdo da tampa traseira (foto do GTE): o vermelho-escuro chapado da tampa em volta
    r = rect_mask(a, 644, 172, 668, 204)
    body = grow(r, 6) & ~r
    a[r] = np.median(a[body], axis=0).astype(np.uint8)
    sm = cv2.GaussianBlur(a, (0, 0), 1.5)
    a[grow(r, 1)] = sm[grow(r, 1)]
    # frente laranja: logo da Onça no capô e placa vermelha lisa
    badge(a, ell_mask(a, 1225, 244, 20, 15), 1225, 244, 16, 16)
    inner = rect_mask(a, 1158, 297, 1281, 350)
    red = (q[..., 0] > 130) & (q[..., 1] < 70) & (q[..., 2] < 70)
    flat_rows(a, inner & ~red, inner & red)
    sm = cv2.GaussianBlur(a, (0, 0), 1.0)
    a[inner] = sm[inner]
    # grade: o letreiro some (as lâminas, levemente inclinadas, continuadas da esquerda)
    g = rect_mask(a, 168, 530, 288, 574)
    slide(a, g, np.ones(a.shape[:2], bool), np.array([-0.996, -0.085]), [122, 140])
    sm = cv2.GaussianBlur(a, (0, 0), 0.8)
    a[grow(g, 1) & ~g | g & ~grow(~g, 2)] = sm[grow(g, 1) & ~g | g & ~grow(~g, 2)]
    # frente prata: placa preta lisa e logo da Onça no capô
    plate = poly_mask(a, [(659, 670), (761, 700), (763, 746), (664, 718)])
    flat_rows(a, plate, plate & (lum(a) < 40))
    badge(a, ell_mask(a, 731, 632, 20, 17), 731, 632, 16, 16)
    # sem a faixa de texto: a grade de fotos desce para o meio da página
    c = cream_paper(a, rect_mask(a, 0, 927, 1672, 940))
    c[90:851] = a[12:773]
    return c


def main():
    src, out = sys.argv[1], sys.argv[2]
    fn = {'amarelo': amarelo, 'sucesso': sucesso, 'especiais': especiais, 'teste': teste, 'mosaico': mosaico}
    cols = sorted({tuple(int(v) for v in c[:3]) for c in logo_img('onca', 9).reshape(-1, 4) if c[3] > 0})
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
        n = 156
        qz = im.quantize(n, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
        pal = Image.new('P', (1, 1))
        pal.putpalette((qz.getpalette()[:n * 3] + [v for c in cols for v in c] + [0] * 768)[:768])
        im = im.quantize(palette=pal, dither=Image.Dither.NONE)
        im.save(os.path.join(out, f'{name}.png'), optimize=True)
        print(name, os.path.getsize(os.path.join(out, f'{name}.png')))


if __name__ == '__main__':
    main()
