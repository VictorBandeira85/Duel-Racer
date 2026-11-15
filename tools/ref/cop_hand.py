"""Mão direita do policial segurando o papel da multa (arte do Victor, vista de frente, fundo magenta: a mão vem
da borda esquerda e segura a borda esquerda de uma folha branca em pé, polegar na frente do papel).
-> src/assets/people/hand-<classe>.png em pixel art (cor do miolo de cada bloco, sem borrar; magenta
transparente) + hand.json com, em pixels do PNG:
  paper = retângulo útil do papel (dentro da borda preta), onde o jogo escreve o auto de infração;
  thumb = caixa do polegar (a parte da mão NA FRENTE do papel), redesenhada por cima do texto.
A coluna 0 do PNG é a manga cortada na borda da arte: o jogo encosta ela na borda esquerda da tela.
O bloco sai da altura do papel: a folha (com a borda) fica com PH blocos de altura (padrão 93, cabe no
para-brisa); a grade começa no canto do papel para a borda preta cair inteira em blocos.
Uso: python3 tools/ref/cop_hand.py <arte.png> <classe> [PH]
  ex.: python3 tools/ref/cop_hand.py ~/uploads/e854b99e-image.png D
"""
import json
import os
import sys

import cv2
import numpy as np
from PIL import Image

OUT = os.path.join(os.path.dirname(__file__), '..', '..', 'src/assets/people')


def main():
    src, cls = sys.argv[1], sys.argv[2]
    PH = int(sys.argv[3]) if len(sys.argv) > 3 else 93
    a = np.array(Image.open(src).convert('RGB')).astype(int)
    H, W = a.shape[:2]
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    mag = (r > 150) & (b > 150) & (g < 120) & (np.abs(r - b) < 70)
    white = a.min(-1) > 225
    dark = a.max(-1) < 90
    # folha: o maior branco; a borda preta em volta dele (medida para fora em cada lado)
    n, lab, st, _ = cv2.connectedComponentsWithStats(white.astype(np.uint8), connectivity=4)
    i = 1 + int(np.argmax(st[1:, 4]))
    ix0, iy0, iw, ih = st[i, :4]
    ix1, iy1 = ix0 + iw, iy0 + ih
    cy, cx = (iy0 + iy1) // 2, (ix0 + ix1) // 2

    def run(line, start, step):
        # do miolo para fora: pula a franja clara (até 5 px), atravessa a borda escura e para no fim dela
        k = start
        for _ in range(5):
            if line[k]:
                break
            k += step
        while 0 <= k + step < len(line) and (line[k] or line[k + step]):
            k += step
        return k

    ox0 = run(dark[iy1 - 20], ix0 - 1, -1)  # lado esquerdo medido embaixo (o polegar fica no alto)
    ox1 = run(dark[cy], ix1, 1) + 1
    oy0 = run(dark[:, cx], iy0 - 1, -1)
    oy1 = run(dark[:, cx], iy1, 1) + 1
    blk = (oy1 - oy0) / PH
    PW = round((ox1 - ox0) / blk)
    bx = (ox1 - ox0) / PW  # largura do bloco (a folha fica com um número inteiro de blocos)
    # grade a partir do canto do papel, estendida até as bordas da arte
    k0 = -int(ox0 // bx)
    j0 = -int(oy0 // blk)
    nx = int((W - ox0) // bx) - k0
    ny = int((H - oy0) // blk) - j0
    o = np.zeros((ny, nx, 4), np.uint8)
    rr = max(1, int(blk * 0.18))
    for j in range(ny):
        for k in range(nx):
            yc = int(oy0 + (j + j0 + 0.5) * blk)
            xc = int(ox0 + (k + k0 + 0.5) * bx)
            sl = (slice(max(0, yc - rr), yc + rr + 1), slice(max(0, xc - rr), xc + rr + 1))
            keep = ~mag[sl]
            if keep.mean() < 0.5:
                continue
            p = a[sl][keep]
            o[j, k] = [*np.median(p, axis=0).astype(np.uint8), 255]
    # papel: borda preta reta e miolo branco liso, menos onde o polegar (e a sombra dele) passa por cima
    px0, py0 = -k0, -j0  # canto de fora do papel no PNG
    pc = o[py0:py0 + PH, px0:px0 + PW]
    rgb = pc[..., :3].astype(int)
    paperw = np.median(a[iy0 + 20:iy1 - 20, ix0 + 200:ix1 - 20].reshape(-1, 3), axis=0).astype(np.uint8)
    ink = np.median(a[dark][:4000], axis=0).astype(np.uint8) if dark.any() else np.array([0, 0, 0], np.uint8)
    # polegar: o que não é branco dentro do miolo da folha (terço esquerdo), contado na arte, bloco a bloco
    tsrc = np.zeros((H, W), bool)
    tsrc[iy0:iy1, ix0:ix0 + iw // 3] = a[iy0:iy1, ix0:ix0 + iw // 3].min(-1) < 215
    thumb = np.zeros((PH, PW), bool)
    for jj in range(1, PH - 1):
        for kk in range(1, PW // 3):
            ya, xa = int(oy0 + jj * blk), int(ox0 + kk * bx)
            thumb[jj, kk] = tsrc[ya:int(ya + blk), xa:int(xa + bx)].mean() > 0.25
    nt, lt, stt, _ = cv2.connectedComponentsWithStats(thumb.astype(np.uint8), connectivity=8)
    big = [q for q in range(1, nt) if stt[q, 4] >= 6]
    thumb = np.isin(lt, big)
    ty, tx = np.nonzero(thumb)
    ty0, ty1, tx1 = int(ty.min()), int(ty.max()) + 1, int(tx.max()) + 1
    # a borda esquerda embaixo do polegar também é do polegar (contorno dele)
    edge = np.zeros_like(thumb)
    edge[ty0:ty1, 0] = True
    for jj in range(PH):
        for kk in range(PW):
            if thumb[jj, kk] or (edge[jj, kk]):
                continue
            onb = jj == 0 or kk == 0 or jj == PH - 1 or kk == PW - 1
            pc[jj, kk] = [*(ink if onb else paperw), 255]
    o[py0:py0 + PH, px0:px0 + PW] = pc
    o = o[py0:py0 + PH, :px0 + PW]  # só até a folha (a mão fica dentro da altura dela)
    ny, nx = o.shape[:2]
    py0 = 0
    Image.fromarray(o).save(os.path.join(OUT, f'hand-{cls}.png'), optimize=True)
    jp = os.path.join(OUT, 'hand.json')
    meta = json.load(open(jp)) if os.path.exists(jp) else {}
    meta[cls] = {
        'w': nx, 'h': ny,
        'paper': [px0 + 1, py0 + 1, px0 + PW - 1, py0 + PH - 1],
        'thumb': [px0, py0 + ty0, px0 + tx1, py0 + ty1],
    }
    json.dump(meta, open(jp, 'w'), indent=1)
    print(cls, f'bloco {blk:.2f}x{bx:.2f}', meta[cls])


if __name__ == '__main__':
    main()
