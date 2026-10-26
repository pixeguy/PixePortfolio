# Technical architecture

This document describes the current source implementation. It is not a browser
verification report. Values below are tuning defaults, not universal model sizes.

## 1. Entrypoints and module ownership

| File | Responsibility |
| --- | --- |
| `index.html` | Home sections, loader SVG, gallery images, timeline, import map |
| `main.js` | Home startup, FBX loading, render loop, scrolling, layout, projects, loader, static hero title |
| `arena-hero.js` | Opening environment, 1.8 m character, responsive framing, scroll camera route through both rings, transparent bloom and fog |
| `hero-lettering.js` | Extruded title meshes, perspective button geometry, floating rotation and accessible DOM alignment |
| `style.css` | Layout, layer order, theme variables, responsive rules, interactions |
| `projects.js` | Ordered project metadata used by listings and previous/next links |
| `project-page.js` | Runtime for a directly opened project HTML page |
| `page-navigation.js` | Home-to-detail transitions without restarting background canvases |
| `navigation-loader.js` | Rising yellow wave cover, ZF loading monogram, downward reveal |
| `project-pager.js` | Previous/next project footer built from `projects.js` |
| `project-models.js` | Lazy FBX previews, animated bounds, cameras, pointer response, disposal |
| `edge-effect.js` | Normal-buffer postprocessing and section-boundary outline colour |
| `space-background.js` | Noise, deforming/merging clouds, stars, background palette |
| `scroll-palette.js` | Scroll-driven CSS colours and shared outline colour |
| `cursor-blob.js` | Speed-gated, tapered/stretching cursor blob |
| `blob-mask.js` | Deforming SVG banner masks |
| `photo-fan.js` | Vertical photo fan with fixed right-edge pivots and bouncing translations |
| `video-overlay.js` | Magnetic blob Play button and full-window modal video |
| `fighting-sequence.js` | Standing/fighting animation ownership and scroll sampling |
| `purple-sequence.js` | Gallery animations, pose bridges, quote, headings, contact reveal |
| `journey-timeline.js` | Timeline text and growing/erasing branches |
| `one-time-text.js` | Visibility-triggered text that types once per home-page session |

The modules use native ES imports. Separating responsibilities does not create
independent animation loops for every feature: the home loop calls their update
methods. Detail pages have their own loop only when opened directly.

## 2. Startup, loading, and the home render loop

The opening also loads `assets/poseidon-space-arena/arena.glb`. Loading waits for
both assets. `arena-hero.js` matches the legacy opening character's projected
bounds with an opening camera at 0.22 m eye height, looking upward. Framing updates
on resize. The animated FBX is temporarily staged at 1.8 m tall, then its parent
and transforms are restored for the later scroll controllers. Its horizontal
viewing angle is preserved. Pointer tilt does not affect the arena.

HDR targets, bloom, soft local/sky lights and distance fog render the opening.
`space-background.js` retains the original moving clouds, linked contours,
colours, radii, noise clock, star sizes and twinkle rates. `sky-projection.js`
projects their control points as directions at infinity using only the arena
camera quaternion relative to its opening pose. At the opening the projection
is identity and the original Canvas drawing path runs unchanged. Other sky
directions contain fields using the same cloud parameters. Offscreen clouds
are culled before merging or painting. The same two viewport Canvas elements
draw the sky; there is no second WebGL sky, panorama texture or repeated GPU
texture upload. Cloud morphing retains its 33 ms clock, while cached world
contours are reprojected and painted on every changed camera frame. Their
expensive merge geometry is rebuilt only when the morph pose changes. Stars
retain their frame loop. Translation has no effect. During the arena fade, orientation
returns smoothly to the original background used by later sections.
The character outline uses environment depth occlusion.
The character is excluded from the lit colour pass and does not cast a solid
shadow: only its gold outline is composited. Runtime light strengths, floor
albedo response, rune emission and bloom are calibrated below the raw GLB
values. Exponential distance haze starts at 7 units and reaches 63% of the fog colour
after another 24 units. It approaches full haze gradually, preserving colour
progression between tower depths instead of flattening everything past 31 units. Its colour is the brighter blue-violet #24263f.
The Rune lighting panel exposes Fog strength (0–100% opacity), with Clear until
and Fade over distances in a collapsed advanced section. The strength uniform
scales the fog blend independently of range. It also controls ring, railing,
crack light intensity and light reach.
Light defaults are 2/170/1/1; emission and bloom remain independent. Existing broad
rear lights supply the blue-violet midtone, with their wash reduced 8% to restrain
brightness. Reusing them avoids an additional area-light evaluation on every
stone fragment. The two added opening towers were removed;
original rear towers retain faint
emission and local soft spill lights. Arena nodes with `arenaMotion` GLB extras
are animated in the home loop: rocks drift/tumble slowly, while cloned grass
materials bend their vertices increasingly toward the tip. Grass clump pivots
remain on the ground and ring-side clumps lean away from the opening. Motion
uses the existing frame timestamp and respects reduced-motion preferences.
Rock/plant motion retains the selected values (2.2, 1.8, 2, 2.5, 1.35), with
separate integrated clocks. The old motion panel has been removed. Hemisphere
intensity is 0.38 with restrained blue overhead and violet rear fill.
The opening framing remains unchanged.

Foreground warmth uses two restrained amber lights whose ranges stop before
the rear towers. Pink/rose imported fill is reduced, while rune and crack spill
has more priority. Motion defaults remain unchanged. The name uses
eight extruded glyph meshes from `assets/hero-lettering.glb`, with flat gold
front faces, shaded cut sides and dark edges. Buttons use actual cylindrical
bodies and raised tubular SVG icons. `hero-lettering.js` attaches these meshes
to the arena scene, deriving a fixed world anchor from the opening camera and
responsive DOM layout. Name and button defaults are Y=34°, X=-4°, Z=0°, depth/size=1, X=50px, Y=0px. Their
extrusion is genuine geometry without the former display shear. They use arena
depth, fog and lighting, and move in perspective as the camera travels. The DOM
provides static glyph layout and whole-title scroll fading, retains keyboard links and provides asset-failure
fallback. Button hit boxes follow their projected world positions. Slow bounded
X/Y rocking respects reduced motion: ±2° X / ±3° Y over roughly 60/79 seconds.
There is no vertical bobbing or animated Z rotation.
DOM layout metrics are cached until viewport, link visibility or layout sliders
change, avoiding forced browser layout on every world-render frame.
The temporary `3D name & buttons` panel in `hero-lettering.js` controls name
turn/tilt/roll, depth, size, position, floating rotation/speed/height and button
turn/tilt/depth/size/spacing/position. The actual link hit boxes follow button
size, spacing and position. Reload/reset restores defaults.

`assets/book-lectern/book-lectern.glb` combines the supplied FBXs into one mesh
with two materials, 1024px book textures and vertex-coloured violet stone.
The actual book-cover underside is aligned with the sloped top, with a 0.5 mm
authoring clearance checked during export. `tools/combine-book-lectern.py` keeps an editable blend and rebuilds the GLB.
The grounded prop is centred at (0, -0.501884, -17.4), scaled 1.25 with zero yaw (reversed 180 degrees from its previous pose), turned
toward the final camera, on the far side of the smaller ring. The camera stops before the lectern, continuing to face deeper into the ruins. Portal light
falls off locally: warmer by the rings, cooler toward the camera.

Upper walkway beams have twenty painted gold glyphs per inward-facing side,
using `InnerRailRuneUV`; the previous emissive fissures are cleared from their
atlas tiles. Six nearby point lights spill gold along the path. Both rings
have broad warm light pools. The five small rune blocks are removed. Rear
columns have sharp emissive fissures. Twenty floating rocks form a higher,
widely spaced canopy; nine selected rear towers have varied sparse or branched
fractures and accompanying soft lights.
Dark painted cracks are removed from the pigment atlases. Fissures use dedicated
1024px textures with cylindrical wrapping for columns/towers, rather than the
original small projected atlas tiles. Ring materials exclude direct punctual
lighting so only ambient shading and rune emission remain. Floating rocks
receive a localized underside gold bounce and a cooler top-facing sky lift.
The sky includes a very dark blue/plum gradient beneath the brighter clouds.
`ARENA_JOURNEY` shares camera/content timing with `main.js`. From 0.15–1.15
viewport heights, the off-axis opening view recentres and rises to the large
ring's centre. It crosses that ring at scroll 2, follows the descending path,
crosses the smaller ring at 4.25, then continues forward and stops at
5.5, at (-0.75, 1.35, -15.3), angled toward the central lectern. A temporary independently
cloned skeleton plays Standing on the right; responsive framing matches the
opening character bounds with a little extra margin; it stands on the clear right
side as a guide. It uses the same gold outline treatment without fill. The paragraph starts
typing only after arrival. The view stays stationary behind the paragraph;
the arena fades at 7.35–8.1 into the later character/timeline content. Scrolling
back reverses the same route. Stars and purple clouds remain the sky throughout.

Rendering skips the hidden legacy outline pass while the arena is opaque and
skips arena outline/depth passes after the character fades. Normal/depth-only
outline renders do not refresh shadow maps; the lit scene still does.

`main.js` constructs the Three.js scene/renderer, Canvas 2D background, cursor
blob, text controllers, and project navigation. FBXLoader loads
`assets/portfolio-character.fbx`. The loader removes the stray mesh named `Cube`,
keeps character joint geometry, and disables frustum culling on skinned meshes.

Animation initialization precedes fitting, so the front character is measured in
its default standing pose. A normalized model transform is nested inside a mouse
motion group, itself inside a placement group. These separate coordinate layers
let scroll move the character without rewriting the bones or mouse rotation.

The monogram loader has two copies of its letters; the foreground copy is clipped
by loading progress. Download progress is available when the response reports its
total size. Dismissal waits for model initialization and at least 1,000 ms from
startup. A 1,200 ms animated SVG wave then uncovers the page downward. Reduced
motion skips that wave. The name typewriter starts after the overlay is hidden.
On load failure the overlay remains and receives an error aria-label; inspect
the console for the underlying error.

The renderer animation loop computes a delta capped at 0.05 seconds, eases wheel
scrolling, updates the selected animation controller, calculates section position
and colour boundaries, updates placement and pointer tilt, redraws the background,
and updates detail previews, text, and outlines. The front model's outline render
is skipped while a project view is open.

## 3. Scroll coordinates and animation timing

Most home animation distances use viewport heights: `scrollY / viewportHeight`.
`1` means one screen of scrolling, not one second. Longer distances slow the
scrubbed animation without changing its FBX duration.

Current `main.js` timing:

```js
FIGHT_SCROLL = { start: .85, enterDuration: 1.2, idleDuration: 4.4, exitDuration: 1.2 }
HERO_SCROLL = { start: fightExitStart + FIGHT_SCROLL.exitDuration, duration: 2.2 }
SECTION_SCROLL = { duration: 1, turnDegrees: 65, startBeforeTop: .7, exitDuration: 1 }
```

The sequence is standing → Stand To Fight → Fighting Idle → Fight To Stand →
Standing → reversed Floor To Stand → Floor idle. Projects become visible and
interactive only once the floor transition reaches progress 1. Their layout start
is another 0.5 viewport below that point, placing tabs approximately mid-screen
when revealed, plus CSS padding.

The floor transition uses `action.time = (1 - progress) * clip.duration`.
Its action is paused so wall-clock time cannot advance it. Standing and Floor
idles loop at the two endpoints; their weights overlap the transition near its
first/last 8%. Floor's loop settings are restored when returning from the gallery
controller because these controllers share mixer actions.

Fighting and gallery transitions insert pose bridges: two actions are sampled at
fixed times, their weights interpolate with smoothstep, and `mixer.update(0)`
evaluates the resulting skeleton. This fills pose gaps; it does not synthesize
new motion, contact constraints, or Unity-style IK. Actual idle loops advance
using frame delta. Standing → Jogging currently uses only a pose bridge because
no dedicated transition clip was supplied.

### Wheel smoothing

Wheel deltas accumulate into a clamped target position. Each frame advances with
`1 - exp(-6 * delta)`; a larger rate approaches the target faster. The accumulated
distance is unchanged. Keyboard, touch, pointer-down, reduced-motion mode, and
project views bypass/cancel this easing so native scrolling remains available.

## 4. Purple gallery controller

`PURPLE_SEQUENCE` in `purple-sequence.js` contains:

| Setting | Current value | Meaning |
| --- | --- | --- |
| `entrySpace` | 4 | Entrance scrolling distance in viewport heights |
| `exitLead` | .85 | Begin Type To Sit before the last image leaves |
| `jogTransitionSpace` | .585 | Standing → Jogging bridge scroll distance |
| `contactSpace` | 1.2 | Additional space for the contact heading |
| `poseBlend` | .65 | Virtual animation seconds per pose bridge |
| `typeInterval` | .08 | Gallery-heading seconds per typed character |
| `eraseInterval` | .045 | Gallery-heading seconds per deleted character |

The controller starts when the purple section's top reaches half the viewport.
Entry is Floor To Stand → Stand To Sit → Sit To Type → Typing. Scroll space is
distributed in proportion to clip and bridge durations. Gallery content reveals
after Stand To Sit, so Sit To Type can continue while images enter.

Exit is anticipated from `#photo-gallery`'s bottom bounding rectangle. Type To
Sit finishes as that bottom reaches the viewport top; Sit To Stand follows over
a distance derived from entry's distance per animation second. Images are not
removed to force this transition. Then a scrubbed bridge leads into Jogging.

The quote types and backspaces according to entry progress before images reveal.
Achievements/Gallery headings use a different, time-driven state machine:
`idle`, `type`, and `erase`. Scroll chooses the desired heading, but an active
typing/erasing pass finishes before switching. Gallery starts erasing when the
last image bottom approaches the heading, rather than at the section's end.

## 5. Text and timeline systems

There are intentionally several text controllers with different behavior:

- Name: appears fully after loading as extruded meshes, with no caret or typing.
  Scrolling fades the complete title and buttons together.
- Fighting intro: scroll-scrubbed letters reserve their final layout using opacity.
  It types over .35 viewport, stays pinned with .75 viewport of accumulated scroll,
  then moves upward. It does not forward-backspace on exit.
- Timeline: begins 1.35 viewports after the fighting idle begins, types over .4
  viewport, and erases from idle offset 2.5 to 2.95 before Skills. The vertical line grows
  downward, then erases bottom-to-top to match the reverse text order. Branches
  animate based on each node's measured position in the chart.
- Skills: `#skills-section` follows the timeline with Programming, Engines &
  Graphics, and Planning rows. Each row places its category beside a comma-separated
  skill list, with horizontal dividers between rows and no button-like borders.
  `SKILLS_SCROLL` in `main.js` sets the handoff and
  reveal timing: reveal starts 3 viewports after Fighting Idle begins, lasts .45
  viewport, and backspaces with the foreground palette transition. The idle hold
  is extended to 4.4 viewports, so the existing animation sequence continues after
  readers have seen the skills. `prepareTypingText` preserves inline HTML and
  reserves text dimensions; all skill edits are made in `index.html`.
- One-time text: IntersectionObserver starts visible tabs, project text, page
  buttons, and captions. Paragraphs use 11 ms per character; other text uses
  22 ms. A session-local Set stores seen strings, so repeated text stays revealed.
  On completion spans become one text node, preserving continuous underlines.

These controllers are not automatically applied to individual project copy.
Hidden letter wrappers are aria-hidden and their parent retains an aria-label.

## 6. Background geometry and palette

Nebula clouds and stars are Canvas 2D, independent of the Three.js camera. The
fixed background therefore retains its screen position during document scrolling.
`nebulaNoise()` is smooth, bilinearly interpolated hash noise. Animated noise
deforms cloud control points rather than simply translating a rigid ellipse.

Nearby clouds are paired. Their quadratic outlines are sampled into 128 radial
distances. A radial distance field for each surface is combined using a smooth
minimum. A bounded grid extracts the zero contour, then quadratic curves form
the merged Path2D. Both clouds shade that shared contour with clipped radial
gradients: there is no separate connector shape. This is a lightweight visual
approximation, not a fluid simulation or exact signed-distance representation.
Cloud geometry redraws at roughly 30 Hz; star brightness is animated separately.

`NEBULA_MOTION` controls shared flow rate and speed variation. Resizing generates
the viewport's cloud/star layout again; gallery image placement is fixed in HTML.

`scroll-palette.js` blends these CSS custom properties:
`--accent-color`, `--accent-rgb`, `--page-color`, `--text-color`. Background changes
first over progress 0–.55; foreground follows over .45–1. End colours are yellow
`#d4c444` and purple `#2f2144`. `EDGE_SETTINGS.color` follows the foreground.

The physical purple section covers that fixed background. The outline shader
compares screen-space pixels against its top/bottom and elliptical corner curve,
making the part of the character inside the section yellow. This creates a colour
split at the boundary instead of recolouring the whole model at once. Placement
and turn use separate smoothed entrance/exit progress.

## 7. Outline rendering

`edge-effect.js` renders each model with a DoubleSide MeshNormalMaterial into a
depth-enabled WebGLRenderTarget. A fullscreen quad samples the normals texture
one configured pixel offset to the left/right/up/down. Edge strength is:

```text
length(normalRight - normalLeft) + length(normalUp - normalDown)
```

`step(threshold, strength)` produces internal edges. Alpha differences also find
silhouettes against transparent space. The output alpha contains only those
edges, leaving the model interior transparent. This is screen-space normal edge
detection, not triangle wireframe rendering; smooth joints may have fewer edges
than hard normal discontinuities. No colour-buffer edge test is currently used.

Shared defaults: threshold .5, thickness 1 CSS pixel. Pixel offsets account for
renderer pixel ratio. The renderer state is restored after the offscreen pass.

## 8. Project preview fitting and clipping

`project-models.js` uses IntersectionObserver to load a model on first visibility.
Each preview has its own transparent renderer, scene, 35-degree perspective
camera, mixer, and outline effect. The configured clip is selected by case-
insensitive name substring, with the first clip as fallback.

To fit it, the loader samples 33 times across that clip. `getVertexPosition()`
evaluates deformed vertices; world matrices and skeletons are updated before
measuring. The union of every mesh's vertices forms a bounding box. Non-mesh IK
helpers are excluded, but an unwanted mesh would still inflate these bounds.

```text
normalization = 2.5 / max(boundsWidth, boundsHeight, boundsDepth)
radius = length(boundsSize) * normalization / 2
cameraDistance = radius / sin(min(horizontalHalfFOV, verticalHalfFOV))
                 * 1.25 / 1.3 * perProjectCameraDistance
```

This explains why uniformly scaling an FBX does not enlarge its preview: bounds
increase and normalization decreases by the same factor. A wide animation or
badly stretched vertex makes the body appear smaller because fitting includes it.
Thirty-three samples are an approximation and can miss extreme intermediate poses.

The Boss uses a wider canvas with `data-viewer-overscan="1.6"`. Its camera fits
against a reference aspect ratio of `canvasAspect / overscan`, keeping model size
stable while adding render space. `data-camera-distance="0.567"` brings it closer.
CSS centers that expanded canvas around the model column. It cannot render beyond
the browser window: screen-edge clipping may still require less zoom or a layout
change. Near-camera zoom can also exceed vertical canvas clearance.

`data-mirror="true"` flips the canvas horizontally and reverses horizontal mouse
response; it does not modify skeleton bones. Optional `data-rotation-x/y/z` values
are fixed rotations in degrees inside the mouse-follow transform. Animation speed
comes from `data-animation-speed`; mouse tilt is clamped and smoothed separately.

Preview updates are throttled to approximately 30 FPS and DPR capped at 1.25.
When navigation destroys previews, it stops actions, disconnects observers,
removes listeners, disposes geometry/materials/render targets, and releases the
WebGL context. Invisible previews remain loaded until destruction.

## 9. Navigation and direct page refresh

Navigation first raises a yellow wave cover over 700 ms, then fetches a project
HTML document, parses its `[data-project-content]`, and caches that content. It
inserts the new region into the existing viewer and recreates its models, masks,
fans, and video launchers. `projectModels.whenReady()` explicitly starts model
loading and resolves after parsing/fitting (or a reported error); a separate
image preload waits for the banner. After two layout frames, the cover drops
downward over 1,200 ms using the initial loader's wave formula. A compact ZF
monogram fills repeatedly while waiting. Reduced motion skips the wave.
Background canvases stay alive. History state
and popstate support navigation; the Back link goes to home explicitly.
Failed fetches fall back to normal browser navigation.

Direct project visits run `project-page.js` and initialize the same navigation
controller with their existing content, so Previous/Next also use the wave loader
and retain the background. Their home Back link covers the page and navigates to
index.html, where the initial front loader handles model readiness. They initialize the palette
to progress 1 before previews, and always draw the background at progress 1.
Home's loop also forces progress 1 while `body.is-project-view` is present. CSS
defaults for project pages provide yellow/purple before module initialization,
preventing the dark home theme from briefly appearing on refresh.

Canva presentation iframes use eager loading and a preconnect to canva.com, so
they begin fetching when the new content is mounted. Their internal slide images
are remotely controlled and can continue loading after the iframe document.
The navigation loader deliberately does not wait for those inaccessible internal
assets. Exporting slides as local images or a PDF would make asset delivery more
predictable, but would replace Canva's interactive presentation UI.

## 10. SVG interaction and cursor blob

Entry outlines deform SVG cubic control points using noise. Noise samples are
cached at 10 Hz and interpolated each display frame. Hover adds a decaying ripple
and scales the entry; press contracts it, release restores it. Offscreen outlines
are skipped. Banner masks reuse point deformation with a 4.4 flow multiplier;
the image clipPath and visible outline share the same changing path.

The cursor uses one closed quadratic Canvas 2D shape, not overlapping trail
segments. Movement must exceed both 140 px/s and 16 accumulated pixels. Radius
ranges from 15 to 37.5 pixels; speed stretches its length. It follows a cursor
offset of +7/+10 pixels, fades as a whole after 140 ms without qualifying movement,
and uses .42 opacity. Colour follows foreground accents, becoming yellow inside
the home purple section. Reduced motion disables it.

## 11. Limits and maintenance

### Mobile and tablet home layout

The compact home layout uses `max-width: 1024px` in
CSS and `main.js`'s `compactPortfolio` MediaQueryList. The character starts at
its right-hand screen offset immediately, skipping the initial lateral movement.
Across the Journey exit/standing-to-floor range, the home edge effect's
instance-local blit threshold rises from 0 to 4.25. It filters both normal edges
and silhouettes, fully hiding the character by Projects. Multiplication by
`1 - entranceProgress` then lowers the threshold as the purple section enters,
restoring it there and in Contact. Reverse scrolling reverses the effect.
Mobile purple paint is drawn by a z-index 2 pseudo-element, the model remains at
3, and text/gallery content sits at 4. The parent has no stacking context, so its
background cannot cover the character while its images remain above it.
Resizing above 1024px restores threshold 0 and
the original placement logic; project detail renderers keep the default effect.
Mobile/tablet project panels occupy 100% width with 1.5rem side padding and no entry
left margin. Desktop retains its panel width and positioning.

Home outlines at every viewport size interpolate from warm amber `#dca85e` to aubergine
`#63435b` with the foreground palette; their purple-section portion remains amber.
Detail models at every viewport size use muted violet `#514063` on yellow, following the text's palette
instead of the background blob hues. `setColors()` is an
instance override, leaving text colours and cursor colours unchanged.
Achievement/Gallery containers use full mobile width with 1rem side
padding, preserving the existing per-figure width and horizontal offset values.
Their fixed heading is at z-index 6. The controller updates a vertical gradient
mask on each figure: image portions approaching the heading fade over 36 pixels
and disappear above a 12-pixel clearance. The title is positioned 1rem below the
safe-area inset, moving the fade band toward the top. The transition quote is
centred at 50svh across 92% width. This keeps the heading readable while
the rest of each photograph remains visible. Masks apply only below 701px.

Mobile project detail layouts use a dedicated first grid row for the model:
a 52svh canvas fills the content width and scrolls naturally above the copy/media in row
2. Models no longer sit behind project text. Pages without models use row 1 for
their content, so no empty model stage is reserved.
The model canvas respects the content's 1rem side gutters and is centred inside a
deforming SVG blob window. `createBannerMasks` animates its contour in the existing
viewer loop. A unique SVG clipPath references that same contour in normalized
coordinates, clipping the model canvas and controls together as it
deforms. Large animated limbs and zoomed models cannot draw beyond the blob.
The window remains transparent over the main yellow background, with violet
model outlines and purple controls. It has no alternate background canvas.
Desktop retains its layout and now shares the same model colours.
A sphere fit using the narrower field of view and
50% margin reserves room for rotation and zoom without shifting the model sideways.
Mobile fitting ignores canvas overscan but applies each page's camera-distance
multiplier: .567 for the mutant boss and .392 for Poseidon, enlarging these models
relative to the standard mobile fit. Desktop retains its existing settings.

`MODEL_WINDOW` in `project-models.js` controls mobile gestures: zoom is clamped to
.5–1.5 times the fit; rotation spans 0–65 degrees from the existing right-facing
pose. Bottom-right buttons ease to the left/right endpoints. Horizontal dragging
changes the angle proportionally (100 degrees per window width), and two captured
pointers control pinch zoom. A temporary labelled Zoom slider uses the same limits
and can be dragged with a mouse in a mobile-width desktop preview. Pinching keeps
the slider in sync. SVG chevrons centre the rotation arrows, and controls sit inset
from the blob's lower corners. Mirrored canvases compensate the rotation sign.
The window uses `touch-action: none` to own pinch/swipe gestures; scroll the page
outside the model window. Content below it keeps normal touch scrolling. Gesture
listeners, SVG masks, and controls are removed on navigation. Mobile stacking
overrides follow desktop rules so the home paragraph and timeline sit above the model.

Useful narrow widths for future manual RWD review are 320, 360, 390, and 430 CSS
pixels, plus either side of the 700px breakpoint. No browser RWD verification was
performed as part of this first mobile pass.

### Tablet layout and social links

The home project/gallery layout extends through 1024 CSS pixels. `compactPortfolio`
in `main.js` applies the model's reversible blit-threshold hide/reveal to phones
and tablets. From 701–1024px the project panel fills the page and removes the
entry's left offset. Gallery width, title position, stacking, and photo fade masks
use the same 1024px breakpoint in CSS and `purple-sequence.js`. The mobile model
window and gestures still use the 700px breakpoint; home model placement uses 1024px.
Individual project model hosts above 700px have a sticky top offset of 7.5rem
(previously 6rem), placing them lower without changing scale or animation.
Tablets override this with `clamp(11rem, 25svh, 22rem)` for a lower model position,
and apply a 1.2 scale to the outer model group without modifying FBX animation.
Tablet render surfaces extend to 140% of the model slot in both axes, or 180%
for Poseidon, centred around the same slot. `project-models.js` scales render
dimensions and camera distance together to add clipping clearance while retaining
the intended model size. The sticky slot and surrounding content do not move.
Tablet model hosts remove the desktop -2.5rem horizontal translation, shifting
each project model 2.5rem right toward the centre while retaining its overscan.
Poseidon is the exception: it retains the original -2.5rem horizontal translation.
Its host has an explicit lower stacking level than the details column, including
the Canva presentation, so the expanded model cannot paint over that content.
The home model also starts at its right-side offset on tablets, matching mobile.
Tablet gallery headings use 80% width and a 2.5–3.5rem responsive font, with
.75rem padding above and below, vertically centring the words while keeping the
same measured photo-mask boundary. Quotes use
3.5–5.25rem type and image captions use 1.05rem. Project thumbnails fill the entry's
inner width, with 2–2.5rem titles and 1rem descriptions; the outline extends 1.25rem
at the top/sides and 2.5rem below to give copy more room. Tablet timelines are
centred at 50svh, the learning title/paragraph group is centred at 50svh, and the hero name
sits at 48svh. Hero social links have 44px circular borders on every viewport,
with a small glyph-alignment inset from the name's left edge.
The introductory typewriter wraps individual text nodes while retaining inline
HTML such as `<b>`, `<strong>`, and `<br>`. The whole intro uses `translateY(-50%)`
around a 50svh centre while visible, then scrolls upward using the existing
hold timing. Its full formatted height is reserved while letters are hidden.
Hero buttons scale to 1.15 on hover, while contact text links scale to 1.05 from
their left edge; pressing scales them down. Game links use `.project-game-link`
in the Ahma, Surface Tension, Note To Self, and Re:turn to Sender HTML pages,
directly after Features and before the image fan.
Ahma, Surface Tension, and Note To Self place their jam-result paragraph between
Features and the itch.io link. Home project entries use the padded `.project-surface`
itself as the anchor; its hit area extends to the outline bounds, so activating
the blob's padding navigates just like activating the title, image, or description.

`index.html` contains inline SVG itch.io/YouTube links beneath the hero name and
larger text links below Contact me. Hero links appear with the complete name
and fade with it on scroll; contact links follow the heading's visibility. Both use
the existing foreground palette and are included in the home containers made inert
during project navigation. Their URLs are edited directly in `index.html`.

### Souls Like video overlay

`video-overlay.js` initializes `[data-video-player]` launchers on both direct
project visits and in-place navigation. `getSpaceBackground().drawRegion()` draws
an alternate palette from the active page's existing cloud paths and star data,
cropping it using the window's viewport position. No separate random layout is
generated. Shared cloud contours and alternate-palette canvases are cached.
The Play blob eases toward the pointer with the cursor trail's +7/+10 offset,
using `1 - exp(-18 * delta)` for both entry and movement;
the trail is suppressed inside the window and while the modal is open. On pointer
exit, the button eases back to centre. Border radii are deformed in the shared
update loop; reduced motion freezes that deformation. Two identical silhouettes
use opposite colours: the purple outer button protrudes freely and the yellow
inner layer is clipped to the rounded window, colouring only the inside portion.

Play creates a YouTube iframe inside a native `dialog` appended to the document
body. `showModal()` places it in the browser's top layer, above every site canvas,
traps keyboard focus, and makes the rest of the site inert. The video scales
from the centre to fit up to 1200px, 92vw, or 80dvh at 16:9. The surrounding
backdrop fades to 78% black. The document is scroll-locked while open.

Clicking outside the video, the top-right X, or Escape closes the overlay. Closing
requests pause, reverses the zoom, removes the iframe, unlocks scrolling, and
returns focus to Play. Navigation destroys dialogs, event listeners, timers, and
canvas layers. There are no TV power animations or hover-loaded embeds. Project
views suppress the root scrollbar and scroll only their content container;
opening the modal locks that container too. The X is a centred SVG cross.

`data-video-id` selects the video for each launcher. The embed uses
controls=1 and fs=1 to restore YouTube playback controls and fullscreen. Branding,
titles, ads, and related-video overlays remain under YouTube's control. Playback
also depends on its availability and browser autoplay permissions. A supplied
local MP4 with an HTML video element would allow fully custom player UI.

### Project photo fans

The `[data-photo-fan]` component sits after Ahma's Features and after Surface
Tension's project copy. Its
landscape buttons overlap vertically, with CSS `transform-origin: right center`.
Their fixed angles curve away from the left model column. Selection opens space
above/below the hovered card and compresses the other cards on each side;
rotation, stacking order, and scale remain fixed. Default spacing is .38 times
card height; selection opens .78-height spacing to adjacent cards. Spacing follows
measured card height through ResizeObserver. Centre-out z-order is fixed. A sine
arc shifts inner cards left while preserving endpoint resting positions. Vertical
hover displacement tapers to 6% at the endpoints; the selected card also bounces
left by up to 28 pixels. CSS interpolates translations over
650 ms with an overshooting cubic-bezier on both entrance and return; no
frame loop or WebGL is needed. Pointer entry on each card selects it. Pointer
exit restores the default fan unless one has keyboard focus. Buttons also support tap, focus, ArrowUp,
ArrowDown, Home, and End. Reduced motion removes transform transitions.

Both direct project startup and in-place navigation initialize the component.
Navigation aborts its event listeners before removing content. The current five
images are Ahma cat portraits, exploration gameplay, a story cutscene, the cat
album, and a team award photo. Their assets use descriptive `ahma-` filenames.
Replace the `img` paths, alt text, and button labels in `ahma.html` to change them.
Surface Tension uses its thumbnail, dialogue scene, mask gameplay, credits, and
team photo with descriptive `surface-tension-` asset names. Both galleries share
the same layout and interactions from `photo-fan.js`.

- Devlogs and contact content still contain placeholders; Souls Like's video
  still uses the earlier sample link. Other reflection videos use supplied links.
- The site depends on browser WebGL and external Three.js imports.
- Very large FBXs increase download, parsing, vertex fitting, and GPU costs.
- One-time typing history lasts only for the current page session.
- Reduced motion is handled by several features, but is not a blanket removal
  of all scroll-driven posing or idle animation.
- The PowerShell server reads files into memory and serves requests locally; it
  is a development convenience, not a production application server.
- Asset helpers should be cleaned during authoring; increasing viewer space does
  not correct malformed animation or bad skin weights.

The default fog strength is 55%, including Reset lights and reload. Haze colour
progresses from plum #30243e through blue-violet #24263f to lavender #535471
with distance. Three local orange portal bounce lights warm the far courtyard;
they use the Ring light and Light reach controls without changing emission.

Canvas clouds are subtly dimmed behind projected tower/rock bounds, using soft
9% radial veils (stars remain separate). `sky-silhouettes.json` stores per-tower
world bounds extracted by `tools/export-sky-silhouettes.py`; the towers otherwise
share one render mesh. Bounds are projected only when clouds repaint; no GPU
readback, new canvas, or additional WebGL scene render is used.

The title and social buttons expose independent X/Y/Z rotation sliders, each
covering -180 to +180 degrees (a full turn). The book export retains only
Book_frame and Book_sheets, removing the key, quill and other loose ornaments.

The introduction is a single transparent CanvasTexture plane above the book,
not extruded letters or a screen overlay. Heading/body text is rasterized once
from the accessible DOM copy, with standard perspective and depth occlusion.
The camera travels sideways and rises after the small ring to show the book
at an angle. The text plane and lectern share the courtyard centre line x=0.
The DOM introduction stays accessible but is visually hidden while the arena
plane is active; the existing later content flow is retained.

The reading-court framing keeps the lectern at (0, -0.501884, -17.4), with
the plane directly above it and the guide on the right at x=1.15. The arrival
camera is (-0.75, 1.35, -15.3); it rises and approaches obliquely so the book top
is visible. `arrange-reading-courtyard.py` moves BROKEN_PILLAR_1 and its plant
3 units right, and pCylinder19 2 units left, clearing the central reading area.
The local warm light pools follow this part of the courtyard.

The left beam and its small supporting columns shift outward 0.8 units;
Arena_Grass_005 follows the relocated right-hand broken pillar by 3 units.
This keeps the world text unobstructed while retaining architecture at the edges.

Book-focused arrival: lectern scale 1.25 at (0,-0.501884,-17.4), with the guide
beside it at x=1.15,z=-17.7 (its feet remain on the floor). The final camera is
(-0.75,1.35,-15.3); a view offset places the book near 32% width / 80% height,
allowing the guide and stand to crop naturally. The text plane is 1.35 units
wide and starts at y=0.94 above the enlarged book.

Each title glyph has a centred pivot and its own sway phase/frequency. Default
sway speed is 5 (range 0–10); the reference base rotations remain 34/-4/0.
Button hover/focus animates a separate visual pivot through 360 degrees around
X in 720ms, ending at 112% scale. Pointer leave/blur reverses it smoothly from
its current progress. Projected link hit boxes use the non-flipping base group.
Reduced motion retains only the enlargement. Railing light defaults to 6x and
its slider now spans 0–20x, independently of rune emission.

Current reading-rune pass: railing multiplier 170 (slider 0–300), fog 55%.
Title/button faces remain opaque while travelling; they are hidden at the end
of the title interval, without alpha blending through the architecture. Button
flips use a 420ms damped spring response with a small overshoot and reverse
from their current progress. Reduced-motion enlargement remains 150ms.

Lectern scale is 1.05; arrival camera y=0.78, looking slightly upward. The guide
is 12% larger and shifted to x=1.3,z=-17.55. The painted floor circle contains
24 angular glyphs, on one HDR CanvasTexture plane with three warm point lights.
The ring retains soft indirect warmth on its reverse side, with an extra faint
rear point light. The small courtyard rock groups pCube4.001/pCube5.001 move
2.5 units left, preserving their materials and shape.

Ring balance refinement: added stone bounce and rear-side light are halved;
actual ring-group lights blend 8% toward warm ivory. Emissive rune maps,
emission intensities and bloom are unchanged. The lectern rune plane is now
1.9 units wide with 16 marks (previously 2.7 units / 24); its three light
sources move inward to radius 0.45 and range 2.2. The guide shifts to x=1.58.
Button flips take 680ms, using a normalized critically damped spring response
(omega 4.5) instead of the earlier abrupt 420ms oscillating response.


### Scroll-driven character particles
Railing illumination defaults to 16×. `character-particles.js` renders 1,800 seeded, varied-size particles in one draw call. The opening normal-outline pass clips progressively from head to feet at scroll 0.15–1.15; particles follow animated mesh vertices into turbulent strands ahead of the camera. At 4.25–5.3 they gather onto the second animated model while its outline reveals from feet upward. Scroll reversal reverses the transition; idle turbulence continues while paused. Mesh skinning samples are skipped during the fully dissolved travel interval. The shared edge effect resets its height clipping after the arena pass.

Particle appearance refinement: larger faceted sprites follow a narrow curved tube with a shared animated spine and local turbulence. Independent seeded bronze/gold/ivory shades and brightness keep most grains matte while 17% cross the existing bloom threshold. Particle count remains 1,800 in one draw call.

The particle flight now uses a low world-space route through the large aperture at scroll 1.2 and the small aperture at 3.5, ahead of the camera. A rounded leading head tapers over a 1.2-unit tail; restrained time-based curls deform its profile. Pigments use saturated yellow/gold to match the outline and rune palette, retaining independent matte and emissive grains.

The fireball refinement increases the shared geometry to 2,800 grains, with a 2.6-unit travelling tail and a slower width falloff. Its route bows 0.82 units to the right between ring planes, returning to x=0 at the second aperture. Each grain has signed rotation, independent bounded oscillations, and a stable longitudinal sample without modulo resets. An additive halo pass shares the geometry and renders only emissive grains, giving visible soft glow without changing arena-wide bloom.

Gather/launch staging: the opening outline dissolves completely by scroll 0.8, and the particles hold a compact 0.225-unit-radius sphere until 1.02 before stretching into flight. Initial camera alignment begins at 0.8; the particle head crosses the first ring at 1.65 ahead of the camera at 2.0. Geometry now contains 3,800 grains, with 86% biased toward a tight radial core, reduced jitter, and a smaller surface population. The post-second-ring route bends toward the destination character immediately, keeping the trail oblique to the view instead of following the lens axis.

Name persistence and camera follow: the title and buttons retain full visibility/opacity in their world location throughout scrolling; scroll-driven title erasure is removed. The ball stretches fully into a stream by scroll 1.4, its head crosses the first ring at 1.65, and its tail clears before camera alignment begins at 2.05. The camera aligns at 2.25 and crosses the first ring at 2.9; the second-ring and final-arrival timings remain 4.25 and 5.5.

Camera/ball synchronisation refinement: restored the earlier first-ring camera crossing at scroll 2.0. The ball and camera both begin moving at 1.02 after the initial gather/hold; camera alignment finishes at 1.35 as the ball begins stretching into the stream (1.35–1.85). The camera no longer waits for the first-ring crossing. Full title opacity remains enabled.

Camera start correction: the opening camera stays fixed until scroll 1.65, when the particle head reaches the first ring. Alignment then uses quintic smootherstep over 0.95 viewport heights, ending at 2.6 (rather than the previous 0.33 interval). The camera crosses the first ring at 3.2. Particle animation, title persistence, second-ring timing, and final arrival retain their existing settings.

Adaptive launch shape: camera and ball now share PARTICLE_LAUNCH_SCROLL (1.02). Initial ball travel eases in, and the sphere starts morphing immediately into a short 0.65-unit teardrop, completing that initial morph at 1.2. It then stretches to 2.6 units and narrows from 0.235 to 0.155 radius by 2.25. Camera alignment retains its gentle end at 2.6 with quintic easing; first-ring crossing remains 3.2.

Close first-ring follow: camera alignment again happens early (1.02–1.3), and the first-ring camera crossing is 1.8, just behind the particle head at 1.65. The approach adds a smooth negative-x sweep, peaking around 0.48 units left within the wide first-ring opening, then blending into the existing right bend along the pathway. The second-ring and arrival timings retain their existing values.

The close first-ring pass also follows the left approach by up to 0.42 units and briefly pitches downward by 0.18 radians, then returns to the centre line and normal view by scroll 2.6. This keeps the below-camera stream visible during the near first-person crossing.

Centred, gentler follow: initial alignment now finishes at 1.5 and the first-ring crossing is 2.1, extending the approach from 0.78 to 1.08 viewport heights. The camera remains at x=0 through the ring and walkway rather than tracking the left-sweeping particles. The independent particle route is preserved. Particle core bias is increased to 90%, body width reduced slightly, and jitter reduced for a denser silhouette without additional particles or draw calls.

Gradual lateral/vertical centering: X/Y position, camera rotation, and framing offsets now settle independently of forward movement, over scroll 1.02–1.98, just before the first-ring crossing at 2.1. The brief downward pitch pulse is removed. Forward timing is preserved. Particle geometry increases to 4,800 grains with slightly narrower body and reduced jitter/depth turbulence; per-grain halo opacity is adjusted to keep overall glow similar.

Prelaunch camera composition: during scroll 0.15–0.9 the camera moves to (0, 1.5, 1.45), faces the first ring centre, and looks slightly downward with the gathered ball near the lower edge. It holds there until PARTICLE_LAUNCH_SCROLL (1.02), then starts forward travel as the ball launches. The view levels gradually before the centred first-ring crossing at 2.1. Particle route, density, and shape settings are unchanged.

Letter interaction and particle head start: opening camera reframing now holds its original Z, then forward travel begins half a viewport after the ball launches (scroll 1.52); first-ring crossing is 2.6. Name sway defaults to 3×. Each glyph has a stable box hit proxy and a separate visual group: entry performs a small damped scale bounce, exit chooses X/Y flip direction from the nearest projected edge and uses the button-style 680ms damped response. Visual transformations never modify the hit proxy. Reduced-motion mode suppresses bounce/flip.

Close staging correction: the prelaunch camera again settles at (0,1.5,1.45), matching the approved close ring/foreground-ball composition. That position is held from scroll 0.9 through 1.52, allowing the ball to launch at 1.02 and move for half a viewport before camera follow begins. Letter hover behavior and 3× sway are retained.

Morph/frontier correction: the sphere and teardrop now share longitudinal and circular sample coordinates, avoiding transverse collapse while blending. Animated surface samples supply a single world-space reveal height to both particles and the outline. Particle release/gather uses the same 0.018-amplitude world-space noise as the outline and only transitions on its erased side, replacing the previous mismatched normalised-height bands. Camera catch-up crosses the first ring at 2.2 with a front-loaded forward interpolation whose exit speed closely matches the walkway segment; the close staging view and half-viewport head start are retained.

During surface transitions, the gathering/incoming cloud is kept above the shared cut height by 0.27 units. This prevents already-released grains from being pulled down inside still-visible chest geometry and makes both transitions follow the visible outline edge.

Low reformation stream and book hologram: only the outgoing dissolve raises its gathering cloud above the outline. The arriving stream retains its original low Y route; individual grains interpolate upward onto the shared model reveal boundary. A single transparent triangle projects from the book to the text’s outer upper corners, with a yellow fill strongest near the central source and fading outward/upward. Analytic antialiased V edges retain higher opacity throughout. It fades with the content plane and renders behind the text.

The projection apex is anchored at world (0,0.58,-17.39), within the open book’s parchment/binding bounds rather than floating above the pages.

Arrival sphere and projection correction: from scroll 4.25 to 5.05 the remaining stream continuously contracts into its spherical layout while the shared model frontier keeps consuming grains through 5.3. The cloud stays on the low flight route, with its X anchored to the destination path. The book V now ends just below the text’s lower corners instead of extending behind the paragraph. The content plane is raised 0.16 units to provide projection space; the source stays anchored on the open book and the existing centre fade/stronger edge treatment is retained.

Book hologram activation: the world-space copy now types at 95 characters per second on reaching the content view, updating its canvas only when the character count changes. Its shader discards the transparent background and renders visible glyphs at full opacity without fog or an entrance fade. Both text and beam briefly offset horizontal UV bands during a 0.85-second activation glitch, retaining the golden palette. The projection uses a padded quad with soft analytical V sides and a height fade to remove hard triangle boundaries. Scrolling back below the arrival threshold resets activation for the next entrance.

Shader Graph hologram replacement: typing and the earlier UV-offset effect are removed. The supplied graph is represented by a shared GLSL value-noise implementation (three Simple Noise octaves), Y-position noise at scale 716 remapped to -1..1, a time-seeded Random Range multiplied into X vertex displacement, and fine scale-500 noise added to colour through a Step gate driven by remapped sine and random values. The text and projection are subdivided vertically to support vertex displacement. Both share world-height noise bands, time, and a reversible 0.7-second presence transition. Band discard provides glitch-in/out without fading glyph opacity; exiting above or below the content range reverses the transition. Full copy is rasterized once and stays opaque between transitions. The golden projection's soft spatial fade remains.

Hologram controls and content handoff: seven sliders control displacement amplitude, band scale, fine-noise scale, flicker speed, refresh rate, noise brightness, and transition duration; reset restores defaults, including the latest 0.25-second transition. Introduction, career timeline, and skills are separate opaque textured world planes sharing the graph shader. The current page glitches out before the next glitches in, while the beam stays on between pages. Content occupies scroll 5.5–7.325 (half the previous 3.65 viewport heights), with timeline at 6.1 and skills at 6.7. The courtyard character blends from Standing to looping Fighting Idle after reforming.

Ground-to-Projects cut: after content, scroll 7.325–8.075 lowers and tilts the camera toward the floor. Its near plane stays above the single-sided surface to avoid exposing the underside. Scroll 8.075–8.675 uses complementary hard, slanted CSS clip polygons on the arena/sky and Projects, revealing the yellow section from below. Projects content holds its screen position while the boundary passes, then resumes normal scrolling. Palette changes at ground contact; the arena sky keeps its original colours until the cut finishes. Reverse scrolling reverses the boundary and camera descent. The DOM copies of introduction, timeline and skills are visually suppressed while rendered in the arena.
