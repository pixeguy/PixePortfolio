import { nebulaNoise } from './space-background.js';
import { EDGE_SETTINGS } from './edge-effect.js';

export const CURSOR_BLOB_SETTINGS = {
  minimumSpeed: 140, // Pixels per second.
  minimumDistance: 16, // Pixels of continuous movement before appearing.
  minimumRadius: 12,
  maximumRadius: 30,
  linger: 140, // Milliseconds before fading after qualifying movement stops.
  opacity: .42,
};

export function createCursorBlob() {
  const canvas = document.createElement('canvas');
  canvas.className = 'cursor-blob';
  canvas.setAttribute('aria-hidden', 'true');
  document.body.append(canvas);
  const context = canvas.getContext('2d');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const purpleSection = document.querySelector('#purple-section');
  const cursor = { x: 0, y: 0, speed: 0, direction: 0 };
  const blob = { x: 0, y: 0, radius: 10, opacity: 0, direction: 0 };
  let previous = null, travelled = 0, activeUntil = 0, lastFrame = 0;
  window.addEventListener('pointermove', event => {
    if (event.pointerType === 'touch' || reducedMotion.matches) return;
    const now = performance.now();
    cursor.x = event.clientX + 7;
    cursor.y = event.clientY + 10;
    if (!previous || now - previous.time > 160) {
      previous = { x: cursor.x, y: cursor.y, time: now };
      travelled = 0;
      cursor.speed = 0;
      if (blob.opacity < .01) { blob.x = cursor.x; blob.y = cursor.y; }
      return;
    }
    const dx = cursor.x - previous.x, dy = cursor.y - previous.y;
    const distance = Math.hypot(dx, dy);
    const speed = distance / Math.max((now - previous.time) / 1000, .001);
    cursor.speed += (speed - cursor.speed) * .4;
    if (distance > .1) cursor.direction = Math.atan2(dy, dx);
    travelled = speed >= CURSOR_BLOB_SETTINGS.minimumSpeed ? travelled + distance : 0;
    if (speed >= CURSOR_BLOB_SETTINGS.minimumSpeed && travelled >= CURSOR_BLOB_SETTINGS.minimumDistance) {
      activeUntil = now + CURSOR_BLOB_SETTINGS.linger;
    }
    previous = { x: cursor.x, y: cursor.y, time: now };
  }, { passive: true });
  function stop() { activeUntil = 0; previous = null; travelled = 0; }
  window.addEventListener('pointerleave', stop);
  window.addEventListener('blur', stop);

  return {
    draw(time) {
      const width = window.innerWidth, height = window.innerHeight;
      const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
      if (canvas.width !== Math.round(width * ratio) || canvas.height !== Math.round(height * ratio)) {
        canvas.width = Math.round(width * ratio);
        canvas.height = Math.round(height * ratio);
        context.setTransform(ratio, 0, 0, ratio, 0, 0);
      }
      context.clearRect(0, 0, width, height);
      const delta = Math.min((time - (lastFrame || time)) / 1000, .05);
      lastFrame = time;
      if (reducedMotion.matches) { blob.opacity = 0; return; }
      const speed = Math.min(cursor.speed / 1800, 1);
      const follow = 1 - Math.exp(-(60 + speed * 80) * delta);
      blob.x += (cursor.x - blob.x) * follow;
      blob.y += (cursor.y - blob.y) * follow;
      blob.direction += Math.atan2(Math.sin(cursor.direction - blob.direction), Math.cos(cursor.direction - blob.direction)) * follow;
      const targetRadius = CURSOR_BLOB_SETTINGS.minimumRadius + speed * (CURSOR_BLOB_SETTINGS.maximumRadius - CURSOR_BLOB_SETTINGS.minimumRadius);
      blob.radius += (targetRadius - blob.radius) * follow;
      const visible = time < activeUntil;
      blob.opacity += ((visible ? 1 : 0) - blob.opacity) * (1 - Math.exp(-14 * delta));
      if (blob.opacity < .005) return;
      const points = Array.from({ length: 12 }, (_, index) => {
        const angle = index / 12 * Math.PI * 2;
        const radius = .78 + nebulaNoise(Math.cos(angle) + time * .0008, Math.sin(angle) - time * .0005) * .4;
        const x = Math.cos(angle) * blob.radius * radius * (1 + speed * 1.2);
        const y = Math.sin(angle) * blob.radius * radius;
        return { x: blob.x + x * Math.cos(blob.direction) - y * Math.sin(blob.direction),
          y: blob.y + x * Math.sin(blob.direction) + y * Math.cos(blob.direction) };
      });
      const first = points[0], last = points[points.length - 1];
      context.beginPath();
      context.moveTo((first.x + last.x) / 2, (first.y + last.y) / 2);
      points.forEach((point, index) => {
        const next = points[(index + 1) % points.length];
        context.quadraticCurveTo(point.x, point.y, (point.x + next.x) / 2, (point.y + next.y) / 2);
      });
      context.closePath();
      context.fillStyle = EDGE_SETTINGS.color;
      if (purpleSection && !document.body.classList.contains('is-project-view')) {
        const bounds = purpleSection.getBoundingClientRect();
        const x = Math.max(-1, Math.min(1, (blob.x - bounds.left) / bounds.width * 2 - 1));
        const inset = 64 * (1 - Math.sqrt(Math.max(0, 1 - x * x)));
        if (blob.y >= bounds.top + inset && blob.y <= bounds.bottom - inset) {
          context.fillStyle = '#d4c444';
        }
      }
      context.globalAlpha = CURSOR_BLOB_SETTINGS.opacity * blob.opacity;
      context.fill();
      context.globalAlpha = 1;
    },
  };
}
