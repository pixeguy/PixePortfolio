# Technical architecture

This document describes the current source implementation. It is not a browser
verification report. Values below are tuning defaults, not universal model sizes.

## 1. Entrypoints and module ownership

| File | Responsibility |
| --- | --- |
| `index.html` | Home sections, loader SVG, gallery images, timeline, import map |
| `main.js` | Home startup, FBX loading, render loop, scrolling, layout, projects, loader, name typing |
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
`arena-sky.js` draws a complete star/cloud panorama onto an unlit inward-facing
sphere. Its centre follows the camera, while its orientation remains fixed in
world space: camera rotation reveals other longitudes, translation adds no
parallax. Cloud and star atlases are baked once at 2048×1024 without mipmaps;
small GPU UV deformations and shimmer animate them without Canvas repaint or
texture uploads each frame. The hidden Canvas background pauses while the arena
is opaque and resumes during its fade.
The character outline uses environment depth occlusion.
The character is excluded from the lit colour pass and does not cast a solid
shadow: only its gold outline is composited. Runtime light strengths, floor
albedo response, rune emission and bloom are calibrated below the raw GLB
values. Linear fog starts at 7 units and reaches full density at 31, reducing
distant towers to silhouettes. The Rune lighting panel controls fog start and
fade distance as well as ring, railing, crack light intensity and light reach.
Light defaults are 2/3/1/1; emission and bloom remain independent. Existing broad
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
bodies and raised tubular SVG icons. `hero-lettering.js` renders these in a
orthographic foreground scene aligned to the existing DOM title/link boxes.
The DOM stays accessible and clickable, drives typed-glyph visibility, and
provides fallback content if the lettering asset fails to load. Slow bounded
rotation/bobbing respects reduced motion. Default face rotations are zero and
floating rotation is disabled. A shear on the extrusion reveals its shaded
sides while the faces stay parallel to the screen, referencing Messenger's
opening lettering. Depth sliders scale geometry before the shear.
The temporary `3D name & buttons` panel in `hero-lettering.js` controls name
turn/tilt/roll, depth, size, position, floating rotation/speed/height and button
turn/tilt/depth/size/spacing/position. The actual link hit boxes follow button
size, spacing and position. Reload/reset restores defaults.

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
crosses the smaller ring at 4.25, then turns back toward the arena and stops at
5.5, at a low eye height and farther from the ring. The paragraph starts
typing only after arrival. The view stays stationary behind the paragraph;
the arena fades at 7.35–8.1 into the later character/timeline content. Scrolling
back reverses the same route. Stars and purple clouds remain the sky throughout.

Rendering skips the hidden legacy outline pass while the arena is opaque and
skips arena outline/depth passes after the character fades. Normal/depth-only
outline renders do not refresh shadow maps; the lit scene still does. Add
`?perf=1` to the home URL to show a local FPS and average CPU frame-time meter.
It is hidden in ordinary visits. Wait until model loading finishes before
comparing steady-state frame rates.

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

- Name: starts after loading; 0.05 seconds per character and 0.3 seconds between
  words. Scroll later backspaces it during fighting entry.
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
around a 50svh centre while typing/holding, then scrolls upward using the existing
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
larger text links below Contact me. Hero links appear when the name finishes typing
and hide as it backspaces; contact links follow the heading's visibility. Both use
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
