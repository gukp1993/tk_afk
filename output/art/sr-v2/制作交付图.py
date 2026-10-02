"""按用户指定模板加工SR立绘；保留源图，不改现有游戏资源。"""
import json
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent
JOBS = json.loads((ROOT / '生成任务.json').read_text())['jobs']
OUT = ROOT / '600x800'
OUT.mkdir(exist_ok=True)
report = []
thumbs = []
for job in JOBS:
    source = ROOT / '源图' / (job['id'] + '.png')
    if not source.exists():
        continue
    im = Image.open(source).convert('RGBA')
    alpha = im.getchannel('A')
    assert alpha.getextrema()[0] == 0, f'{source}: 无透明像素'
    bbox = alpha.getbbox()
    assert bbox, f'{source}: 空白图'
    subject = im.crop(bbox)
    # 以实际alpha主体校正8%安全边，避免生图输出贴边；不裁角色。
    ratio = min(504 / subject.width, 672 / subject.height)
    subject = subject.resize((max(1, round(subject.width * ratio)),
                              max(1, round(subject.height * ratio))), Image.Resampling.LANCZOS)
    canvas = Image.new('RGBA', (600, 800))
    canvas.alpha_composite(subject, ((600 - subject.width) // 2, (800 - subject.height) // 2))
    target = OUT / (job['id'] + '.png')
    canvas.quantize(colors=256, method=Image.Quantize.FASTOCTREE).save(target, optimize=True)
    report.append({'id': job['id'], '姓名': job['name'], '源尺寸': list(im.size),
                   '交付尺寸': [600, 800], 'alpha范围': list(alpha.getextrema()),
                   '安全边主体范围': list(canvas.getchannel('A').getbbox()),
                   '256色字节': target.stat().st_size, '符合25KB': target.stat().st_size <= 25600})
    card = Image.new('RGB', (240, 350), '#e2d5ac')
    thumb = Image.open(target).convert('RGBA').resize((208, 277), Image.Resampling.LANCZOS)
    card.paste(thumb, (16, 12), thumb)
    ImageDraw.Draw(card).text((12, 310), job['id'], fill='#171009')
    thumbs.append(card)
if thumbs:
    sheet = Image.new('RGB', (960, ((len(thumbs) + 3) // 4) * 350), '#e2d5ac')
    for i, card in enumerate(thumbs):
        sheet.paste(card, ((i % 4) * 240, (i // 4) * 350))
    sheet.save(ROOT / 'SR立绘总览.jpg', quality=92)
(ROOT / '交付核验.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
print(f'已加工 {len(report)}/24 张；256色总计 {sum(r["256色字节"] for r in report)} 字节；25KB通过 {sum(r["符合25KB"] for r in report)} 张')
