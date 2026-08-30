<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Visual iteration strategy

Treat environment work as a visually test-driven process:

1. Change only one small representative slice at a time: one biome, one transition,
   or a few related sprites.
2. Render that slice in the real game and inspect it at close desktop, mobile, and
   wide-camera compositions before expanding the solution.
3. Check ground contact, character readability, sharpness, seams, scale, and layer
   order. Continue to other biomes only after the slice is explicitly validated.
4. Preserve previously successful distant landscapes until a replacement has passed
   the same comparison. Do not regenerate the whole world speculatively.

Use a strict depth contract: far background, background, midground behind the player,
walkable ground, player, then only low and sparse foreground occlusion. Never place a
large rectangular transition sprite across the player's readable body area.

Design transition assets with intentional left and right overlap zones and enough
transparent or visually compatible margin to hide their boundaries. Prefer several
smaller parallax layers and standalone decorations over one enormous sprite. Size
source assets for their maximum intended on-screen scale; do not upscale a low-detail
sprite to cover the viewport.
