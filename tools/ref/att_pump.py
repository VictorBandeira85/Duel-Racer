"""Frentistas parados abastecendo (folhas do Victor: 2 quadros lado a lado sobre magenta, de lado para a
esquerda, os dois pés no chão, bico da bomba na mão e a mangueira saindo para trás; o 2º quadro é a
respiração) -> src/assets/people/att-<id>-pump0.png e pump1.png.
Mesma escala dos quadros de caminhada/aceno (att_walk.py): a figura parada fica com a altura do aceno
(wave0) vezes LEAN (a cabeça vai um pouco para a frente, olhando o bocal); cada bloco vira a cor do miolo
(sem borrar), pés na última linha, espelhado para olhar para a direita como os outros quadros (o jogo
espelha de volta). Acrescenta ao atts.json [largura, altura, x do meio dos pés, x, y do bico, x, y da ponta
da mangueira] (a mangueira da bomba emenda nessa ponta; o bico encosta no bocal do carro).
Uso: python3 tools/ref/att_pump.py <pasta com pumpCity.png ... pumpSnow.png> [saída=src/assets/people]
"""
import json
import os
import sys

import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(__file__))
from att_walk import IDS, magenta, to_native  # noqa: E402

LEAN = 0.965  # altura parada abastecendo / altura acenando (corpo um pouco inclinado para o carro)


def main():
    src = sys.argv[1]
    out = sys.argv[2] if len(sys.argv) > 2 else os.path.join(os.path.dirname(__file__), '..', '..', 'src/assets/people')
    mp = os.path.join(out, 'atts.json')
    meta = json.load(open(mp))
    for cid in IDS:
        a = np.array(Image.open(os.path.join(src, f'pump{cid}.png')).convert('RGB')).astype(int)
        mag = magenta(a)
        # dois quadros: o vão sem desenho mais largo perto do meio da folha
        cols = (~mag).sum(0) > 1
        W = a.shape[1]
        best, s = None, None
        for x, v in enumerate(list(cols) + [True]):
            if not v and s is None:
                s = x
            if v and s is not None:
                if s > W * 0.25 and x < W * 0.75 and (best is None or x - s > best[1] - best[0]):
                    best = (s, x)
                s = None
        cut = (best[0] + best[1]) // 2
        segs = []
        for x0, x1 in ((0, cut), (cut, W)):
            xs = np.where(cols[x0:x1])[0]
            segs.append((x0 + xs.min(), x0 + xs.max() + 1))
        tgt = meta[f'{cid}-wave0'][1] * LEAN
        boxes = []
        for x0, x1 in segs:
            ys = np.where((~mag[:, x0:x1]).sum(1) > 1)[0]
            boxes.append((ys.min(), ys.max() + 1))
        P = (boxes[0][1] - boxes[0][0]) / tgt  # o mesmo bloco nos dois quadros
        for k, ((x0, x1), (y0, y1)) in enumerate(zip(segs, boxes)):
            o = to_native(a[:, x0:x1], mag[:, x0:x1], P, y0, y1)
            o = o[:, ::-1].copy()  # olha para a direita, como os outros quadros
            op = o[..., 3] > 0
            H = o.shape[0]
            hb = max(2, int(H * 0.06))
            fx = np.where(op[-hb:].any(0))[0]
            foot = float((fx.min() + fx.max() + 1) / 2)
            # bico: coluna mais à direita na faixa das mãos; ponta da mangueira: coluna mais à esquerda
            # na faixa da cintura (a mangueira corta reta na borda da folha)
            r0, r1 = int(H * 0.3), int(H * 0.68)
            nx = int(np.where(op[r0:r1].any(0))[0].max())
            ny = r0 + float(np.where(op[r0:r1, nx])[0].mean())
            hx = int(np.where(op[r0:r1].any(0))[0].min())
            hy = r0 + float(np.where(op[r0:r1, hx])[0].mean())
            row = [int(o.shape[1]), int(H), round(foot, 1), nx + 0.5, round(ny, 1), hx + 0.5, round(hy, 1)]
            Image.fromarray(o).save(os.path.join(out, f'att-{cid}-pump{k}.png'), optimize=True)
            meta[f'{cid}-pump{k}'] = row
            print(cid, f'pump{k}', row, 'bloco', round(P, 2))
    with open(mp, 'w') as f:
        json.dump(meta, f, indent=0)


if __name__ == '__main__':
    main()
