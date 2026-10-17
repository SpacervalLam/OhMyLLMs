import ast,json
from pathlib import Path
from statistics import median
from collections import deque
from PIL import Image
root=Path(__file__).resolve().parents[1]
tree=ast.parse((root/'scripts/prepare-animation-manifest.py').read_text())
exec(compile(ast.Module(body=[n for n in tree.body if isinstance(n,ast.FunctionDef)],type_ignores=[]),'metadata-functions','exec'))
for name in ['sam','dario','elon']:
 folder=root/'dist/assets/animations/walk'
 if not (folder/f'{name}.png').exists(): continue
 image=Image.open(folder/f'{name}.png').convert('RGBA')
 alpha=image.getchannel('A');width,height=image.size
 mask=alpha.point(lambda v:255 if v>95 else 0)
 rows=cuts([sum(mask.crop((0,y,width,y+1)).histogram()[1:]) for y in range(height)],2)
 frames=[]
 for row in range(2):
  top,bottom=rows[row:row+2];band=mask.crop((0,top,width,bottom))
  columns=cuts([sum(band.crop((x,0,x+1,bottom-top)).histogram()[1:]) for x in range(width)],3)
  cells=[]
  for col in range(3):
   left,right=columns[col:col+2];x0,y0,x1,y1=character_box(alpha.crop((left,top,right,bottom)))
   cells.append(dict(x=left+x0,y=top+y0,w=x1-x0,h=y1-y0,anchorX=(right-left)/2-x0))
  frames.append(cells)
 layout=dict(width=width,height=height,columns=3,rows=2,frameCount=6,referenceHeight=median(f['h'] for r in frames for f in r),frames=frames)
 (folder/f'{name}.json').write_text(json.dumps(layout,indent=2)+'\n')
 print(name,rows,layout['referenceHeight'])

