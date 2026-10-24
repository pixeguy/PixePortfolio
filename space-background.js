import { createParticleWorld } from './particle-world.js';
export const NEBULA_MOTION = { flowRate: 0.000035, minimumSpeed: 3, speedVariation: 0.25 };
let activeBackground = null;
export function getSpaceBackground() { return activeBackground; }
export function getSceneHeight() {
  return parseFloat(document.documentElement.style.getPropertyValue('--scene-full-height'))
    || document.querySelector('#canvas-host')?.clientHeight || window.innerHeight;
}

let viewportInitialized = false;
function stabilizeMobileCanvases() {
  if (viewportInitialized) return;
  viewportInitialized = true;
  const mobile = window.matchMedia('(max-width: 1024px)');
  let previousWidth = -1, previousOrientation = null;
  function update() {
    const root = document.documentElement;
    if (!mobile.matches) {
      root.style.removeProperty('--scene-unit');
      root.style.removeProperty('--scene-full-height');
      root.style.removeProperty('--scene-background-height');
      previousWidth = -1;
      return;
    }
    const width = root.clientWidth;
    const orientation = screen.orientation?.type ?? '';
    // Toolbar and keyboard height changes must not reallocate the canvases.
    if (Math.abs(width - previousWidth) <= 2 && orientation === previousOrientation) return;
    previousWidth = width;
    previousOrientation = orientation;
    const probe = document.createElement('div');
    probe.style.cssText = 'position:fixed;visibility:hidden;pointer-events:none;width:0;height:100lvh;';
    document.body.append(probe);
    const full = probe.getBoundingClientRect().height || window.innerHeight;
    probe.remove();
    root.style.setProperty('--scene-unit', `${full / 100}px`);
    root.style.setProperty('--scene-full-height', `${full}px`);
    // Some mobile browsers measure lvh before their toolbars finish collapsing.
    // Give only the background a full-screen overscan; never alter scene timing.
    root.style.setProperty('--scene-background-height', `${Math.max(full, screen.height) + 64}px`);
  }
  window.addEventListener('resize', update, { passive: true });
  screen.orientation?.addEventListener('change', update);
  mobile.addEventListener('change', update);
  update();
}

const math = {
  lerp: (a, b, t) => a + (b - a) * t,
  clamp: (value, min, max) => Math.max(min, Math.min(max, value)),
  smoothstep(value, min, max) {
    const t = Math.max(0, Math.min(1, (value - min) / (max - min)));
    return t * t * (3 - 2 * t);
  },
};

// Low-frequency moving noise changes the outline itself, inspired by the
// reference shader's differently moving layers. Only control points sample it.
export function nebulaNoise(x, y) {
  const ix = Math.floor(x), iy = Math.floor(y);
  const fx = x - ix, fy = y - iy;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  const hash = (a, b) => {
    const value = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
    return value - Math.floor(value);
  };
  return math.lerp(
    math.lerp(hash(ix, iy), hash(ix + 1, iy), u),
    math.lerp(hash(ix, iy + 1), hash(ix + 1, iy + 1), u), v);
}

// Shared by the portfolio and project pages; retain stable mobile sizing.
export function createSpaceBackground(host, nebulaCanvas, starCanvas) {
  stabilizeMobileCanvases();
  activeBackground = createParticleWorld(host, nebulaCanvas, starCanvas);
  return activeBackground;
}
