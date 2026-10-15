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

Serve the root HTML, CSS, JavaScript, and runtime assets over HTTP(S). Preserve
relative paths and filename case. Include all individual project HTML pages so
direct visits and refreshes work. No SPA rewrite to `index.html` is needed.

`tools/`, `docs/`, and `assets/sources/` are not runtime dependencies and can be
excluded from deployment. The launch scripts are only for local development.
The bundled front character is `assets/portfolio-character.fbx`.
