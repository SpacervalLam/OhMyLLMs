"""Inspect drawn frame positions and write metadata; never alter source pixels."""
import json
from collections import deque
from pathlib import Path
from statistics import median
from PIL import Image

ROOT=Path(__file__).resolve().parents[1]
FOLDER=ROOT/'dist'/'assets'/'animations'
IDS=['deepseek','chatgpt','claude','kimi','gemini','glm','grok','minimax','qwen','sam','dario','elon','jensen','mark','liang']

def cuts(profile,count):
    size=len(profile)
    step=size/count
    result=[0]
    for index in range(1,count):
        center=index*step
        start=max(result[-1]+15,round(center-step*.35))
        end=min(size-15,round(center+step*.35))
        def score(position):
            density=sum(profile[max(0,position-2):min(size,position+3)])/5
            return density+abs(position-center)*.035
        result.append(min(range(start,end+1),key=score))
    return result+[size]

def character_box(alpha):
    """Ignore detached fragments from adjacent drawings and tiny particles."""
    width,height=alpha.size
    data=bytearray(alpha.point(lambda value:255 if value>95 else 0).tobytes())
    components=[]
    for start in range(len(data)):
        if not data[start]:continue
        data[start]=0
        queue=deque([start])
        x0=x1=start%width;y0=y1=start//width;area=0
        while queue:
            p=queue.popleft();x=p%width;y=p//width;area+=1
            x0=min(x0,x);x1=max(x1,x);y0=min(y0,y);y1=max(y1,y)
            for other in ([p-1] if x else [])+([p+1] if x+1<width else [])+([p-width] if y else [])+([p+width] if y+1<height else []):
                if data[other]:data[other]=0;queue.append(other)
        components.append((area,(x0,y0,x1+1,y1+1)))
    if not components:raise ValueError('Empty sprite cell')
    largest=max(area for area,_ in components)
    boxes=[box for area,box in components if area>=largest*.06]
    return (max(0,min(b[0] for b in boxes)-2),max(0,min(b[1] for b in boxes)-2),
            min(width,max(b[2] for b in boxes)+2),min(height,max(b[3] for b in boxes)+2))

characters={}
for name in IDS:
    image=Image.open(FOLDER/f'{name}.png').convert('RGBA')
    alpha=image.getchannel('A');width,height=image.size
    mask=alpha.point(lambda v:255 if v>95 else 0)
    rows=cuts([sum(mask.crop((0,y,width,y+1)).histogram()[1:]) for y in range(height)],5)
    frames=[]
    for row in range(5):
        top,bottom=rows[row:row+2]
        band=mask.crop((0,top,width,bottom))
        columns=cuts([sum(band.crop((x,0,x+1,bottom-top)).histogram()[1:]) for x in range(width)],6)
        row_frames=[]
        for col in range(6):
            left,right=columns[col:col+2]
            box=character_box(alpha.crop((left,top,right,bottom)))
            x0,y0,x1,y1=box
            row_frames.append({'x':left+x0,'y':top+y0,'w':x1-x0,'h':y1-y0,
                               'anchorX':(right-left)/2-x0})
        frames.append(row_frames)
    reference_height=median(frame['h'] for frame in frames[0])
    characters[name]={'width':width,'height':height,'columns':6,'rows':5,'frameCount':30,
                      'referenceHeight':reference_height,'frames':frames}
    print(f'{name}: row boundaries {rows}, reference height {reference_height}')

manifest={'version':1,'description':'AI-assisted drawn animation frames; source images unchanged.',
          'states':['idle','special-or-walk','attack','hurt','defeat'],'characters':characters}
(FOLDER/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
