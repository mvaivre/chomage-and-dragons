#!/usr/bin/env python3
"""Render deterministic world-v3 layer previews without a browser.

This is not a replacement for in-game QA. It catches the expensive failures first:
opaque rectangles, floating bases, uncovered portrait bottoms, and ground seams.
"""

from __future__ import annotations

from pathlib import Path
from typing import Iterable

from PIL import Image, ImageDraw, ImageOps

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "public/art/world-v3/runtime"
OUT = ROOT / ".codex/visual-qa"
WORLD_LENGTH = 15120
GROUND_Y = 602

BIOMES = [
    ("plaine", 0.00, 0.11, (126, 177, 203), (235, 215, 167)),
    ("foret", 0.11, 0.24, (111, 147, 134), (211, 221, 178)),
    ("marais", 0.24, 0.37, (132, 154, 139), (200, 193, 160)),
    ("lac", 0.37, 0.49, (120, 167, 199), (218, 230, 235)),
    ("cascade", 0.49, 0.61, (97, 137, 174), (208, 226, 231)),
    ("montagne", 0.61, 0.73, (108, 149, 187), (222, 233, 241)),
    ("desert", 0.73, 0.87, (224, 166, 94), (244, 221, 171)),
    ("taverne", 0.87, 1.00, (70, 76, 93), (141, 112, 111)),
]
def resize_width(image: Image.Image, width: int) -> Image.Image:
    height = max(1, round(image.height * width / image.width))
    return image.resize((width, height), Image.Resampling.LANCZOS)


def resize_height(image: Image.Image, height: int) -> Image.Image:
    width = max(1, round(image.width * height / image.height))
    return image.resize((width, height), Image.Resampling.LANCZOS)


def paste_bottom(canvas: Image.Image, asset: Image.Image, center_x: float, bottom: int) -> None:
    x = round(center_x - asset.width / 2)
    y = round(bottom - asset.height)
    canvas.alpha_composite(asset, (x, y))


def layer_x(world_x: float, camera_left: float, factor: float, view_width: int) -> float:
    return world_x * factor - camera_left * factor + view_width * 0.5 * (1 - factor)


def relevant(center: float, radius: int = 1) -> Iterable[int]:
    current = next(
        (index for index, (_, start, end, *_colors) in enumerate(BIOMES) if start * WORLD_LENGTH <= center < end * WORLD_LENGTH),
        len(BIOMES) - 1,
    )
    return range(max(0, current - radius), min(len(BIOMES), current + radius + 1))


def preview(name: str, center: float, width: int, height: int) -> None:
    camera_left = center - width / 2
    screen_offset_y = round(max(0, (height - 720) * 0.56)) if width / height < 0.75 else 0
    ground_y = GROUND_Y + screen_offset_y
    current = next(
        (biome for biome in BIOMES if biome[1] * WORLD_LENGTH <= center < biome[2] * WORLD_LENGTH),
        BIOMES[-1],
    )
    top, bottom = current[3], current[4]
    canvas = Image.new("RGBA", (width, height), (*top, 255))
    draw = ImageDraw.Draw(canvas)
    bands = 8
    for band in range(bands):
        t = band / max(1, bands - 1)
        color = tuple(round(a + (b - a) * t) for a, b in zip(top, bottom))
        y0 = round(height * band / bands)
        y1 = round(height * (band + 1) / bands) + 1
        draw.rectangle((0, y0, width, y1), fill=(*color, 255))

    for channel, factor, layer_bottom, target_width, opacity, radius in [
        ("far", 0.16, 584 + screen_offset_y, 980, 158, 2),
        ("back", 0.36, 606 + screen_offset_y, 1120, 209, 2),
        ("mid", 0.76, ground_y + 56, 820, 235, 1),
    ]:
        for index in relevant(center, radius):
            biome_id, start, end, *_colors = BIOMES[index]
            asset = Image.open(ASSETS / f"{biome_id}-{channel}.webp").convert("RGBA")
            asset = resize_width(asset, target_width)
            if index % 2:
                asset = ImageOps.mirror(asset)
            world_x = (start + end) * WORLD_LENGTH / 2
            asset.putalpha(asset.getchannel("A").point(lambda value: value * opacity // 255))
            paste_bottom(
                canvas,
                asset,
                layer_x(world_x, camera_left, factor, width),
                layer_bottom,
            )

    current_index = next(
        (
            index
            for index, (_, start, end, *_colors) in enumerate(BIOMES)
            if start * WORLD_LENGTH <= center < end * WORLD_LENGTH
        ),
        len(BIOMES) - 1,
    )
    for boundary_index in (current_index - 1, current_index):
        if not 0 <= boundary_index < len(BIOMES) - 1:
            continue
        landmark_height = 800 if boundary_index == 5 else 650
        landmark = resize_height(
            Image.open(ASSETS / f"transition-{boundary_index + 1}.webp").convert("RGBA"),
            landmark_height,
        )
        boundary_x = BIOMES[boundary_index][2] * WORLD_LENGTH - camera_left
        paste_bottom(canvas, landmark, boundary_x, ground_y + 32)

    # Solid under-earth makes the portrait composition explicit.
    draw = ImageDraw.Draw(canvas)
    if height > ground_y + 158:
        draw.rectangle((0, ground_y + 158, width, height), fill=(36, 29, 23, 255))

    verge = Image.open(ASSETS / "verge-universal.webp").convert("RGBA")
    verge_width = verge.width
    first_verge = int((camera_left - 1280) // verge_width)
    last_verge = int((camera_left + width + 1280) // verge_width) + 1
    for index in range(first_verge, last_verge + 1):
        tile = ImageOps.mirror(verge) if index % 2 else verge
        x = round(index * verge_width - camera_left)
        canvas.alpha_composite(tile, (x, ground_y + 8 - verge.height))

    road = Image.open(ASSETS / "road-universal.webp").convert("RGBA")
    road = resize_width(road, road.width)
    tile_width = road.width
    first = int((camera_left - 1280) // tile_width)
    last = int((camera_left + width + 1280) // tile_width) + 1
    for index in range(first, last + 1):
        tile = ImageOps.mirror(road) if index % 2 else road
        x = round(index * tile_width - camera_left)
        canvas.alpha_composite(tile, (x, ground_y))

    # Player readability proxy: feet are exactly on the ground socket.
    hero_x = round(width * 0.36)
    draw = ImageDraw.Draw(canvas)
    draw.ellipse((hero_x - 25, ground_y - 8, hero_x + 25, ground_y + 8), fill=(20, 18, 18, 110))
    draw.ellipse((hero_x - 22, ground_y - 112, hero_x + 22, ground_y - 66), fill=(240, 190, 112, 255), outline=(24, 20, 20, 255), width=5)
    draw.polygon([(hero_x - 31, ground_y - 72), (hero_x + 31, ground_y - 72), (hero_x + 22, ground_y), (hero_x - 22, ground_y)], fill=(185, 55, 58, 255), outline=(24, 20, 20, 255))

    for index in relevant(center):
        biome_id, start, end, *_colors = BIOMES[index]
        asset = Image.open(ASSETS / f"{biome_id}-front.webp").convert("RGBA")
        for occurrence, ratio in enumerate((0.28, 0.78)):
            scaled = resize_width(asset, 292 if occurrence == 0 else 246)
            if (index + occurrence) % 2:
                scaled = ImageOps.mirror(scaled)
            scaled.putalpha(scaled.getchannel("A").point(lambda value: value * 219 // 255))
            world_x = (start + (end - start) * ratio) * WORLD_LENGTH
            paste_bottom(canvas, scaled, layer_x(world_x, camera_left, 1.12, width), ground_y + 330)

    OUT.mkdir(parents=True, exist_ok=True)
    canvas.convert("RGB").save(OUT / f"{name}.jpg", quality=91, optimize=True)


if __name__ == "__main__":
    for boundary_index, biome in enumerate(BIOMES[:-1]):
        preview(
            f"transition-{boundary_index + 1}-{biome[0]}-{BIOMES[boundary_index + 1][0]}",
            biome[2] * WORLD_LENGTH,
            1280,
            720,
        )
    preview("mobile-marais", 0.31 * WORLD_LENGTH, 720, 1280)
