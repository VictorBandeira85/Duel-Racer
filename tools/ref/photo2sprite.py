"""Converte a foto de um carro em sprite de pixel art com fundo transparente.

Passos: recorte -> segmentação do carro (GrabCut) -> limpeza da máscara ->
redução para a largura do sprite -> paleta limitada (estilo 16 bits) -> PNG RGBA.

Uso: python3 tools/ref/photo2sprite.py <foto> <saida.png> <largura> x0 y0 x1 y1 [cores] [margem] [modo]
  x0..y1: recorte em fração (0-1) da foto, com o carro inteiro dentro
  margem: folga (fração) entre a borda do recorte e o retângulo inicial do GrabCut
  modo: "grabcut" (padrão, fundos com textura) ou "liso" (fundo claro e neutro: o que tem
        cor ou é escuro é carro, preenchido coluna a coluna; bom para perfis)

ATENÇÃO: sprites gerados de fotos de terceiros são só para o projeto privado;
precisam ser substituídos antes de qualquer publicação.
"""
import sys

import cv2
import numpy as np
from PIL import Image


def segment(img: np.ndarray, margin: float) -> np.ndarray:
    h, w = img.shape[:2]
    mask = np.zeros((h, w), np.uint8)
    mx, my = int(w * margin), int(h * margin)
    rect = (mx, my, w - 2 * mx, h - 2 * my)
    bgd, fgd = np.zeros((1, 65), np.float64), np.zeros((1, 65), np.float64)
    cv2.grabCut(img, mask, rect, bgd, fgd, 8, cv2.GC_INIT_WITH_RECT)
    fg = ((mask == cv2.GC_FGD) | (mask == cv2.GC_PR_FGD)).astype(np.uint8)
    # maior componente conectado
    n, lab, stats, _ = cv2.connectedComponentsWithStats(fg, 8)
    if n > 1:
        big = 1 + int(np.argmax(stats[1:, cv2.CC_STAT_AREA]))
        fg = (lab == big).astype(np.uint8)
    # fecha pequenas falhas e preenche buracos internos
    fg = cv2.morphologyEx(fg, cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8))
    flood = fg.copy() * 255
    ff = np.zeros((h + 2, w + 2), np.uint8)
    cv2.floodFill(flood, ff, (0, 0), 255)
    holes = cv2.bitwise_not(flood)
    return np.clip(fg + (holes > 0), 0, 1).astype(np.uint8)


def segment_plain(img: np.ndarray) -> np.ndarray:
    """Fundo liso: distância da cor mediana da borda + preenchimento por coluna."""
    # fundo claro e neutro: o carro é o que tem cor (lataria) ou é escuro (pneus,
    # vidros); as rodas metálicas entram pelo preenchimento entre lataria e pneu
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
    fg = ((hsv[..., 1] > 70) | (hsv[..., 2] < 90)).astype(np.uint8)
    fg = cv2.morphologyEx(fg, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
    n, lab, stats, _ = cv2.connectedComponentsWithStats(fg, 8)
    if n > 1:
        big = 1 + int(np.argmax(stats[1:, cv2.CC_STAT_AREA]))
        fg = (lab == big).astype(np.uint8)
    out = np.zeros_like(fg)
    for x in range(fg.shape[1]):
        ys = np.where(fg[:, x])[0]
        if len(ys) > 2:
            out[ys[0]:ys[-1] + 1, x] = 1
    return out


def main():
    src, out, width = sys.argv[1], sys.argv[2], int(sys.argv[3])
    x0, y0, x1, y1 = map(float, sys.argv[4:8])
    colors = int(sys.argv[8]) if len(sys.argv) > 8 else 32
    margin = float(sys.argv[9]) if len(sys.argv) > 9 else 0.01
    mode = sys.argv[10] if len(sys.argv) > 10 else 'grabcut'
    img = cv2.imread(src)
    H, W = img.shape[:2]
    img = img[int(y0 * H):int(y1 * H), int(x0 * W):int(x1 * W)]
    fg = segment_plain(img) if mode == 'liso' else segment(img, margin)
    ys, xs = np.where(fg > 0)
    img = img[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    fg = fg[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    h = round(img.shape[0] * width / img.shape[1])
    small = cv2.resize(img, (width, h), interpolation=cv2.INTER_AREA)
    alpha = cv2.resize(fg.astype(np.float32), (width, h), interpolation=cv2.INTER_AREA) >= 0.5
    rgb = Image.fromarray(cv2.cvtColor(small, cv2.COLOR_BGR2RGB))
    q = rgb.quantize(colors=colors, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.FLOYDSTEINBERG).convert('RGB')
    rgba = np.dstack([np.array(q), (alpha * 255).astype(np.uint8)])
    Image.fromarray(rgba, 'RGBA').save(out)
    # prévia ampliada sobre fundo roxo (como a tela do jogo)
    prev = Image.new('RGBA', (width, h), (78, 66, 144, 255))
    prev.alpha_composite(Image.fromarray(rgba, 'RGBA'))
    prev.resize((width * 3, h * 3), Image.NEAREST).save(out.replace('.png', '-preview.png'))
    print(out, (width, h), 'cobertura da máscara: %.0f%%' % (100 * alpha.mean()))


if __name__ == '__main__':
    main()
