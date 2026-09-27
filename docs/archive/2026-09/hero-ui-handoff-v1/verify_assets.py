"""Read-only checks for the UI handoff. Does not generate or edit any images."""
from pathlib import Path
import hashlib
import json
from PIL import Image

ROOT = Path(__file__).resolve().parent
manifest = json.loads((ROOT / 'assets-manifest.json').read_text())
assert manifest['coordinateSystem'] == 'top-left pixels'
assert manifest['rotated'] is False and manifest['trimmed'] is False
images = {}
for key, spec in manifest['textures'].items():
    path = ROOT / spec['file']
    assert hashlib.sha256(path.read_bytes()).hexdigest() == spec['sha256'], key
    im = Image.open(path)
    assert im.size == (spec['width'], spec['height']), key
    assert ('A' in im.getbands()) == spec['hasAlpha'], key
    if spec['hasAlpha']:
        assert im.getchannel('A').getextrema()[0] == 0, key
        assert im.getchannel('A').getextrema()[1] >= 240, key
    images[key] = im
for key, sprite in manifest['sprites'].items():
    im = images[sprite['texture']]
    x, y, w, h = (sprite['rect'][k] for k in ('x', 'y', 'w', 'h'))
    assert 0 <= x < x + w <= im.width, key
    assert 0 <= y < y + h <= im.height, key
    assert sprite['pivot'] == [0.5, 0.5] and sprite['slicing'] == 'simple', key
    if key.startswith('frame_'):
        assert im.getpixel((x + w // 2, y + h // 2))[3] <= 8, key
items = list(manifest['sprites'].items())
for i, (left_id, left) in enumerate(items):
    for right_id, right in items[i + 1:]:
        if left['texture'] != right['texture']:
            continue
        a, b = left['rect'], right['rect']
        overlap = (max(a['x'], b['x']) < min(a['x'] + a['w'], b['x'] + b['w']) and
                   max(a['y'], b['y']) < min(a['y'] + a['h'], b['y'] + b['h']))
        assert not overlap, (left_id, right_id)
assert len(images) == 5 and len(items) == 35
print('PASS: 5 texture hashes/dimensions/alpha; 35 sprite bounds and non-overlap; 4 near-transparent frame centers (alpha <= 8).')
