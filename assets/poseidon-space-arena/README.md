# Poseidon space arena

Edited from `Poseidon ARENA with floor.fbx`. The source model and source textures are preserved.

- Removed the original distant `OUTER_BG` scenery and large surrounding `FLOOR` plane.
- Retained the complete arena including `BG_OBJECTS`: the connecting colonnade, second ring, rear columns, arena plants, and props.
- Added supporting faceted terrain fitted to the arena's two floor heights. It extends to Y=60.65 in front of the standing camera (previously Y=30), while the rear boundary remains Y=-10.
- The forward extension contains open ground, rubble and towers, with one original arena. There are now 92 ground boulders and 36 towers reused from the original surrounding architecture.
- Added 16 irregular low-poly floating rocks.
- Recolored the retained stone to charcoal purple, preserving supplied color variation, ambient occlusion, and normal detail while replacing the polished material response with dry stone.
- Added separated angular rune symbols around the elliptical floor platform and both upright rings through baked color and emission textures. Surface centers and nonuniform scaling are respected; there are no continuous luminous circle outlines.
- Dedicated 4096px maps for the arena floor and 2048px maps for each ring provide more texture space than the shared atlas. The materials combine the supplied surface detail with natural chipped slate, fissures, and mineral grain from `Rock_Albedo.png`. See `texture-generation.md` for the generation prompt and source information.
- The natural rock material repeats every 4m on terrain and 3m on architecture instead of stretching over the landscape or fitting every tower into one atlas. Matching derived normal and roughness maps provide relief while preserving the low-poly geometry. The source tile is 1254px square.
- Dry, nonmetallic arena surfaces replace the glossy finish: floor roughness 0.90, rings 0.84, and repeating terrain/architecture roughness maps approximately 0.89–0.99. Roughness and metallic values are stored in the exported materials.
- Consolidated small static pieces into groups for rendering efficiency. Their original names are retained as vertex groups in Blender for selection and editing.

## Files

- `poseidon-space-arena.glb`: preferred for Three.js; packed textures and emissive material.
- `poseidon-space-arena.blend`: editable model with packed textures and preview lighting.
- `poseidon-space-arena.fbx`: interchange model. Some importers need the supplied maps reconnected, particularly emission.
- `Floor_*.png`, `Ring_*.png`, `SecondRing_*.png`: dedicated base color and tangent-space normal maps, plus emission maps for runes.
- `TerrainTile_*.png`: repeating base color, normal, and roughness maps.
- `arena-character.blend`, `arena-character.glb`, `arena-character.fbx`: a composed version with the existing portfolio character in a standing pose at the center of the first circle. The character is a static snapshot from the original Standing animation at frame 200, with dark armor and gold contour meshes.
- `arena-character.png`: low camera composition, looking upward with the full character centered at 72% of the image width and occupying 80% of the frame height. The camera is near the floor; the character is 3.3m tall.
- `arena-standing.png`: perspective preview from standing height within the first circle.
- `arena-preview.png`, `arena-detail.png`: overview and close-up previews.

The arena is centered near its circular platform, with Z up in Blender. The GLB exporter converts to glTF's Y-up convention. No sky mesh is included. Floating rocks are static geometry; their placement gives the suspended effect. The base Blender scene uses the `Standing_In_First_Circle` camera. The character scene uses `Hero_Low_Angle_Right`. Both are included in their respective exports. A viewer must select the authored camera to use the intended view rather than framing the entire model automatically. The character scene's subtle purple sky is a Blender world shader for preview; the GLB can use the portfolio's existing background as its sky. Its camera-specific contour strokes are static geometry.

For the luminous halo in a real-time scene, enable bloom. The emission texture and strength are already included in the GLB. This asset has not been inserted into the portfolio page.

Rebuild using Blender with `tools/style-poseidon-arena.py` from the repository root. Once it finishes, run `tools/compose-arena-character.py` to create the combined character scene from the updated arena.
