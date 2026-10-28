"""Inspect generated sprite sheets; this script never modifies images."""
import hashlib
import json
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
IDS = ['deepseek','chatgpt','claude','kimi','gemini','glm','grok','minimax','qwen',
       'sam','dario','elon','jensen','mark','liang','runner','medic','bulwark','banner','ipo','overlord','doubao','mimo','pony','jack','pony_super','qq_raider','trump','military_claude','elon_super','starlink_drone','grok_projection']
report = []
errors = []
manifest_path=ROOT/'dist'/'assets'/'animations'/'manifest.json'
manifest=json.loads(manifest_path.read_text(encoding='utf-8')) if manifest_path.exists() else {'characters':{}}
enemy_manifest_path=manifest_path.with_name('enemies-v1.json')
if enemy_manifest_path.exists():
    manifest['characters'].update(json.loads(enemy_manifest_path.read_text(encoding='utf-8'))['characters'])
for name in IDS:
    path = ROOT / 'dist' / 'assets' / 'animations' / f'{name}.webp'
    if not path.exists():
        errors.append(f'{name}: missing sheet')
        continue
    image = Image.open(path).convert('RGBA')
    width,height=image.size
    alpha=image.getchannel('A')
    if alpha.getextrema()[0] != 0:
        errors.append(f'{name}: no transparent pixels')
    counts=[]
    layout=manifest['characters'].get(name)
    if not layout:
        errors.append(f'{name}: missing calibrated frame metadata')
    for row in range(5):
        hashes=set()
        for col in range(6):
            if layout:
                frame=layout['frames'][row][col]
                box=(frame['x'],frame['y'],frame['x']+frame['w'],frame['y']+frame['h'])
                if min(box)<0 or box[2]>width or box[3]>height:
                    errors.append(f'{name}: out-of-range frame {row}/{col}')
            else:
                box=(round(width*col/6),round(height*row/5),round(width*(col+1)/6),round(height*(row+1)/5))
            cell=image.crop(box)
            # Normalize size only in memory for an inspection hash, never save.
            hashes.add(hashlib.sha256(cell.resize((128,128)).tobytes()).hexdigest())
            area=cell.getchannel('A').point(lambda a: 255 if a > 50 else 0).getbbox()
            if not area:
                errors.append(f'{name}: empty frame row {row}, column {col}')
        counts.append(len(hashes))
        if len(hashes)<6:
            errors.append(f'{name}: duplicated frames in row {row}')
    transparent=sum(alpha.histogram()[:32])/(width*height)
    if transparent<.15:errors.append(f'{name}: insufficient background transparency')
    report.append({'id':name,'file':f'assets/animations/{name}.webp','width':width,'height':height,'transparent_fraction':round(transparent,3),
                   'columns':6,'rows':5,'frames':30,'distinct_frames_per_row':counts})
print(json.dumps({'characters':len(report),'total_frames':len(report)*30,'sheets':report,'errors':errors},ensure_ascii=False,indent=2))
raise SystemExit(1 if errors else 0)
