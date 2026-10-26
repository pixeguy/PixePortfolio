# Zhan Feng portfolio

A static HTML/CSS/JavaScript portfolio with Three.js FBX models, screen-space
outlines, scroll-scrubbed character animations, and a persistent Canvas 2D space
background. There is no backend, package manager, or compilation step for the site.

## Run locally

Open `Start Viewer.cmd`. It starts `start-viewer.ps1`, serves this folder at
`http://127.0.0.1:8000/`, and opens a browser. Keep its terminal running.
Opening HTML directly with `file://` will block module/model loading.

Three.js and FBXLoader come from the import maps in the HTML pages, pinned to
Three.js 0.180.0 on jsDelivr. Those imports need an internet connection.

## Documentation

- [Technical architecture and tuning](docs/TECHNICAL.md)
- [Content editing and model workflow](docs/CONTENT-AND-MODELS.md)
- [Offline Blender authoring tools](tools/README.md)

## Deployment

Automatic deployment from `main` is configured in
`.github/workflows/deploy-siteground.yml`. Complete the one-time GitHub secrets
setup in [Deployment instructions](docs/DEPLOYMENT.md) to activate it.

Serve the root HTML, CSS, JavaScript, and runtime assets over HTTP(S). Preserve
relative paths and filename case. Include all individual project HTML pages so
direct visits and refreshes work. No SPA rewrite to `index.html` is needed.

`tools/`, `docs/`, and `assets/sources/` are not runtime dependencies and can be
excluded from deployment. The launch scripts are only for local development.
The bundled front character is `assets/portfolio-character.fbx`.

The opening arena is `assets/poseidon-space-arena/arena.glb`, loaded by
`arena-hero.js`. Its fixed low camera preserves the previous character framing;
`arena-sky.js` renders a spherical star/cloud sky that follows camera rotation
and ignores translation. The shared Canvas background continues outside the
arena. The editable scene and final maps are
kept beside the GLB, and excluded by the deployment preparation script.

`hero-lettering.js` displays the extruded name meshes in
`assets/hero-lettering.glb` and volumetric social-button geometry. The original
DOM title and links remain for responsive layout, typing, accessibility and
click/keyboard targets.

Runtime models and images live directly in `assets/`. Editable front-animation
clips and Poseidon's body/tail inputs are grouped under `assets/sources/` and are
used only by the offline authoring scripts. Obsolete exports and the unused Boss
archive have been removed.
