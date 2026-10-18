# Content and model editing

## Add or reorder projects

1. Add an image directly inside `assets/`.
2. Add an object to `projects.js`: `id`, `title`, `image`, `imageAlt`,
   `description`, and `href`.
3. Copy a project HTML page and change its title, metadata, banner image,
   accessible labels, heading, copy, and detail image.
4. Give its SVG title/clipPath/path IDs unique names and update all references.
   Retain `[data-project-content]` and `[data-blob-mask]`.
5. Update or remove the `[data-project-model]` host as appropriate. Pages without
   a model use `project-body--no-model` on their body section.

The array order controls both home pagination (three projects per page) and
detail previous/next links. The first/last project's missing neighbor stays an
empty slot. Back links point to `index.html`. Project thumbnails and detail images
are fitted to 16:9 using CSS; that cropping does not rewrite their source files.

## Edit timeline and galleries

Current project order: Soul Be It, Code Blue (NYP X IMH), Ahma, Surface Tension,
Re:turn to Sender, Note To Self, Souls Like, HLSL, Horror OpenGL, Game Physics,
FPS Shooter.

Home Achievements contains three Director's List photos under one visible caption
`Directors List 5x`, the Ahma team award photo with its NYP x H2 third-place caption,
and Note To Self's menu with its Brackeys top-25% caption. These photos retain
their natural aspect ratios and have empty alt attributes as requested. The
Gallery uses a fixed selection of gameplay images, excluding project thumbnails
and Achievement images. Sizes and offsets are authored in `index.html`.

### Added projects

`return-to-sender.html` and `note-to-self.html` follow the existing shared project
page structure: main-menu banner, left FBX preview, right overview/Features, then
a five-image fan. Their positions in `projects.js` control pagination and
previous/next links automatically.

- Re:turn to Sender uses `assets/envelope.fbx` and `return-to-sender-*.png`.
- Note To Self uses `assets/teleporter.fbx` and `note-to-self-*.png`.

Both use their `*-main-menu.png` images as listing thumbnails. Initial copy is
drafted from the supplied gameplay screenshots; no development role, engine,
team size, or production dates were supplied. Edit each page's `.project-copy`
to add those details when available.

Timeline nodes are in `index.html` under `.journey-timeline`. Their `h4` and `p`
text is automatically included in scroll typing. Keep most recent first:
XR Dev Intern, VThere, 2026 (3 months); Student, Nanyang Polytechnic, 2024–now.

Achievements and Gallery figures also live in `index.html`. Their sizes and
horizontal offsets are explicit layout values, so placement does not randomly
change while scrolling. Each figure has a caption above its image. Adjust
individual figure values and section CSS rather than runtime randomization.

## Project videos and reflection sections

Soul Be It adds a five-image fan, a Poseidon preview, and the supplied Canva
presentation iframe above its copy, with a direct fallback link. Its title image is
`soul-be-it-title.png`. Code Blue (NYP X IMH) uses `ER_Defib.fbx`, its main-menu
thumbnail and five-image fan, and the public YouTube ID `w3MdfKZid7I` extracted
from the Studio edit link. Public playback depends on that video's visibility
and embedding permissions. Code Blue also embeds its final Canva presentation
between overview paragraphs and Features. Poseidon's viewer is twice as wide,
with reference overscan 2 and camera distance .392, enlarging the character about
2.55x over its original framing while adding canvas space.

Existing fan pages place the title/thumbnail in the middle slot, highest in the
fixed stacking order. The envelope and teleporter previews use `data-mirror`
to face the opposite direction. Desktop previews stick at `top: 7.5rem`;
tablets use a lower responsive offset and enlarged render surfaces. Mobile previews
use a separate masked model window above the content. See the responsive layout
section in TECHNICAL.md for the sizing, gesture limits, and tablet exceptions.

### Poseidon assembly

`tools/combine-poseidon.py` imports `Poseidon_IdleV4_Body.fbx` and
`Poseidon_IdleV4_Tail.fbx` from `assets/sources/poseidon/`, retaining their distinct meshes together. Their
skeletons contain duplicated branches, so each rig is reduced to bones actually
weighted by its own meshes plus necessary parent chains (61 body bones, 71 tail
bones). Body and Tail prefixes prevent binding collisions. The body file owns
body/trident motion; the tail file owns tentacle motion. Local bone poses and
world prop transforms are sampled before editing the rigs or removing helpers,
then keyed into new actions. The active source range (currently 2–59) is mapped
onto 0–60 to avoid unkeyed frozen frames. The rigid `shoe_L`/`shoe_R` ankle pieces
are omitted; skinned calf/shin guards remain. The output has 48 meshes and two
rigs with one scene-wide Idle take at 24 FPS. The viewer plays that take on one
mixer, synchronizing body, trident, and tails. Frames after 60 are excluded;
the original source files remain intact for editing.

```powershell
& 'C:\Program Files\Blender Foundation\Blender 5.2\blender.exe' --background --python tools/combine-poseidon.py
```

Project reflections use `.project-copy` with a heading, two paragraphs, and a
Scope list. HLSL and Game Physics have two consecutive `.project-part` sections;
each part has its own `[data-video-player]` launcher and YouTube ID:

| Page / part | Video ID |
| --- | --- |
| HLSL: Post Processing and Shader Graphs | `_TdgejqrHlo` |
| HLSL: Lighting and Shader Effects | `2pkMw2DyKDo` |
| First Person Shooter | `62AAvlqq5Qs` |
| Horror OpenGL | `GS_r7-xU22w` |
| Game Physics: 3D | `ryz0K4keUfI` |
| Game Physics: 2D | `C99hI1hKLYs` |

Replace `data-video-id` to change a video and update the launcher's accessible
label. All launchers share the background crop, fluid Play button, and modal
from `video-overlay.js`. The reflection wording follows the supplied screenshots.
Header banners remain; the old standalone placeholder images were replaced by
the video/reflection sections. Adding a second part does not require another
renderer or changes to the navigation module.

## Replace a detail model

Set the host's `data-project-model` path. The other supported attributes are:

| Attribute | Meaning |
| --- | --- |
| `data-animation` | Clip name substring; defaults to idle |
| `data-animation-speed` | Positive playback multiplier; defaults to 1 |
| `data-mirror` | Flip rendered canvas and horizontal pointer response |
| `data-rotation-x`, `-y`, `-z` | Fixed rotations in degrees |
| `data-camera-distance` | Positive camera distance multiplier; lower = larger |
| `data-viewer-overscan` | Reference-width ratio for an expanded canvas; minimum 1 |

CSS controls the viewer dimensions, independently of FBX size. Overscan must
match the proportional canvas expansion; otherwise it changes framing. Use an
asset URL query suffix after replacing a model if a browser retains the old file.
Exports should contain only the intended mesh, rig, and animation. Cubes, duplicate
characters, and stretched vertices can enlarge fitting bounds and shrink the
visible character. Keep real joint meshes if they are part of the character.

## Front character animation contract

`assets/portfolio-character.fbx` contains one character/rig with these clip names:

```text
Standing           Floor               Floor To Stand
Stand To Sit       Sit To Type         Typing
Type To Sit        Sit To Stand        Stand To Fight
Fighting Idle      Fight To Stand      Jogging
```

Animation controllers locate names after the last `|` in FBX take names. Preserve
these names when exporting. Missing required clips prevent controller startup.
`Floor To Stand` is played backward for the standing-to-floor transition.
Both `Alpha_Surface` and `Alpha_Joints` must survive export to retain the surface
and joint outlines. `Cube` is an unwanted helper.

### Which files are actually needed?

The browser loads only `portfolio-character.fbx`; it never executes Python or
loads the separate source animation files. You can deploy without any of those
authoring files.

Keep `assets/sources/front-animations/` if you want the current rebuild workflow.
Those clips are the combiner's inputs. They preserve independently editable
animations and let you replace one clip without extracting it from a combined
export. The combined FBX also contains the animation data, so these are not
required for playback or manual editing of that combined file in Blender.
Deleting them would require recovering/extracting replacement inputs or changing
the combiner before it could run again.

### Rebuild and hip correction

Use Blender's Python, not plain system Python: these scripts import `bpy`.
Close other editing workflows and save a copy of the current combined export
before running the combiner, which overwrites it.

```powershell
& 'C:\Program Files\Blender Foundation\Blender 5.2\blender.exe' --background --python tools/combine-front-animations.py
```

The combiner reads the existing combined FBX, retains the original three clips,
removes the clips it is about to rebuild, then imports each source rig in turn.
Matching destination bones receive WORLD-space COPY_TRANSFORMS constraints.
`bpy.ops.nla.bake` visually samples every frame into a new pose action and removes
the constraints. Imported source objects/actions are then removed. This is a
matching-bone transfer, not arbitrary-rig retargeting.

It calls `correct_hips()` automatically. That function samples the world hip
matrix for each clip, aligns horizontal hip position to Standing, and preserves
vertical sit/stand movement with endpoint correction between target heights.
It keys hip location in the baked clip. It does not repair arbitrary hand skinning
or perform ground-contact IK. Standalone correction can be run with:

```powershell
& 'C:\Program Files\Blender Foundation\Blender 5.2\blender.exe' --background --python tools/fix-front-hips.py
```

Standalone correction makes a `portfolio-character.before-hip-fix.fbx.bak` backup
if none exists. The combiner itself does not create that backup. Both export only
the retained rig and the two named character meshes, with all actions, no leaf
bones, no NLA-strip export, and no animation simplification. A temporary FBX is
replaced into the final path after export.

To add another animation, update the combiner's source mapping, give the action
a stable name, and add its selection/timing logic to the relevant JS controller.
Putting a clip into the FBX alone does not cause the site to play it.

## Common troubleshooting

| Symptom | Where to investigate |
| --- | --- |
| File-origin CORS error | Start the HTTP server; do not open HTML via file:// |
| Missing model / 404 | Asset path, filename case, URL encoding, server root |
| Model unexpectedly small | Animated vertex bounds; extra meshes or bad poses |
| Limbs distort | Source clip, skeleton binding, bone rotations, skin weights |
| Missing joint outlines | Keep Alpha_Joints; also check edge threshold and normals |
| Arms cut off at canvas edge | Viewer dimensions, overscan, camera distance |
| Arms cut off at browser edge | Less zoom or different positioning; canvas cannot extend the screen |
| Project refresh starts dark | Keep project-page.js palette initialization and project CSS theme |
| Abrupt clip switch | Named action, scrub endpoints, bridge weights, hip alignment |
| Scroll transition too quick | Increase its viewport-height distance, not idle timeScale |
| Expensive frame rendering | DPR, model complexity, visible previews, cloud contour grid |

For manual review after edits, check home loading, forward/reverse scroll,
timeline and palette timing, every project model through its full clip, project
navigation plus direct refresh, small screens, and reduced-motion behavior.
