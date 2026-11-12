"""Fotos da revista do Silber 95 (Porsche 959, pixel art do Victor). Só marcas fictícias; tudo o que é
apagado é coberto com a cor/textura do entorno (nunca tarja):
- floresta: o letreiro da faixa traseira some (vermelho da faixa continuado) e a placa fica preta e lisa,
  no carro e no reflexo da poça;
- neve: o brasão do capô vira o logo da Silber (lataria continuada por baixo) e a placa fica branca e lisa;
- duelo: da página dupla ficam só as fotos (as duas grandes, a do cupê na garagem e a da Fúria F4 na
  frente do prédio) remontadas no papel creme da revista; somem textos, faixas de
  título, placas e emblemas (placas lisas, emblema e plaqueta da Fúria pintados do preto do painel);
- pista: fica só a foto do carro na pista (recorte abaixo do texto, sem título, legenda e rodapé), a
  placa fica branca e lisa, o letreiro do suporte da placa e o da faixa traseira somem;
- garagem: o texto do canto (título, filete e parágrafo) some com o piso e a grama continuados por
  baixo (textura copiada do lado, ao longo da faixa de grama, com o degradê do entorno); o escudo da
  porta da Fúria some na lataria, o emblema do nariz vira o logo da Fúria e o brasão do capô do
  Silber vira o logo da Silber;
- raiox: o letreiro da faixa traseira some (vermelho da faixa continuado) e o brasão do centro das
  duas rodas vira miolo liso prateado;
- teste: da página dupla ficam só as fotos (lateral em movimento, frente, traseira com a quinta roda,
  mecânico com o torquímetro, motorista e os dois lavadores de farol) remontadas no papel creme; somem
  textos, ficha, quadro de resultados e rodapé; a placa fica lisa, o letreiro da lanterna, o brasão
  do capô e o do volante somem.
Reduz para 560 x 315 com paleta curta (cores do logo da Silber garantidas).
Uso: python3 tools/ref/silber_photos.py <pasta com capa-*.png> <src/assets/photos>
"""
import os
import sys

import cv2
import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(__file__))
from brand_badges import logo_img  # noqa: E402

OUT = {'floresta': 'p9-floresta', 'neve': 'p9-neve', 'revista': 'p9-duelo', 'pista': 'p9-pista',
       'garagem': 'p9-garagem', 'raiox': 'p9-raiox', 'teste': 'p9-teste'}
RNG = np.random.default_rng(95)


def lum(a):
    return a.astype(int).sum(axis=2) // 3


def sat(a):
    return a.astype(int).max(axis=2) - a.astype(int).min(axis=2)


def rect_mask(a, x0, y0, x1, y1):
    m = np.zeros(a.shape[:2], bool)
    m[y0:y1, x0:x1] = True
    return m


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


def row_fill(a, x0, y0, x1, y1, refs, ok=None, soft=0):
    """Faixa lisa: cada linha do retângulo vira a mediana da mesma linha nos trechos `refs` [(xa, xb)]
    ao lado (só pixels aceitos por `ok`), com um desfoque leve para não marcar degrau."""
    for y in range(y0, y1):
        px = np.concatenate([a[y, xa:xb] for xa, xb in refs])
        if ok is not None:
            sel = ok(px)
            px = px[sel] if sel.sum() > 2 else px
        a[y, x0:x1] = np.median(px, axis=0).astype(np.uint8)
    if soft:
        sm = cv2.GaussianBlur(a, (0, 0), soft)
        a[y0:y1, x0:x1] = sm[y0:y1, x0:x1]


def red(px):
    q = px.astype(int)
    return (q[:, 0] > 140) & (q[:, 1] < 110) & (q[:, 2] < 110)


def silber(a, cx, cy, w, h, bid='silber'):
    """Logo da Silber (losango de src/assets/brands.json) em w x h, centrado em (cx, cy)."""
    lg = np.array(Image.fromarray(logo_img(bid, 9)).resize((w, h), Image.NEAREST))
    y0, x0 = cy - h // 2, cx - w // 2
    sel = lg[..., 3] > 0
    a[y0:y0 + h, x0:x0 + w][sel] = lg[..., :3][sel]


# ---------------------------------------------------------------- floresta (traseira na poça)
def floresta(a):
    # letreiro escuro na faixa vermelha (carro e reflexo): cada linha com o vermelho da própria faixa
    row_fill(a, 418, 526, 630, 550, [(408, 418), (630, 640)], red, 1.2)
    # (no reflexo a faixa desce para a direita: topo em y 866 no x 415 e 882 no x 625, 21 px de altura;
    # cada linha inclinada vira o degradê entre o vermelho das duas pontas)
    f = a.astype(np.float32)
    top = lambda x: 866 + (x - 415) * 16 / 210  # noqa: E731
    for k in range(1, 22):
        l = f[int(round(top(412) + k)), 408:416].mean(axis=0)
        rr = f[int(round(top(632) + k)), 628:636].mean(axis=0)
        for x in range(418, 627):
            t = (x - 418) / (627 - 418)
            a[int(round(top(x) + k)), x] = (l * (1 - t) + rr * t).astype(np.uint8)
    # placa preta: miolo inteiro no preto da placa (a borda branca fica)
    for x0, y0, x1, y1 in ((462, 584, 574, 611), (462, 828, 574, 856)):
        inner = rect_mask(a, x0, y0, x1, y1)
        flat_rows(a, inner, inner & (lum(a) < 50))
    return a


# ---------------------------------------------------------------- neve (derrapando na serra)
def neve(a):
    # brasão do capô: lataria prata continuada e logo da Silber deitado como o capô
    heal(a, ell_mask(a, 624, 664, 17, 12), 6)
    sm = cv2.GaussianBlur(a, (0, 0), 2)
    m = ell_mask(a, 624, 664, 15, 10)
    a[m] = sm[m]
    silber(a, 624, 664, 18, 14)
    # placa: letras pretas viram o branco da placa (borda preta fica)
    inner = rect_mask(a, 528, 727, 641, 760)
    flat_rows(a, inner, inner & (lum(a) > 200))
    return a


# ---------------------------------------------------------------- duelo (comparativo na revista)
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


def put(c, img, x, y, k):
    """Cola a foto com fator k (vizinho mais próximo: guarda o pixel), filete escuro e sombra leve."""
    h, w = img.shape[:2]
    im = np.array(Image.fromarray(img).resize((int(w * k), int(h * k)), Image.NEAREST))
    h, w = im.shape[:2]
    sh = c[y + 6:y + h + 6, x + 6:x + w + 6].astype(np.float32)
    c[y + 6:y + h + 6, x + 6:x + w + 6] = (sh * 0.72).astype(np.uint8)
    c[y - 3:y + h + 3, x - 3:x + w + 3] = (36, 30, 34)
    c[y:y + h, x:x + w] = im


def revista(a):
    # Fúria F4: placa (moldura vermelha fica, miolo liso claro), plaqueta de baixo e a sigla vertical
    # ao lado da placa somem no preto do painel
    for y in range(300, 333):
        t = (y - 300) / 33
        a[y, 641:669] = (np.array((200, 200, 204)) * (1 - t) + np.array((164, 166, 176)) * t).astype(np.uint8)
    blk = np.median(a[rect_mask(a, 600, 290, 700, 345) & (lum(a) < 30)], axis=0).astype(np.uint8)
    a[289:313, 679:690] = blk
    a[364:383, 634:665] = blk
    # cupê branco: letras pretas da placa viram o branco dela (borda e faixa azul ficam)
    inner = rect_mask(a, 969, 350, 1066, 379)
    ink = inner & (lum(a) < 130)
    flat_rows(a, grow(ink, 1) & inner, inner & ~grow(ink, 2) & (lum(a) > 180))
    # cupê na garagem: placa miúda lisa
    a[596:604, 1216:1248] = np.median(a[594:606, 1214:1250].reshape(-1, 3)[lum(a[594:606, 1214:1250]).ravel() > 150], axis=0).astype(np.uint8)
    f40 = a[73:457, 125:797].copy()
    cup = a[72:456, 873:1565].copy()
    gar = a[489:621, 1105:1352].copy()
    pre = a[633:760, 1105:1352].copy()
    # (a bandeira da página invade o canto do céu da foto da Fúria: céu copiado do lado)
    f40[:10, :72] = f40[:10, 80:152]
    c = paper(941, 1672, a[465:550, 1400:1600].copy())
    # grandes em diagonal (o cupê por cima do canto de asfalto da Fúria) e as pequenas nos cantos livres
    put(c, f40, 16, 16, 1.25)
    put(c, gar, 1124, 84, 2.0)
    put(c, pre, 150, 592, 2.0)
    put(c, cup, 791, 445, 1.25)
    return c


# ---------------------------------------------------------------- pista (vermelho de traseira)
def pista(a):
    # placa: miolo inteiro liso e branco (some a faixa azul com a letra, o selo e os números)
    for y in range(686, 734):
        t = (y - 686) / 48
        a[y, 679:904] = (np.array((236, 236, 240)) * (1 - t) + np.array((214, 214, 222)) * t).astype(np.uint8)
    # letreiro branco do suporte da placa: preto do suporte continuado
    row_fill(a, 708, 735, 884, 751, [(690, 708), (884, 900)], lambda p: lum(p[None])[0] < 70, 1)
    # letreiro da faixa traseira e plaquinha da tampa: cada linha com a cor da própria faixa ao lado
    row_fill(a, 686, 628, 890, 655, [(650, 686), (890, 940)], None, 1.2)
    row_fill(a, 756, 606, 820, 620, [(730, 756), (820, 846)], None, 1)
    # só a foto do carro na pista: recorte 16:9 abaixo do texto (título, legenda e rodapé ficam fora)
    return a[345:941, 70:1130].copy()


# ---------------------------------------------------------------- garagem (Fúria F4 x Silber 95)
def ground_fill(a, mask, patch, ok, fit_ok, strip=None, ref=None):
    """Cobre `mask` com chão: o sombreado do entorno (superfície suave de grau 3 ajustada no anel em volta
    da máscara, nos pixels `fit_ok`, mais a diferença do anel, que some em ~30 px para dentro) e o grão
    de um retalho limpo de piso (`patch` = x0, y0, x1, y1), repetido espelhado e na escala do brilho do
    lugar. (Continuar só a borda, como o inpaint, arrasta a sombra dos carros para o meio do vazio.)
    `ok`: pixels de chão (o anel só usa estes). `ref`: pixels da máscara que entram no anel com a cor
    original (a borda da foto: o chão refeito emenda com o escuro do canto sem degrau).
    `strip` = (c0, inclinação, meia largura, passo, x mínimo e máximo da origem): a faixa de grama
    continua copiada ao longo dela mesma, de `passo` em `passo` px, a partir do trecho que aparece (o
    contraste acompanha o brilho do lugar: some aos poucos no escuro do canto)."""
    ring = grow(mask, 50) & ~mask & ok
    if ref is not None:
        ring |= ref
    fit = ring & fit_ok
    A = cv2.GaussianBlur(a.astype(np.float32), (0, 0), 4)
    H, W = mask.shape
    yy, xx = np.mgrid[0:H, 0:W]
    u, v = xx / W, yy / H
    terms = [u ** i * v ** j for i in range(4) for j in range(4 - i)]
    X = np.stack([t[fit] for t in terms], 1)
    base = np.zeros(A.shape, np.float32)
    for ch in range(3):
        coef = np.linalg.lstsq(X, A[..., ch][fit], rcond=None)[0]
        base[..., ch] = sum(c * t for c, t in zip(coef, terms))
    r = (A - base) * ring[..., None]
    wb = cv2.GaussianBlur(ring.astype(np.float32), (0, 0), 15)
    base += cv2.GaussianBlur(r, (0, 0), 15) / (wb[..., None] + 0.15)
    x0, y0, x1, y1 = patch
    src = a[y0:y1, x0:x1].astype(np.float32)
    sb = cv2.GaussianBlur(src, (0, 0), 6)
    det = (src - sb) / np.maximum(sb.mean(axis=2, keepdims=True), 1)
    tile = paper(a.shape[0], a.shape[1], det)
    ys, xs = np.nonzero(mask)
    lb = base[ys, xs].mean(axis=1, keepdims=True)
    out = a.astype(np.float32)
    out[ys, xs] = base[ys, xs] + tile[ys, xs] * lb
    if strip:
        c0, k, hw, step, xmin, xmax = strip
        H, W = mask.shape
        det2 = a.astype(np.float32) - base
        for y, x in zip(ys, xs):
            if abs(y - (c0 - k * x)) > hw:
                continue
            for n in range(1, 8):
                sx, sy = x + step * n, int(round(y - k * step * n))
                if sx >= min(W, xmax) or sy < 0:
                    break
                if sx >= xmin and not mask[sy, sx]:
                    out[y, x] = base[y, x] + det2[sy, sx] * base[y, x].mean() / max(base[sy, sx].mean(), 1)
                    break
    a[:] = np.clip(out, 0, 255).astype(np.uint8)


def garagem(a):
    # texto do canto: o bloco inteiro (título de três linhas, filete e parágrafo) vira chão, não só as
    # letras (a sombra escura delas entre os traços também sai); mais as letras claras que sobrem fora
    zone = rect_mask(a, 0, 575, 990, 910) & ~rect_mask(a, 735, 0, 1672, 740)
    ink = zone & (lum(a) > 165) & (sat(a) < 70)
    txt = (rect_mask(a, 0, 578, 628, 802) | rect_mask(a, 0, 806, 985, 906) | grow(ink, 5)) & zone
    # chão: grão do piso limpo do lado direito; a faixa de grama (centro em y 598 no x 720, descendo
    # 0,27 px por px para a esquerda) continua copiada do trecho que aparece entre o texto e o Silber
    ground = rect_mask(a, 0, 560, 1672, 941) & ~rect_mask(a, 735, 0, 1672, 760)
    shadow = rect_mask(a, 0, 540, 460, 600)  # (sombra da Fúria: fica fora do ajuste do sombreado)
    ground_fill(a, txt, (1020, 790, 1520, 930), ground, ~shadow, (598 + 0.27 * 720, 0.27, 30, 100, 628, 729),
                rect_mask(a, 0, 578, 40, 906))
    # escudo da porta da Fúria: só o amarelo e o preto do escudo saem (o reflexo claro de cima e a
    # lente do pisca embaixo ficam); lataria continuada e o pontilhado dela copiado do para-lama ao lado
    box = rect_mask(a, 630, 326, 666, 377)
    q = a.astype(int)
    shield = rect_mask(a, 632, 330, 664, 375) & (((q[..., 0] > 170) & (q[..., 1] > 140)) | (lum(a) < 70))
    shield = grow(shield, 2) & box & ~rect_mask(a, 650, 376, 666, 377)
    # (cada linha com a mediana do vermelho da mesma linha nos dois lados: o reflexo de cima segue)
    fill = a.copy()
    row_fill(fill, 630, 326, 666, 377, [(612, 630), (672, 690)], red, 1.5)
    a[shield] = fill[shield]
    sm = cv2.GaussianBlur(a.astype(np.float32), (0, 0), 3)
    det = a.astype(np.float32) - sm
    ys, xs = np.nonzero(shield)
    a[ys, xs] = np.clip(sm[ys, xs] + det[ys, xs - 34] * 0.8, 0, 255).astype(np.uint8)
    # emblema amarelo do nariz: lataria vermelha e o logo da Fúria
    heal(a, rect_mask(a, 178, 421, 221, 451), 5)
    silber(a, 199, 437, 14, 16, 'furia')
    # brasão do capô do Silber: lataria prata continuada e o logo da Silber deitado como o capô
    heal(a, ell_mask(a, 1004, 509, 23, 20), 6)
    sm = cv2.GaussianBlur(a, (0, 0), 2)
    m = ell_mask(a, 1004, 509, 21, 18)
    a[m] = sm[m]
    silber(a, 1004, 510, 30, 26)
    return a


# ---------------------------------------------------------------- raiox (desenho em corte)
def ink_in_red(a, region):
    """Letras escuras dentro de uma faixa vermelha: o que o fechamento do vermelho cobre (traços finos
    cercados de vermelho), sem a borda preta da faixa (vermelho só de um lado) nem o filete claro."""
    r = red(a.reshape(-1, 3)).reshape(a.shape[:2])
    cl = cv2.morphologyEx(r.astype(np.uint8), cv2.MORPH_CLOSE, np.ones((7, 7), np.uint8)) > 0
    hl = (a[..., 0] > 200) & (a[..., 1] > 110)
    m = cl & ~r & (lum(a) < 130) & region
    return grow(m, 1) & cl & ~hl & region


def hub(a, cx, cy, rx, ry):
    """Miolo liso prateado: degradê claro no alto à esquerda, escuro embaixo, contorno escuro."""
    yy, xx = np.mgrid[0:a.shape[0], 0:a.shape[1]]
    e = ((xx - cx) / rx) ** 2 + ((yy - cy) / ry) ** 2
    t = np.clip(((xx - cx) / rx + (yy - cy) / ry + 1.4) / 2.8, 0, 1)[..., None]
    c = np.array((232, 232, 242)) * (1 - t) + np.array((128, 128, 150)) * t
    m = e <= 1
    a[m] = c[m].astype(np.uint8)
    rim = (e > 1) & (e <= 1.35)
    a[rim] = (44, 42, 60)
    # (sobra amarela/vermelha do brasão na borda: vai para o escuro do contorno)
    a[(e <= 2.2) & (sat(a) > 70)] = (44, 42, 60)


def raiox(a):
    # letreiro da faixa vermelha traseira
    m = ink_in_red(a, rect_mask(a, 130, 490, 320, 652))
    heal(a, m, 3)
    # brasão do centro das rodas (traseira e dianteira)
    hub(a, 941, 714, 10, 13)
    hub(a, 1500, 447, 8, 12)
    return a


# ---------------------------------------------------------------- teste (página dupla da revista)
def teste(a):
    # frente: placa lisa (cor da placa; a borda escura fica) e brasão do capô na lataria
    inner = rect_mask(a, 250, 383, 320, 400)
    flat_rows(a, inner, inner & (lum(a) > 170))
    heal(a, rect_mask(a, 272, 357, 285, 367), 4)
    # traseira: letreiro escuro na faixa das lanternas e placa miúda lisa
    # (aqui as letras são vermelho-escuras, não pretas: cada uma vira a mediana do vermelho vivo em volta)
    # (a faixa sobe para a direita: miolo de 8 linhas a partir de y 342,5 no x 712, -0,177 px por px;
    # a borda preta de cima e de baixo fica)
    q = a.astype(int)
    vivid = rect_mask(a, 700, 326, 790, 356) & (q[..., 0] >= 0xb0) & (q[..., 1] * 2 < q[..., 0]) & (q[..., 2] * 2 < q[..., 0])
    inside = np.zeros(a.shape[:2], bool)
    for x in range(727, 777):
        t = int(round(342.5 - 0.177 * (x - 712)))
        inside[t:t + 8, x] = True
    for y, x in zip(*np.nonzero(inside & ~vivid)):
        win = vivid[y - 4:y + 5, x - 4:x + 5]
        if win.sum() > 2:
            a[y, x] = np.median(q[y - 4:y + 5, x - 4:x + 5][win], axis=0).astype(np.uint8)
    inner = rect_mask(a, 755, 356, 766, 366)
    flat_rows(a, inner, inner & (lum(a) > 150))
    # volante: brasão do centro no preto do volante
    heal(a, rect_mask(a, 592, 584, 620, 617), 6)
    big = a[66:250, 56:805].copy()
    fr = a[266:441, 56:400].copy()
    rr = a[266:441, 417:805].copy()
    mec = a[458:619, 57:430].copy()
    drv = a[458:619, 446:805].copy()
    hl1 = a[66:277, 1106:1337].copy()
    hl2 = a[66:277, 1357:1604].copy()
    c = paper(941, 1672, a[22:44, 330:790].copy())
    # coluna da esquerda: a lateral em cima, frente e traseira, mecânico e motorista; à direita os
    # dois lavadores de farol um sobre o outro
    put(c, big, 36, 65, 1.45)
    put(c, fr, 36, 360, 1.45)
    put(c, rr, 559, 360, 1.45)
    put(c, mec, 36, 642, 1.45)
    put(c, drv, 601, 642, 1.45)
    put(c, hl1, 1179, 65, 1.85)
    put(c, hl2, 1164, 483, 1.85)
    return c


def main():
    src, out = sys.argv[1], sys.argv[2]
    fn = {'floresta': floresta, 'neve': neve, 'revista': revista, 'pista': pista, 'garagem': garagem, 'raiox': raiox,
          'teste': teste}
    cols = {b: sorted({tuple(int(v) for v in c[:3]) for c in logo_img(b, 9).reshape(-1, 4) if c[3] > 0})
            for b in ('silber', 'furia')}
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
        n = 240 if k == 'raiox' else 156  # (o corte tem azul, prata, dourado e o vermelho da faixa)
        q = im.quantize(n, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
        extra = {'neve': cols['silber'], 'garagem': cols['silber'] + cols['furia']}.get(k, [])
        pal = Image.new('P', (1, 1))
        pal.putpalette((q.getpalette()[:n * 3] + [v for c in extra for v in c] + [0] * 768)[:768])
        im = im.quantize(palette=pal, dither=Image.Dither.NONE)
        im.save(os.path.join(out, f'{name}.png'), optimize=True)
        print(name, os.path.getsize(os.path.join(out, f'{name}.png')))


if __name__ == '__main__':
    main()
