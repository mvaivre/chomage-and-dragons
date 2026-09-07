#!/usr/bin/env python3
"""Prepare generated flat-cartoon plates for the PixiJS runtime."""

from __future__ import annotations

import argparse
from collections import deque
from pathlib import Path

from PIL import Image, ImageFilter


def remove_connected_checkerboard(image: Image.Image) -> Image.Image:
    """Remove only bright neutral pixels connected to the image boundary.

    Generated ground plates occasionally contain a painted transparency grid.
    A flood fill preserves parchment and highlights enclosed by the terrain while
    turning the surrounding grid into real alpha.
    """

    rgba = image.convert("RGBA")
    pixels = rgba.load()
    width, height = rgba.size
    visited = bytearray(width * height)
    queue: deque[tuple[int, int]] = deque()

    def looks_like_checker(x: int, y: int) -> bool:
        red, green, blue, _ = pixels[x, y]
        return min(red, green, blue) >= 210 and max(red, green, blue) - min(
            red, green, blue
        ) <= 22

    for x in range(width):
        if looks_like_checker(x, 0):
            queue.append((x, 0))
        if looks_like_checker(x, height - 1):
            queue.append((x, height - 1))
    for y in range(height):
        if looks_like_checker(0, y):
            queue.append((0, y))
        if looks_like_checker(width - 1, y):
            queue.append((width - 1, y))

    while queue:
        x, y = queue.popleft()
        index = y * width + x
        if visited[index] or not looks_like_checker(x, y):
            continue
        visited[index] = 1
        pixels[x, y] = (0, 0, 0, 0)
        if x > 0:
            queue.append((x - 1, y))
        if x + 1 < width:
            queue.append((x + 1, y))
        if y > 0:
            queue.append((x, y - 1))
        if y + 1 < height:
            queue.append((x, y + 1))

    return rgba


def crop_alpha(image: Image.Image, padding: int) -> Image.Image:
    alpha = image.getchannel("A")
    bounds = alpha.getbbox()
    if bounds is None:
        raise ValueError("asset contains no opaque pixels")
    left, top, right, bottom = bounds
    return image.crop(
        (
            max(0, left - padding),
            max(0, top - padding),
            min(image.width, right + padding),
            min(image.height, bottom + padding),
        )
    )


def prepare(
    source: Path,
    destination: Path,
    checkerboard: bool,
    padding: int,
    blur: float,
    crop_top: int | None,
    alpha_threshold: int,
) -> None:
    image = Image.open(source).convert("RGBA")
    if checkerboard:
        image = remove_connected_checkerboard(image)
    if crop_top is not None:
        if crop_top < 0 or crop_top >= image.height:
            raise ValueError("crop-top must fall inside the source image")
        image = image.crop((0, crop_top, image.width, image.height))
    if alpha_threshold > 0:
        alpha = image.getchannel("A").point(
            lambda value: 0 if value < alpha_threshold else value
        )
        image.putalpha(alpha)
    image = crop_alpha(image, padding)
    if blur > 0:
        image = image.filter(ImageFilter.GaussianBlur(blur))
    destination.parent.mkdir(parents=True, exist_ok=True)
    image.save(destination, "WEBP", quality=88, method=6, exact=True)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path)
    parser.add_argument("destination", type=Path)
    parser.add_argument("--checkerboard", action="store_true")
    parser.add_argument("--padding", type=int, default=8)
    parser.add_argument("--blur", type=float, default=0)
    parser.add_argument("--crop-top", type=int)
    parser.add_argument("--alpha-threshold", type=int, default=0)
    args = parser.parse_args()
    prepare(
        args.source,
        args.destination,
        args.checkerboard,
        args.padding,
        args.blur,
        args.crop_top,
        args.alpha_threshold,
    )


if __name__ == "__main__":
    main()
