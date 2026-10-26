Combined open book and lectern
=============================

`book-lectern.glb` is the runtime asset: one mesh with two material primitives.
The open book rests on the measured slope of the lectern's top face. The base
is at local Y=0 in glTF. `book-lectern.blend` and the texture maps are editable
authoring files; the deployment helper only copies the GLB from this folder.

Rebuild with Blender using `tools/combine-book-lectern.py`. Sources are
`assets/lectern/讲经台.fbx` and
`assets/Antique Book open/Antique Book open/open_Book.fbx`, with their textures.
The helper bakes FBX transforms and reduces texture dimensions to 1024 pixels.

`arena-hero.js` positions the combined prop at (0, -0.501884, -17.4), scaled to
1.05, on the far side of the smaller ring, rotated 180 degrees from its previous pose to face the approaching camera. Its point light is
controlled by the existing Ring light slider.

The lectern uses violet stone vertex colours instead of wood maps. The helper
aligns the original cover underside normal to the sloped top and checks its
0.5 mm clearance. Book parchment/binding textures remain intact.

Only the cover and pages are exported; key, quill and loose ornaments are removed.

The lectern is centred on the courtyard axis. The introduction sits above the
book as a separate flat text plane in the arena scene.
