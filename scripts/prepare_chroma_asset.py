#!/usr/bin/env python3
"""Convert a generated chroma plate into an alpha WebP without color spill."""

from __future__ import annotations

import argparse
from pathlib import Path

import numpy as np
from PIL import Image


def background_color(pixels: np.ndarray) -> np.ndarray:
    height, width = pixels.shape[:2]
    sample = max(16, min(width, height) // 32)
    # Generated plates reserve chroma in the upper portion, but a tall prop can
    # legitimately occupy one corner. Select only strongly magenta samples so
    # the terrain touching the lower frame can never pollute the key estimate.
    upper = pixels[: height // 3, :, :3].reshape(-1, 3)
    magenta = (np.minimum(upper[:, 0], upper[:, 2]) > 150.0) & (
        np.minimum(upper[:, 0], upper[:, 2]) - upper[:, 1] > 100.0
    )
    keyed = upper[magenta]
    if len(keyed) >= sample * sample:
        return np.median(keyed, axis=0)

    corners = np.concatenate(
        (
            pixels[:sample, :sample, :3].reshape(-1, 3),
            pixels[:sample, -sample:, :3].reshape(-1, 3),
        )
    )
    return np.median(corners, axis=0)


def open_edge_ports(
    pixels: np.ndarray,
    ground: float,
    ports: str,
    port_width: int,
    rise: int,
) -> None:
    """Give terrain tiles clean, opaque connection ports at the walking line."""

    height, width = pixels.shape[:2]
    ground_y = round(height * ground)
    span = min(port_width, width // 4)

    for side in ("left", "right"):
        if ports not in (side, "both"):
            continue
        for distance in range(span):
            progress = distance / max(1, span - 1)
            cutoff = round(ground_y - rise * progress**0.72)
            x = distance if side == "left" else width - 1 - distance
            pixels[: max(0, cutoff), x, 3] = 0.0


def cut_irregular_left_edge(pixels: np.ndarray, average_width: int) -> None:
    """Cut a hard, rock-like edge so the next tile can overlap the previous one."""

    height, width = pixels.shape[:2]
    for y in range(height):
        wobble = (
            np.sin(y * 0.009 + 1.3) * 74.0
            + np.sin(y * 0.031) * 24.0
            + np.sin(y * 0.073 + 1.7) * 8.0
        )
        cutoff = max(0, min(width - 2, round(average_width + wobble)))
        pixels[y, :cutoff, 3] = 0.0
        pixels[y, cutoff, 3] *= 0.45


def convert(
    source: Path,
    destination: Path,
    ground: float | None,
    ports: str,
    port_width: int,
    rise: int,
    left_wipe: int,
) -> None:
    image = Image.open(source).convert("RGBA")
    pixels = np.asarray(image, dtype=np.float32)
    rgb = pixels[:, :, :3]
    key = background_color(pixels)

    distance = np.linalg.norm(rgb - key, axis=2)
    coverage = np.clip((distance - 22.0) / 148.0, 0.0, 1.0)
    coverage = coverage * coverage * (3.0 - 2.0 * coverage)

    safe_coverage = np.maximum(coverage, 0.08)[:, :, None]
    foreground = (rgb - (1.0 - safe_coverage) * key) / safe_coverage
    edge = (coverage > 0.02) & (coverage < 0.98)
    rgb[edge] = np.clip(foreground[edge], 0.0, 255.0)

    magenta_bias = np.minimum(rgb[:, :, 0], rgb[:, :, 2]) - rgb[:, :, 1]
    spill = (coverage > 0.02) & (magenta_bias > 18.0)
    rgb[:, :, 0] = np.where(
        spill,
        np.minimum(rgb[:, :, 0], rgb[:, :, 1] + 22.0),
        rgb[:, :, 0],
    )
    rgb[:, :, 2] = np.where(
        spill,
        np.minimum(rgb[:, :, 2], rgb[:, :, 1] + 26.0),
        rgb[:, :, 2],
    )

    pixels[:, :, :3] = rgb
    pixels[:, :, 3] = np.where(
        coverage < 0.02,
        0.0,
        coverage * pixels[:, :, 3],
    )
    if ground is not None and ports != "none":
        open_edge_ports(pixels, ground, ports, port_width, rise)
    if left_wipe > 0:
        cut_irregular_left_edge(pixels, left_wipe)
    output = Image.fromarray(np.clip(pixels, 0.0, 255.0).astype(np.uint8), "RGBA")
    destination.parent.mkdir(parents=True, exist_ok=True)
    output.save(destination, "WEBP", quality=90, method=6, exact=True)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path)
    parser.add_argument("destination", type=Path)
    parser.add_argument("--ground", type=float)
    parser.add_argument(
        "--ports",
        choices=("none", "left", "right", "both"),
        default="none",
    )
    parser.add_argument("--port-width", type=int, default=36)
    parser.add_argument("--rise", type=int, default=18)
    parser.add_argument("--left-wipe", type=int, default=0)
    args = parser.parse_args()
    convert(
        args.source,
        args.destination,
        args.ground,
        args.ports,
        args.port_width,
        args.rise,
        args.left_wipe,
    )


if __name__ == "__main__":
    main()
