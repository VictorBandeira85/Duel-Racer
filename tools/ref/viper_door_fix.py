"""Serpe V10: a faixa à esquerda da arte (colunas 0..37 do topo+painel empilhados) tinha a porta e o
pé do retrovisor ESPELHADOS (um "V" simétrico com um losango branco no meio). Refaz:
- retrovisor: a moldura continua inteira; a metade de baixo do lado de fora passa a ser o canto de
  cima refletido na vertical (sem o segundo pé); o pé de verdade (lado de dentro, da arte) fica
- o losango branco sob o pé era o lado de fora visto entre o pé e a porta: vira vidro
- porta: construída até a borda, continuando cada linha da arte (friso, gomos, contorno) na própria
  inclinação: desce em direção à borda, forte junto da arte e suavizando (curva medida nos gomos)
Uso: python3 tools/ref/viper_door_fix.py   (parte dos PNG atuais; rodar uma vez)"""
import os
import numpy as np
from PIL import Image

COCK = os.path.join(os.path.dirname(__file__), '..', '..', 'src/assets/cockpit')
AX = 38          # primeira coluna de arte de verdade
YC2 = 189        # 2 x a linha do meio da moldura (94,5)
DOOR = 135       # linha onde a porta começa na coluna AX (abaixo do losango)

tp, dp = os.path.join(COCK, 'viper-top.png'), os.path.join(COCK, 'viper-dash.png')
t, d = np.array(Image.open(tp).convert('RGBA')), np.array(Image.open(dp).convert('RGBA'))
st = np.concatenate([t, d], axis=0)
H = st.shape[0]
src = st.copy()

# losango branco (vão entre o pé e a porta) -> vidro
for y in range(120, 138):
    for x in range(AX, 48):
        r, g, b, a = src[y, x]
        if a and min(r, g, b) > 185:
            st[y, x] = (0, 0, 0, 0)
src = st.copy()

# lado de fora (colunas < AX)
st[66:, :AX] = (0, 0, 0, 0)
st[66:95, :AX] = src[66:95, :AX]                    # metade de cima da moldura: como estava
for y in range(95, 124):                            # metade de baixo: o canto de cima refletido
    st[y, :AX] = src[YC2 - y, :AX]

# porta: cada linha segue para a borda descendo (inclinação 1 junto da arte, suavizando até ~22 linhas)
col = src[:, AX:AX + 2, :3].astype(np.float32).mean(axis=1)
alpha = src[:, AX, 3].copy()
alpha[:DOOR] = 0
rgb = src[..., :3].astype(np.float32)
for X in range(AX):
    dist = AX - X
    off = 22.0 * (1 - np.exp(-dist / 22.0))
    for y in range(DOOR, H):
        yb = int(round(y - off))
        if yb < DOOR or not alpha[yb]:
            continue
        c = col[yb]
        if (X + y) % 2 == 0:                        # pontilhado leve para não ficar chapado
            c = c + (rgb[yb, AX + 1] - c) * 0.35
        st[y, X, :3] = np.clip(c, 0, 255).astype(np.uint8)
        st[y, X, 3] = 255

Image.fromarray(st[:t.shape[0]], 'RGBA').save(tp, optimize=True)
Image.fromarray(st[t.shape[0]:], 'RGBA').save(dp, optimize=True)
print('ok')
# (depois: um furo de 1 px em x=47..48, y=137..138 do topo+painel foi fechado à mão com a cor de baixo)
