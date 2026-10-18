import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { createEdgeEffect } from './edge-effect.js';
import { createBannerMasks } from './blob-mask.js';

// Mobile viewer limits, relative to each model's existing facing-right pose.
const MODEL_WINDOW = { minZoom: .5, maxZoom: 1.5, turnDegrees: 65, swipeDegrees: 100 };
let modelWindowId = 0;

function createModelWindow(host, mobileLayout) {
  const controller = new AbortController();
  const options = { signal: controller.signal };
  const state = { zoom: 1, turn: 0 };
  const fingers = new Map();
  let baseline;
  const outline = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  outline.setAttribute('viewBox', '0 0 1000 650');
  outline.setAttribute('preserveAspectRatio', 'none');
  outline.setAttribute('aria-hidden', 'true');
  outline.classList.add('project-model-window-outline');
  outline.innerHTML = '<path data-blob-mask d="M 115 38 C 245 8 365 35 485 25 C 665 8 790 4 896 43 C 980 76 960 171 974 270 C 995 384 978 489 914 565 C 855 635 729 612 599 625 C 465 644 372 614 239 621 C 103 627 38 565 28 463 C 9 355 47 298 24 207 C 6 110 42 55 115 38 Z"/>';
  const id = `project-model-window-${++modelWindowId}`;
  outline.querySelector('path').id = `${id}-shape`;
  const definitions = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
  definitions.innerHTML = `<clipPath id="${id}-clip" clipPathUnits="objectBoundingBox"><use href="#${id}-shape" transform="scale(.001 .00153846153846)"/></clipPath>`;
  outline.prepend(definitions);
  const layer = document.createElement('div');
  layer.className = 'project-model-window-layer';
  layer.style.setProperty('--model-window-clip', `url(#${id}-clip)`);
  const controls = document.createElement('div');
  controls.className = 'project-model-controls';
  for (const [text, label, turn] of [['<', 'Turn model to face left', 1], ['>', 'Turn model to face right', 0]]) {
    const button = document.createElement('button');
    button.type = 'button';
    button.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${text === '<' ? 'M 15 5 L 8 12 L 15 19' : 'M 9 5 L 16 12 L 9 19'}"/></svg>`;
    button.setAttribute('aria-label', label);
    button.addEventListener('click', () => { state.turn = turn; }, options);
    controls.append(button);
  }
  const zoomControl = document.createElement('label');
  zoomControl.className = 'project-model-zoom';
  const zoomText = document.createElement('span');
  zoomText.textContent = 'Zoom';
  const zoomSlider = document.createElement('input');
  zoomSlider.type = 'range';
  zoomSlider.min = String(MODEL_WINDOW.minZoom);
  zoomSlider.max = String(MODEL_WINDOW.maxZoom);
  zoomSlider.step = '.01';
  zoomSlider.value = '1';
  zoomSlider.addEventListener('input', () => { state.zoom = Number(zoomSlider.value); }, options);
  zoomControl.append(zoomText, zoomSlider);
  layer.append(controls, zoomControl);
  host.append(layer, outline);
  const masks = createBannerMasks(outline);
  function rebase() {
    const points = [...fingers.values()];
    baseline = points.length ? { x: points[0].x, turn: state.turn, zoom: state.zoom,
      distance: points.length > 1 ? Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y) : 0 } : null;
  }
  host.addEventListener('pointerdown', event => {
    if (!mobileLayout.matches || event.target.closest('button, label') || (event.pointerType === 'mouse' && event.button !== 0)) return;
    host.setPointerCapture(event.pointerId);
    fingers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    rebase();
  }, options);
  host.addEventListener('pointermove', event => {
    if (!fingers.has(event.pointerId)) return;
    fingers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const points = [...fingers.values()];
    if (points.length > 1) {
      const distance = Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y);
      if (baseline.distance > 0) state.zoom = THREE.MathUtils.clamp(baseline.zoom * distance / baseline.distance, MODEL_WINDOW.minZoom, MODEL_WINDOW.maxZoom);
    } else {
      state.turn = THREE.MathUtils.clamp(baseline.turn + (baseline.x - points[0].x) / Math.max(host.clientWidth, 1)
        * MODEL_WINDOW.swipeDegrees / MODEL_WINDOW.turnDegrees, 0, 1);
    }
  }, options);
  function release(event) { fingers.delete(event.pointerId); rebase(); }
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) host.addEventListener(type, release, options);
  return { state, layer, update(time) {
    if (mobileLayout.matches) masks.update(time);
    zoomSlider.value = String(state.zoom);
  },
    destroy() { controller.abort(); fingers.clear(); masks.destroy(); outline.remove(); layer.remove(); } };
}

// Render into the model's own content slot rather than a viewport overlay.
export function createProjectModels() {
  const previews = [];
  const loader = new FBXLoader();
  let disposed = false;
  let lastFrame = -Infinity;
  const mobileLayout = window.matchMedia('(max-width: 700px)');
  const tabletLayout = window.matchMedia('(min-width: 701px) and (max-width: 1024px)');
  const pointer = { x: 0, y: 0 };
  function updatePointer(event) {
    pointer.x = THREE.MathUtils.clamp(event.clientX / window.innerWidth * 2 - 1, -1, 1);
    pointer.y = THREE.MathUtils.clamp(event.clientY / window.innerHeight * 2 - 1, -1, 1);
  }
  function resetPointer() { pointer.x = 0; pointer.y = 0; }
  window.addEventListener('pointermove', updatePointer);
  window.addEventListener('pointerleave', resetPointer);
  window.addEventListener('blur', resetPointer);
  const visibility = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      const preview = previews.find(preview => preview.host === entry.target);
      if (!preview) return;
      preview.visible = entry.isIntersecting;
      if (preview.visible && !preview.loading) load(preview);
    });
  });
  function load(preview) {
    preview.loading = true;
    loader.load(preview.url, object => {
      if (disposed) {
        preview.resolveReady(false);
        object.traverse(child => { if (child.isMesh) child.geometry.dispose(); });
        return;
      }
      try {
      preview.renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
      preview.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.25));
      preview.renderer.setClearColor(0x000000, 0);
      preview.renderer.domElement.className = 'project-model-preview';
      preview.renderer.domElement.setAttribute('aria-hidden', 'true');
      preview.window.layer.append(preview.renderer.domElement);
      preview.edges = createEdgeEffect(preview.renderer);
      object.traverse(child => {
        if (child.isMesh) {
          child.frustumCulled = false;
        } else if (child.isLine || child.isPoints) child.visible = false;
      });
      if (object.animations.length) {
        preview.mixer = new THREE.AnimationMixer(object);
        preview.mixer.timeScale = preview.animationSpeed;
        const clip = object.animations.find(clip => clip.name.toLowerCase().includes(preview.animation.toLowerCase())) || object.animations[0];
        preview.clip = clip;
        preview.mixer.clipAction(clip).setLoop(THREE.LoopRepeat, Infinity).play();
        preview.mixer.update(0);
      }
      object.updateMatrixWorld(true);
      object.traverse(child => { if (child.isSkinnedMesh) child.skeleton.update(); });
      // Measure actual deformed mesh vertices, excluding distant IK helpers.
      const bounds = new THREE.Box3();
      const vertex = new THREE.Vector3();
      function measurePose() {
        object.updateMatrixWorld(true);
        object.traverse(child => { if (child.isSkinnedMesh) child.skeleton.update(); });
        object.traverse(child => {
          if (!child.isMesh || !child.geometry.attributes.position) return;
          for (let i = 0; i < child.geometry.attributes.position.count; i += 1) {
            child.getVertexPosition(i, vertex);
            vertex.applyMatrix4(child.matrixWorld);
            bounds.expandByPoint(vertex);
          }
        });
      }
      // Fit the complete animated range instead of just its opening pose.
      if (preview.clip) {
        for (let sample = 0; sample <= 32; sample += 1) {
          preview.mixer.setTime(preview.clip.duration * sample / 32 / preview.animationSpeed);
          measurePose();
        }
        preview.mixer.setTime(0);
      } else measurePose();
      if (bounds.isEmpty()) {
        preview.resolveReady(false);
        console.error('Project FBX has no renderable mesh:', preview.url);
        return;
      }
      const center = bounds.getCenter(new THREE.Vector3());
      const size = bounds.getSize(new THREE.Vector3());
      const scale = 2.5 / (Math.max(size.x, size.y, size.z) || 1);
      const group = new THREE.Group();
      group.scale.setScalar(scale);
      group.position.copy(center).multiplyScalar(-scale);
      group.add(object);
      // Fixed project-specific angles sit inside the mouse-follow transform.
      const pose = new THREE.Group();
      const angle = axis => {
        const degrees = Number(preview.host.dataset[`rotation${axis}`] ?? 0);
        return THREE.MathUtils.degToRad(Number.isFinite(degrees) ? degrees : 0);
      };
      pose.rotation.set(angle('X'), angle('Y'), angle('Z'));
      pose.add(group);
      // Keep mouse motion outside the animated rig, pivoted at the mesh center.
      preview.motion = new THREE.Group();
      preview.motion.add(pose);
      preview.scene.add(preview.motion);
      preview.radius = size.length() * scale * 0.5;
      preview.ready = true;
      preview.resolveReady(true);
      } catch (error) {
        console.error('Could not initialize project model:', preview.url, error);
        preview.resolveReady(false);
      }
    }, undefined, error => {
      console.error('Could not load project model:', preview.url, error);
      preview.host.setAttribute('aria-label', 'Project model unavailable');
      preview.resolveReady(false);
    });
  }
  return {
    add(host, url, animation = 'idle') {
      const configuredSpeed = Number(host.dataset.animationSpeed ?? 1);
      const animationSpeed = Number.isFinite(configuredSpeed) && configuredSpeed > 0 ? configuredSpeed : 1;
      // Optional per-project framing: values below 1 bring the camera closer.
      const configuredDistance = Number(host.dataset.cameraDistance ?? 1);
      const cameraDistance = Number.isFinite(configuredDistance) && configuredDistance > 0 ? configuredDistance : 1;
      const configuredOverscan = Number(host.dataset.viewerOverscan ?? 1);
      const viewerOverscan = Number.isFinite(configuredOverscan) && configuredOverscan >= 1 ? configuredOverscan : 1;
      const preview = { host, url, animation, animationSpeed, cameraDistance, viewerOverscan, offset: new THREE.Vector3(), scene: new THREE.Scene(),
        camera: new THREE.PerspectiveCamera(35, 1, 0.01, 100),
        visible: false, loading: false, ready: false, width: 0, height: 0 };
      preview.window = createModelWindow(host, mobileLayout);
      previews.push(preview);
      preview.readyPromise = new Promise(resolve => { preview.resolveReady = resolve; });
      visibility.observe(host);
    },
    whenReady() {
      previews.forEach(preview => { if (!preview.loading) load(preview); });
      return Promise.all(previews.map(preview => preview.readyPromise));
    },
    update(time) {
      if (disposed || time - lastFrame < 33) return;
      const delta = Number.isFinite(lastFrame) ? Math.min((time - lastFrame) / 1000, .1) : 0;
      lastFrame = time;
      for (const preview of previews) {
        if (preview.visible) preview.window.update(time);
        if (!preview.visible || !preview.ready) continue;
        // Tablet overscan expands the render surface around the existing slot.
        // Compensate camera distance so added room does not also enlarge the model.
        const viewportScale = tabletLayout.matches
          ? (preview.host.classList.contains('project-model-host--poseidon') ? 1.8 : 1.4) : 1;
        const width = Math.round(preview.host.clientWidth * viewportScale), height = Math.round(preview.host.clientHeight * viewportScale);
        if (!width || !height) continue;
        if (width !== preview.width || height !== preview.height || preview.mobile !== mobileLayout.matches) {
          const firstLayout = preview.width === 0;
          preview.mobile = mobileLayout.matches;
          preview.width = width; preview.height = height;
          preview.renderer.setSize(width, height, false);
          preview.camera.aspect = width / height;
          const vertical = THREE.MathUtils.degToRad(preview.camera.fov / 2);
          // Widen the canvas without letting auto-fit enlarge the character again.
          const framingAspect = preview.camera.aspect / preview.viewerOverscan;
          const horizontal = Math.atan(Math.tan(vertical) * framingAspect);
          // A sphere fit reserves space for animated limbs and pointer tilt.
          // Mobile reserves room inside the blob for rotation and maximum pinch zoom.
          const distance = mobileLayout.matches
            ? preview.radius / Math.sin(Math.min(vertical, Math.atan(Math.tan(vertical) * preview.camera.aspect))) * 1.5 * preview.cameraDistance
            : preview.radius / Math.sin(Math.min(vertical, horizontal)) * 1.25 / 1.3 * preview.cameraDistance * viewportScale;
          preview.camera.position.set(.8, .35, 1).normalize().multiplyScalar(distance);
          preview.camera.far = Math.max(100, distance * 10);
          preview.camera.lookAt(0, 0, 0);
          preview.camera.updateProjectionMatrix();
          preview.offset.set(0, 0, 0);
          if (firstLayout) preview.motion.position.copy(preview.offset);
        }
        preview.mixer?.update(delta);
        // Match the front-page limits and smoothing, independent of frame rate.
        const smoothing = 1 - Math.pow(1 - .055, delta * 60);
        const mobile = mobileLayout.matches;
        preview.motion.rotation.x = THREE.MathUtils.lerp(preview.motion.rotation.x, mobile ? 0 : pointer.y * .1, smoothing);
        const horizontalPointer = pointer.x * (preview.host.dataset.mirror === 'true' ? -1 : 1);
        const turn = THREE.MathUtils.degToRad(MODEL_WINDOW.turnDegrees) * preview.window.state.turn
          * (preview.host.dataset.mirror === 'true' ? 1 : -1);
        preview.motion.rotation.y = THREE.MathUtils.lerp(preview.motion.rotation.y, mobile ? turn : horizontalPointer * .16, smoothing);
        const zoom = THREE.MathUtils.lerp(preview.motion.scale.x, mobile ? preview.window.state.zoom : tabletLayout.matches ? 1.2 : 1, smoothing);
        preview.motion.scale.setScalar(zoom);
        preview.motion.position.x = THREE.MathUtils.lerp(preview.motion.position.x, preview.offset.x + (mobile ? 0 : horizontalPointer * .09), smoothing);
        preview.motion.position.y = THREE.MathUtils.lerp(preview.motion.position.y, preview.offset.y - (mobile ? 0 : pointer.y * .06), smoothing);
        preview.motion.position.z = THREE.MathUtils.lerp(preview.motion.position.z, preview.offset.z, smoothing);
        preview.edges.setColors('#514063');
        preview.edges.render(preview.scene, preview.camera);
      }
    },
    destroy() {
      disposed = true;
      previews.forEach(preview => preview.resolveReady(false));
      window.removeEventListener('pointermove', updatePointer);
      window.removeEventListener('pointerleave', resetPointer);
      window.removeEventListener('blur', resetPointer);
      visibility.disconnect();
      previews.forEach(preview => {
        preview.window.destroy();
        preview.mixer?.stopAllAction();
        preview.scene.traverse(child => {
          if (!child.isMesh) return;
          child.geometry.dispose();
          const materials = Array.isArray(child.material) ? child.material : [child.material];
          materials.forEach(material => material.dispose());
        });
        preview.edges?.destroy();
        if (preview.renderer) {
          preview.renderer.dispose();
          preview.renderer.forceContextLoss();
          preview.renderer.domElement.remove();
        }
      });
    },
  };
}
