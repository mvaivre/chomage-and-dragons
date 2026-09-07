#!/usr/bin/env python3
"""Pack generated RGBA poses into equal cells with a common floor and scale.

Large connected silhouettes determine the poses. RGB exports can pass through the
existing checkerboard preparation; incomplete sheets are rejected before packing.
"""
import argparse
import json
from collections import deque
from pathlib import Path
from PIL import Image
from prepare_flat_asset import remove_connected_checkerboard


def components(image, count, columns):
    width, height = image.size
    alpha = bytearray(image.getchannel('A').tobytes())
    found = []
    for start in range(width * height):
        if alpha[start] < 128:
            continue
        queue = deque([start])
        alpha[start] = 0
        size = 0
        left = right = start % width
        top = bottom = start // width
        while queue:
            pixel = queue.popleft()
            x, y = pixel % width, pixel // width
            size += 1
            left, right = min(left, x), max(right, x)
            top, bottom = min(top, y), max(bottom, y)
            for neighbour in (pixel - 1 if x else -1,
                              pixel + 1 if x + 1 < width else -1,
                              pixel - width if y else -1,
                              pixel + width if y + 1 < height else -1):
                if neighbour >= 0 and alpha[neighbour] >= 128:
                    alpha[neighbour] = 0
                    queue.append(neighbour)
        if size > 800:
            found.append((size, (max(0, left - 2), max(0, top - 2),
                                 min(width, right + 3), min(height, bottom + 3))))
    found.sort(reverse=True)
    if len(found) < count or (len(found) > count and found[count][0] > found[count-1][0] * 0.3):
        raise ValueError(f'Expected {count} separate silhouettes, found {len(found)}')
    bounds = sorted([box for _, box in found[:count]], key=lambda box: (box[1] + box[3]) / 2)
    return [box for row in range(0, count, columns)
            for box in sorted(bounds[row:row+columns], key=lambda box: box[0])]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('source', type=Path)
    parser.add_argument('destination', type=Path)
    parser.add_argument('--count', type=int, default=16)
    parser.add_argument('--columns', type=int, default=4)
    parser.add_argument('--props', action='store_true')
    parser.add_argument('--checkerboard', action='store_true', help='Use the existing asset-build background preparation for generated RGB exports')
    args = parser.parse_args()
    source = Image.open(args.source)
    if args.checkerboard:
        source = remove_connected_checkerboard(source)
    if source.mode != 'RGBA' or source.getchannel('A').getextrema()[0] != 0:
        raise ValueError('Source must contain genuine RGBA transparency')
    bounds = components(source, args.count, args.columns)
    poses = [source.crop(box) for box in bounds]
    width, height = (384, 224) if args.props else (256, 320)
    baseline = height - 8
    ratio = min((width - 24) / max(p.width for p in poses),
                (height - 24) / max(p.height for p in poses), 1)
    sheet = Image.new('RGBA', (width * args.columns, height * ((args.count + args.columns - 1) // args.columns)))
    for index, pose in enumerate(poses):
        pose = pose.resize((round(pose.width * ratio), round(pose.height * ratio)), Image.Resampling.LANCZOS)
        x = (index % args.columns) * width + (width - pose.width) // 2
        y = (index // args.columns) * height + baseline - pose.height
        sheet.paste(pose, (x, y))
    args.destination.parent.mkdir(parents=True, exist_ok=True)
    # The dev server must never read a partially encoded WebP.
    temporary = args.destination.with_suffix('.tmp.webp')
    sheet.save(temporary, 'WEBP', quality=90, method=6, exact=True)
    temporary.replace(args.destination)
    metadata = {'columns': args.columns, 'rows': (args.count + args.columns - 1) // args.columns,
                'width': width, 'height': height, 'baseline': baseline,
                'referenceHeight': round(poses[0].height * ratio),
                'count': args.count, 'nativeFacing': 'right'}
    args.destination.with_suffix('.json').write_text(json.dumps(metadata, indent=2)+'\n')
    print(args.destination, metadata)


if __name__ == '__main__':
    main()
