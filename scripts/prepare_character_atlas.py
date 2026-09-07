#!/usr/bin/env python3
"""Compile the approved RGBA character sheet into trimmed runtime WebP sprites.

Find the fifteen connected silhouettes instead of cutting a rigid grid: a lute,
feather, or staff may extend into the neighbouring cell. Preserve the original
pixels and alpha, including two pixels of antialiasing around each silhouette.
Usage: python3 scripts/prepare_character_atlas.py source.png
"""
import sys
from collections import deque
from pathlib import Path
from PIL import Image

IDS = ['barde', 'sorciere', 'chevalier', 'voleur', 'archimage', 'druidesse',
       'paladin', 'necromancien', 'licorne', 'squelette', 'fee', 'demon',
       'vampire', 'teddy', 'skater']


def silhouettes(source):
    width, height = source.size
    alpha = bytearray(source.getchannel('A').tobytes())
    bounds = []
    for start in range(width * height):
        if alpha[start] < 128:
            continue
        queue = deque([start])
        alpha[start] = 0
        count = 0
        left = right = start % width
        top = bottom = start // width
        while queue:
            pixel = queue.popleft()
            x, y = pixel % width, pixel // width
            count += 1
            left, right = min(left, x), max(right, x)
            top, bottom = min(top, y), max(bottom, y)
            neighbours = (pixel - 1 if x else -1, pixel + 1 if x + 1 < width else -1,
                          pixel - width if y else -1, pixel + width if y + 1 < height else -1)
            for neighbour in neighbours:
                if neighbour >= 0 and alpha[neighbour] >= 128:
                    alpha[neighbour] = 0
                    queue.append(neighbour)
        if count > 1000:
            bounds.append((max(0, left - 2), max(0, top - 2),
                           min(width, right + 3), min(height, bottom + 3)))
    if len(bounds) != len(IDS):
        raise ValueError(f'Expected 15 complete silhouettes, found {len(bounds)}')
    return sorted(bounds, key=lambda box: (int((box[1] + box[3]) / 2 / (height / 3)), box[0]))


def main():
    source = Image.open(sys.argv[1])
    if source.mode != 'RGBA':
        raise ValueError('Expected real RGBA transparency, not a painted checkerboard')
    output = Path(__file__).resolve().parents[1] / 'public/art/world-v3/characters'
    output.mkdir(parents=True, exist_ok=True)
    for character, bounds in zip(IDS, silhouettes(source)):
        sprite = source.crop(bounds)
        sprite.save(output / f'{character}.webp', 'WEBP', quality=88, method=4, exact=True)
        print(character, sprite.size)


if __name__ == '__main__':
    main()
