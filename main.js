import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { projects } from './projects.js';
import { createProjectNavigation } from './page-navigation.js';
import { createSpaceBackground, nebulaNoise, NEBULA_MOTION } from './space-background.js';
import { createEdgeEffect } from './edge-effect.js';

const host = document.querySelector('#canvas-host');
const loadingScreen = document.querySelector('#loading-screen');
const loadingProgress = document.querySelectorAll('.loader-monogram-fill');
const loadingStartedAt = performance.now();
const minimumLoadingDuration = 1000;
const nebulaCanvas = document.querySelector('#nebula');
const starCanvas = document.querySelector('#starfield');
const spaceBackground = createSpaceBackground(host, nebulaCanvas, starCanvas);
let modelMotion = null;
let modelPlacement = null;
let modelMixer = null;
let modelAnimation = null;
const modelLiftAxis = new THREE.Vector3();
const pointer = { x: 0, y: 0 };
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
let scrollTarget = window.scrollY;
let scrollAnimating = false;
let lastFrameTime = performance.now();

// Native document scrolling retains the scrollbar, keyboard, and touch behavior.
// Wheel input eases toward its destination in the existing animation loop.
window.addEventListener('wheel', (event) => {
  if (event.ctrlKey || reducedMotion.matches || document.documentElement.classList.contains('project-view-open') || !loadingScreen.hidden
      || Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;
  const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? window.innerHeight : 1;
  const maximum = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
  if (!scrollAnimating) scrollTarget = window.scrollY;
  scrollTarget = THREE.MathUtils.clamp(scrollTarget + event.deltaY * unit, 0, maximum);
  scrollAnimating = true;
  event.preventDefault();
}, { passive: false });

function stopScrollEasing() {
  scrollAnimating = false;
  scrollTarget = window.scrollY;
}
window.addEventListener('touchstart', stopScrollEasing, { passive: true });
window.addEventListener('pointerdown', stopScrollEasing);
window.addEventListener('keydown', (event) => {
  if (['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '].includes(event.key)) stopScrollEasing();
});

const projectNavigation = createProjectNavigation(reducedMotion);
const projectList = document.querySelector('#project-list');
const projectOutlines = [];
const outlineVisibility = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    const motion = projectOutlines.find(outline => outline.entry === entry.target);
    if (motion) motion.visible = entry.isIntersecting;
  });
}, { rootMargin: '80px' });

function sampleOutlineOffsets(outline, time) {
  const flow = time * NEBULA_MOTION.flowRate * outline.speed * 2.2 + outline.phase;
  const offsets = outline.points.map(point => ({
    x: (nebulaNoise(point.x * .003 + flow, point.y * .004 - flow * .53) - .5) * 32,
    y: (nebulaNoise(point.x * .004 - flow * .8 + 17, point.y * .003 + flow * .67) - .5) * 24,
  }));
  const meanX = offsets.reduce((sum, point) => sum + point.x, 0) / offsets.length;
  const meanY = offsets.reduce((sum, point) => sum + point.y, 0) / offsets.length;
  offsets.forEach(point => { point.x -= meanX; point.y -= meanY; });
  return offsets;
}

function animateProjectOutlines(time) {
  if (reducedMotion.matches || document.body.classList.contains('is-project-view')) return;
  for (const outline of projectOutlines) {
    if (!outline.visible) continue;
    // Sample the slow organic motion at 10 Hz; interpolate its cached points
    // every display frame. The ripple needs no noise or geometry measurements.
    const tick = Math.floor(time / 100);
    if (outline.noiseTick !== tick) {
      outline.offsetStart = outline.noiseTick === tick - 1 ? outline.offsetEnd : sampleOutlineOffsets(outline, tick * 100);
      outline.offsetEnd = sampleOutlineOffsets(outline, (tick + 1) * 100);
      outline.noiseTick = tick;
    }
    const fraction = (time - tick * 100) / 100;
    let index = 0;
    outline.path.setAttribute('d', outline.commands.map(command => {
      if (command === 'Z') return command;
      const count = command === 'M' ? 1 : 3;
      const coordinates = [];
      for (let i = 0; i < count; i += 1) {
        const point = outline.points[index];
        const start = outline.offsetStart[index], end = outline.offsetEnd[index];
        const x = start.x + (end.x - start.x) * fraction;
        const y = start.y + (end.y - start.y) * fraction;
        const waveTime = (time - outline.rippleAt) / 1000 - point.rippleDelay;
        // Restore the original short, damped ripple; retain cached geometry.
        const ripple = waveTime >= 0 && waveTime <= 0.5
          ? Math.sin(waveTime / 0.5 * Math.PI * 4) * Math.exp(-waveTime * 4.5) * 12 : 0;
        coordinates.push((point.x + x + point.normalX * ripple).toFixed(2),
          (point.y + y + point.normalY * ripple).toFixed(2));
        index += 1;
      }
      return command + ' ' + coordinates.join(' ');
    }).join(' '));
  }
}
window.addEventListener('pointerup', () => {
  document.querySelectorAll('.project-entry.is-pressed').forEach(entry => {
    entry.classList.remove('is-pressed');
    entry.classList.add('is-released');
  });
});
window.addEventListener('pointercancel', () => {
  document.querySelectorAll('.project-entry.is-pressed').forEach(entry => entry.classList.remove('is-pressed'));
});
function createProjectEntry(project) {
  const entry = document.createElement('article');
  entry.className = 'project-entry';
  const surface = document.createElement('div');
  surface.className = 'project-surface';
  entry.append(surface);
  const svgNamespace = 'http://www.w3.org/2000/svg';
  const outline = document.createElementNS(svgNamespace, 'svg');
  outline.classList.add('project-outline');
  outline.setAttribute('viewBox', '0 0 1000 650');
  outline.setAttribute('preserveAspectRatio', 'none');
  outline.setAttribute('aria-hidden', 'true');
  const contour = document.createElementNS(svgNamespace, 'path');
  contour.setAttribute('d', 'M 115 38 C 245 8 365 35 485 25 C 665 8 790 4 896 43 C 980 76 960 171 974 270 C 995 384 978 489 914 565 C 855 635 729 612 599 625 C 465 644 372 614 239 621 C 103 627 38 565 28 463 C 9 355 47 298 24 207 C 6 110 42 55 115 38 Z');
  const tokens = contour.getAttribute('d').match(/[MCZ]|-?[0-9.]+/g);
  const commands = [], points = [];
  for (let i = 0; i < tokens.length;) {
    const command = tokens[i++];
    commands.push(command);
    const count = command === 'M' ? 1 : command === 'C' ? 3 : 0;
    for (let j = 0; j < count; j += 1) points.push({ x: Number(tokens[i++]), y: Number(tokens[i++]) });
  }
  points.forEach(point => {
    point.angle = Math.atan2((point.y - 325) / 325, (point.x - 500) / 500);
    point.normalX = Math.cos(point.angle);
    point.normalY = Math.sin(point.angle) * 0.65;
    point.rippleDelay = 0;
  });
  const outlineMotion = { entry, path: contour, commands, points, phase: projectOutlines.length * 13.7,
    speed: NEBULA_MOTION.minimumSpeed + Math.random() * NEBULA_MOTION.speedVariation,
    rippleAt: -Infinity, rippleOrigin: 0, visible: false, noiseTick: -Infinity };
  projectOutlines.push(outlineMotion);
  outlineVisibility.observe(entry);
  entry.addEventListener('pointerenter', event => {
    if (reducedMotion.matches || event.pointerType === 'touch' || !project.href) return;
    const bounds = surface.getBoundingClientRect();
    const x = (event.clientX - bounds.left) / bounds.width - 0.5;
    const y = (event.clientY - bounds.top) / bounds.height - 0.5;
    outlineMotion.rippleOrigin = Math.atan2(y, x);
    points.forEach(point => {
      const distance = Math.abs(Math.atan2(Math.sin(point.angle - outlineMotion.rippleOrigin),
        Math.cos(point.angle - outlineMotion.rippleOrigin)));
      point.rippleDelay = distance / Math.PI * 0.1;
    });
    outlineMotion.rippleAt = performance.now() - 45;
  });
  entry.addEventListener('pointerdown', event => {
    if (event.button !== 0 || !project.href) return;
    entry.classList.remove('is-released');
    entry.classList.add('is-pressed');
  });
  entry.addEventListener('pointerleave', () => entry.classList.remove('is-pressed', 'is-released'));
  outline.append(contour);
  surface.append(outline);
  const heading = document.createElement('h2');
  heading.id = `project-${project.id}`;
  heading.textContent = project.title;
  entry.setAttribute('aria-labelledby', heading.id);
  const image = document.createElement('img');
  image.className = 'project-image';
  image.src = project.image;
  image.alt = project.imageAlt || project.title;
  image.loading = 'lazy';
  image.decoding = 'async';
  const description = document.createElement('p');
  description.textContent = project.description;
  const content = document.createElement('div');
  content.className = 'project-content';
  content.append(heading, image, description);
  if (project.href) {
    const link = document.createElement('a');
    link.className = 'project-link';
    link.href = project.href;
    link.addEventListener('click', event => {
      if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      if (new URL(link.href).origin !== location.origin) return;
      event.preventDefault();
      projectNavigation.open(link.href);
    });
    link.append(content);
    surface.append(link);
  } else {
    surface.append(content);
  }
  return entry;
}
projectList.replaceChildren(...projects.map(createProjectEntry));

const portfolioTabs = [...document.querySelectorAll('.portfolio-tab')];
function selectPortfolioTab(selected) {
  portfolioTabs.forEach(tab => {
    const active = tab === selected;
    tab.setAttribute('aria-selected', String(active));
    tab.tabIndex = active ? 0 : -1;
    document.getElementById(tab.getAttribute('aria-controls')).hidden = !active;
  });
}
portfolioTabs.forEach((tab, index) => {
  tab.addEventListener('click', () => selectPortfolioTab(tab));
  tab.addEventListener('keydown', event => {
    let next;
    if (event.key === 'ArrowRight') next = portfolioTabs[(index + 1) % portfolioTabs.length];
    if (event.key === 'ArrowLeft') next = portfolioTabs[(index + portfolioTabs.length - 1) % portfolioTabs.length];
    if (event.key === 'Home') next = portfolioTabs[0];
    if (event.key === 'End') next = portfolioTabs[portfolioTabs.length - 1];
    if (!next) return;
    event.preventDefault();
    selectPortfolioTab(next);
    next.focus({ preventScroll: true });
  });
});

function updatePointer(event) {
  pointer.x = THREE.MathUtils.clamp((event.clientX / window.innerWidth) * 2 - 1, -1, 1);
  pointer.y = THREE.MathUtils.clamp((event.clientY / window.innerHeight) * 2 - 1, -1, 1);
}

window.addEventListener('pointermove', updatePointer);
window.addEventListener('pointerleave', () => {
  pointer.x = 0;
  pointer.y = 0;
});

const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(38, 1, 0.01, 5000);

const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setClearColor(0x000000, 0);
host.appendChild(renderer.domElement);
const modelEdges = createEdgeEffect(renderer);

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
  const modelTransform = new THREE.Group();
  modelTransform.scale.setScalar(modelScale);
  modelTransform.position.copy(center).multiplyScalar(-modelScale);
  modelTransform.add(object);

  modelMotion = new THREE.Group();
  modelMotion.add(modelTransform);

  modelPlacement = new THREE.Group();
  modelPlacement.add(modelMotion);
  scene.add(modelPlacement);
  modelPlacement.updateMatrixWorld(true);

  const distance = 3.2 / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))) * 0.96;
  camera.position.set(distance * 0.82, distance * 0.55, distance);
  camera.lookAt(0, 0, 0);
  camera.near = Math.max(distance / 1000, 0.001);
  camera.far = distance * 100;
  camera.updateProjectionMatrix();
  updateModelLayout();

}

function updateModelLayout() {
  if (!modelPlacement) return;
  const aspect = host.clientWidth / Math.max(host.clientHeight, 1);
  const offset = THREE.MathUtils.clamp((aspect - 0.45) * 1.15, 0.12, 1.5);
  // Shift along the camera's horizontal axis so moving right cannot lower the model.
  modelPlacement.position.set(1, 0, 0).applyQuaternion(camera.quaternion).multiplyScalar(offset);
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
    const finish = () => {
      loadingScreen.hidden = true;
      document.documentElement.classList.remove('is-loading');
      startTitleTypewriter();
    };
    if (reducedMotion.matches) { finish(); return; }
    const wave = document.querySelector('#loading-wave-path');
    const startedAt = performance.now();
    const duration = 1200;
    function animateWave(time) {
      const progress = Math.min((time - startedAt) / duration, 1);
      const eased = progress * progress * (3 - 2 * progress);
      const level = -.08 + eased * 1.16;
      const amplitude = .065 * Math.sin(progress * Math.PI);
      const points = [];
      for (let i = 24; i >= 0; i -= 1) {
        const x = i / 24;
        const y = level + Math.sin(x * Math.PI * 3 + progress * Math.PI * 4) * amplitude
          + Math.sin(x * Math.PI * 5 - progress * Math.PI * 3) * amplitude * .3;
        points.push(`${x.toFixed(4)} ${y.toFixed(4)}`);
      }
      wave.setAttribute('d', `M 0 1 L 1 1 L ${points.join(' L ')} Z`);
      if (progress < 1) requestAnimationFrame(animateWave);
      else finish();
    }
    requestAnimationFrame(animateWave);
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

function initializeModelAnimation(fbx) {
  const findClip = name => fbx.animations.find(clip => clip.name.toLowerCase().includes(name));
  const looking = findClip('looking around');
  const standing = findClip('standing up');
  const sitting = findClip('sitting idle');
  if (!looking || !standing || !sitting) {
    showError('The combined FBX needs Looking Around, Standing Up, and Sitting Idle animations.');
    return false;
  }
  modelMixer = new THREE.AnimationMixer(fbx);
  const lookingAction = modelMixer.clipAction(looking).setLoop(THREE.LoopRepeat, Infinity);
  const sittingAction = modelMixer.clipAction(sitting).setLoop(THREE.LoopRepeat, Infinity);
  const transition = modelMixer.clipAction(standing).setLoop(THREE.LoopOnce, 1);
  transition.clampWhenFinished = true;
  lookingAction.reset().setEffectiveWeight(1).play();
  sittingAction.reset().setEffectiveWeight(0).play();
  transition.reset().setEffectiveWeight(0).play();
  transition.paused = true;
  transition.time = standing.duration;
  modelAnimation = { looking: lookingAction, sitting: sittingAction, transition };
  modelMixer.update(0);
  return true;
}

function updateModelAnimation(delta) {
  if (!modelAnimation) return;
  const { looking, sitting, transition } = modelAnimation;
  const viewportHeight = Math.max(host.clientHeight, 1);
  // Start below the banner and scrub the pose across 1.5 screens.
  const start = viewportHeight * 0.08;
  const distance = viewportHeight * 1.5;
  const progress = loadingScreen.hidden
    ? THREE.MathUtils.clamp((window.scrollY - start) / distance, 0, 1) : 0;
  const lookingWeight = 1 - THREE.MathUtils.smoothstep(progress, 0, 0.08);
  const sittingWeight = THREE.MathUtils.smoothstep(progress, 0.92, 1);
  looking.setEffectiveWeight(lookingWeight);
  sitting.setEffectiveWeight(sittingWeight);
  transition.setEffectiveWeight(1 - lookingWeight - sittingWeight);
  transition.time = (1 - progress) * transition.getClip().duration;
  // Idle animations run at the ends; stopping between them holds the pose.
  looking.paused = progress > 0;
  sitting.paused = progress < 1;
  modelMixer.update(delta);
}

new FBXLoader().load(
  './assets/Standing Up Combined.fbx?v=20261011-rebuild',
  (fbx) => {
    let meshCount = 0;
    fbx.traverse((child) => {
      if (!child.isMesh || !child.geometry?.attributes?.position) return;
      child.castShadow = false;
      child.receiveShadow = false;
      if (child.isSkinnedMesh) child.frustumCulled = false;
      meshCount += 1;
    });

    if (!meshCount) {
      showError('The FBX loaded, but it contains no mesh geometry.');
      return;
    }

    if (!initializeModelAnimation(fbx)) return;
    // Fit the model using the opening pose of its default animation.
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
  (error) => showError('Could not load the combined FBX. Start the site with Start Viewer.cmd and check assets/Standing Up Combined.fbx.', error),
);

function resize() {
  const width = host.clientWidth;
  const height = host.clientHeight;
  if (!width || !height) return;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height, false);
  spaceBackground.resize();
  updateModelLayout();
}

new ResizeObserver(resize).observe(host);
resize();
 
renderer.setAnimationLoop(() => {
  const time = performance.now();
  const delta = Math.min((time - lastFrameTime) / 1000, 0.05);
  lastFrameTime = time;
  if (scrollAnimating) {
    const maximum = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
    scrollTarget = THREE.MathUtils.clamp(scrollTarget, 0, maximum);
    const remaining = scrollTarget - window.scrollY;
    const next = Math.abs(remaining) < 0.75 ? scrollTarget
      : window.scrollY + remaining * (1 - Math.exp(-10 * delta));
    window.scrollTo({ top: next, behavior: 'instant' });
    if (Math.abs(remaining) < 0.75) scrollAnimating = false;
  }
  updateModelAnimation(delta);
  if (modelPlacement) {
    const aspect = host.clientWidth / Math.max(host.clientHeight, 1);
    const progress = THREE.MathUtils.smoothstep(window.scrollY / Math.max(host.clientHeight, 1), 0, 0.7);
    const originalOffset = THREE.MathUtils.clamp((aspect - 0.45) * 1.15, 0.12, 1.5);
    const viewWidth = 2 * camera.position.length() * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * aspect;
    const rightOffset = Math.max(originalOffset, viewWidth * 0.29);
    modelPlacement.position.set(1, 0, 0).applyQuaternion(camera.quaternion)
      .multiplyScalar(THREE.MathUtils.lerp(originalOffset, rightOffset, progress));
    // Lift along screen-up as the sitting animation progresses, keeping feet in view.
    const sittingProgress = THREE.MathUtils.clamp((window.scrollY / Math.max(host.clientHeight, 1) - 0.08) / 1.8, 0, 1);
    const lift = (viewWidth / aspect) * 0.12 * THREE.MathUtils.smoothstep(sittingProgress, 0, 1);
    modelLiftAxis.set(0, 1, 0).applyQuaternion(camera.quaternion).multiplyScalar(lift);
    modelPlacement.position.add(modelLiftAxis);
  }
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
  spaceBackground.draw(time);
  projectNavigation.update(time);
  animateProjectOutlines(time);
  if (!document.body.classList.contains('is-project-view')) modelEdges.render(scene, camera);
});
