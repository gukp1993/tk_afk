#!/usr/bin/env python3
# 生成 2×2 精确缩放查看页（每页 4 屏，375×812 原始尺寸）
import glob, os, json
out = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'out')
svgs = sorted(glob.glob(os.path.join(out, '*.svg')))
names = [os.path.splitext(os.path.basename(p))[0] for p in svgs]
for i in range(0, len(names), 4):
    group = names[i:i + 4]
    html = ['<html><head><meta charset="utf-8"><style>body{margin:0;background:#222;display:grid;grid-template-columns:375px 375px;gap:6px;padding:6px}div{width:375px;height:812px;overflow:hidden;position:relative}span{position:absolute;top:2px;left:4px;color:#0f0;font:12px monospace;z-index:9}img{width:375px;height:812px}</style></head><body>']
    for n in group:
        html.append(f'<div><span>{n}</span><img src="{n}.svg"></div>')
    html.append('</body></html>')
    with open(os.path.join(out, f'view{i // 4}.html'), 'w') as f:
        f.write('\n'.join(html))
print('pages:', (len(names) + 3) // 4, names)
