# limpa pontos claros do painel numa faixa estreita em volta da borda externa do aro (restos do contorno do volante antigo)
import sys, numpy as np, cv2
from PIL import Image
from wheel_reveal import CARS, D
from under_wheel_fix import interior
def disk(key):
    dash=np.array(Image.open(D+key+'-dash.png').convert('RGBA'))
    (px,py),wdx,wdy,wt=CARS[key]
    w=np.array(Image.open(D+key+'-wheel.png').convert('RGBA'))[...,3]>128
    H,W=dash.shape[:2]; big=np.zeros((H,W),bool); ox,oy=102+wdx,-wt+wdy
    for y in range(H):
        sy=y-oy
        if 0<=sy<w.shape[0]: big[y,ox:ox+w.shape[1]]=w[sy,:W-ox]
    return dash, interior(big)|big
write='--write' in sys.argv
for key in [a for a in sys.argv[1:] if a[0]!='-']:
    dash,dk=disk(key)
    u8=dk.astype(np.uint8)
    ring=(cv2.dilate(u8,np.ones((11,11),np.uint8))>0)&~(cv2.erode(u8,np.ones((5,5),np.uint8))>0)
    rgb=dash[...,:3]; lum=rgb.astype(int).mean(2)
    med=cv2.medianBlur(rgb,5)
    spots=ring&(dash[...,3]>128)&(lum>med.astype(int).mean(2)+28)
    out=dash.copy(); out[spots,:3]=med[spots]
    print(key,int(spots.sum()))
    if write: Image.fromarray(out).save(D+key+'-dash.png')
    x0=np.where(ring.any(0))[0]; 
    im=out[...,:3].copy(); im[out[...,3]<128]=(255,0,255); im[spots]=(0,255,0) if not write else im[spots]
    Image.fromarray(im).resize((im.shape[1]*2,im.shape[0]*2),Image.NEAREST).save(f'edge-{key}.png')
