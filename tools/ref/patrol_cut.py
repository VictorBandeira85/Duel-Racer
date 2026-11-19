import numpy as np, cv2
from PIL import Image
Z='/tmp/claude-0/-home-user/70550d6c-f02a-5bf5-8dc5-08a6ba2cd137/scratchpad/c9/'
BOX={'side':(38,232,1636,768),'rear':(385,148,1295,862),'front':(388,140,1296,864)}
def cut(k):
    a=np.array(Image.open(Z+k+'.png').convert('RGB'))
    ai=a.astype(int); r,g,b=ai[...,0],ai[...,1],ai[...,2]
    x0,y0,x1,y1=BOX[k]
    m=np.full(a.shape[:2],cv2.GC_BGD,np.uint8)
    m[y0:y1,x0:x1]=cv2.GC_PR_FGD
    green=(g>r+10)&(g>b-10)&(g>60)
    sand=(r>g+10)&(g>b+20)&(r>150)   # acostamento
    m[(green|sand)&(m==cv2.GC_PR_FGD)]=cv2.GC_BGD
    if k!='side':   # serras azuis dos lados do teto
        yy,xx=np.mgrid[0:a.shape[0],0:a.shape[1]]
        hill=(b>r+25)&(yy<345)&((xx<560)|(xx>1115))&~((yy<235)&(xx>575)&(xx<1100))
        m[hill]=cv2.GC_BGD
        m[(yy>318)&(yy<400)&((xx<445)|(xx>1225))]=cv2.GC_BGD   # trilho do guard-rail
        m[(yy>460)&(yy<505)&((xx<398)|(xx>1272))]=cv2.GC_BGD
    if k=='front':
        yy,xx=np.mgrid[0:a.shape[0],0:a.shape[1]]
        for cx in (481,1192):
            m[np.hypot(xx-cx,yy-322)<=30]=cv2.GC_FGD   # holofotes cromados
    bg=np.zeros((1,65),np.float64); fg=np.zeros((1,65),np.float64)
    cv2.grabCut(cv2.cvtColor(a,cv2.COLOR_RGB2BGR),m,None,bg,fg,8,cv2.GC_INIT_WITH_MASK)
    car=((m==1)|(m==3)).astype(np.uint8)
    car=cv2.morphologyEx(car,cv2.MORPH_OPEN,np.ones((5,5),np.uint8))
    n,lab,st,_=cv2.connectedComponentsWithStats(car,8)
    car=lab==(1+int(np.argmax(st[1:,4])))
    n,lab=cv2.connectedComponents((~car).astype(np.uint8),connectivity=4)
    car|=lab!=lab[0,0]
    # sombra do chão: abaixo da linha dos pneus só ficam os pneus
    ylim,tires={'side':(745,[(268,482),(1158,1372)]),'rear':(815,[(408,552),(1118,1262)]),'front':(800,[(398,542),(1128,1272)])}[k]
    keep=np.zeros(car.shape,bool); keep[:ylim]=True
    for t0,t1 in tires: keep[:,t0:t1]=True
    car&=keep
    return a,car
if __name__=='__main__':
    out=[]
    for k in ('side','rear','front'):
        a,car=cut(k); np.save(Z+'dbg/car-'+k+'.npy',car); v=a.copy(); v[~car]=(0,255,0); out.append(Image.fromarray(v).resize((836,470)))
    s=Image.new('RGB',(836,1410));[s.paste(im,(0,i*470)) for i,im in enumerate(out)];s.save(Z+'dbg/fl.png')
