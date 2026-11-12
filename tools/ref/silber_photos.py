"""Fotos da revista do Silber 95 (Porsche 959, pixel art do Victor). Só marcas fictícias; tudo o que é
apagado é coberto com a cor/textura do entorno (nunca tarja):
- floresta: o letreiro da faixa traseira some (vermelho da faixa continuado) e a placa fica preta e lisa,
  no carro e no reflexo da poça;
- neve: o brasão do capô vira o logo da Silber (lataria continuada por baixo) e a placa fica branca e lisa;
- duelo: da página dupla ficam só as fotos (as duas grandes, a do cupê na garagem e a da Fúria F4 na
  frente do prédio) remontadas no papel creme da revista; somem textos, faixas de
  título, placas e emblemas (placas lisas, emblema e plaqueta da Fúria pintados do preto do painel);
- pista: fica só a foto do carro na pista (recorte abaixo do texto, sem título, legenda e rodapé), a
  placa fica branca e lisa, o letreiro do suporte da placa e o da faixa traseira somem.
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

OUT = {'floresta': 'p9-floresta', 'neve': 'p9-neve', 'revista': 'p9-duelo', 'pista': 'p9-pista'}
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


def silber(a, cx, cy, w, h):
    """Logo da Silber (losango de src/assets/brands.json) em w x h, centrado em (cx, cy)."""
    lg = np.array(Image.fromarray(logo_img('silber', 9)).resize((w, h), Image.NEAREST))
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
    out = np.zeros((h, w, 3), np.uint8)
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


def main():
    src, out = sys.argv[1], sys.argv[2]
    fn = {'floresta': floresta, 'neve': neve, 'revista': revista, 'pista': pista}
    lg = logo_img('silber', 9)
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
        n = 156
        q = im.quantize(n, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
        extra = cols if k == 'neve' else []
        pal = Image.new('P', (1, 1))
        pal.putpalette((q.getpalette()[:n * 3] + [v for c in extra for v in c] + [0] * 768)[:768])
        im = im.quantize(palette=pal, dither=Image.Dither.NONE)
        im.save(os.path.join(out, f'{name}.png'), optimize=True)
        print(name, os.path.getsize(os.path.join(out, f'{name}.png')))


if __name__ == '__main__':
    main()
