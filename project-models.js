import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { createEdgeEffect } from './edge-effect.js';

// Render into the model's own content slot rather than a viewport overlay.
export function createProjectModels() {
  const previews = [];
  const loader = new FBXLoader();
  let disposed = false;
  let lastFrame = -Infinity;
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
      preview.host.append(preview.renderer.domElement);
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
      const preview = { host, url, animation, animationSpeed, cameraDistance, viewerOverscan, scene: new THREE.Scene(),
        camera: new THREE.PerspectiveCamera(35, 1, 0.01, 100),
        visible: false, loading: false, ready: false, width: 0, height: 0 };
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
        if (!preview.visible || !preview.ready) continue;
        const width = preview.host.clientWidth, height = preview.host.clientHeight;
        if (!width || !height) continue;
        if (width !== preview.width || height !== preview.height) {
          preview.width = width; preview.height = height;
          preview.renderer.setSize(width, height, false);
          preview.camera.aspect = width / height;
          const vertical = THREE.MathUtils.degToRad(preview.camera.fov / 2);
          // Widen the canvas without letting auto-fit enlarge the character again.
          const framingAspect = preview.camera.aspect / preview.viewerOverscan;
          const horizontal = Math.atan(Math.tan(vertical) * framingAspect);
          const distance = preview.radius / Math.sin(Math.min(vertical, horizontal)) * 1.25 / 1.3 * preview.cameraDistance;
          preview.camera.position.set(.8, .35, 1).normalize().multiplyScalar(distance);
          preview.camera.far = Math.max(100, distance * 10);
          preview.camera.lookAt(0, 0, 0);
          preview.camera.updateProjectionMatrix();
        }
        preview.mixer?.update(delta);
        // Match the front-page limits and smoothing, independent of frame rate.
        const smoothing = 1 - Math.pow(1 - .055, delta * 60);
        preview.motion.rotation.x = THREE.MathUtils.lerp(preview.motion.rotation.x, pointer.y * .1, smoothing);
        const horizontalPointer = pointer.x * (preview.host.dataset.mirror === 'true' ? -1 : 1);
        preview.motion.rotation.y = THREE.MathUtils.lerp(preview.motion.rotation.y, horizontalPointer * .16, smoothing);
        preview.motion.position.x = THREE.MathUtils.lerp(preview.motion.position.x, horizontalPointer * .09, smoothing);
        preview.motion.position.y = THREE.MathUtils.lerp(preview.motion.position.y, -pointer.y * .06, smoothing);
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
