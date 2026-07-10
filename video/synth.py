from pathlib import Path
import math, random, wave
from array import array

RATE=48000
DURATION=50
random.seed(19)
out=Path(__file__).resolve().parents[1]/'public/video/soundtrack.wav'
out.parent.mkdir(parents=True,exist_ok=True)
buf=array('h')

def env(t,start,end,attack=.15,release=.5):
    if t<start or t>end:return 0
    return min(1,(t-start)/attack,(end-t)/release)

for n in range(RATE*DURATION):
    t=n/RATE
    pulse=(math.sin(2*math.pi*55*t)+.42*math.sin(2*math.pi*110*t))*0.055*env(t,10,48,2,2)
    pad=sum(math.sin(2*math.pi*f*t+p) for f,p in [(73.42,0),(110,.7),(146.83,1.4)])/3*0.07*env(t,14,50,4,2)
    tick=0
    beat=t%0.5
    if t>10 and beat<.025:
        tick=(random.random()*2-1)*math.exp(-beat*180)*0.12
    cut=sum(math.sin(2*math.pi*880*(t-s))*math.exp(-(t-s)*35) for s in [10,16,24,32,40,47] if 0<=t-s<.3)*0.035
    air=(random.random()*2-1)*0.006
    sample=max(-1,min(1,pulse+pad+tick+cut+air))
    buf.append(int(sample*32767))

with wave.open(str(out),'wb') as w:
    w.setnchannels(1);w.setsampwidth(2);w.setframerate(RATE);w.writeframes(buf.tobytes())
print(out)
