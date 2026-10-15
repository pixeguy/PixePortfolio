# Technical architecture

This document describes the current source implementation. It is not a browser
verification report. Values below are tuning defaults, not universal model sizes.

## 1. Entrypoints and module ownership

| File | Responsibility |
| --- | --- |
| `index.html` | Home sections, loader SVG, gallery images, timeline, import map |
| `main.js` | Home startup, FBX loading, render loop, scrolling, layout, projects, loader, name typing |
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
FIGHT_SCROLL = { start: .85, enterDuration: 1.2, idleDuration: 2.4, exitDuration: 1.2 }
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
  viewport, and erases with foreground palette fade. The vertical line grows
  downward, then erases bottom-to-top to match the reverse text order. Branches
  animate based on each node's measured position in the chart.
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

### Mobile home layout

These home-specific changes use the existing `max-width: 700px` breakpoint in
both CSS and `main.js`'s `mobileLayout` MediaQueryList. The character starts at
its right-hand screen offset immediately, skipping the initial lateral movement.
Across the Journey exit/standing-to-floor range, the home edge effect's
instance-local blit threshold rises from 0 to 4.25. It filters both normal edges
and silhouettes, fully hiding the character by Projects. Multiplication by
`1 - entranceProgress` then lowers the threshold as the purple section enters,
restoring it there and in Contact. Reverse scrolling reverses the effect.
Mobile purple paint is drawn by a z-index 2 pseudo-element, the model remains at
3, and text/gallery content sits at 4. The parent has no stacking context, so its
background cannot cover the character while its images remain above it.
Resizing above 700px restores threshold 0 and
the original placement logic; project detail renderers keep the default effect.
Mobile project panels occupy 100% width with 1.5rem side padding and no entry
left margin. Wider viewports retain their existing panel width and positioning.

Useful narrow widths for future manual RWD review are 320, 360, 390, and 430 CSS
pixels, plus either side of the 700px breakpoint. No browser RWD verification was
performed as part of this first mobile pass.

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

`data-video-id` still uses the earlier sample YouTube video. The embed uses
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
