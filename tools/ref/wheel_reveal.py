# mostra o que o volante descobre no painel ao girar (área revelada), com grade de coordenadas do PNG
import sys, numpy as np, cv2
from PIL import Image, ImageDraw
D='/home/user/duel-racer/src/assets/cockpit/'
OUT='/tmp/claude-0/-home-user/70550d6c-f02a-5bf5-8dc5-08a6ba2cd137/scratchpad/wc/'
CARS={ # key: pivot, wheelDx, wheelDy, wheelTop
 'f40':((127.4,80),0,0,0),'959':((128.2,84.3),0,0,0),'patrol':((128.2,103.1),0,0,5),'diablo':((128,103),10,0,7),
 'br-vectra':((128,103.6),0,0,0),'br-golgti':((128,99.9),0,20,28),'br-pumagtb':((127,128.3),0,0,0),'br-pumagte':((127.9,113),0,0,0),
 'br-kadett':((127.9,105.7),0,0,0),'br-uno':((129,104.2),0,0,0),'br-corsa':((127.9,104.1),0,0,0),'br-passat':((128.1,103.8),10,0,0),'zr1':((128,86),0,0,0)}
K=8/7
def masks(key):
  (px,py),wdx,wdy,wt=CARS[key]
  w=np.array(Image.open(D+key+'-wheel.png').convert('RGBA'))
  dash=np.array(Image.open(D+key+'-dash.png').convert('RGBA'))
  H,W=dash.shape[:2]
  al=(w[...,3]>128).astype(np.uint8)*255
  # wheel origin in dash coords
  ox,oy=102+wdx, -wt+wdy
  cx,cy=102+wdx+px, py+wdy
  big=np.zeros((H,W),np.uint8)
  hh,ww=al.shape
  y0,x0=int(oy),int(ox)
  ys=slice(max(0,y0),min(H,y0+hh)); xs=slice(max(0,x0),min(W,x0+ww))
  big[ys,xs]=al[ys.start-y0:ys.stop-y0, xs.start-x0:xs.stop-x0]
  uni=np.zeros_like(big); inter=np.full_like(big,255)
  for ang in np.linspace(-1.1,1.1,45):
    c,s=np.cos(ang),np.sin(ang)
    # screen coords: x*K. map dst->src: inverse rotation
    M=np.array([[c, -s*K, 0],[s/K, c, 0]],np.float64)  # src = R^-1 applied in scaled space
    # build affine for dst->src: p_src = S^-1 R(-a) S (p_dst - C) + C
    S=np.diag([K,1]); Si=np.diag([1/K,1]); R=np.array([[c,s],[-s,c]])
    A=Si@R@S; b=np.array([cx,cy])-A@np.array([cx,cy])
    Mf=np.hstack([A,b[:,None]])
    r=cv2.warpAffine(big,Mf,(W,H),flags=cv2.INTER_NEAREST|cv2.WARP_INVERSE_MAP)
    uni=np.maximum(uni,r); inter=np.minimum(inter,r)
  return dash,(uni>0)&~(inter>0),uni>0
if __name__=='__main__':
  for key in sys.argv[1:]:
    dash,rev,uni=masks(key)
    ys,xs=np.where(uni)
    x0,x1,y0,y1=max(0,xs.min()-4),min(dash.shape[1],xs.max()+5),0,dash.shape[0]
    rgb=dash[...,:3].copy(); a=dash[...,3]
    rgb[a<128]=(255,0,255)
    im=rgb.copy(); im[~rev]=(im[~rev]*0.35).astype(np.uint8)
    S=4
    crop=Image.fromarray(im[y0:y1,x0:x1]).resize(((x1-x0)*S,(y1-y0)*S),Image.NEAREST)
    d=ImageDraw.Draw(crop)
    for x in range((x0//10+1)*10,x1,10):
      d.line([((x-x0)*S,0),((x-x0)*S,6)],fill=(0,255,0)); d.text(((x-x0)*S+1,0),str(x),fill=(0,255,0))
    for y in range(10,y1,10):
      d.line([(0,y*S),(6,y*S)],fill=(0,255,0)); d.text((1,y*S+1),str(y),fill=(0,255,0))
    crop.save(OUT+f'rev-{key}.png'); print(key, crop.size)
