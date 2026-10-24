import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { projects } from './projects.js';
import { createProjectNavigation } from './page-navigation.js';
import { createSpaceBackground, nebulaNoise, NEBULA_MOTION } from './space-background.js';
import { createEdgeEffect } from './edge-effect.js';
import { updateScrollPalette, getForegroundPaletteProgress } from './scroll-palette.js';
import { createCursorBlob } from './cursor-blob.js';
import { createPurpleSequence } from './purple-sequence.js';
import { createFightingSequence } from './fighting-sequence.js';
import { createOneTimeText } from './one-time-text.js';
import { createJourneyTimeline } from './journey-timeline.js';

const host = document.querySelector('#canvas-host');
// Match the existing narrow CSS layout; wider viewports retain desktop behavior.
const mobileLayout = window.matchMedia('(max-width: 700px)');
const compactPortfolio = window.matchMedia('(max-width: 1024px)');
// In viewport heights: raise duration to require more scrolling to finish sitting.
const INTRO_SCROLL = { typeDuration: .35, holdUntil: .75, exitDuration: 1.1, timelineGap: .25 };
const timelineStart = INTRO_SCROLL.holdUntil + INTRO_SCROLL.exitDuration + INTRO_SCROLL.timelineGap;
const extraJourneySpace = timelineStart - 1.35;
const FIGHT_SCROLL = { start: .85, enterDuration: 1.2, idleDuration: 4.4 + extraJourneySpace, exitDuration: 1.2 };
// Offsets from the start of Fighting Idle, measured in viewport heights.
const SKILLS_SCROLL = { timelineExit: 2.5 + extraJourneySpace, start: 3 + extraJourneySpace, revealDuration: .45 };
const fightExitStart = FIGHT_SCROLL.start + FIGHT_SCROLL.enterDuration + FIGHT_SCROLL.idleDuration;
const HERO_SCROLL = { start: fightExitStart + FIGHT_SCROLL.exitDuration, duration: 2.2 };
function getHeroPaletteProgress(scroll) {
  return THREE.MathUtils.smoothstep(THREE.MathUtils.clamp(
    (scroll - fightExitStart) / (FIGHT_SCROLL.exitDuration + HERO_SCROLL.duration), 0, 1), 0, 1);
}
document.querySelector('#fighting-section').style.top = `${FIGHT_SCROLL.start * 100}svh`;
document.querySelector('#fighting-section').style.height = `${(FIGHT_SCROLL.enterDuration + FIGHT_SCROLL.idleDuration) * 100}svh`;
const fightingContent = document.querySelector('#fighting-content');
const nativeIntroScroll = CSS.supports('animation-timeline', 'scroll(root block)')
  && CSS.supports('animation-range', '0px 1px');
fightingContent.classList.toggle('intro-native-scroll', nativeIntroScroll);
const introExitStart = FIGHT_SCROLL.start + FIGHT_SCROLL.enterDuration + INTRO_SCROLL.holdUntil;
fightingContent.style.setProperty('--intro-exit-start', `${introExitStart * 100}svh`);
fightingContent.style.setProperty('--intro-exit-end', `${(introExitStart + INTRO_SCROLL.exitDuration) * 100}svh`);
const journeyTimeline = createJourneyTimeline(document.querySelector('.journey-timeline'));
function prepareTypingText(element) {
  const accessibleCopy = element.cloneNode(true);
  accessibleCopy.querySelectorAll('br').forEach(br => br.replaceWith('\n'));
  element.setAttribute('aria-label', accessibleCopy.textContent);
  const wrapper = document.createElement('span');
  wrapper.setAttribute('aria-hidden', 'true');
  // Retain inline markup, wrapping only text nodes in revealable letters.
  wrapper.append(...element.childNodes);
  const walker = document.createTreeWalker(wrapper, NodeFilter.SHOW_TEXT);
  const textNodes = [];
  while (walker.nextNode()) textNodes.push(walker.currentNode);
  const letters = [];
  for (const node of textNodes) {
    const fragment = document.createDocumentFragment();
    for (const character of node.textContent) {
      const letter = document.createElement('span');
      letter.textContent = character;
      letter.style.opacity = '0';
      fragment.append(letter);
      letters.push(letter);
    }
    node.replaceWith(fragment);
  }
  element.replaceChildren(wrapper);
  return letters;
}
const fightingText = [...fightingContent.querySelectorAll('.fighting-intro h2, .fighting-intro p')].flatMap(prepareTypingText);
const skillsSection = document.querySelector('#skills-section');
const skillsText = [...skillsSection.querySelectorAll('h3, dt, li')].flatMap(prepareTypingText);
let skillsTextCount = -1;
let fightingTextCount = -1;
function updateFightingText(scroll) {
  const idleStart = FIGHT_SCROLL.start + FIGHT_SCROLL.enterDuration;
  const introScroll = scroll - idleStart;
  const typed = THREE.MathUtils.clamp(introScroll / INTRO_SCROLL.typeDuration, 0, 1);
  // Native CSS owns the upward exit where supported. Older browsers keep the
  // stable fixed-position fade rather than moving text in the WebGL loop.
  const exitProgress = THREE.MathUtils.clamp(
    (introScroll - INTRO_SCROLL.holdUntil) / INTRO_SCROLL.exitDuration, 0, 1);
  if (!nativeIntroScroll) fightingContent.style.opacity = String(1 - exitProgress);
  const count = Math.floor(fightingText.length * typed);
  fightingContent.hidden = !loadingScreen.hidden || introScroll < 0 || exitProgress >= 1;
  const colourFade = getForegroundPaletteProgress(getHeroPaletteProgress(scroll));
  const timelineExit = THREE.MathUtils.smoothstep(scroll - idleStart, SKILLS_SCROLL.timelineExit, SKILLS_SCROLL.start - .05);
  journeyTimeline.update(scroll, idleStart + timelineStart, colourFade, loadingScreen.hidden, timelineExit);
  const skillsReveal = THREE.MathUtils.clamp((scroll - idleStart - SKILLS_SCROLL.start) / SKILLS_SCROLL.revealDuration, 0, 1);
  const skillsProgress = Math.min(skillsReveal, 1 - colourFade);
  skillsSection.hidden = !loadingScreen.hidden || skillsProgress <= 0;
  skillsSection.style.opacity = String(Math.min(1, skillsProgress * 4));
  const skillsCount = Math.floor(skillsText.length * skillsProgress);
  if (skillsCount !== skillsTextCount) {
    skillsTextCount = skillsCount;
    skillsText.forEach((letter, index) => { letter.style.opacity = index < skillsCount ? '1' : '0'; });
  }
  if (count === fightingTextCount) return;
  fightingTextCount = count;
  fightingText.forEach((letter, index) => {
    letter.style.opacity = index < count ? '1' : '0';
    letter.classList.toggle('fight-text-caret', count > 0 && count < fightingText.length && index === count - 1);
  });
}
const oneTimeText = createOneTimeText();
for (const id of ['fighting-section', 'portfolio', 'purple-section']) oneTimeText.register(document.getElementById(id));
// Screen heights of scrolling for the model's move and turn in the purple section.
const SECTION_SCROLL = { duration: 1, turnDegrees: 65, startBeforeTop: 0.7, exitDuration: 1 };
const purpleSection = document.querySelector('#purple-section');
purpleSection.style.minHeight = `${(SECTION_SCROLL.duration + 1) * 100}svh`;
document.querySelector('#nebula-return').style.minHeight = `${(SECTION_SCROLL.exitDuration + .2) * 100}svh`;
// Reveal the tabs halfway down the screen after the model finishes sitting.
document.documentElement.style.setProperty('--project-start', `${(HERO_SCROLL.start + HERO_SCROLL.duration + .5) * 100}svh`);
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
let purpleSequence = null;
let fightingSequence = null;
let titleEraseProgress = 0;
let sittingProgress = 0;
let titleSequence = [];
let titleTypedCount = 0;
let titleVisibleCount = -1;
let titleCaret = null;
const portfolioSection = document.querySelector('#portfolio');
const modelLiftAxis = new THREE.Vector3();
const pointer = { x: 0, y: 0 };
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const cursorBlob = createCursorBlob();
let scrollTarget = window.scrollY;
let scrollAnimating = false;
let lastFrameTime = performance.now();

// Native document scrolling retains the scrollbar, keyboard, and touch behavior.
// Wheel input eases toward its destination in the existing animation loop.
window.addEventListener('wheel', (event) => {
  if (event.ctrlKey || reducedMotion.matches || document.documentElement.classList.contains('project-view-open') || document.documentElement.classList.contains('is-navigating') || !loadingScreen.hidden
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
  const surface = document.createElement(project.href ? 'a' : 'div');
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
    // The anchor owns the padding and outline too, so the entire blob activates it.
    const link = surface;
    link.classList.add('project-link');
    link.href = project.href;
    link.addEventListener('click', event => {
      if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      if (new URL(link.href).origin !== location.origin) return;
      event.preventDefault();
      projectNavigation.open(link.href);
    });
    link.append(content);
  } else {
    surface.append(content);
  }
  return entry;
}
const projectsPerPage = 3;
const projectPageCount = Math.ceil(projects.length / projectsPerPage);
let currentProjectPage = 0;
const projectPagination = document.createElement('nav');
projectPagination.className = 'project-pagination';
projectPagination.setAttribute('aria-label', 'Project list pages');
const paginationFooter = document.createElement('div');
paginationFooter.className = 'project-pagination-footer';
paginationFooter.append(projectPagination);
document.querySelector('#projects-panel').after(paginationFooter);

function renderProjectPage(page, scrollToTabs = false) {
  currentProjectPage = THREE.MathUtils.clamp(page, 0, Math.max(0, projectPageCount - 1));
  outlineVisibility.disconnect();
  projectOutlines.length = 0;
  const first = currentProjectPage * projectsPerPage;
  projectList.replaceChildren(...projects.slice(first, first + projectsPerPage).map(createProjectEntry));
  projectPagination.replaceChildren();
  paginationFooter.hidden = projectPageCount <= 1;
  function addButton(label, destination, disabled = false, current = false) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = label;
    button.disabled = disabled;
    if (current) button.setAttribute('aria-current', 'page');
    button.addEventListener('click', () => {
      renderProjectPage(destination, true);
      projectPagination.querySelector('[aria-current="page"]')?.focus({ preventScroll: true });
    });
    projectPagination.append(button);
  }
  addButton('← Previous', currentProjectPage - 1, currentProjectPage === 0);
  for (let i = 0; i < projectPageCount; i += 1) {
    addButton(String(i + 1), i, false, i === currentProjectPage);
  }
  addButton('Next →', currentProjectPage + 1, currentProjectPage === projectPageCount - 1);
  oneTimeText.register(projectList);
  oneTimeText.register(projectPagination);
  if (scrollToTabs) {
    stopScrollEasing();
    document.querySelector('.portfolio-navigation').scrollIntoView({ behavior: reducedMotion.matches ? 'instant' : 'smooth', block: 'start' });
  }
}
renderProjectPage(0);

const portfolioTabs = [...document.querySelectorAll('.portfolio-tab')];
function selectPortfolioTab(selected) {
  paginationFooter.hidden = selected.id !== 'projects-tab' || projectPageCount <= 1;
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
const modelGold = new THREE.Color('#dca85e');
const modelViolet = new THREE.Color('#63435b');
const modelColor = new THREE.Color();

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
  let offset = THREE.MathUtils.clamp((aspect - 0.45) * 1.15, 0.12, 1.5);
  if (mobileLayout.matches) {
    const viewWidth = 2 * camera.position.length() * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * aspect;
    offset = Math.max(offset, viewWidth * .29);
  }
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
  titleSequence = sequence;
  titleCaret = caret;
  document.querySelector('#name-backdrop').classList.add('is-typing');

  let index = 0;
  const typeNextCharacter = () => {
    const next = sequence[index];
    if (!next) return;

    index += 1;
    titleTypedCount = index;
    updateTitleBackspace();

    if (index < sequence.length) {
      const changingWord = sequence[index].word !== next.word;
      window.setTimeout(typeNextCharacter, changingWord ? wordPause * 1000 : characterDelay * 1000);
    }
  };
  typeNextCharacter();
}

function updateTitleBackspace() {
  if (!titleSequence.length) return;
  titleCaret.hidden = titleEraseProgress >= 1;
  const count = Math.min(titleTypedCount, Math.floor(titleSequence.length * (1 - titleEraseProgress)));
  document.querySelector('#hero-social-links').hidden = count < titleSequence.length;
  if (count === titleVisibleCount) return;
  titleVisibleCount = count;
  titleSequence.forEach(({ letter }, index) => letter.classList.toggle('is-typed', index < count));
  if (count) titleSequence[count - 1].letter.after(titleCaret);
  else titleSequence[0].word.prepend(titleCaret);
}

function setLoadingProgress(progress) {
  const clippedPercent = 100 - THREE.MathUtils.clamp(progress, 0, 100);
  for (const letterFill of loadingProgress) {
    letterFill.style.clipPath = `inset(${clippedPercent}% 0 0 0)`;
  }
}

function initializeModelAnimation(fbx) {
  const findClip = name => fbx.animations.find(clip => clip.name.split('|').pop().toLowerCase() === name);
  const looking = findClip('standing');
  const standing = findClip('floor to stand');
  const sitting = findClip('floor');
  if (!looking || !standing || !sitting) {
    showError('The combined FBX needs Standing, Floor To Stand, and Floor animations.');
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
  fightingSequence = createFightingSequence(fbx, modelMixer, FIGHT_SCROLL);
  purpleSequence = createPurpleSequence(fbx, modelMixer, purpleSection);
  modelMixer.update(0);
  return true;
}

function updateModelAnimation(delta) {
  if (!modelAnimation) return;
  const { looking, sitting, transition } = modelAnimation;
  const viewportHeight = Math.max(host.clientHeight, 1);
  // Finish sitting before the project tabs arrive at the top of the viewport.
  const start = viewportHeight * HERO_SCROLL.start;
  const distance = viewportHeight * HERO_SCROLL.duration;
  const progress = loadingScreen.hidden
    ? THREE.MathUtils.clamp((window.scrollY - start) / distance, 0, 1) : 0;
  sittingProgress = progress;
  titleEraseProgress = loadingScreen.hidden
    ? THREE.MathUtils.clamp((window.scrollY / viewportHeight - FIGHT_SCROLL.start) / FIGHT_SCROLL.enterDuration, 0, 1) : 0;
  portfolioSection.classList.toggle('is-ready', progress >= 1);
  portfolioSection.inert = progress < 1 || document.body.classList.contains('is-project-view');
  updateTitleBackspace();
  const modelScroll = window.scrollY / viewportHeight;
  updateFightingText(modelScroll);
  if (purpleSequence?.active) return;
  if (fightingSequence.update(loadingScreen.hidden ? window.scrollY / viewportHeight : 0, delta)) return;
  const lookingWeight = 1 - THREE.MathUtils.smoothstep(progress, 0, 0.08);
  const sittingWeight = THREE.MathUtils.smoothstep(progress, 0.92, 1);
  looking.setEffectiveWeight(lookingWeight);
  sitting.setEffectiveWeight(sittingWeight);
  transition.setEffectiveWeight(1 - lookingWeight - sittingWeight);
  transition.paused = true;
  transition.time = (1 - progress) * transition.getClip().duration;
  // Idle animations run at the ends; stopping between them holds the pose.
  looking.paused = progress > 0;
  looking.enabled = true;
  looking.clampWhenFinished = false;
  looking.setLoop(THREE.LoopRepeat, Infinity).play();
  sitting.paused = progress < 1;
  if (progress >= 1) {
    // Scrubbing the purple sequence changes shared actions to LoopOnce.
    // Restore Floor's looping state when the hero controller owns it again.
    sitting.enabled = true;
    sitting.clampWhenFinished = false;
    sitting.setLoop(THREE.LoopRepeat, Infinity).play();
  }
  modelMixer.update(delta);
}

new FBXLoader().load(
  './assets/portfolio-character.fbx?v=20261013-jogging',
  (fbx) => {
    // Joint spheres are part of the character; only exclude the stray helper cube.
    const helpers = [];
    fbx.traverse(child => {
      if (child.isMesh && child.name === 'Cube') helpers.push(child);
    });
    for (const helper of helpers) helper.removeFromParent();
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
  (error) => showError('Could not load the character FBX. Start the site with Start Viewer.cmd and check assets/portfolio-character.fbx.', error),
);

let renderedWidth = 0, renderedHeight = 0;
function resize() {
  const width = host.clientWidth;
  const height = host.clientHeight;
  if (!width || !height) return;
  if (width === renderedWidth && height === renderedHeight) return;
  renderedWidth = width;
  renderedHeight = height;
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
      : window.scrollY + remaining * (1 - Math.exp(-6 * delta));
    window.scrollTo({ top: next, behavior: 'instant' });
    if (Math.abs(remaining) < 0.75) scrollAnimating = false;
  }
  updateModelAnimation(delta);
  if (purpleSequence && !document.body.classList.contains('is-project-view')) {
    purpleSequence.update(delta);
  }
  const viewportHeight = Math.max(host.clientHeight, 1);
  const sectionBounds = purpleSection.getBoundingClientRect();
  const sectionTop = sectionBounds.top;
  const entranceProgress = THREE.MathUtils.smoothstep(
    THREE.MathUtils.clamp((viewportHeight * SECTION_SCROLL.startBeforeTop - sectionTop) / (viewportHeight * SECTION_SCROLL.duration), 0, 1), 0, 1);
  const exitProgress = THREE.MathUtils.smoothstep(
    THREE.MathUtils.clamp((viewportHeight - sectionBounds.bottom) / (viewportHeight * SECTION_SCROLL.exitDuration), 0, 1), 0, 1);
  const sectionProgress = entranceProgress * (1 - exitProgress);
  // Colour is split exactly at the physical boundary, rather than fading the whole model.
  modelEdges.setColorBoundary(sectionTop / viewportHeight, sectionBounds.bottom / viewportHeight, 64 / viewportHeight);
  // Phones and tablets hide the model during Projects, then restore the same edge
  // strengths as the purple section enters. Reverse scrolling reverses both.
  modelEdges.setBlitThreshold(compactPortfolio.matches
    ? getHeroPaletteProgress(window.scrollY / viewportHeight) * 4.25 * (1 - entranceProgress) : 0);
  if (modelPlacement) {
    const aspect = host.clientWidth / Math.max(host.clientHeight, 1);
    const progress = THREE.MathUtils.smoothstep(window.scrollY / Math.max(host.clientHeight, 1), 0, 0.7);
    const originalOffset = THREE.MathUtils.clamp((aspect - 0.45) * 1.15, 0.12, 1.5);
    const viewWidth = 2 * camera.position.length() * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * aspect;
    const rightOffset = Math.max(originalOffset, viewWidth * 0.29);
    modelPlacement.position.set(1, 0, 0).applyQuaternion(camera.quaternion)
      .multiplyScalar(THREE.MathUtils.lerp(
        compactPortfolio.matches ? rightOffset : THREE.MathUtils.lerp(originalOffset, rightOffset, progress), -viewWidth * .25, sectionProgress));
    // Lift along screen-up as the sitting animation progresses, keeping feet in view.
    const lift = (viewWidth / aspect) * 0.12 * THREE.MathUtils.smoothstep(sittingProgress, 0, 1)
      * (purpleSequence?.active ? purpleSequence.liftFactor : 1);
    modelLiftAxis.set(0, 1, 0).applyQuaternion(camera.quaternion).multiplyScalar(lift);
    modelPlacement.position.add(modelLiftAxis);
  }
  if (modelMotion) {
    const targetRotationX = pointer.y * 0.1;
    const targetRotationY = pointer.x * 0.16 + THREE.MathUtils.degToRad(SECTION_SCROLL.turnDegrees) * sectionProgress;
    const targetOffsetX = pointer.x * 0.09;
    const targetOffsetY = -pointer.y * 0.06;
    modelMotion.rotation.x += (targetRotationX - modelMotion.rotation.x) * 0.055;
    modelMotion.rotation.y += (targetRotationY - modelMotion.rotation.y) * 0.055;
    modelMotion.position.x += (targetOffsetX - modelMotion.position.x) * 0.055;
    modelMotion.position.y += (targetOffsetY - modelMotion.position.y) * 0.055;
  }
  const paletteProgress = document.body.classList.contains('is-project-view')
    ? 1 : getHeroPaletteProgress(window.scrollY / viewportHeight);
  const backgroundProgress = updateScrollPalette(paletteProgress);
  modelColor.copy(modelGold).lerp(modelViolet, getForegroundPaletteProgress(paletteProgress));
  modelEdges.setColors(modelColor, modelGold);
  spaceBackground.draw(time, backgroundProgress);
  cursorBlob.draw(time);
  projectNavigation.update(time);
  oneTimeText.update(time);
  animateProjectOutlines(time);
  if (!document.body.classList.contains('is-project-view')) modelEdges.render(scene, camera);
});
