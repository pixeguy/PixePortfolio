// Shared yellow wave cover for home and standalone project navigation.
export function createNavigationLoader(reducedMotion) {
  const overlay = document.createElement('section');
  overlay.className = 'navigation-loader';
  overlay.hidden = true;
  overlay.setAttribute('role', 'status');
  overlay.setAttribute('aria-label', 'Loading project');
  const id = `navigation-wave-${Math.random().toString(36).slice(2)}`;
  overlay.innerHTML = `<svg class="loading-wave-definitions" width="0" height="0" aria-hidden="true"><defs><clipPath id="${id}" clipPathUnits="objectBoundingBox"><path /></clipPath></defs></svg><div class="loader-monogram" aria-hidden="true"><span class="loader-letter"><span class="loader-letter-base">Z</span><span class="loader-monogram-fill">Z</span></span><span class="loader-letter"><span class="loader-letter-base">F</span><span class="loader-monogram-fill">F</span></span></div>`;
  overlay.style.clipPath = `url(#${id})`;
  document.body.append(overlay);
  const path = overlay.querySelector('path');
  function wave(level, progress) {
    const amplitude = .065 * Math.sin(progress * Math.PI);
    const points = [];
    for (let i = 24; i >= 0; i--) {
      const x = i / 24;
      const y = level + Math.sin(x * Math.PI * 3 + progress * Math.PI * 4) * amplitude
        + Math.sin(x * Math.PI * 5 - progress * Math.PI * 3) * amplitude * .3;
      points.push(`${x.toFixed(4)} ${y.toFixed(4)}`);
    }
    path.setAttribute('d', `M 0 1 L 1 1 L ${points.join(' L ')} Z`);
  }
  function animate(from, to, duration) {
    if (reducedMotion.matches) { wave(to, 1); return Promise.resolve(); }
    return new Promise(resolve => {
      const start = performance.now();
      function frame(time) {
        const progress = Math.min((time - start) / duration, 1);
        const eased = progress * progress * (3 - 2 * progress);
        wave(from + (to - from) * eased, progress);
        if (progress < 1) requestAnimationFrame(frame); else resolve();
      }
      requestAnimationFrame(frame);
    });
  }
  return {
    async cover() {
      overlay.hidden = false;
      overlay.classList.remove('is-revealing');
      document.documentElement.classList.add('is-navigating');
      wave(1.08, 0);
      await animate(1.08, -.08, 700);
      path.setAttribute('d', 'M 0 0 H 1 V 1 H 0 Z');
    },
    async reveal() {
      overlay.classList.add('is-revealing');
      await animate(-.08, 1.08, 1200);
      overlay.hidden = true;
      document.documentElement.classList.remove('is-navigating');
    },
  };
}
