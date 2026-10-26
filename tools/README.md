# Model authoring tools

## Final front-page arena

`prepare-arena-web.py` rebuilds `assets/poseidon-space-arena/arena.glb` from the
packed canonical `arena.blend`. The editable reference character is 1.8 m tall;
the GLB contains environment/lights only because the website stages its animated
FBX at the same height. Only that GLB is included in prepared deployments.
Earlier arena style scripts are historical recipes whose intermediate scenes
were removed during cleanup; use the canonical scene for further edits.

`animate-arena-elements.py` adds local tower-crack spill lights, movable grass
and rock nodes with GLB motion metadata, and extra small debris. The website
animates those nodes in `arena-hero.js`; no baked animation clip is required.

`create-hero-lettering.py` converts the system Arial Bold font into eight
extruded glyph meshes in `assets/hero-lettering.glb`. It uses
`C:/Windows/Fonts/arialbd.ttf`; the font itself is not embedded. Social buttons
are generated as solid geometry in `hero-lettering.js` from the existing SVGs.

The website does not execute these Python scripts or load the FBXs in
`assets/sources/`. Keep them for animation edits, repairs, and rebuilding exports.
They require Blender's Python environment.

- `combine-front-animations.py`: combines the clips in
  `assets/sources/front-animations/` with the existing front-page FBX, then fixes
  hip offsets and exports `assets/portfolio-character.fbx`.
- `fix-front-hips.py`: shared hip correction; can also repair the combined FBX
  directly. Its standalone mode saves a backup before overwriting.
- `combine-poseidon.py`: combines the body and tail source FBXs into
  `assets/soul-be-it-poseidon-idle.fbx` from `assets/sources/poseidon/`.
  Retains independent body and tail rigs,
  prunes unused branches, and gives bones unique prefixes. Captures local bone
  poses and world prop transforms before removing helpers, then keys them into
  synchronized frames 0–60 at 24 FPS. Maps the sources' active keyed ranges to
  that output interval to avoid unkeyed holds, and omits the rigid shoe/ankle parts.

None of these scripts runs in the browser. Run the front combiner when adding/replacing clips;
run the hip fixer separately only when correcting hip motion on the existing
export. The combiner already calls the hip fixer automatically.

The separate front animation FBXs are editable inputs, not runtime dependencies.
The combiner still imports them when rebuilding: the combined file alone is
enough to run the site, but deleting the source clips breaks that workflow.

Example from the project folder:

```powershell
& 'C:\Program Files\Blender Foundation\Blender 5.2\blender.exe' --background --python tools/combine-front-animations.py
```

For deployment, omit `tools/` and `assets/sources/`. The site only needs the
exported models and images directly inside `assets/`, alongside its HTML, CSS,
and JavaScript files.

`warm-arena-walkway.py` updates the canonical arena with inward-facing painted
rail runes, rear rune stones/column accents/debris, and warm point lights. It
preserves motion extras and exports `arena.glb` without rendering a preview.

`clean-arena-light.py` is the subsequent refinement step: removes the rear rune
blocks and dark ink cracks, repacks clean pigment textures, centers and packs
the railing runes, and adds sharp emissive fissures with broad warm lighting.
It updates the canonical blend and GLB while preserving motion extras.

`deepen-arena-atmosphere.py` follows that step. It spaces 20 animated rocks
into a higher canopy and adds sparse or branched emissive fractures plus soft
lights to nine selected rear towers, preserving their purple vertex colours.

`combine-book-lectern.py` combines the supplied lectern and open-book FBXs,
seats the book on the lectern's measured sloped top, bakes transforms and joins
the geometry into one mesh with two materials. It writes an editable blend,
1024px packed textures, a runtime GLB and a preview in `tools/arena-work/`.

`export-sky-silhouettes.py` reads the arena blend and exports per-tower bounds
to `assets/poseidon-space-arena/sky-silhouettes.json` for soft sky attenuation.

`arrange-reading-courtyard.py` moves the central broken pillar, attached plant
and left fragment to the courtyard edges. Stored offsets make reruns idempotent.
