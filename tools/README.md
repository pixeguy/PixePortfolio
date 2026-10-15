# Model authoring tools

The website does not execute these Python scripts or load the FBXs in
`assets/sources/`. Keep them for animation edits, repairs, and rebuilding exports.
They require Blender's Python environment.

- `combine-front-animations.py`: combines the clips in
  `assets/sources/front-animations/` with the existing front-page FBX, then fixes
  hip offsets and exports `assets/portfolio-character.fbx`.
- `fix-front-hips.py`: shared hip correction; can also repair the combined FBX
  directly. Its standalone mode saves a backup before overwriting.
- `combine-poseidon.py`: combines the body and tail source FBXs into
  `assets/soul-be-it-poseidon-idle.fbx`. Retains independent body and tail rigs,
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
`assets/sources/soulsBoss-original.fbx` is an archival original; its former rebuild
script has been removed.

Example from the project folder:

```powershell
& 'C:\Program Files\Blender Foundation\Blender 5.2\blender.exe' --background --python tools/combine-front-animations.py
```

For deployment, omit `tools/` and `assets/sources/`. The site only needs the
exported models and images directly inside `assets/`, alongside its HTML, CSS,
and JavaScript files.
