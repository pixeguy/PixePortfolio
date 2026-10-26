# Portfolio arena

Final palette: pink columns, blue-violet slabs, violet rings, indigo rocks,
clean flat pigments, emissive gold runes/fissures, and soft warm/cool lighting.

## Kept files

- `arena.blend`: editable packed scene, static reference character reduced from 3.3 m to 1.8 m, preview camera, lights and haze.
- `arena.glb`: website environment and lights. No duplicate static character or sky/volume box. The website uses the existing animated `../portfolio-character.fbx`.
- `arena-preview.png`: current homepage/scene preview of the smaller character.
- `arena-settings.json`: character height, ground position and fog settings.
- `Vibrant_*_Ink.png`: flat pigment atlases; dark painted cracks have been removed.
- `Painted_*_Emission.png`: architectural fissure maps; rocks have no emissive cracks.
- `Stylized_*_Gold.png`: floor and ring rune emission maps.
- `Walkway_Inner_Rail_Runes.png`: upper inward-facing railing glyphs.
- `Sharp_Gold_Fissure_*.png`: detailed emission textures wrapped around individual architectural pieces.

Superseded variants, duplicate FBX/GLB exports, Blender backups, obsolete natural
stone maps and intermediate previews/reports have been removed. Original supplied
FBX/textures outside this folder are preserved.

## Website

`arena-hero.js` loads the environment, retains the animated character and gold
outline, and fits the opening low camera to the original character screen position
and height at each viewport size. The character is 1.8 m tall in arena units.
Existing stars and purple clouds remain behind the transparent sky. Surfaces
occlude the character. Bloom and distance fog add depth; glTF light intensities
are calibrated for this RGB renderer.

The character is outline-only: no lit body surface or solid shadow is drawn.
Runtime lights, floor response and bloom are reduced to approach the authored
render. The pillar indicated in the wide reference (pCylinder4.003 and its
capital) has a bright gold fissure accent; the previously disabled pillar near
the text stays unlit. Original background towers have faint crack emission at
3.5% of that foreground accent. The two added opening towers were removed.
Lower-left protruding rock islands are removed. Fog density is 0.003.
`tools/arena-crack-accents.py` applies the latest tower/pillar revision;
`tools/refine-arena-web.py` is an earlier edit recipe and adds superseded towers.

`tools/animate-arena-elements.py` separates the 16 original floating rocks and
11 grass clumps into movable nodes, leans ring-side plants outward, and adds
12 smaller debris pieces (28 floating rocks total). Fourteen faint tower-crack
lights provide local soft amber spill. GLB extras label grass and rock nodes.
`arena-hero.js` drives bounded drift/tumble and gentle anchored grass bending;
reduced-motion preferences disable these animations. Scrolling recentres the
camera on the large ring, travels through both rings and stops beyond the
smaller ring before revealing the introductory paragraph. Runtime path timing
and lighting calibration live in `arena-hero.js`.

The previous Scene motion panel is removed. Motion stays at 2.2x, 1.8x, 2x,
2.5x and 1.35x respectively. A new panel adjusts only the 3D name and buttons.
Sky fill is 0.38 with restrained cool illumination and localized golden light.
Both rings and the centered, closely spaced rail runes have broad warm spill
lights. The five small rune blocks are removed. Rear columns use sharp glowing
fissures and three additional rocks float nearby. Dark painted cracks are
removed. The latest authoring step is `tools/clean-arena-light.py`; the earlier
`warm-arena-walkway.py` creates the superseded block props.

The arena fades out as the opening gives way to the existing scroll sequence.
Its camera follows a scroll route through both rings. Later animation controllers
retain their original placement and camera.

Rebuild with Blender using `tools/prepare-arena-web.py`. It can load the canonical
scene directly. Historical style scripts refer to deleted working variants and
are not the final workflow. Only `arena.glb` is needed from this folder for
deployment; all its textures are embedded.
# Distance and rear tower refinement

The latest authoring step is `tools/deepen-arena-atmosphere.py`: 20 floating
rocks spaced higher and farther apart, plus varied fractures on rear towers
15, 18, 20, 23, 26, 29, 31, 33 and 35. The two `Rear_Tower_Fissure_*.png`
textures contain sparse and branched emission patterns. Nearby point lights
provide their warm spill; the runtime Rune lighting panel controls that spill
independently from emission. Runtime distance fog starts at 7 units and reaches
full density 24 units later; both distances are adjustable in the lighting panel.
Default ring/railing/crack/reach multipliers are 2/3/1/1. The broad rear sources
provide the blue-violet midtone with a reduced wash, avoiding an extra area light.
