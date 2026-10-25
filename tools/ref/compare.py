"""Compara um quadro do jogo com a referência medida, ambos em 256x224.

Gera: lado a lado, sobreposição (50%) e mapa de diferenças, ampliados com grade.
Imprime a diferença média por região (teto, para-brisa, painel).

Uso: python3 tools/ref/compare.py <referencia-native.png> <jogo-native.png> <saida.png>
"""
import sys

import numpy as np
from PIL import Image

from measure import zoom_with_grid

REGIONS = {'teto (0-23)': (0, 24), 'para-brisa (24-119)': (24, 120), 'painel (120-223)': (120, 224)}


def main():
    ref = np.array(Image.open(sys.argv[1]).convert('RGB')).astype(int)
    game = np.array(Image.open(sys.argv[2]).convert('RGB').resize((256, 224), Image.NEAREST)).astype(int)
    diff = np.abs(ref - game).sum(axis=2)
    heat = np.zeros_like(ref)
    heat[..., 0] = np.clip(diff, 0, 255)
    heat[..., 1] = np.clip(255 - diff, 0, 255) // 3
    blend = (ref + game) // 2
    tiles = [zoom_with_grid(a.astype(np.uint8), 3) for a in (ref, game, blend, heat)]
    tw, th = tiles[0].size
    out = Image.new('RGB', (tw * 2, th * 2))
    for i, t in enumerate(tiles):
        out.paste(t, ((i % 2) * tw, (i // 2) * th))
    out.save(sys.argv[3])
    for name, (y0, y1) in REGIONS.items():
        print(f'{name:22s} diferença média: {diff[y0:y1].mean():6.1f}')
    print(f'{"total":22s} diferença média: {diff.mean():6.1f}')


if __name__ == '__main__':
    main()
