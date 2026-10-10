import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';

const host = document.querySelector('#canvas-host');
const loadingScreen = document.querySelector('#loading-screen');
const loadingProgress = document.querySelectorAll('.loader-monogram-fill');
const loadingStartedAt = performance.now();
const minimumLoadingDuration = 1000;
const nebulaCanvas = document.querySelector('#nebula');
const nebulaContext = nebulaCanvas.getContext('2d');
const starCanvas = document.querySelector('#starfield');
const starContext = starCanvas.getContext('2d');
let stars = [];
let nebulaBlobs = [];
let starfieldWidth = 0;
let starfieldHeight = 0;
let modelTransform = null;
let modelMotion = null;
let modelPlacement = null;
const pointer = { x: 0, y: 0 };

function resizeNebula() {
  const width = host.clientWidth;
  const height = host.clientHeight;
  if (!width || !height) return;

  const pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5);
  nebulaCanvas.width = Math.round(width * pixelRatio);
  nebulaCanvas.height = Math.round(height * pixelRatio);
  nebulaContext.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  const minDimension = Math.min(width, height);
  const colors = ['108,78,151', '86,62,130', '127,83,151', '65,70,131'];
  const blobCount = Math.max(7, Math.floor((width * height) / 110000));
  nebulaBlobs = Array.from({ length: blobCount }, () => ({
    x: width * (0.04 + Math.random() * 0.92),
    y: height * (0.04 + Math.random() * 0.92),
    radiusX: minDimension * (0.075 + Math.random() * 0.16),
    radiusY: minDimension * (0.05 + Math.random() * 0.14),
    rotation: Math.random() * Math.PI * 2,
    phase: Math.random() * Math.PI * 2,
    speed: 0.45 + Math.random() * 0.65,
    driftX: width * (0.012 + Math.random() * 0.025),
    driftY: height * (0.012 + Math.random() * 0.025),
    color: colors[Math.floor(Math.random() * colors.length)],
    opacity: 0.25 + Math.random() * 0.16,
    radii: Array.from({ length: 11 }, () => 0.66 + Math.random() * 0.48),
  }));
}

function drawNebula(time) {
  const width = host.clientWidth;
  const height = host.clientHeight;
  nebulaContext.clearRect(0, 0, width, height);
  for (const blob of nebulaBlobs) {
    const phase = time * 0.000055 * blob.speed + blob.phase;
    const x = blob.x + Math.sin(phase) * blob.driftX;
    const y = blob.y + Math.cos(phase * 0.83) * blob.driftY;
    const rotation = blob.rotation + Math.sin(phase * 0.44) * 0.12;
    const points = blob.radii.map((baseRadius, index) => {
      const angle = rotation + (index / blob.radii.length) * Math.PI * 2;
      const pulse = 1 + Math.sin(phase * 1.7 + index * 0.9) * 0.075;
      const radius = baseRadius * pulse;
      return {
        x: x + Math.cos(angle) * blob.radiusX * radius,
        y: y + Math.sin(angle) * blob.radiusY * radius,
      };
    });

    const path = new Path2D();
    const first = points[0];
    const last = points[points.length - 1];
    path.moveTo((first.x + last.x) / 2, (first.y + last.y) / 2);
    for (let index = 0; index < points.length; index += 1) {
      const current = points[index];
      const next = points[(index + 1) % points.length];
      path.quadraticCurveTo(current.x, current.y, (current.x + next.x) / 2, (current.y + next.y) / 2);
    }
    path.closePath();

    const gradient = nebulaContext.createRadialGradient(
      x - blob.radiusX * 0.18,
      y - blob.radiusY * 0.2,
      0,
      x,
      y,
      Math.max(blob.radiusX, blob.radiusY) * 1.12,
    );
    gradient.addColorStop(0, `rgba(${blob.color},${blob.opacity})`);
    gradient.addColorStop(0.62, `rgba(${blob.color},${blob.opacity * 0.72})`);
    gradient.addColorStop(1, `rgba(${blob.color},${blob.opacity * 0.08})`);

    nebulaContext.save();
    nebulaContext.shadowColor = `rgba(${blob.color},${blob.opacity * 0.75})`;
    nebulaContext.shadowBlur = Math.max(blob.radiusX, blob.radiusY) * 0.45;
    nebulaContext.fillStyle = gradient;
    nebulaContext.fill(path);
    nebulaContext.restore();
  }
}

function resizeStarfield() {
  const width = host.clientWidth;
  const height = host.clientHeight;
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  if (!width || !height) return;

  starfieldWidth = width;
  starfieldHeight = height;
  starCanvas.width = Math.round(width * pixelRatio);
  starCanvas.height = Math.round(height * pixelRatio);
  starContext.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

  const starCount = Math.max(48, Math.floor((width * height) / 11000));
  stars = Array.from({ length: starCount }, () => ({
    x: Math.random() * width,
    y: Math.random() * height,
    size: Math.random() > 0.78 ? 2 : 1,
    phase: Math.random() * Math.PI * 2,
    speed: 0.45 + Math.random() * 1.4,
    cross: Math.random() > 0.80,
    color: Math.random() > 0.77 ? '#fff18a' : (Math.random() > 0.5 ? '#e5cf45' : '#bca735'),
  }));
}

function drawStarfield(time) {
  starContext.clearRect(0, 0, starfieldWidth, starfieldHeight);
  for (const star of stars) {
    const shimmer = 0.35 + (0.65 * (0.5 + 0.5 * Math.sin(time * 0.001 * star.speed + star.phase)));
    const x = Math.round(star.x);
    const y = Math.round(star.y);
    starContext.globalAlpha = shimmer;
    starContext.fillStyle = star.color;
    starContext.fillRect(x, y, star.size, star.size);
    if (star.cross) {
      starContext.globalAlpha = shimmer * 0.82;
      starContext.fillRect(x - 2, y + 1, 5, 1);
      starContext.fillRect(x, y - 1, 1, 5);
    }
  }
  starContext.globalAlpha = 1;
}

function updatePointer(event) {
  const bounds = host.getBoundingClientRect();
  pointer.x = THREE.MathUtils.clamp(((event.clientX - bounds.left) / bounds.width) * 2 - 1, -1, 1);
  pointer.y = THREE.MathUtils.clamp(((event.clientY - bounds.top) / bounds.height) * 2 - 1, -1, 1);
}

window.addEventListener('pointermove', updatePointer);
window.addEventListener('pointerleave', () => {
  pointer.x = 0;
  pointer.y = 0;
});

const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(38, 1, 0.01, 5000);
const defaultTarget = new THREE.Vector3();

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setClearColor(0x000000, 0);
host.appendChild(renderer.domElement);

// Patch a built-in material so Three.js keeps its normal morph and skeleton handling.
const wireMaterial = new THREE.MeshBasicMaterial({
  color: '#ffffff',
  side: THREE.DoubleSide,
  transparent: true,
  depthWrite: false,
});
wireMaterial.onBeforeCompile = (shader) => {
  shader.vertexShader = shader.vertexShader
    .replace(
      '#include <common>',
      '#include <common>\nattribute vec3 barycentric;\nvarying vec3 vBarycentric;',
    )
    .replace(
      '#include <begin_vertex>',
      '#include <begin_vertex>\nvBarycentric = barycentric;',
    );

  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>', '#include <common>\nvarying vec3 vBarycentric;')
    .replace(
      '#include <color_fragment>',
      `#include <color_fragment>
      vec3 edgeDistance = smoothstep(vec3(0.0), fwidth(vBarycentric) * 1.25, vBarycentric);
      float wireAmount = 1.0 - min(min(edgeDistance.x, edgeDistance.y), edgeDistance.z);
      diffuseColor.rgb = vec3(0.83137, 0.76863, 0.26667);
      diffuseColor.a *= wireAmount;`,
    );
};
wireMaterial.customProgramCacheKey = () => 'fbx-triangle-wireframe-v2';

function prepareWireGeometry(source) {
  // Non-indexed triangles give each face its own barycentric coordinates while
  // preserving skinIndex, skinWeight, morph targets, UVs, and other attributes.
  const geometry = source.index ? source.toNonIndexed() : source.clone();
  const count = geometry.attributes.position.count;
  const barycentric = new Float32Array(count * 3);
  const corners = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  for (let i = 0; i < count; i += 3) {
    for (let corner = 0; corner < 3; corner += 1) {
      barycentric.set(corners[corner], (i + corner) * 3);
    }
  }
  geometry.setAttribute('barycentric', new THREE.BufferAttribute(barycentric, 3));
  return geometry;
}

function fitModel(object) {
  object.updateMatrixWorld(true);
  object.traverse((child) => {
    if (child.isSkinnedMesh) child.skeleton.update();
  });

  const bounds = new THREE.Box3().setFromObject(object);
  const size = bounds.getSize(new THREE.Vector3());
  const center = bounds.getCenter(new THREE.Vector3());
  const largest = Math.max(size.x, size.y, size.z) || 1;
  const modelScale = 3.2 / largest;

  // Keep translation and scale in the same parent transform. Translating the
  // FBX root by an unscaled center makes models authored far from the origin
  // disappear outside the camera frustum.
  modelTransform = new THREE.Group();
  modelTransform.scale.setScalar(modelScale);
  modelTransform.position.copy(center).multiplyScalar(-modelScale);
  modelTransform.add(object);

  modelMotion = new THREE.Group();
  modelMotion.add(modelTransform);

  modelPlacement = new THREE.Group();
  modelPlacement.add(modelMotion);
  scene.add(modelPlacement);
  modelPlacement.updateMatrixWorld(true);
  updateModelLayout();

  const distance = 3.2 / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))) * 0.96;
  camera.position.set(distance * 0.82, distance * 0.55, distance);
  camera.lookAt(0, 0, 0);
  camera.near = Math.max(distance / 1000, 0.001);
  camera.far = distance * 100;
  camera.updateProjectionMatrix();

}

function updateModelLayout() {
  if (!modelPlacement) return;
  const aspect = host.clientWidth / Math.max(host.clientHeight, 1);
  modelPlacement.position.x = THREE.MathUtils.clamp((aspect - 0.45) * 0.8, 0.05, 0.95);
}

function showError(message, error) {
  if (error) console.error(message, error);
  loadingScreen.setAttribute('aria-label', message);
}

function dismissLoadingScreen() {
  const elapsed = performance.now() - loadingStartedAt;
  const remaining = Math.max(0, minimumLoadingDuration - elapsed);
  window.setTimeout(() => {
    loadingScreen.classList.add('is-leaving');
    window.setTimeout(() => {
      loadingScreen.hidden = true;
      startTitleTypewriter();
    }, 720);
  }, remaining);
}

function startTitleTypewriter() {
  const words = [...document.querySelectorAll('.name-word')];
  const characterDelay = 0.05;
  const wordPause = 0.3;
  const sequence = [];

  words.forEach((word) => {
    const letters = [...word.textContent];
    word.replaceChildren();
    for (const character of letters) {
      const letter = document.createElement('span');
      letter.className = 'name-letter';
      letter.textContent = character;
      word.append(letter);
      sequence.push({ letter, word });
    }
  });

  const caret = document.createElement('span');
  caret.className = 'typing-caret';
  caret.textContent = '|';
  sequence[0]?.word.prepend(caret);
  document.querySelector('#name-backdrop').classList.add('is-typing');

  let index = 0;
  const typeNextCharacter = () => {
    const next = sequence[index];
    if (!next) return;

    if (index > 0 && next.word !== sequence[index - 1].word) {
      next.word.prepend(caret);
    }
    next.letter.classList.add('is-typed');
    next.letter.after(caret);
    index += 1;

    if (index < sequence.length) {
      const changingWord = sequence[index].word !== next.word;
      window.setTimeout(typeNextCharacter, changingWord ? wordPause * 1000 : characterDelay * 1000);
    }
  };
  typeNextCharacter();
}

function setLoadingProgress(progress) {
  const clippedPercent = 100 - THREE.MathUtils.clamp(progress, 0, 100);
  for (const letterFill of loadingProgress) {
    letterFill.style.clipPath = `inset(${clippedPercent}% 0 0 0)`;
  }
}

new FBXLoader().load(
  './Untitled.fbx',
  (fbx) => {
    let meshCount = 0;
    fbx.traverse((child) => {
      if (!child.isMesh || !child.geometry?.attributes?.position) return;
      child.geometry = prepareWireGeometry(child.geometry);
      child.material = wireMaterial;
      child.castShadow = false;
      child.receiveShadow = false;
      meshCount += 1;
    });

    if (!meshCount) {
      showError('The FBX loaded, but it contains no mesh geometry.');
      return;
    }

    fitModel(fbx);
    setLoadingProgress(100);
    dismissLoadingScreen();
  },
  (event) => {
    if (event.total) {
      const percent = Math.round((event.loaded / event.total) * 100);
      setLoadingProgress(percent);
    }
  },
  (error) => showError('Could not load Untitled.fbx. Start the site with Start Viewer.cmd and check that Untitled.fbx is beside index.html.', error),
);

function resize() {
  const width = host.clientWidth;
  const height = host.clientHeight;
  if (!width || !height) return;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height, false);
  resizeNebula();
  resizeStarfield();
  updateModelLayout();
}

new ResizeObserver(resize).observe(host);
resize();

renderer.setAnimationLoop(() => {
  const time = performance.now();
  if (modelMotion) {
    const targetRotationX = pointer.y * 0.1;
    const targetRotationY = pointer.x * 0.16;
    const targetOffsetX = pointer.x * 0.09;
    const targetOffsetY = -pointer.y * 0.06;
    modelMotion.rotation.x += (targetRotationX - modelMotion.rotation.x) * 0.055;
    modelMotion.rotation.y += (targetRotationY - modelMotion.rotation.y) * 0.055;
    modelMotion.position.x += (targetOffsetX - modelMotion.position.x) * 0.055;
    modelMotion.position.y += (targetOffsetY - modelMotion.position.y) * 0.055;
  }
  drawNebula(time);
  drawStarfield(time);
  renderer.render(scene, camera);
});
