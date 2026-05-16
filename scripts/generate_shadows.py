#!/usr/bin/env python3
"""
Generate silhouette drop-shadow PNGs for each bird asset.
Run once from the project root: python scripts/generate_shadows.py
Requires: pip install Pillow
"""
from PIL import Image, ImageFilter
import os

BLUR_RADIUS = 12

birds = [
    ('waxwing',        'cedar_waxwing.png'),
    ('cardinal',       'cardinal.png'),
    ('robin',          'robin.png'),
    ('hummingbird',    'hummingbird.png'),
    ('paintedbunting', 'painted_bunting.png'),
]

assets_dir = os.path.join(os.path.dirname(__file__), '..', 'assets', 'birds')

for bird_id, filename in birds:
    src = os.path.join(assets_dir, filename)
    if not os.path.exists(src):
        print(f'  skip {filename} (not found)')
        continue

    img = Image.open(src).convert('RGBA')
    *_, alpha = img.split()

    shadow = Image.merge('RGBA', [
        Image.new('L', img.size, 0),
        Image.new('L', img.size, 0),
        Image.new('L', img.size, 0),
        alpha,
    ]).filter(ImageFilter.GaussianBlur(radius=BLUR_RADIUS))

    out = os.path.join(assets_dir, f'{bird_id}_shadow.png')
    shadow.save(out)
    print(f'  wrote {os.path.basename(out)}')

print('Done.')
