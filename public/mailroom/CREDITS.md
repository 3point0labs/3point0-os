# Mailroom — Asset Credits

## Characters
Base character sprite sheets adapted from
[pablodelucca/pixel-agents](https://github.com/pablodelucca/pixel-agents)
under the MIT License. The underlying pixel art is based on
[MetroCity - Free Top Down Character Pack by JIK-A-4](https://jik-a-4.itch.io/metrocity-free-topdown-character-pack),
which the author has confirmed as permitted for commercial use.
3point0 Labs applies runtime tinting and color-matrix filters to
recolor these sprites for the Stone & Cognac palette; the source
PNGs in `public/mailroom/assets/characters/` are unmodified MIT
redistributions of pixel-agents' `webview-ui/public/assets/characters/`.

## Layout / tile concepts
Grid, pathfinding model, and asset-manifest structure concept
inspired by pablodelucca/pixel-agents (MIT).

## Bubble overlay
The DOM-based speech / thought / status chip pattern used by
`src/components/mailroom/BubbleOverlay.tsx` is adapted from
[harishkotra/agent-office](https://github.com/harishkotra/agent-office)
(MIT License). Our implementation is a clean reimplementation in
React + Tailwind matched to the Stone & Cognac palette; we do not
copy any source code or assets directly.

## Runtime
Rendering uses [PixiJS v8](https://github.com/pixijs/pixijs) (MIT).
