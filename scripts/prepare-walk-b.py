"""Inspect six-frame CEO walk sheets; pixels remain unchanged."""
import ast
import json
from pathlib import Path
from statistics import median
from collections import deque
from PIL import Image

root = Path(__file__).resolve().parents[1]
source = (root / 'scripts/prepare-animation-manifest.py').read_text(encoding='utf-8')
tree = ast.parse(source)
helpers = ast.Module(body=[n for n in tree.body if isinstance(n, ast.FunctionDef)], type_ignores=[])
exec(compile(helpers, '<metadata-helpers>', 'exec'))
folder = root / 'dist/assets/animations/walk'
for name in ['jensen', 'mark', 'liang']:
    path = folder / f'{name}.png'
    if not path.exists():
        continue
    image = Image.open(path).convert('RGBA')
    alpha = image.getchannel('A')
    width, height = image.size
    mask = alpha.point(lambda value: 255 if value > 95 else 0)
    rows = cuts([sum(mask.crop((0, y, width, y + 1)).histogram()[1:]) for y in range(height)], 2)
    frames = []
    for row in range(2):
        top, bottom = rows[row:row + 2]
        band = mask.crop((0, top, width, bottom))
        columns = cuts([sum(band.crop((x, 0, x + 1, bottom - top)).histogram()[1:]) for x in range(width)], 3)
        cells = []
        for col in range(3):
            left, right = columns[col:col + 2]
            x0, y0, x1, y1 = character_box(alpha.crop((left, top, right, bottom)))
            # Track the drawn head center rather than the nominal grid center.
            # This measures existing pixels and does not edit source artwork.
            head_box = mask.crop((left + x0, top + y0, left + x1, top + y0 + round((y1 - y0) * .43))).getbbox()
            anchor_x = (head_box[0] + head_box[2]) / 2
            cells.append({'x': left + x0, 'y': top + y0, 'w': x1 - x0, 'h': y1 - y0, 'anchorX': anchor_x})
        frames.append(cells)
    metadata = {'width': width, 'height': height, 'columns': 3, 'rows': 2, 'frameCount': 6, 'referenceHeight': median(f['h'] for row in frames for f in row), 'frames': frames}
    path.with_suffix('.json').write_text(json.dumps(metadata, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(name, image.size, 'rows', rows, 'frames', frames)
