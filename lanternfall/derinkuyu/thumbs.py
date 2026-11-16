from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageEnhance
import numpy as np
W,H=1280,720
def F(n,s,w=None):
    f=ImageFont.truetype(f"../fonts/{n}",s)
    if w:
        ax=f.get_variation_axes(); f.set_variation_by_axes([w] if len(ax)==1 else [14,w])
    return f
def base(p,focus=(0.5,0.5),bright=1.25):
    im=Image.open(p).convert("RGB"); w,h=im.size; s=max(W/w,H/h)
    im=im.resize((int(w*s)+1,int(h*s)+1),Image.LANCZOS); w,h=im.size
    x=int((w-W)*focus[0]); y=int((h-H)*focus[1]); im=im.crop((x,y,x+W,y+H))
    im=ImageEnhance.Brightness(im).enhance(bright); im=ImageEnhance.Contrast(im).enhance(1.25); im=ImageEnhance.Color(im).enhance(1.15)
    a=np.asarray(im,np.float32); yy,xx=np.ogrid[:H,:W]
    r=np.sqrt(((xx-W/2)/(W/2))**2+((yy-H/2)/(H/2))**2); a*=(1-0.5*np.clip(r-0.5,0,1))[...,None]
    return Image.fromarray(np.clip(a,0,255).astype(np.uint8))
def stroke_text(im,xy,t,f,fill,anchor="la",sw=8):
    d=ImageDraw.Draw(im); 
    sh=Image.new("RGBA",im.size,(0,0,0,0)); ds=ImageDraw.Draw(sh)
    ds.text((xy[0]+6,xy[1]+8),t,font=f,fill=(0,0,0,200),anchor=anchor); sh=sh.filter(ImageFilter.GaussianBlur(10)); im.paste(sh,(0,0),sh)
    d.text(xy,t,font=f,fill=fill,anchor=anchor,stroke_width=sw,stroke_fill=(10,8,6))
AMB=(255,178,72); WH=(255,255,255)
# A: stone door
a=base("real/p29.jpg",(0.6,0.5),1.45)
stroke_text(a,(60,70),"20,000 PEOPLE",F("Inter.ttf",104,900),WH)
stroke_text(a,(60,185),"HID DOWN HERE",F("Inter.ttf",104,900),AMB)
d=ImageDraw.Draw(a); d.rounded_rectangle([60,600,330,680],radius=14,fill=AMB); d.text((195,640),"85 m DEEP",font=F("Inter.ttf",44,800),fill=(20,14,8),anchor="mm")
a.save("thumbs/kapak_A.jpg",quality=92)
# B: shaft looking down
b=base("real/p44.jpg",(0.5,0.45),1.2)
stroke_text(b,(W/2,90),"A CITY UNDER",F("Inter.ttf",110,900),WH,"mm")
stroke_text(b,(W/2,210),"A CITY",F("Inter.ttf",130,900),AMB,"mm")
stroke_text(b,(W/2,650),"DERINKUYU · TÜRKİYE",F("Inter.ttf",40,700),WH,"mm",5)
b.save("thumbs/kapak_B.jpg",quality=92)
# C: stairs down + 1963
c=base("real/p40.jpg",(0.5,0.4),1.3)
stroke_text(c,(50,60),"FOUND BEHIND",F("Inter.ttf",96,900),WH)
stroke_text(c,(50,165),"A BASEMENT WALL",F("Inter.ttf",96,900),AMB)
d=ImageDraw.Draw(c); d.rounded_rectangle([50,600,280,680],radius=14,fill=AMB); d.text((165,640),"1963",font=F("Inter.ttf",52,900),fill=(20,14,8),anchor="mm")
c.save("thumbs/kapak_C.jpg",quality=92)
s=Image.new("RGB",(W,H*3)); [s.paste(Image.open(f"thumbs/kapak_{k}.jpg"),(0,i*H)) for i,k in enumerate("ABC")]; s.resize((640,1080)).save("test/thumbs.jpg")
